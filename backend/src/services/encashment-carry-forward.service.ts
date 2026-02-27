import { AppError } from '../middlewares/errorHandler';
import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { parsePagination, parseString } from '../utils/queryParser';

export class EncashmentCarryForwardService {
  /**
   * Create new encashment/carry forward rule
   */
  async create(data: {
    organizationId: string;
    displayName: string;
    associateId?: string;
    paygroupIds?: string[];
    departmentIds?: string[];
    remarks?: string;
    maxEncashmentDays?: number;
    isEncashmentApplicable?: boolean;
    maxCarryForwardDays?: number;
    isCarryForwardApplicable?: boolean;
    eventType: string;
  }) {
    // Validate organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: data.organizationId },
    });

    if (!organization) {
      throw new AppError('Organization not found', 404);
    }

    // Validate associate if provided
    if (data.associateId) {
      const employee = await prisma.employee.findUnique({
        where: { id: data.associateId },
      });
      if (!employee || employee.organizationId !== data.organizationId) {
        throw new AppError('Associate not found', 404);
      }
    }

    // Validate paygroups if provided
    if (data.paygroupIds && data.paygroupIds.length > 0) {
      const paygroups = await prisma.paygroup.findMany({
        where: {
          id: { in: data.paygroupIds },
          organizationId: data.organizationId,
        },
      });
      if (paygroups.length !== data.paygroupIds.length) {
        throw new AppError('One or more paygroups not found', 404);
      }
    }

    // Validate departments if provided
    if (data.departmentIds && data.departmentIds.length > 0) {
      const departments = await prisma.department.findMany({
        where: {
          id: { in: data.departmentIds },
          organizationId: data.organizationId,
        },
      });
      if (departments.length !== data.departmentIds.length) {
        throw new AppError('One or more departments not found', 404);
      }
    }

    const rule = await prisma.encashmentCarryForward.create({
      data: {
        organizationId: data.organizationId,
        displayName: data.displayName.trim(),
        associateId: data.associateId || null,
        paygroupIds:
          data.paygroupIds && data.paygroupIds.length > 0
            ? (data.paygroupIds as unknown as Prisma.JsonArray)
            : Prisma.JsonNull,
        departmentIds:
          data.departmentIds && data.departmentIds.length > 0
            ? (data.departmentIds as unknown as Prisma.JsonArray)
            : Prisma.JsonNull,
        remarks: data.remarks?.trim() || null,
        maxEncashmentDays: data.maxEncashmentDays ?? 0,
        isEncashmentApplicable: data.isEncashmentApplicable ?? false,
        maxCarryForwardDays: data.maxCarryForwardDays ?? 0,
        isCarryForwardApplicable: data.isCarryForwardApplicable ?? false,
        eventType: data.eventType,
      },
      include: {
        associate: {
          select: {
            id: true,
            firstName: true,
            middleName: true,
            lastName: true,
            employeeCode: true,
          },
        },
      },
    });

    return rule;
  }

  /**
   * Get all encashment/carry forward rules with pagination
   */
  async getAll(query: {
    organizationId?: string;
    page?: string;
    limit?: string;
    search?: string;
    eventType?: string;
  }) {
    const { page, limit } = parsePagination(query.page, query.limit);
    const skip = (page - 1) * limit;
    const search = parseString(query.search);

    const where: Prisma.EncashmentCarryForwardWhereInput = {};

    if (query.organizationId) {
      where.organizationId = query.organizationId;
    }

    if (query.eventType) {
      where.eventType = query.eventType;
    }

    if (search) {
      where.OR = [
        { displayName: { contains: search, mode: 'insensitive' } },
        { remarks: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.encashmentCarryForward.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          associate: {
            select: {
              id: true,
              firstName: true,
              middleName: true,
              lastName: true,
              employeeCode: true,
            },
          },
        },
      }),
      prisma.encashmentCarryForward.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Get encashment/carry forward rule by ID
   */
  async getById(id: string) {
    const rule = await prisma.encashmentCarryForward.findUnique({
      where: { id },
      include: {
        associate: {
          select: {
            id: true,
            firstName: true,
            middleName: true,
            lastName: true,
            employeeCode: true,
          },
        },
      },
    });

    if (!rule) {
      throw new AppError('Encashment/Carry Forward rule not found', 404);
    }

    return rule;
  }

  /**
   * Update encashment/carry forward rule
   */
  async update(
    id: string,
    data: {
      displayName?: string;
      associateId?: string;
      paygroupIds?: string[];
      departmentIds?: string[];
      remarks?: string;
      maxEncashmentDays?: number;
      isEncashmentApplicable?: boolean;
      maxCarryForwardDays?: number;
      isCarryForwardApplicable?: boolean;
      eventType?: string;
    }
  ) {
    const existing = await prisma.encashmentCarryForward.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppError('Encashment/Carry Forward rule not found', 404);
    }

    // Validate associate if provided
    if (data.associateId !== undefined) {
      if (data.associateId) {
        const employee = await prisma.employee.findUnique({
          where: { id: data.associateId },
        });
        if (!employee || employee.organizationId !== existing.organizationId) {
          throw new AppError('Associate not found', 404);
        }
      }
    }

    // Validate paygroups if provided
    if (data.paygroupIds !== undefined && data.paygroupIds.length > 0) {
      const paygroups = await prisma.paygroup.findMany({
        where: {
          id: { in: data.paygroupIds },
          organizationId: existing.organizationId,
        },
      });
      if (paygroups.length !== data.paygroupIds.length) {
        throw new AppError('One or more paygroups not found', 404);
      }
    }

    // Validate departments if provided
    if (data.departmentIds !== undefined && data.departmentIds.length > 0) {
      const departments = await prisma.department.findMany({
        where: {
          id: { in: data.departmentIds },
          organizationId: existing.organizationId,
        },
      });
      if (departments.length !== data.departmentIds.length) {
        throw new AppError('One or more departments not found', 404);
      }
    }

    const updateData: Prisma.EncashmentCarryForwardUpdateInput = {};

    if (data.displayName !== undefined) {
      updateData.displayName = data.displayName.trim();
    }
    if (data.associateId !== undefined) {
      if (data.associateId) {
        updateData.associate = { connect: { id: data.associateId } };
      } else {
        updateData.associate = { disconnect: true };
      }
    }
    if (data.paygroupIds !== undefined) {
      updateData.paygroupIds =
        data.paygroupIds.length > 0
          ? (data.paygroupIds as unknown as Prisma.JsonArray)
          : Prisma.JsonNull;
    }
    if (data.departmentIds !== undefined) {
      updateData.departmentIds =
        data.departmentIds.length > 0
          ? (data.departmentIds as unknown as Prisma.JsonArray)
          : Prisma.JsonNull;
    }
    if (data.remarks !== undefined) {
      updateData.remarks = data.remarks?.trim() || null;
    }
    if (data.maxEncashmentDays !== undefined) {
      updateData.maxEncashmentDays = data.maxEncashmentDays;
    }
    if (data.isEncashmentApplicable !== undefined) {
      updateData.isEncashmentApplicable = data.isEncashmentApplicable;
    }
    if (data.maxCarryForwardDays !== undefined) {
      updateData.maxCarryForwardDays = data.maxCarryForwardDays;
    }
    if (data.isCarryForwardApplicable !== undefined) {
      updateData.isCarryForwardApplicable = data.isCarryForwardApplicable;
    }
    if (data.eventType !== undefined) {
      updateData.eventType = data.eventType;
    }

    const rule = await prisma.encashmentCarryForward.update({
      where: { id },
      data: updateData,
      include: {
        associate: {
          select: {
            id: true,
            firstName: true,
            middleName: true,
            lastName: true,
            employeeCode: true,
          },
        },
      },
    });

    return rule;
  }

  /**
   * Delete encashment/carry forward rule
   */
  async delete(id: string) {
    const existing = await prisma.encashmentCarryForward.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppError('Encashment/Carry Forward rule not found', 404);
    }

    await prisma.encashmentCarryForward.delete({
      where: { id },
    });
  }
}
