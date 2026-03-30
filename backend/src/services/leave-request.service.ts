
import { AppError } from '../middlewares/errorHandler';
import { AttendanceStatus, LeaveStatus, Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { emailService } from './email.service';
import { leavePolicyService } from './leave-policy.service';
import { logger } from '../utils/logger';
import { userHasPermission } from '../utils/permission-cache';
import { getDataScope } from '../utils/data-scope';
import {
  CreateLeaveRequestInput,
  UpdateLeaveRequestInput,
  QueryLeaveRequestsInput,
} from '../utils/leave.validation';
import { getEntitlementForEmployeeAndLeaveType } from '../utils/auto-credit-entitlement';
import { getAttendanceComponentForLeaveType } from '../utils/event-config';
import {
  canPerformAttendanceEventAction,
  resolveRightsAllocationContextForEmployee,
} from '../utils/rights-allocation';
import { resolveWorkflowForEmployeeOrNull } from './workflow-resolution.service';
import {
  getFirstApprover,
  getNextApprover,
  parseApprovalLevels,
  type ApprovalLevelConfig,
} from './approval-routing.service';
import { shiftAssignmentRuleService } from './shift-assignment-rule.service';
import { monthlyAttendanceSummaryService } from './monthly-attendance-summary.service';

export class LeaveRequestService {
  private readonly hrEntryRequiredLeaveNameKeys = [
    'paternityleave',
    'marriageleave',
    'bereavementleave',
  ];

  private readonly fixedDurationLeaveNameKeys = [
    'marriageleave',
    'maternityleave',
    'paternityleave',
    'beverageleave',
    'bereavementleave',
  ];

  private normalizeEventKey(value: string | null | undefined): string {
    return (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  private isCarryForwardEligibleLeaveType(leaveType: { name?: string | null; code?: string | null }): boolean {
    const code = (leaveType.code || '').trim().toUpperCase();
    const nameKey = this.normalizeEventKey(leaveType.name);
    return code === 'EL' || code === 'SL' || nameKey === 'earnedleave' || nameKey === 'sickleave';
  }

  private isFixedDurationLeaveType(leaveType: { name?: string | null; code?: string | null }): boolean {
    const nameKey = this.normalizeEventKey(leaveType.name);
    const codeKey = this.normalizeEventKey(leaveType.code);
    return this.fixedDurationLeaveNameKeys.some(
      (k) => nameKey.includes(k) || codeKey === k
    );
  }

  private isForcedZeroOpeningLeaveType(leaveType: { name?: string | null; code?: string | null }): boolean {
    void leaveType;
    return false;
  }

  private isHrEntryRequiredLeaveType(leaveType: { name?: string | null; code?: string | null }): boolean {
    const nameKey = this.normalizeEventKey(leaveType.name);
    const codeKey = this.normalizeEventKey(leaveType.code);
    return this.hrEntryRequiredLeaveNameKeys.some((k) => nameKey.includes(k) || codeKey === k);
  }

  private isUuid(value: string | null | undefined): boolean {
    if (!value) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }

  private parseApprovalAttendanceEvents(value: unknown): Array<{
    id?: string;
    name?: string;
    applicable?: boolean;
    toApprove?: boolean;
    cancelApproval?: boolean;
  }> {
    if (!Array.isArray(value)) return [];
    return value
      .filter((v) => v && typeof v === 'object')
      .map((v) => v as { id?: string; name?: string; applicable?: boolean; toApprove?: boolean });
  }

  private async assertApprovalAllowedForLeaveEvent(params: {
    organizationId: string;
    approvalWorkflowId?: string | null;
    leaveType: { name?: string | null; code?: string | null };
    attendanceComponentId?: string | null;
    action: 'toApprove' | 'cancelApproval';
  }): Promise<void> {
    const { organizationId, approvalWorkflowId, leaveType, attendanceComponentId, action } = params;
    if (!this.isUuid(approvalWorkflowId)) return;

    const workflow = await prisma.approvalWorkflow.findFirst({
      where: { id: approvalWorkflowId!, organizationId },
      select: { attendanceEvents: true },
    });
    if (!workflow) return;

    const events = this.parseApprovalAttendanceEvents(workflow.attendanceEvents);
    if (!events.length) return;

    let component: { eventName: string | null; shortName: string | null } | null = null;
    if (attendanceComponentId) {
      component = await prisma.attendanceComponent.findUnique({
        where: { id: attendanceComponentId },
        select: { eventName: true, shortName: true },
      });
    }

    const keys = new Set(
      [
        this.normalizeEventKey(leaveType.name),
        this.normalizeEventKey(leaveType.code),
        this.normalizeEventKey(component?.eventName),
        this.normalizeEventKey(component?.shortName),
      ].filter(Boolean)
    );

    const matched =
      events.find((e) => attendanceComponentId && e.id && String(e.id) === String(attendanceComponentId)) ||
      events.find((e) => {
        const n = this.normalizeEventKey(e.name);
        return n ? keys.has(n) : false;
      });

    if (!matched) return;
    if (matched.applicable === false || matched[action] === false) {
      throw new AppError(
        `${action === 'cancelApproval' ? 'Cancel approval' : 'Approval'} is not allowed for ${leaveType.name || 'this event'} in current approval workflow.`,
        403
      );
    }
  }

  private parseDateOnly(input: string): Date {
    const [y, m, d] = input.split('-').map(Number);
    return new Date(Date.UTC(y, (m || 1) - 1, d || 1, 0, 0, 0, 0));
  }

  private formatDateOnly(date: Date): string {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /**
   * Validate whether current reviewer can act on the leave request.
   * - Assigned approver can always act
   * - Users with can_edit on /leave can act within same organization (HR/OrgAdmin level)
   * - Users with can_edit on /organizations can act cross-org (Super Admin level)
   */
  private async validateReviewerAccess(
    reviewerId: string,
    _reviewerRole: string | undefined,
    leaveRequest: {
      assignedApproverEmployeeId?: string | null;
      employee: { reportingManagerId?: string | null; organizationId: string };
    }
  ): Promise<{ id: string }> {
    const reviewerEmployee = await prisma.employee.findUnique({
      where: { userId: reviewerId },
      select: { id: true, organizationId: true },
    });

    if (!reviewerEmployee) {
      throw new AppError('Reviewer employee record not found', 404);
    }

    const assignedApproverId =
      leaveRequest.assignedApproverEmployeeId ?? leaveRequest.employee.reportingManagerId;
    const isAssignedApprover = assignedApproverId === reviewerEmployee.id;
    const hasLeaveEditAccess = userHasPermission(reviewerId, '/leave', 'can_edit');
    const isOrgHrApprover =
      hasLeaveEditAccess &&
      reviewerEmployee.organizationId === leaveRequest.employee.organizationId;
    const hasCrossOrgAccess = userHasPermission(reviewerId, '/organizations', 'can_edit');

    if (!isAssignedApprover && !isOrgHrApprover && !hasCrossOrgAccess) {
      throw new AppError(
        'Access denied. You are not the assigned approver for this request.',
        403
      );
    }

    return { id: reviewerEmployee.id };
  }

  /**
   * Calculate total days between two dates (excluding weekends)
   */
  private calculateTotalDays(startDate: Date, endDate: Date): number {
    let totalDays = 0;
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();
      // Exclude weekends (Saturday = 6, Sunday = 0)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        totalDays++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return totalDays;
  }

  /**
   * Calculate inclusive calendar days between two dates.
   */
  private calculateCalendarDays(startDate: Date, endDate: Date): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setUTCHours(0, 0, 0, 0);
    end.setUTCHours(0, 0, 0, 0);
    const diffMs = end.getTime() - start.getTime();
    if (diffMs < 0) return 0;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
  }

  /**
   * Check for overlapping leave requests (enhanced conflict detection)
   */
  private async checkOverlap(
    employeeId: string,
    startDate: Date,
    endDate: Date,
    excludeRequestId?: string
  ): Promise<{ hasConflict: boolean; conflictingRequest?: any }> {
    const overlapping = await prisma.leaveRequest.findFirst({
      where: {
        employeeId,
        id: excludeRequestId ? { not: excludeRequestId } : undefined,
        status: { in: ['PENDING', 'APPROVED'] },
        OR: [
          {
            AND: [
              { startDate: { lte: endDate } },
              { endDate: { gte: startDate } },
            ],
          },
        ],
      },
      include: {
        leaveType: {
          select: {
            name: true,
            code: true,
          },
        },
      },
    });

    return {
      hasConflict: !!overlapping,
      conflictingRequest: overlapping || undefined,
    };
  }

  /**
   * Check if date is weekend (Saturday/Sunday)
   */
  private async isWeekOffForEmployee(employeeId: string, organizationId: string, date: Date): Promise<boolean> {
    const weekOff = await shiftAssignmentRuleService.getApplicableWeekOffForEmployee(
      employeeId,
      date,
      organizationId
    );
    if (weekOff) return true;

    // Fallback when no week-off rule is configured: Sunday only.
    return date.getDay() === 0;
  }

  /**
   * Check if date is a holiday for the organization
   */
  private async isHoliday(organizationId: string, date: Date): Promise<boolean> {
    const dateOnly = new Date(date);
    dateOnly.setUTCHours(0, 0, 0, 0);
    const holiday = await prisma.holiday.findFirst({
      where: {
        organizationId,
        date: dateOnly,
      },
    });
    return !!holiday;
  }

  /**
   * Validate leave range has at least one eligible day based on
   * Allow WeekOff / Allow Holiday flags.
   */
  private async validateWeekOffAndHoliday(
    employeeId: string,
    organizationId: string,
    startDate: Date,
    endDate: Date,
    allowWeekOff: boolean,
    allowHoliday: boolean
  ): Promise<{ valid: boolean; reason?: string }> {
    if (allowWeekOff && allowHoliday) return { valid: true };
    let hasEligibleDay = false;
    let firstBlockedLabel: string | null = null;
    const current = new Date(startDate);
    current.setUTCHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setUTCHours(23, 59, 59, 999);
    while (current <= end) {
      const isWeekOff = await this.isWeekOffForEmployee(employeeId, organizationId, current);
      const isHoliday = await this.isHoliday(organizationId, current);
      const canCountByWeekOff = allowWeekOff || !isWeekOff;
      const canCountByHoliday = allowHoliday || !isHoliday;

      if (canCountByWeekOff && canCountByHoliday) {
        hasEligibleDay = true;
      } else if (!firstBlockedLabel) {
        if (!allowWeekOff && isWeekOff) {
          firstBlockedLabel = `${this.formatDateOnly(current)} is a weekend.`;
        } else if (!allowHoliday && isHoliday) {
          firstBlockedLabel = `${this.formatDateOnly(current)} is a holiday.`;
        }
      }
      current.setUTCDate(current.getUTCDate() + 1);
    }
    if (!hasEligibleDay) {
      return {
        valid: false,
        reason:
          `Selected date range has no eligible leave days for this leave type.` +
          (firstBlockedLabel ? ` ${firstBlockedLabel}` : ''),
      };
    }
    return { valid: true };
  }

  private async countEligibleDaysInRange(
    employeeId: string,
    organizationId: string,
    startDate: Date,
    endDate: Date,
    allowWeekOff: boolean,
    allowHoliday: boolean
  ): Promise<number> {
    let count = 0;
    const current = new Date(startDate);
    current.setUTCHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setUTCHours(0, 0, 0, 0);
    while (current <= end) {
      const isWeekOff = await this.isWeekOffForEmployee(employeeId, organizationId, current);
      const isHoliday = await this.isHoliday(organizationId, current);
      const canCountByWeekOff = allowWeekOff || !isWeekOff;
      const canCountByHoliday = allowHoliday || !isHoliday;
      if (canCountByWeekOff && canCountByHoliday) count += 1;
      current.setUTCDate(current.getUTCDate() + 1);
    }
    return count;
  }

  private async calculateEndDateForEligibleDays(params: {
    employeeId: string;
    organizationId: string;
    startDate: Date;
    requiredDays: number;
    allowWeekOff: boolean;
    allowHoliday: boolean;
  }): Promise<Date> {
    const { employeeId, organizationId, startDate, requiredDays, allowWeekOff, allowHoliday } = params;
    const cursor = new Date(startDate);
    cursor.setUTCHours(0, 0, 0, 0);
    let remaining = Math.max(0, Math.floor(requiredDays));
    if (remaining === 0) return cursor;
    while (remaining > 0) {
      const isWeekOff = await this.isWeekOffForEmployee(employeeId, organizationId, cursor);
      const isHoliday = await this.isHoliday(organizationId, cursor);
      const canCountByWeekOff = allowWeekOff || !isWeekOff;
      const canCountByHoliday = allowHoliday || !isHoliday;
      if (canCountByWeekOff && canCountByHoliday) {
        remaining -= 1;
      }
      if (remaining > 0) cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return cursor;
  }

  private normalizeKey(value: string | null | undefined): string {
    return (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  private isPermissionLikeLeaveType(leaveType: { name?: string | null; code?: string | null }): boolean {
    const key = `${leaveType.name || ''} ${leaveType.code || ''}`.toLowerCase();
    return key.includes('permission');
  }

  private parsePermissionMinutes(reason: string | null | undefined): number {
    if (!reason) return 0;
    const match = reason.match(/^\[Permission\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\]/i);
    if (!match) return 0;
    const [hFrom, mFrom] = match[1].split(':').map(Number);
    const [hTo, mTo] = match[2].split(':').map(Number);
    return Math.max(0, (hTo * 60 + mTo) - (hFrom * 60 + mFrom));
  }

  private readPermissionMonthlyLimit(ruleDef: unknown, remarks?: string | null): number | null {
    if (ruleDef && typeof ruleDef === 'object') {
      const r = ruleDef as Record<string, unknown>;
      const candidates = [r.occasionsInMonth, r.maxEventAvailDaysInMonth];
      for (const v of candidates) {
        const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.trim()) : NaN;
        if (Number.isFinite(n) && n > 0) return Math.floor(n);
      }
    }
    if (remarks && remarks.trim()) {
      const m =
        remarks.match(/(\d+)\s*(times|time|count|occasion)/i) ||
        remarks.match(/\bmonthly\s*(\d+)\b/i);
      if (m && m[1]) {
        const n = Number(m[1]);
        if (Number.isFinite(n) && n > 0) return Math.floor(n);
      }
    }
    return null;
  }

  private async enforceMonthlyPermissionLimit(
    employee: {
      id: string;
      organizationId: string;
      paygroupId?: string | null;
      departmentId?: string | null;
      employeeCode?: string | null;
    },
    leaveType: { id: string; name?: string | null; code?: string | null },
    startDate: Date,
    endDate: Date,
    incomingReason: string
  ): Promise<void> {
    if (!this.isPermissionLikeLeaveType(leaveType)) return;

    const MAX_MINUTES_PER_REQUEST = 120;
    const MAX_MINUTES_PER_MONTH = 240;
    const MAX_COUNT_PER_MONTH = 2;

    // Per-request duration check (max 2 hours)
    const incomingMinutes = this.parsePermissionMinutes(incomingReason);
    if (incomingMinutes > MAX_MINUTES_PER_REQUEST) {
      throw new AppError(
        `Permission cannot exceed 2 hours per request. Requested: ${incomingMinutes} minutes.`,
        400
      );
    }

    const isRuleApplicableToEmployee = (r: {
      paygroupId?: string | null;
      departmentId?: string | null;
      associate?: string | null;
    }) => {
      if (r.paygroupId && r.paygroupId !== employee.paygroupId) return false;
      if (r.departmentId && r.departmentId !== employee.departmentId) return false;
      if (r.associate) {
        const a = r.associate.trim();
        if (a && a !== employee.employeeCode && a !== employee.id) return false;
      }
      return true;
    };

    const leaveTypeNameKey = this.normalizeKey(leaveType.name);
    const leaveTypeCodeKey = this.normalizeKey(leaveType.code);
    const ruleSettings = await prisma.ruleSetting.findMany({
      where: { organizationId: employee.organizationId },
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
    });

    const matchingRule = ruleSettings.find((r) => {
      if (!isRuleApplicableToEmployee(r)) return false;
      const eventTypeKey = this.normalizeKey(r.eventType);
      const displayNameKey = this.normalizeKey(r.displayName);
      const isPermissionRule =
        eventTypeKey.includes('permission') ||
        displayNameKey.includes('permission') ||
        (leaveTypeNameKey && (eventTypeKey === leaveTypeNameKey || displayNameKey === leaveTypeNameKey)) ||
        (leaveTypeCodeKey && (eventTypeKey === leaveTypeCodeKey || displayNameKey === leaveTypeCodeKey));
      return isPermissionRule;
    });

    const monthlyLimit = this.readPermissionMonthlyLimit(
      matchingRule?.eventRuleDefinition,
      matchingRule?.remarks ?? null
    );
    // Use hardcoded default if no RuleSetting configured
    const countLimit = monthlyLimit ?? MAX_COUNT_PER_MONTH;

    const monthStart = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1, 0, 0, 0, 0));
    const monthEnd = new Date(
      Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, 0, 23, 59, 59, 999)
    );
    const permissionReasonRegex = /^\[Permission\s+\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}\]/i;

    const existingMonthlyRequests = await prisma.leaveRequest.findMany({
      where: {
        employeeId: employee.id,
        status: { in: [LeaveStatus.PENDING, LeaveStatus.APPROVED] },
        startDate: { lte: monthEnd },
        endDate: { gte: monthStart },
      },
      include: {
        leaveType: {
          select: { name: true, code: true },
        },
      },
    });

    const permissionRequests = existingMonthlyRequests.filter((lr) => {
      if (permissionReasonRegex.test(lr.reason || '')) return true;
      return this.isPermissionLikeLeaveType(lr.leaveType);
    });
    const usedPermissionCount = permissionRequests.length;

    if (usedPermissionCount >= countLimit) {
      throw new AppError(
        `Monthly permission limit reached. Allowed: ${countLimit}, Used: ${usedPermissionCount}.`,
        400
      );
    }

    // Total monthly duration check (max 4 hours)
    if (incomingMinutes > 0) {
      const existingTotalMinutes = permissionRequests.reduce(
        (sum, lr) => sum + this.parsePermissionMinutes(lr.reason),
        0
      );
      if (existingTotalMinutes + incomingMinutes > MAX_MINUTES_PER_MONTH) {
        const remainingMinutes = Math.max(0, MAX_MINUTES_PER_MONTH - existingTotalMinutes);
        throw new AppError(
          `Monthly permission time limit reached. Used: ${existingTotalMinutes} min, Remaining: ${remainingMinutes} min, Requested: ${incomingMinutes} min.`,
          400
        );
      }
    }

    // Also block cross-month multi-day permission requests.
    if (endDate.getUTCFullYear() !== startDate.getUTCFullYear() || endDate.getUTCMonth() !== startDate.getUTCMonth()) {
      throw new AppError('Permission can be applied only within a single month.', 400);
    }
  }

  /**
   * Check for blackout periods
   */
  private async checkBlackoutPeriods(
    organizationId: string,
    leaveTypeId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ hasBlackout: boolean; reason?: string }> {
    // Get leave policy for this leave type
    const policy = await prisma.leavePolicy.findFirst({
      where: {
        organizationId,
        leaveTypeId,
        isActive: true,
      },
    });

    if (!policy || !policy.blackoutPeriods || !Array.isArray(policy.blackoutPeriods)) {
      return { hasBlackout: false };
    }

    // Check if request dates fall within any blackout period
    for (const period of policy.blackoutPeriods) {
      if (typeof period === 'object' && period !== null && 'start' in period && 'end' in period) {
        const periodObj = period as { start: string; end: string; reason?: string };
        const blackoutStart = new Date(periodObj.start);
        const blackoutEnd = new Date(periodObj.end);

        if (
          (startDate >= blackoutStart && startDate <= blackoutEnd) ||
          (endDate >= blackoutStart && endDate <= blackoutEnd) ||
          (startDate <= blackoutStart && endDate >= blackoutEnd)
        ) {
          return {
            hasBlackout: true,
            reason: periodObj.reason || `Leave not allowed during blackout period: ${periodObj.start} to ${periodObj.end}`,
          };
        }
      }
    }

    return { hasBlackout: false };
  }

  /**
   * Get or create leave balance for employee. When creating, entitlement is taken only from
   * Auto Credit settings that match the employee's department and paygroup.
   */
  private async getOrCreateLeaveBalance(
    employeeId: string,
    leaveTypeId: string,
    year: number
  ) {
    let balance = await prisma.employeeLeaveBalance.findUnique({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId,
          leaveTypeId,
          year,
        },
      },
    });

    if (balance) {
      const leaveType = await prisma.leaveType.findUnique({
        where: { id: leaveTypeId },
        select: { name: true, code: true },
      });
      if (leaveType && this.isHrEntryRequiredLeaveType(leaveType)) {
        const hasExplicitHrEntry = !!balance.fromDate && !!balance.toDate;
        if (!hasExplicitHrEntry) {
          const opening = Number(balance.openingBalance ?? 0);
          const accrued = Number(balance.accrued ?? 0);
          const carry = Number(balance.carriedForward ?? 0);
          const available = Number(balance.available ?? 0);
          if (opening > 0 || accrued > 0 || carry > 0 || available > 0) {
            balance = await prisma.employeeLeaveBalance.update({
              where: {
                employeeId_leaveTypeId_year: {
                  employeeId,
                  leaveTypeId,
                  year,
                },
              },
              data: {
                openingBalance: new Prisma.Decimal(0),
                accrued: new Prisma.Decimal(0),
                carriedForward: new Prisma.Decimal(0),
                available: new Prisma.Decimal(0),
              },
            });
          }
        }
      }
      if (leaveType && this.isForcedZeroOpeningLeaveType(leaveType)) {
        const opening = Number(balance.openingBalance ?? 0);
        const accrued = Number(balance.accrued ?? 0);
        const carry = Number(balance.carriedForward ?? 0);
        if (opening > 0 || accrued > 0 || carry > 0) {
          balance = await prisma.employeeLeaveBalance.update({
            where: {
              employeeId_leaveTypeId_year: {
                employeeId,
                leaveTypeId,
                year,
              },
            },
            data: {
              openingBalance: new Prisma.Decimal(0),
              accrued: new Prisma.Decimal(0),
              carriedForward: new Prisma.Decimal(0),
              available: new Prisma.Decimal(0),
            },
          });
        }
      }
      if (leaveType && !this.isCarryForwardEligibleLeaveType(leaveType)) {
        const existingCarry = Number(balance.carriedForward ?? 0);
        if (existingCarry > 0) {
          const opening = Number(balance.openingBalance ?? 0);
          const used = Number(balance.used ?? 0);
          balance = await prisma.employeeLeaveBalance.update({
            where: {
              employeeId_leaveTypeId_year: {
                employeeId,
                leaveTypeId,
                year,
              },
            },
            data: {
              carriedForward: new Prisma.Decimal(0),
              available: new Prisma.Decimal(Math.max(0, opening - used)),
            },
          });
        }
      }
    } else {
      const [employee, leaveType] = await Promise.all([
        prisma.employee.findUnique({
          where: { id: employeeId },
          select: {
            id: true,
            organizationId: true,
            paygroupId: true,
            departmentId: true,
            employeeCode: true,
            dateOfJoining: true,
          },
        }),
        prisma.leaveType.findUnique({
          where: { id: leaveTypeId },
        }),
      ]);

      if (!leaveType) {
        throw new AppError('Leave type not found', 404);
      }
      if (!employee) {
        throw new AppError('Employee not found', 404);
      }

      const { entitlement } = await getEntitlementForEmployeeAndLeaveType(
        employee.organizationId,
        employee,
        leaveType,
        year
      );
      const forcedZeroOpening = this.isForcedZeroOpeningLeaveType(leaveType);
      const hrEntryRequired = this.isHrEntryRequiredLeaveType(leaveType);
      const previousYearBalance = await prisma.employeeLeaveBalance.findUnique({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId,
            leaveTypeId,
            year: year - 1,
          },
        },
        select: { available: true },
      });
      const previousAvailable = forcedZeroOpening || hrEntryRequired ? 0 : Math.max(0, Number(previousYearBalance?.available ?? 0));
      const maxCarryForward = !forcedZeroOpening && !hrEntryRequired && leaveType.maxCarryForward != null
        ? Math.max(0, Number(leaveType.maxCarryForward))
        : null;
      const carryForward = forcedZeroOpening || hrEntryRequired
        ? 0
        :
        maxCarryForward != null ? Math.min(previousAvailable, maxCarryForward) : previousAvailable;
      const effectiveEntitlement = forcedZeroOpening || hrEntryRequired ? 0 : entitlement;
      const available = Math.max(0, effectiveEntitlement + carryForward);
      const dec = (n: number) => new Prisma.Decimal(n);

      balance = await prisma.employeeLeaveBalance.create({
        data: {
          employeeId,
          leaveTypeId,
          year,
          openingBalance: dec(effectiveEntitlement),
          accrued: dec(effectiveEntitlement),
          carriedForward: dec(carryForward),
          available: dec(available),
        },
      });
    }

    return balance;
  }

  /**
   * Apply for leave
   */
  async create(
    employeeId: string,
    data: CreateLeaveRequestInput,
    _requesterRole?: string
  ) {
    // Verify employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      throw new AppError('Employee not found', 404);
    }

    // Verify leave type exists and is active
    const leaveType = await prisma.leaveType.findUnique({
      where: { id: data.leaveTypeId },
    });

    if (!leaveType) {
      throw new AppError('Leave type not found', 404);
    }

    if (!leaveType.isActive) {
      throw new AppError('Leave type is not active', 400);
    }

    // Verify leave type belongs to same organization
    if (leaveType.organizationId !== employee.organizationId) {
      throw new AppError('Leave type does not belong to your organization', 403);
    }

    // Parse dates
    const startDate = this.parseDateOnly(data.startDate);
    const endDate = this.parseDateOnly(data.endDate);

    // Validate date order
    if (endDate < startDate) {
      throw new AppError('Leave end date cannot be earlier than start date', 400);
    }

    // Validate dates
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    // Past-date apply is allowed.
    // Keep only date-format/order validation (handled by schema + parseDateOnly).

    // 1. Block if any month in range is locked (payroll closed for that period)
    const uniqueMonths = new Set<string>();
    const dateCursor = new Date(startDate);
    while (dateCursor <= endDate) {
      uniqueMonths.add(`${dateCursor.getUTCFullYear()}-${dateCursor.getUTCMonth() + 1}`);
      dateCursor.setUTCDate(dateCursor.getUTCDate() + 1);
    }
    for (const key of uniqueMonths) {
      const [year, month] = key.split('-').map(Number);
      const locked = await monthlyAttendanceSummaryService.isMonthLocked(
        employee.organizationId,
        year,
        month
      );
      if (locked) {
        throw new AppError(
          `Month ${year}-${String(month).padStart(2, '0')} is locked. Cannot apply leave to a locked period. Unlock attendance first to apply.`,
          400
        );
      }
    }

    // Check eligibility based on leave policy
    const eligibility = await leavePolicyService.checkEligibility(employeeId, data.leaveTypeId);
    if (!eligibility.eligible) {
      throw new AppError(eligibility.reason || 'You are not eligible for this leave type', 403);
    }

    // Check for overlapping requests (enhanced conflict detection)
    const overlapCheck = await this.checkOverlap(employeeId, startDate, endDate);
    if (overlapCheck.hasConflict && overlapCheck.conflictingRequest) {
      const conflict = overlapCheck.conflictingRequest;
      const leaveTypeName = conflict.leaveType?.name || 'Unknown';
      throw new AppError(
        `You already have a ${conflict.status.toLowerCase()} leave request (${leaveTypeName}) from ${conflict.startDate.toISOString().split('T')[0]} to ${conflict.endDate.toISOString().split('T')[0]}`,
        400
      );
    }

    // Check for blackout periods
    const blackoutCheck = await this.checkBlackoutPeriods(
      employee.organizationId,
      data.leaveTypeId,
      startDate,
      endDate
    );
    if (blackoutCheck.hasBlackout) {
      throw new AppError(blackoutCheck.reason || 'Leave not allowed during this period', 400);
    }

    // Event config: resolve AttendanceComponent for this leave type (by name/code)
    const component = await getAttendanceComponentForLeaveType(employee.organizationId, leaveType);
    const rightsContext = await resolveRightsAllocationContextForEmployee(
      employeeId,
      employee.organizationId,
      { effectiveDate: startDate }
    );
    const rightsAllocation = rightsContext.rights;
    const canAddEvent = canPerformAttendanceEventAction(rightsAllocation, 'add', {
      eventId: component?.id,
      leaveTypeName: leaveType.name,
      leaveTypeCode: leaveType.code,
    });
    if (!canAddEvent) {
      throw new AppError('You do not have permission to apply this event.', 403);
    }

    // Calculate total days (optional totalDays from body for half-day e.g. 0.5).
    // For leave types that allow week-off/holiday selection, count calendar days so
    // a full-day request on weekend/holiday is not incorrectly stored as half-day/0-day.
    const computedWorkingDays = this.calculateTotalDays(startDate, endDate);
    const computedCalendarDays = this.calculateCalendarDays(startDate, endDate);
    const computedEligibleDays = await this.countEligibleDaysInRange(
      employeeId,
      employee.organizationId,
      startDate,
      endDate,
      component?.allowWeekOffSelection ?? true,
      component?.allowHolidaySelection ?? true
    );
    const shouldCountCalendarDays =
      !!component && !!component.allowWeekOffSelection && !!component.allowHolidaySelection;
    const totalDays =
      data.totalDays != null
        ? data.totalDays
        : (shouldCountCalendarDays
            ? computedCalendarDays
            : component
              ? computedEligibleDays
              : computedWorkingDays);
    if (totalDays <= 0) {
      throw new AppError(
        'Selected date range has no eligible leave days. Please choose working days.',
        400
      );
    }

    // Allow Hourly = NO → reject half-day/hourly requests
    const isHourlyOrHalfDay = totalDays < 1 || totalDays % 1 !== 0;
    if (isHourlyOrHalfDay && component && !component.allowHourly) {
      throw new AppError(
        'This leave type does not allow hourly or half-day leave.',
        400
      );
    }

    // Allow WeekOff/Holiday = NO → block applying on those days
    const weekOffHolidayCheck = await this.validateWeekOffAndHoliday(
      employeeId,
      employee.organizationId,
      startDate,
      endDate,
      component?.allowWeekOffSelection ?? true,
      component?.allowHolidaySelection ?? true
    );
    if (!weekOffHolidayCheck.valid) {
      throw new AppError(weekOffHolidayCheck.reason ?? 'Leave dates not allowed for this leave type', 400);
    }

    // Check max consecutive days
    if (leaveType.maxConsecutiveDays && totalDays > leaveType.maxConsecutiveDays) {
      throw new AppError(
        `Maximum consecutive days for this leave type is ${leaveType.maxConsecutiveDays}`,
        400
      );
    }

    // Resolve workflow and first approver (rule-based, dynamic)
    let workflowMappingId: string | undefined;
    let currentApprovalLevel: number | undefined;
    let assignedApproverEmployeeId: string | undefined;
    let approvalLevels: ApprovalLevelConfig[] | null = null;

    const workflow = await resolveWorkflowForEmployeeOrNull(employeeId, employee.organizationId);
    if (workflow) {
      workflowMappingId = workflow.id;
      approvalLevels = parseApprovalLevels(workflow.approvalLevels);
      assignedApproverEmployeeId =
        (await getFirstApprover(employeeId, employee.organizationId, approvalLevels)) ?? undefined;
      currentApprovalLevel = 1;
    } else {
      assignedApproverEmployeeId = employee.reportingManagerId ?? undefined;
    }

    // Check advance notice requirement (from policy)
    const policy = await prisma.leavePolicy.findFirst({
      where: {
        organizationId: employee.organizationId,
        leaveTypeId: data.leaveTypeId,
        isActive: true,
      },
    });

    if (policy?.advanceNoticeDays && startDate >= today) {
      const daysUntilStart = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntilStart < policy.advanceNoticeDays) {
        throw new AppError(
          `Leave request must be submitted at least ${policy.advanceNoticeDays} days in advance`,
          400
        );
      }
    }

    // Check min/max days per request (from policy)
    if (policy?.minDaysPerRequest && totalDays < parseFloat(policy.minDaysPerRequest.toString())) {
      throw new AppError(
        `Minimum ${policy.minDaysPerRequest} days required per request for this leave type`,
        400
      );
    }

    if (policy?.maxDaysPerRequest && totalDays > parseFloat(policy.maxDaysPerRequest.toString())) {
      throw new AppError(
        `Maximum ${policy.maxDaysPerRequest} days allowed per request for this leave type`,
        400
      );
    }

    // Enforce monthly permission application limit from Rule Settings (server-side guard)
    await this.enforceMonthlyPermissionLimit(employee, leaveType, startDate, endDate, data.reason || '');

    // Use request start year for balance operations.
    const year = startDate.getUTCFullYear();

    // Onduty-marked requests should behave like non-balance events even when a fallback leave type is used.
    const isOndutyMarkedRequest = /^\[Onduty(?:\s+[^\]]+)?\]/i.test(data.reason || '');
    const hrEntryRequiredLeave = this.isHrEntryRequiredLeaveType(leaveType);
    // Has Balance = NO → do not maintain balance; skip balance check and deduction on approve
    const shouldCheckBalance =
      !isOndutyMarkedRequest && (hrEntryRequiredLeave || component === null || component.hasBalance);
    if (shouldCheckBalance) {
      const balance = await this.getOrCreateLeaveBalance(employeeId, data.leaveTypeId, year);
      const availableDays = parseFloat(balance.available.toString());

      if (this.isFixedDurationLeaveType(leaveType) && availableDays <= 0) {
        throw new AppError(
          `${leaveType.name} balance is exhausted. You cannot apply again.`,
          400
        );
      }
      if (totalDays > availableDays && !leaveType.canBeNegative) {
        throw new AppError(
          `Insufficient leave balance. Available: ${availableDays} days, Requested: ${totalDays} days`,
          400
        );
      }
      if (this.isFixedDurationLeaveType(leaveType) && availableDays > 0) {
        const isExact = Math.abs(totalDays - availableDays) < 0.0001;
        if (!isExact) {
          throw new AppError(
            `${leaveType.name} must be applied for exactly ${availableDays} day(s) based on your opening balance.`,
            400
          );
        }
      }
    }

    // Create leave request (using Prisma connect for relations)
    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        employee: { connect: { id: employeeId } },
        leaveType: { connect: { id: data.leaveTypeId } },
        startDate,
        endDate,
        totalDays: new Prisma.Decimal(totalDays),
        reason: data.reason,
        supportingDocuments: data.supportingDocuments || undefined,
        status: LeaveStatus.PENDING,
        ...(workflowMappingId && {
          workflowMapping: { connect: { id: workflowMappingId } },
        }),
        currentApprovalLevel: currentApprovalLevel ?? undefined,
        ...(assignedApproverEmployeeId && {
          assignedApprover: { connect: { id: assignedApproverEmployeeId } },
        }),
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            employeeCode: true,
            reportingManagerId: true,
          },
        },
        leaveType: {
          select: {
            id: true,
            name: true,
            code: true,
            isPaid: true,
          },
        },
      },
    });

    // Immediately deduct leave balance when leave is applied (PENDING)
    if (shouldCheckBalance) {
      const balance = await this.getOrCreateLeaveBalance(employeeId, data.leaveTypeId, year);
      const usedDays = parseFloat(balance.used.toString()) + totalDays;
      const availableDays = parseFloat(balance.available.toString()) - totalDays;
      await prisma.employeeLeaveBalance.update({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId,
            leaveTypeId: data.leaveTypeId,
            year,
          },
        },
        data: {
          used: new Prisma.Decimal(usedDays),
          available: new Prisma.Decimal(Math.max(0, availableDays)),
        },
      });
    }

    // Send notification to employee
    try {
      await emailService.sendLeaveRequestSubmittedEmail(
        employee.email,
        `${employee.firstName} ${employee.lastName}`,
        leaveType.name,
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0],
        totalDays
      );
    } catch (error) {
      logger.error('Failed to send leave request submitted email:', error);
      // Don't fail the request if email fails
    }

    // Send notification to assigned approver (from workflow) or reporting manager
    const approverEmployeeId = assignedApproverEmployeeId ?? employee.reportingManagerId;
    if (approverEmployeeId) {
      try {
        const approver = await prisma.employee.findUnique({
          where: { id: approverEmployeeId },
          include: {
            user: {
              select: {
                email: true,
              },
            },
          },
        });

        if (approver?.user?.email) {
          await emailService.sendLeaveRequestPendingEmail(
            approver.user.email,
            `${approver.firstName} ${approver.lastName}`,
            `${employee.firstName} ${employee.lastName}`,
            leaveType.name,
            startDate.toISOString().split('T')[0],
            endDate.toISOString().split('T')[0],
            leaveRequest.id
          );
        }
      } catch (error) {
        logger.error('Failed to send leave request pending email to approver:', error);
        // Don't fail the request if email fails
      }
    }

    return leaveRequest;
  }

  /**
   * HR direct leave assignment — creates leave as APPROVED immediately, bypassing approval workflow.
   * Roles allowed: HR_MANAGER, ORG_ADMIN, SUPER_ADMIN.
   */
  async createByHR(
    hrUserId: string,
    targetEmployeeId: string,
    data: CreateLeaveRequestInput,
    _requesterRole?: string
  ) {
    // Fetch HR/Manager employee record for audit trail
    const hrEmployee = await prisma.employee.findUnique({
      where: { userId: hrUserId },
      select: { id: true, organizationId: true, userId: true },
    });
    if (!hrEmployee) {
      throw new AppError('Employee record not found', 404);
    }

    // Fetch target employee
    const employee = await prisma.employee.findUnique({
      where: { id: targetEmployeeId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        organizationId: true,
        reportingManagerId: true,
        paygroupId: true,
        departmentId: true,
        employeeCode: true,
        dateOfJoining: true,
      },
    });
    if (!employee) {
      throw new AppError('Target employee not found', 404);
    }

    // Permission check: HR/Admin (can_add on /leave) OR Manager applying for their own subordinate
    const hasHRPermission = userHasPermission(hrUserId, '/leave', 'can_add')
      || _requesterRole === 'HR_MANAGER'
      || _requesterRole === 'ORG_ADMIN'
      || _requesterRole === 'SUPER_ADMIN';

    if (!hasHRPermission) {
      if (_requesterRole === 'MANAGER') {
        // Manager can only assign leave for direct subordinates
        if (employee.reportingManagerId !== hrEmployee.id) {
          throw new AppError('Access denied. You can only assign leave for your direct reports.', 403);
        }
      } else {
        throw new AppError('You do not have permission to directly assign leave.', 403);
      }
    }

    // Verify same organization (users with org-level access can cross orgs)
    if (!userHasPermission(hrUserId, '/organizations', 'can_edit') && hrEmployee.organizationId !== employee.organizationId) {
      throw new AppError('You can only assign leave for employees in your organization.', 403);
    }

    // Verify leave type
    const leaveType = await prisma.leaveType.findUnique({ where: { id: data.leaveTypeId } });
    if (!leaveType) throw new AppError('Leave type not found', 404);
    if (!leaveType.isActive) throw new AppError('Leave type is not active', 400);
    if (leaveType.organizationId !== employee.organizationId) {
      throw new AppError('Leave type does not belong to the employee\'s organization', 403);
    }

    // Parse and validate dates
    const startDate = this.parseDateOnly(data.startDate);
    const endDate = this.parseDateOnly(data.endDate);
    if (endDate < startDate) {
      throw new AppError('Leave end date cannot be earlier than start date', 400);
    }

    // Month lock check
    const uniqueMonths = new Set<string>();
    const dateCursor = new Date(startDate);
    while (dateCursor <= endDate) {
      uniqueMonths.add(`${dateCursor.getUTCFullYear()}-${dateCursor.getUTCMonth() + 1}`);
      dateCursor.setUTCDate(dateCursor.getUTCDate() + 1);
    }
    for (const key of uniqueMonths) {
      const [year, month] = key.split('-').map(Number);
      const locked = await monthlyAttendanceSummaryService.isMonthLocked(
        employee.organizationId,
        year,
        month
      );
      if (locked) {
        throw new AppError(
          `Month ${year}-${String(month).padStart(2, '0')} is locked. Unlock attendance first.`,
          400
        );
      }
    }

    // Overlap check
    const overlapCheck = await this.checkOverlap(targetEmployeeId, startDate, endDate);
    if (overlapCheck.hasConflict && overlapCheck.conflictingRequest) {
      const conflict = overlapCheck.conflictingRequest;
      const leaveTypeName = conflict.leaveType?.name || 'Unknown';
      throw new AppError(
        `Employee already has a ${conflict.status.toLowerCase()} leave request (${leaveTypeName}) from ${conflict.startDate.toISOString().split('T')[0]} to ${conflict.endDate.toISOString().split('T')[0]}`,
        400
      );
    }

    // Blackout check
    const blackoutCheck = await this.checkBlackoutPeriods(
      employee.organizationId,
      data.leaveTypeId,
      startDate,
      endDate
    );
    if (blackoutCheck.hasBlackout) {
      throw new AppError(blackoutCheck.reason || 'Leave not allowed during this period', 400);
    }

    // Resolve attendance component
    const component = await getAttendanceComponentForLeaveType(employee.organizationId, leaveType);

    // Calculate totalDays
    const computedCalendarDays = this.calculateCalendarDays(startDate, endDate);
    const computedEligibleDays = await this.countEligibleDaysInRange(
      targetEmployeeId,
      employee.organizationId,
      startDate,
      endDate,
      component?.allowWeekOffSelection ?? true,
      component?.allowHolidaySelection ?? true
    );
    const shouldCountCalendarDays =
      !!component && !!component.allowWeekOffSelection && !!component.allowHolidaySelection;
    const totalDays =
      data.totalDays != null
        ? data.totalDays
        : shouldCountCalendarDays
          ? computedCalendarDays
          : component
            ? computedEligibleDays
            : this.calculateTotalDays(startDate, endDate);

    if (totalDays <= 0) {
      throw new AppError('Selected date range has no eligible leave days.', 400);
    }

    // Balance check (HR can still be blocked by zero balance unless canBeNegative)
    const year = startDate.getUTCFullYear();
    const isOndutyMarkedRequest = /^\[Onduty(?:\s+[^\]]+)?\]/i.test(data.reason || '');
    const hrEntryRequiredLeave = this.isHrEntryRequiredLeaveType(leaveType);
    const shouldCheckBalance =
      !isOndutyMarkedRequest && (hrEntryRequiredLeave || component === null || component.hasBalance);
    const shouldDeductBalance = shouldCheckBalance;

    if (shouldCheckBalance) {
      const balance = await this.getOrCreateLeaveBalance(targetEmployeeId, data.leaveTypeId, year);
      const availableDays = parseFloat(balance.available.toString());
      if (this.isFixedDurationLeaveType(leaveType) && availableDays <= 0) {
        throw new AppError(`${leaveType.name} balance is exhausted.`, 400);
      }
      if (totalDays > availableDays && !leaveType.canBeNegative) {
        throw new AppError(
          `Insufficient leave balance. Available: ${availableDays} days, Requested: ${totalDays} days`,
          400
        );
      }
    }

    // Create leave request directly as APPROVED
    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        employee: { connect: { id: targetEmployeeId } },
        leaveType: { connect: { id: data.leaveTypeId } },
        startDate,
        endDate,
        totalDays: new Prisma.Decimal(totalDays),
        reason: data.reason,
        supportingDocuments: data.supportingDocuments || undefined,
        status: LeaveStatus.APPROVED,
        reviewedBy: hrEmployee.userId,
        reviewedAt: new Date(),
        approvalHistory: [
          {
            level: 0,
            approverEmployeeId: hrEmployee.id,
            reviewedAt: new Date().toISOString(),
            action: 'APPROVED_BY_HR',
          },
        ],
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            employeeCode: true,
          },
        },
        leaveType: {
          select: {
            id: true,
            name: true,
            code: true,
            isPaid: true,
          },
        },
      },
    });

    // Immediately deduct leave balance
    if (shouldDeductBalance) {
      const balance = await this.getOrCreateLeaveBalance(targetEmployeeId, data.leaveTypeId, year);
      const usedDays = parseFloat(balance.used.toString()) + totalDays;
      const availableDays = parseFloat(balance.available.toString()) - totalDays;
      await prisma.employeeLeaveBalance.update({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId: targetEmployeeId,
            leaveTypeId: data.leaveTypeId,
            year,
          },
        },
        data: {
          used: new Prisma.Decimal(usedDays),
          available: new Prisma.Decimal(Math.max(0, availableDays)),
        },
      });
    }

    // Create attendance records for each day
    const leaveTypeKey = `${leaveType.name || ''} ${leaveType.code || ''}`.toLowerCase();
    const isOndutyOrWorkFromHome =
      leaveTypeKey.includes('on duty') ||
      leaveTypeKey.includes('onduty') ||
      leaveTypeKey.includes('work from home') ||
      leaveTypeKey.includes('wfh');
    const approvedAttendanceStatus = isOndutyOrWorkFromHome ? AttendanceStatus.PRESENT : AttendanceStatus.LEAVE;
    const approvedAttendanceNote = isOndutyOrWorkFromHome
      ? `Present: Full Day (${leaveType.name ?? 'On Duty'})`
      : `Leave: ${leaveType.name ?? 'Approved leave'}`;
    const allowWeekOffSelection = component?.allowWeekOffSelection ?? true;
    const allowHolidaySelection = component?.allowHolidaySelection ?? true;

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateOnly = new Date(d);
      dateOnly.setHours(0, 0, 0, 0);
      let statusForDay: AttendanceStatus = approvedAttendanceStatus;
      let notesForDay = approvedAttendanceNote;

      if (!isOndutyOrWorkFromHome) {
        const isWeekOff = !allowWeekOffSelection
          ? await this.isWeekOffForEmployee(targetEmployeeId, employee.organizationId, dateOnly)
          : false;
        const isHoliday = !allowHolidaySelection
          ? await this.isHoliday(employee.organizationId, dateOnly)
          : false;

        if (isWeekOff) {
          statusForDay = AttendanceStatus.WEEKEND;
          notesForDay = 'Week Off';
        } else if (isHoliday) {
          statusForDay = AttendanceStatus.HOLIDAY;
          notesForDay = 'Holiday';
        }
      }

      await prisma.attendanceRecord.upsert({
        where: {
          employeeId_date: { employeeId: targetEmployeeId, date: dateOnly },
        },
        create: {
          employeeId: targetEmployeeId,
          date: dateOnly,
          status: statusForDay,
          notes: notesForDay,
        },
        update: {
          status: statusForDay,
          notes: notesForDay,
        },
      });
    }

    // Rebuild attendance summaries for affected months
    const affectedMonths = new Set<string>();
    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      affectedMonths.add(`${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`);
    }
    for (const key of affectedMonths) {
      const [y, m] = key.split('-').map(Number);
      await monthlyAttendanceSummaryService.tryRebuildSummaryForDate(
        employee.organizationId,
        targetEmployeeId,
        new Date(y, m - 1, 15)
      );
    }

    return leaveRequest;
  }

  async getApplyHint(employeeId: string, query: { leaveTypeId: string; startDate: string }) {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, organizationId: true },
    });
    if (!employee) throw new AppError('Employee not found', 404);

    const leaveType = await prisma.leaveType.findUnique({
      where: { id: query.leaveTypeId },
      select: {
        id: true,
        name: true,
        code: true,
        organizationId: true,
      },
    });
    if (!leaveType) throw new AppError('Leave type not found', 404);
    if (leaveType.organizationId !== employee.organizationId) {
      throw new AppError('Leave type does not belong to your organization', 403);
    }

    const startDate = this.parseDateOnly(query.startDate);
    const year = startDate.getUTCFullYear();
    const balance = await this.getOrCreateLeaveBalance(employeeId, leaveType.id, year);
    const openingBalance = Number(balance.openingBalance ?? 0);
    const usedBalance = Number(balance.used ?? 0);
    const availableBalance = Number(balance.available ?? 0);
    const fixedDurationEnforced = this.isFixedDurationLeaveType(leaveType);
    const fixedDays = fixedDurationEnforced ? Math.max(0, Math.floor(availableBalance)) : null;

    const component = await getAttendanceComponentForLeaveType(employee.organizationId, leaveType);
    const allowWeekOffSelection = component?.allowWeekOffSelection ?? true;
    const allowHolidaySelection = component?.allowHolidaySelection ?? true;

    const recommendedEndDate =
      fixedDays && fixedDays > 0
        ? this.formatDateOnly(
            await this.calculateEndDateForEligibleDays({
              employeeId,
              organizationId: employee.organizationId,
              startDate,
              requiredDays: fixedDays,
              allowWeekOff: allowWeekOffSelection,
              allowHoliday: allowHolidaySelection,
            })
          )
        : this.formatDateOnly(startDate);

    return {
      leaveTypeId: leaveType.id,
      openingBalance,
      usedBalance,
      availableBalance,
      fixedDurationEnforced,
      fixedDays,
      recommendedFromDate: this.formatDateOnly(startDate),
      recommendedEndDate,
      allowWeekOffSelection,
      allowHolidaySelection,
    };
  }

  /**
   * Get all leave requests with filtering
   * @param query - Query parameters
   * @param userId - User ID for role-based filtering
   * @param userRole - User role for RBAC filtering
   */
  async getAll(query: QueryLeaveRequestsInput, userId?: string, _userRole?: string) {
    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '20');
    const skip = (page - 1) * limit;

    const where: Prisma.LeaveRequestWhereInput = {};

    if (query.employeeId) {
      where.employeeId = query.employeeId;
    } else if (userId) {
      // Get employee record
      const employee = await prisma.employee.findUnique({
        where: { userId },
        select: { id: true, reportingManagerId: true },
      });

      if (employee) {
        // Dynamic RBAC scoping via Config API permissions
        // Check /leave first (HR/OrgAdmin), then fall back to /leave/approvals (Manager)
        // If permission cache is empty (e.g. after server restart), fall back to JWT role
        const leaveScope = getDataScope(userId!, '/leave');
        const hasApprovalPerm = userHasPermission(userId!, '/leave/approvals', 'can_view');
        const isHRByRole = _userRole === 'HR_MANAGER' || _userRole === 'ORG_ADMIN' || _userRole === 'SUPER_ADMIN';
        const isManagerByRole = _userRole === 'MANAGER';
        const scope = leaveScope !== 'self' ? leaveScope
          : hasApprovalPerm ? 'team'
          : isHRByRole ? 'org'
          : isManagerByRole ? 'team'
          : 'self';
        logger.info(`[LeaveRequest.getAll] userId=${userId} role=${_userRole} scope=${scope} employeeId=${employee.id}`);
        if (scope === 'org') {
          // can_edit on /leave → org-wide access (HR/OrgAdmin level)
          if (query.organizationId) {
            where.employee = {
              organizationId: query.organizationId,
            };
          }
        } else if (scope === 'team') {
          // can_view on /leave or /leave/approvals → team access (Manager level)
          // Show requests where manager is the reporting manager OR the workflow-assigned approver
          where.OR = [
            {
              employee: {
                reportingManagerId: employee.id,
                organizationId: query.organizationId,
              },
            },
            {
              assignedApproverEmployeeId: employee.id,
              employee: { organizationId: query.organizationId },
            },
          ];
        } else {
          // No special permission → self-service only (Employee level)
          where.employeeId = employee.id;
        }
      }
    }

    if (query.leaveTypeId) {
      where.leaveTypeId = query.leaveTypeId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.dateFrom && query.dateTo) {
      where.AND = [
        { startDate: { lte: new Date(query.dateTo) } },
        { endDate: { gte: new Date(query.dateFrom) } },
      ];
    } else {
      if (query.startDate) {
        where.startDate = { gte: new Date(query.startDate) };
      }
      if (query.endDate) {
        where.endDate = { lte: new Date(query.endDate) };
      }
    }

    if (query.workflowMappingId) {
      where.workflowMappingId = query.workflowMappingId;
    }

    if (query.search && query.search.trim()) {
      where.reason = { contains: query.search.trim(), mode: 'insensitive' as const };
    }

    if (query.organizationId && !where.employee) {
      where.employee = {
        organizationId: query.organizationId,
      };
    }

    const [leaveRequests, total] = await Promise.all([
      prisma.leaveRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [query.sortBy || 'appliedOn']: query.sortOrder || 'desc',
        },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              employeeCode: true,
            },
          },
          leaveType: {
            select: {
              id: true,
              name: true,
              code: true,
              isPaid: true,
            },
          },
          workflowMapping: {
            select: {
              id: true,
              displayName: true,
            },
          },
        },
      }),
      prisma.leaveRequest.count({ where }),
    ]);

    return {
      leaveRequests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get leave request by ID
   */
  async getById(id: string) {
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id },
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
        leaveType: {
          select: {
            id: true,
            name: true,
            code: true,
            isPaid: true,
            defaultDaysPerYear: true,
          },
        },
      },
    });

    if (!leaveRequest) {
      throw new AppError('Leave request not found', 404);
    }

    return leaveRequest;
  }

  /**
   * Approve leave request
   * @param id - Leave request ID
   * @param reviewerId - User ID of the reviewer
   * @param reviewComments - Optional review comments
   * @param reviewerRole - Role of the reviewer (for RBAC validation)
   */
  async approve(id: string, reviewerId: string, reviewComments?: string, reviewerRole?: string) {
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            reportingManagerId: true,
            organizationId: true,
          },
        },
        leaveType: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        workflowMapping: {
          select: {
            id: true,
            approvalLevels: true,
          },
        },
      },
    });

    if (!leaveRequest) {
      throw new AppError('Leave request not found', 404);
    }

    if (leaveRequest.status !== LeaveStatus.PENDING) {
      throw new AppError(
        `Cannot approve leave request. Current status: ${leaveRequest.status}`,
        400
      );
    }

    const component = await getAttendanceComponentForLeaveType(
      leaveRequest.employee.organizationId,
      leaveRequest.leaveType
    );
    const reviewerEmployee = await this.validateReviewerAccess(reviewerId, reviewerRole, leaveRequest);

    const approvalLevels = parseApprovalLevels(leaveRequest.workflowMapping?.approvalLevels);
    const currentLevel = leaveRequest.currentApprovalLevel ?? 1;
    const currentLevelConfig = Array.isArray(approvalLevels)
      ? approvalLevels.find((l: ApprovalLevelConfig) => l.level === currentLevel) ?? approvalLevels[0]
      : null;
    await this.assertApprovalAllowedForLeaveEvent({
      organizationId: leaveRequest.employee.organizationId,
      approvalWorkflowId: currentLevelConfig?.approvalLevel,
      leaveType: leaveRequest.leaveType,
      attendanceComponentId: component?.id ?? null,
      action: 'toApprove',
    });
    const hasNextLevel =
      Array.isArray(approvalLevels) &&
      approvalLevels.some((l: ApprovalLevelConfig) => l.level === currentLevel + 1);

    let updateData: Record<string, unknown> = {
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
      reviewComments: reviewComments || null,
      approvalHistory: [
        ...(Array.isArray(leaveRequest.approvalHistory) ? (leaveRequest.approvalHistory as object[]) : []),
        {
          level: currentLevel,
          approverEmployeeId: reviewerEmployee.id,
          reviewedAt: new Date().toISOString(),
          action: 'APPROVED',
        },
      ],
    };

    if (hasNextLevel && Array.isArray(approvalLevels)) {
      const nextApprover = await getNextApprover(
        leaveRequest.employeeId,
        leaveRequest.employee.organizationId,
        approvalLevels,
        currentLevel
      );
      updateData = {
        ...updateData,
        currentApprovalLevel: currentLevel + 1,
        assignedApproverEmployeeId: nextApprover,
        status: LeaveStatus.PENDING,
      };
    } else {
      updateData = {
        ...updateData,
        status: LeaveStatus.APPROVED,
        assignedApproverEmployeeId: null,
        currentApprovalLevel: null,
      };
    }

    // Update leave request status
    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: updateData as object,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        leaveType: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    const isFullyApproved = (updateData.status as string) === LeaveStatus.APPROVED;

    // Balance was already deducted at PENDING creation; no further deduction needed on approval.

    // When advancing to next level, notify the next approver
    if (!isFullyApproved && updateData.assignedApproverEmployeeId) {
      try {
        const nextApprover = await prisma.employee.findUnique({
          where: { id: updateData.assignedApproverEmployeeId as string },
          include: { user: { select: { email: true } } },
        });
        if (nextApprover?.user?.email) {
          await emailService.sendLeaveRequestPendingEmail(
            nextApprover.user.email,
            `${nextApprover.firstName} ${nextApprover.lastName}`,
            `${leaveRequest.employee.firstName} ${leaveRequest.employee.lastName}`,
            leaveRequest.leaveType.name,
            leaveRequest.startDate.toISOString().split('T')[0],
            leaveRequest.endDate.toISOString().split('T')[0],
            leaveRequest.id
          );
        }
      } catch (error) {
        logger.error('Failed to send leave request pending email to next approver:', error);
      }
      return updated;
    }

    if (!isFullyApproved) {
      return updated;
    }

    const leaveTypeKey = `${leaveRequest.leaveType?.name || ''} ${leaveRequest.leaveType?.code || ''}`.toLowerCase();
    const isOndutyOrWorkFromHome =
      leaveTypeKey.includes('on duty') ||
      leaveTypeKey.includes('onduty') ||
      leaveTypeKey.includes('work from home') ||
      leaveTypeKey.includes('wfh');
    const approvedAttendanceStatus = isOndutyOrWorkFromHome ? AttendanceStatus.PRESENT : AttendanceStatus.LEAVE;
    const approvedAttendanceNote = isOndutyOrWorkFromHome
      ? `Present: Full Day (${leaveRequest.leaveType?.name ?? 'On Duty'})`
      : `Leave: ${leaveRequest.leaveType?.name ?? 'Approved leave'}`;
    const allowWeekOffSelection = component?.allowWeekOffSelection ?? true;
    const allowHolidaySelection = component?.allowHolidaySelection ?? true;

    const start = new Date(leaveRequest.startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(leaveRequest.endDate);
    end.setHours(23, 59, 59, 999);
    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateOnly = new Date(d);
      dateOnly.setHours(0, 0, 0, 0);
      let statusForDay: AttendanceStatus = approvedAttendanceStatus;
      let notesForDay = approvedAttendanceNote;

      if (!isOndutyOrWorkFromHome) {
        const isWeekOff = !allowWeekOffSelection
          ? await this.isWeekOffForEmployee(leaveRequest.employeeId, leaveRequest.employee.organizationId, dateOnly)
          : false;
        const isHoliday = !allowHolidaySelection
          ? await this.isHoliday(leaveRequest.employee.organizationId, dateOnly)
          : false;

        if (isWeekOff) {
          statusForDay = AttendanceStatus.WEEKEND;
          notesForDay = 'Week Off';
        } else if (isHoliday) {
          statusForDay = AttendanceStatus.HOLIDAY;
          notesForDay = 'Holiday';
        }
      }

      await prisma.attendanceRecord.upsert({
        where: {
          employeeId_date: { employeeId: leaveRequest.employeeId, date: dateOnly },
        },
        create: {
          employeeId: leaveRequest.employeeId,
          date: dateOnly,
          status: statusForDay,
          notes: notesForDay,
        },
        update: {
          status: statusForDay,
          notes: notesForDay,
        },
      });
    }

    // Auto-rebuild attendance summary for affected months (if summary already exists)
    const affectedMonths = new Set<string>();
    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      affectedMonths.add(`${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`);
    }
    for (const key of affectedMonths) {
      const [y, m] = key.split('-').map(Number);
      await monthlyAttendanceSummaryService.tryRebuildSummaryForDate(
        leaveRequest.employee.organizationId,
        leaveRequest.employeeId,
        new Date(y, m - 1, 15) // mid-month date to derive year/month
      );
    }

    // Send approval notification to employee
    try {
      await emailService.sendLeaveRequestApprovedEmail(
        leaveRequest.employee.email,
        `${leaveRequest.employee.firstName} ${leaveRequest.employee.lastName}`,
        leaveRequest.leaveType.name,
        leaveRequest.startDate.toISOString().split('T')[0],
        leaveRequest.endDate.toISOString().split('T')[0],
        reviewComments
      );
    } catch (error) {
      logger.error('Failed to send leave request approved email:', error);
      // Don't fail the approval if email fails
    }

    return updated;
  }

  /**
   * Reject leave request
   * @param id - Leave request ID
   * @param reviewerId - User ID of the reviewer
   * @param reviewComments - Review comments
   * @param reviewerRole - Role of the reviewer (for RBAC validation)
   */
  async reject(id: string, reviewerId: string, reviewComments: string, reviewerRole?: string) {
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            reportingManagerId: true,
            organizationId: true,
          },
        },
        leaveType: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    if (!leaveRequest) {
      throw new AppError('Leave request not found', 404);
    }

    // Allow rejecting PENDING or APPROVED leaves (not CANCELLED, REJECTED, or EXPIRED)
    const rejectableStatuses: LeaveStatus[] = [LeaveStatus.PENDING, LeaveStatus.APPROVED];
    if (!rejectableStatuses.includes(leaveRequest.status)) {
      throw new AppError(
        `Cannot reject leave request. Current status: ${leaveRequest.status}`,
        400
      );
    }

    const wasApproved = leaveRequest.status === LeaveStatus.APPROVED;
    const wasPending = leaveRequest.status === LeaveStatus.PENDING;

    await this.validateReviewerAccess(reviewerId, reviewerRole, leaveRequest);

    const component = await getAttendanceComponentForLeaveType(
      leaveRequest.employee.organizationId,
      leaveRequest.leaveType
    );
    const workflowMapping = leaveRequest.workflowMappingId
      ? await prisma.workflowMapping.findUnique({
          where: { id: leaveRequest.workflowMappingId },
          select: { approvalLevels: true },
        })
      : null;
    const approvalLevels = parseApprovalLevels(workflowMapping?.approvalLevels);
    const currentLevel = leaveRequest.currentApprovalLevel ?? 1;
    const currentLevelConfig = Array.isArray(approvalLevels)
      ? approvalLevels.find((l: ApprovalLevelConfig) => l.level === currentLevel) ?? approvalLevels[0]
      : null;
    await this.assertApprovalAllowedForLeaveEvent({
      organizationId: leaveRequest.employee.organizationId,
      approvalWorkflowId: currentLevelConfig?.approvalLevel,
      leaveType: leaveRequest.leaveType,
      attendanceComponentId: component?.id ?? null,
      action: 'cancelApproval',
    });

    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status: LeaveStatus.REJECTED,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        reviewComments,
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        leaveType: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // ── Revert attendance records and leave balance if the leave was APPROVED or PENDING ──
    if (wasApproved || wasPending) {
      // 1. Restore leave balance
      const year = new Date(leaveRequest.startDate).getUTCFullYear();
      try {
        const balance = await prisma.employeeLeaveBalance.findUnique({
          where: {
            employeeId_leaveTypeId_year: {
              employeeId: leaveRequest.employeeId,
              leaveTypeId: leaveRequest.leaveTypeId,
              year,
            },
          },
        });

        if (balance) {
          const restoredUsed = Math.max(
            0,
            parseFloat(balance.used.toString()) - parseFloat(leaveRequest.totalDays.toString())
          );
          const restoredAvailable =
            parseFloat(balance.available.toString()) + parseFloat(leaveRequest.totalDays.toString());

          await prisma.employeeLeaveBalance.update({
            where: {
              employeeId_leaveTypeId_year: {
                employeeId: leaveRequest.employeeId,
                leaveTypeId: leaveRequest.leaveTypeId,
                year,
              },
            },
            data: {
              used: new Prisma.Decimal(restoredUsed),
              available: new Prisma.Decimal(restoredAvailable),
            },
          });
        }
      } catch (balanceError) {
        logger.error(
          `Failed to restore leave balance for employee ${leaveRequest.employeeId} on rejection:`,
          balanceError
        );
      }

      // 2. Revert attendance records for each day in the leave period
      const start = new Date(leaveRequest.startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(leaveRequest.endDate);
      end.setHours(0, 0, 0, 0);

      for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateOnly = new Date(d);
        dateOnly.setHours(0, 0, 0, 0);

        const record = await prisma.attendanceRecord.findUnique({
          where: {
            employeeId_date: { employeeId: leaveRequest.employeeId, date: dateOnly },
          },
        });

        if (record && (record.status === AttendanceStatus.LEAVE || record.status === AttendanceStatus.HALF_DAY)) {
          // Check if employee had actual punch data — if so, restore to PRESENT
          const hasPunchData = record.checkIn != null;
          await prisma.attendanceRecord.update({
            where: { id: record.id },
            data: {
              status: hasPunchData ? AttendanceStatus.PRESENT : AttendanceStatus.ABSENT,
              notes: `Leave rejected — status reverted from ${record.status}`,
            },
          });
        }
      }

      // 3. Auto-rebuild attendance summaries for affected months
      const affectedMonths = new Set<string>();
      for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        affectedMonths.add(`${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`);
      }
      for (const key of affectedMonths) {
        const [y, m] = key.split('-').map(Number);
        await monthlyAttendanceSummaryService.tryRebuildSummaryForDate(
          leaveRequest.employee.organizationId,
          leaveRequest.employeeId,
          new Date(y, m - 1, 15)
        );
      }
    }
    // ── End revert ──

    // Send rejection notification to employee
    try {
      await emailService.sendLeaveRequestRejectedEmail(
        leaveRequest.employee.email,
        `${leaveRequest.employee.firstName} ${leaveRequest.employee.lastName}`,
        leaveRequest.leaveType.name,
        leaveRequest.startDate.toISOString().split('T')[0],
        leaveRequest.endDate.toISOString().split('T')[0],
        reviewComments
      );
    } catch (error) {
      logger.error('Failed to send leave request rejected email:', error);
      // Don't fail the rejection if email fails
    }

    return updated;
  }

  /**
   * Cancel leave request
   */
  async cancel(id: string, employeeId: string, cancellationReason: string) {
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id },
    });

    if (!leaveRequest) {
      throw new AppError('Leave request not found', 404);
    }

    if (leaveRequest.employeeId !== employeeId) {
      throw new AppError('You can only cancel your own leave requests', 403);
    }

    if (leaveRequest.status !== LeaveStatus.PENDING) {
      throw new AppError(
        `Cannot cancel leave request. Current status: ${leaveRequest.status}`,
        400
      );
    }

    const [employee, leaveType] = await Promise.all([
      prisma.employee.findUnique({
        where: { id: employeeId },
        select: { id: true, organizationId: true },
      }),
      prisma.leaveType.findUnique({
        where: { id: leaveRequest.leaveTypeId },
        select: { id: true, name: true, code: true },
      }),
    ]);
    if (employee && leaveType) {
      const component = await getAttendanceComponentForLeaveType(employee.organizationId, leaveType);
      const rightsContext = await resolveRightsAllocationContextForEmployee(
        employee.id,
        employee.organizationId,
        { effectiveDate: leaveRequest.startDate }
      );
      const rightsAllocation = rightsContext.rights;
      const canCancelEvent = canPerformAttendanceEventAction(rightsAllocation, 'cancel', {
        eventId: component?.id,
        leaveTypeName: leaveType.name,
        leaveTypeCode: leaveType.code,
      });
      if (!canCancelEvent) {
        throw new AppError('You do not have permission to cancel this event.', 403);
      }
    }

    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status: LeaveStatus.CANCELLED,
        cancellationReason,
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        leaveType: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Restore leave balance when a PENDING leave is cancelled
    try {
      const cancelledLeaveType = await prisma.leaveType.findUnique({
        where: { id: leaveRequest.leaveTypeId },
        select: { id: true, name: true, code: true },
      });
      if (cancelledLeaveType && employee) {
        const component = await getAttendanceComponentForLeaveType(employee.organizationId, cancelledLeaveType);
        const isOndutyMarked = /^\[Onduty(?:\s+[^\]]+)?\]/i.test(leaveRequest.reason || '');
        const hrEntryRequired = this.isHrEntryRequiredLeaveType(cancelledLeaveType);
        const shouldRestore = !isOndutyMarked && (hrEntryRequired || component === null || component.hasBalance);
        if (shouldRestore) {
          const cancelYear = new Date(leaveRequest.startDate).getUTCFullYear();
          const balance = await prisma.employeeLeaveBalance.findUnique({
            where: {
              employeeId_leaveTypeId_year: {
                employeeId,
                leaveTypeId: leaveRequest.leaveTypeId,
                year: cancelYear,
              },
            },
          });
          if (balance) {
            await prisma.employeeLeaveBalance.update({
              where: {
                employeeId_leaveTypeId_year: {
                  employeeId,
                  leaveTypeId: leaveRequest.leaveTypeId,
                  year: cancelYear,
                },
              },
              data: {
                used: new Prisma.Decimal(Math.max(0, parseFloat(balance.used.toString()) - parseFloat(leaveRequest.totalDays.toString()))),
                available: new Prisma.Decimal(parseFloat(balance.available.toString()) + parseFloat(leaveRequest.totalDays.toString())),
              },
            });
          }
        }
      }
    } catch (balanceError) {
      logger.error(`Failed to restore leave balance for employee ${employeeId} on cancellation:`, balanceError);
    }

    return updated;
  }

  /**
   * Update leave request (only if pending)
   */
  async update(id: string, employeeId: string, data: UpdateLeaveRequestInput) {
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id },
    });

    if (!leaveRequest) {
      throw new AppError('Leave request not found', 404);
    }

    if (leaveRequest.employeeId !== employeeId) {
      throw new AppError('You can only update your own leave requests', 403);
    }

    if (leaveRequest.status !== LeaveStatus.PENDING) {
      throw new AppError(
        `Cannot update leave request. Current status: ${leaveRequest.status}`,
        400
      );
    }

    const updateData: any = {};

    if (data.startDate || data.endDate) {
      const startDate = data.startDate ? this.parseDateOnly(data.startDate) : leaveRequest.startDate;
      const endDate = data.endDate ? this.parseDateOnly(data.endDate) : leaveRequest.endDate;

      // Check for overlaps (excluding current request)
      const overlapCheck = await this.checkOverlap(employeeId, startDate, endDate, id);
      if (overlapCheck.hasConflict && overlapCheck.conflictingRequest) {
        const conflict = overlapCheck.conflictingRequest;
        const leaveTypeName = conflict.leaveType?.name || 'Unknown';
        throw new AppError(
          `You already have a ${conflict.status.toLowerCase()} leave request (${leaveTypeName}) for this period`,
          400
        );
      }

      // Get employee for organization check
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
      });

      if (employee) {
        // Check for blackout periods
        const blackoutCheck = await this.checkBlackoutPeriods(
          employee.organizationId,
          leaveRequest.leaveTypeId,
          startDate,
          endDate
        );
        if (blackoutCheck.hasBlackout) {
          throw new AppError(blackoutCheck.reason || 'Leave not allowed during this period', 400);
        }
      }

      const leaveType = await prisma.leaveType.findUnique({
        where: { id: leaveRequest.leaveTypeId },
      });
      const component = leaveType && employee
        ? await getAttendanceComponentForLeaveType(employee.organizationId, leaveType)
        : null;
      const computedWorkingDays = this.calculateTotalDays(startDate, endDate);
      const computedCalendarDays = this.calculateCalendarDays(startDate, endDate);
      const computedEligibleDays =
        component && employee
          ? await this.countEligibleDaysInRange(
              employeeId,
              employee.organizationId,
              startDate,
              endDate,
              component.allowWeekOffSelection ?? true,
              component.allowHolidaySelection ?? true
            )
          : computedWorkingDays;
      const shouldCountCalendarDays =
        !!component && !!component.allowWeekOffSelection && !!component.allowHolidaySelection;
      const totalDays = shouldCountCalendarDays ? computedCalendarDays : computedEligibleDays;
      updateData.startDate = startDate;
      updateData.endDate = endDate;
      updateData.totalDays = new Prisma.Decimal(totalDays);
    }

    if (data.reason) {
      updateData.reason = data.reason;
    }

    if (data.supportingDocuments) {
      updateData.supportingDocuments = data.supportingDocuments;
    }

    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: updateData,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        leaveType: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return updated;
  }
}

export const leaveRequestService = new LeaveRequestService();
