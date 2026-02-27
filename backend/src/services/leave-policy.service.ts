
import { AppError } from '../middlewares/errorHandler';
import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';

export class LeavePolicyService {
  /**
   * Create new leave policy
   */
  async create(data: {
    organizationId: string;
    leaveTypeId?: string;
    name: string;
    description?: string;
    minServiceMonths?: number;
    eligibleDepartments?: string[];
    eligiblePositions?: string[];
    eligibleEmploymentTypes?: string[];
    accrualType?: 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY' | 'NONE';
    accrualRate?: number;
    accrualStartDate?: Date;
    prorateOnJoining?: boolean;
    prorateOnLeaving?: boolean;
    allowCarryForward?: boolean;
    maxCarryForwardDays?: number;
    carryForwardExpiryMonths?: number;
    requiresApproval?: boolean;
    approvalLevels?: any;
    autoApproveDays?: number;
    minDaysPerRequest?: number;
    maxDaysPerRequest?: number;
    advanceNoticeDays?: number;
    blackoutPeriods?: any[];
    isActive?: boolean;
  }) {
    // Check if organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: data.organizationId },
    });

    if (!organization) {
      throw new AppError('Organization not found', 404);
    }

    // Check if leave type exists (if provided)
    if (data.leaveTypeId) {
      const leaveType = await prisma.leaveType.findUnique({
        where: { id: data.leaveTypeId },
      });

      if (!leaveType) {
        throw new AppError('Leave type not found', 404);
      }

      if (leaveType.organizationId !== data.organizationId) {
        throw new AppError('Leave type does not belong to the organization', 400);
      }
    }

    const policy = await prisma.leavePolicy.create({
      data: {
        organizationId: data.organizationId,
        leaveTypeId: data.leaveTypeId || null,
        name: data.name,
        description: data.description || null,
        minServiceMonths: data.minServiceMonths || null,
        eligibleDepartments: data.eligibleDepartments || undefined,
        eligiblePositions: data.eligiblePositions || undefined,
        eligibleEmploymentTypes: data.eligibleEmploymentTypes || undefined,
        accrualType: data.accrualType || 'ANNUALLY',
        accrualRate: data.accrualRate ? new Prisma.Decimal(data.accrualRate) : null,
        accrualStartDate: data.accrualStartDate || null,
        prorateOnJoining: data.prorateOnJoining !== undefined ? data.prorateOnJoining : true,
        prorateOnLeaving: data.prorateOnLeaving !== undefined ? data.prorateOnLeaving : true,
        allowCarryForward: data.allowCarryForward || false,
        maxCarryForwardDays: data.maxCarryForwardDays ? new Prisma.Decimal(data.maxCarryForwardDays) : null,
        carryForwardExpiryMonths: data.carryForwardExpiryMonths || null,
        requiresApproval: data.requiresApproval !== undefined ? data.requiresApproval : true,
        approvalLevels: data.approvalLevels || null,
        autoApproveDays: data.autoApproveDays || null,
        minDaysPerRequest: data.minDaysPerRequest ? new Prisma.Decimal(data.minDaysPerRequest) : null,
        maxDaysPerRequest: data.maxDaysPerRequest ? new Prisma.Decimal(data.maxDaysPerRequest) : null,
        advanceNoticeDays: data.advanceNoticeDays || null,
        blackoutPeriods: data.blackoutPeriods || undefined,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
      include: {
        organization: {
          select: { id: true, name: true },
        },
        leaveType: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    return policy;
  }

  /**
   * Get all leave policies
   */
  async getAll(query: {
    organizationId?: string;
    leaveTypeId?: string;
    isActive?: boolean;
    page?: string;
    limit?: string;
  }) {
    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '20');
    const skip = (page - 1) * limit;

    const where: Prisma.LeavePolicyWhereInput = {};

    if (query.organizationId) {
      where.organizationId = query.organizationId;
    }

    if (query.leaveTypeId) {
      where.leaveTypeId = query.leaveTypeId;
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    const [policies, total] = await Promise.all([
      prisma.leavePolicy.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          organization: {
            select: { id: true, name: true },
          },
          leaveType: {
            select: { id: true, name: true, code: true },
          },
        },
      }),
      prisma.leavePolicy.count({ where }),
    ]);

    return {
      policies,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get leave policy by ID
   */
  async getById(id: string) {
    const policy = await prisma.leavePolicy.findUnique({
      where: { id },
      include: {
        organization: {
          select: { id: true, name: true },
        },
        leaveType: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    if (!policy) {
      throw new AppError('Leave policy not found', 404);
    }

    return policy;
  }

  /**
   * Update leave policy
   */
  async update(id: string, data: any) {
    const existing = await prisma.leavePolicy.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppError('Leave policy not found', 404);
    }

    const updateData: any = { ...data };
    
    // Convert Decimal fields
    if (data.accrualRate !== undefined) {
      updateData.accrualRate = data.accrualRate ? new Prisma.Decimal(data.accrualRate) : null;
    }
    if (data.maxCarryForwardDays !== undefined) {
      updateData.maxCarryForwardDays = data.maxCarryForwardDays ? new Prisma.Decimal(data.maxCarryForwardDays) : null;
    }
    if (data.minDaysPerRequest !== undefined) {
      updateData.minDaysPerRequest = data.minDaysPerRequest ? new Prisma.Decimal(data.minDaysPerRequest) : null;
    }
    if (data.maxDaysPerRequest !== undefined) {
      updateData.maxDaysPerRequest = data.maxDaysPerRequest ? new Prisma.Decimal(data.maxDaysPerRequest) : null;
    }

    const policy = await prisma.leavePolicy.update({
      where: { id },
      data: updateData,
      include: {
        organization: {
          select: { id: true, name: true },
        },
        leaveType: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    return policy;
  }

  /**
   * Delete leave policy
   */
  async delete(id: string) {
    const existing = await prisma.leavePolicy.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppError('Leave policy not found', 404);
    }

    await prisma.leavePolicy.delete({
      where: { id },
    });

    return { message: 'Leave policy deleted successfully' };
  }

  /**
   * Check if employee is eligible for leave type based on policy
   */
  async checkEligibility(
    employeeId: string,
    leaveTypeId: string
  ): Promise<{ eligible: boolean; reason?: string }> {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        organization: true,
        department: true,
        position: true,
      },
    });

    if (!employee) {
      return { eligible: false, reason: 'Employee not found' };
    }

    // Find applicable policy
    const policy = await prisma.leavePolicy.findFirst({
      where: {
        organizationId: employee.organizationId,
        leaveTypeId,
        isActive: true,
      },
    });

    if (!policy) {
      // No policy means eligible (default behavior)
      return { eligible: true };
    }

    // Check minimum service months
    if (policy.minServiceMonths) {
      const monthsOfService = this.calculateMonthsOfService(employee.dateOfJoining);
      if (monthsOfService < policy.minServiceMonths) {
        return {
          eligible: false,
          reason: `Minimum ${policy.minServiceMonths} months of service required`,
        };
      }
    }

    // Check eligible departments
    if (policy.eligibleDepartments && Array.isArray(policy.eligibleDepartments)) {
      if (employee.departmentId && !policy.eligibleDepartments.includes(employee.departmentId)) {
        return { eligible: false, reason: 'Not eligible for this leave type in your department' };
      }
    }

    // Check eligible positions
    if (policy.eligiblePositions && Array.isArray(policy.eligiblePositions)) {
      if (employee.positionId && !policy.eligiblePositions.includes(employee.positionId)) {
        return { eligible: false, reason: 'Not eligible for this leave type in your position' };
      }
    }

    // Check eligible employment types
    if (policy.eligibleEmploymentTypes && Array.isArray(policy.eligibleEmploymentTypes)) {
      if (employee.employmentType && !policy.eligibleEmploymentTypes.includes(employee.employmentType)) {
        return { eligible: false, reason: 'Not eligible for this leave type with your employment type' };
      }
    }

    return { eligible: true };
  }

  /**
   * Calculate months of service
   */
  private calculateMonthsOfService(joiningDate: Date): number {
    const now = new Date();
    const months = (now.getFullYear() - joiningDate.getFullYear()) * 12 +
      (now.getMonth() - joiningDate.getMonth());
    return Math.max(0, months);
  }
}

export const leavePolicyService = new LeavePolicyService();
