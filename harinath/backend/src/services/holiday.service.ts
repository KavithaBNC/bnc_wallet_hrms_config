
import { AppError } from '../middlewares/errorHandler';
import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';

export class HolidayService {
  /**
   * Create new holiday
   */
  async create(data: {
    organizationId: string;
    name: string;
    date: string;
    isOptional?: boolean;
    applicableLocations?: any;
    description?: string;
  }) {
    // Check if organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: data.organizationId },
    });

    if (!organization) {
      throw new AppError('Organization not found', 404);
    }

    const holiday = await prisma.holiday.create({
      data: {
        organizationId: data.organizationId,
        name: data.name,
        date: new Date(data.date),
        isOptional: data.isOptional || false,
        applicableLocations: data.applicableLocations || null,
        description: data.description || null,
      },
      include: {
        organization: {
          select: { id: true, name: true },
        },
      },
    });

    return holiday;
  }

  /**
   * Get all holidays with filtering
   */
  async getAll(query: {
    organizationId?: string;
    startDate?: string;
    endDate?: string;
    isOptional?: boolean;
    page?: string;
    limit?: string;
  }) {
    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '20');
    const skip = (page - 1) * limit;

    const where: Prisma.HolidayWhereInput = {};

    if (query.organizationId) {
      where.organizationId = query.organizationId;
    }

    if (query.startDate || query.endDate) {
      where.date = {};
      if (query.startDate) {
        where.date.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.date.lte = new Date(query.endDate);
      }
    }

    if (query.isOptional !== undefined) {
      where.isOptional = query.isOptional;
    }

    const [holidays, total] = await Promise.all([
      prisma.holiday.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: 'asc' },
        include: {
          organization: {
            select: { id: true, name: true },
          },
        },
      }),
      prisma.holiday.count({ where }),
    ]);

    return {
      holidays,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get holiday by ID
   */
  async getById(id: string) {
    const holiday = await prisma.holiday.findUnique({
      where: { id },
      include: {
        organization: {
          select: { id: true, name: true },
        },
      },
    });

    if (!holiday) {
      throw new AppError('Holiday not found', 404);
    }

    return holiday;
  }

  /**
   * Update holiday
   */
  async update(id: string, data: {
    name?: string;
    date?: string;
    isOptional?: boolean;
    applicableLocations?: any;
    description?: string;
  }) {
    const existing = await prisma.holiday.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppError('Holiday not found', 404);
    }

    const updateData: any = {};

    if (data.name) updateData.name = data.name;
    if (data.date) updateData.date = new Date(data.date);
    if (data.isOptional !== undefined) updateData.isOptional = data.isOptional;
    if (data.applicableLocations !== undefined) updateData.applicableLocations = data.applicableLocations;
    if (data.description !== undefined) updateData.description = data.description;

    const holiday = await prisma.holiday.update({
      where: { id },
      data: updateData,
      include: {
        organization: {
          select: { id: true, name: true },
        },
      },
    });

    return holiday;
  }

  /**
   * Delete holiday
   */
  async delete(id: string) {
    const existing = await prisma.holiday.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppError('Holiday not found', 404);
    }

    await prisma.holiday.delete({
      where: { id },
    });

    return { message: 'Holiday deleted successfully' };
  }
}

export const holidayService = new HolidayService();
