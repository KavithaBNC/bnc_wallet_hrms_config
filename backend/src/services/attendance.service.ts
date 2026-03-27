
import { AppError } from '../middlewares/errorHandler';
import { AttendanceStatus, CheckInMethod, LeaveStatus, Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { shiftService } from './shift.service';
import { shiftAssignmentRuleService } from './shift-assignment-rule.service';
import { ValidationProcessRuleService } from './validation-process-rule.service';
import { getDataScope } from '../utils/data-scope';
import {
  CheckInInput,
  CheckOutInput,
  QueryAttendanceRecordsInput,
  QueryAttendanceSummaryInput,
  QueryAttendanceReportInput,
} from '../utils/attendance.validation';
import {
  computeExcessStayMinutesByShift,
  EventRuleData,
  getApplicableExcessTimeRule,
  isExcessTimeConversionEnabled,
} from '../utils/excess-time-rule';
import {
  canPerformAttendanceEventAction,
  resolveRightsAllocationForEmployee,
} from '../utils/rights-allocation';
import { readEntitlementDaysForEmployeeYear } from '../utils/auto-credit-entitlement';
import { leaveBalanceService } from './leave-balance.service';
import { monthlyAttendanceSummaryService } from './monthly-attendance-summary.service';

const validationProcessRuleService = new ValidationProcessRuleService();

export class AttendanceService {
  private static readonly DEFAULT_TIMEZONE = 'Asia/Kolkata';
  private isMissingExcessStayColumnError(error: unknown): boolean {
    const prismaErr = error as { code?: string; message?: string };
    return prismaErr?.code === 'P2022' || String(prismaErr?.message || '').includes('excess_stay_minutes');
  }

  private getDateKeyInTimeZone(date: Date, timeZone: string): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const year = parts.find((p) => p.type === 'year')?.value || '1970';
    const month = parts.find((p) => p.type === 'month')?.value || '01';
    const day = parts.find((p) => p.type === 'day')?.value || '01';
    return `${year}-${month}-${day}`;
  }

  private getDateAtUtcMidnight(dateKey: string): Date {
    return new Date(`${dateKey}T00:00:00.000Z`);
  }

  private addUtcDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setUTCDate(d.getUTCDate() + days);
    return d;
  }

  private parseHHMMToMinutes(hhmm: string | null | undefined): number | null {
    if (!hhmm) return null;
    const [h, m] = String(hhmm).split(':').map((x) => parseInt(x, 10));
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  }

  private getMinutesInTimeZone(date: Date, timeZone: string): number {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const h = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
    const m = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
    return (Number.isNaN(h) ? 0 : h) * 60 + (Number.isNaN(m) ? 0 : m);
  }

  /**
   * Resolve canonical attendance date (working date / shift start date) for a punch.
   * - Never derived from server date.
   * - For normal shifts: same local day as punch (in organization timezone).
   * - For overnight shifts: punches after midnight and before shift end belong to previous shift start date.
   */
  async resolveAttendanceDateForPunch(employeeId: string, punchTimestamp: Date): Promise<Date> {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        organizationId: true,
        shiftId: true,
        shift: { select: { id: true, startTime: true, endTime: true } },
        organization: { select: { timezone: true } },
      },
    });
    if (!employee) throw new AppError('Employee not found', 404);

    const timeZone = employee.organization?.timezone || AttendanceService.DEFAULT_TIMEZONE;
    const punchDateKey = this.getDateKeyInTimeZone(punchTimestamp, timeZone);
    const punchWorkDate = this.getDateAtUtcMidnight(punchDateKey);
    const previousWorkDate = this.addUtcDays(punchWorkDate, -1);

    // Check previous day's effective shift first; if it is overnight, early-hours punches belong to that shift start date.
    const prevShiftFromRules = await shiftAssignmentRuleService.getApplicableShiftForEmployee(
      employeeId,
      previousWorkDate,
      employee.organizationId
    );
    const prevShift = prevShiftFromRules || employee.shift || null;
    const prevStartMin = this.parseHHMMToMinutes(prevShift?.startTime);
    const prevEndMin = this.parseHHMMToMinutes(prevShift?.endTime);
    const prevIsOvernight =
      prevStartMin != null &&
      prevEndMin != null &&
      prevEndMin <= prevStartMin;
    if (prevIsOvernight) {
      const punchMins = this.getMinutesInTimeZone(punchTimestamp, timeZone);
      if (punchMins <= (prevEndMin as number)) {
        return previousWorkDate;
      }
    }

    return punchWorkDate;
  }

  /**
   * Check if date is a weekend
   */
  private isWeekend(date: Date): boolean {
    const day = date.getDay();
    return day === 0 || day === 6; // Sunday or Saturday
  }

  /**
   * Check if date is a holiday
   */
  private async isHoliday(date: Date, organizationId: string): Promise<boolean> {
    const dateStart = new Date(date);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(date);
    dateEnd.setHours(23, 59, 59, 999);

    const holiday = await prisma.holiday.findFirst({
      where: {
        organizationId,
        date: {
          gte: dateStart,
          lte: dateEnd,
        },
      },
    });

    return !!holiday;
  }

  /**
   * Calculate work hours
   */
  private calculateWorkHours(checkIn: Date, checkOut: Date, breakHours: number = 0): number {
    const diffMs = checkOut.getTime() - checkIn.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    return Math.max(0, diffHours - breakHours);
  }

  /**
   * Get all punches for an employee on a given day (sorted by punch time).
   */
  async getPunchesForDay(employeeId: string, date: Date) {
    const dayStart = this.getDateAtUtcMidnight(date.toISOString().slice(0, 10));
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    return prisma.attendancePunch.findMany({
      where: {
        employeeId,
        punchTime: { gte: dayStart, lt: dayEnd },
      },
      orderBy: { punchTime: 'asc' },
    });
  }

  /**
   * Universal Multi-Punch Engine: single logic for FACE, CARD, and MANUAL.
   * - Date: use manualDate + manualTime if provided, else now.
   * - Toggle: no punch → IN; last IN → OUT; last OUT → IN.
   * - Safety: for FACE/CARD, reject if last punch was within 2 minutes; skip for MANUAL.
   */
  async processAttendancePunch(
    employeeId: string,
    source: 'FACE' | 'CARD' | 'MANUAL',
    manualDate?: string,
    manualTime?: string,
    punchAtISO?: string
  ): Promise<{ punch: { id: string; punchTime: Date; status: string; punchSource: string }; dayStart: Date }> {
    let punchTimestamp: Date;
    if (punchAtISO) {
      // Frontend sends punchAt as ISO (built from user's local date+time) so 4:59 PM stays 4:59 PM
      punchTimestamp = new Date(punchAtISO);
    } else if (manualDate && manualTime) {
      // Fallback: manualDate = yyyy-MM-dd, manualTime = HH:mm or HH:mm:ss (treated as UTC for API-only callers)
      const [y, m, d] = manualDate.split('-').map(Number);
      const timeParts = manualTime.split(':').map(Number);
      const h = timeParts[0] ?? 0;
      const min = timeParts[1] ?? 0;
      const s = timeParts[2] ?? 0;
      punchTimestamp = new Date(Date.UTC(y, m - 1, d, h, min, s, 0));
    } else {
      punchTimestamp = new Date();
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, employeeCode: true },
    });
    if (!employee) throw new AppError('Employee not found', 404);

    const dayStart = await this.resolveAttendanceDateForPunch(employeeId, punchTimestamp);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const lastPunch = await prisma.attendancePunch.findFirst({
      where: {
        employeeId,
        punchTime: { gte: dayStart, lt: dayEnd },
      },
      orderBy: { punchTime: 'desc' },
    });

    const DUPLICATE_PUNCH_WAIT_SECONDS = 120; // 2 minutes for FACE/CARD
    const lastPunchAgoMs = lastPunch ? punchTimestamp.getTime() - lastPunch.punchTime.getTime() : 0;
    if (source !== 'MANUAL' && lastPunch && lastPunchAgoMs < DUPLICATE_PUNCH_WAIT_SECONDS * 1000) {
      const retryAfter = Math.ceil((DUPLICATE_PUNCH_WAIT_SECONDS * 1000 - lastPunchAgoMs) / 1000);
      throw new AppError(
        `Duplicate punch detected. Please wait ${retryAfter} seconds between punches.`,
        400
      );
    }

    let newStatus: string;
    if (!lastPunch) {
      newStatus = 'IN';
    } else {
      const last = lastPunch.status?.toUpperCase() || '';
      newStatus = last === 'IN' ? 'OUT' : 'IN';
    }

    const punch = await prisma.attendancePunch.create({
      data: {
        employeeId,
        punchTime: punchTimestamp,
        status: newStatus,
        punchSource: source,
      },
    });

    await prisma.attendanceLog.create({
      data: {
        deviceId: null,
        userId: employee.employeeCode,
        punchTimestamp,
        status: newStatus === 'IN' ? '0' : '1',
        employeeId,
        punchSource: source,
      },
    });

    await this.syncAttendanceRecordFromPunches(employeeId, dayStart);

    return {
      punch: {
        id: punch.id,
        punchTime: punch.punchTime,
        status: punch.status,
        punchSource: punch.punchSource || source,
      },
      dayStart,
    };
  }

  /**
   * Get all punches for an employee in a date range (for calendar display of every IN/OUT).
   */
  async getPunchesInRange(employeeId: string, startDate: string, endDate: string) {
    const start = new Date(startDate + 'T00:00:00.000Z');
    const end = new Date(endDate + 'T00:00:00.000Z');
    end.setUTCDate(end.getUTCDate() + 1);

    return prisma.attendancePunch.findMany({
      where: {
        employeeId,
        punchTime: { gte: start, lt: end },
      },
      orderBy: { punchTime: 'asc' },
    });
  }

  /**
   * Calculate total work hours from IN/OUT punch pairs for a day.
   */
  async calculateWorkHoursFromPunches(
    employeeId: string,
    date: Date,
    asOf?: Date
  ): Promise<{
    totalWorkHours: number;
    pairs: Array<{ in: Date; out: Date; hours: number }>;
    lastPunchStatus: 'IN' | 'OUT' | null;
  }> {
    const punches = await this.getPunchesForDay(employeeId, date);
    const pairs: Array<{ in: Date; out: Date; hours: number }> = [];
    let totalWorkHours = 0;
    let lastPunchStatus: 'IN' | 'OUT' | null = null;

    for (let i = 0; i < punches.length; i++) {
      const p = punches[i];
      const status = (p.status?.toUpperCase() === 'OUT' ? 'OUT' : 'IN') as 'IN' | 'OUT';
      lastPunchStatus = status;

      if (status === 'IN') {
        const nextOut = punches.slice(i + 1).find((x) => (x.status?.toUpperCase() || '') === 'OUT');
        const outTime = nextOut
          ? nextOut.punchTime
          : asOf
            ? new Date(asOf)
            : null;
        if (outTime && outTime.getTime() > p.punchTime.getTime()) {
          const hours = (outTime.getTime() - p.punchTime.getTime()) / (1000 * 60 * 60);
          pairs.push({ in: p.punchTime, out: outTime, hours });
          totalWorkHours += hours;
        }
      }
    }

    return { totalWorkHours, pairs, lastPunchStatus };
  }

  /**
   * Sync attendance record for a day from punch data: first IN → checkIn,
   * last OUT → checkOut, total work hours from IN/OUT pairs.
   * Applies Attendance Policy (Late & Others) and persists is_late, late_minutes, is_early, early_minutes, is_deviation, deviation_reason, ot_minutes.
   */
  async syncAttendanceRecordFromPunches(employeeId: string, date: Date) {
    const punches = await this.getPunchesForDay(employeeId, date);
    if (punches.length === 0) return null;

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { shift: true },
    });
    if (!employee) return null;

    const dayStart = this.getDateAtUtcMidnight(date.toISOString().slice(0, 10));
    const { totalWorkHours, pairs } = await this.calculateWorkHoursFromPunches(employeeId, date, new Date());

    const firstIn = punches.find((p) => (p.status?.toUpperCase() || '') === 'IN');
    const outPunches = punches.filter((p) => (p.status?.toUpperCase() || '') === 'OUT');
    const lastOutRaw = outPunches.length > 0 ? outPunches[outPunches.length - 1].punchTime : null;

    // Use paired IN/OUT so checkOut is never before checkIn (fixes wrong "Early going: 735 min" and "Total Net Work Time: 00:00" when last OUT is before first IN, e.g. AM/PM or next-day punch)
    let checkIn: Date | null = firstIn?.punchTime ?? null;
    let checkOut: Date | null = lastOutRaw ?? null;
    if (pairs.length > 0) {
      checkIn = pairs[0].in;
      checkOut = pairs[pairs.length - 1].out;
      // If still in (last punch IN), checkOut stays null for "Currently In"
      const lastPunch = punches[punches.length - 1];
      if ((lastPunch?.status?.toUpperCase() || '') === 'IN') checkOut = null;
    } else if (checkOut && checkIn && checkOut.getTime() < checkIn.getTime()) {
      checkOut = null; // Invalid: last OUT before first IN; treat as no check-out yet
    }

    let status: AttendanceStatus = AttendanceStatus.PRESENT;
    if (this.isWeekend(dayStart)) status = AttendanceStatus.WEEKEND;
    else if (await this.isHoliday(dayStart, employee.organizationId)) status = AttendanceStatus.HOLIDAY;

    const workHoursRounded = Math.round(totalWorkHours * 100) / 100;

    // Break = sum of gaps between consecutive IN/OUT pairs (e.g. Out 13:00 → In 14:30 = 1.5h) for "Minimum Break Hours consider as Deviation" and excess break
    let breakHoursFromPunches = 0;
    if (pairs.length >= 2) {
      for (let i = 0; i < pairs.length - 1; i++) {
        const gapOut = pairs[i].out;
        const gapIn = pairs[i + 1].in;
        if (gapIn.getTime() > gapOut.getTime()) {
          breakHoursFromPunches += (gapIn.getTime() - gapOut.getTime()) / (1000 * 60 * 60);
        }
      }
    }
    const breakHoursRounded = Math.round(breakHoursFromPunches * 100) / 100;

    const record = await prisma.attendanceRecord.upsert({
      where: {
        employeeId_date: { employeeId, date: dayStart },
      },
      create: {
        employeeId,
        shiftId: employee.shiftId || null,
        date: dayStart,
        checkIn,
        checkOut,
        workHours: new Prisma.Decimal(workHoursRounded),
        breakHours: breakHoursRounded > 0 ? new Prisma.Decimal(breakHoursRounded) : undefined,
        status,
      },
      update: {
        checkIn,
        checkOut,
        workHours: new Prisma.Decimal(workHoursRounded),
        ...(breakHoursRounded >= 0 ? { breakHours: new Prisma.Decimal(breakHoursRounded) } : {}),
        status,
      },
    });

    // Apply policy: full (late/early/deviation/OT) when we have both check-in and check-out; late-only when only check-in (e.g. "Currently In")
    // Also compute late/early for WEEKEND so calendar can show them when policy is YES (e.g. 28th).
    // Resolve shift: use record/employee shiftId; if missing, resolve from shift-assignment rules so policy and grace are applied.
    let effectiveShiftId = record.shiftId ?? employee.shiftId;
    let shiftForCompute: { startTime: string | null; endTime: string | null; breakDuration?: number | null } | null =
      employee.shift
        ? {
            startTime: employee.shift.startTime,
            endTime: employee.shift.endTime,
            breakDuration: employee.shift.breakDuration,
          }
        : null;
    if (!shiftForCompute && effectiveShiftId) {
      const shiftRow = await prisma.shift.findUnique({
        where: { id: effectiveShiftId },
        select: { startTime: true, endTime: true, breakDuration: true },
      });
      if (shiftRow) {
        shiftForCompute = {
          startTime: shiftRow.startTime,
          endTime: shiftRow.endTime,
          breakDuration: shiftRow.breakDuration,
        };
      }
    }
    let resolvedShiftFromRules = false;
    if (!effectiveShiftId || !shiftForCompute) {
      const shiftFromRule = await shiftAssignmentRuleService.getApplicableShiftForEmployee(
        employeeId,
        dayStart,
        employee.organizationId
      );
      if (shiftFromRule) {
        effectiveShiftId = shiftFromRule.id;
        shiftForCompute = {
          startTime: shiftFromRule.startTime,
          endTime: shiftFromRule.endTime,
          breakDuration: null,
        };
        resolvedShiftFromRules = true;
      }
    }
    if ((status === AttendanceStatus.PRESENT || status === AttendanceStatus.WEEKEND) && checkIn && effectiveShiftId && shiftForCompute) {
      let policyRules: Record<string, any> | null = null;
      try {
        policyRules = await shiftAssignmentRuleService.getApplicablePolicyRules(
          effectiveShiftId,
          employeeId,
          dayStart,
          employee.organizationId
        );
      } catch (e) {
        // ignore
      }

      let excessRuleData: EventRuleData | null = null;
      if (checkOut) {
        try {
          const rule = await getApplicableExcessTimeRule(employeeId, employee.organizationId, dayStart);
          excessRuleData = rule.ruleData;
        } catch {
          excessRuleData = null;
        }
        // Full policy when we have both check-in and check-out. Use approved permission end (e.g. 11:00) as effective shift start for late so 9–11 permission + punch at 11 is not late.
        const dayStartLocal = new Date(checkIn.getFullYear(), checkIn.getMonth(), checkIn.getDate(), 0, 0, 0, 0);
        const effectiveShiftStartForLate = await this.getApprovedPermissionEndForDay(employeeId, dayStartLocal);
        const breakHours =
          record.breakHours != null
            ? parseFloat(record.breakHours.toString())
            : shiftForCompute?.breakDuration
              ? shiftForCompute.breakDuration / 60
              : 0;
        const computed = await this.computePolicyFieldsForDay(
          checkIn,
          checkOut,
          breakHours,
          shiftForCompute,
          policyRules,
          dayStart,
          status,
          excessRuleData,
          effectiveShiftStartForLate
        );
        await prisma.attendanceRecord.update({
          where: { id: record.id },
          data: {
            ...(resolvedShiftFromRules ? { shiftId: effectiveShiftId } : {}),
            workHours: new Prisma.Decimal(computed.workHours),
            overtimeHours: new Prisma.Decimal(computed.overtimeHours),
            otMinutes: computed.otMinutes > 0 ? computed.otMinutes : null,
            excessStayMinutes: computed.excessStayMinutes > 0 ? computed.excessStayMinutes : null,
            isLate: computed.isLate,
            lateMinutes: computed.lateMinutes ?? null,
            isEarly: computed.isEarly,
            earlyMinutes: computed.earlyMinutes ?? null,
            isDeviation: computed.isDeviation,
            deviationReason: computed.deviationReason ?? null,
          },
        });

        // -------------------------------------------------------------------
        // Validation Process Rule – Late handling (Phase 4 – read-only)
        // -------------------------------------------------------------------
        // NOTE: This block is intentionally conservative:
        // - It NEVER throws (all helpers fail soft)
        // - It does not change attendance or leave data yet
        // - It only logs which rule/action would be applied
        try {
          if (
            computed.isLate &&
            computed.lateMinutes != null &&
            computed.lateMinutes > 0 &&
            status === AttendanceStatus.PRESENT
          ) {
            const applicableRule = await validationProcessRuleService.getApplicableRuleForLate({
              organizationId: employee.organizationId,
              employeeId: employee.id,
              paygroupId: employee.paygroupId,
              departmentId: employee.departmentId,
              shiftId: effectiveShiftId ?? null,
              attendanceDate: dayStart,
            });

            if (applicableRule) {
              const withinLimits = await validationProcessRuleService.isLateWithinLimits({
                rule: applicableRule as any,
                employeeId: employee.id,
                attendanceDate: dayStart,
                lateMinutesToday: computed.lateMinutes!,
              });

              if (withinLimits) {
                const action =
                  (applicableRule.actions || []).find((a: any) => a.condition === 'ALL') ||
                  (applicableRule.actions || [])[0];

                if (action) {
                  // For now, just log the decision; Phase 5 will actually create
                  // tasks / apply events based on autoApply.
                  // eslint-disable-next-line no-console
                  console.log('[ValidationProcessRule] Late detected', {
                    employeeId,
                    date: dayStart.toISOString().slice(0, 10),
                    lateMinutes: computed.lateMinutes,
                    ruleId: applicableRule.id,
                    actionName: action.name,
                    correctionMethod: action.correctionMethod,
                    autoApply: action.autoApply,
                  });
                }
              }
            }
          }
        } catch {
          // Swallow any unexpected error to avoid impacting attendance flow
        }
      } else {
        // Only check-in so far ("Currently In"): compute and persist late; use permission end as effective shift start when applicable
        let isLate = false;
        let lateMinutes: number | null = null;
        const dayStartLocal = new Date(checkIn.getFullYear(), checkIn.getMonth(), checkIn.getDate(), 0, 0, 0, 0);
        const effectiveShiftStartForLate = await this.getApprovedPermissionEndForDay(employeeId, dayStartLocal);
        const effectiveStart =
          effectiveShiftStartForLate ??
          (shiftForCompute?.startTime
            ? (() => {
                const shiftStart = new Date(dayStartLocal.getTime());
                const [startHours, startMinutes] = (shiftForCompute.startTime as string).split(':').map(Number);
                shiftStart.setHours(startHours, startMinutes, 0, 0);
                return shiftStart;
              })()
            : null);
        if (effectiveStart && policyRules?.considerLateFromGraceTime) {
          const graceEndTime = this.getShiftTimeWithGrace(effectiveStart, undefined, true, policyRules);
          isLate = checkIn > graceEndTime;
          lateMinutes = isLate
            ? Math.round((checkIn.getTime() - graceEndTime.getTime()) / (1000 * 60))
            : null;
        }
        await prisma.attendanceRecord.update({
          where: { id: record.id },
          data: {
            ...(resolvedShiftFromRules ? { shiftId: effectiveShiftId } : {}),
            isLate,
            lateMinutes: lateMinutes ?? null,
            isEarly: false,
            earlyMinutes: null,
            excessStayMinutes: null,
          },
        });
      }
    }

    return prisma.attendanceRecord.findUnique({
      where: { id: record.id },
    });
  }

  /**
   * Parse time string (HH:MM) to hours as decimal
   */
  private parseTimeToHours(timeStr: string): number {
    const parts = timeStr.split(':');
    const hours = parseInt(parts[0] || '0', 10);
    const minutes = parseInt(parts[1] || '0', 10);
    return hours + minutes / 60;
  }

  /**
   * Get grace duration in milliseconds from policy.
   * Supports shiftStartGraceMinutes / shiftEndGraceMinutes (number in minutes); else uses HH:MM time string.
   * Use minutes when set (e.g. 4 = 4 minutes); use time string for legacy (e.g. 04:00 = 4 hours, 00:04 = 4 minutes).
   */
  private getGraceDurationMs(policyRules: Record<string, any> | null, forStart: boolean): number {
    if (!policyRules) return 0;
    const minutesRaw = forStart
      ? policyRules.shiftStartGraceMinutes
      : policyRules.shiftEndGraceMinutes;
    if (minutesRaw !== undefined && minutesRaw !== null && minutesRaw !== '') {
      const minutes = typeof minutesRaw === 'number' ? minutesRaw : parseInt(String(minutesRaw), 10);
      if (!isNaN(minutes) && minutes >= 0) {
        return minutes * 60 * 1000;
      }
    }
    const timeStr = forStart
      ? (policyRules.shiftStartGraceTime || '00:00')
      : (policyRules.shiftEndGraceTime || '00:00');
    const graceHours = this.parseTimeToHours(timeStr);
    return graceHours * 60 * 60 * 1000;
  }

  /**
   * Get shift start/end time with grace period.
   * When policyRules is provided, uses getGraceDurationMs (supports grace in minutes); else uses graceTimeStr (HH:MM).
   */
  private getShiftTimeWithGrace(
    shiftTime: Date,
    graceTimeStr: string | undefined,
    isStart: boolean,
    policyRules?: Record<string, any> | null
  ): Date {
    let graceMs: number;
    if (policyRules != null) {
      graceMs = this.getGraceDurationMs(policyRules, isStart);
    } else {
      if (!graceTimeStr) return shiftTime;
      graceMs = this.parseTimeToHours(graceTimeStr) * 60 * 60 * 1000;
    }
    return new Date(shiftTime.getTime() + (isStart ? graceMs : -graceMs));
  }

  /**
   * Check if check-in is late based on policy rules
   */
  private isLateCheckIn(
    checkInTime: Date,
    shiftStartTime: Date | null,
    policyRules: Record<string, any> | null
  ): boolean {
    if (!shiftStartTime || !policyRules) return false;
    if (!policyRules.considerLateFromGraceTime) return false;

    const graceEndTime = this.getShiftTimeWithGrace(shiftStartTime, undefined, true, policyRules);
    return checkInTime > graceEndTime;
  }

  /**
   * Check if check-out is early based on policy rules
   */
  private isEarlyCheckOut(
    checkOutTime: Date,
    shiftEndTime: Date | null,
    policyRules: Record<string, any> | null
  ): boolean {
    if (!shiftEndTime || !policyRules) return false;
    if (!policyRules.considerEarlyGoingFromGraceTime) return false;

    const graceStartTime = this.getShiftTimeWithGrace(shiftEndTime, undefined, false, policyRules);
    return checkOutTime < graceStartTime;
  }

  /**
   * Get approved permission end time for an employee on a given date.
   * Used to treat permission period (e.g. 09:00-11:00) as allowed absence so punch at 11:00 is not marked late.
   * dayStartMidnight: Date at midnight (local or UTC) for the attendance day.
   * Returns the same day at permission end time (e.g. 11:00) so late is computed against it, or null if no approved permission.
   * Matches by reason pattern [Permission HH:MM-HH:MM] so it works even when leave type name is not "Permission".
   */
  private async getApprovedPermissionEndForDay(employeeId: string, dayStartMidnight: Date): Promise<Date | null> {
    const dayEnd = new Date(dayStartMidnight);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const approvedLeaves = await prisma.leaveRequest.findMany({
      where: {
        employeeId,
        status: 'APPROVED',
        startDate: { lte: dayEnd },
        endDate: { gte: dayStartMidnight },
      },
      orderBy: { appliedOn: 'desc' },
    });

    // Reason pattern: [Permission 09:00-11:00] or [Permission 09:00 - 11:00] (optional spaces around hyphen)
    // Ignores validation-correction permissions (pattern [Late-correction ...]) which are not real time-range permissions.
    const permissionReasonRegex = /^\[Permission\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\]/i;
    for (const leave of approvedLeaves) {
      if (!leave?.reason) continue;
      const match = leave.reason.match(permissionReasonRegex);
      if (!match) continue;
      const [, , endHHMM] = match;
      const [endHours, endMinutes] = endHHMM.split(':').map(Number);
      // Sanity: permission end should be during working hours (>= 6 AM); skip if clearly a duration, not a clock time
      if (endHours < 6) continue;
      const permissionEnd = new Date(dayStartMidnight.getTime());
      permissionEnd.setHours(endHours, endMinutes, 0, 0);
      return permissionEnd;
    }
    return null;
  }

  /**
   * Compute policy-derived fields for a day (late, early, deviation, OT, workHours).
   * Used by checkOut and syncAttendanceRecordFromPunches.
   * When effectiveShiftStartForLate is provided (e.g. from approved permission end time), late is computed against it instead of shift start.
   */
  private async computePolicyFieldsForDay(
    checkIn: Date,
    checkOut: Date,
    breakHours: number,
    shift: { startTime: string | null; endTime: string | null; breakDuration?: number | null } | null,
    policyRules: Record<string, any> | null,
    _attendanceDate: Date,
    attendanceStatus?: AttendanceStatus,
    excessRuleData?: EventRuleData | null,
    effectiveShiftStartForLate?: Date | null
  ): Promise<{
    workHours: number;
    overtimeHours: number;
    otMinutes: number;
    excessStayMinutes: number;
    isLate: boolean;
    lateMinutes: number | null;
    isEarly: boolean;
    earlyMinutes: number | null;
    isDeviation: boolean;
    deviationReason: string | null;
  }> {
    // Use check-in date (local) so shift times and punch times are on the same day and comparable
    const checkInLocal = new Date(checkIn);
    const dayStart = new Date(checkInLocal.getFullYear(), checkInLocal.getMonth(), checkInLocal.getDate(), 0, 0, 0, 0);

    const workHours = this.calculateWorkHours(checkIn, checkOut, breakHours);
    let overtimeHours = 0;

    // Late coming (supports shiftStartGraceMinutes or shiftStartGraceTime HH:MM).
    // When effectiveShiftStartForLate is set (e.g. from approved permission 09:00-11:00), use it so punch at 11:00 is not late.
    let isLate = false;
    let lateMinutes: number | null = null;
    if (policyRules && policyRules.considerLateFromGraceTime) {
      const effectiveStart =
        effectiveShiftStartForLate != null
          ? effectiveShiftStartForLate
          : shift?.startTime
            ? (() => {
                const shiftStart = new Date(dayStart.getTime());
                const [startHours, startMinutes] = (shift.startTime as string).split(':').map(Number);
                shiftStart.setHours(startHours, startMinutes, 0, 0);
                return shiftStart;
              })()
            : null;
      if (effectiveStart) {
        const graceEndTime = this.getShiftTimeWithGrace(effectiveStart, undefined, true, policyRules);
        if (checkIn > graceEndTime) {
          isLate = true;
          lateMinutes = Math.round((checkIn.getTime() - graceEndTime.getTime()) / (1000 * 60));
        }
      }
    }

    // Early going (supports shiftEndGraceMinutes or shiftEndGraceTime HH:MM)
    let isEarlyGoing = false;
    let earlyMinutes: number | null = null;
    if (policyRules && shift?.endTime) {
      const shiftEnd = new Date(dayStart.getTime());
      const [endHours, endMinutes] = (shift.endTime as any).split(':').map(Number);
      shiftEnd.setHours(endHours, endMinutes, 0, 0);
      isEarlyGoing = this.isEarlyCheckOut(checkOut, shiftEnd, policyRules);
      if (isEarlyGoing) {
        const graceStartTime = this.getShiftTimeWithGrace(shiftEnd, undefined, false, policyRules);
        earlyMinutes = Math.round((graceStartTime.getTime() - checkOut.getTime()) / (1000 * 60));
      }
    }

    // Break deviation
    const allowedBreakHours = policyRules?.includingShiftBreak
      ? (shift?.breakDuration ? shift.breakDuration / 60 : 0)
      : (policyRules?.minBreakHoursAsDeviation ? this.parseTimeToHours(policyRules.minBreakHoursAsDeviation) : 24);
    const excessBreakHours = Math.max(0, breakHours - allowedBreakHours);
    const breakDeviation = excessBreakHours > 0.001;

    // Shortfall
    let shortfallHours = 0;
    if (policyRules?.considerLateAsShortfall && lateMinutes != null) shortfallHours += lateMinutes / 60;
    if (policyRules?.considerEarlyGoingAsShortfall && earlyMinutes != null) shortfallHours += earlyMinutes / 60;
    if (policyRules?.considerExcessBreakAsShortfall && excessBreakHours > 0) shortfallHours += excessBreakHours;
    const minShortfallHours = policyRules?.minShortfallHoursAsDeviation
      ? this.parseTimeToHours(policyRules.minShortfallHoursAsDeviation) : 0;
    // Shortfall deviation (D badge) only when total shortfall >= "Minimum Shortfall Hours consider as Deviation"
    // (e.g. 00:10 = 10 min). Under 10 min no D is shown; this is why shortfall "appears after 10 min".
    const shortfallDeviation = shortfallHours > 0 && shortfallHours >= minShortfallHours;

    const isDeviation = breakDeviation || shortfallDeviation;
    const deviationReasons: string[] = [];
    if (isLate && lateMinutes != null) deviationReasons.push(`Late ${lateMinutes} min`);
    if (isEarlyGoing && earlyMinutes != null) deviationReasons.push(`Early going ${earlyMinutes} min`);
    if (breakDeviation) deviationReasons.push('Excess break');
    if (shortfallDeviation && !breakDeviation) deviationReasons.push('Shortfall');
    const deviationReason = isDeviation ? deviationReasons.join('; ') : null;

    let excessStayMinutes = 0;
    if (shift?.startTime && shift?.endTime) {
      excessStayMinutes = computeExcessStayMinutesByShift(checkIn, checkOut, shift);
      if (!isExcessTimeConversionEnabled(excessRuleData)) {
        excessStayMinutes = 0;
      }
    }

    // OT
    // If the attendance day is LEAVE, honor policy toggle:
    // - workingHoursInLeaveAsOT = YES  -> worked hours count as OT
    // - workingHoursInLeaveAsOT = NO   -> no OT on leave
    if (attendanceStatus === AttendanceStatus.LEAVE) {
      if (policyRules?.workingHoursInLeaveAsOT) {
        const maxOTHours = policyRules.maxOTHoursPerDay ? this.parseTimeToHours(policyRules.maxOTHoursPerDay) : Infinity;
        overtimeHours = Math.max(0, Math.min(workHours, maxOTHours));
      } else {
        overtimeHours = 0;
      }
    } else if (policyRules) {
      if (policyRules.excessStayConsideredAsOT && shift?.endTime) {
        const shiftEndTime = new Date(dayStart.getTime());
        const [endHours, endMinutes] = (shift.endTime as any).split(':').map(Number);
        shiftEndTime.setHours(endHours, endMinutes, 0, 0);
        const otStartGrace = policyRules.otStartsAfterShiftEnd || '00:00';
        const otStartTime = this.getShiftTimeWithGrace(shiftEndTime, otStartGrace, true);
        if (checkOut > otStartTime) {
          const otHours = this.calculateWorkHours(otStartTime, checkOut);
          const maxOTHours = policyRules.maxOTHoursPerDay ? this.parseTimeToHours(policyRules.maxOTHoursPerDay) : Infinity;
          overtimeHours = Math.max(0, Math.min(otHours, maxOTHours));
          // Show actual OT on calendar; "Minimum OT Hours allowed per day" is for payroll/approval only (do not zero out display).
        }
      }
      if (policyRules.earlyComingConsideredAsOT && shift?.startTime) {
        const shiftStart = new Date(dayStart);
        const [startHours, startMinutes] = (shift.startTime as any).split(':').map(Number);
        shiftStart.setHours(startHours, startMinutes, 0, 0);
        if (checkIn < shiftStart) {
          const earlyHours = this.calculateWorkHours(checkIn, shiftStart);
          overtimeHours += earlyHours;
        }
      }
    } else if (shift) {
      const standardHours = 8;
      overtimeHours = Math.max(0, workHours - standardHours);
    }

    if (policyRules) {
      const maxOTHours = policyRules.maxOTHoursPerDay ? this.parseTimeToHours(policyRules.maxOTHoursPerDay) : Infinity;
      const minOTHours = policyRules.minOTHoursPerDay ? this.parseTimeToHours(policyRules.minOTHoursPerDay) : 0;
      overtimeHours = Math.max(0, Math.min(overtimeHours, maxOTHours));
      if (overtimeHours > 0 && overtimeHours < minOTHours) {
        overtimeHours = 0;
      }
    }

    if (policyRules?.roundOffOption && overtimeHours > 0) {
      overtimeHours = Math.round(overtimeHours);
    }
    const otMinutes = Math.round(overtimeHours * 60);

    return {
      workHours,
      overtimeHours,
      otMinutes: otMinutes > 0 ? otMinutes : 0,
      excessStayMinutes: excessStayMinutes > 0 ? excessStayMinutes : 0,
      isLate,
      lateMinutes,
      isEarly: isEarlyGoing,
      earlyMinutes,
      isDeviation,
      deviationReason,
    };
  }

  /**
   * Check-in with geofence validation and shift support
   */
  async checkIn(employeeId: string, data: CheckInInput) {
    // Verify employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        shift: true,
      },
    });

    if (!employee) {
      throw new AppError('Employee not found', 404);
    }

    const now = new Date();
    const today = await this.resolveAttendanceDateForPunch(employeeId, now);

    // Check if already checked in today
    const existing = await prisma.attendanceRecord.findUnique({
      where: {
        employeeId_date: {
          employeeId,
          date: today,
        },
      },
    });

    if (existing && existing.checkIn) {
      throw new AppError('You have already checked in today', 400);
    }

    // Validate geofence if shift has geofencing enabled (optional - skip if not configured)
    if (employee.shift?.geofenceEnabled && data.location) {
      if (employee.shift.geofenceLocation && employee.shift.geofenceRadius) {
        const isValid = shiftService.validateGeofence(
          data.location as { latitude: number; longitude: number },
          employee.shift.geofenceLocation as { latitude: number; longitude: number },
          parseFloat(employee.shift.geofenceRadius.toString())
        );

        if (!isValid) {
          throw new AppError(
            `You are outside the allowed geofence area. Please check in from the designated location.`,
            400
          );
        }
      }
      // If geofence is enabled but not configured, skip validation (allow check-in)
    }

    // Get policy rules for this shift if available
    let policyRules: Record<string, any> | null = null;
    if (employee.shiftId) {
      try {
        policyRules = await shiftAssignmentRuleService.getApplicablePolicyRules(
          employee.shiftId,
          employeeId,
          today,
          employee.organizationId
        );
      } catch (error) {
        // If policy rules fetch fails, continue without them
        console.warn('Failed to fetch policy rules:', error);
      }
    }

    // Determine status
    let status: AttendanceStatus = AttendanceStatus.PRESENT;
    if (this.isWeekend(today)) {
      status = AttendanceStatus.WEEKEND;
    } else if (await this.isHoliday(today, employee.organizationId)) {
      status = AttendanceStatus.HOLIDAY;
    } else if (employee.shift?.startTime && policyRules) {
      // Check if check-in is late based on policy rules
      const shiftStart = new Date(today);
      const [startHours, startMinutes] = (employee.shift.startTime as any).split(':').map(Number);
      shiftStart.setHours(startHours, startMinutes, 0, 0);
      
      if (this.isLateCheckIn(now, shiftStart, policyRules)) {
        // Late check-in - status remains PRESENT but can be tracked via notes or separate field
        // For now, we keep PRESENT status but could add a late flag if needed
      }
    }

    // Determine check-in method: explicit (e.g. FACE), or from location
    let checkInMethod: CheckInMethod =
      (data.checkInMethod as CheckInMethod) ?? CheckInMethod.WEB;
    if (checkInMethod === CheckInMethod.WEB && data.location) {
      checkInMethod = employee.shift?.geofenceEnabled ? CheckInMethod.GEOFENCE : CheckInMethod.MOBILE;
    }

    // Create or update attendance record
    const attendance = await prisma.attendanceRecord.upsert({
      where: {
        employeeId_date: {
          employeeId,
          date: today,
        },
      },
      create: {
        employeeId,
        shiftId: employee.shiftId || null,
        date: today,
        checkIn: now,
        status,
        location: data.location || undefined,
        checkInMethod,
        notes: data.notes || null,
      },
      update: {
        checkIn: now,
        shiftId: employee.shiftId || null,
        status,
        location: data.location || undefined,
        checkInMethod,
        notes: data.notes || null,
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
          },
        },
        shift: {
          select: {
            id: true,
            name: true,
            startTime: true,
            endTime: true,
          },
        },
      },
    });

    return attendance;
  }

  /**
   * Check-out with shift support
   */
  async checkOut(employeeId: string, data: CheckOutInput) {
    const now = new Date();
    const today = await this.resolveAttendanceDateForPunch(employeeId, now);

    // Get employee with shift info
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        shift: true,
      },
    });

    if (!employee) {
      throw new AppError('Employee not found', 404);
    }

    // Find today's (working-date) attendance record; fallback to previous working date for overnight cases.
    let attendance = await prisma.attendanceRecord.findUnique({
      where: {
        employeeId_date: {
          employeeId,
          date: today,
        },
      },
    });
    let attendanceDateForUpdate = today;
    if (!attendance) {
      const previousDate = this.addUtcDays(today, -1);
      const previous = await prisma.attendanceRecord.findUnique({
        where: {
          employeeId_date: {
            employeeId,
            date: previousDate,
          },
        },
      });
      if (previous && previous.checkIn && !previous.checkOut) {
        attendance = previous;
        attendanceDateForUpdate = previousDate;
      }
    }

    if (!attendance) {
      throw new AppError('You have not checked in today', 400);
    }

    if (attendance.checkOut) {
      throw new AppError('You have already checked out today', 400);
    }

    if (!attendance.checkIn) {
      throw new AppError('You have not checked in today', 400);
    }

    // Validate geofence if shift has geofencing enabled (optional - skip if not configured)
    if (employee.shift?.geofenceEnabled && data.location) {
      if (employee.shift.geofenceLocation && employee.shift.geofenceRadius) {
        const isValid = shiftService.validateGeofence(
          data.location as { latitude: number; longitude: number },
          employee.shift.geofenceLocation as { latitude: number; longitude: number },
          parseFloat(employee.shift.geofenceRadius.toString())
        );

        if (!isValid) {
          throw new AppError(
            `You are outside the allowed geofence area. Please check out from the designated location.`,
            400
          );
        }
      }
      // If geofence is enabled but not configured, skip validation (allow check-out)
    }

    const checkIn = attendance.checkIn;
    const totalHours = this.calculateWorkHours(checkIn, now);

    const breakHours = attendance.breakHours
      ? parseFloat(attendance.breakHours.toString())
      : (employee.shift?.breakDuration ? employee.shift.breakDuration / 60 : 0);

    let policyRules: Record<string, any> | null = null;
    if (attendance.shiftId) {
      try {
        policyRules = await shiftAssignmentRuleService.getApplicablePolicyRules(
          attendance.shiftId,
          employeeId,
          attendanceDateForUpdate,
          employee.organizationId
        );
      } catch (error) {
        console.warn('Failed to fetch policy rules:', error);
      }
    }

    // Fallback OT when no policy (shift-based or default)
    const shiftForCompute = employee.shift
      ? {
          startTime: employee.shift.startTime,
          endTime: employee.shift.endTime,
          breakDuration: employee.shift.breakDuration,
        }
      : null;
    let excessRuleData: EventRuleData | null = null;
    try {
      const rule = await getApplicableExcessTimeRule(employeeId, employee.organizationId, attendanceDateForUpdate);
      excessRuleData = rule.ruleData;
    } catch {
      excessRuleData = null;
    }
    const dayStartLocal = new Date(checkIn.getFullYear(), checkIn.getMonth(), checkIn.getDate(), 0, 0, 0, 0);
    const effectiveShiftStartForLate = await this.getApprovedPermissionEndForDay(employeeId, dayStartLocal);
    const computed = await this.computePolicyFieldsForDay(
      checkIn,
      now,
      breakHours,
      shiftForCompute,
      policyRules,
      attendanceDateForUpdate,
      attendance.status as AttendanceStatus,
      excessRuleData,
      effectiveShiftStartForLate
    );

    // If no policy, apply shift-based OT fallback
    let overtimeHours = computed.overtimeHours;
    if (!policyRules && employee.shift?.overtimeEnabled) {
      const standardHours = employee.shift.workHours ? parseFloat(employee.shift.workHours.toString()) : 8;
      const threshold = employee.shift.overtimeThreshold
        ? parseFloat(employee.shift.overtimeThreshold.toString())
        : standardHours;
      if (computed.workHours > threshold) {
        overtimeHours = computed.workHours - threshold;
      }
    }

    let updatedNotes = data.notes || attendance.notes || '';
    if (computed.isLate && computed.lateMinutes != null && !updatedNotes.includes('Late')) {
      updatedNotes = updatedNotes ? `${updatedNotes} | Late by ${computed.lateMinutes} min` : `Late by ${computed.lateMinutes} min`;
    }
    if (computed.isEarly && computed.earlyMinutes != null && !updatedNotes.includes('Early')) {
      updatedNotes = updatedNotes ? `${updatedNotes} | Early going by ${computed.earlyMinutes} min` : `Early going by ${computed.earlyMinutes} min`;
    }

    // Determine check-in method based on location
    let checkInMethod = attendance.checkInMethod || CheckInMethod.WEB;
    if (data.location) {
      checkInMethod = employee.shift?.geofenceEnabled ? CheckInMethod.GEOFENCE : CheckInMethod.MOBILE;
    }

    // Update attendance record (store policy-derived fields for calendar L / EG / D / OT)
    const updated = await prisma.attendanceRecord.update({
      where: {
        employeeId_date: {
          employeeId,
          date: attendanceDateForUpdate,
        },
      },
      data: {
        checkOut: now,
        totalHours: new Prisma.Decimal(totalHours),
        workHours: new Prisma.Decimal(computed.workHours),
        overtimeHours: new Prisma.Decimal(overtimeHours),
        otMinutes: computed.otMinutes > 0 ? computed.otMinutes : null,
        excessStayMinutes: computed.excessStayMinutes > 0 ? computed.excessStayMinutes : null,
        isLate: computed.isLate,
        lateMinutes: computed.lateMinutes ?? null,
        isEarly: computed.isEarly,
        earlyMinutes: computed.earlyMinutes ?? null,
        isDeviation: computed.isDeviation,
        deviationReason: computed.deviationReason ?? null,
        location: data.location || (attendance.location ? attendance.location : undefined),
        checkInMethod: checkInMethod,
        notes: updatedNotes || null,
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
          },
        },
        shift: {
          select: {
            id: true,
            name: true,
            startTime: true,
            endTime: true,
          },
        },
      },
    });

    return updated;
  }

  /**
   * Get attendance records
   * @param query - Query parameters
   * @param userId - User ID for role-based filtering
   * @param userRole - User role for RBAC filtering
   */
  async getRecords(query: QueryAttendanceRecordsInput, userId?: string, _userRole?: string) {
    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '20');
    const skip = (page - 1) * limit;

    const where: Prisma.AttendanceRecordWhereInput = {};

    if (query.employeeId) {
      where.employeeId = query.employeeId;
    } else if (userId) {
      // Get employee record
      const employee = await prisma.employee.findUnique({
        where: { userId },
        select: { id: true, reportingManagerId: true, organizationId: true },
      });

      if (employee) {
        // Dynamic RBAC scoping via Config API permissions
        const scope = getDataScope(userId!, '/attendance');
        if (scope === 'org') {
          // can_edit on /attendance → org-wide access (HR/OrgAdmin level)
          if (query.organizationId || employee.organizationId) {
            where.employee = {
              organizationId: query.organizationId || employee.organizationId,
            };
          }
        } else if (scope === 'team') {
          // can_view on /attendance → team access (Manager level)
          where.employee = {
            reportingManagerId: employee.id,
            organizationId: query.organizationId || employee.organizationId,
          };
        } else {
          // No special permission → self-service only (Employee level)
          where.employeeId = employee.id;
        }
      }
    }

    if (query.startDate) {
      where.date = { gte: new Date(query.startDate) };
    }

    if (query.endDate) {
      where.date = {
        ...(where.date as any),
        lte: new Date(query.endDate),
      };
    }

    if (query.status) {
      where.status = query.status;
    }

    // Merge organizationId filter if provided and not already set by RBAC
    // RBAC filtering already sets organizationId for MANAGER, HR_MANAGER, ORG_ADMIN
    // Only apply if not already filtered by role-based logic
    if (query.organizationId && !where.employee && !where.employeeId) {
      where.employee = {
        organizationId: query.organizationId,
      };
    } else if (query.organizationId && where.employee && !where.employee.organizationId) {
      // Merge organizationId into existing employee filter
      where.employee.organizationId = query.organizationId;
    }

    const isCalendarSingleEmployee =
      query.employeeId && query.startDate && query.endDate && query.organizationId;
    const take = isCalendarSingleEmployee ? 500 : limit;
    const calendarSkip = isCalendarSingleEmployee ? 0 : skip;

    const [records, total] = await Promise.all([
      (async () => {
        try {
          return await prisma.attendanceRecord.findMany({
            where,
            skip: calendarSkip,
            take,
            orderBy: {
              [query.sortBy || 'date']: query.sortOrder || 'desc',
            },
            include: {
              employee: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  employeeCode: true,
                  organizationId: true,
                },
              },
              shift: {
                select: {
                  id: true,
                  name: true,
                  startTime: true,
                  endTime: true,
                },
              },
            },
          });
        } catch (error) {
          if (!this.isMissingExcessStayColumnError(error)) throw error;
          return await prisma.attendanceRecord.findMany({
            where,
            skip: calendarSkip,
            take,
            orderBy: {
              [query.sortBy || 'date']: query.sortOrder || 'desc',
            },
            select: {
              id: true,
              employeeId: true,
              shiftId: true,
              date: true,
              checkIn: true,
              checkOut: true,
              totalHours: true,
              breakHours: true,
              workHours: true,
              overtimeHours: true,
              status: true,
              location: true,
              checkInMethod: true,
              notes: true,
              approvedBy: true,
              approvedAt: true,
              createdAt: true,
              updatedAt: true,
              deviationReason: true,
              earlyMinutes: true,
              isDeviation: true,
              isEarly: true,
              isLate: true,
              lateMinutes: true,
              otMinutes: true,
              validationAction: true,
              employee: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  employeeCode: true,
                  organizationId: true,
                },
              },
              shift: {
                select: {
                  id: true,
                  name: true,
                  startTime: true,
                  endTime: true,
                },
              },
            },
          });
        }
      })(),
      prisma.attendanceRecord.count({ where }),
    ]);

    let resultRecords = records;
    let resultTotal = total;
    let resultPage = page;
    let resultLimit = limit;

    if (isCalendarSingleEmployee && query.employeeId && query.organizationId) {
      const merged = await this.mergeShiftRulesIntoRecords(
        records as any[],
        query.employeeId,
        query.startDate!,
        query.endDate!,
        query.organizationId
      );
      resultRecords = merged;
      resultTotal = merged.length;
      resultPage = 1;
      resultLimit = merged.length;
    }

    // Backfill missing policy fields (early/shortfall/deviation) for PRESENT records that were saved before policy existed
    // or when sync didn't run for that day (e.g. 13th shows no shortfall while 10–12 do). Only for calendar single-employee.
    if (isCalendarSingleEmployee && query.organizationId && resultRecords.length > 0) {
      resultRecords = await this.backfillPolicyFieldsForCalendarRecords(
        resultRecords as any[],
        query.organizationId
      );
    }

    return {
      records: resultRecords,
      pagination: {
        page: resultPage,
        limit: resultLimit,
        total: resultTotal,
        totalPages: Math.ceil(resultTotal / resultLimit) || 1,
      },
    };
  }

  /**
   * Backfill policy-derived fields (late, early, shortfall/deviation) for PRESENT records that have checkIn+checkOut
   * but missing earlyMinutes or isDeviation. Fixes cases where a day (e.g. 13th) was punched before policy existed
   * or sync didn't run, so calendar shows shortfall consistently with other days (10th, 11th, 12th).
   */
  private async backfillPolicyFieldsForCalendarRecords(
    records: any[],
    organizationId: string
  ): Promise<any[]> {
    const out: any[] = [];
    for (const record of records) {
      const isSynthetic = typeof record.id === 'string' && record.id.startsWith('synthetic-');
      // Recalc when early/deviation missing, otMinutes missing/zero, OR when marked late (so permission can clear late/shortfall without re-sync).
      const hasMissingFields =
        record.earlyMinutes == null ||
        record.isDeviation == null ||
        record.otMinutes == null ||
        record.otMinutes === 0 ||
        record.excessStayMinutes == null;
      const markedLate = record.isLate === true && record.lateMinutes != null && Number(record.lateMinutes) > 0;
      const needsBackfill =
        record.status === 'PRESENT' &&
        record.checkIn &&
        record.checkOut &&
        (hasMissingFields || markedLate) &&
        record.shift?.endTime &&
        !isSynthetic;

      if (!needsBackfill) {
        out.push(record);
        continue;
      }

      const employeeId = record.employeeId;
      const date = new Date(record.date);
      const orgId = record.employee?.organizationId ?? organizationId;
      const shiftId = record.shiftId ?? record.shift?.id;
      if (!shiftId || !employeeId) {
        out.push(record);
        continue;
      }

      let policyRules: Record<string, any> | null = null;
      try {
        policyRules = await shiftAssignmentRuleService.getApplicablePolicyRules(
          shiftId,
          employeeId,
          date,
          orgId
        );
      } catch {
        out.push(record);
        continue;
      }

      const shiftForCompute = record.shift
        ? {
            startTime: record.shift.startTime ?? null,
            endTime: record.shift.endTime ?? null,
            breakDuration: record.shift.breakDuration ?? null,
          }
        : null;
      const breakHours = record.breakHours != null ? parseFloat(record.breakHours.toString()) : 0;
      const checkIn = new Date(record.checkIn);
      const checkOut = new Date(record.checkOut);
      let excessRuleData: EventRuleData | null = null;
      try {
        const rule = await getApplicableExcessTimeRule(employeeId, orgId, date);
        excessRuleData = rule.ruleData;
      } catch {
        excessRuleData = null;
      }

      const dayStartLocal = new Date(checkIn.getFullYear(), checkIn.getMonth(), checkIn.getDate(), 0, 0, 0, 0);
      const effectiveShiftStartForLate = await this.getApprovedPermissionEndForDay(employeeId, dayStartLocal);
      const computed = await this.computePolicyFieldsForDay(
        checkIn,
        checkOut,
        breakHours,
        shiftForCompute,
        policyRules,
        date,
        record.status as AttendanceStatus,
        excessRuleData,
        effectiveShiftStartForLate
      );

      try {
        await prisma.attendanceRecord.update({
          where: {
            id: record.id,
          },
          data: {
            isLate: computed.isLate,
            lateMinutes: computed.lateMinutes ?? null,
            isEarly: computed.isEarly,
            earlyMinutes: computed.earlyMinutes ?? null,
            isDeviation: computed.isDeviation,
            deviationReason: computed.deviationReason ?? null,
            otMinutes: computed.otMinutes > 0 ? computed.otMinutes : null,
            excessStayMinutes: computed.excessStayMinutes > 0 ? computed.excessStayMinutes : null,
          },
        });
      } catch {
        // ignore update failure (e.g. record deleted)
      }

      out.push({
        ...record,
        isLate: computed.isLate,
        lateMinutes: computed.lateMinutes ?? null,
        isEarly: computed.isEarly,
        earlyMinutes: computed.earlyMinutes ?? null,
        isDeviation: computed.isDeviation,
        deviationReason: computed.deviationReason ?? null,
        otMinutes: computed.otMinutes > 0 ? computed.otMinutes : null,
        excessStayMinutes: computed.excessStayMinutes > 0 ? computed.excessStayMinutes : null,
      });
    }
    return out;
  }

  /** Normalize to YYYY-MM-DD (UTC) so key matching works across timezones and Date vs string. */
  private toDateKey(date: Date | string): string {
    const d = date instanceof Date ? date : new Date(date);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }

  /**
   * Merge shift-from-rules into records so calendar shows shift assigned at department/paygroup/associate level.
   * Per-day overrides from Associate Shift Grid (AttendanceRecord with shiftId) always win over rules.
   */
  private async mergeShiftRulesIntoRecords(
    records: Array<{
      id: string;
      employeeId: string;
      date: Date | string;
      checkIn?: Date | string | null;
      shiftId: string | null;
      employee: { id: string; firstName: string; lastName: string; email: string; employeeCode: string };
      shift: { id: string; name: string; startTime: string; endTime: string } | null;
    }>,
    employeeId: string,
    startDate: string,
    endDate: string,
    organizationId: string
  ): Promise<any[]> {
    const start = new Date(startDate + 'T00:00:00.000Z');
    const end = new Date(endDate + 'T00:00:00.000Z');
    const datesInRange: string[] = [];
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      datesInRange.push(this.toDateKey(d));
    }
    const recordsByDate = new Map<string, typeof records[0]>();
    records.forEach((r) => {
      // Use check-in date (when available) so records are mapped to the actual punch day.
      // This avoids timezone-shifted date-only records (e.g. stored previous UTC date)
      // being replaced by synthetic shift rows on the intended calendar day.
      const recordDateKeySource = r.checkIn ?? r.date;
      const key = `${r.employeeId}-${this.toDateKey(recordDateKeySource)}`;
      recordsByDate.set(key, r);
    });
    // Pre-fetch all needed data ONCE in parallel — eliminates N×3 sequential DB calls in the loop
    const endDateObj = new Date(endDate + 'T23:59:59.000Z');
    const policyMarkers = ['__HOLIDAY_DATA__', '__EVENT_RULE_DATA__', '__OT_USAGE_RULE_DATA__', '__WEEK_OFF_DATA__', '__POLICY_RULES__'];
    const [employeeWithDept, weekOffRules, holidayRules, shiftRules] = await Promise.all([
      prisma.employee.findUnique({
        where: { id: employeeId },
        select: { id: true, firstName: true, lastName: true, email: true, employeeCode: true, paygroupId: true, departmentId: true },
      }),
      prisma.shiftAssignmentRule.findMany({
        where: { organizationId, effectiveDate: { lte: endDateObj }, remarks: { contains: '__WEEK_OFF_DATA__' } },
        orderBy: [{ priority: 'desc' }, { effectiveDate: 'desc' }],
      }),
      prisma.shiftAssignmentRule.findMany({
        where: { organizationId, remarks: { contains: '__HOLIDAY_DATA__' } },
        orderBy: [{ priority: 'desc' }, { effectiveDate: 'desc' }],
      }),
      prisma.shiftAssignmentRule.findMany({
        where: {
          organizationId,
          effectiveDate: { lte: endDateObj },
          OR: [
            { remarks: null },
            ...policyMarkers.map((m) => ({ remarks: { not: { contains: m } } })),
          ],
        },
        orderBy: [{ priority: 'desc' }, { effectiveDate: 'desc' }],
        include: { shift: { select: { id: true, name: true, startTime: true, endTime: true } } },
      }),
    ]);

    const employeeInfo = employeeWithDept ?? records[0]?.employee;
    if (!employeeInfo) return records;

    // Sort shift rules by specificity so more-specific rules always win over broader ones
    // when priority and effectiveDate are equal (e.g. employee-specific beats org-wide).
    const shiftRuleSpecificity = (r: { employeeIds: any; paygroupId: string | null; departmentId: string | null }) => {
      const empIds = Array.isArray(r.employeeIds) ? (r.employeeIds as string[]) : [];
      if (empIds.length > 0) return 4;
      if (r.paygroupId && r.departmentId) return 3;
      if (r.paygroupId) return 2;
      if (r.departmentId) return 1;
      return 0; // org-wide
    };
    shiftRules.sort((a, b) => shiftRuleSpecificity(b) - shiftRuleSpecificity(a));

    // In-memory rule matcher (no DB)
    const ruleMatchesEmployee = (rule: { employeeIds: any; paygroupId: string | null; departmentId: string | null }) => {
      const empIds = Array.isArray(rule.employeeIds) ? (rule.employeeIds as string[]) : [];
      if (empIds.length > 0) return empIds.includes(employeeId);
      if (rule.paygroupId && rule.departmentId) return rule.paygroupId === employeeWithDept?.paygroupId && rule.departmentId === employeeWithDept?.departmentId;
      if (rule.paygroupId) return rule.paygroupId === employeeWithDept?.paygroupId;
      if (rule.departmentId) return rule.departmentId === employeeWithDept?.departmentId;
      return true; // org-wide
    };

    const merged: any[] = [];
    for (const dateStr of datesInRange) {
      const key = `${employeeId}-${dateStr}`;
      const existing = recordsByDate.get(key);
      const dateForRule = new Date(dateStr + 'T12:00:00.000Z');
      const dateStart = new Date(dateStr + 'T00:00:00.000Z');

      // Week off check (in-memory)
      let weekOffShift: { id: string; name: string; startTime: string; endTime: string } | null = null;
      for (const rule of weekOffRules) {
        if (new Date(rule.effectiveDate as Date) > dateStart) continue;
        if (!ruleMatchesEmployee(rule) || !rule.remarks) continue;
        const markerIdx = rule.remarks.indexOf('__WEEK_OFF_DATA__');
        if (markerIdx === -1) continue;
        try {
          const parsed = JSON.parse(rule.remarks.slice(markerIdx + '__WEEK_OFF_DATA__'.length)) as { weekOffDetails?: boolean[][]; alternateSaturdayOff?: string };
          let weekOffDetails = parsed?.weekOffDetails;
          if (!weekOffDetails || !Array.isArray(weekOffDetails)) continue;
          const altSat = (parsed?.alternateSaturdayOff || '').toUpperCase();
          if ((altSat.includes('1ST') && altSat.includes('3RD')) || (altSat.includes('2ND') && altSat.includes('4TH'))) {
            weekOffDetails = weekOffDetails.map((week) => { const row = [...week]; if (row[0] !== undefined) row[0] = false; return row; });
          }
          const weekIndex = Math.min(5, Math.max(0, Math.ceil(dateStart.getDate() / 7) - 1));
          if (weekOffDetails[weekIndex]?.[dateStart.getDay()]) {
            weekOffShift = { id: 'week-off', name: 'Week Off', startTime: '00:00', endTime: '00:00' };
            break;
          }
        } catch { /* ignore */ }
      }
      if (weekOffShift) {
        merged.push({ id: existing?.id ?? `synthetic-${employeeId}-${dateStr}`, employeeId, date: dateForRule, shiftId: weekOffShift.id, employee: existing?.employee ?? employeeInfo, shift: weekOffShift });
        continue;
      }

      // Holiday check (in-memory)
      let holidayMatch: { name: string } | null = null;
      for (const rule of holidayRules) {
        if (!ruleMatchesEmployee(rule) || !rule.remarks) continue;
        const markerIdx = rule.remarks.indexOf('__HOLIDAY_DATA__');
        if (markerIdx === -1) continue;
        try {
          const parsed = JSON.parse(rule.remarks.slice(markerIdx + '__HOLIDAY_DATA__'.length)) as { holidayDetails?: Array<{ date?: string; name?: string }> };
          const found = parsed?.holidayDetails?.find((h) => h.date && h.date.slice(0, 10) === dateStr);
          if (found?.name) { holidayMatch = { name: found.name }; break; }
        } catch { /* ignore */ }
      }
      if (holidayMatch) {
        merged.push({ id: existing?.id ?? `synthetic-holiday-${employeeId}-${dateStr}`, employeeId, date: dateForRule, shiftId: null, employee: existing?.employee ?? employeeInfo, shift: { id: 'holiday', name: holidayMatch.name, startTime: '00:00', endTime: '00:00' }, status: AttendanceStatus.HOLIDAY });
        continue;
      }

      // Shift from rule (in-memory)
      const getShiftFromRules = () => {
        for (const rule of shiftRules) {
          if (!rule.shift) continue;
          if (new Date(rule.effectiveDate as Date) > dateStart) continue;
          const empIds = Array.isArray(rule.employeeIds) ? (rule.employeeIds as string[]) : [];
          if (empIds.length > 0) {
            if (empIds.includes(employeeId)) return rule.shift;
            continue;
          }
          if (rule.paygroupId && rule.departmentId) {
            if (rule.paygroupId === employeeWithDept?.paygroupId && rule.departmentId === employeeWithDept?.departmentId) return rule.shift;
          } else if (rule.paygroupId) {
            if (rule.paygroupId === employeeWithDept?.paygroupId) return rule.shift;
          } else if (rule.departmentId) {
            if (rule.departmentId === employeeWithDept?.departmentId) return rule.shift;
          } else {
            return rule.shift; // org-wide
          }
        }
        return null;
      };

      if (existing) {
        // Normalize output date to the working date bucket we are building, so API consumers
        // always get attendance mapped by shift start date even if DB date was stored differently.
        merged.push({ ...existing, date: dateForRule, shift: existing.shift ?? getShiftFromRules() });
      } else {
        const shiftFromRule = getShiftFromRules();
        if (shiftFromRule) {
          merged.push({ id: `synthetic-${employeeId}-${dateStr}`, employeeId, date: dateForRule, shiftId: shiftFromRule.id, employee: employeeInfo, shift: shiftFromRule });
        }
      }
    }
    merged.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return merged;
  }

  /**
   * Get attendance summary for employee
   */
  async getSummary(query: QueryAttendanceSummaryInput) {
    const { employeeId, startDate, endDate } = query;

    // Verify employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      throw new AppError('Employee not found', 404);
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    const records = await prisma.attendanceRecord.findMany({
      where: {
        employeeId,
        date: {
          gte: start,
          lte: end,
        },
      },
    });

    // Calculate statistics
    let totalPresent = 0;
    let totalAbsent = 0;
    let totalHalfDay = 0;
    let totalHolidays = 0;
    let totalWeekends = 0;
    let totalWorkHours = 0;
    let totalOvertimeHours = 0;

    records.forEach((record) => {
      if (record.status === AttendanceStatus.PRESENT) {
        totalPresent++;
      } else if (record.status === AttendanceStatus.ABSENT) {
        totalAbsent++;
      } else if (record.status === AttendanceStatus.HALF_DAY) {
        totalHalfDay++;
      } else if (record.status === AttendanceStatus.HOLIDAY) {
        totalHolidays++;
      } else if (record.status === AttendanceStatus.WEEKEND) {
        totalWeekends++;
      }

      if (record.workHours) {
        totalWorkHours += parseFloat(record.workHours.toString());
      }

      if (record.overtimeHours) {
        totalOvertimeHours += parseFloat(record.overtimeHours.toString());
      }
    });

    return {
      employeeId,
      startDate: start,
      endDate: end,
      summary: {
        totalDays: records.length,
        present: totalPresent,
        absent: totalAbsent,
        halfDay: totalHalfDay,
        holidays: totalHolidays,
        weekends: totalWeekends,
        totalWorkHours: Math.round(totalWorkHours * 100) / 100,
        totalOvertimeHours: Math.round(totalOvertimeHours * 100) / 100,
        attendancePercentage: records.length > 0
          ? Math.round((totalPresent / records.length) * 100)
          : 0,
      },
    };
  }

  /**
   * Get attendance report
   */
  async getReport(query: QueryAttendanceReportInput) {
    const { organizationId, startDate, endDate, departmentId, employeeId } = query;

    const start = new Date(startDate);
    const end = new Date(endDate);

    const where: Prisma.AttendanceRecordWhereInput = {
      employee: {
        organizationId,
        ...(departmentId && { departmentId }),
        ...(employeeId && { id: employeeId }),
      },
      date: {
        gte: start,
        lte: end,
      },
    };

    const records = await prisma.attendanceRecord.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            department: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
    });

    // Calculate summary statistics
    const summary = {
      totalRecords: records.length,
      present: records.filter(r => r.status === AttendanceStatus.PRESENT).length,
      absent: records.filter(r => r.status === AttendanceStatus.ABSENT).length,
      halfDay: records.filter(r => r.status === AttendanceStatus.HALF_DAY).length,
      holidays: records.filter(r => r.status === AttendanceStatus.HOLIDAY).length,
    };

    return {
      startDate: start,
      endDate: end,
      organizationId,
      summary,
      records,
    };
  }

  /**
   * Recalculate attendance record based on new shift assignment
   * This is called when a shift assignment is changed after punch-in/out
   */
  private async recalculateAttendanceForShiftChange(
    attendanceRecordId: string,
    newShiftId: string,
    employeeId: string,
    organizationId: string
  ): Promise<void> {
    const record = await prisma.attendanceRecord.findUnique({
      where: { id: attendanceRecordId },
      include: {
        employee: {
          include: {
            shift: true,
          },
        },
      },
    });

    if (!record || !record.checkIn) {
      return; // Can't recalculate without check-in
    }

    // Get the new shift
    const newShift = await prisma.shift.findUnique({
      where: { id: newShiftId },
    });

    if (!newShift) {
      return;
    }

    // Get policy rules for the new shift
    let policyRules: Record<string, any> | null = null;
    try {
      policyRules = await shiftAssignmentRuleService.getApplicablePolicyRules(
        newShiftId,
        employeeId,
        record.date,
        organizationId
      );
    } catch (error) {
      console.warn('Failed to fetch policy rules for recalculation:', error);
    }

    const checkIn = record.checkIn;
    const checkOut = record.checkOut || new Date(); // Use current time if not checked out yet
    
    // Recalculate work hours
    const breakHours = record.breakHours 
      ? parseFloat(record.breakHours.toString()) 
      : (newShift.breakDuration ? newShift.breakDuration / 60 : 0);
    
    const totalHours = this.calculateWorkHours(checkIn, checkOut);
    const workHours = this.calculateWorkHours(checkIn, checkOut, breakHours);

    // Recalculate overtime based on new shift and policy rules
    let overtimeHours = 0;
    if (record.status === AttendanceStatus.LEAVE) {
      if (policyRules?.workingHoursInLeaveAsOT) {
        const maxOTHours = policyRules.maxOTHoursPerDay
          ? this.parseTimeToHours(policyRules.maxOTHoursPerDay)
          : Infinity;
        overtimeHours = Math.max(0, Math.min(workHours, maxOTHours));
      } else {
        overtimeHours = 0;
      }
    } else if (policyRules) {
      // Policy-based overtime calculation
      const shiftEndTime = newShift.endTime 
        ? (() => {
            const end = new Date(record.date);
            const [endHours, endMinutes] = (newShift.endTime as any).split(':').map(Number);
            end.setHours(endHours, endMinutes, 0, 0);
            return end;
          })()
        : null;

      if (policyRules.excessStayConsideredAsOT && shiftEndTime) {
        const otStartGrace = policyRules.otStartsAfterShiftEnd || '00:00';
        const otStartTime = this.getShiftTimeWithGrace(shiftEndTime, otStartGrace, true);
        
        if (checkOut > otStartTime) {
          const otHours = this.calculateWorkHours(otStartTime, checkOut);
          const maxOTHours = policyRules.maxOTHoursPerDay 
            ? this.parseTimeToHours(policyRules.maxOTHoursPerDay) 
            : Infinity;
          overtimeHours = Math.max(0, Math.min(otHours, maxOTHours));
        }
      }

      // Check early coming as OT
      if (policyRules.earlyComingConsideredAsOT && newShift.startTime) {
        const shiftStart = new Date(record.date);
        const [startHours, startMinutes] = (newShift.startTime as any).split(':').map(Number);
        shiftStart.setHours(startHours, startMinutes, 0, 0);
        
        if (checkIn < shiftStart) {
          const earlyHours = this.calculateWorkHours(checkIn, shiftStart);
          overtimeHours += earlyHours;
        }
      }
    } else if (newShift.overtimeEnabled) {
      // Fallback to shift-based overtime calculation
      const standardHours = newShift.workHours 
        ? parseFloat(newShift.workHours.toString()) 
        : 8;
      const threshold = newShift.overtimeThreshold 
        ? parseFloat(newShift.overtimeThreshold.toString()) 
        : standardHours;
      
      if (workHours > threshold) {
        overtimeHours = workHours - threshold;
      }
    }

    // Apply min/max OT thresholds from policy, then optional round-off
    if (policyRules) {
      const maxOTHours = policyRules.maxOTHoursPerDay
        ? this.parseTimeToHours(policyRules.maxOTHoursPerDay)
        : Infinity;
      const minOTHours = policyRules.minOTHoursPerDay
        ? this.parseTimeToHours(policyRules.minOTHoursPerDay)
        : 0;
      overtimeHours = Math.max(0, Math.min(overtimeHours, maxOTHours));
      if (overtimeHours > 0 && overtimeHours < minOTHours) {
        overtimeHours = 0;
      }
    }

    // Round off overtime if policy specifies
    if (policyRules?.roundOffOption && overtimeHours > 0) {
      overtimeHours = Math.round(overtimeHours);
    }

    // Update notes with late/early information based on new shift
    const notesParts: string[] = [];
    
    if (policyRules && newShift.startTime) {
      const shiftStart = new Date(record.date);
      const [startHours, startMinutes] = (newShift.startTime as any).split(':').map(Number);
      shiftStart.setHours(startHours, startMinutes, 0, 0);
      
      if (this.isLateCheckIn(checkIn, shiftStart, policyRules)) {
        const lateMinutes = Math.round((checkIn.getTime() - shiftStart.getTime()) / (1000 * 60));
        notesParts.push(`Late check-in: ${lateMinutes} min`);
      }
    }

    if (policyRules && newShift.endTime && record.checkOut) {
      const shiftEnd = new Date(record.date);
      const [endHours, endMinutes] = (newShift.endTime as any).split(':').map(Number);
      shiftEnd.setHours(endHours, endMinutes, 0, 0);
      
      if (this.isEarlyCheckOut(record.checkOut, shiftEnd, policyRules)) {
        const earlyMinutes = Math.round((shiftEnd.getTime() - record.checkOut.getTime()) / (1000 * 60));
        notesParts.push(`Early going: ${earlyMinutes} min`);
      }
    }

    // Update the record with recalculated values
    await prisma.attendanceRecord.update({
      where: { id: attendanceRecordId },
      data: {
        totalHours: new Prisma.Decimal(totalHours),
        workHours: new Prisma.Decimal(workHours),
        overtimeHours: new Prisma.Decimal(overtimeHours),
        notes: notesParts.length > 0 ? notesParts.join(' | ') : null,
      },
    });
  }

  /**
   * Bulk update shift assignments for employees
   * Creates or updates attendance records with shiftId
   * Recalculates attendance if records already have punch-in/out times
   */
  async bulkUpdateShiftAssignments(
    organizationId: string,
    assignments: Array<{
      employeeId: string;
      date: string; // YYYY-MM-DD format
      shiftName: string; // Shift name from Shift Master
    }>
  ) {
    // Get all shifts to map shift names to IDs
    const shifts = await prisma.shift.findMany({
      where: { organizationId, isActive: true },
      select: { id: true, name: true },
    });

    const shiftMap = new Map<string, string>();
    shifts.forEach(shift => {
      shiftMap.set(shift.name, shift.id);
    });

    const results = [];

    for (const assignment of assignments) {
      try {
        const { employeeId, date, shiftName } = assignment;
        
        // Skip "W" (Week Off) - don't create attendance record for week offs
        if (shiftName === 'W' || shiftName === 'Weekoff') {
          // Remove shiftId from existing attendance record if it exists
          await prisma.attendanceRecord.updateMany({
            where: {
              employeeId,
              date: new Date(date),
            },
            data: {
              shiftId: null,
            },
          });
          results.push({ employeeId, date, shiftName, status: 'skipped' });
          continue;
        }

        const shiftId = shiftMap.get(shiftName);
        if (!shiftId) {
          results.push({ 
            employeeId, 
            date, 
            shiftName, 
            status: 'error', 
            message: `Shift "${shiftName}" not found in Shift Master` 
          });
          continue;
        }

        // Verify employee belongs to organization
        const employee = await prisma.employee.findFirst({
          where: {
            id: employeeId,
            organizationId,
          },
        });

        if (!employee) {
          results.push({ 
            employeeId, 
            date, 
            shiftName, 
            status: 'error', 
            message: 'Employee not found in this organization' 
          });
          continue;
        }

        // Upsert attendance record with shiftId
        const attendanceRecord = await prisma.attendanceRecord.upsert({
          where: {
            employeeId_date: {
              employeeId,
              date: new Date(date),
            },
          },
          create: {
            employeeId,
            date: new Date(date),
            shiftId,
          },
          update: {
            shiftId,
          },
        });

        // If the record has check-in/out times, recalculate attendance based on new shift
        if (attendanceRecord.checkIn) {
          try {
            await this.recalculateAttendanceForShiftChange(
              attendanceRecord.id,
              shiftId,
              employeeId,
              organizationId
            );
          } catch (recalcError) {
            // Log error but don't fail the assignment update
            console.error('Error recalculating attendance for shift change:', recalcError);
          }
        }

        results.push({ employeeId, date, shiftName, status: 'success' });
      } catch (error: any) {
        // Catch any unexpected database errors
        results.push({
          employeeId: assignment.employeeId,
          date: assignment.date,
          shiftName: assignment.shiftName,
          status: 'error',
          message: error?.message || 'Database error occurred',
        });
      }
    }

    return results;
  }

  /**
   * Get monthly details for calendar sidebar: short fall, components by category (Leave, Onduty, Permission, Present), late, early going.
   * Data sourced from attendance_components (event configuration) and leave balances / attendance records.
   */
  async getMonthlyDetails(organizationId: string, employeeId: string, year: number, month: number) {
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);
    monthEnd.setHours(23, 59, 59, 999);

    const yearStart = new Date(year, 0, 1);

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, employeeCode: true, paygroupId: true, departmentId: true, dateOfJoining: true },
    });
    if (!employee) {
      throw new AppError('Employee not found', 404);
    }

    // Keep calendar sidebar consistent with Leave Balance policy:
    // if yearly balances are missing, initialize them lazily before monthly read.
    await leaveBalanceService.getBalance({
      employeeId,
      year: String(year),
    });

    const [components, leaveTypes, autoCreditSettings, leaveBalances, previousYearLeaveBalances, records, leaveRequests, ruleSettings] =
      await Promise.all([
      prisma.attendanceComponent.findMany({
        where: { organizationId },
        orderBy: [{ eventCategory: 'asc' }, { priority: 'asc' }, { shortName: 'asc' }],
      }),
        prisma.leaveType.findMany({
          where: { organizationId, isActive: true },
          select: { id: true, name: true, code: true, defaultDaysPerYear: true },
          orderBy: { name: 'asc' },
        }),
        prisma.autoCreditSetting.findMany({
          where: {
            organizationId,
            effectiveDate: { lte: monthEnd },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: yearStart } }],
          },
          select: {
            id: true,
            eventType: true,
            displayName: true,
            associate: true,
            paygroupId: true,
            departmentId: true,
            priority: true,
            autoCreditRule: true,
          },
          orderBy: [{ priority: 'asc' }, { effectiveDate: 'desc' }, { createdAt: 'desc' }],
        }),
      prisma.employeeLeaveBalance.findMany({
        where: { employeeId, year },
        include: {
          leaveType: {
            select: { id: true, name: true, code: true, defaultDaysPerYear: true },
          },
        },
      }),
      prisma.employeeLeaveBalance.findMany({
        where: { employeeId, year: year - 1 },
        include: {
          leaveType: {
            select: { id: true, name: true, code: true, defaultDaysPerYear: true },
          },
        },
      }),
      (async () => {
        try {
          return await prisma.attendanceRecord.findMany({
            where: {
              employeeId,
              date: { gte: monthStart, lte: monthEnd },
            },
            include: { shift: { select: { name: true, startTime: true, endTime: true } } },
          });
        } catch (error) {
          if (!this.isMissingExcessStayColumnError(error)) throw error;
          return await prisma.attendanceRecord.findMany({
            where: {
              employeeId,
              date: { gte: monthStart, lte: monthEnd },
            },
            select: {
              id: true,
              employeeId: true,
              shiftId: true,
              date: true,
              status: true,
              checkIn: true,
              checkOut: true,
              workHours: true,
              overtimeHours: true,
              isLate: true,
              lateMinutes: true,
              earlyMinutes: true,
              shift: { select: { name: true, startTime: true, endTime: true } },
            },
          });
        }
      })(),
      prisma.leaveRequest.findMany({
        where: {
          employeeId,
          status: { in: [LeaveStatus.APPROVED, LeaveStatus.PENDING] },
          // Any leave that overlaps the year-to-month range
          startDate: { lte: monthEnd },
          endDate: { gte: yearStart },
        },
        include: {
          leaveType: {
            select: { id: true, name: true, code: true },
          },
        },
      }),
      prisma.ruleSetting.findMany({
        where: { organizationId },
        select: {
          id: true,
          eventType: true,
          displayName: true,
          eventRuleDefinition: true,
          remarks: true,
          paygroupId: true,
          departmentId: true,
          associate: true,
        },
      }),
    ]);
    const rightsAllocation = await resolveRightsAllocationForEmployee(employeeId, organizationId, {
      effectiveDate: monthStart,
    });

    const entitlementFromAutoCreditByLeaveTypeId = new Map<string, number>(); // only settings that match employee's department & paygroup

    const isAutoCreditApplicableToEmployee = (s: (typeof autoCreditSettings)[0]) => {
      if (s.paygroupId && s.paygroupId !== employee.paygroupId) return false;
      if (s.departmentId && s.departmentId !== employee.departmentId) return false;
      if (s.associate) {
        const a = s.associate.trim();
        if (a && a !== employee.employeeCode && a !== employee.id) return false;
      }
      return true;
    };

    const isRuleSettingApplicableToEmployee = (r: (typeof ruleSettings)[0]) => {
      if (r.paygroupId && r.paygroupId !== employee.paygroupId) return false;
      if (r.departmentId && r.departmentId !== employee.departmentId) return false;
      if (r.associate) {
        const a = r.associate.trim();
        if (a && a !== employee.employeeCode && a !== employee.id) return false;
      }
      return true;
    };

    const nameToEntitlementStrict = new Map<string, number>();
    const codeToEntitlementStrict = new Map<string, number>();
    const entitlementByEventNameOrCodeStrict = new Map<string, number>();
    const entitlementByNormalizedKey = new Map<string, number>();
    const normalizeEntitlementKey = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, '');

    for (const s of autoCreditSettings) {
      const n = readEntitlementDaysForEmployeeYear(
        s.autoCreditRule,
        employee.dateOfJoining,
        year
      );
      if (n == null) continue;
      const applicable = isAutoCreditApplicableToEmployee(s);
      if (!applicable) continue;
      if (s.eventType) {
        const key = s.eventType.toLowerCase().trim();
        if (!nameToEntitlementStrict.has(key)) nameToEntitlementStrict.set(key, n);
        if (!entitlementByEventNameOrCodeStrict.has(key)) {
          entitlementByEventNameOrCodeStrict.set(key, n);
        }
        const normalized = normalizeEntitlementKey(key);
        if (normalized && !entitlementByNormalizedKey.has(normalized)) {
          entitlementByNormalizedKey.set(normalized, n);
        }
      }
      if (s.displayName) {
        const key = s.displayName.trim().toUpperCase();
        if (!codeToEntitlementStrict.has(key)) codeToEntitlementStrict.set(key, n);
        if (!entitlementByEventNameOrCodeStrict.has(key)) {
          entitlementByEventNameOrCodeStrict.set(key, n);
        }
        const normalized = normalizeEntitlementKey(key);
        if (normalized && !entitlementByNormalizedKey.has(normalized)) {
          entitlementByNormalizedKey.set(normalized, n);
        }
      }
    }

    for (const lt of leaveTypes) {
      const codeKey = lt.code ? lt.code.trim().toUpperCase() : '';
      const nameKey = lt.name.toLowerCase();
      const strict = codeKey ? codeToEntitlementStrict.get(codeKey) : undefined;
      const strictName = nameToEntitlementStrict.get(nameKey);
      const entitlementStrict = strict ?? strictName;
      if (entitlementStrict != null) entitlementFromAutoCreditByLeaveTypeId.set(lt.id, entitlementStrict);
    }

    const previousYearBalanceByLeaveTypeId = new Map<string, number>();
    for (const pb of previousYearLeaveBalances) {
      previousYearBalanceByLeaveTypeId.set(pb.leaveTypeId, Number(pb.available ?? 0));
    }

    let excessStayMinutes = 0;
    const shortfallMinutes = 0;
    let lateCount = 0;
    let lateMinutes = 0;
    let earlyGoingCount = 0;
    let earlyGoingMinutes = 0;

    const approvedHalfDayLeaveDateKeys = new Set<string>();
    for (const lr of leaveRequests) {
      const totalDays = Number(lr.totalDays);
      if (lr.status !== LeaveStatus.APPROVED || !(totalDays > 0 && totalDays < 1)) continue;
      const start = new Date(lr.startDate);
      const end = new Date(lr.endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      const from = new Date(Math.max(start.getTime(), monthStart.getTime()));
      const to = new Date(Math.min(end.getTime(), monthEnd.getTime()));
      if (to < from) continue;
      const cursor = new Date(from);
      while (cursor <= to) {
        approvedHalfDayLeaveDateKeys.add(this.toDateKey(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    for (const r of records) {
      const rExcessStayMinutes = (r as { excessStayMinutes?: number | null }).excessStayMinutes;
      const recordDateKey = this.toDateKey(new Date(r.date));
      const shiftName = String((r.shift as { name?: string | null } | null)?.name ?? '').trim().toLowerCase();
      const isWeekOffLike =
        r.status === AttendanceStatus.HOLIDAY ||
        shiftName === 'weekoff' ||
        shiftName === 'week off' ||
        shiftName === 'w';
      if (rExcessStayMinutes != null) {
        excessStayMinutes += Math.max(0, Number(rExcessStayMinutes));
      } else if (isWeekOffLike && r.checkIn && r.checkOut) {
        const workHours = Number(r.workHours ?? 0);
        if (Number.isFinite(workHours) && workHours > 0) {
          excessStayMinutes += Math.max(0, Math.round(workHours * 60));
        } else {
          excessStayMinutes += Math.max(
            0,
            Math.round((new Date(r.checkOut).getTime() - new Date(r.checkIn).getTime()) / 60000)
          );
        }
      } else if (r.checkIn && r.checkOut && r.shift?.startTime && r.shift?.endTime) {
        excessStayMinutes += computeExcessStayMinutesByShift(
          new Date(r.checkIn),
          new Date(r.checkOut),
          { startTime: r.shift.startTime, endTime: r.shift.endTime }
        );
      } else {
        const ot = r.overtimeHours ? Number(r.overtimeHours) : 0;
        if (ot > 0) excessStayMinutes += Math.round(ot * 60);
      }
      const isHalfDayLeaveDate = approvedHalfDayLeaveDateKeys.has(recordDateKey);
      const shouldTrackLateEarly = !isWeekOffLike && !isHalfDayLeaveDate;
      if (!shouldTrackLateEarly) {
        continue;
      }

      const recordWithPolicy = r as {
        isLate?: boolean | null;
        lateMinutes?: number | null;
        earlyMinutes?: number | null;
      };
      const storedLateMinutes = Number(recordWithPolicy.lateMinutes ?? 0);
      const storedEarlyMinutes = Number(recordWithPolicy.earlyMinutes ?? 0);
      const hasStoredPolicyFields =
        recordWithPolicy.isLate != null ||
        recordWithPolicy.lateMinutes != null ||
        recordWithPolicy.earlyMinutes != null;

      // Prefer persisted policy-aware late values (grace/permission already applied during sync).
      if (recordWithPolicy.isLate === true || storedLateMinutes > 0) {
        lateCount += 1;
        lateMinutes += Math.max(0, Math.round(storedLateMinutes));
      } else if (!hasStoredPolicyFields && r.shift?.startTime && r.checkIn) {
        const [sh, sm] = (r.shift.startTime as string).split(':').map(Number);
        const shiftStart = new Date(r.date);
        shiftStart.setHours(sh, sm || 0, 0, 0);
        if (new Date(r.checkIn) > shiftStart) {
          lateCount += 1;
          lateMinutes += Math.round((new Date(r.checkIn).getTime() - shiftStart.getTime()) / 60000);
        }
      }

      // Prefer persisted policy-aware early-going values (grace already applied during sync).
      if (storedEarlyMinutes > 0) {
        earlyGoingCount += 1;
        earlyGoingMinutes += Math.max(0, Math.round(storedEarlyMinutes));
      } else if (!hasStoredPolicyFields && r.shift?.endTime && r.checkOut) {
        const [eh, em] = (r.shift.endTime as string).split(':').map(Number);
        const shiftEnd = new Date(r.date);
        shiftEnd.setHours(eh, em || 0, 0, 0);
        if (new Date(r.checkOut) < shiftEnd) {
          earlyGoingCount += 1;
          earlyGoingMinutes += Math.round((shiftEnd.getTime() - new Date(r.checkOut).getTime()) / 60000);
        }
      }
    }

    const toHHMM = (totalMinutes: number) => {
      const m = Math.abs(totalMinutes) % 60;
      const h = Math.floor(Math.abs(totalMinutes) / 60);
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    const oneDayMs = 24 * 60 * 60 * 1000;

    const usageThisMonth = new Map<string, number>(); // leaveTypeId -> days used in [monthStart, monthEnd]
    const usageBeforeThisMonth = new Map<string, number>(); // leaveTypeId -> days used before monthStart (year-to-date)

    const ondutyReasonRegex = /^\[Onduty(?:\s+([^\]]+))?\]/i;
    const parseOndutyReasonLabel = (reason: string | null | undefined): string | null => {
      if (!reason) return null;
      const m = reason.match(ondutyReasonRegex);
      if (!m) return null;
      return (m[1] || '').trim() || 'Onduty';
    };

    for (const lr of leaveRequests) {
      // Keep Onduty-marked requests out of Leave usage so they don't inflate Leave/CompOff cards.
      if (parseOndutyReasonLabel(lr.reason)) {
        continue;
      }

      // Resolve leaveTypeId — for old direct-correction records it may be null.
      // Try to extract component name from reason "[Direct correction - BEREAVEMENT LEAVE]"
      // and fuzzy-match against known leaveTypes.
      let leaveTypeId = lr.leaveTypeId;
      if (!leaveTypeId) {
        if (lr.leaveType?.id) {
          leaveTypeId = lr.leaveType.id;
        } else if (lr.reason) {
          const m = lr.reason.match(/\[Direct correction\s*-\s*([^\]]+)\]/i);
          if (m) {
            const compName = m[1].trim();
            const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const compNorm = norm(compName);
            const matched = leaveTypes.find((lt) => {
              const n = norm(lt.name);
              const c = norm(lt.code ?? '');
              return n === compNorm || c === compNorm || n.includes(compNorm) || compNorm.includes(n);
            });
            if (matched) leaveTypeId = matched.id;
          }
        }
      }

      // Still null — no matching leave type, skip
      if (!leaveTypeId) continue;

      const totalDays = Number(lr.totalDays);

      const start = new Date(lr.startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(lr.endDate);
      end.setHours(23, 59, 59, 999);

      const totalCalendarDays =
        Math.max(1, Math.round((end.getTime() - start.getTime()) / oneDayMs) + 1);
      const perDay = totalDays / totalCalendarDays;

      const overlap = (rangeStart: Date, rangeEnd: Date) => {
        const s = new Date(Math.max(start.getTime(), rangeStart.getTime()));
        const e = new Date(Math.min(end.getTime(), rangeEnd.getTime()));
        if (e < s) return 0;
        const days = Math.round((e.getTime() - s.getTime()) / oneDayMs) + 1;
        return days * perDay;
      };

      // Usage in this month only
      const usedThis = overlap(monthStart, monthEnd);
      if (usedThis > 0) {
        usageThisMonth.set(leaveTypeId, (usageThisMonth.get(leaveTypeId) ?? 0) + usedThis);
      }

      // Usage before this month (from year start to day before month start)
      const prevMonthEnd = new Date(monthStart.getTime() - 1); // end of previous month
      const usedBefore = overlap(yearStart, prevMonthEnd);
      if (usedBefore > 0) {
        usageBeforeThisMonth.set(leaveTypeId, (usageBeforeThisMonth.get(leaveTypeId) ?? 0) + usedBefore);
      }
    }

    // Fallback: count LEAVE status records by validationAction (component name)
    // Covers cases where leaveRequest was never created (leaveTypeId was null at apply time)
    const normAct = (s: string | null | undefined) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const usageFromRecordsByAction = new Map<string, number>(); // normalized(validationAction) -> count
    for (const rec of records) {
      if ((rec as Record<string, unknown>).status === 'LEAVE' && (rec as Record<string, unknown>).validationMethod === 'DIRECT_COMPONENT') {
        const action = ((rec as Record<string, unknown>).validationAction as string | null | undefined);
        if (action) {
          const key = normAct(action);
          usageFromRecordsByAction.set(key, (usageFromRecordsByAction.get(key) ?? 0) + 1);
        }
      }
    }

    const shortFall = {
      excessStay: toHHMM(excessStayMinutes),
      shortfall: toHHMM(shortfallMinutes),
      difference: toHHMM(excessStayMinutes - shortfallMinutes),
    };

    const byCategory = new Map<string, typeof components>();
    for (const c of components) {
      const cat = c.eventCategory || 'Other';
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat)!.push(c);
    }

    const normalizeKey = (value: string | null | undefined) => {
      const raw = (value || '').toLowerCase().trim();
      // Tolerate common admin spelling variants so component-to-leave mapping still works.
      const typoNormalized = raw.replace(/marraige/g, 'marriage');
      return typoNormalized.replace(/[^a-z0-9]/g, '');
    };

    const isCarryForwardEligibleLeaveType = (leaveType: {
      name?: string | null;
      code?: string | null;
    }): boolean => {
      const code = (leaveType.code || '').trim().toUpperCase();
      const nameKey = normalizeKey(leaveType.name);
      return code === 'EL' || nameKey === 'earnedleave';
    };

    const componentMatchesLeaveType = (
      comp: { eventName?: string | null; shortName?: string | null },
      lt: { name?: string | null; code?: string | null }
    ) => {
      const compEvent = normalizeKey(comp.eventName);
      const compShort = normalizeKey(comp.shortName);
      const typeName = normalizeKey(lt.name);
      const typeCode = normalizeKey(lt.code);

      const exact =
        (compEvent && (compEvent === typeName || compEvent === typeCode)) ||
        (compShort && (compShort === typeCode || compShort === typeName));
      if (exact) return true;

      // Fallback for naming differences like "Permission" vs "Permission Leave"
      const fuzzy =
        (compEvent && typeName && (compEvent.includes(typeName) || typeName.includes(compEvent))) ||
        (compShort && typeCode && (compShort.includes(typeCode) || typeCode.includes(compShort))) ||
        (compEvent && typeCode && (compEvent.includes(typeCode) || typeCode.includes(compEvent))) ||
        (compShort && typeName && (compShort.includes(typeName) || typeName.includes(compShort)));
      return fuzzy;
    };

    const isOndutyOrWfhName = (value: string | null | undefined): boolean => {
      const key = normalizeKey(value);
      return (
        key.includes('onduty') ||
        key.includes('ondutyleave') ||
        key.includes('workfromhome') ||
        key === 'wfh'
      );
    };

    type LeaveRowSource = 'attendance_component' | 'default_leave_module';

    const computeMonthlyLeaveRow = (
      bal: (typeof leaveBalances)[0],
      opts?: { yearEntitlementOverride?: number | null; source?: LeaveRowSource }
    ) => {
      void opts;
      // Only EL is carry-forward eligible — SL and others start fresh each year
      const isCarryForward = isCarryForwardEligibleLeaveType(bal.leaveType);

      // Full annual entitlement stored in DB (already prorated for mid-year joiners)
      const annualCredit = Math.max(0, Number(bal.accrued ?? 0));

      // Used before this month (Jan 1 to last day of prev month)
      const usedBefore = usageBeforeThisMonth.get(bal.leaveTypeId) ?? 0;

      // Used this month only
      const usedThisMonth = usageThisMonth.get(bal.leaveTypeId) ?? 0;
      const used = Math.max(0, usedThisMonth);

      let opening: number;
      let credit: number;
      let balance: number;

      // carriedForward = actual previous year unused balance (EL only)
      // openingBalance = annual entitlement for this year (same as accrued for auto-credit)
      // annualCredit   = annual entitlement (= bal.accrued)
      const carriedForward = isCarryForward
        ? Math.max(0, Number(bal.carriedForward ?? 0))
        : 0;

      // Total available for the full year = annual entitlement + prev year carry
      const totalYearAvailable = annualCredit + carriedForward;

      if (month === 1) {
        // ── JANUARY ──
        // Opening = previous year carry forward only (EL: what carried over, SL: 0)
        opening = carriedForward;

        // Credit = full annual entitlement (shown once in January)
        credit = annualCredit;

        // Balance = opening + credit − used this month
        balance = Math.max(0, opening + credit - used);
      } else {
        // ── FEBRUARY onwards ──
        // Opening = total year available − used in all previous months
        opening = Math.max(0, totalYearAvailable - usedBefore);

        // Credit = 0 (already credited in January)
        credit = 0;

        // Balance = opening − used this month
        balance = Math.max(0, opening - used);
      }

      return {
        name: bal.leaveType.name,
        opening,
        credit,
        used,
        balance,
        source: 'default_leave_module',
        entitlementConfigured: true,
      };
    };

    const readPermissionOpeningCount = (ruleDef: unknown, remarks?: string | null): number | null => {
      if (ruleDef && typeof ruleDef === 'object') {
        const r = ruleDef as Record<string, unknown>;
        const candidates = [r.occasionsInMonth, r.maxEventAvailDaysInMonth];
        for (const v of candidates) {
          const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.trim()) : NaN;
          if (Number.isFinite(n) && n > 0) return Math.floor(n);
        }
      }
      if (remarks && remarks.trim()) {
        const m = remarks.match(/(\d+)\s*(times|time|count|occasion)/i) || remarks.match(/\bmonthly\s*(\d+)\b/i);
        if (m && m[1]) {
          const n = Number(m[1]);
          if (Number.isFinite(n) && n > 0) return Math.floor(n);
        }
      }
      return null;
    };

    const computeMappedRowForComponent = (comp: (typeof components)[0]) => {
      const matchedLeaveTypeForBalance =
        leaveTypes.find(
          (lt) =>
            componentMatchesLeaveType(
              { eventName: comp.eventName, shortName: comp.shortName },
              { name: lt.name, code: lt.code }
            )
        ) ?? null;

      const bal = matchedLeaveTypeForBalance
        ? leaveBalances.find((b) => b.leaveTypeId === matchedLeaveTypeForBalance.id) ??
          leaveBalances.find(
            (b) =>
              componentMatchesLeaveType(
                { eventName: comp.eventName, shortName: comp.shortName },
                { name: b.leaveType.name, code: b.leaveType.code }
              )
          )
        : leaveBalances.find(
            (b) =>
              componentMatchesLeaveType(
                { eventName: comp.eventName, shortName: comp.shortName },
                { name: b.leaveType.name, code: b.leaveType.code }
              )
          );

      if (bal) {
        const base = computeMonthlyLeaveRow(bal, { source: 'attendance_component' });
        return {
          ...base,
          name: comp.eventName || comp.shortName || base.name,
          source: 'attendance_component' as const,
        };
      }

      // No leaveBalance record — try usageThisMonth first (resolved via leaveTypeId)
      // then fall back to attendance records with matching validationAction (DIRECT_COMPONENT)
      const usedFromLeaveMap = matchedLeaveTypeForBalance
        ? (usageThisMonth.get(matchedLeaveTypeForBalance.id) ?? 0)
        : 0;

      // Fallback: count LEAVE records whose validationAction matches component name/shortName
      const compNameNorm = normAct(comp.eventName);
      const compShortNorm = normAct(comp.shortName);
      let usedFromRecords = 0;
      for (const [actionKey, count] of usageFromRecordsByAction) {
        if (
          (compNameNorm && (actionKey === compNameNorm || actionKey.includes(compNameNorm) || compNameNorm.includes(actionKey))) ||
          (compShortNorm && (actionKey === compShortNorm || actionKey.includes(compShortNorm) || compShortNorm.includes(actionKey)))
        ) {
          usedFromRecords = Math.max(usedFromRecords, count);
        }
      }

      const used = Math.max(usedFromLeaveMap, usedFromRecords);

      return {
        name: comp.eventName || comp.shortName,
        opening: 0,
        credit: 0,
        used,
        balance: 0,
        source: 'attendance_component' as const,
        entitlementConfigured: true,
      };
    };

    const leaveComponents = components.filter(
      (c) => String(c.eventCategory || '').trim().toLowerCase() === 'leave'
    );
    const ondutyComponents = components.filter(
      (c) => String(c.eventCategory || '').trim().toLowerCase() === 'onduty'
    );
    const permissionComponents = components.filter(
      (c) => String(c.eventCategory || '').trim().toLowerCase() === 'permission'
    );
    const presentComponents = components.filter(
      (c) => String(c.eventCategory || '').trim().toLowerCase() === 'present'
    );

    const leaveRows = leaveComponents.flatMap((comp) => {
      const row = computeMappedRowForComponent(comp);
      return row ? [row] : [];
    });

    const balanceRow = (comp: (typeof components)[0]) => ({
      name: comp.eventName || comp.shortName,
      opening: 0,
      credit: 0,
      used: 0,
      balance: 0,
    });

    const ondutyRequestsInMonth = leaveRequests.filter((lr) => {
      const s = new Date(lr.startDate);
      const e = new Date(lr.endDate);
      if (s > monthEnd || e < monthStart) return false;
      return !!parseOndutyReasonLabel(lr.reason);
    });
    const normalizeNameKey = (value: string | null | undefined) =>
      normalizeKey(value);
    const ondutyRows = ondutyComponents.map((comp) => {
      const matchedLeaveType =
        leaveTypes.find((lt) =>
          componentMatchesLeaveType(
            { eventName: comp.eventName, shortName: comp.shortName },
            { name: lt.name, code: lt.code }
          )
        ) ?? null;
      const componentKeyA = normalizeNameKey(comp.eventName);
      const componentKeyB = normalizeNameKey(comp.shortName);
      const usedFromOndutyMarker = ondutyRequestsInMonth.reduce((acc, lr) => {
        const label = parseOndutyReasonLabel(lr.reason);
        if (!label) return acc;
        const labelKey = normalizeNameKey(label);
        const matched =
          (componentKeyA && labelKey && (componentKeyA === labelKey || componentKeyA.includes(labelKey) || labelKey.includes(componentKeyA))) ||
          (componentKeyB && labelKey && (componentKeyB === labelKey || componentKeyB.includes(labelKey) || labelKey.includes(componentKeyB)));
        return acc + (matched ? Number(lr.totalDays || 1) : 0);
      }, 0);
      const usedThis = usedFromOndutyMarker > 0
        ? usedFromOndutyMarker
        : matchedLeaveType
          ? usageThisMonth.get(matchedLeaveType.id) ?? 0
          : 0;
      return {
        ...balanceRow(comp),
        used: usedThis,
      };
    });

    const permissionReasonRegex = /^\[Permission\s+\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}\]/i;
    const isPermissionRequest = (lr: { leaveTypeId: string; reason: string; status: string }) =>
      lr.status === LeaveStatus.APPROVED &&
      (permissionReasonRegex.test(lr.reason || '') ||
        leaveTypes.some((lt) => lt.id === lr.leaveTypeId && (lt.name || '').toLowerCase().includes('permission')));
    const permissionRequestsInMonth = leaveRequests.filter((lr) => {
      const s = new Date(lr.startDate);
      const e = new Date(lr.endDate);
      if (s > monthEnd || e < monthStart) return false;
      return isPermissionRequest(lr as { leaveTypeId: string; reason: string; status: string });
    });

    const permissionRows = permissionComponents.map((comp) => {
      const usedCountThisMonth = permissionRequestsInMonth.length;
      const matchingRule = ruleSettings.find(
        (r) =>
          isRuleSettingApplicableToEmployee(r) &&
          componentMatchesLeaveType(
            { eventName: comp.eventName, shortName: comp.shortName },
            { name: r.eventType, code: r.displayName }
          )
      );
      const openingCount = readPermissionOpeningCount(
        matchingRule?.eventRuleDefinition,
        matchingRule?.remarks ?? null
      );
      if (openingCount != null) {
        return {
          name: comp.eventName || comp.shortName,
          opening: openingCount,
          credit: 0,
          used: usedCountThisMonth,
          balance: Math.max(0, openingCount - usedCountThisMonth),
        };
      }
      const row = computeMappedRowForComponent(comp);
      if (!row) {
        return {
          name: comp.eventName || comp.shortName,
          opening: 0,
          credit: 0,
          used: 0,
          balance: 0,
        };
      }
      return {
        name: row.name,
        opening: row.opening,
        credit: row.credit,
        used: row.used,
        balance: row.balance,
      };
    });
    const presentRows = presentComponents.map(balanceRow);

    // Leave card should be fully driven by Attendance Components mapping.
    let finalLeaveRows: Array<{
      name: string;
      opening: number;
      credit: number;
      used: number;
      balance: number;
      source?: LeaveRowSource;
      entitlementConfigured?: boolean;
    }>;
    finalLeaveRows = leaveRows;

    if (rightsAllocation) {
      finalLeaveRows = finalLeaveRows.filter((row) =>
        canPerformAttendanceEventAction(rightsAllocation, 'view', { eventName: row.name })
      );
    }

    // Onduty/WFH should appear only in Onduty card, never in Leave card.
    finalLeaveRows = finalLeaveRows.filter((row) => !isOndutyOrWfhName(row.name));

    const entitlementWarnings = (
      finalLeaveRows as Array<{ name: string; source?: LeaveRowSource; entitlementConfigured?: boolean }>
    )
      .filter((r) => r.entitlementConfigured === false)
      .map((r) => r.name);

    return {
      shortFall,
      leave: finalLeaveRows,
      entitlementWarnings: entitlementWarnings.length > 0 ? entitlementWarnings : undefined,
      onduty: ondutyRows,
      permission: permissionRows,
      present: presentRows,
      late: { count: lateCount, hours: toHHMM(lateMinutes) },
      earlyGoing: { count: earlyGoingCount, hours: toHHMM(earlyGoingMinutes) },
    };
  }

  /**
   * Get Validation Process calendar summary from stored results (attendance_validation_results).
   * Returns aggregated day-wise counts for the given filters. Call after runValidationProcess or to show last run.
   */
  async getValidationProcessCalendarSummary(params: {
    organizationId: string;
    paygroupId?: string | null;
    employeeId?: string | null;
    fromDate: string;
    toDate: string;
  }): Promise<{ daily: Record<string, ValidationDaySummary> }> {
    const { organizationId, paygroupId, employeeId, fromDate, toDate } = params;
    const employeeWhere: Prisma.EmployeeWhereInput = {
      organizationId,
      deletedAt: null,
      employeeStatus: 'ACTIVE',
    };
    if (employeeId) {
      employeeWhere.id = employeeId;
    } else if (paygroupId) {
      employeeWhere.paygroupId = paygroupId;
    }
    const employees = await prisma.employee.findMany({
      where: employeeWhere,
      select: { id: true },
    });
    const employeeIds = employees.map((e) => e.id);
    const daily = await this.getValidationProcessAggregatedFromStore({
      organizationId,
      employeeIds,
      fromDate,
      toDate,
    });
    return { daily };
  }

  /**
   * Run validation process: fetch employees by paygroup/associate, fetch attendance + regularizations,
   * apply validation rules per employee per date, store in attendance_validation_results, then aggregate day-wise and return.
   * Called when user clicks Process button.
   */
  async runValidationProcess(params: {
    organizationId: string;
    paygroupId?: string | null;
    employeeId?: string | null;
    fromDate: string;
    toDate: string;
  }): Promise<{ daily: Record<string, ValidationDaySummary> }> {
    const { organizationId, paygroupId, employeeId, fromDate, toDate } = params;
    const from = new Date(fromDate + 'T00:00:00.000Z');
    const to = new Date(toDate + 'T23:59:59.999Z');

    const employeeWhere: Prisma.EmployeeWhereInput = {
      organizationId,
      deletedAt: null,
      employeeStatus: 'ACTIVE',
    };
    if (employeeId) {
      employeeWhere.id = employeeId;
    } else if (paygroupId) {
      employeeWhere.paygroupId = paygroupId;
    }

    const employees = await prisma.employee.findMany({
      where: employeeWhere,
      select: { id: true, shiftId: true },
    });
    const employeeIds = employees.map((e) => e.id);
    const employeeShiftMap = new Map(employees.map((e) => [e.id, e.shiftId]));

    if (employeeIds.length === 0) {
      const daily: Record<string, ValidationDaySummary> = {};
      for (let d = new Date(from); d <= to; d.setUTCDate(d.getUTCDate() + 1)) {
        daily[this.toDateKey(d)] = this.emptyValidationDaySummary();
      }
      return { daily };
    }

    const [records, pendingRegularizations, punches] = await Promise.all([
      prisma.attendanceRecord.findMany({
        where: {
          employeeId: { in: employeeIds },
          date: { gte: from, lte: to },
        },
        select: {
          id: true,
          employeeId: true,
          date: true,
          status: true,
          checkIn: true,
          checkOut: true,
          breakHours: true,
          isLate: true,
          isEarly: true,
          isDeviation: true,
          lateMinutes: true,
          earlyMinutes: true,
          otMinutes: true,
          overtimeHours: true,
          shiftId: true,
          validationAction: true,
          validationMethod: true,
          shift: {
            select: { startTime: true, endTime: true, breakDuration: true },
          },
        },
      }),
      prisma.attendanceRegularization.findMany({
        where: {
          employeeId: { in: employeeIds },
          status: 'PENDING',
          date: { gte: from, lte: to },
        },
        select: { employeeId: true, date: true },
      }),
      prisma.attendancePunch.findMany({
        where: {
          employeeId: { in: employeeIds },
          punchTime: { gte: from, lte: to },
        },
        select: {
          employeeId: true,
          punchTime: true,
          status: true,
        },
      }),
    ]);

    const pendingSet = new Set(
      pendingRegularizations.map((r) => `${r.employeeId}-${this.toDateKey(r.date)}`)
    );

    // Snapshot previously-completed validation rows before we delete and rebuild.
    // This preserves HR corrections (e.g. absent employees marked No Correction)
    // that have no corresponding AttendanceRecord to carry the validationAction.
    const previouslyCompleted = await prisma.attendanceValidationResult.findMany({
      where: {
        organizationId,
        employeeId: { in: employeeIds },
        date: { gte: from, lte: to },
        isCompleted: true,
      },
      select: { employeeId: true, date: true },
    });
    const completedSet = new Set(
      previouslyCompleted.map((r) => `${r.employeeId}_${this.toDateKey(r.date)}`)
    );

    const [leaveRequests, holidays] = await Promise.all([
      prisma.leaveRequest.findMany({
        where: {
          employeeId: { in: employeeIds },
          // Any leave request that overlaps the selected window.
          startDate: { lte: to },
          endDate: { gte: from },
          status: { notIn: [LeaveStatus.REJECTED, LeaveStatus.CANCELLED] },
        },
        select: {
          employeeId: true,
          startDate: true,
          endDate: true,
          status: true,
        },
      }),
      prisma.holiday.findMany({
        where: {
          organizationId,
          date: { gte: from, lte: to },
        },
        select: { date: true },
      }),
    ]);

    const holidayDateSet = new Set(holidays.map((h) => this.toDateKey(h.date)));

    // Also load holidays stored in ShiftAssignmentRule remarks with __HOLIDAY_DATA__ marker.
    // No effectiveDate filter here — the rule may be created on/after the holiday dates inside it.
    const holidayAssignRules = await prisma.shiftAssignmentRule.findMany({
      where: { organizationId, remarks: { contains: '__HOLIDAY_DATA__' } },
      select: { remarks: true },
    });
    for (const rule of holidayAssignRules) {
      const markerIdx = (rule.remarks || '').indexOf('__HOLIDAY_DATA__');
      if (markerIdx === -1) continue;
      try {
        const parsed = JSON.parse(rule.remarks!.slice(markerIdx + '__HOLIDAY_DATA__'.length)) as {
          holidayDetails?: Array<{ date: string; type: string; name: string }>;
        };
        for (const hd of parsed.holidayDetails ?? []) {
          if (!hd.date) continue;
          const hdDate = new Date(hd.date + 'T00:00:00.000Z');
          if (hdDate >= from && hdDate <= to) {
            holidayDateSet.add(hd.date);
          }
        }
      } catch { /* ignore */ }
    }
    const leaveAppliedSet = new Set<string>();
    const leavePendingSet = new Set<string>();
    for (const lr of leaveRequests) {
      const start = new Date(lr.startDate);
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(lr.endDate);
      end.setUTCHours(0, 0, 0, 0);
      for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
        if (d < from || d > to) continue;
        const dateKey = this.toDateKey(d);
        const key = `${lr.employeeId}-${dateKey}`;
        leaveAppliedSet.add(key);
        if (lr.status === 'PENDING') {
          leavePendingSet.add(key);
        }
      }
    }

    // Fetch configured week-off rules for this org (once, reused for all employees/dates)
    const employeeMetaForWeekOff = await prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      select: { id: true, paygroupId: true, departmentId: true },
    });
    const empMetaMap = new Map(employeeMetaForWeekOff.map((e) => [e.id, e]));
    const weekOffRules = await prisma.shiftAssignmentRule.findMany({
      where: {
        organizationId,
        effectiveDate: { lte: to },
        remarks: { contains: '__WEEK_OFF_DATA__' },
      },
      orderBy: [{ priority: 'desc' }, { effectiveDate: 'desc' }],
      select: { id: true, employeeIds: true, paygroupId: true, departmentId: true, remarks: true, effectiveDate: true },
    });

    /**
     * Returns true if the given date is a configured week-off for the employee.
     * Uses __WEEK_OFF_DATA__ rules including alternate Saturday logic.
     * Falls back to Sunday-only if no rule is configured.
     */
    const isConfiguredWeekOff = (empId: string, date: Date): boolean => {
      const empMeta = empMetaMap.get(empId);
      const dateLocal = new Date(date);
      for (const rule of weekOffRules) {
        if (rule.effectiveDate > date) continue;
        const ruleEmpIds = Array.isArray(rule.employeeIds) ? (rule.employeeIds as string[]) : [];
        let matches = false;
        if (ruleEmpIds.length > 0) {
          matches = ruleEmpIds.includes(empId);
        } else if (rule.paygroupId && rule.departmentId) {
          matches = rule.paygroupId === empMeta?.paygroupId && rule.departmentId === empMeta?.departmentId;
        } else if (rule.paygroupId && !rule.departmentId) {
          matches = rule.paygroupId === empMeta?.paygroupId;
        } else if (!rule.paygroupId && rule.departmentId) {
          matches = rule.departmentId === empMeta?.departmentId;
        } else {
          matches = true; // org-wide
        }
        if (!matches || !rule.remarks) continue;

        const markerIdx = rule.remarks.indexOf('__WEEK_OFF_DATA__');
        if (markerIdx === -1) continue;
        try {
          const jsonStr = rule.remarks.slice(markerIdx + '__WEEK_OFF_DATA__'.length);
          const parsed = JSON.parse(jsonStr) as { weekOffDetails?: boolean[][]; alternateSaturdayOff?: string };
          let weekOffDetails = parsed?.weekOffDetails;
          if (!weekOffDetails || !Array.isArray(weekOffDetails)) continue;
          const altSat = (parsed?.alternateSaturdayOff || '').toUpperCase();
          if ((altSat.includes('1ST') && altSat.includes('3RD')) || (altSat.includes('2ND') && altSat.includes('4TH'))) {
            weekOffDetails = weekOffDetails.map((week) => {
              const row = [...week];
              if (row[0] !== undefined) row[0] = false;
              return row;
            });
          }
          const dayOfMonth = dateLocal.getUTCDate();
          const weekIndex = Math.min(5, Math.max(0, Math.ceil(dayOfMonth / 7) - 1));
          const dayIndex = dateLocal.getUTCDay(); // 0=Sun, 6=Sat
          if (weekOffDetails[weekIndex]?.[dayIndex] === true) return true;
        } catch {
          // ignore parse error
        }
      }
      // Sunday is always a week-off for all employees regardless of configured rules
      return date.getUTCDay() === 0;
    };

    const logPrefix = '[ValidationProcess]';
    console.log(`${logPrefix} run: fromDate=${fromDate} toDate=${toDate} employeeIds=${employeeIds.length} records=${records.length}`);
    const recordDateKeys = [...new Set(records.map((r) => this.toDateKey(r.date)))].sort();
    console.log(`${logPrefix} record dates in range: ${recordDateKeys.join(', ')}`);

    const punchDayMap = new Map<string, { count: number; hasIn: boolean; hasOut: boolean }>();
    for (const p of punches) {
      const dateKey = this.toDateKey(p.punchTime);
      const key = `${p.employeeId}-${dateKey}`;
      const current = punchDayMap.get(key) ?? { count: 0, hasIn: false, hasOut: false };
      const normalizedStatus = String(p.status ?? '').trim().toUpperCase();
      const isInStatus = normalizedStatus === 'IN' || normalizedStatus === '0' || normalizedStatus === 'CHECKIN';
      const isOutStatus =
        normalizedStatus === 'OUT' || normalizedStatus === '1' || normalizedStatus === 'CHECKOUT';
      punchDayMap.set(key, {
        count: current.count + 1,
        hasIn: current.hasIn || isInStatus,
        hasOut: current.hasOut || isOutStatus,
      });
    }

    const todayUTC = new Date();
    todayUTC.setUTCHours(23, 59, 59, 999); // treat "today" as fully included, skip strictly future

    const rows: Prisma.AttendanceValidationResultCreateManyInput[] = [];
    for (const r of records) {
      const dateKey = this.toDateKey(r.date);
      const recordDate = new Date(dateKey + 'T00:00:00.000Z');

      // Skip future dates (beyond today)
      if (recordDate > todayUTC) continue;

      // Week-offs and holidays are auto-completed — insert as isCompleted: true
      const isWeekOffDay = isConfiguredWeekOff(r.employeeId, recordDate);
      const isHolidayDay = holidayDateSet.has(dateKey);
      if (isWeekOffDay || isHolidayDay) {
        rows.push({
          organizationId,
          employeeId: r.employeeId,
          date: recordDate,
          isCompleted: true,
          isApprovalPending: false,
          isLate: false,
          isEarlyGoing: false,
          isAbsent: false,
          isNoOutPunch: false,
          isShiftChange: false,
          isOvertime: false,
          isShortfall: false,
        });
        continue;
      }

      let row: Prisma.AttendanceValidationResultCreateManyInput;
      try {
        const employeeDateKey = `${r.employeeId}-${dateKey}`;
        const hasPendingReg = pendingSet.has(employeeDateKey);
        const hasPendingLeave = leavePendingSet.has(employeeDateKey);
        const hasApprovalPending = hasPendingReg || hasPendingLeave;
        const status = (r.status || '') as AttendanceStatus;
        const hasCheckIn = !!r.checkIn;
        const hasCheckOut = !!r.checkOut;
        const breakHours = r.breakHours != null ? Number(r.breakHours) : 0;
        const defaultShiftId = employeeShiftMap.get(r.employeeId) ?? null;
        const recordShiftId = r.shiftId ?? null;
        const isShiftChange =
          defaultShiftId != null && recordShiftId != null && defaultShiftId !== recordShiftId;
        const isHolidayByCalendar = holidayDateSet.has(dateKey);
        const isWeekOffByCalendar = isConfiguredWeekOff(r.employeeId, new Date(dateKey + 'T00:00:00.000Z'));
        const hasLeaveApplied = leaveAppliedSet.has(employeeDateKey);
        const isAbsentByNoPunchRule =
          !hasCheckIn &&
          !hasCheckOut &&
          !hasLeaveApplied &&
          !isHolidayByCalendar &&
          !isWeekOffByCalendar;
        const isAbsent =
          !hasApprovalPending &&
          !hasLeaveApplied &&
          !isHolidayByCalendar &&
          !isWeekOffByCalendar &&
          (status === AttendanceStatus.ABSENT || isAbsentByNoPunchRule);
        const otMinutes = Number(r.otMinutes ?? 0);
        const otHours = Number(r.overtimeHours ?? 0);
        const hasOvertime = otMinutes > 0 || otHours > 0;

        let isLate = r.isLate === true;
        let isEarly = r.isEarly === true;
        let isShortfall = r.isDeviation === true;
        let policyFound = false;

        if (
          status === AttendanceStatus.PRESENT &&
          hasCheckIn &&
          hasCheckOut &&
          r.checkIn &&
          r.checkOut
        ) {
          const shiftIdForPolicy = recordShiftId ?? defaultShiftId;
          let shiftForCompute = (r as { shift?: { startTime: string | null; endTime: string | null; breakDuration?: number | null } | null }).shift ?? null;
          if (shiftIdForPolicy && !shiftForCompute) {
            const shiftRow = await prisma.shift.findUnique({
              where: { id: shiftIdForPolicy },
              select: { startTime: true, endTime: true, breakDuration: true },
            });
            shiftForCompute = shiftRow;
          }
          if (shiftIdForPolicy && shiftForCompute?.startTime != null && shiftForCompute?.endTime != null) {
            const shiftStartTime = shiftForCompute.startTime as string;
            const shiftEndTime = shiftForCompute.endTime as string;
            try {
              const policyRules = await shiftAssignmentRuleService.getApplicablePolicyRules(
                shiftIdForPolicy,
                r.employeeId,
                new Date(r.date),
                organizationId
              );
              policyFound = policyRules != null;
              const dayStart = new Date(r.date);
              dayStart.setUTCHours(0, 0, 0, 0);
              const permissionEnd = await this.getApprovedPermissionEndForDay(r.employeeId, dayStart);
              const computed = await this.computePolicyFieldsForDay(
                new Date(r.checkIn),
                new Date(r.checkOut),
                breakHours,
                {
                  startTime: shiftForCompute.startTime,
                  endTime: shiftForCompute.endTime,
                  breakDuration: shiftForCompute.breakDuration ?? null,
                },
                policyRules,
                new Date(r.date),
                status,
                undefined,
                permissionEnd
              );
              isLate = computed.isLate;
              isEarly = computed.isEarly;
              isShortfall = computed.isDeviation;

              if (!policyFound && (isLate || isEarly || computed.isDeviation)) {
                console.log(`${logPrefix} policy null but compute returned flags date=${dateKey} (will apply shift-only fallback)`);
              }

              if (!policyFound) {
                const checkInDate = new Date(r.checkIn);
                const checkOutDate = new Date(r.checkOut);
                const dayStartLocal = new Date(checkInDate.getFullYear(), checkInDate.getMonth(), checkInDate.getDate(), 0, 0, 0, 0);
                const [startH, startM] = shiftStartTime.split(':').map(Number);
                const [endH, endM] = shiftEndTime.split(':').map(Number);
                const shiftStart = new Date(dayStartLocal.getTime());
                shiftStart.setHours(startH, startM || 0, 0, 0);
                const shiftEnd = new Date(dayStartLocal.getTime());
                shiftEnd.setHours(endH, endM || 0, 0, 0);
                if (checkInDate.getTime() > shiftStart.getTime()) isLate = true;
                if (checkOutDate.getTime() < shiftEnd.getTime()) isEarly = true;
                if (isLate || isEarly) {
                  isShortfall = isShortfall || isLate || isEarly;
                }
              }
              console.log(`${logPrefix} BEFORE INSERT date=${dateKey} shiftStart=${shiftStartTime} shiftEnd=${shiftEndTime} policyFound=${policyFound} isLate=${isLate} isEarlyGoing=${isEarly} isShortfall=${isShortfall}`);
            } catch (err) {
              console.warn(`${logPrefix} compute failed employeeId=${r.employeeId} date=${dateKey} status=${status} shiftId=${shiftIdForPolicy ?? 'null'} error=${err instanceof Error ? err.message : String(err)}`);
              const checkInDate = new Date(r.checkIn);
              const checkOutDate = new Date(r.checkOut);
              const dayStartLocal = new Date(checkInDate.getFullYear(), checkInDate.getMonth(), checkInDate.getDate(), 0, 0, 0, 0);
              const [startH, startM] = (shiftForCompute!.startTime as string).split(':').map(Number);
              const [endH, endM] = (shiftForCompute!.endTime as string).split(':').map(Number);
              const shiftStart = new Date(dayStartLocal.getTime());
              shiftStart.setHours(startH, startM || 0, 0, 0);
              const shiftEnd = new Date(dayStartLocal.getTime());
              shiftEnd.setHours(endH, endM || 0, 0, 0);
              isLate = checkInDate.getTime() > shiftStart.getTime();
              isEarly = checkOutDate.getTime() < shiftEnd.getTime();
              if (isLate || isEarly) isShortfall = true;
              console.log(`${logPrefix} AFTER FALLBACK date=${dateKey} shiftStart=${shiftForCompute!.startTime} shiftEnd=${shiftForCompute!.endTime} isLate=${isLate} isEarlyGoing=${isEarly} isShortfall=${isShortfall}`);
            }
          } else {
            console.log(`${logPrefix} skip compute employeeId=${r.employeeId} date=${dateKey} status=${status} shiftId=${shiftIdForPolicy ?? 'null'} shiftForCompute=${!!shiftForCompute} startTime=${!!shiftForCompute?.startTime} endTime=${!!shiftForCompute?.endTime}`);
          }
        }

        // No-out-punch records should still participate in late/early grouping.
        // We treat missing checkout as early-going and derive late from check-in vs shift start when available.
        if (
          status === AttendanceStatus.PRESENT &&
          hasCheckIn &&
          !hasCheckOut &&
          r.checkIn
        ) {
          const shiftIdForPolicy = recordShiftId ?? defaultShiftId;
          let shiftForCompute = (r as { shift?: { startTime: string | null; endTime: string | null; breakDuration?: number | null } | null }).shift ?? null;
          if (shiftIdForPolicy && !shiftForCompute) {
            const shiftRow = await prisma.shift.findUnique({
              where: { id: shiftIdForPolicy },
              select: { startTime: true, endTime: true, breakDuration: true },
            });
            shiftForCompute = shiftRow;
          }

          isEarly = true;
          if (shiftForCompute?.startTime) {
            const checkInDate = new Date(r.checkIn);
            const dayStartLocal = new Date(
              checkInDate.getFullYear(),
              checkInDate.getMonth(),
              checkInDate.getDate(),
              0,
              0,
              0,
              0
            );
            const [startH, startM] = String(shiftForCompute.startTime).split(':').map(Number);
            const shiftStart = new Date(dayStartLocal.getTime());
            shiftStart.setHours(startH, startM || 0, 0, 0);
            isLate = checkInDate.getTime() > shiftStart.getTime();
          }
          isShortfall = true;
        }

        const isSinglePunch = hasCheckIn !== hasCheckOut;
        const normalCompleted =
          status === AttendanceStatus.PRESENT &&
          hasCheckIn &&
          hasCheckOut &&
          !hasPendingReg &&
          !isLate &&
          !isEarly &&
          !isShortfall;

        const isHolidayOrWeekOff =
          status === AttendanceStatus.HOLIDAY || status === AttendanceStatus.WEEKEND;
        let holidayWeekOffCompleted = false;
        if (isHolidayOrWeekOff && hasCheckIn && hasCheckOut && r.checkIn && r.checkOut) {
          const workHoursOnOff =
            (new Date(r.checkOut).getTime() - new Date(r.checkIn).getTime()) / (1000 * 60 * 60) - breakHours;
          if (workHoursOnOff >= 9) {
            holidayWeekOffCompleted = true;
          }
        }

        const hasCorrectionApplied = !!r.validationAction;
        const normalizedValidationAction = String(r.validationAction ?? '').trim().toLowerCase();
        const normalizedValidationMethod = String(r.validationMethod ?? '').trim().toLowerCase();
        const isNoCorrectionApplied =
          normalizedValidationAction === 'no correction' ||
          normalizedValidationAction === 'no_correction';
        const isNoCorrectionFinalized = normalizedValidationMethod === 'no_correction_final';
        const isSinglePunchNoCorrection = isSinglePunch && isNoCorrectionApplied && !isNoCorrectionFinalized;
        const lateCorrectedCompleted = isLate && hasCorrectionApplied && !isSinglePunchNoCorrection;
        const earlyCorrectedCompleted = isEarly && hasCorrectionApplied && !isSinglePunchNoCorrection;

        const leaveCompleted = hasLeaveApplied && !hasPendingLeave;
        const isCompleted =
          normalCompleted ||
          holidayWeekOffCompleted ||
          lateCorrectedCompleted ||
          earlyCorrectedCompleted ||
          leaveCompleted;

        // Single punch must appear first in "No Out Punch"; after No Correction from that bucket,
        // re-classify into Late/Early for follow-up.
        const effectiveIsNoOutPunch =
          isSinglePunch && !isSinglePunchNoCorrection && !isNoCorrectionFinalized;
        const effectiveIsLate =
          isLate &&
          (!hasCorrectionApplied || isSinglePunchNoCorrection) &&
          !effectiveIsNoOutPunch;
        const effectiveIsEarly =
          isEarly &&
          (!hasCorrectionApplied || isSinglePunchNoCorrection) &&
          !effectiveIsNoOutPunch;
        const effectiveIsShortfall =
          isShortfall &&
          (!hasCorrectionApplied || isSinglePunchNoCorrection) &&
          !effectiveIsNoOutPunch;
        // If a correction was applied (No Correction / Direct Component), suppress absent flag.
        // Also check the completedSet snapshot: absent employees corrected with No Correction
        // have no AttendanceRecord, so hasCorrectionApplied is always false for them —
        // the snapshot is the only reliable source to know they were previously corrected.
        const wasCompleted = completedSet.has(`${r.employeeId}_${dateKey}`);
        const effectiveIsAbsent = isAbsent && !hasCorrectionApplied && !wasCompleted;
        const effectiveIsCompleted = isCompleted || wasCompleted;

        row = {
          organizationId,
          employeeId: r.employeeId,
          date: new Date(dateKey + 'T00:00:00.000Z'),
          isCompleted: effectiveIsCompleted,
          isApprovalPending: hasApprovalPending,
          isLate: effectiveIsLate,
          isEarlyGoing: effectiveIsEarly,
          isAbsent: effectiveIsAbsent,
          isNoOutPunch: effectiveIsNoOutPunch,
          isShiftChange,
          isOvertime: hasOvertime,
          isShortfall: effectiveIsShortfall,
        };
      } catch (err) {
        console.error(`${logPrefix} record failed employeeId=${r.employeeId} date=${dateKey} error=${err instanceof Error ? err.message : String(err)}`, err);
        const employeeDateKey = `${r.employeeId}-${dateKey}`;
        const hasPendingReg = pendingSet.has(employeeDateKey);
        const hasPendingLeave = leavePendingSet.has(employeeDateKey);
        const hasApprovalPending = hasPendingReg || hasPendingLeave;
        const status = (r.status || '') as AttendanceStatus;
        const hasCheckIn = !!r.checkIn;
        const hasCheckOut = !!r.checkOut;
        const breakHoursFb = r.breakHours != null ? Number(r.breakHours) : 0;
        const isHolidayByCalendar = holidayDateSet.has(dateKey);
        const isWeekOffByCalendar = isConfiguredWeekOff(r.employeeId, new Date(dateKey + 'T00:00:00.000Z'));
        const hasLeaveApplied = leaveAppliedSet.has(employeeDateKey);
        const isAbsentByNoPunchRule =
          !hasCheckIn &&
          !hasCheckOut &&
          !hasLeaveApplied &&
          !isHolidayByCalendar &&
          !isWeekOffByCalendar;
        const isAbsent =
          !hasApprovalPending &&
          !hasLeaveApplied &&
          !isHolidayByCalendar &&
          !isWeekOffByCalendar &&
          (status === AttendanceStatus.ABSENT || isAbsentByNoPunchRule);
        const otMinutes = Number(r.otMinutes ?? 0);
        const otHours = Number(r.overtimeHours ?? 0);
        const hasOvertime = otMinutes > 0 || otHours > 0;

        const fbIsLate = r.isLate === true;
        const fbIsHolidayOrWeekOff = status === AttendanceStatus.HOLIDAY || status === AttendanceStatus.WEEKEND;
        let fbHolidayCompleted = false;
        if (fbIsHolidayOrWeekOff && hasCheckIn && hasCheckOut && r.checkIn && r.checkOut) {
          const wh = (new Date(r.checkOut).getTime() - new Date(r.checkIn).getTime()) / (1000 * 60 * 60) - breakHoursFb;
          if (wh >= 9) fbHolidayCompleted = true;
        }
        const fbCorrectionApplied = !!r.validationAction;
        const fbNormalizedValidationAction = String(r.validationAction ?? '').trim().toLowerCase();
        const fbNormalizedValidationMethod = String(r.validationMethod ?? '').trim().toLowerCase();
        const fbIsNoCorrectionApplied =
          fbNormalizedValidationAction === 'no correction' ||
          fbNormalizedValidationAction === 'no_correction';
        const fbIsSinglePunch = hasCheckIn !== hasCheckOut;
        const fbIsNoCorrectionFinalized = fbNormalizedValidationMethod === 'no_correction_final';
        const fbIsSinglePunchNoCorrection =
          fbIsSinglePunch && fbIsNoCorrectionApplied && !fbIsNoCorrectionFinalized;
        const fbIsEarly = r.isEarly === true;
        const fbLateCorrected = fbIsLate && fbCorrectionApplied && !fbIsSinglePunchNoCorrection;
        const fbEarlyCorrected = fbIsEarly && fbCorrectionApplied && !fbIsSinglePunchNoCorrection;
        const fbLeaveCompleted = hasLeaveApplied && !hasPendingLeave;
        const fbCompleted = fbHolidayCompleted || fbLateCorrected || fbEarlyCorrected || fbLeaveCompleted;

        row = {
          organizationId,
          employeeId: r.employeeId,
          date: new Date(dateKey + 'T00:00:00.000Z'),
          isCompleted: fbCompleted,
          isApprovalPending: hasApprovalPending,
          isLate:
            fbIsLate &&
            (!fbCorrectionApplied || fbIsSinglePunchNoCorrection) &&
            (!fbIsSinglePunch || fbIsSinglePunchNoCorrection),
          isEarlyGoing:
            fbIsEarly &&
            (!fbCorrectionApplied || fbIsSinglePunchNoCorrection) &&
            (!fbIsSinglePunch || fbIsSinglePunchNoCorrection),
          isAbsent,
          isNoOutPunch:
            fbIsSinglePunch && !fbIsSinglePunchNoCorrection && !fbIsNoCorrectionFinalized,
          isShiftChange: false,
          isOvertime: hasOvertime,
          isShortfall:
            r.isDeviation === true &&
            (!fbCorrectionApplied || fbIsSinglePunchNoCorrection) &&
            (!fbIsSinglePunch || fbIsSinglePunchNoCorrection),
        };
      }
      rows.push(row);
    }

    const existingRowKeys = new Set(rows.map((r) => `${r.employeeId}-${this.toDateKey(r.date)}`));
    for (const employeeId of employeeIds) {
      for (let d = new Date(from); d <= to; d.setUTCDate(d.getUTCDate() + 1)) {
        const dateKey = this.toDateKey(d);
        const loopDate = new Date(dateKey + 'T00:00:00.000Z');

        // Skip future dates
        if (loopDate > todayUTC) continue;

        const rowKey = `${employeeId}-${dateKey}`;
        if (existingRowKeys.has(rowKey)) continue;

        // Week-offs and holidays are auto-completed
        if (isConfiguredWeekOff(employeeId, loopDate) || holidayDateSet.has(dateKey)) {
          rows.push({
            organizationId,
            employeeId,
            date: loopDate,
            isCompleted: true,
            isApprovalPending: false,
            isLate: false,
            isEarlyGoing: false,
            isAbsent: false,
            isNoOutPunch: false,
            isShiftChange: false,
            isOvertime: false,
            isShortfall: false,
          });
          continue;
        }

        const hasLeaveApplied = leaveAppliedSet.has(rowKey);
        const hasPendingApproval = pendingSet.has(rowKey) || leavePendingSet.has(rowKey);
        const dayPunch = punchDayMap.get(rowKey);
        const hasSinglePunch =
          !!dayPunch && ((dayPunch.hasIn !== dayPunch.hasOut) || dayPunch.count % 2 !== 0);
        const isAbsent =
          !hasPendingApproval &&
          !hasSinglePunch &&
          !hasLeaveApplied;

        // Preserve prior HR corrections: absent employees corrected with No Correction
        // have no AttendanceRecord, so they always land in this second loop on every re-run.
        // The completedSet snapshot taken before the delete is the only source of truth.
        const wasCompleted = completedSet.has(`${employeeId}_${dateKey}`);
        const leaveCompleted = hasLeaveApplied && !hasPendingApproval;
        rows.push({
          organizationId,
          employeeId,
          date: loopDate,
          isCompleted: leaveCompleted || wasCompleted,
          isApprovalPending: hasPendingApproval,
          isLate: false,
          isEarlyGoing: false,
          isAbsent: isAbsent && !wasCompleted,
          isNoOutPunch: hasSinglePunch && !wasCompleted,
          isShiftChange: false,
          isOvertime: false,
          isShortfall: hasSinglePunch && !wasCompleted,
        });
      }
    }

    const rowDateKeys = [...new Set(rows.map((r) => this.toDateKey(r.date)))].sort();
    console.log(`${logPrefix} before insert: rows=${rows.length} dates=${rowDateKeys.join(', ')}`);

    await prisma.$transaction(async (tx) => {
      await tx.attendanceValidationResult.deleteMany({
        where: {
          organizationId,
          employeeId: { in: employeeIds },
          date: { gte: from, lte: to },
        },
      });
      if (rows.length > 0) {
        await tx.attendanceValidationResult.createMany({ data: rows });
      }
    }, { timeout: 30000 });

    const daily = await this.getValidationProcessAggregatedFromStore({
      organizationId,
      employeeIds,
      fromDate,
      toDate,
    });
    return { daily };
  }

  /**
   * Read stored validation results for given employees and date range, aggregate by date. Used after run and for GET summary.
   */
  async getValidationProcessAggregatedFromStore(params: {
    organizationId: string;
    employeeIds: string[];
    fromDate: string;
    toDate: string;
  }): Promise<Record<string, ValidationDaySummary>> {
    const { organizationId, employeeIds, fromDate, toDate } = params;
    const from = new Date(fromDate + 'T00:00:00.000Z');
    const to = new Date(toDate + 'T23:59:59.999Z');

    if (employeeIds.length === 0) {
      const daily: Record<string, ValidationDaySummary> = {};
      for (let d = new Date(from); d <= to; d.setUTCDate(d.getUTCDate() + 1)) {
        daily[this.toDateKey(d)] = this.emptyValidationDaySummary();
      }
      return daily;
    }

    const stored = await prisma.attendanceValidationResult.findMany({
      where: {
        organizationId,
        employeeId: { in: employeeIds },
        date: { gte: from, lte: to },
      },
      select: {
        date: true,
        isCompleted: true,
        isApprovalPending: true,
        isLate: true,
        isEarlyGoing: true,
        isAbsent: true,
        isNoOutPunch: true,
        isShiftChange: true,
        isOvertime: true,
        isShortfall: true,
        isOnHold: true,
      },
    });

    const daily: Record<string, ValidationDaySummary> = {};
    const ensureDay = (dateKey: string) => {
      if (!daily[dateKey]) daily[dateKey] = this.emptyValidationDaySummary();
    };
    for (const row of stored) {
      const dateKey = this.toDateKey(row.date);
      ensureDay(dateKey);
      if (row.isOnHold) { daily[dateKey].onHold += 1; continue; }
      if (row.isCompleted) daily[dateKey].completed += 1;
      if (row.isApprovalPending) daily[dateKey].approvalPending += 1;
      if (row.isLate && !row.isNoOutPunch) daily[dateKey].late += 1;
      if (row.isEarlyGoing) daily[dateKey].earlyGoing += 1;
      if (row.isAbsent) daily[dateKey].absent += 1;
      if (row.isNoOutPunch) daily[dateKey].noOutPunch += 1;
      if (row.isShiftChange) daily[dateKey].shiftChange += 1;
      if (row.isOvertime) daily[dateKey].overtime += 1;
      if (row.isShortfall) daily[dateKey].shortfall += 1;
    }
    for (let d = new Date(from); d <= to; d.setUTCDate(d.getUTCDate() + 1)) {
      ensureDay(this.toDateKey(d));
    }
    return daily;
  }

  /**
   * When daysValue is set (Manual mode) → use the fixed value.
   * When daysValue is null/undefined (Auto mode) → dynamic: totalMinutes / 480, rounded up to nearest 0.5 day.
   *   8 hr (480 min) = 1 day, round unit = 0.5 day
   *   e.g. 15 hr (900 min) → 900/480 = 1.875 → ceil to 2.0 days
   *        24 hr (1440 min) → 1440/480 = 3.0 days
   *        6 hr  (360 min) → 360/480 = 0.75 → ceil to 1.0 day
   */
  private computeDeductionDays(daysValue: unknown, totalLateMinutes: number): number {
    const fixed = Number(daysValue ?? 0);
    if (fixed > 0) return fixed;
    if (totalLateMinutes <= 0) return 0;
    const raw = totalLateMinutes / 480;
    return Math.ceil(raw * 2) / 2;
  }

  /** Map frontend validation grouping type to AttendanceValidationResult boolean field name */
  private validationTypeToField(type: string): keyof Pick<Prisma.AttendanceValidationResultWhereInput, 'isCompleted' | 'isApprovalPending' | 'isLate' | 'isEarlyGoing' | 'isAbsent' | 'isNoOutPunch' | 'isShiftChange' | 'isOvertime' | 'isShortfall'> {
    const map: Record<string, keyof Prisma.AttendanceValidationResultWhereInput> = {
      completed: 'isCompleted',
      approvalPending: 'isApprovalPending',
      late: 'isLate',
      earlyGoing: 'isEarlyGoing',
      absent: 'isAbsent',
      noOutPunch: 'isNoOutPunch',
      shiftChange: 'isShiftChange',
      overtime: 'isOvertime',
      shortfall: 'isShortfall',
      validationOnHold: 'isOnHold',
    };
    return (map[type] ?? 'isCompleted') as keyof Pick<Prisma.AttendanceValidationResultWhereInput, 'isCompleted' | 'isApprovalPending' | 'isLate' | 'isEarlyGoing' | 'isAbsent' | 'isNoOutPunch' | 'isShiftChange' | 'isOvertime' | 'isShortfall'>;
  }

  /**
   * Get validation process employee list: records from attendance_validation_results for the given type and date range,
   * with employee and attendance record details for the grid.
   */
  async getValidationProcessEmployeeList(params: {
    organizationId: string;
    fromDate: string;
    toDate: string;
    type: string;
    paygroupId?: string;
    employeeId?: string;
  }): Promise<{
    rows: Array<{
      employeeId: string;
      employeeCode: string;
      employeeName: string;
      date: string;
      shiftName: string | null;
      shiftStart: string | null;
      shiftEnd: string | null;
      firstInPunch: string | null;
      lastOutPunch: string | null;
      presentFirstHalf: string | null;
      presentSecondHalf: string | null;
      leaveFirstHalf: string | null;
      leaveSecondHalf: string | null;
    }>;
  }> {
    const { organizationId, fromDate, toDate, type, paygroupId, employeeId } = params;
    const from = new Date(fromDate + 'T00:00:00.000Z');
    const to = new Date(toDate + 'T23:59:59.999Z');
    const field = this.validationTypeToField(type);
    // For "late" type, exclude records that are also "No Out Punch" (single punch)
    const excludeOverlap = type === 'late' ? { isNoOutPunch: { not: true } } : {};

    const validationRows = await prisma.attendanceValidationResult.findMany({
      where: {
        organizationId,
        date: { gte: from, lte: to },
        [field]: true,
        isCompleted: false,
        ...excludeOverlap,
        ...(employeeId && { employeeId }),
        ...(paygroupId && !employeeId && { employee: { paygroupId } }),
      },
      select: {
        employeeId: true,
        date: true,
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            middleName: true,
            lastName: true,
          },
        },
      },
      orderBy: [{ date: 'asc' }, { employee: { firstName: 'asc' } }],
    });
    const employeeIds = [...new Set(validationRows.map((r) => r.employeeId))];
    const attendanceRecords = await prisma.attendanceRecord.findMany({
      where: {
        employeeId: { in: employeeIds },
        date: { gte: from, lte: to },
      },
      select: {
        employeeId: true,
        date: true,
        checkIn: true,
        checkOut: true,
        validationAction: true,
        validationMethod: true,
        shift: { select: { name: true, startTime: true, endTime: true } },
      },
    });
    const recordByKey = new Map(
      attendanceRecords.map((r) => [`${r.employeeId}:${this.toDateKey(r.date)}`, r])
    );
    const formatTime = (d: Date | null) =>
      d ? new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }) : null;

    // For absent type: build exclusion sets (holidays, week-off rules, approved leaves) within the selected range
    let absentHolidaySet = new Set<string>();
    let absentLeaveAppliedSet = new Set<string>();
    let absentWeekOffRules: Array<{ employeeIds: unknown; paygroupId: string | null; departmentId: string | null; remarks: string | null; effectiveDate: Date }> = [];
    let absentEmpMetaMap = new Map<string, { paygroupId: string | null; departmentId: string | null }>();
    if (type === 'absent') {
      const [absentHolidays, absentLeaveRequests, absentShiftRules, absentEmpMeta] = await Promise.all([
        prisma.holiday.findMany({
          where: { organizationId, date: { gte: from, lte: to } },
          select: { date: true },
        }),
        prisma.leaveRequest.findMany({
          where: {
            employeeId: { in: employeeIds },
            startDate: { lte: to },
            endDate: { gte: from },
            status: 'APPROVED',
          },
          select: { employeeId: true, startDate: true, endDate: true },
        }),
        prisma.shiftAssignmentRule.findMany({
          where: {
            organizationId,
            // No effectiveDate filter — holiday rules may be created after the holiday dates they contain.
            // Week-off rules will still be filtered by effectiveDate inside isConfiguredWeekOffForList.
            remarks: { contains: '__DATA__' },
          },
          orderBy: [{ priority: 'desc' }, { effectiveDate: 'desc' }],
          select: { employeeIds: true, paygroupId: true, departmentId: true, remarks: true, effectiveDate: true },
        }),
        prisma.employee.findMany({
          where: { id: { in: employeeIds } },
          select: { id: true, paygroupId: true, departmentId: true },
        }),
      ]);

      // Holidays from the holidays table
      absentHolidaySet = new Set(absentHolidays.map((h) => this.toDateKey(h.date)));

      // Also extract holidays stored in ShiftAssignmentRule remarks with __HOLIDAY_DATA__ marker
      const holidayRules = absentShiftRules.filter((r) => r.remarks?.includes('__HOLIDAY_DATA__'));
      for (const rule of holidayRules) {
        const markerIdx = (rule.remarks || '').indexOf('__HOLIDAY_DATA__');
        if (markerIdx === -1) continue;
        try {
          const parsed = JSON.parse(rule.remarks!.slice(markerIdx + '__HOLIDAY_DATA__'.length)) as {
            holidayDetails?: Array<{ date: string; type: string; name: string }>;
          };
          for (const hd of parsed.holidayDetails ?? []) {
            if (!hd.date) continue;
            const hdDate = new Date(hd.date + 'T00:00:00.000Z');
            if (hdDate >= from && hdDate <= to) {
              absentHolidaySet.add(hd.date);
            }
          }
        } catch { /* ignore parse errors */ }
      }

      absentWeekOffRules = absentShiftRules.filter((r) => r.remarks?.includes('__WEEK_OFF_DATA__'));
      absentEmpMetaMap = new Map(absentEmpMeta.map((e) => [e.id, e]));
      for (const lr of absentLeaveRequests) {
        const start = new Date(lr.startDate); start.setUTCHours(0, 0, 0, 0);
        const end = new Date(lr.endDate); end.setUTCHours(0, 0, 0, 0);
        for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
          if (d < from || d > to) continue;
          absentLeaveAppliedSet.add(`${lr.employeeId}-${this.toDateKey(d)}`);
        }
      }
    }

    const isConfiguredWeekOffForList = (empId: string, date: Date): boolean => {
      const empMeta = absentEmpMetaMap.get(empId);
      for (const rule of absentWeekOffRules) {
        if (rule.effectiveDate > date) continue;
        const ruleEmpIds = Array.isArray(rule.employeeIds) ? (rule.employeeIds as string[]) : [];
        let matches = false;
        if (ruleEmpIds.length > 0) {
          matches = ruleEmpIds.includes(empId);
        } else if (rule.paygroupId && rule.departmentId) {
          matches = rule.paygroupId === empMeta?.paygroupId && rule.departmentId === empMeta?.departmentId;
        } else if (rule.paygroupId && !rule.departmentId) {
          matches = rule.paygroupId === empMeta?.paygroupId;
        } else if (!rule.paygroupId && rule.departmentId) {
          matches = rule.departmentId === empMeta?.departmentId;
        } else {
          matches = true;
        }
        if (!matches || !rule.remarks) continue;
        const markerIdx = rule.remarks.indexOf('__WEEK_OFF_DATA__');
        if (markerIdx === -1) continue;
        try {
          const jsonStr = rule.remarks.slice(markerIdx + '__WEEK_OFF_DATA__'.length);
          const parsed = JSON.parse(jsonStr) as { weekOffDetails?: boolean[][]; alternateSaturdayOff?: string };
          let weekOffDetails = parsed?.weekOffDetails;
          if (!weekOffDetails || !Array.isArray(weekOffDetails)) continue;
          const altSat = (parsed?.alternateSaturdayOff || '').toUpperCase();
          if ((altSat.includes('1ST') && altSat.includes('3RD')) || (altSat.includes('2ND') && altSat.includes('4TH'))) {
            weekOffDetails = weekOffDetails.map((week) => {
              const row = [...week]; if (row[0] !== undefined) row[0] = false; return row;
            });
          }
          const dayOfMonth = date.getUTCDate();
          const weekIndex = Math.min(5, Math.max(0, Math.ceil(dayOfMonth / 7) - 1));
          const dayIndex = date.getUTCDay();
          if (weekOffDetails[weekIndex]?.[dayIndex] === true) return true;
        } catch { /* ignore */ }
      }
      // Sunday is always a week-off for all employees regardless of configured rules
      return date.getUTCDay() === 0;
    };

    // Filter out rows where:
    // 1. Correction was already applied (except No Correction rows that are intentionally rerouted into Late/Early)
    // 2. For "late" type: no checkout (single punch / no out punch regardless of status)
    // 3. For "absent" type: exclude holidays, configured week-offs, and days with approved leave (within selected range only)
    const pendingValidationRows = validationRows.filter((v) => {
      const key = `${v.employeeId}:${this.toDateKey(v.date)}`;
      const rec = recordByKey.get(key);
      if (rec?.validationAction) {
        const action = String(rec.validationAction).trim().toLowerCase();
        const method = String(rec.validationMethod ?? '').trim().toLowerCase();
        const isNoCorrectionAction =
          action === 'no correction' || action === 'no_correction';
        const isNoCorrectionFinalized = method === 'no_correction_final';
        const allowRerouteNoCorrection =
          (type === 'earlyGoing' || type === 'late') && isNoCorrectionAction && !isNoCorrectionFinalized;
        if (!allowRerouteNoCorrection) return false;
      }
      if (type === 'late' && !rec?.checkOut) return false;
      if (type === 'absent') {
        const dateKey = this.toDateKey(v.date);
        if (absentHolidaySet.has(dateKey)) return false;
        if (isConfiguredWeekOffForList(v.employeeId, new Date(dateKey + 'T00:00:00.000Z'))) return false;
        if (absentLeaveAppliedSet.has(`${v.employeeId}-${dateKey}`)) return false;
        // Also exclude if there is any punch (single punch = no-out-punch, not absent)
        if (rec?.checkIn) return false;
      }
      return true;
    });

    const rows = pendingValidationRows.map((v) => {
      const key = `${v.employeeId}:${this.toDateKey(v.date)}`;
      const rec = recordByKey.get(key);
      const parts = [v.employee.firstName, v.employee.middleName, v.employee.lastName].filter(Boolean);
      const employeeName = parts.join(' ').trim() || (v.employee.employeeCode ?? '');
      return {
        employeeId: v.employeeId,
        employeeCode: v.employee.employeeCode ?? '',
        employeeName,
        date: this.toDateKey(v.date),
        shiftName: rec?.shift?.name ?? null,
        shiftStart: rec?.shift?.startTime ?? null,
        shiftEnd: rec?.shift?.endTime ?? null,
        firstInPunch: rec?.checkIn ? formatTime(rec.checkIn) : null,
        lastOutPunch: rec?.checkOut ? formatTime(rec.checkOut) : null,
        presentFirstHalf: null,
        presentSecondHalf: null,
        leaveFirstHalf: null,
        leaveSecondHalf: null,
      };
    });
    return { rows };
  }

  private emptyValidationDaySummary(): ValidationDaySummary {
    return {
      completed: 0,
      approvalPending: 0,
      late: 0,
      earlyGoing: 0,
      noOutPunch: 0,
      shiftChange: 0,
      absent: 0,
      shortfall: 0,
      overtime: 0,
      onHold: 0,
    };
  }

  /**
   * Aggregated Late Deductions for a date range.
   * For each employee: sums all lateMinutes → applies tier rule → returns deduction.
   *
   * Flow:
   *   1. Fetch employees by paygroup/associate filter
   *   2. Fetch attendance_records with isLate=true in date range
   *   3. Group by employee, sum lateMinutes and count
   *   4. Fetch the matching validation rule for each employee
   *   5. Apply tier (getActionForLateMinutes on TOTAL minutes)
   *   6. Handle Permission limit → Leave → LOP fallback
   *   7. Return per-employee summary
   */
  async getValidationLateDeductions(params: {
    organizationId: string;
    paygroupId?: string | null;
    employeeId?: string | null;
    fromDate: string;
    toDate: string;
  }): Promise<LateDeductionResult> {
    const { organizationId, paygroupId, employeeId, fromDate, toDate } = params;
    const from = new Date(fromDate + 'T00:00:00.000Z');
    const to = new Date(toDate + 'T23:59:59.999Z');

    const employeeWhere: Prisma.EmployeeWhereInput = {
      organizationId,
      deletedAt: null,
      employeeStatus: 'ACTIVE',
    };
    if (employeeId) {
      employeeWhere.id = employeeId;
    } else if (paygroupId) {
      employeeWhere.paygroupId = paygroupId;
    }

    const employees = await prisma.employee.findMany({
      where: employeeWhere,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeCode: true,
        paygroupId: true,
        departmentId: true,
        shiftId: true,
      },
    });
    if (!employees.length) return { employees: [], totals: { totalEmployees: 0, totalLateCount: 0, totalLateMinutes: 0 } };

    const empIds = employees.map((e) => e.id);

    const lateRecords = await prisma.attendanceRecord.findMany({
      where: {
        employeeId: { in: empIds },
        date: { gte: from, lte: to },
        isLate: true,
        checkOut: { not: null },
      },
      select: {
        employeeId: true,
        lateMinutes: true,
        date: true,
        validationAction: true,
      },
    });

    const byEmployee = new Map<string, { count: number; totalMinutes: number; permissionUsed: number }>();
    for (const rec of lateRecords) {
      const entry = byEmployee.get(rec.employeeId) ?? { count: 0, totalMinutes: 0, permissionUsed: 0 };
      entry.count += 1;
      entry.totalMinutes += rec.lateMinutes ?? 0;
      if (rec.validationAction && /permission/i.test(rec.validationAction)) {
        entry.permissionUsed += 1;
      }
      byEmployee.set(rec.employeeId, entry);
    }

    const ruleService = new ValidationProcessRuleService();

    const results: LateDeductionEmployee[] = [];
    let grandTotalCount = 0;
    let grandTotalMinutes = 0;

    for (const emp of employees) {
      const stats = byEmployee.get(emp.id);
      if (!stats || stats.count === 0) continue;

      grandTotalCount += stats.count;
      grandTotalMinutes += stats.totalMinutes;

      const rule = await ruleService.getApplicableRuleForLate({
        organizationId,
        employeeId: emp.id,
        paygroupId: emp.paygroupId ?? undefined,
        departmentId: emp.departmentId ?? undefined,
        shiftId: emp.shiftId ?? undefined,
        attendanceDate: to,
      });

      let deductionType = 'None';
      let deductionDays = 0;
      let actionName = '';
      let permissionExhausted = false;

      if (rule) {
        const matched = ruleService.getActionForLateMinutes(
          rule as Parameters<typeof ruleService.getActionForLateMinutes>[0],
          stats.totalMinutes,
        );

        if (matched) {
          actionName = matched.name;
          deductionType = matched.correctionMethod;
          deductionDays = this.computeDeductionDays(matched.daysValue, stats.totalMinutes);

          // Check Permission monthly limit
          if (matched.correctionMethod === 'Permission' && rule.hasLimit) {
            const limits = (rule.limits ?? []) as { periodicity: string; count: number | null; deductPriority: string | null }[];
            const monthly = limits.find((l) => l.periodicity === 'Monthly');
            if (monthly?.count != null && stats.permissionUsed >= monthly.count) {
              permissionExhausted = true;
              const fallbackName = monthly.deductPriority;
              const actions = [...(rule.actions ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
              const fallback = fallbackName
                ? actions.find((a) => a.name === fallbackName)
                : actions.find((a) => a.correctionMethod !== 'Permission' && a.correctionMethod !== 'LOP');

              if (fallback) {
                actionName = fallback.name;
                deductionType = fallback.correctionMethod;
                deductionDays = this.computeDeductionDays(fallback.daysValue, stats.totalMinutes);
              }
            }
          }
        }
      }

      const empName = [emp.firstName, emp.lastName].filter(Boolean).join(' ') || emp.employeeCode || emp.id;

      results.push({
        employeeId: emp.id,
        employeeCode: emp.employeeCode ?? '',
        employeeName: empName,
        lateCount: stats.count,
        totalLateMinutes: stats.totalMinutes,
        totalLateHours: +(stats.totalMinutes / 60).toFixed(2),
        actionName,
        deductionType,
        deductionDays,
        permissionExhausted,
      });
    }

    results.sort((a, b) => b.totalLateMinutes - a.totalLateMinutes);

    return {
      employees: results,
      totals: {
        totalEmployees: results.length,
        totalLateCount: grandTotalCount,
        totalLateMinutes: grandTotalMinutes,
      },
    };
  }

  /**
   * Apply validation correction (leave deduction) for selected employees based on rule.
   * Uses PER-MONTH TOTAL late minutes: groups by employee+month, sums late, applies ONE action per employee per month.
   * Rule actions: minMinutes/maxMinutes = monthly total ranges (e.g. 0-120 Permission, 120-240 Half day EL, 240+ Full day EL).
   */
  async applyValidationCorrection(params: {
    organizationId: string;
    ruleId?: string;
    directComponentId?: string;
    type?: 'late' | 'earlyGoing' | 'noOutPunch' | 'shortfall' | 'absent' | 'approvalPending' | 'overtime' | 'shiftChange';
    selectedRows: { employeeId: string; date: string }[];
    remarks?: string;
    approverUserId?: string;
    noCorrection?: boolean;
  }): Promise<{ applied: number; errors: { employeeId: string; date: string; message: string }[]; skipped?: { employeeId: string; date: string; message: string }[] }> {
    const { organizationId, ruleId, directComponentId, selectedRows, remarks, approverUserId } = params;

    // --- Direct component apply (EL, SL, LOP, WFH, Permission, etc.) ---
    if (directComponentId) {
      const { getLeaveTypeIdForAttendanceComponent } = await import('../utils/event-config');

      // Fetch full component details including hasBalance flag
      const component = await prisma.attendanceComponent.findUnique({
        where: { id: directComponentId },
        select: { id: true, eventName: true, shortName: true, eventCategory: true, hasBalance: true },
      });
      if (!component) {
        return { applied: 0, errors: [{ employeeId: '', date: '', message: 'Attendance component not found' }] };
      }

      const errors: { employeeId: string; date: string; message: string }[] = [];
      const skipped: { employeeId: string; date: string; message: string }[] = [];
      let applied = 0;

      const cat = (component.eventCategory ?? '').toLowerCase().trim();
      const isOnduty = cat === 'onduty' || cat === 'on duty';
      const isWFH = cat === 'wfh' ||
        (component.shortName ?? '').toUpperCase().includes('WFH') ||
        (component.eventName ?? '').toUpperCase().includes('WFH');

      // Determine attendance status to set
      const newAttendanceStatus = isOnduty || isWFH ? AttendanceStatus.PRESENT : AttendanceStatus.LEAVE;

      // Try to resolve a matching leave type for ALL categories (needed for leave request + balance)
      const leaveTypeId = await getLeaveTypeIdForAttendanceComponent(organizationId, component);
      const hasBalance = component.hasBalance ?? false;

      if (!leaveTypeId && (component.eventCategory ?? '').toLowerCase() === 'leave') {
        console.warn(`[DirectComponent] No matching LeaveType found for component "${component.eventName}" (${component.shortName}). Leave request will NOT be created. Check LeaveType names in DB.`);
      }

      // Group rows by employee
      const byEmployee = new Map<string, string[]>();
      for (const { employeeId, date } of selectedRows) {
        const arr = byEmployee.get(employeeId) ?? [];
        arr.push(date);
        byEmployee.set(employeeId, arr);
      }

      for (const [employeeId, dates] of byEmployee) {
        const sortedDates = [...dates].sort();
        const startDateStr = sortedDates[0];
        const endDateStr = sortedDates[sortedDates.length - 1];
        const totalDays = sortedDates.length;

        try {
          const startDateObj = new Date(startDateStr + 'T00:00:00.000Z');
          const endDateObj = new Date(endDateStr + 'T00:00:00.000Z');
          const componentLabel = component.eventName ?? component.shortName ?? 'Direct Correction';
          const reason = `[Direct correction - ${componentLabel}] ${remarks || ''}`.trim();

          // Create a leave request (APPROVED) whenever a matching leave type exists.
          // This covers EL, SL, LOP, CL, Permission, Onduty, WFH — any component
          // that maps to a leave type will get a proper leave record.
          if (leaveTypeId) {
            // For components with hasBalance=true (EL, SL, Comp Off etc.),
            // check available balance before applying. Throw error if insufficient.
            if (hasBalance) {
              const year = startDateObj.getUTCFullYear();
              const balanceCheck = await prisma.employeeLeaveBalance.findUnique({
                where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year } },
              });
              const availableDays = balanceCheck ? parseFloat(balanceCheck.available.toString()) : 0;
              if (availableDays < totalDays) {
                throw new AppError(
                  `Insufficient ${componentLabel} balance. Available: ${availableDays} day(s), Requested: ${totalDays} day(s).`,
                  400
                );
              }
            }

            await prisma.leaveRequest.create({
              data: {
                employee: { connect: { id: employeeId } },
                leaveType: { connect: { id: leaveTypeId } },
                startDate: startDateObj,
                endDate: endDateObj,
                totalDays: new Prisma.Decimal(totalDays),
                reason,
                status: 'APPROVED' as any,
                reviewedBy: approverUserId ?? null,
                reviewedAt: approverUserId ? new Date() : null,
                reviewComments: 'Auto-approved by validation correction',
              },
            });

            // Always update used count for the leave balance record.
            // For hasBalance=true (EL, SL, CL...) → also deduct from available.
            // For hasBalance=false (LOP, Permission...) → only increment used (no available deduction).
            const year = startDateObj.getUTCFullYear();
            const balance = await prisma.employeeLeaveBalance.findUnique({
              where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year } },
            });
            if (balance) {
              const usedDays = parseFloat(balance.used.toString()) + totalDays;
              const updateData: Record<string, unknown> = {
                used: new Prisma.Decimal(usedDays),
              };
              if (hasBalance) {
                const availableDays = parseFloat(balance.available.toString()) - totalDays;
                updateData.available = new Prisma.Decimal(Math.max(0, availableDays));
              }
              await prisma.employeeLeaveBalance.update({
                where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year } },
                data: updateData,
              });
            } else {
              // No balance record yet — create one with just used count (for LOP etc.)
              await prisma.employeeLeaveBalance.create({
                data: {
                  employeeId,
                  leaveTypeId,
                  year,
                  openingBalance: new Prisma.Decimal(0),
                  accrued: new Prisma.Decimal(0),
                  used: new Prisma.Decimal(totalDays),
                  available: new Prisma.Decimal(0),
                  carriedForward: new Prisma.Decimal(0),
                },
              });
            }
          }

          // Upsert attendance record status and validation result for each selected date
          for (const dateStr of sortedDates) {
            const dayDate = new Date(dateStr + 'T00:00:00.000Z');

            // Check if an attendance record already exists
            const existingRecord = await prisma.attendanceRecord.findFirst({
              where: { employeeId, date: dayDate },
              select: { id: true },
            });

            if (existingRecord) {
              await prisma.attendanceRecord.updateMany({
                where: { employeeId, date: dayDate },
                data: {
                  status: newAttendanceStatus,
                  validationAction: componentLabel,
                  validationMethod: 'DIRECT_COMPONENT',
                  ...(isWFH ? { notes: `WFH${remarks ? ': ' + remarks : ''}` } : {}),
                },
              });
            } else {
              // No attendance record exists (absent day - no punch) → create one
              await prisma.attendanceRecord.create({
                data: {
                  employeeId,
                  date: dayDate,
                  status: newAttendanceStatus,
                  validationAction: componentLabel,
                  validationMethod: 'DIRECT_COMPONENT',
                  ...(isWFH ? { notes: `WFH${remarks ? ': ' + remarks : ''}` } : {}),
                },
              });
            }

            // Upsert validation result
            const existingValidation = await prisma.attendanceValidationResult.findFirst({
              where: { organizationId, employeeId, date: dayDate },
              select: { id: true },
            });

            if (existingValidation) {
              await prisma.attendanceValidationResult.updateMany({
                where: { organizationId, employeeId, date: dayDate },
                data: {
                  isCompleted: true,
                  isLate: false,
                  isEarlyGoing: false,
                  isNoOutPunch: false,
                  isShortfall: false,
                  isAbsent: false,
                },
              });
            } else {
              await prisma.attendanceValidationResult.create({
                data: {
                  organizationId,
                  employeeId,
                  date: dayDate,
                  isCompleted: true,
                  isLate: false,
                  isEarlyGoing: false,
                  isNoOutPunch: false,
                  isShortfall: false,
                  isAbsent: false,
                  isApprovalPending: false,
                  isShiftChange: false,
                  isOvertime: false,
                },
              });
            }
          }

          applied++;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          errors.push({ employeeId, date: sortedDates[0] ?? '', message: msg });
        }
      }

      // Auto-rebuild attendance summaries for affected employees/months
      const rebuiltSet = new Set<string>();
      for (const row of selectedRows) {
        const key = `${row.employeeId}-${new Date(row.date).getUTCFullYear()}-${new Date(row.date).getUTCMonth() + 1}`;
        if (!rebuiltSet.has(key)) {
          rebuiltSet.add(key);
          await monthlyAttendanceSummaryService.tryRebuildSummaryForDate(
            organizationId,
            row.employeeId,
            new Date(row.date)
          );
        }
      }

      return { applied, errors, skipped };
    }
    // --- End direct component apply ---
    const correctionType = params.type || 'late';
    const isNoOutPunchCorrection = correctionType === 'noOutPunch';
    const isShortfallCorrection = correctionType === 'shortfall';
    const isEarlyGoingCorrection = correctionType === 'earlyGoing' || isNoOutPunchCorrection;
    const isFinalNoCorrectionStage =
      correctionType === 'earlyGoing' || correctionType === 'late' || correctionType === 'shortfall';

    const validationGroupingMap: Record<string, string> = {
      late: 'Late',
      earlyGoing: 'Early Going',
      noOutPunch: 'No Out Punch',
      shortfall: 'Shortfall',
      absent: 'Absent',
      approvalPending: 'Approval Pending',
      overtime: 'OverTime',
      shiftChange: 'Shift Change',
    };
    const typeLabelMap: Record<string, string> = {
      late: 'Late',
      earlyGoing: 'Early Going',
      noOutPunch: 'No Out Punch',
      shortfall: 'Shortfall',
      absent: 'Absent',
      approvalPending: 'Approval Pending',
      overtime: 'OverTime',
      shiftChange: 'Shift Change',
    };
    const validationGrouping = validationGroupingMap[correctionType] ?? 'Late';
    const typeLabel = typeLabelMap[correctionType] ?? 'Late';
    const errors: { employeeId: string; date: string; message: string }[] = [];
    const skipped: { employeeId: string; date: string; message: string }[] = [];
    let applied = 0;
    const completedValidationUpdate: Prisma.AttendanceValidationResultUpdateManyMutationInput = {
      isCompleted: true,
      isLate: false,
      isEarlyGoing: false,
      isNoOutPunch: false,
      isShortfall: false,
    };

    const { getLeaveTypeIdForAttendanceComponent } = await import('../utils/event-config');

    // Group by (employeeId, year-month)
    const byEmployeeMonth = new Map<string, { employeeId: string; dates: string[] }>();
    for (const { employeeId, date } of selectedRows) {
      const [y, m] = date.split('-');
      const key = `${employeeId}:${y}-${m}`;
      const entry = byEmployeeMonth.get(key) ?? { employeeId, dates: [] };
      if (!entry.dates.includes(date)) entry.dates.push(date);
      byEmployeeMonth.set(key, entry);
    }
    for (const entry of byEmployeeMonth.values()) {
      entry.dates.sort();
    }

    for (const [key, { employeeId, dates }] of byEmployeeMonth) {
      const [y, m] = key.split(':')[1].split('-');
      const monthStart = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
      const firstDate = dates[0];

      try {
        const selectedDateKeys = new Set(dates);
        const sortedDates = [...dates].sort();
        const rangeFrom = new Date((sortedDates[0] ?? firstDate) + 'T00:00:00.000Z');
        const rangeTo = new Date((sortedDates[sortedDates.length - 1] ?? firstDate) + 'T23:59:59.999Z');
        const candidateRecords = await prisma.attendanceRecord.findMany({
          where: {
            employeeId,
            date: { gte: rangeFrom, lte: rangeTo },
          },
          select: {
            id: true,
            date: true,
            lateMinutes: true,
            earlyMinutes: true,
            isLate: true,
            isEarly: true,
            isDeviation: true,
            checkIn: true,
            checkOut: true,
            shift: { select: { startTime: true } },
          },
        });
        let records = candidateRecords.filter((r) => {
          const recDateKey = this.toDateKey(r.date);
          if (!selectedDateKeys.has(recDateKey)) return false;
          const hasSinglePunch = !!r.checkIn && !r.checkOut;
          if (isNoOutPunchCorrection) return hasSinglePunch;
          if (isShortfallCorrection) return r.isDeviation === true || !!r.checkIn;
          if (isEarlyGoingCorrection) return r.isEarly === true || (r.earlyMinutes != null && r.earlyMinutes > 0) || hasSinglePunch;
          return r.isLate === true || hasSinglePunch;
        });
        console.log(`[AsPerRule] emp=${employeeId} type=${correctionType} dates=${dates.join(',')} candidates=${candidateRecords.length} filtered=${records.length}`);
        if (candidateRecords.length > 0) {
          const c = candidateRecords[0];
          console.log(`[AsPerRule] first candidate: isEarly=${c.isEarly} earlyMinutes=${c.earlyMinutes} checkIn=${!!c.checkIn} checkOut=${!!c.checkOut}`);
        }

        // Punch-only days can appear in validation rows without an attendance_record row.
        // For No Out Punch correction, materialize minimal day records from attendance_punches.
        if (isNoOutPunchCorrection && records.length === 0) {
          const noOutRows = await prisma.attendanceValidationResult.findMany({
            where: {
              organizationId,
              employeeId,
              date: { gte: rangeFrom, lte: rangeTo },
              isNoOutPunch: true,
            },
            select: { date: true },
          });
          const noOutDateKeys = new Set(noOutRows.map((r) => this.toDateKey(r.date)));
          if (noOutDateKeys.size > 0) {
            const punchesInRange = await prisma.attendancePunch.findMany({
              where: {
                employeeId,
                punchTime: { gte: rangeFrom, lte: rangeTo },
              },
              select: { punchTime: true, status: true },
              orderBy: { punchTime: 'asc' },
            });
            const employeeMeta = await prisma.employee.findUnique({
              where: { id: employeeId },
              select: { shiftId: true },
            });
            const punchByDate = new Map<string, { checkIn: Date | null; checkOut: Date | null }>();
            for (const p of punchesInRange) {
              const dateKey = this.toDateKey(p.punchTime);
              if (!selectedDateKeys.has(dateKey) || !noOutDateKeys.has(dateKey)) continue;
              const current = punchByDate.get(dateKey) ?? { checkIn: null, checkOut: null };
              const normalizedStatus = String(p.status ?? '').trim().toUpperCase();
              const isInStatus =
                normalizedStatus === 'IN' || normalizedStatus === '0' || normalizedStatus === 'CHECKIN';
              const isOutStatus =
                normalizedStatus === 'OUT' || normalizedStatus === '1' || normalizedStatus === 'CHECKOUT';
              if (isInStatus && !current.checkIn) current.checkIn = new Date(p.punchTime);
              if (isOutStatus) current.checkOut = new Date(p.punchTime);
              if (!isInStatus && !isOutStatus && !current.checkIn) {
                current.checkIn = new Date(p.punchTime);
              }
              punchByDate.set(dateKey, current);
            }

            for (const dateKey of sortedDates) {
              if (!selectedDateKeys.has(dateKey) || !noOutDateKeys.has(dateKey)) continue;
              const dayPunch = punchByDate.get(dateKey);
              if (!dayPunch?.checkIn && !dayPunch?.checkOut) continue;
              const dayDate = new Date(dateKey + 'T00:00:00.000Z');
              await prisma.attendanceRecord.upsert({
                where: { employeeId_date: { employeeId, date: dayDate } },
                create: {
                  employeeId,
                  shiftId: employeeMeta?.shiftId ?? null,
                  date: dayDate,
                  status: AttendanceStatus.PRESENT,
                  checkIn: dayPunch?.checkIn ?? null,
                  checkOut: dayPunch?.checkOut ?? null,
                  checkInMethod: CheckInMethod.MANUAL,
                  isDeviation: true,
                },
                update: {
                  shiftId: employeeMeta?.shiftId ?? null,
                  status: AttendanceStatus.PRESENT,
                  checkIn: dayPunch?.checkIn ?? null,
                  checkOut: dayPunch?.checkOut ?? null,
                  checkInMethod: CheckInMethod.MANUAL,
                  isDeviation: true,
                },
              });
            }

            const refreshed = await prisma.attendanceRecord.findMany({
              where: {
                employeeId,
                date: { gte: rangeFrom, lte: rangeTo },
              },
              select: {
                id: true,
                date: true,
                lateMinutes: true,
                earlyMinutes: true,
                isLate: true,
                isEarly: true,
                isDeviation: true,
                checkIn: true,
                checkOut: true,
                shift: { select: { startTime: true } },
              },
            });
            records = refreshed.filter((r) => {
              const recDateKey = this.toDateKey(r.date);
              if (!selectedDateKeys.has(recDateKey)) return false;
              const hasSinglePunch = !!r.checkIn && !r.checkOut;
              return hasSinglePunch;
            });
          }
        }

        const totalMinutes = records.reduce((sum, r) => {
          let mins: number | null | undefined;
          if (isEarlyGoingCorrection) mins = r.earlyMinutes;
          else if (isShortfallCorrection) mins = (r as any).shortfallMinutes ?? r.lateMinutes;
          else mins = r.lateMinutes;
          return sum + (mins ? Number(mins) : 0);
        }, 0);
        // Some single-punch/edge rows can legitimately have 0 stored minutes.
        // Keep a minimum of 1 minute so No Correction / rule resolution can still proceed.
        const effectiveTotalMinutes = totalMinutes > 0 ? totalMinutes : 1;
        if (records.length === 0) {
          // Absent employees have no attendance records by definition.
          // "No Correction" just marks completed with no leave deduction.
          // "As Per Rule" / direct component must fall through to rule lookup below.
          if (correctionType === 'absent' && params.noCorrection) {
            for (const dateKey of dates) {
              await prisma.attendanceValidationResult.updateMany({
                where: {
                  organizationId,
                  employeeId,
                  date: new Date(dateKey + 'T00:00:00.000Z'),
                },
                data: { isCompleted: true, isAbsent: false },
              });
            }
            applied++;
            continue;
          }
          if (correctionType !== 'absent') {
            errors.push({ employeeId, date: firstDate, message: `No ${typeLabel.toLowerCase()} records found for selected dates` });
            continue;
          }
          // absent + As Per Rule: fall through to rule lookup below
        }

        // For No Out Punch, business rule is "No Correction" completion.
        // Do not run permission/leave deduction paths for this type.
        if (isNoOutPunchCorrection) {
          for (const rec of records) {
            const checkInDate = rec.checkIn ? new Date(rec.checkIn) : null;
            const shiftStartText = rec.shift?.startTime ? String(rec.shift.startTime) : null;

            let classifyAsLate = false;
            if (checkInDate && shiftStartText) {
              const [startH, startM] = shiftStartText.split(':').map(Number);
              const shiftStart = new Date(
                checkInDate.getFullYear(),
                checkInDate.getMonth(),
                checkInDate.getDate(),
                startH || 0,
                startM || 0,
                0,
                0
              );
              // Business rule:
              // - single punch at/after shift start => Late 9h
              // - single punch before/at shift start => Early Going 9h
              classifyAsLate = checkInDate.getTime() > shiftStart.getTime();
            }

            await prisma.attendanceRecord.update({
              where: { id: rec.id },
              data: {
                validationAction: 'No Correction',
                validationMethod: 'NO_CORRECTION',
                isLate: classifyAsLate,
                lateMinutes: classifyAsLate ? 540 : null,
                isEarly: !classifyAsLate,
                earlyMinutes: classifyAsLate ? null : 540,
                isDeviation: true,
              },
            });
            await prisma.attendanceValidationResult.updateMany({
              where: {
                organizationId,
                employeeId,
                date: new Date(this.toDateKey(rec.date) + 'T00:00:00.000Z'),
              },
              data: {
                isCompleted: false,
                isLate: classifyAsLate,
                isEarlyGoing: !classifyAsLate,
                isNoOutPunch: false,
                isShortfall: true,
              },
            });
          }
          applied++;
          continue;
        }

        let rule: Awaited<ReturnType<ValidationProcessRuleService['getApplicableRule']>>;
        if (ruleId) {
          const r = await prisma.validationProcessRule.findUnique({
            where: { id: ruleId, organizationId },
            include: { limits: true, actions: true },
          });
          rule = r;
        } else {
          const emp = await prisma.employee.findUnique({
            where: { id: employeeId },
            select: { paygroupId: true, departmentId: true, shiftId: true },
          });
          const ruleParams = {
            organizationId,
            employeeId,
            paygroupId: emp?.paygroupId ?? undefined,
            departmentId: emp?.departmentId ?? undefined,
            shiftId: emp?.shiftId ?? undefined,
            attendanceDate: monthStart,
          };
          // When user explicitly chose "As Per Rule" (noCorrection=false/undefined), skip "No Correction" named rules
          const excludeNoCorrectionRules = !params.noCorrection;
          rule = await validationProcessRuleService.getApplicableRule({
            ...ruleParams,
            validationGrouping,
            excludeNoCorrectionRules,
          });
          if (!rule && validationGrouping !== 'Late') {
            rule = await validationProcessRuleService.getApplicableRule({
              ...ruleParams,
              validationGrouping: 'Late',
              excludeNoCorrectionRules,
            });
          }
        }

        if (!rule) {
          errors.push({ employeeId, date: firstDate, message: `No applicable ${typeLabel.toLowerCase()} validation rule found` });
          continue;
        }

        const normalizedRuleName = String((rule as any)?.displayName ?? '').trim().toLowerCase();
        const forceNoCorrectionByRuleName =
          normalizedRuleName === 'no correction' ||
          normalizedRuleName === 'no_correction' ||
          normalizedRuleName === 'nocorrection';
        if (forceNoCorrectionByRuleName) {
          if (records.length > 0) {
            for (const rec of records) {
              await prisma.attendanceRecord.update({
                where: { id: rec.id },
                data: {
                  validationAction: 'No Correction',
                  validationMethod: isFinalNoCorrectionStage ? 'NO_CORRECTION_FINAL' : 'NO_CORRECTION',
                },
              });
              await prisma.attendanceValidationResult.updateMany({
                where: {
                  organizationId,
                  employeeId,
                  date: new Date(this.toDateKey(rec.date) + 'T00:00:00.000Z'),
                },
                data: completedValidationUpdate,
              });
            }
          } else {
            // Absent employees — no AttendanceRecord exists, just mark ValidationResult completed
            for (const dateKey of dates) {
              await prisma.attendanceValidationResult.updateMany({
                where: {
                  organizationId,
                  employeeId,
                  date: new Date(dateKey + 'T00:00:00.000Z'),
                },
                data: completedValidationUpdate,
              });
            }
          }
          applied++;
          continue;
        }

        const noCorrectionAction = (rule?.actions ?? []).find(
          (a: any) =>
            a?.correctionMethod === 'No Correction' ||
            a?.correctionMethod === 'NoCorrection' ||
            a?.correctionMethod === 'NO_CORRECTION'
        );
        const action =
          isNoOutPunchCorrection && noCorrectionAction
            ? noCorrectionAction
            : validationProcessRuleService.getActionForLateMinutes(rule as any, effectiveTotalMinutes);
        if (!action) {
          errors.push({ employeeId, date: firstDate, message: 'No action defined for this rule' });
          continue;
        }

        console.log(`[AsPerRule] action=${action.name} method=${action.correctionMethod} daysValue=${action.daysValue} effectiveMins=${effectiveTotalMinutes}`);
        const totalDays = this.computeDeductionDays(action.daysValue, effectiveTotalMinutes);
        const isNoCorrectionMethod =
          action.correctionMethod === 'No Correction' ||
          action.correctionMethod === 'NoCorrection' ||
          action.correctionMethod === 'NO_CORRECTION';
        if (!isNoCorrectionMethod && totalDays <= 0) {
          errors.push({ employeeId, date: firstDate, message: 'Deduction days is 0 for this action' });
          continue;
        }

        const minuteField = isEarlyGoingCorrection ? 'earlyMinutes' : 'lateMinutes';
        const dateDetails = records
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
          .map((r) => {
            const d = new Date(r.date);
            const dd = String(d.getUTCDate()).padStart(2, '0');
            const mmm = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
            return `${dd}-${mmm}(${(r as any)[minuteField] ?? 0}min)`;
          })
          .join(', ');
        const totalH = Math.floor(effectiveTotalMinutes / 60);
        const totalM = String(effectiveTotalMinutes % 60).padStart(2, '0');
        const reason = `[Validation correction - ${typeLabel}] ${records.length} days ${typeLabel.toLowerCase()}: ${dateDetails}. Total: ${totalH}h ${totalM}m. Action: ${action.name} (${totalDays} day${totalDays !== 1 ? 's' : ''}). ${remarks || ''}`.trim();

        if (action.correctionMethod === 'Permission') {
          const permLeaveType = await prisma.leaveType.findFirst({
            where: {
              organizationId,
              isActive: true,
              OR: [
                { name: { contains: 'Permission', mode: 'insensitive' } },
                { code: { equals: 'PERM', mode: 'insensitive' } },
              ],
            },
          });
          if (!permLeaveType) {
            errors.push({ employeeId, date: firstDate, message: 'Permission leave type not configured' });
            continue;
          }
          const durH = Math.floor(totalMinutes / 60);
          const durM = String(totalMinutes % 60).padStart(2, '0');
          const permReason = `[${typeLabel}-correction ${durH}h${durM}m permission] ${reason}`;

          // Create permission leave request directly (bypass leaveRequestService.create which blocks
          // creation when validation results exist for the date — which is always true from VP page).
          const permFirstDateObj = new Date(firstDate + 'T00:00:00.000Z');
          const permTotalDays = Math.min(totalDays, 1);
          await prisma.leaveRequest.create({
            data: {
              employee: { connect: { id: employeeId } },
              leaveType: { connect: { id: permLeaveType.id } },
              startDate: permFirstDateObj,
              endDate: permFirstDateObj,
              totalDays: new Prisma.Decimal(permTotalDays),
              reason: permReason,
              status: 'APPROVED' as any,
              reviewedBy: approverUserId ?? null,
              reviewedAt: approverUserId ? new Date() : null,
              reviewComments: 'Auto-approved by validation correction (As Per Rule - Permission)',
            },
          });
          const permissionApplied = true;

          if (permissionApplied) {
            for (const rec of records) {
              await prisma.attendanceRecord.update({
                where: { id: rec.id },
                data: { validationAction: action.name, validationMethod: 'AS_PER_RULE' },
              });
              await prisma.attendanceValidationResult.updateMany({
                where: {
                  organizationId,
                  employeeId,
                  date: new Date(this.toDateKey(rec.date) + 'T00:00:00.000Z'),
                },
                data: completedValidationUpdate,
              });
            }
            applied++;
          }
        } else if (action.correctionMethod === 'Apply Event' || action.correctionMethod === 'Leave') {
          if (!action.attendanceComponentId) {
            errors.push({ employeeId, date: firstDate, message: 'Leave/Apply Event action has no attendance component configured in rule' });
            continue;
          }
          const compId = String(action.attendanceComponentId);
          const comp = await prisma.attendanceComponent.findUnique({
            where: { id: compId },
            select: { eventName: true, shortName: true, hasBalance: true },
          });
          const leaveTypeId = comp
            ? await getLeaveTypeIdForAttendanceComponent(organizationId, comp)
            : null;
          if (!leaveTypeId) {
            errors.push({ employeeId, date: firstDate, message: 'Leave type not linked to attendance component' });
            continue;
          }
          const ruleLeaveHasBalance = comp?.hasBalance ?? false;
          console.log(`[AsPerRule-Leave] compId=${compId} eventName=${comp?.eventName} leaveTypeId=${leaveTypeId} hasBalance=${ruleLeaveHasBalance}`);
          const firstDateObj = new Date(firstDate + 'T00:00:00.000Z');
          const leaveYear = firstDateObj.getUTCFullYear();
          // Check balance when hasBalance=true
          if (ruleLeaveHasBalance) {
            const balChk = await prisma.employeeLeaveBalance.findUnique({
              where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year: leaveYear } },
            });
            const avail = balChk ? parseFloat(balChk.available.toString()) : 0;
            if (avail < totalDays) {
              errors.push({ employeeId, date: firstDate, message: `Insufficient leave balance. Available: ${avail}, Requested: ${totalDays}` });
              continue;
            }
          }
          // Create leave directly with APPROVED status — bypasses leaveRequestService.create()
          // which blocks creation when validation results already exist for the date.
          console.log(`[AsPerRule-Leave] creating leaveRequest totalDays=${totalDays} leaveYear=${leaveYear} leaveTypeId=${leaveTypeId}`);
          await prisma.leaveRequest.create({
            data: {
              employee: { connect: { id: employeeId } },
              leaveType: { connect: { id: leaveTypeId } },
              startDate: firstDateObj,
              endDate: firstDateObj,
              totalDays: new Prisma.Decimal(totalDays),
              reason,
              status: 'APPROVED' as any,
              reviewedBy: approverUserId ?? null,
              reviewedAt: approverUserId ? new Date() : null,
              reviewComments: 'Auto-approved by validation correction (As Per Rule)',
            },
          });
          console.log(`[AsPerRule-Leave] leaveRequest created OK`);
          // Update leave balance
          const ruleBal = await prisma.employeeLeaveBalance.findUnique({
            where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year: leaveYear } },
          });
          console.log(`[AsPerRule-Leave] ruleBal=${ruleBal ? `used=${ruleBal.used} available=${ruleBal.available}` : 'NULL'}`);
          if (ruleBal) {
            const newUsed = parseFloat(ruleBal.used.toString()) + totalDays;
            const newAvail = Math.max(0, parseFloat(ruleBal.available.toString()) - totalDays);
            await prisma.employeeLeaveBalance.update({
              where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year: leaveYear } },
              data: {
                used: new Prisma.Decimal(newUsed),
                available: new Prisma.Decimal(newAvail),
              },
            });
          } else {
            await prisma.employeeLeaveBalance.create({
              data: {
                employeeId, leaveTypeId, year: leaveYear,
                openingBalance: new Prisma.Decimal(0),
                accrued: new Prisma.Decimal(0),
                used: new Prisma.Decimal(totalDays),
                available: new Prisma.Decimal(0),
                carriedForward: new Prisma.Decimal(0),
              },
            });
          }
          console.log(`[AsPerRule-Leave] balance update done`);
          if (records.length > 0) {
            for (const rec of records) {
              await prisma.attendanceRecord.update({
                where: { id: rec.id },
                data: { validationAction: action.name, validationMethod: 'AS_PER_RULE' },
              });
              await prisma.attendanceValidationResult.updateMany({
                where: {
                  organizationId,
                  employeeId,
                  date: new Date(this.toDateKey(rec.date) + 'T00:00:00.000Z'),
                },
                data: completedValidationUpdate,
              });
            }
          } else {
            // Absent employees: no AttendanceRecord exists.
            // Create one as LEAVE so the day is properly recorded and corrections survive re-runs.
            for (const dateKey of dates) {
              const dayDate = new Date(dateKey + 'T00:00:00.000Z');
              await prisma.attendanceRecord.upsert({
                where: { employeeId_date: { employeeId, date: dayDate } },
                create: {
                  employeeId,
                  date: dayDate,
                  status: AttendanceStatus.LEAVE,
                  checkIn: null,
                  checkOut: null,
                  checkInMethod: CheckInMethod.MANUAL,
                  validationAction: action.name,
                  validationMethod: 'AS_PER_RULE',
                },
                update: {
                  status: AttendanceStatus.LEAVE,
                  validationAction: action.name,
                  validationMethod: 'AS_PER_RULE',
                },
              });
              await prisma.attendanceValidationResult.updateMany({
                where: { organizationId, employeeId, date: dayDate },
                data: completedValidationUpdate,
              });
            }
          }
          applied++;
        } else if (action.correctionMethod === 'LOP') {
          const lopLeaveType = await prisma.leaveType.findFirst({
            where: {
              organizationId,
              isActive: true,
              OR: [
                { name: { contains: 'LOP', mode: 'insensitive' } },
                { name: { contains: 'Loss of Pay', mode: 'insensitive' } },
                { code: { equals: 'LOP', mode: 'insensitive' } },
              ],
            },
          });
          if (!lopLeaveType) {
            errors.push({ employeeId, date: firstDate, message: 'LOP leave type not configured' });
            continue;
          }
          // LOP has hasBalance=false — no balance check, just increment used
          const lopFirstDateObj = new Date(firstDate + 'T00:00:00.000Z');
          const lopYear = lopFirstDateObj.getUTCFullYear();
          await prisma.leaveRequest.create({
            data: {
              employee: { connect: { id: employeeId } },
              leaveType: { connect: { id: lopLeaveType.id } },
              startDate: lopFirstDateObj,
              endDate: lopFirstDateObj,
              totalDays: new Prisma.Decimal(totalDays),
              reason,
              status: 'APPROVED' as any,
              reviewedBy: approverUserId ?? null,
              reviewedAt: approverUserId ? new Date() : null,
              reviewComments: 'Auto-approved by validation correction (As Per Rule - LOP)',
            },
          });
          const lopBal = await prisma.employeeLeaveBalance.findUnique({
            where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId: lopLeaveType.id, year: lopYear } },
          });
          if (lopBal) {
            await prisma.employeeLeaveBalance.update({
              where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId: lopLeaveType.id, year: lopYear } },
              data: { used: new Prisma.Decimal(parseFloat(lopBal.used.toString()) + totalDays) },
            });
          } else {
            await prisma.employeeLeaveBalance.create({
              data: {
                employeeId, leaveTypeId: lopLeaveType.id, year: lopYear,
                openingBalance: new Prisma.Decimal(0),
                accrued: new Prisma.Decimal(0),
                used: new Prisma.Decimal(totalDays),
                available: new Prisma.Decimal(0),
                carriedForward: new Prisma.Decimal(0),
              },
            });
          }
          for (const rec of records) {
            await prisma.attendanceRecord.update({
              where: { id: rec.id },
              data: { validationAction: action.name },
            });
            await prisma.attendanceValidationResult.updateMany({
              where: {
                organizationId,
                employeeId,
                date: new Date(this.toDateKey(rec.date) + 'T00:00:00.000Z'),
              },
              data: completedValidationUpdate,
            });
          }
          applied++;
        } else if (
          action.correctionMethod === 'No Correction' ||
          action.correctionMethod === 'NoCorrection' ||
          action.correctionMethod === 'NO_CORRECTION'
        ) {
          // Explicitly mark as handled without leave/permission deduction.
          for (const rec of records) {
            await prisma.attendanceRecord.update({
              where: { id: rec.id },
              data: {
                validationAction: action.name,
                validationMethod: isFinalNoCorrectionStage ? 'NO_CORRECTION_FINAL' : 'NO_CORRECTION',
              },
            });
            await prisma.attendanceValidationResult.updateMany({
              where: {
                organizationId,
                employeeId,
                date: new Date(this.toDateKey(rec.date) + 'T00:00:00.000Z'),
              },
              data: completedValidationUpdate,
            });
          }
          applied++;
        } else {
          errors.push({ employeeId, date: firstDate, message: `Unsupported correction method: ${action.correctionMethod}` });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        if (/already have.*(approved|pending) leave request|overlap|conflicting/i.test(msg)) {
          skipped.push({ employeeId, date: firstDate, message: 'Already applied for this month' });
        } else {
          errors.push({ employeeId, date: firstDate, message: msg });
        }
      }
    }

    // Auto-rebuild attendance summaries for affected employees/months
    const rebuiltSetRule = new Set<string>();
    for (const row of selectedRows) {
      const key = `${row.employeeId}-${new Date(row.date).getUTCFullYear()}-${new Date(row.date).getUTCMonth() + 1}`;
      if (!rebuiltSetRule.has(key)) {
        rebuiltSetRule.add(key);
        await monthlyAttendanceSummaryService.tryRebuildSummaryForDate(
          organizationId,
          row.employeeId,
          new Date(row.date)
        );
      }
    }

    return { applied, errors, skipped: skipped.length > 0 ? skipped : undefined };
  }

  /**
   * Revert validation correction for selected employees and date range.
   * Only reverts HR-created corrections (validationMethod = DIRECT_COMPONENT / NO_CORRECTION / NO_CORRECTION_FINAL).
   * Employee-applied leaves are never touched.
   * Records the action in validation_revert_history for audit.
   */
  async revertValidationCorrection(params: {
    organizationId: string;
    paygroupId?: string | null;
    employeeId?: string | null;
    fromDate: string;
    toDate: string;
    remarks?: string;
    revertedByUserId?: string;
  }): Promise<{
    reverted: number;
    leaveRequestsDeleted: number;
    balancesRestored: number;
    errors: { employeeId: string; date: string; message: string }[];
  }> {
    const { organizationId, paygroupId, employeeId, fromDate, toDate, remarks, revertedByUserId } = params;
    const from = new Date(fromDate + 'T00:00:00.000Z');
    const to = new Date(toDate + 'T23:59:59.999Z');

    // Resolve which employees to revert
    const employeeWhere: Prisma.EmployeeWhereInput = { organizationId, deletedAt: null };
    if (employeeId) {
      employeeWhere.id = employeeId;
    } else if (paygroupId) {
      employeeWhere.paygroupId = paygroupId;
    }
    const employees = await prisma.employee.findMany({ where: employeeWhere, select: { id: true } });
    const employeeIds = employees.map((e) => e.id);
    if (employeeIds.length === 0) return { reverted: 0, leaveRequestsDeleted: 0, balancesRestored: 0, errors: [] };

    // Find validation records that were HR-corrected (have a validationMethod set by HR)
    const hrCorrectionMethods = ['DIRECT_COMPONENT', 'NO_CORRECTION', 'NO_CORRECTION_FINAL', 'AS_PER_RULE'];
    const correctedRecords = await prisma.attendanceRecord.findMany({
      where: {
        employeeId: { in: employeeIds },
        date: { gte: from, lte: to },
        validationMethod: { in: hrCorrectionMethods },
      },
      select: { id: true, employeeId: true, date: true, validationAction: true, validationMethod: true, status: true },
    });

    if (correctedRecords.length === 0) {
      return { reverted: 0, leaveRequestsDeleted: 0, balancesRestored: 0, errors: [] };
    }

    const errors: { employeeId: string; date: string; message: string }[] = [];
    let reverted = 0;
    let leaveRequestsDeleted = 0;
    let balancesRestored = 0;

    // Group corrected records by employee
    const byEmployee = new Map<string, typeof correctedRecords>();
    for (const rec of correctedRecords) {
      const arr = byEmployee.get(rec.employeeId) ?? [];
      arr.push(rec);
      byEmployee.set(rec.employeeId, arr);
    }

    for (const [empId, recs] of byEmployee) {
      try {
        // Find HR-created leave requests for this employee in the date range
        // Identified by: reviewComments = 'Auto-approved by validation correction'
        // OR reason starts with '[Direct correction' or '[Validation correction'
        const hrLeaveRequests = await prisma.leaveRequest.findMany({
          where: {
            employeeId: empId,
            startDate: { lte: to },
            endDate: { gte: from },
            OR: [
              { reviewComments: 'Auto-approved by validation correction' },
              { reason: { startsWith: '[Direct correction' } },
              { reason: { startsWith: '[Validation correction' } },
            ],
          },
          select: {
            id: true,
            leaveTypeId: true,
            totalDays: true,
            startDate: true,
            endDate: true,
          },
        });

        await prisma.$transaction(async (tx) => {
          // 1. Clear validationAction and validationMethod on attendance records
          for (const rec of recs) {
            await tx.attendanceRecord.update({
              where: { id: rec.id },
              data: {
                validationAction: null,
                validationMethod: null,
              },
            });
          }

          // 2. Delete HR-created leave requests and restore balances
          for (const lr of hrLeaveRequests) {
            const days = parseFloat(lr.totalDays.toString());
            const year = new Date(lr.startDate).getUTCFullYear();

            // Restore leave balance
            const balance = await tx.employeeLeaveBalance.findUnique({
              where: { employeeId_leaveTypeId_year: { employeeId: empId, leaveTypeId: lr.leaveTypeId, year } },
            });
            if (balance) {
              const usedNow = parseFloat(balance.used.toString());
              const restoredUsed = Math.max(0, usedNow - days);
              const availableNow = parseFloat(balance.available.toString());
              const hasPositiveOpening = parseFloat(balance.openingBalance.toString()) > 0 || parseFloat(balance.accrued.toString()) > 0;
              const updateData: Record<string, unknown> = {
                used: new Prisma.Decimal(restoredUsed),
              };
              if (hasPositiveOpening) {
                updateData.available = new Prisma.Decimal(availableNow + days);
              }
              await tx.employeeLeaveBalance.update({
                where: { employeeId_leaveTypeId_year: { employeeId: empId, leaveTypeId: lr.leaveTypeId, year } },
                data: updateData,
              });
              balancesRestored++;
            }

            // Delete the leave request
            await tx.leaveRequest.delete({ where: { id: lr.id } });
            leaveRequestsDeleted++;
          }

          // 3. Reset validation results: isCompleted=false, restore anomaly flags by re-running mini-check
          const dateKeys = recs.map((r) => this.toDateKey(r.date));
          for (const dateKey of dateKeys) {
            const dayDate = new Date(dateKey + 'T00:00:00.000Z');
            await tx.attendanceValidationResult.updateMany({
              where: { organizationId, employeeId: empId, date: dayDate },
              data: { isCompleted: false },
            });
          }
        });

        reverted += recs.length;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        errors.push({ employeeId: empId, date: fromDate, message: msg });
      }
    }

    // 4. Save revert history record
    const uniqueDays = new Set(correctedRecords.map((r) => this.toDateKey(r.date)));
    const uniqueEmployees = new Set(correctedRecords.map((r) => r.employeeId));
    try {
      await prisma.validationRevertHistory.create({
        data: {
          organizationId,
          revertedByUserId: revertedByUserId ?? '',
          fromDate: from,
          toDate: to,
          employeeCount: uniqueEmployees.size,
          dayCount: uniqueDays.size,
          leaveRequestsDeleted,
          balancesRestored,
          remarks: remarks ?? null,
          revertDetails: {
            paygroupId: paygroupId ?? null,
            employeeId: employeeId ?? null,
            revertedRecordCount: reverted,
            errors: errors.length > 0 ? errors : undefined,
          },
        },
      });
    } catch (histErr) {
      console.error('[revertValidationCorrection] Failed to save history:', histErr);
    }

    return { reverted, leaveRequestsDeleted, balancesRestored, errors };
  }

  /**
   * Clear all validation results for a date range. Deletes AttendanceValidationResult rows
   * so events (leave, permission, etc.) can be applied again. Does NOT revert HR corrections
   * or delete leave requests - use Revert for that.
   */
  async clearValidationResults(params: {
    organizationId: string;
    paygroupId?: string | null;
    employeeId?: string | null;
    fromDate: string;
    toDate: string;
  }): Promise<{ deleted: number }> {
    const { organizationId, paygroupId, employeeId, fromDate, toDate } = params;
    const from = new Date(fromDate + 'T00:00:00.000Z');
    const to = new Date(toDate + 'T23:59:59.999Z');

    const employeeWhere: Prisma.EmployeeWhereInput = { organizationId, deletedAt: null };
    if (employeeId) {
      employeeWhere.id = employeeId;
    } else if (paygroupId) {
      employeeWhere.paygroupId = paygroupId;
    }
    const employees = await prisma.employee.findMany({ where: employeeWhere, select: { id: true } });
    const employeeIds = employees.map((e) => e.id);
    if (employeeIds.length === 0) return { deleted: 0 };

    const result = await prisma.attendanceValidationResult.deleteMany({
      where: {
        organizationId,
        employeeId: { in: employeeIds },
        date: { gte: from, lte: to },
      },
    });
    return { deleted: result.count };
  }

  /**
   * Get validation revert history for an organization (most recent first).
   */
  async getValidationRevertHistory(params: {
    organizationId: string;
    limit?: number;
    page?: number;
  }): Promise<{
    history: Array<{
      id: string;
      fromDate: string;
      toDate: string;
      employeeCount: number;
      dayCount: number;
      leaveRequestsDeleted: number;
      balancesRestored: number;
      remarks: string | null;
      revertedByUserId: string;
      revertDetails: unknown;
      createdAt: string;
    }>;
    total: number;
  }> {
    const { organizationId, limit = 20, page = 1 } = params;
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      prisma.validationRevertHistory.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.validationRevertHistory.count({ where: { organizationId } }),
    ]);

    return {
      history: rows.map((r) => ({
        id: r.id,
        fromDate: this.toDateKey(r.fromDate),
        toDate: this.toDateKey(r.toDate),
        employeeCount: r.employeeCount,
        dayCount: r.dayCount,
        leaveRequestsDeleted: r.leaveRequestsDeleted,
        balancesRestored: r.balancesRestored,
        remarks: r.remarks,
        revertedByUserId: r.revertedByUserId,
        revertDetails: r.revertDetails,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
    };
  }

  /**
   * Get completed validation rows for the Revert Process page grid.
   * Returns all employee+date rows where isCompleted=true (or isOnHold=true).
   */
  async getCompletedList(params: {
    organizationId: string;
    fromDate: string;
    toDate: string;
    paygroupId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    rows: Array<{
      employeeId: string;
      employeeCode: string;
      employeeName: string;
      date: string;
      isCompleted: boolean;
      isOnHold: boolean;
      holdReason: string | null;
    }>;
    total: number;
    page: number;
    limit: number;
  }> {
    const { organizationId, fromDate, toDate, paygroupId, search, page = 1, limit = 50 } = params;
    const from = new Date(fromDate + 'T00:00:00.000Z');
    const to = new Date(toDate + 'T23:59:59.999Z');

    const where: Prisma.AttendanceValidationResultWhereInput = {
      organizationId,
      date: { gte: from, lte: to },
      OR: [{ isCompleted: true }, { isOnHold: true }],
    };
    if (paygroupId) {
      where.employee = { paygroupId };
    }
    if (search) {
      where.employee = {
        ...((where.employee as Prisma.EmployeeWhereInput) || {}),
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { employeeCode: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const [rows, total] = await Promise.all([
      prisma.attendanceValidationResult.findMany({
        where,
        select: {
          employeeId: true,
          date: true,
          isCompleted: true,
          isOnHold: true,
          holdReason: true,
          employee: {
            select: { employeeCode: true, firstName: true, middleName: true, lastName: true },
          },
        },
        orderBy: [{ date: 'asc' }, { employee: { firstName: 'asc' } }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.attendanceValidationResult.count({ where }),
    ]);

    return {
      rows: rows.map((r) => ({
        employeeId: r.employeeId,
        employeeCode: r.employee.employeeCode,
        employeeName: [r.employee.firstName, r.employee.middleName, r.employee.lastName].filter(Boolean).join(' '),
        date: this.toDateKey(r.date),
        isCompleted: r.isCompleted,
        isOnHold: r.isOnHold,
        holdReason: r.holdReason,
      })),
      total,
      page,
      limit,
    };
  }

  /**
   * Revert validation corrections for specific employee+date rows.
   */
  async revertByRows(params: {
    organizationId: string;
    selectedRows: { employeeId: string; date: string }[];
    remarks?: string;
    revertedByUserId?: string;
  }): Promise<{
    reverted: number;
    leaveRequestsDeleted: number;
    balancesRestored: number;
    errors: { employeeId: string; date: string; message: string }[];
  }> {
    const { organizationId, selectedRows, remarks, revertedByUserId } = params;
    const errors: { employeeId: string; date: string; message: string }[] = [];
    let reverted = 0;
    let leaveRequestsDeleted = 0;
    let balancesRestored = 0;

    const hrCorrectionMethods = ['DIRECT_COMPONENT', 'NO_CORRECTION', 'NO_CORRECTION_FINAL', 'AS_PER_RULE'];

    for (const row of selectedRows) {
      try {
        const dayDate = new Date(row.date + 'T00:00:00.000Z');
        const dayEnd = new Date(row.date + 'T23:59:59.999Z');

        const correctedRecords = await prisma.attendanceRecord.findMany({
          where: {
            employeeId: row.employeeId,
            date: { gte: dayDate, lte: dayEnd },
            validationMethod: { in: hrCorrectionMethods },
          },
          select: { id: true, employeeId: true, date: true, validationAction: true, validationMethod: true },
        });

        const hrLeaveRequests = await prisma.leaveRequest.findMany({
          where: {
            employeeId: row.employeeId,
            startDate: { lte: dayEnd },
            endDate: { gte: dayDate },
            OR: [
              { reviewComments: 'Auto-approved by validation correction' },
              { reason: { startsWith: '[Direct correction' } },
              { reason: { startsWith: '[Validation correction' } },
            ],
          },
          select: { id: true, leaveTypeId: true, totalDays: true, startDate: true },
        });

        await prisma.$transaction(async (tx) => {
          for (const rec of correctedRecords) {
            await tx.attendanceRecord.update({
              where: { id: rec.id },
              data: { validationAction: null, validationMethod: null },
            });
          }

          for (const lr of hrLeaveRequests) {
            const days = parseFloat(lr.totalDays.toString());
            const year = new Date(lr.startDate).getUTCFullYear();
            const balance = await tx.employeeLeaveBalance.findUnique({
              where: { employeeId_leaveTypeId_year: { employeeId: row.employeeId, leaveTypeId: lr.leaveTypeId, year } },
            });
            if (balance) {
              const usedNow = parseFloat(balance.used.toString());
              const restoredUsed = Math.max(0, usedNow - days);
              const availableNow = parseFloat(balance.available.toString());
              const hasPositiveOpening = parseFloat(balance.openingBalance.toString()) > 0 || parseFloat(balance.accrued.toString()) > 0;
              const updateData: Record<string, unknown> = { used: new Prisma.Decimal(restoredUsed) };
              if (hasPositiveOpening) {
                updateData.available = new Prisma.Decimal(availableNow + days);
              }
              await tx.employeeLeaveBalance.update({
                where: { employeeId_leaveTypeId_year: { employeeId: row.employeeId, leaveTypeId: lr.leaveTypeId, year } },
                data: updateData,
              });
              balancesRestored++;
            }
            await tx.leaveRequest.delete({ where: { id: lr.id } });
            leaveRequestsDeleted++;
          }

          await tx.attendanceValidationResult.updateMany({
            where: { organizationId, employeeId: row.employeeId, date: dayDate },
            data: { isCompleted: false, isOnHold: false },
          });
        });

        reverted++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        errors.push({ employeeId: row.employeeId, date: row.date, message: msg });
      }
    }

    try {
      await prisma.validationRevertHistory.create({
        data: {
          organizationId,
          revertedByUserId: revertedByUserId ?? '',
          fromDate: new Date(selectedRows[0].date + 'T00:00:00.000Z'),
          toDate: new Date(selectedRows[selectedRows.length - 1].date + 'T00:00:00.000Z'),
          employeeCount: new Set(selectedRows.map((r) => r.employeeId)).size,
          dayCount: new Set(selectedRows.map((r) => r.date)).size,
          leaveRequestsDeleted,
          balancesRestored,
          remarks: remarks ?? null,
          revertDetails: { rows: selectedRows, revertedCount: reverted, errors: errors.length > 0 ? errors : undefined },
        },
      });
    } catch (histErr) {
      console.error('[revertByRows] Failed to save history:', histErr);
    }

    return { reverted, leaveRequestsDeleted, balancesRestored, errors };
  }

  /**
   * Put selected employee+date rows on hold.
   */
  async putOnHold(params: {
    organizationId: string;
    selectedRows: { employeeId: string; date: string }[];
    holdAssociateCanModify?: boolean;
    holdManagerCanModify?: boolean;
    revertRegularization?: boolean;
    reason?: string;
  }): Promise<{ updated: number; errors: { employeeId: string; date: string; message: string }[] }> {
    const { organizationId, selectedRows, holdAssociateCanModify = false, holdManagerCanModify = false, reason } = params;
    const errors: { employeeId: string; date: string; message: string }[] = [];
    let updated = 0;

    for (const row of selectedRows) {
      try {
        const dayDate = new Date(row.date + 'T00:00:00.000Z');
        await prisma.attendanceValidationResult.updateMany({
          where: { organizationId, employeeId: row.employeeId, date: dayDate },
          data: {
            isOnHold: true,
            isCompleted: false,
            holdAssociateCanModify,
            holdManagerCanModify,
            holdReason: reason ?? null,
          },
        });
        updated++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        errors.push({ employeeId: row.employeeId, date: row.date, message: msg });
      }
    }

    return { updated, errors };
  }

  /**
   * Release selected rows from hold - goes back to pending state.
   */
  async releaseHold(params: {
    organizationId: string;
    selectedRows: { employeeId: string; date: string }[];
  }): Promise<{ released: number; errors: { employeeId: string; date: string; message: string }[] }> {
    const { organizationId, selectedRows } = params;
    const errors: { employeeId: string; date: string; message: string }[] = [];
    let released = 0;

    for (const row of selectedRows) {
      try {
        const dayDate = new Date(row.date + 'T00:00:00.000Z');
        await prisma.attendanceValidationResult.updateMany({
          where: { organizationId, employeeId: row.employeeId, date: dayDate, isOnHold: true },
          data: {
            isOnHold: false,
            holdAssociateCanModify: false,
            holdManagerCanModify: false,
            holdReason: null,
          },
        });
        released++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        errors.push({ employeeId: row.employeeId, date: row.date, message: msg });
      }
    }

    return { released, errors };
  }
}

export type ValidationDaySummary = {
  completed: number;
  approvalPending: number;
  late: number;
  earlyGoing: number;
  noOutPunch: number;
  shiftChange: number;
  absent: number;
  shortfall: number;
  overtime: number;
  onHold: number;
};

export interface LateDeductionEmployee {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  lateCount: number;
  totalLateMinutes: number;
  totalLateHours: number;
  actionName: string;
  deductionType: string;
  deductionDays: number;
  permissionExhausted: boolean;
}

export interface LateDeductionResult {
  employees: LateDeductionEmployee[];
  totals: {
    totalEmployees: number;
    totalLateCount: number;
    totalLateMinutes: number;
  };
}

export const attendanceService = new AttendanceService();
