
import { AppError } from '../middlewares/errorHandler';
import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import {
  CreateLeaveTypeInput,
  UpdateLeaveTypeInput,
  QueryLeaveTypesInput,
} from '../utils/leave.validation';

export class LeaveTypeService {
  /**
   * Create new leave type
   */
  async create(data: CreateLeaveTypeInput) {
    // Check if code is unique (if provided)
    if (data.code) {
      const existing = await prisma.leaveType.findUnique({
        where: { code: data.code },
      });

      if (existing) {
        throw new AppError('Leave type code already exists', 400);
      }
    }

    // Check if organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: data.organizationId },
    });

    if (!organization) {
      throw new AppError('Organization not found', 404);
    }

    const leaveType = await prisma.leaveType.create({
      data: {
        ...data,
        defaultDaysPerYear: data.defaultDaysPerYear ? new Prisma.Decimal(data.defaultDaysPerYear) : null,
        maxCarryForward: data.maxCarryForward ? new Prisma.Decimal(data.maxCarryForward) : null,
      },
      include: {
        organization: {
          select: { id: true, name: true },
        },
      },
    });

    return leaveType;
  }

  /**
   * Get all leave types with filtering and pagination
   */
  async getAll(query: QueryLeaveTypesInput) {
    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '20');
    const skip = (page - 1) * limit;

    const where: Prisma.LeaveTypeWhereInput = {};

    if (query.organizationId) {
      where.organizationId = query.organizationId;
    }

    if (query.isActive !== undefined) {
      // Convert string to boolean if needed (from query params)
      // The validation schema transforms it, but handle both cases for safety
      if (typeof query.isActive === 'string') {
        where.isActive = query.isActive === 'true' || query.isActive === '1';
      } else if (typeof query.isActive === 'boolean') {
        where.isActive = query.isActive;
      } else {
        where.isActive = Boolean(query.isActive);
      }
    }

    const [leaveTypes, total] = await Promise.all([
      prisma.leaveType.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          organization: {
            select: { id: true, name: true },
          },
        },
      }),
      prisma.leaveType.count({ where }),
    ]);

    return {
      leaveTypes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get leave type by ID
   */
  async getById(id: string) {
    const leaveType = await prisma.leaveType.findUnique({
      where: { id },
      include: {
        organization: {
          select: { id: true, name: true },
        },
      },
    });

    if (!leaveType) {
      throw new AppError('Leave type not found', 404);
    }

    return leaveType;
  }

  /**
   * Update leave type
   */
  async update(id: string, data: UpdateLeaveTypeInput) {
    const existing = await prisma.leaveType.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppError('Leave type not found', 404);
    }

    // Check if code is unique (if being updated)
    if (data.code && data.code !== existing.code) {
      const codeExists = await prisma.leaveType.findUnique({
        where: { code: data.code },
      });

      if (codeExists) {
        throw new AppError('Leave type code already exists', 400);
      }
    }

    // Check organization if being updated
    if (data.organizationId && data.organizationId !== existing.organizationId) {
      const organization = await prisma.organization.findUnique({
        where: { id: data.organizationId },
      });

      if (!organization) {
        throw new AppError('Organization not found', 404);
      }
    }

    const updateData: any = { ...data };
    if (data.defaultDaysPerYear !== undefined) {
      updateData.defaultDaysPerYear = data.defaultDaysPerYear ? new Prisma.Decimal(data.defaultDaysPerYear) : null;
    }
    if (data.maxCarryForward !== undefined) {
      updateData.maxCarryForward = data.maxCarryForward ? new Prisma.Decimal(data.maxCarryForward) : null;
    }

    const leaveType = await prisma.leaveType.update({
      where: { id },
      data: updateData,
      include: {
        organization: {
          select: { id: true, name: true },
        },
      },
    });

    return leaveType;
  }

  /**
   * Delete leave type (soft delete by setting isActive to false)
   */
  async delete(id: string) {
    const existing = await prisma.leaveType.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppError('Leave type not found', 404);
    }

    // Check if there are active leave requests using this type
    const activeRequests = await prisma.leaveRequest.count({
      where: {
        leaveTypeId: id,
        status: { in: ['PENDING', 'APPROVED'] },
      },
    });

    if (activeRequests > 0) {
      throw new AppError(
        `Cannot delete leave type. There are ${activeRequests} active leave request(s) using this type.`,
        400
      );
    }

    // Soft delete by setting isActive to false
    const leaveType = await prisma.leaveType.update({
      where: { id },
      data: { isActive: false },
    });

    return leaveType;
  }
}

export const leaveTypeService = new LeaveTypeService();
