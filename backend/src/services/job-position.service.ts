
import { AppError } from '../middlewares/errorHandler';
import { prisma } from '../utils/prisma';
import {
  CreateJobPositionInput,
  UpdateJobPositionInput,
  QueryJobPositionsInput,
} from '../utils/job-position.validation';

export class JobPositionService {
  /**
   * Create new job position
   */
  async create(data: CreateJobPositionInput) {
    // Check if code is unique (if provided)
    if (data.code) {
      const existing = await prisma.jobPosition.findUnique({
        where: { code: data.code },
      });

      if (existing) {
        throw new AppError('Job position code already exists', 400);
      }
    }

    // Check if department exists (if provided)
    if (data.departmentId) {
      const department = await prisma.department.findUnique({
        where: { id: data.departmentId },
      });

      if (!department) {
        throw new AppError('Department not found', 404);
      }

      // Check if department belongs to same organization
      if (department.organizationId !== data.organizationId) {
        throw new AppError('Department must belong to the same organization', 400);
      }
    }

    // Validate salary range
    if (data.salaryRangeMin && data.salaryRangeMax) {
      if (data.salaryRangeMin > data.salaryRangeMax) {
        throw new AppError('Minimum salary cannot be greater than maximum salary', 400);
      }
    }

    const position = await prisma.jobPosition.create({
      data: {
        ...data,
        requirements: data.requirements || [],
        responsibilities: data.responsibilities || [],
      },
      include: {
        organization: {
          select: { id: true, name: true },
        },
        department: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    return position;
  }

  /**
   * Lightweight list for searchable dropdown (id, title, code)
   */
  async list(organizationId: string, search?: string, departmentId?: string) {
    const where: any = { organizationId, isActive: true };
    if (departmentId) {
      where.departmentId = departmentId;
    }
    const searchTerm = (search || '').trim();
    if (searchTerm) {
      where.OR = [
        { title: { contains: searchTerm, mode: 'insensitive' } },
        { code: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }
    return prisma.jobPosition.findMany({
      where,
      orderBy: { title: 'asc' },
      select: { id: true, title: true, code: true },
    });
  }

  /**
   * Get all job positions with filtering and pagination
   */
  async getAll(query: QueryJobPositionsInput) {
    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '20');
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.organizationId) {
      where.organizationId = query.organizationId;
    }

    if (query.departmentId) {
      where.departmentId = query.departmentId;
    }

    if (query.level) {
      where.level = query.level;
    }

    if (query.employmentType) {
      where.employmentType = query.employmentType;
    }

    if (query.isActive) {
      where.isActive = query.isActive === 'true';
    }

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [positions, total] = await Promise.all([
      prisma.jobPosition.findMany({
        where,
        include: {
          organization: {
            select: { id: true, name: true },
          },
          department: {
            select: { id: true, name: true, code: true },
          },
          _count: {
            select: { employees: true },
          },
        },
        skip,
        take: limit,
        orderBy: {
          [query.sortBy || 'title']: query.sortOrder || 'asc',
        },
      }),
      prisma.jobPosition.count({ where }),
    ]);

    return {
      positions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get job position by ID
   */
  async getById(id: string) {
    const position = await prisma.jobPosition.findUnique({
      where: { id },
      include: {
        organization: {
          select: { id: true, name: true },
        },
        department: {
          select: { id: true, name: true, code: true },
        },
        employees: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            email: true,
            employeeStatus: true,
          },
          take: 10, // Limit to first 10 employees
        },
        _count: {
          select: { employees: true },
        },
      },
    });

    if (!position) {
      throw new AppError('Job position not found', 404);
    }

    return position;
  }

  /**
   * Update job position
   */
  async update(id: string, data: UpdateJobPositionInput) {
    const existing = await prisma.jobPosition.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppError('Job position not found', 404);
    }

    // Check if code is unique (if provided and changed)
    if (data.code && data.code !== existing.code) {
      const duplicate = await prisma.jobPosition.findUnique({
        where: { code: data.code },
      });

      if (duplicate) {
        throw new AppError('Job position code already exists', 400);
      }
    }

    // Check if department exists (if provided)
    if (data.departmentId !== undefined && data.departmentId) {
      const department = await prisma.department.findUnique({
        where: { id: data.departmentId },
      });

      if (!department) {
        throw new AppError('Department not found', 404);
      }

      // Check if department belongs to same organization
      if (department.organizationId !== existing.organizationId) {
        throw new AppError('Department must belong to the same organization', 400);
      }
    }

    // Validate salary range
    const newMin = data.salaryRangeMin ?? existing.salaryRangeMin;
    const newMax = data.salaryRangeMax ?? existing.salaryRangeMax;

    if (newMin && newMax) {
      if (Number(newMin) > Number(newMax)) {
        throw new AppError('Minimum salary cannot be greater than maximum salary', 400);
      }
    }

    const updated = await prisma.jobPosition.update({
      where: { id },
      data,
      include: {
        organization: {
          select: { id: true, name: true },
        },
        department: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    return updated;
  }

  /**
   * Soft-delete job position (set isActive to false)
   */
  async delete(id: string) {
    const position = await prisma.jobPosition.findUnique({
      where: { id },
    });

    if (!position) {
      throw new AppError('Job position not found', 404);
    }

    await prisma.jobPosition.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: 'Job position deleted successfully' };
  }

  /**
   * Get positions by department
   */
  async getByDepartment(departmentId: string) {
    const positions = await prisma.jobPosition.findMany({
      where: { departmentId },
      include: {
        _count: {
          select: { employees: true },
        },
      },
      orderBy: { title: 'asc' },
    });

    return positions;
  }

  /**
   * Get position statistics
   */
  async getStatistics(organizationId: string) {
    const [
      totalPositions,
      activePositions,
      positionsByLevel,
      positionsByType,
      positionsWithEmployees,
    ] = await Promise.all([
      prisma.jobPosition.count({
        where: { organizationId },
      }),
      prisma.jobPosition.count({
        where: {
          organizationId,
          isActive: true,
        },
      }),
      prisma.jobPosition.groupBy({
        by: ['level'],
        where: { organizationId },
        _count: true,
      }),
      prisma.jobPosition.groupBy({
        by: ['employmentType'],
        where: { organizationId },
        _count: true,
      }),
      prisma.jobPosition.count({
        where: {
          organizationId,
          employees: {
            some: {},
          },
        },
      }),
    ]);

    return {
      totalPositions,
      activePositions,
      positionsByLevel,
      positionsByType,
      positionsWithEmployees,
      vacantPositions: totalPositions - positionsWithEmployees,
    };
  }
}

export const jobPositionService = new JobPositionService();
