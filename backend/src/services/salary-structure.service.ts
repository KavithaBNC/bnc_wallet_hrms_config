import { AppError } from '../middlewares/errorHandler';
import {
  CreateSalaryStructureInput,
  UpdateSalaryStructureInput,
  QuerySalaryStructuresInput,
} from '../utils/payroll.validation';
import { prisma } from '../utils/prisma';
import { validateComponent, SalaryComponent } from '../utils/salary-components';

export class SalaryStructureService {
  /**
   * Create new salary structure
   */
  async create(data: CreateSalaryStructureInput) {
    // Check if organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: data.organizationId },
    });

    if (!organization) {
      throw new AppError('Organization not found', 404);
    }

    // Validate components
    if (!data.components || data.components.length === 0) {
      throw new AppError('At least one component is required', 400);
    }

    // Validate component structure
    for (const component of data.components) {
      const validation = validateComponent(component as SalaryComponent);
      if (!validation.valid) {
        throw new AppError(
          `Component ${component.name}: ${validation.errors.join(', ')}`,
          400
        );
      }
    }

    // Ensure at least one BASIC earning component exists
    const hasBasicEarning = data.components.some(
      (c) => c.type === 'EARNING' && (c.code === 'BASIC' || c.name.toLowerCase().includes('basic'))
    );
    if (!hasBasicEarning) {
      throw new AppError('At least one BASIC earning component is required', 400);
    }

    const salaryStructure = await prisma.salaryStructure.create({
      data: {
        organizationId: data.organizationId,
        name: data.name,
        description: data.description,
        components: data.components as any,
        isActive: data.isActive ?? true,
      },
      include: {
        organization: {
          select: { id: true, name: true },
        },
      },
    });

    return salaryStructure;
  }

  /**
   * Get all salary structures with filtering and pagination
   */
  async getAll(query: QuerySalaryStructuresInput) {
    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '20');
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.organizationId) {
      where.organizationId = query.organizationId;
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive === 'true' || query.isActive === '1';
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [salaryStructures, total] = await Promise.all([
      prisma.salaryStructure.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          organization: {
            select: { id: true, name: true },
          },
        },
      }),
      prisma.salaryStructure.count({ where }),
    ]);

    return {
      data: salaryStructures,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get salary structure by ID
   */
  async getById(id: string) {
    const salaryStructure = await prisma.salaryStructure.findUnique({
      where: { id },
      include: {
        organization: {
          select: { id: true, name: true },
        },
        employeeSalaries: {
          select: { id: true, employeeId: true },
          take: 5, // Limit to avoid large response
        },
      },
    });

    if (!salaryStructure) {
      throw new AppError('Salary structure not found', 404);
    }

    return salaryStructure;
  }

  /**
   * Update salary structure
   */
  async update(id: string, data: UpdateSalaryStructureInput) {
    const existing = await prisma.salaryStructure.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppError('Salary structure not found', 404);
    }

    // Validate components if provided
    if (data.components) {
      if (data.components.length === 0) {
        throw new AppError('At least one component is required', 400);
      }

      for (const component of data.components) {
        const validation = validateComponent(component as SalaryComponent);
        if (!validation.valid) {
          throw new AppError(
            `Component ${component.name}: ${validation.errors.join(', ')}`,
            400
          );
        }
      }
    }

    const updated = await prisma.salaryStructure.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        components: data.components as any,
        isActive: data.isActive,
      },
      include: {
        organization: {
          select: { id: true, name: true },
        },
      },
    });

    return updated;
  }

  /**
   * Delete salary structure
   */
  async delete(id: string) {
    const existing = await prisma.salaryStructure.findUnique({
      where: { id },
      include: {
        employeeSalaries: {
          take: 1,
        },
      },
    });

    if (!existing) {
      throw new AppError('Salary structure not found', 404);
    }

    // Check if any employees are using this structure
    if (existing.employeeSalaries.length > 0) {
      throw new AppError('Cannot delete salary structure that is assigned to employees', 400);
    }

    await prisma.salaryStructure.delete({
      where: { id },
    });

    return { message: 'Salary structure deleted successfully' };
  }
}

export const salaryStructureService = new SalaryStructureService();
