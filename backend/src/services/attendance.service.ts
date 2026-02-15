
import { AppError } from '../middlewares/errorHandler';
import { AttendanceStatus, CheckInMethod, LeaveStatus, Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { shiftService } from './shift.service';
import { shiftAssignmentRuleService } from './shift-assignment-rule.service';
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
    const permissionReasonRegex = /^\[Permission\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\]/i;
    for (const leave of approvedLeaves) {
      if (!leave?.reason) continue;
      const match = leave.reason.match(permissionReasonRegex);
      if (!match) continue;
      const [, , endHHMM] = match;
      const [endHours, endMinutes] = endHHMM.split(':').map(Number);
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
  async getRecords(query: QueryAttendanceRecordsInput, userId?: string, userRole?: string) {
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
        // RBAC: EMPLOYEE can only see their own records (self-service)
        if (userRole === 'EMPLOYEE') {
          where.employeeId = employee.id;
        }
        // RBAC: MANAGER can only see records from their team (subordinates)
        else if (userRole === 'MANAGER') {
          where.employee = {
            reportingManagerId: employee.id, // Only show records from employees who report to this manager
            organizationId: query.organizationId || employee.organizationId,
          };
        }
        // HR_MANAGER and ORG_ADMIN can see all records in their organization
        else if (userRole === 'HR_MANAGER' || userRole === 'ORG_ADMIN') {
          if (query.organizationId || employee.organizationId) {
            where.employee = {
              organizationId: query.organizationId || employee.organizationId,
            };
          }
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
    const employeeInfo = records[0]?.employee
      ? records[0].employee
      : await prisma.employee.findUnique({
          where: { id: employeeId },
          select: { id: true, firstName: true, lastName: true, email: true, employeeCode: true },
        });
    if (!employeeInfo) return records;

    const merged: any[] = [];
    for (const dateStr of datesInRange) {
      const key = `${employeeId}-${dateStr}`;
      const existing = recordsByDate.get(key);
      const dateForRule = new Date(dateStr + 'T12:00:00.000Z');
      // Week off takes precedence: if a Week Off rule applies to this employee on this date, show Week Off on calendar
      const weekOffShift = await shiftAssignmentRuleService.getApplicableWeekOffForEmployee(
        employeeId,
        dateForRule,
        organizationId
      );
      if (weekOffShift) {
        merged.push({
          id: existing?.id ?? `synthetic-${employeeId}-${dateStr}`,
          employeeId,
          date: dateForRule,
          shiftId: weekOffShift.id,
          employee: existing?.employee ?? employeeInfo,
          shift: weekOffShift,
        });
        continue;
      }
      // Holiday from Holiday Assign (ShiftAssignmentRule with __HOLIDAY_DATA__) — show on employee calendar
      // Pass dateStr (YYYY-MM-DD) so comparison is timezone-neutral; avoids holidays showing on 17th/20th instead of 16th/19th
      const holiday = await shiftAssignmentRuleService.getApplicableHolidayForEmployee(
        employeeId,
        dateStr,
        organizationId
      );
      if (holiday) {
        merged.push({
          id: existing?.id ?? `synthetic-holiday-${employeeId}-${dateStr}`,
          employeeId,
          date: dateForRule,
          shiftId: null,
          employee: existing?.employee ?? employeeInfo,
          shift: { id: 'holiday', name: holiday.name, startTime: '00:00', endTime: '00:00' },
          status: AttendanceStatus.HOLIDAY,
        });
        continue;
      }
      if (existing) {
        // Normalize output date to the working date bucket we are building, so API consumers
        // always get attendance mapped by shift start date even if DB date was stored differently.
        const existingOnWorkingDate = { ...existing, date: dateForRule };
        if (existing.shift) {
          merged.push(existingOnWorkingDate);
        } else {
          const shiftFromRule = await shiftAssignmentRuleService.getApplicableShiftForEmployee(
            employeeId,
            dateForRule,
            organizationId
          );
          merged.push({ ...existingOnWorkingDate, shift: shiftFromRule });
        }
      } else {
        const shiftFromRule = await shiftAssignmentRuleService.getApplicableShiftForEmployee(
          employeeId,
          dateForRule,
          organizationId
        );
        if (shiftFromRule) {
          merged.push({
            id: `synthetic-${employeeId}-${dateStr}`,
            employeeId,
            date: dateForRule,
            shiftId: shiftFromRule.id,
            employee: employeeInfo,
            shift: shiftFromRule,
          });
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

    const [employee, components, leaveTypes, autoCreditSettings, leaveBalances, previousYearLeaveBalances, records, leaveRequests, ruleSettings] =
      await Promise.all([
        prisma.employee.findUnique({
          where: { id: employeeId },
          select: { id: true, employeeCode: true, paygroupId: true, departmentId: true },
        }),
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
          orderBy: { priority: 'asc' },
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
            select: { id: true },
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

    if (!employee) {
      throw new AppError('Employee not found', 404);
    }

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

    const readEntitlementDays = (rule: unknown): number | null => {
      if (!rule || typeof rule !== 'object') return null;
      const r = rule as Record<string, unknown>;
      const keys = ['entitlementDays', 'EntitlementDays', 'entitlement_days', 'entitlementdays'];
      for (const k of keys) {
        const v = r[k];
        const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
        if (Number.isFinite(n) && n >= 0) return n;
      }
      return null;
    };

    const nameToEntitlementStrict = new Map<string, number>();
    const codeToEntitlementStrict = new Map<string, number>();
    const entitlementByEventNameOrCodeStrict = new Map<string, number>();
    const entitlementByNormalizedKey = new Map<string, number>();
    const normalizeEntitlementKey = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, '');

    for (const s of autoCreditSettings) {
      const n = readEntitlementDays(s.autoCreditRule);
      if (n == null) continue;
      const applicable = isAutoCreditApplicableToEmployee(s);
      if (!applicable) continue;
      if (s.eventType) {
        const key = s.eventType.toLowerCase().trim();
        nameToEntitlementStrict.set(key, n);
        entitlementByEventNameOrCodeStrict.set(key, n);
        const normalized = normalizeEntitlementKey(key);
        if (normalized) entitlementByNormalizedKey.set(normalized, n);
      }
      if (s.displayName) {
        const key = s.displayName.trim().toUpperCase();
        codeToEntitlementStrict.set(key, n);
        entitlementByEventNameOrCodeStrict.set(key, n);
        const normalized = normalizeEntitlementKey(key);
        if (normalized) entitlementByNormalizedKey.set(normalized, n);
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
        r.status === AttendanceStatus.WEEKEND ||
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
      if (r.shift?.startTime && r.checkIn) {
        const [sh, sm] = (r.shift.startTime as string).split(':').map(Number);
        const shiftStart = new Date(r.date);
        shiftStart.setHours(sh, sm || 0, 0, 0);
        if (new Date(r.checkIn) > shiftStart) {
          lateCount += 1;
          lateMinutes += Math.round((new Date(r.checkIn).getTime() - shiftStart.getTime()) / 60000);
        }
      }
      if (r.shift?.endTime && r.checkOut) {
        const [eh, em] = (r.shift.endTime as string).split(':').map(Number);
        const shiftEnd = new Date(r.date);
        shiftEnd.setHours(eh, em || 0, 0, 0);
        if (!approvedHalfDayLeaveDateKeys.has(recordDateKey) && new Date(r.checkOut) < shiftEnd) {
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

    const usageBeforeMonth = new Map<string, number>(); // leaveTypeId -> days used before monthStart
    const usageThisMonth = new Map<string, number>(); // leaveTypeId -> days used in [monthStart, monthEnd]

    for (const lr of leaveRequests) {
      const leaveTypeId = lr.leaveTypeId;
      const totalDays = Number(lr.totalDays);

      const start = new Date(lr.startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(lr.endDate);
      end.setHours(23, 59, 59, 999);

      const totalCalendarDays =
        Math.max(1, Math.round((end.getTime() - start.getTime()) / oneDayMs) + 1);
      const perDay = totalDays / totalCalendarDays;

      const prevEnd = new Date(monthStart.getTime() - oneDayMs);

      const overlap = (rangeStart: Date, rangeEnd: Date) => {
        const s = new Date(Math.max(start.getTime(), rangeStart.getTime()));
        const e = new Date(Math.min(end.getTime(), rangeEnd.getTime()));
        if (e < s) return 0;
        const days = Math.round((e.getTime() - s.getTime()) / oneDayMs) + 1;
        return days * perDay;
      };

      // Usage before this month (from yearStart to day before monthStart)
      if (yearStart < monthStart) {
        const usedBefore = overlap(yearStart, prevEnd);
        if (usedBefore > 0) {
          usageBeforeMonth.set(
            leaveTypeId,
            (usageBeforeMonth.get(leaveTypeId) ?? 0) + usedBefore
          );
        }
      }

      // Usage in this month
      const usedThis = overlap(monthStart, monthEnd);
      if (usedThis > 0) {
        usageThisMonth.set(leaveTypeId, (usageThisMonth.get(leaveTypeId) ?? 0) + usedThis);
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

    const normalizeKey = (value: string | null | undefined) =>
      (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

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

    const computeMonthlyLeaveRow = (
      bal: (typeof leaveBalances)[0],
      opts?: { yearEntitlementOverride?: number | null }
    ) => {
      const leaveTypeId = bal.leaveTypeId;
      const isJanuary = month === 1;
      const carryForward =
        Number(bal.carriedForward ?? 0) > 0
          ? Number(bal.carriedForward ?? 0)
          : Number(previousYearBalanceByLeaveTypeId.get(leaveTypeId) ?? 0);
      const entitlementFromBalance =
        Number(bal.openingBalance) > 0
          ? Number(bal.openingBalance) + Number(bal.carriedForward)
          : Number(bal.available) + Number(bal.used) > 0
            ? Number(bal.available) + Number(bal.used)
            : null;
      const entitlementFromAutoCredit =
        opts?.yearEntitlementOverride ??
        entitlementFromAutoCreditByLeaveTypeId.get(leaveTypeId) ??
        null;
      const entitlementFromLeaveType = bal.leaveType.defaultDaysPerYear
        ? Number(bal.leaveType.defaultDaysPerYear)
        : null;

      // Priority: (a) employee_leave_balance, (b) Auto Credit, (c) Leave Type defaultDaysPerYear
      const yearEntitlement =
        entitlementFromBalance ??
        entitlementFromAutoCredit ??
        entitlementFromLeaveType ??
        0;

      const usedBefore = usageBeforeMonth.get(leaveTypeId) ?? 0;
      const usedThis = usageThisMonth.get(leaveTypeId) ?? 0;

      const opening = isJanuary
        ? Math.max(0, carryForward)
        : Math.max(0, yearEntitlement - usedBefore);
      const credit = isJanuary
        ? Math.max(
            0,
            entitlementFromAutoCredit ??
              entitlementFromLeaveType ??
              (Number(bal.openingBalance ?? 0) > 0 ? Number(bal.openingBalance ?? 0) : 0)
          )
        : 0;
      const closing = isJanuary
        ? Math.max(0, opening + credit - usedThis)
        : Math.max(0, opening - usedThis);

      return {
        name: bal.leaveType.name,
        opening,
        credit,
        used: usedThis,
        balance: closing,
        entitlementConfigured: entitlementFromBalance != null || entitlementFromAutoCredit != null || entitlementFromLeaveType != null,
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
      const bal = leaveBalances.find(
        (b) =>
          componentMatchesLeaveType(
            { eventName: comp.eventName, shortName: comp.shortName },
            { name: b.leaveType.name, code: b.leaveType.code }
          )
      );

      if (bal) {
        const base = computeMonthlyLeaveRow(bal);
        return {
          ...base,
          name: comp.eventName || comp.shortName || base.name,
        };
      }

      // If balance doesn't exist, try deriving entitlement from auto-credit + leave type mapping.
      const leaveType =
        leaveTypes.find(
          (lt) =>
            componentMatchesLeaveType(
              { eventName: comp.eventName, shortName: comp.shortName },
              { name: lt.name, code: lt.code }
            )
        ) ?? null;

      if (leaveType) {
        // Priority: (b) Auto Credit, (c) Leave Type defaultDaysPerYear – no balance when bal not found
        const isJanuary = month === 1;
        const entitlementFromAutoCredit = entitlementFromAutoCreditByLeaveTypeId.get(leaveType.id) ?? null;
        const entitlementFromLeaveType = leaveType.defaultDaysPerYear ? Number(leaveType.defaultDaysPerYear) : null;
        const yearEntitlement = entitlementFromAutoCredit ?? entitlementFromLeaveType ?? 0;
        const entitlementConfigured = !comp.hasBalance || entitlementFromAutoCredit != null || entitlementFromLeaveType != null;

        const usedBefore = usageBeforeMonth.get(leaveType.id) ?? 0;
        const usedThis = usageThisMonth.get(leaveType.id) ?? 0;
        const opening = isJanuary
          ? Math.max(0, Number(previousYearBalanceByLeaveTypeId.get(leaveType.id) ?? 0))
          : Math.max(0, yearEntitlement - usedBefore);
        const credit = isJanuary ? Math.max(0, yearEntitlement) : 0;
        const closing = isJanuary
          ? Math.max(0, opening + credit - usedThis)
          : Math.max(0, opening - usedThis);
        return {
          name: comp.eventName || comp.shortName,
          opening,
          credit,
          used: usedThis,
          balance: closing,
          entitlementConfigured,
        };
      }

      const directEntitlement =
        entitlementByEventNameOrCodeStrict.get((comp.eventName || '').toLowerCase().trim()) ??
        (comp.shortName ? entitlementByEventNameOrCodeStrict.get(comp.shortName.trim().toUpperCase()) : undefined) ??
        entitlementByNormalizedKey.get(normalizeEntitlementKey(comp.eventName || '')) ??
        entitlementByNormalizedKey.get(normalizeEntitlementKey(comp.shortName || ''));
      if (directEntitlement != null && directEntitlement > 0) {
        return {
          name: comp.eventName || comp.shortName,
          opening: directEntitlement,
          credit: 0,
          used: 0,
          balance: directEntitlement,
          entitlementConfigured: true,
        };
      }

      // Events like LOP (Has balance = NO) should not require entitlement configuration.
      if (!comp.hasBalance) {
        return {
          name: comp.eventName || comp.shortName,
          opening: 0,
          credit: 0,
          used: 0,
          balance: 0,
          entitlementConfigured: true,
        };
      }

      return {
        name: comp.eventName || comp.shortName,
        opening: 0,
        credit: 0,
        used: 0,
        balance: 0,
        entitlementConfigured: false,
      };
    };

    const leaveRows = (byCategory.get('Leave') || []).map((comp) => computeMappedRowForComponent(comp));

    const balanceRow = (comp: (typeof components)[0]) => ({
      name: comp.eventName || comp.shortName,
      opening: 0,
      credit: 0,
      used: 0,
      balance: 0,
    });

    const ondutyRows = (byCategory.get('Onduty') || byCategory.get('On Duty') || []).map(balanceRow);

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

    const permissionRows = (byCategory.get('Permission') || []).map((comp) => {
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
      return {
        name: row.name,
        opening: row.opening,
        credit: row.credit,
        used: row.used,
        balance: row.balance,
      };
    });
    const presentRows = (byCategory.get('Present') || []).map(balanceRow);

    // Build final leave rows: start with component-based rows, then append any
    // EmployeeLeaveBalance entries that aren't already matched (e.g. "Comp Off")
    let finalLeaveRows: Array<{ name: string; opening: number; credit: number; used: number; balance: number; entitlementConfigured?: boolean }>;
    if (leaveRows.length > 0) {
      // Collect names already present (lowered) to avoid duplicates
      const coveredNames = new Set(leaveRows.map((r) => r.name?.toLowerCase().trim()));
      const extraRows = leaveBalances
        .filter((b) => !coveredNames.has(b.leaveType.name.toLowerCase().trim()))
        .map((b) => computeMonthlyLeaveRow(b));
      finalLeaveRows = [...leaveRows, ...extraRows];
    } else if (leaveBalances.length > 0) {
      finalLeaveRows = leaveBalances.map((b) => computeMonthlyLeaveRow(b));
    } else {
      finalLeaveRows = leaveTypes.map((lt) => {
        const entitlementFromAutoCredit = entitlementFromAutoCreditByLeaveTypeId.get(lt.id) ?? null;
        const entitlementFromLeaveType = lt.defaultDaysPerYear ? Number(lt.defaultDaysPerYear) : null;
        const yearEntitlement = entitlementFromAutoCredit ?? entitlementFromLeaveType ?? 0;
        const entitlementConfigured = entitlementFromAutoCredit != null || entitlementFromLeaveType != null;

        const usedBefore = usageBeforeMonth.get(lt.id) ?? 0;
        const usedThis = usageThisMonth.get(lt.id) ?? 0;
        const opening = Math.max(0, yearEntitlement - usedBefore);
        const closing = Math.max(0, opening - usedThis);
        return {
          name: lt.name,
          opening,
          credit: 0,
          used: usedThis,
          balance: closing,
          entitlementConfigured,
        };
      });
    }

    const entitlementWarnings = (finalLeaveRows as Array<{ name: string; entitlementConfigured?: boolean }>)
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
}

export const attendanceService = new AttendanceService();
