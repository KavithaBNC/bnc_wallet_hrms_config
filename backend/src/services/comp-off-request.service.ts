import { CompOffRequestType, CompOffRequestStatus, Prisma } from '@prisma/client';
import { AppError } from '../middlewares/errorHandler';
import { prisma } from '../utils/prisma';
import { shiftAssignmentRuleService } from './shift-assignment-rule.service';

const EVENT_RULE_MARKER = '__EVENT_RULE_DATA__';

type EventRuleData = {
  combineMultipleDaysExcessTimeToCompOff?: boolean;
  considerExtraHoursAsCompOff?: boolean;
  fullDayRequirementInWorkDay?: number;
  halfDayRequirementInWorkDay?: number;
};

type ShiftLike = {
  startTime?: string | null;
  endTime?: string | null;
};

export class CompOffRequestService {
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

  private computeExcessMinutes(checkIn: Date, checkOut: Date, shift: ShiftLike): number {
    if (!shift.startTime || !shift.endTime) return 0;

    const [startH, startM] = String(shift.startTime).trim().split(':').map((x) => parseInt(x || '0', 10));
    const [endH, endM] = String(shift.endTime).trim().split(':').map((x) => parseInt(x || '0', 10));
    if (Number.isNaN(startH) || Number.isNaN(startM) || Number.isNaN(endH) || Number.isNaN(endM)) return 0;

    const shiftStart = new Date(checkIn.getFullYear(), checkIn.getMonth(), checkIn.getDate(), startH, startM, 0, 0);
    const shiftEnd = new Date(checkIn.getFullYear(), checkIn.getMonth(), checkIn.getDate(), endH, endM, 0, 0);
    if (shiftEnd <= shiftStart) shiftEnd.setDate(shiftEnd.getDate() + 1);

    const earlyComingMins =
      checkIn < shiftStart ? Math.round((shiftStart.getTime() - checkIn.getTime()) / (1000 * 60)) : 0;
    const lateLeavingMins =
      checkOut > shiftEnd ? Math.round((checkOut.getTime() - shiftEnd.getTime()) / (1000 * 60)) : 0;

    return Math.max(0, earlyComingMins + lateLeavingMins);
  }

  private extractEventRuleData(remarks: string | null | undefined): EventRuleData | null {
    if (!remarks) return null;
    const markerIdx = remarks.indexOf(EVENT_RULE_MARKER);
    if (markerIdx === -1) return null;
    try {
      const parsed = JSON.parse(remarks.slice(markerIdx + EVENT_RULE_MARKER.length)) as EventRuleData;
      return parsed;
    } catch {
      return null;
    }
  }

  private async getApplicableEventRule(employeeId: string, organizationId: string, asOfDate: Date) {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, organizationId: true, paygroupId: true, departmentId: true, dateOfJoining: true },
    });
    if (!employee) throw new AppError('Employee not found', 404);
    if (employee.organizationId !== organizationId) {
      throw new AppError('Employee does not belong to this organization', 403);
    }

    const rules = await prisma.shiftAssignmentRule.findMany({
      where: {
        organizationId,
        effectiveDate: { lte: asOfDate },
        remarks: { contains: EVENT_RULE_MARKER },
      },
      orderBy: [{ priority: 'desc' }, { effectiveDate: 'desc' }],
    });

    const matchingRule = rules.find((rule) => {
      const employeeIds = Array.isArray(rule.employeeIds) ? (rule.employeeIds as string[]) : [];
      if (employeeIds.length > 0) return employeeIds.includes(employeeId);
      if (rule.paygroupId && rule.departmentId) {
        return rule.paygroupId === employee.paygroupId && rule.departmentId === employee.departmentId;
      }
      if (rule.paygroupId && !rule.departmentId) return rule.paygroupId === employee.paygroupId;
      if (!rule.paygroupId && rule.departmentId) return rule.departmentId === employee.departmentId;
      return true;
    });

    return {
      employee,
      rule: matchingRule,
      ruleData: this.extractEventRuleData(matchingRule?.remarks),
    };
  }

  private async getTotalExcessMinutes(
    employeeId: string,
    organizationId: string,
    fromDate: Date,
    toDate: Date
  ): Promise<number> {
    const records = await prisma.attendanceRecord.findMany({
      where: {
        employeeId,
        date: { gte: fromDate, lte: toDate },
        checkIn: { not: null },
        checkOut: { not: null },
      },
      include: {
        shift: {
          select: { id: true, name: true, startTime: true, endTime: true },
        },
      },
      orderBy: { date: 'asc' },
    });

    let total = 0;
    const shiftByDate = new Map<string, ShiftLike | null>();

    for (const record of records) {
      if (!record.checkIn || !record.checkOut) continue;
      let shift: ShiftLike | null = record.shift ?? null;

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

      if (!shift?.startTime || !shift?.endTime) continue;
      total += this.computeExcessMinutes(new Date(record.checkIn), new Date(record.checkOut), shift);
    }

    return total;
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
      throw new AppError('Comp Off leave type not configured for this organization', 400);
    }
    return leaveType;
  }

  async getSummary(employeeId: string, organizationId: string) {
    const now = new Date();
    const { employee, rule, ruleData } = await this.getApplicableEventRule(employeeId, organizationId, now);

    const conversionEnabled = ruleData?.considerExtraHoursAsCompOff !== false;
    const combineMultipleDays = ruleData?.combineMultipleDaysExcessTimeToCompOff !== false;
    const fullDayMinutes = Math.max(1, Number(ruleData?.fullDayRequirementInWorkDay ?? 480));
    const halfDayMinutes = Math.max(1, Number(ruleData?.halfDayRequirementInWorkDay ?? 240));

    const startDate = new Date(employee.dateOfJoining);
    startDate.setHours(0, 0, 0, 0);
    if (rule?.effectiveDate && rule.effectiveDate > startDate) {
      startDate.setTime(rule.effectiveDate.getTime());
      startDate.setHours(0, 0, 0, 0);
    }

    const totalExcessMinutes = await this.getTotalExcessMinutes(employeeId, organizationId, startDate, now);
    const { approvedUsed, pendingUsed } = await this.getUsedMinutesByStatus(employeeId, organizationId);

    const availableExcessMinutes = Math.max(0, totalExcessMinutes - approvedUsed);
    const availableExcessMinutesForRequest = Math.max(0, availableExcessMinutes - pendingUsed);

    let eligibleCompOffDays = 0;
    if (conversionEnabled) {
      if (combineMultipleDays) {
        const fullDays = Math.floor(availableExcessMinutesForRequest / fullDayMinutes);
        const remainder = availableExcessMinutesForRequest - fullDays * fullDayMinutes;
        const halfDays = remainder >= halfDayMinutes ? 1 : 0;
        eligibleCompOffDays = fullDays + halfDays * 0.5;
      } else {
        eligibleCompOffDays =
          availableExcessMinutesForRequest >= fullDayMinutes
            ? 1
            : availableExcessMinutesForRequest >= halfDayMinutes
            ? 0.5
            : 0;
      }
    }

    return {
      employeeId,
      organizationId,
      totalExcessMinutes,
      usedExcessMinutes: approvedUsed,
      pendingExcessMinutes: pendingUsed,
      availableExcessMinutes,
      availableExcessMinutesForRequest,
      eligibleCompOffDays,
      fullDayMinutes,
      halfDayMinutes,
      conversionEnabled,
      combineMultipleDays,
    };
  }

  async createRequest(
    employeeId: string,
    organizationId: string,
    data: { requestType: CompOffRequestType; reason?: string }
  ) {
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
