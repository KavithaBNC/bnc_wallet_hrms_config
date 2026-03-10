/**
 * Monthly Attendance Summary Service
 *
 * Collects daily data from the attendance calendar, applies configured rules
 * and validations, and produces a finalized monthly roll-up for payroll and reporting.
 * Respects user rights, approval workflows (approved leaves only), and month locking.
 */

import { AttendanceStatus, LeaveStatus, MonthlyAttendanceSummaryStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { AppError } from '../middlewares/errorHandler';
import { prisma } from '../utils/prisma';
import {
  PayrollCalculationEngine,
  type AttendanceData,
  type LeaveData,
} from '../utils/payroll-calculation-engine';

export interface BuildSummaryInput {
  organizationId: string;
  employeeId: string;
  year: number;
  month: number;
}

export interface ListSummariesInput {
  organizationId: string;
  year: number;
  month: number;
  employeeId?: string;
  status?: MonthlyAttendanceSummaryStatus;
  page?: number;
  limit?: number;
}

export class MonthlyAttendanceSummaryService {
  /**
   * Check if a month is locked for the organization (no edits allowed).
   */
  async isMonthLocked(organizationId: string, year: number, month: number): Promise<boolean> {
    const lock = await prisma.monthlyAttendanceLock.findUnique({
      where: {
        organizationId_year_month: { organizationId, year, month },
      },
    });
    return !!lock;
  }

  /**
   * Count week-off days in period using __WEEK_OFF_DATA__ rules (fetch once, compute in-memory).
   */
  private async countWeekOffDaysInPeriod(
    employeeId: string,
    organizationId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<number> {
    const [employee, weekOffRules] = await Promise.all([
      prisma.employee.findUnique({
        where: { id: employeeId },
        select: { paygroupId: true, departmentId: true },
      }),
      prisma.shiftAssignmentRule.findMany({
        where: {
          organizationId,
          effectiveDate: { lte: periodEnd },
          remarks: { contains: '__WEEK_OFF_DATA__' },
        },
        orderBy: [{ priority: 'desc' }, { effectiveDate: 'desc' }],
        select: { employeeIds: true, paygroupId: true, departmentId: true, remarks: true, effectiveDate: true },
      }),
    ]);

    const isWeekOff = (date: Date): boolean => {
      for (const rule of weekOffRules) {
        if (rule.effectiveDate > date) continue;
        const ruleEmpIds = Array.isArray(rule.employeeIds) ? (rule.employeeIds as string[]) : [];
        let matches = false;
        if (ruleEmpIds.length > 0) {
          matches = ruleEmpIds.includes(employeeId);
        } else if (rule.paygroupId && rule.departmentId) {
          matches =
            rule.paygroupId === employee?.paygroupId && rule.departmentId === employee?.departmentId;
        } else if (rule.paygroupId) {
          matches = rule.paygroupId === employee?.paygroupId;
        } else if (rule.departmentId) {
          matches = rule.departmentId === employee?.departmentId;
        } else {
          matches = true;
        }
        if (!matches || !rule.remarks) continue;
        const markerIdx = rule.remarks.indexOf('__WEEK_OFF_DATA__');
        if (markerIdx === -1) continue;
        try {
          const jsonStr = rule.remarks.slice(markerIdx + '__WEEK_OFF_DATA__'.length);
          const parsed = JSON.parse(jsonStr) as {
            weekOffDetails?: boolean[][];
            alternateSaturdayOff?: string;
          };
          let weekOffDetails = parsed?.weekOffDetails;
          if (!weekOffDetails || !Array.isArray(weekOffDetails)) continue;
          const altSat = (parsed?.alternateSaturdayOff || '').toUpperCase();
          if (
            (altSat.includes('1ST') && altSat.includes('3RD')) ||
            (altSat.includes('2ND') && altSat.includes('4TH'))
          ) {
            weekOffDetails = weekOffDetails.map((week) => {
              const row = [...week];
              if (row[0] !== undefined) row[0] = false;
              return row;
            });
          }
          const dayOfMonth = date.getUTCDate();
          const weekIndex = Math.min(5, Math.max(0, Math.ceil(dayOfMonth / 7) - 1));
          const dayIndex = date.getUTCDay();
          if (weekOffDetails[weekIndex]?.[dayIndex]) return true;
        } catch {
          /* ignore */
        }
      }
      return date.getUTCDay() === 0;
    };

    let count = 0;
    const cursor = new Date(periodStart);
    cursor.setUTCHours(0, 0, 0, 0);
    const end = new Date(periodEnd);
    end.setUTCHours(23, 59, 59, 999);
    while (cursor <= end) {
      if (isWeekOff(new Date(cursor))) count += 1;
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return count;
  }

  /**
   * Get attendance data for an employee for a calendar month (same logic as payroll).
   * weekendDays: from employee-specific week-off rules (__WEEK_OFF_DATA__), e.g. Sunday + Alternate Saturday.
   */
  private async getAttendanceDataForMonth(
    employeeId: string,
    periodStart: Date,
    periodEnd: Date,
    organizationId: string
  ): Promise<AttendanceData> {
    const attendanceRecords = await prisma.attendanceRecord.findMany({
      where: {
        employeeId,
        date: { gte: periodStart, lte: periodEnd },
      },
    });

    const presentDays = attendanceRecords.filter((r) => r.status === AttendanceStatus.PRESENT).length;
    const absentDays = attendanceRecords.filter((r) => r.status === AttendanceStatus.ABSENT).length;
    const halfDays = attendanceRecords.filter((r) => r.status === AttendanceStatus.HALF_DAY).length;
    const holidayDays = attendanceRecords.filter((r) => r.status === AttendanceStatus.HOLIDAY).length;

    // weekendDays from employee-specific week-off rules (batched); fallback to record count if rule-based fails
    let weekendDays: number;
    try {
      weekendDays = await this.countWeekOffDaysInPeriod(
        employeeId,
        organizationId,
        periodStart,
        periodEnd
      );
    } catch (err) {
      // Fallback: count from attendance records (status WEEKEND) if rule-based calculation fails
      weekendDays = attendanceRecords.filter((r) => r.status === AttendanceStatus.WEEKEND).length;
    }

    const overtimeHours = attendanceRecords.reduce(
      (sum, r) => sum + (r.overtimeHours ? Number(r.overtimeHours) : 0),
      0
    );

    const totalWorkingDays = PayrollCalculationEngine.calculateWorkingDays(periodStart, periodEnd);

    return {
      presentDays,
      absentDays,
      halfDays,
      holidayDays,
      weekendDays,
      overtimeHours,
      totalWorkingDays,
    };
  }

  /**
   * Get leave data for an employee for a month (approved leaves only – respects approval workflow).
   */
  private async getLeaveDataForMonth(
    employeeId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<LeaveData> {
    const leaveRequests = await prisma.leaveRequest.findMany({
      where: {
        employeeId,
        status: LeaveStatus.APPROVED,
        startDate: { lte: periodEnd },
        endDate: { gte: periodStart },
      },
      include: {
        leaveType: {
          select: { id: true, name: true, isPaid: true },
        },
      },
    });

    let paidLeaveDays = 0;
    let unpaidLeaveDays = 0;
    const leaveDetails: Array<{ leaveType: string; leaveTypeId: string; days: number; isPaid: boolean }> = [];

    for (const leaveRequest of leaveRequests) {
      const overlapStart =
        leaveRequest.startDate > periodStart ? leaveRequest.startDate : periodStart;
      const overlapEnd = leaveRequest.endDate < periodEnd ? leaveRequest.endDate : periodEnd;
      const overlapDays = PayrollCalculationEngine.calculateWorkingDays(
        new Date(overlapStart),
        new Date(overlapEnd)
      );
      const isPaid = leaveRequest.leaveType.isPaid;
      if (isPaid) paidLeaveDays += overlapDays;
      else unpaidLeaveDays += overlapDays;
      leaveDetails.push({
        leaveType: leaveRequest.leaveType.name,
        leaveTypeId: leaveRequest.leaveType.id,
        days: overlapDays,
        isPaid,
      });
    }

    return {
      paidLeaveDays,
      unpaidLeaveDays,
      leaveDetails: leaveDetails.map((d) => ({ leaveType: d.leaveType, days: d.days, isPaid: d.isPaid })),
    };
  }

  /**
   * Build or recompute a single employee's monthly summary from calendar + approved leaves.
   * Applies same rule as payroll: present/half/holiday/approved leave → paid; absent/unpaid leave → LOP.
   */
  async buildSummaryForEmployee(input: BuildSummaryInput) {
    const { organizationId, employeeId, year, month } = input;

    const locked = await this.isMonthLocked(organizationId, year, month);
    if (locked) {
      throw new AppError('This month is locked for attendance. No changes allowed.', 403);
    }

    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0);

    const [attendance, leaves] = await Promise.all([
      this.getAttendanceDataForMonth(employeeId, periodStart, periodEnd, organizationId),
      this.getLeaveDataForMonth(employeeId, periodStart, periodEnd),
    ]);

    const paidDays = PayrollCalculationEngine.calculatePaidDays(
      attendance,
      leaves,
      attendance.totalWorkingDays
    );
    // LOP = full absent + unpaid leave + half days (each half day = 0.5 LOP, same as payroll)
    const lopDays = attendance.absentDays + leaves.unpaidLeaveDays + attendance.halfDays * 0.5;

    // Leave breakdown for payroll integration (by leave type)
    const leaveRequests = await prisma.leaveRequest.findMany({
      where: {
        employeeId,
        status: LeaveStatus.APPROVED,
        startDate: { lte: periodEnd },
        endDate: { gte: periodStart },
      },
      include: { leaveType: { select: { id: true, name: true, isPaid: true } } },
    });
    const leaveByType = new Map<string, { days: number; isPaid: boolean }>();
    for (const lr of leaveRequests) {
      const overlapStart = lr.startDate > periodStart ? lr.startDate : periodStart;
      const overlapEnd = lr.endDate < periodEnd ? lr.endDate : periodEnd;
      const days = PayrollCalculationEngine.calculateWorkingDays(
        new Date(overlapStart),
        new Date(overlapEnd)
      );
      const existing = leaveByType.get(lr.leaveType.id);
      if (existing) {
        existing.days += days;
      } else {
        leaveByType.set(lr.leaveType.id, { days, isPaid: lr.leaveType.isPaid });
      }
    }

    const existing = await prisma.monthlyAttendanceSummary.findUnique({
      where: {
        organizationId_employeeId_year_month: {
          organizationId,
          employeeId,
          year,
          month,
        },
      },
      include: { leaveBreakdown: true },
    });

    const data = {
      organizationId,
      employeeId,
      year,
      month,
      presentDays: attendance.presentDays,
      absentDays: attendance.absentDays,
      leaveDays: new Prisma.Decimal(leaves.paidLeaveDays + leaves.unpaidLeaveDays),
      lopDays: new Prisma.Decimal(lopDays),
      halfDays: attendance.halfDays,
      holidayDays: attendance.holidayDays,
      weekendDays: attendance.weekendDays,
      overtimeHours: new Prisma.Decimal(attendance.overtimeHours),
      paidDays: new Prisma.Decimal(paidDays),
      totalWorkingDays: attendance.totalWorkingDays,
      status: existing?.status ?? MonthlyAttendanceSummaryStatus.DRAFT,
    };

    if (existing) {
      await prisma.monthlyAttendanceSummaryLeave.deleteMany({
        where: { summaryId: existing.id },
      });
      const summary = await prisma.monthlyAttendanceSummary.update({
        where: { id: existing.id },
        data,
        include: {
          employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
          leaveBreakdown: { include: { leaveType: { select: { id: true, name: true, code: true, isPaid: true } } } },
        },
      });
      for (const [leaveTypeId, { days, isPaid }] of leaveByType.entries()) {
        await prisma.monthlyAttendanceSummaryLeave.create({
          data: {
            summaryId: summary.id,
            leaveTypeId,
            days: new Prisma.Decimal(days),
            isPaid,
          },
        });
      }
      return prisma.monthlyAttendanceSummary.findUnique({
        where: { id: summary.id },
        include: {
          employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
          leaveBreakdown: { include: { leaveType: { select: { id: true, name: true, code: true, isPaid: true } } } },
        },
      });
    }

    const summary = await prisma.monthlyAttendanceSummary.create({
      data,
      include: {
        employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
        leaveBreakdown: { include: { leaveType: { select: { id: true, name: true, code: true, isPaid: true } } } },
      },
    });
    for (const [leaveTypeId, { days, isPaid }] of leaveByType.entries()) {
      await prisma.monthlyAttendanceSummaryLeave.create({
        data: {
          summaryId: summary.id,
          leaveTypeId,
          days: new Prisma.Decimal(days),
          isPaid,
        },
      });
    }
    return prisma.monthlyAttendanceSummary.findUnique({
      where: { id: summary.id },
      include: {
        employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
        leaveBreakdown: { include: { leaveType: { select: { id: true, name: true, code: true, isPaid: true } } } },
      },
    });
  }

  /**
   * Build or refresh summaries for all active employees in the organization for the given month.
   */
  async buildMonthForOrganization(organizationId: string, year: number, month: number) {
    const locked = await this.isMonthLocked(organizationId, year, month);
    if (locked) {
      throw new AppError('This month is locked for attendance. No changes allowed.', 403);
    }

    const employees = await prisma.employee.findMany({
      where: {
        organizationId,
        deletedAt: null,
        employeeStatus: 'ACTIVE',
        dateOfJoining: { lte: new Date(year, month, 0) },
      },
      select: { id: true },
    });

    const results: Array<{ employeeId: string; summaryId?: string; error?: string }> = [];
    for (const emp of employees) {
      try {
        const summary = await this.buildSummaryForEmployee({
          organizationId,
          employeeId: emp.id,
          year,
          month,
        });
        results.push({ employeeId: emp.id, summaryId: summary?.id });
      } catch (e: unknown) {
        results.push({
          employeeId: emp.id,
          error: e instanceof Error ? e.message : 'Unknown error',
        });
      }
    }

    return {
      message: `Processed ${employees.length} employees for ${year}-${String(month).padStart(2, '0')}`,
      totalEmployees: employees.length,
      successCount: results.filter((r) => r.summaryId).length,
      failedCount: results.filter((r) => r.error).length,
      results,
    };
  }

  /**
   * List monthly summaries with filters and pagination.
   */
  async list(input: ListSummariesInput) {
    const { organizationId, year, month, employeeId, status, page = 1, limit = 50 } = input;
    const skip = (page - 1) * limit;

    const where: Prisma.MonthlyAttendanceSummaryWhereInput = {
      organizationId,
      year,
      month,
    };
    if (employeeId) where.employeeId = employeeId;
    if (status) where.status = status;

    const [summaries, total] = await Promise.all([
      prisma.monthlyAttendanceSummary.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ employee: { employeeCode: 'asc' } }],
        include: {
          employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
          leaveBreakdown: { include: { leaveType: { select: { id: true, name: true, code: true, isPaid: true } } } },
        },
      }),
      prisma.monthlyAttendanceSummary.count({ where }),
    ]);

    return {
      data: summaries,
      pagination: { page, limit, total },
    };
  }

  /**
   * Get a single summary by id.
   */
  async getById(id: string) {
    const summary = await prisma.monthlyAttendanceSummary.findUnique({
      where: { id },
      include: {
        employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true, departmentId: true, paygroupId: true } },
        leaveBreakdown: { include: { leaveType: { select: { id: true, name: true, code: true, isPaid: true } } } },
      },
    });
    if (!summary) throw new AppError('Monthly attendance summary not found', 404);
    return summary;
  }

  /**
   * Finalize a summary (DRAFT → FINALIZED). Finalized data can be used for payroll.
   */
  async finalize(id: string, finalizedBy: string) {
    const summary = await prisma.monthlyAttendanceSummary.findUnique({ where: { id } });
    if (!summary) throw new AppError('Monthly attendance summary not found', 404);
    if (summary.status !== MonthlyAttendanceSummaryStatus.DRAFT) {
      throw new AppError('Only DRAFT summaries can be finalized', 400);
    }
    const locked = await this.isMonthLocked(summary.organizationId, summary.year, summary.month);
    if (locked) throw new AppError('This month is locked. Cannot finalize.', 403);

    return prisma.monthlyAttendanceSummary.update({
      where: { id },
      data: {
        status: MonthlyAttendanceSummaryStatus.FINALIZED,
        finalizedAt: new Date(),
        finalizedBy,
      },
      include: {
        employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
        leaveBreakdown: { include: { leaveType: { select: { id: true, name: true, code: true, isPaid: true } } } },
      },
    });
  }

  /**
   * Lock a month for the organization. All summaries for that month are set to LOCKED; no further edits.
   */
  async lockMonth(organizationId: string, year: number, month: number, lockedBy?: string, remarks?: string) {
    const existing = await prisma.monthlyAttendanceLock.findUnique({
      where: { organizationId_year_month: { organizationId, year, month } },
    });
    if (existing) throw new AppError('This month is already locked', 400);

    const now = new Date();
    await prisma.$transaction([
      prisma.monthlyAttendanceLock.create({
        data: {
          organizationId,
          year,
          month,
          lockedAt: now,
          lockedBy: lockedBy ?? null,
          remarks: remarks ?? null,
        },
      }),
      prisma.monthlyAttendanceSummary.updateMany({
        where: { organizationId, year, month },
        data: {
          status: MonthlyAttendanceSummaryStatus.LOCKED,
          lockedAt: now,
          lockedBy: lockedBy ?? null,
        },
      }),
    ]);

    return prisma.monthlyAttendanceLock.findUnique({
      where: { organizationId_year_month: { organizationId, year, month } },
    });
  }

  /**
   * Get lock record for a month (if any).
   */
  async getMonthLock(organizationId: string, year: number, month: number) {
    return prisma.monthlyAttendanceLock.findUnique({
      where: { organizationId_year_month: { organizationId, year, month } },
    });
  }

  /**
   * Unlock a month for the organization. Reverts LOCKED summaries back to FINALIZED.
   */
  async unlockMonth(organizationId: string, year: number, month: number, _remarks?: string) {
    const existing = await prisma.monthlyAttendanceLock.findUnique({
      where: { organizationId_year_month: { organizationId, year, month } },
    });
    if (!existing) throw new AppError('This month is not locked', 400);

    await prisma.$transaction([
      prisma.monthlyAttendanceLock.delete({
        where: { organizationId_year_month: { organizationId, year, month } },
      }),
      prisma.monthlyAttendanceSummary.updateMany({
        where: { organizationId, year, month, status: MonthlyAttendanceSummaryStatus.LOCKED },
        data: {
          status: MonthlyAttendanceSummaryStatus.FINALIZED,
          lockedAt: null,
          lockedBy: null,
        },
      }),
    ]);

    return null;
  }

  /**
   * Attempt to rebuild a summary for a specific employee + month.
   * This is a safe hook for other services (leave, attendance correction) to call
   * after mutating attendance data. If the month is LOCKED, the rebuild is silently
   * skipped — the caller should NOT treat a locked month as an error, since the
   * correction itself should have been blocked upstream.
   *
   * Returns true if rebuilt, false if skipped (locked or no existing summary).
   */
  async tryRebuildSummaryForDate(
    organizationId: string,
    employeeId: string,
    date: Date
  ): Promise<boolean> {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;

    // Only rebuild if a summary already exists for this employee+month.
    // If HR hasn't built the initial summary yet, don't create one prematurely.
    const existing = await prisma.monthlyAttendanceSummary.findUnique({
      where: {
        organizationId_employeeId_year_month: { organizationId, employeeId, year, month },
      },
      select: { status: true },
    });

    if (!existing) return false;

    // If month is locked, skip silently
    const locked = await this.isMonthLocked(organizationId, year, month);
    if (locked) return false;

    try {
      await this.buildSummaryForEmployee({ organizationId, employeeId, year, month });
      return true;
    } catch (err) {
      // Log but don't fail the parent operation
      console.warn(
        `[MonthlyAttendanceSummary] Auto-rebuild failed for employee ${employeeId}, ${year}-${month}: ${(err as Error)?.message}`
      );
      return false;
    }
  }
}

export const monthlyAttendanceSummaryService = new MonthlyAttendanceSummaryService();
