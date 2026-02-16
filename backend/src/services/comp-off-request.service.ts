import { AttendanceStatus, CompOffRequestType, CompOffRequestStatus, Prisma } from '@prisma/client';
import { AppError } from '../middlewares/errorHandler';
import { prisma } from '../utils/prisma';
import { shiftAssignmentRuleService } from './shift-assignment-rule.service';
import {
  computeExcessStayMinutesByShift,
  getApplicableExcessTimeRule,
  isExcessTimeConversionEnabled,
} from '../utils/excess-time-rule';
import {
  canPerformExcessTimeEventAction,
  resolveRightsAllocationForEmployee,
} from '../utils/rights-allocation';

export class CompOffRequestService {
  private readonly APPROVED_ATTENDANCE_STATUSES: AttendanceStatus[] = [
    AttendanceStatus.PRESENT,
    AttendanceStatus.WEEKEND,
    AttendanceStatus.HOLIDAY,
  ];

  private isMissingExcessStayColumnError(error: unknown): boolean {
    const prismaErr = error as { code?: string; message?: string };
    return prismaErr?.code === 'P2022' || String(prismaErr?.message || '').includes('excess_stay_minutes');
  }

  private isMissingCompOffTableError(error: unknown): boolean {
    const prismaError = error as { code?: string; message?: string };
    if (prismaError?.code === 'P2021') return true;
    const msg = String(prismaError?.message || '');
    return msg.includes('comp_off_requests') || msg.includes('comp_off_ledger');
  }

  private handleMissingCompOffSchema(error: unknown): never {
    if (this.isMissingCompOffTableError(error)) {
      throw new AppError(
        'Comp Off tables are not created yet. Please run Prisma migration for Comp Off request flow.',
        503
      );
    }
    throw error;
  }

  private async getApplicableEventRule(employeeId: string, organizationId: string, asOfDate: Date) {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, organizationId: true, dateOfJoining: true },
    });
    if (!employee) throw new AppError('Employee not found', 404);
    if (employee.organizationId !== organizationId) {
      throw new AppError('Employee does not belong to this organization', 403);
    }
    const { ruleData, effectiveDate } = await getApplicableExcessTimeRule(employeeId, organizationId, asOfDate);

    return {
      employee,
      rule: effectiveDate ? { effectiveDate } : null,
      ruleData,
    };
  }

  private async getTotalExcessMinutes(
    employeeId: string,
    organizationId: string,
    fromDate: Date,
    toDate: Date
  ): Promise<{ total: number; maxSingleDay: number }> {
    const baseWhere: Prisma.AttendanceRecordWhereInput = {
      employeeId,
      date: { gte: fromDate, lte: toDate },
      checkIn: { not: null },
      checkOut: { not: null },
      status: { in: this.APPROVED_ATTENDANCE_STATUSES },
    };
    const records = await (async () => {
      try {
        return await prisma.attendanceRecord.findMany({
          where: baseWhere,
          select: {
            id: true,
            employeeId: true,
            date: true,
            status: true,
            checkIn: true,
            checkOut: true,
            workHours: true,
            excessStayMinutes: true,
            shift: {
              select: { id: true, name: true, startTime: true, endTime: true },
            },
          },
          orderBy: { date: 'asc' },
        });
      } catch (error) {
        if (!this.isMissingExcessStayColumnError(error)) throw error;
        return await prisma.attendanceRecord.findMany({
          where: baseWhere,
          select: {
            id: true,
            employeeId: true,
            date: true,
            status: true,
            checkIn: true,
            checkOut: true,
            workHours: true,
            shift: {
              select: { id: true, name: true, startTime: true, endTime: true },
            },
          },
          orderBy: { date: 'asc' },
        });
      }
    })();

    let total = 0;
    let maxSingleDay = 0;
    const shiftByDate = new Map<string, { startTime?: string | null; endTime?: string | null } | null>();

    for (const record of records) {
      if (!record.checkIn || !record.checkOut) continue;
      let shift: { startTime?: string | null; endTime?: string | null } | null = record.shift ?? null;

      if (!shift?.startTime || !shift?.endTime) {
        const dateKey = new Date(record.date).toISOString().slice(0, 10);
        if (!shiftByDate.has(dateKey)) {
          const shiftFromRule = await shiftAssignmentRuleService.getApplicableShiftForEmployee(
            employeeId,
            new Date(record.date),
            organizationId
          );
          shiftByDate.set(dateKey, shiftFromRule ?? null);
        }
        shift = shiftByDate.get(dateKey) ?? null;
      }

      const recordExcessStayMinutes = (record as { excessStayMinutes?: number | null }).excessStayMinutes;
      if (recordExcessStayMinutes != null) {
        const mins = Math.max(0, Number(recordExcessStayMinutes));
        total += mins;
        if (mins > maxSingleDay) maxSingleDay = mins;
        continue;
      }
      if (record.status === AttendanceStatus.WEEKEND || record.status === AttendanceStatus.HOLIDAY) {
        const mins = this.getWorkedMinutesForCompOff(record);
        total += mins;
        if (mins > maxSingleDay) maxSingleDay = mins;
        continue;
      }
      if (!shift?.startTime || !shift?.endTime) continue;
      const mins = computeExcessStayMinutesByShift(new Date(record.checkIn), new Date(record.checkOut), shift);
      total += mins;
      if (mins > maxSingleDay) maxSingleDay = mins;
    }

    return { total, maxSingleDay };
  }

  private async getEligibleExcessEntries(
    employeeId: string,
    organizationId: string,
    fromDate: Date,
    toDate: Date
  ): Promise<Array<{ date: Date; minutes: number; expiryDate: Date | null }>> {
    const { ruleData } = await getApplicableExcessTimeRule(employeeId, organizationId, toDate);
    const expiryDaysRaw = Number((ruleData as { expiryDaysForWorkDay?: unknown } | null)?.expiryDaysForWorkDay ?? 0);
    const expiryDaysForWorkDay = Number.isFinite(expiryDaysRaw) && expiryDaysRaw > 0 ? Math.floor(expiryDaysRaw) : 0;

    const totals = await this.getTotalExcessMinutes(employeeId, organizationId, fromDate, toDate);
    if (totals.total <= 0) return [];

    const baseWhere: Prisma.AttendanceRecordWhereInput = {
      employeeId,
      date: { gte: fromDate, lte: toDate },
      checkIn: { not: null },
      checkOut: { not: null },
      status: { in: this.APPROVED_ATTENDANCE_STATUSES },
    };
    const records = await prisma.attendanceRecord.findMany({
      where: baseWhere,
      select: {
        id: true,
        date: true,
        status: true,
        checkIn: true,
        checkOut: true,
        workHours: true,
        excessStayMinutes: true,
        shift: {
          select: { startTime: true, endTime: true },
        },
      },
      orderBy: { date: 'asc' },
    });

    const out: Array<{ date: Date; minutes: number; expiryDate: Date | null }> = [];
    for (const record of records) {
      if (!record.checkIn || !record.checkOut) continue;
      let mins = record.excessStayMinutes != null ? Math.max(0, Number(record.excessStayMinutes)) : 0;
      if (
        mins <= 0 &&
        (record.status === AttendanceStatus.WEEKEND || record.status === AttendanceStatus.HOLIDAY)
      ) {
        mins = this.getWorkedMinutesForCompOff(record);
      }
      if (mins <= 0 && record.shift?.startTime && record.shift?.endTime) {
        mins = computeExcessStayMinutesByShift(new Date(record.checkIn), new Date(record.checkOut), record.shift);
      }
      if (mins <= 0) continue;
      const expiryDate =
        expiryDaysForWorkDay > 0
          ? new Date(new Date(record.date).setDate(new Date(record.date).getDate() + expiryDaysForWorkDay))
          : null;
      out.push({ date: new Date(record.date), minutes: mins, expiryDate });
    }
    return out;
  }

  private getWorkedMinutesForCompOff(record: {
    checkIn: Date | null;
    checkOut: Date | null;
    workHours?: unknown;
  }): number {
    if (!record.checkIn || !record.checkOut) return 0;

    const workHours = Number(record.workHours ?? 0);
    if (Number.isFinite(workHours) && workHours > 0) {
      return Math.max(0, Math.round(workHours * 60));
    }

    const minutes = Math.round(
      (new Date(record.checkOut).getTime() - new Date(record.checkIn).getTime()) / (1000 * 60)
    );
    return Math.max(0, minutes);
  }

  private async getUsedMinutesByStatus(employeeId: string, organizationId: string) {
    try {
      const [approved, pending] = await Promise.all([
        prisma.compOffRequest.aggregate({
          where: { employeeId, organizationId, status: CompOffRequestStatus.APPROVED },
          _sum: { usedExcessMinutes: true },
        }),
        prisma.compOffRequest.aggregate({
          where: { employeeId, organizationId, status: CompOffRequestStatus.PENDING },
          _sum: { usedExcessMinutes: true },
        }),
      ]);

      return {
        approvedUsed: approved._sum.usedExcessMinutes ?? 0,
        pendingUsed: pending._sum.usedExcessMinutes ?? 0,
      };
    } catch (error) {
      if (this.isMissingCompOffTableError(error)) {
        // Keep summary API functional even before migration; request APIs still validate schema explicitly.
        return { approvedUsed: 0, pendingUsed: 0 };
      }
      throw error;
    }
  }

  private async resolveCompOffLeaveType(organizationId: string) {
    const leaveType = await prisma.leaveType.findFirst({
      where: {
        organizationId,
        isActive: true,
        OR: [
          { code: { in: ['COMP_OFF', 'COMPOFF', 'CO'] } },
          { name: { contains: 'comp off', mode: 'insensitive' } },
          { name: { contains: 'compoff', mode: 'insensitive' } },
        ],
      },
    });

    if (!leaveType) {
      // Auto-create a default Comp Off leave type so approval flow does not fail in newly configured orgs.
      return prisma.leaveType.create({
        data: {
          organizationId,
          name: 'Comp Off',
          code: null,
          description: 'Auto-created for Excess Time conversion approvals',
          isPaid: true,
          requiresApproval: true,
          isActive: true,
        },
      });
    }
    return leaveType;
  }

  async getSummary(employeeId: string, organizationId: string) {
    const now = new Date();
    const { employee, rule, ruleData } = await this.getApplicableEventRule(employeeId, organizationId, now);

    const conversionEnabled = isExcessTimeConversionEnabled(ruleData);
    const combineMultipleDays = ruleData?.combineMultipleDaysExcessTimeToCompOff !== false;
    const allowBeforeEntryDate = ruleData?.allowBeforeEntryDate === true;
    const fullDayMinutes = Math.max(1, Number(ruleData?.fullDayRequirementInWorkDay ?? 480));
    const halfDayMinutes = Math.max(1, Number(ruleData?.halfDayRequirementInWorkDay ?? 240));
    const expiryDaysRaw = Number((ruleData as { expiryDaysForWorkDay?: unknown } | null)?.expiryDaysForWorkDay ?? 0);
    const expiryDaysForWorkDay = Number.isFinite(expiryDaysRaw) && expiryDaysRaw > 0 ? Math.floor(expiryDaysRaw) : 0;

    const startDate = new Date(employee.dateOfJoining);
    startDate.setHours(0, 0, 0, 0);
    if (!allowBeforeEntryDate && rule?.effectiveDate && rule.effectiveDate > startDate) {
      startDate.setTime(rule.effectiveDate.getTime());
      startDate.setHours(0, 0, 0, 0);
    }
    if (expiryDaysForWorkDay > 0) {
      const validFrom = new Date(now);
      validFrom.setHours(0, 0, 0, 0);
      validFrom.setDate(validFrom.getDate() - expiryDaysForWorkDay);
      if (validFrom > startDate) {
        startDate.setTime(validFrom.getTime());
      }
    }

    const totals = await this.getTotalExcessMinutes(employeeId, organizationId, startDate, now);
    const { approvedUsed, pendingUsed } = await this.getUsedMinutesByStatus(employeeId, organizationId);

    const totalExcessMinutes = totals.total;
    const availableExcessMinutes = Math.max(0, totalExcessMinutes - approvedUsed);
    const availableExcessMinutesForRequest = Math.max(0, availableExcessMinutes - pendingUsed);
    const maxSingleDayAvailableForRequest = Math.max(
      0,
      Math.min(totals.maxSingleDay, availableExcessMinutesForRequest)
    );
    const eligibilityBaseMinutes = combineMultipleDays
      ? availableExcessMinutesForRequest
      : maxSingleDayAvailableForRequest;
    const eligibility = this.calculateEligibility(
      eligibilityBaseMinutes,
      fullDayMinutes,
      halfDayMinutes,
      combineMultipleDays,
      conversionEnabled
    );
    const remainingAfterEligibleConversionMinutes = Math.max(
      0,
      availableExcessMinutesForRequest - eligibility.convertibleMinutes
    );

    return {
      employeeId,
      organizationId,
      totalExcessMinutes,
      usedExcessMinutes: approvedUsed,
      pendingExcessMinutes: pendingUsed,
      availableExcessMinutes,
      availableExcessMinutesForRequest,
      eligibleCompOffDays: eligibility.eligibleCompOffDays,
      eligibleConversionMinutes: eligibility.convertibleMinutes,
      remainingAfterEligibleConversionMinutes,
      fullDayMinutes,
      halfDayMinutes,
      conversionEnabled,
      combineMultipleDays,
      expiryDaysForWorkDay,
    };
  }

  private calculateEligibility(
    availableExcessMinutesForRequest: number,
    fullDayMinutes: number,
    halfDayMinutes: number,
    combineMultipleDays: boolean,
    conversionEnabled: boolean
  ) {
    if (!conversionEnabled || availableExcessMinutesForRequest < halfDayMinutes) {
      return {
        eligibleCompOffDays: 0,
        convertibleMinutes: 0,
        remainingAfterConversionMinutes: Math.max(0, availableExcessMinutesForRequest),
      };
    }
    if (!combineMultipleDays) {
      const oneUnitMinutes =
        availableExcessMinutesForRequest >= fullDayMinutes ? fullDayMinutes : halfDayMinutes;
      const days = oneUnitMinutes === fullDayMinutes ? 1 : 0.5;
      return {
        eligibleCompOffDays: days,
        convertibleMinutes: oneUnitMinutes,
        remainingAfterConversionMinutes: Math.max(0, availableExcessMinutesForRequest - oneUnitMinutes),
      };
    }

    const fullDays = Math.floor(availableExcessMinutesForRequest / fullDayMinutes);
    const remainder = availableExcessMinutesForRequest - fullDays * fullDayMinutes;
    const halfDays = remainder >= halfDayMinutes ? 1 : 0;
    const eligibleCompOffDays = fullDays + halfDays * 0.5;
    const convertibleMinutes = fullDays * fullDayMinutes + halfDays * halfDayMinutes;
    const remainingAfterConversionMinutes = Math.max(0, availableExcessMinutesForRequest - convertibleMinutes);
    return { eligibleCompOffDays, convertibleMinutes, remainingAfterConversionMinutes };
  }

  async createRequest(
    employeeId: string,
    organizationId: string,
    data: { requestType: CompOffRequestType; reason?: string }
  ) {
    const rightsAllocation = await resolveRightsAllocationForEmployee(employeeId, organizationId);
    const canAddCompOff = canPerformExcessTimeEventAction(rightsAllocation, 'add', {
      eventName: 'Excess time to Comp off',
    });
    if (!canAddCompOff) {
      throw new AppError('You do not have permission to request comp off from excess time.', 403);
    }

    const summary = await this.getSummary(employeeId, organizationId);
    if (!summary.conversionEnabled) {
      throw new AppError('Comp Off conversion is disabled by event rule', 400);
    }

    const requiredMinutes = data.requestType === CompOffRequestType.FULL_DAY ? summary.fullDayMinutes : summary.halfDayMinutes;
    const requestDays = data.requestType === CompOffRequestType.FULL_DAY ? 1 : 0.5;

    if (summary.availableExcessMinutesForRequest < requiredMinutes) {
      throw new AppError('Not enough eligible excess minutes for this request', 400);
    }

    let request;
    try {
      request = await prisma.compOffRequest.create({
        data: {
          organizationId,
          employeeId,
          requestType: data.requestType,
          requestDays: new Prisma.Decimal(requestDays),
          usedExcessMinutes: requiredMinutes,
          status: CompOffRequestStatus.PENDING,
          reason: data.reason || null,
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
        },
      });
    } catch (error) {
      this.handleMissingCompOffSchema(error);
    }

    return request;
  }

  async createAutoConversionRequest(
    employeeId: string,
    organizationId: string,
    data?: { reason?: string }
  ) {
    const rightsAllocation = await resolveRightsAllocationForEmployee(employeeId, organizationId);
    const canAddCompOff = canPerformExcessTimeEventAction(rightsAllocation, 'add', {
      eventName: 'Excess time to Comp off',
    });
    if (!canAddCompOff) {
      throw new AppError('You do not have permission to request comp off from excess time.', 403);
    }

    const summary = await this.getSummary(employeeId, organizationId);
    if (!summary.conversionEnabled) {
      throw new AppError('Comp Off conversion is disabled by event rule', 400);
    }
    if (summary.availableExcessMinutesForRequest < summary.halfDayMinutes) {
      throw new AppError(`Minimum ${summary.halfDayMinutes} minutes is required for conversion`, 400);
    }

    const eligibility = this.calculateEligibility(
      summary.availableExcessMinutesForRequest,
      summary.fullDayMinutes,
      summary.halfDayMinutes,
      summary.combineMultipleDays,
      summary.conversionEnabled
    );
    if (eligibility.convertibleMinutes < summary.halfDayMinutes || eligibility.eligibleCompOffDays <= 0) {
      throw new AppError('No eligible excess minutes available for conversion', 400);
    }

    const requestType =
      eligibility.eligibleCompOffDays >= 1 ? CompOffRequestType.FULL_DAY : CompOffRequestType.HALF_DAY;
    let request;
    try {
      request = await prisma.compOffRequest.create({
        data: {
          organizationId,
          employeeId,
          requestType,
          requestDays: new Prisma.Decimal(eligibility.eligibleCompOffDays),
          usedExcessMinutes: eligibility.convertibleMinutes,
          status: CompOffRequestStatus.PENDING,
          reason: data?.reason || null,
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
        },
      });
    } catch (error) {
      this.handleMissingCompOffSchema(error);
    }
    return {
      request,
      conversion: {
        availableExcessMinutesForRequest: summary.availableExcessMinutesForRequest,
        eligibleCompOffDays: eligibility.eligibleCompOffDays,
        convertedMinutes: eligibility.convertibleMinutes,
        remainingMinutes: eligibility.remainingAfterConversionMinutes,
      },
    };
  }

  async listRequests(
    employeeId: string,
    organizationId: string,
    query?: {
      status?: CompOffRequestStatus;
      page?: string;
      limit?: string;
      targetEmployeeId?: string;
      startDate?: string;
      endDate?: string;
      userRole?: string;
    }
  ) {
    const page = parseInt(query?.page || '1', 10);
    const limit = parseInt(query?.limit || '20', 10);
    const skip = (page - 1) * limit;
    const where: Prisma.CompOffRequestWhereInput = { organizationId };
    const role = (query?.userRole || '').toUpperCase();
    const targetEmployeeId = query?.targetEmployeeId;
    if (targetEmployeeId) {
      where.employeeId = targetEmployeeId;
    } else if (role === 'MANAGER') {
      const managerEmployee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { id: true },
      });
      if (managerEmployee) {
        where.employee = { reportingManagerId: managerEmployee.id };
      }
    } else if (role === 'HR_MANAGER' || role === 'ORG_ADMIN' || role === 'SUPER_ADMIN') {
      // org-wide
    } else {
      where.employeeId = employeeId;
    }
    if (query?.status) where.status = query.status;
    if (query?.startDate || query?.endDate) {
      where.createdAt = {
        ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
        ...(query.endDate ? { lte: new Date(`${query.endDate}T23:59:59.999Z`) } : {}),
      };
    }

    const [requests, total, summary] = await Promise.all([
      prisma.compOffRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          employee: {
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
              department: { select: { id: true, name: true } },
            },
          },
        },
      }),
      prisma.compOffRequest.count({ where }),
      this.getSummary(targetEmployeeId || employeeId, organizationId),
    ]);

    const employeeIds = Array.from(new Set(requests.map((r) => r.employeeId)));
    const summaryByEmployeeId = new Map<string, Awaited<ReturnType<CompOffRequestService['getSummary']>>>();
    await Promise.all(
      employeeIds.map(async (eid) => {
        try {
          const s = await this.getSummary(eid, organizationId);
          summaryByEmployeeId.set(eid, s);
        } catch {
          // ignore summary failure per employee
        }
      })
    );

    return {
      requests: requests.map((r) => ({
        ...(summaryByEmployeeId.get(r.employeeId)
          ? {
              totalExcessMinutes: summaryByEmployeeId.get(r.employeeId)!.totalExcessMinutes,
              eligibleConversionDays: summaryByEmployeeId.get(r.employeeId)!.eligibleCompOffDays,
              remainingMinutes: summaryByEmployeeId.get(r.employeeId)!.remainingAfterEligibleConversionMinutes,
            }
          : {}),
        ...r,
        convertedDays: Number(r.requestDays),
        convertedMinutes: r.usedExcessMinutes,
        requestedOn: r.createdAt,
        departmentName: r.employee?.department?.name ?? null,
      })),
      summary,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getRequestDetails(
    requestId: string,
    organizationId: string,
    requesterEmployeeId: string,
    userRole?: string
  ) {
    const role = (userRole || '').toUpperCase();
    const request = await prisma.compOffRequest.findUnique({
      where: { id: requestId },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            dateOfJoining: true,
            department: { select: { id: true, name: true } },
            reportingManagerId: true,
            organizationId: true,
          },
        },
      },
    });
    if (!request || request.organizationId !== organizationId) {
      throw new AppError('Comp Off request not found', 404);
    }

    if (role === 'MANAGER' && request.employee.reportingManagerId !== requesterEmployeeId) {
      throw new AppError('Access denied for this request', 403);
    }
    if (
      role !== 'MANAGER' &&
      role !== 'HR_MANAGER' &&
      role !== 'ORG_ADMIN' &&
      role !== 'SUPER_ADMIN' &&
      request.employeeId !== requesterEmployeeId
    ) {
      throw new AppError('Access denied for this request', 403);
    }

    const summary = await this.getSummary(request.employeeId, organizationId);
    const fromDate = new Date(request.employee.dateOfJoining || request.createdAt);
    fromDate.setHours(0, 0, 0, 0);
    const breakdown = await this.getEligibleExcessEntries(
      request.employeeId,
      organizationId,
      fromDate,
      new Date()
    );

    return {
      request: {
        ...request,
        convertedDays: Number(request.requestDays),
        convertedMinutes: request.usedExcessMinutes,
        employeeName: `${request.employee.firstName} ${request.employee.lastName}`.trim(),
        departmentName: request.employee.department?.name ?? null,
      },
      summary,
      conversionRules: {
        halfDayMinutes: summary.halfDayMinutes,
        fullDayMinutes: summary.fullDayMinutes,
        combineMultipleDays: summary.combineMultipleDays,
      },
      dailyBreakdown: breakdown.map((b) => ({
        date: b.date,
        excessMinutes: b.minutes,
        expiryDate: b.expiryDate,
      })),
    };
  }

  async approveRequest(
    requestId: string,
    reviewerId: string,
    reviewComments?: string,
    reviewerRole?: string
  ) {
    let request;
    try {
      request = await prisma.compOffRequest.findUnique({
        where: { id: requestId },
        include: {
          employee: {
            select: {
              id: true,
              organizationId: true,
              reportingManagerId: true,
            },
          },
        },
      });
    } catch (error) {
      this.handleMissingCompOffSchema(error);
    }

    if (!request) throw new AppError('Comp Off request not found', 404);
    if (request.status !== CompOffRequestStatus.PENDING) {
      throw new AppError(`Cannot approve request. Current status: ${request.status}`, 400);
    }

    if (reviewerRole === 'MANAGER') {
      const reviewerEmployee = await prisma.employee.findUnique({
        where: { userId: reviewerId },
        select: { id: true },
      });
      if (!reviewerEmployee) throw new AppError('Reviewer employee record not found', 404);
      if (request.employee.reportingManagerId !== reviewerEmployee.id) {
        throw new AppError('Access denied. You can only approve requests from your team.', 403);
      }
    }

    const liveSummary = await this.getSummary(request.employeeId, request.organizationId);
    if (!liveSummary.conversionEnabled) {
      throw new AppError('Cannot approve. Conversion rule is disabled now.', 400);
    }
    if (liveSummary.availableExcessMinutes < request.usedExcessMinutes) {
      throw new AppError('Cannot approve. Insufficient valid excess minutes.', 400);
    }
    if (liveSummary.expiryDaysForWorkDay && liveSummary.availableExcessMinutes <= 0) {
      throw new AppError('Cannot approve. Excess minutes are expired or unavailable.', 400);
    }

    const leaveType = await this.resolveCompOffLeaveType(request.organizationId);
    const year = new Date().getFullYear();

    let updated;
    try {
      updated = await prisma.$transaction(async (tx) => {
        const approvedRequest = await tx.compOffRequest.update({
          where: { id: requestId },
          data: {
            status: CompOffRequestStatus.APPROVED,
            reviewedBy: reviewerId,
            reviewedAt: new Date(),
            reviewComments: reviewComments || null,
          },
        });

        const existingBalance = await tx.employeeLeaveBalance.findUnique({
          where: {
            employeeId_leaveTypeId_year: {
              employeeId: request.employeeId,
              leaveTypeId: leaveType.id,
              year,
            },
          },
        });

        if (existingBalance) {
          await tx.employeeLeaveBalance.update({
            where: {
              employeeId_leaveTypeId_year: {
                employeeId: request.employeeId,
                leaveTypeId: leaveType.id,
                year,
              },
            },
            data: {
              accrued: { increment: request.requestDays },
              available: { increment: request.requestDays },
            },
          });
        } else {
          await tx.employeeLeaveBalance.create({
            data: {
              employeeId: request.employeeId,
              leaveTypeId: leaveType.id,
              year,
              openingBalance: new Prisma.Decimal(0),
              accrued: request.requestDays,
              used: new Prisma.Decimal(0),
              carriedForward: new Prisma.Decimal(0),
              available: request.requestDays,
            },
          });
        }

        await tx.compOffLedger.create({
          data: {
            organizationId: request.organizationId,
            employeeId: request.employeeId,
            compOffRequestId: approvedRequest.id,
            leaveTypeId: leaveType.id,
            year,
            daysCredited: request.requestDays,
            minutesConsumed: request.usedExcessMinutes,
            description: `Comp Off credited from approved request (${request.requestType})`,
          },
        });

        return approvedRequest;
      });
    } catch (error) {
      this.handleMissingCompOffSchema(error);
    }

    return updated;
  }

  async rejectRequest(requestId: string, reviewerId: string, reviewComments: string, reviewerRole?: string) {
    let request;
    try {
      request = await prisma.compOffRequest.findUnique({
        where: { id: requestId },
        include: {
          employee: {
            select: {
              id: true,
              reportingManagerId: true,
            },
          },
        },
      });
    } catch (error) {
      this.handleMissingCompOffSchema(error);
    }

    if (!request) throw new AppError('Comp Off request not found', 404);
    if (request.status !== CompOffRequestStatus.PENDING) {
      throw new AppError(`Cannot reject request. Current status: ${request.status}`, 400);
    }

    if (reviewerRole === 'MANAGER') {
      const reviewerEmployee = await prisma.employee.findUnique({
        where: { userId: reviewerId },
        select: { id: true },
      });
      if (!reviewerEmployee) throw new AppError('Reviewer employee record not found', 404);
      if (request.employee.reportingManagerId !== reviewerEmployee.id) {
        throw new AppError('Access denied. You can only reject requests from your team.', 403);
      }
    }

    try {
      return await prisma.compOffRequest.update({
        where: { id: requestId },
        data: {
          status: CompOffRequestStatus.REJECTED,
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          reviewComments,
        },
      });
    } catch (error) {
      this.handleMissingCompOffSchema(error);
    }
  }
}

export const compOffRequestService = new CompOffRequestService();
