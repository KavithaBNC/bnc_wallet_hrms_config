
import { AppError } from '../middlewares/errorHandler';
import { AttendanceStatus, LeaveStatus, Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { emailService } from './email.service';
import { leavePolicyService } from './leave-policy.service';
import { logger } from '../utils/logger';
import {
  CreateLeaveRequestInput,
  UpdateLeaveRequestInput,
  QueryLeaveRequestsInput,
} from '../utils/leave.validation';
import { getEntitlementForEmployeeAndLeaveType } from '../utils/auto-credit-entitlement';
import { getAttendanceComponentForLeaveType } from '../utils/event-config';
import { resolveWorkflowForEmployeeOrNull } from './workflow-resolution.service';
import {
  getFirstApprover,
  getNextApprover,
  parseApprovalLevels,
  type ApprovalLevelConfig,
} from './approval-routing.service';

export class LeaveRequestService {
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
  private isWeekend(date: Date): boolean {
    const day = date.getDay();
    return day === 0 || day === 6;
  }

  /**
   * Check if date is a holiday for the organization
   */
  private async isHoliday(organizationId: string, date: Date): Promise<boolean> {
    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);
    const holiday = await prisma.holiday.findFirst({
      where: {
        organizationId,
        date: dateOnly,
      },
    });
    return !!holiday;
  }

  /**
   * Validate leave dates against Allow WeekOff / Allow Holiday flags.
   * If allowWeekOffSelection is false, no date in range may be a weekend.
   * If allowHolidaySelection is false, no date in range may be a holiday.
   */
  private async validateWeekOffAndHoliday(
    organizationId: string,
    startDate: Date,
    endDate: Date,
    allowWeekOff: boolean,
    allowHoliday: boolean
  ): Promise<{ valid: boolean; reason?: string }> {
    if (allowWeekOff && allowHoliday) return { valid: true };
    const current = new Date(startDate);
    current.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    while (current <= end) {
      if (!allowWeekOff && this.isWeekend(current)) {
        return {
          valid: false,
          reason: `This leave type cannot be applied on week-offs. ${current.toISOString().split('T')[0]} is a weekend.`,
        };
      }
      if (!allowHoliday && (await this.isHoliday(organizationId, current))) {
        return {
          valid: false,
          reason: `This leave type cannot be applied on holidays. ${current.toISOString().split('T')[0]} is a holiday.`,
        };
      }
      current.setDate(current.getDate() + 1);
    }
    return { valid: true };
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

    if (!balance) {
      const [employee, leaveType] = await Promise.all([
        prisma.employee.findUnique({
          where: { id: employeeId },
          select: {
            id: true,
            organizationId: true,
            paygroupId: true,
            departmentId: true,
            employeeCode: true,
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
      const dec = (n: number) => new Prisma.Decimal(n);

      balance = await prisma.employeeLeaveBalance.create({
        data: {
          employeeId,
          leaveTypeId,
          year,
          openingBalance: dec(entitlement),
          accrued: dec(entitlement),
          available: dec(entitlement),
        },
      });
    }

    return balance;
  }

  /**
   * Apply for leave
   */
  async create(employeeId: string, data: CreateLeaveRequestInput) {
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
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);

    // Validate dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (startDate < today) {
      throw new AppError('Start date cannot be in the past', 400);
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

    // Calculate total days (optional totalDays from body for half-day e.g. 0.5)
    const totalDays =
      data.totalDays != null ? data.totalDays : this.calculateTotalDays(startDate, endDate);

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

    if (policy?.advanceNoticeDays) {
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

    // Get current year
    const year = new Date().getFullYear();

    // Has Balance = NO → do not maintain balance; skip balance check and deduction on approve
    const shouldCheckBalance = component === null || component.hasBalance;
    if (shouldCheckBalance) {
      const balance = await this.getOrCreateLeaveBalance(employeeId, data.leaveTypeId, year);
      const availableDays = parseFloat(balance.available.toString());
      if (totalDays > availableDays && !leaveType.canBeNegative) {
        throw new AppError(
          `Insufficient leave balance. Available: ${availableDays} days, Requested: ${totalDays} days`,
          400
        );
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
   * Get all leave requests with filtering
   * @param query - Query parameters
   * @param userId - User ID for role-based filtering
   * @param userRole - User role for RBAC filtering
   */
  async getAll(query: QueryLeaveRequestsInput, userId?: string, userRole?: string) {
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
        // RBAC: EMPLOYEE can only see their own requests (self-service)
        if (userRole === 'EMPLOYEE') {
          where.employeeId = employee.id;
        }
        // RBAC: MANAGER can only see requests from their team (subordinates)
        else if (userRole === 'MANAGER') {
          where.employee = {
            reportingManagerId: employee.id, // Only show requests from employees who report to this manager
            organizationId: query.organizationId,
          };
        }
        // HR_MANAGER and ORG_ADMIN can see all requests in their organization
        else if (userRole === 'HR_MANAGER' || userRole === 'ORG_ADMIN') {
          if (query.organizationId) {
            where.employee = {
              organizationId: query.organizationId,
            };
          }
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
  async approve(id: string, reviewerId: string, reviewComments?: string, _reviewerRole?: string) {
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
    const shouldDeductBalance = component === null || component.hasBalance;

    const reviewerEmployee = await prisma.employee.findUnique({
      where: { userId: reviewerId },
      select: { id: true },
    });

    if (!reviewerEmployee) {
      throw new AppError('Reviewer employee record not found', 404);
    }

    // RBAC: verify reviewer is the assigned approver (workflow) or reporting manager (fallback)
    const assignedApproverId = leaveRequest.assignedApproverEmployeeId ?? leaveRequest.employee.reportingManagerId;
    if (assignedApproverId !== reviewerEmployee.id) {
      throw new AppError(
        'Access denied. You are not the assigned approver for this request.',
        403
      );
    }

    const approvalLevels = parseApprovalLevels(leaveRequest.workflowMapping?.approvalLevels);
    const currentLevel = leaveRequest.currentApprovalLevel ?? 1;
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
          },
        },
      },
    });

    const isFullyApproved = (updateData.status as string) === LeaveStatus.APPROVED;

    // Update leave balance only when FULLY approved and event config Has Balance = YES
    if (isFullyApproved && shouldDeductBalance) {
      const year = new Date().getFullYear();
      const balance = await this.getOrCreateLeaveBalance(
        leaveRequest.employeeId,
        leaveRequest.leaveTypeId,
        year
      );

      const usedDays = parseFloat(balance.used.toString()) + parseFloat(leaveRequest.totalDays.toString());
      const availableDays = parseFloat(balance.available.toString()) - parseFloat(leaveRequest.totalDays.toString());

      await prisma.employeeLeaveBalance.update({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId: leaveRequest.employeeId,
            leaveTypeId: leaveRequest.leaveTypeId,
            year,
          },
        },
        data: {
          used: new Prisma.Decimal(usedDays),
          available: new Prisma.Decimal(Math.max(0, availableDays)), // Don't go below 0
        },
      });
    }

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

    const start = new Date(leaveRequest.startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(leaveRequest.endDate);
    end.setHours(23, 59, 59, 999);
    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateOnly = new Date(d);
      dateOnly.setHours(0, 0, 0, 0);
      await prisma.attendanceRecord.upsert({
        where: {
          employeeId_date: { employeeId: leaveRequest.employeeId, date: dateOnly },
        },
        create: {
          employeeId: leaveRequest.employeeId,
          date: dateOnly,
          status: AttendanceStatus.LEAVE,
          notes: `Leave: ${leaveRequest.leaveType?.name ?? 'Approved leave'}`,
        },
        update: {
          status: AttendanceStatus.LEAVE,
          notes: `Leave: ${leaveRequest.leaveType?.name ?? 'Approved leave'}`,
        },
      });
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
  async reject(id: string, reviewerId: string, reviewComments: string, _reviewerRole?: string) {
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
          },
        },
      },
    });

    if (!leaveRequest) {
      throw new AppError('Leave request not found', 404);
    }

    if (leaveRequest.status !== LeaveStatus.PENDING) {
      throw new AppError(
        `Cannot reject leave request. Current status: ${leaveRequest.status}`,
        400
      );
    }

    // RBAC: verify reviewer is the assigned approver (workflow) or reporting manager (fallback)
    const reviewerEmployee = await prisma.employee.findUnique({
      where: { userId: reviewerId },
      select: { id: true },
    });
    if (!reviewerEmployee) {
      throw new AppError('Reviewer employee record not found', 404);
    }
    const assignedApproverIdForReject =
      leaveRequest.assignedApproverEmployeeId ?? leaveRequest.employee.reportingManagerId;
    if (assignedApproverIdForReject !== reviewerEmployee.id) {
      throw new AppError(
        'Access denied. You are not the assigned approver for this request.',
        403
      );
    }

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
      const startDate = data.startDate ? new Date(data.startDate) : leaveRequest.startDate;
      const endDate = data.endDate ? new Date(data.endDate) : leaveRequest.endDate;

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

      const totalDays = this.calculateTotalDays(startDate, endDate);
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
