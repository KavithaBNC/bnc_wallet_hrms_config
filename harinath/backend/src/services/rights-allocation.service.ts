import { AppError } from '../middlewares/errorHandler';
import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { parsePagination, parseString } from '../utils/queryParser';

export class RightsAllocationService {
  /**
   * Create new rights allocation
   */
  async create(data: {
    organizationId: string;
    shortName: string;
    longName: string;
    remarks?: string;
    shiftId?: string;
    maxExcessTimeRequestDays?: number;
    monthlyRegularizationCount?: number;
    attendanceEvents?: any;
    excessTimeEvents?: any;
    requestTypeEvents?: any;
    regularizationElements?: any;
  }) {
    // Validate organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: data.organizationId },
    });

    if (!organization) {
      throw new AppError('Organization not found', 404);
    }

    // Validate shift if provided
    if (data.shiftId) {
      const shift = await prisma.shift.findUnique({
        where: { id: data.shiftId },
      });
      if (!shift || shift.organizationId !== data.organizationId) {
        throw new AppError('Shift not found', 404);
      }
    }

    // Check shortName uniqueness within organization
    const existing = await prisma.rightsAllocation.findFirst({
      where: {
        organizationId: data.organizationId,
        shortName: data.shortName.trim(),
      },
    });

    if (existing) {
      throw new AppError('Short name already exists for this organization', 400);
    }

    const rightsAllocation = await prisma.rightsAllocation.create({
      data: {
        organizationId: data.organizationId,
        shortName: data.shortName.trim(),
        longName: data.longName.trim(),
        remarks: data.remarks?.trim() || null,
        shiftId: data.shiftId || null,
        maxExcessTimeRequestDays: data.maxExcessTimeRequestDays ?? 0,
        monthlyRegularizationCount: data.monthlyRegularizationCount ?? null,
        attendanceEvents: data.attendanceEvents ? (data.attendanceEvents as unknown as Prisma.JsonArray) : Prisma.JsonNull,
        excessTimeEvents: data.excessTimeEvents ? (data.excessTimeEvents as unknown as Prisma.JsonArray) : Prisma.JsonNull,
        requestTypeEvents: data.requestTypeEvents ? (data.requestTypeEvents as unknown as Prisma.JsonArray) : Prisma.JsonNull,
        regularizationElements: data.regularizationElements ? (data.regularizationElements as unknown as Prisma.JsonArray) : Prisma.JsonNull,
      },
      include: {
        shift: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    return rightsAllocation;
  }

  /**
   * Get all rights allocations with pagination
   */
  async getAll(query: {
    organizationId?: string;
    page?: string;
    limit?: string;
    search?: string;
  }) {
    const { page, limit } = parsePagination(query.page, query.limit);
    const skip = (page - 1) * limit;
    const search = parseString(query.search);

    const where: Prisma.RightsAllocationWhereInput = {};

    if (query.organizationId) {
      where.organizationId = query.organizationId;
    }

    if (search) {
      where.OR = [
        { shortName: { contains: search, mode: 'insensitive' } },
        { longName: { contains: search, mode: 'insensitive' } },
        { remarks: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.rightsAllocation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          shift: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      }),
      prisma.rightsAllocation.count({ where }),
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
   * Get rights allocation by ID
   */
  async getById(id: string) {
    const rightsAllocation = await prisma.rightsAllocation.findUnique({
      where: { id },
      include: {
        shift: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    if (!rightsAllocation) {
      throw new AppError('Rights allocation not found', 404);
    }

    return rightsAllocation;
  }

  /**
   * Update rights allocation
   */
  async update(
    id: string,
    data: {
      shortName?: string;
      longName?: string;
      remarks?: string;
      shiftId?: string;
      maxExcessTimeRequestDays?: number;
      monthlyRegularizationCount?: number;
      attendanceEvents?: any;
      excessTimeEvents?: any;
      requestTypeEvents?: any;
      regularizationElements?: any;
    }
  ) {
    const existing = await prisma.rightsAllocation.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppError('Rights allocation not found', 404);
    }

    // Validate shift if provided
    if (data.shiftId !== undefined) {
      if (data.shiftId) {
        const shift = await prisma.shift.findUnique({
          where: { id: data.shiftId },
        });
        if (!shift || shift.organizationId !== existing.organizationId) {
          throw new AppError('Shift not found', 404);
        }
      }
    }

    // Check shortName uniqueness if changing
    if (data.shortName && data.shortName.trim() !== existing.shortName) {
      const duplicate = await prisma.rightsAllocation.findFirst({
        where: {
          organizationId: existing.organizationId,
          shortName: data.shortName.trim(),
          id: { not: id },
        },
      });

      if (duplicate) {
        throw new AppError('Short name already exists for this organization', 400);
      }
    }

    const updateData: Prisma.RightsAllocationUpdateInput = {};

    if (data.shortName !== undefined) {
      updateData.shortName = data.shortName.trim();
    }
    if (data.longName !== undefined) {
      updateData.longName = data.longName.trim();
    }
    if (data.remarks !== undefined) {
      updateData.remarks = data.remarks?.trim() || null;
    }
    if (data.shiftId !== undefined) {
      if (data.shiftId) {
        updateData.shift = { connect: { id: data.shiftId } };
      } else {
        updateData.shift = { disconnect: true };
      }
    }
    if (data.maxExcessTimeRequestDays !== undefined) {
      updateData.maxExcessTimeRequestDays = data.maxExcessTimeRequestDays;
    }
    if (data.monthlyRegularizationCount !== undefined) {
      updateData.monthlyRegularizationCount = data.monthlyRegularizationCount ?? null;
    }
    if (data.attendanceEvents !== undefined) {
      updateData.attendanceEvents = data.attendanceEvents
        ? (data.attendanceEvents as unknown as Prisma.JsonArray)
        : Prisma.JsonNull;
    }
    if (data.excessTimeEvents !== undefined) {
      updateData.excessTimeEvents = data.excessTimeEvents
        ? (data.excessTimeEvents as unknown as Prisma.JsonArray)
        : Prisma.JsonNull;
    }
    if (data.requestTypeEvents !== undefined) {
      updateData.requestTypeEvents = data.requestTypeEvents
        ? (data.requestTypeEvents as unknown as Prisma.JsonArray)
        : Prisma.JsonNull;
    }
    if (data.regularizationElements !== undefined) {
      updateData.regularizationElements = data.regularizationElements
        ? (data.regularizationElements as unknown as Prisma.JsonArray)
        : Prisma.JsonNull;
    }

    const rightsAllocation = await prisma.rightsAllocation.update({
      where: { id },
      data: updateData,
      include: {
        shift: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    return rightsAllocation;
  }

  /**
   * Delete rights allocation
   */
  async delete(id: string) {
    const existing = await prisma.rightsAllocation.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppError('Rights allocation not found', 404);
    }

    await prisma.rightsAllocation.delete({
      where: { id },
    });
  }
}
