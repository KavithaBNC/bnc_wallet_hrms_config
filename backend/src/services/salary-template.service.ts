import { AppError } from '../middlewares/errorHandler';
import {
  CreateSalaryTemplateInput,
  UpdateSalaryTemplateInput,
  QuerySalaryTemplatesInput,
} from '../utils/payroll.validation';
import { prisma } from '../utils/prisma';
import { Prisma } from '@prisma/client';

export class SalaryTemplateService {
  /**
   * Create new salary template
   */
  async create(data: CreateSalaryTemplateInput) {
    // Check if organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: data.organizationId },
    });

    if (!organization) {
      throw new AppError('Organization not found', 404);
    }

    // Check if salary structure exists
    const salaryStructure = await prisma.salaryStructure.findUnique({
      where: { id: data.salaryStructureId },
    });

    if (!salaryStructure) {
      throw new AppError('Salary structure not found', 404);
    }

    // Validate that salary structure belongs to the organization
    if (salaryStructure.organizationId !== data.organizationId) {
      throw new AppError('Salary structure does not belong to this organization', 400);
    }

    // Validate salary amounts
    if (data.grossSalary < data.basicSalary) {
      throw new AppError('Gross salary must be greater than or equal to basic salary', 400);
    }

    if (data.netSalary > data.grossSalary) {
      throw new AppError('Net salary must be less than or equal to gross salary', 400);
    }

    if (data.ctc < data.grossSalary) {
      throw new AppError('CTC must be greater than or equal to gross salary', 400);
    }

    const salaryTemplate = await prisma.salaryTemplate.create({
      data: {
        organizationId: data.organizationId,
        salaryStructureId: data.salaryStructureId,
        name: data.name,
        grade: data.grade,
        level: data.level,
        description: data.description,
        ctc: new Prisma.Decimal(data.ctc),
        basicSalary: new Prisma.Decimal(data.basicSalary),
        grossSalary: new Prisma.Decimal(data.grossSalary),
        netSalary: new Prisma.Decimal(data.netSalary),
        components: data.components as any,
        currency: data.currency,
        paymentFrequency: data.paymentFrequency,
        isActive: data.isActive ?? true,
      },
      include: {
        organization: {
          select: { id: true, name: true },
        },
        salaryStructure: {
          select: { id: true, name: true },
        },
      },
    });

    return salaryTemplate;
  }

  /**
   * Get all salary templates with filtering and pagination
   */
  async getAll(query: QuerySalaryTemplatesInput) {
    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '20');
    const skip = (page - 1) * limit;

    const where: Prisma.SalaryTemplateWhereInput = {};

    if (query.organizationId) {
      where.organizationId = query.organizationId;
    }

    if (query.salaryStructureId) {
      where.salaryStructureId = query.salaryStructureId;
    }

    if (query.grade) {
      where.grade = query.grade;
    }

    if (query.level) {
      where.level = query.level;
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive === 'true' || query.isActive === '1';
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { grade: { contains: query.search, mode: 'insensitive' } },
        { level: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [salaryTemplates, total] = await Promise.all([
      prisma.salaryTemplate.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { grade: 'asc' },
          { level: 'asc' },
          { ctc: 'desc' },
        ],
        include: {
          organization: {
            select: { id: true, name: true },
          },
          salaryStructure: {
            select: { id: true, name: true },
          },
        },
      }),
      prisma.salaryTemplate.count({ where }),
    ]);

    return {
      data: salaryTemplates,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get salary template by ID
   */
  async getById(id: string) {
    const salaryTemplate = await prisma.salaryTemplate.findUnique({
      where: { id },
      include: {
        organization: {
          select: { id: true, name: true },
        },
        salaryStructure: {
          select: { id: true, name: true, components: true },
        },
      },
    });

    if (!salaryTemplate) {
      throw new AppError('Salary template not found', 404);
    }

    return salaryTemplate;
  }

  /**
   * Get salary templates by grade and level
   */
  async getByGradeAndLevel(organizationId: string, grade?: string, level?: string) {
    const where: Prisma.SalaryTemplateWhereInput = {
      organizationId,
      isActive: true,
    };

    if (grade) {
      where.grade = grade;
    }

    if (level) {
      where.level = level;
    }

    const templates = await prisma.salaryTemplate.findMany({
      where,
      orderBy: [
        { grade: 'asc' },
        { level: 'asc' },
        { ctc: 'desc' },
      ],
      include: {
        salaryStructure: {
          select: { id: true, name: true },
        },
      },
    });

    return templates;
  }

  /**
   * Update salary template
   */
  async update(id: string, data: UpdateSalaryTemplateInput) {
    const existing = await prisma.salaryTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppError('Salary template not found', 404);
    }

    const updateData: any = {};

    if (data.salaryStructureId) {
      // Verify salary structure exists and belongs to organization
      const salaryStructure = await prisma.salaryStructure.findUnique({
        where: { id: data.salaryStructureId },
      });

      if (!salaryStructure) {
        throw new AppError('Salary structure not found', 404);
      }

      if (salaryStructure.organizationId !== existing.organizationId) {
        throw new AppError('Salary structure does not belong to this organization', 400);
      }

      updateData.salaryStructureId = data.salaryStructureId;
    }

    if (data.name) updateData.name = data.name;
    if (data.grade !== undefined) updateData.grade = data.grade;
    if (data.level !== undefined) updateData.level = data.level;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.ctc !== undefined) updateData.ctc = new Prisma.Decimal(data.ctc);
    if (data.basicSalary !== undefined) updateData.basicSalary = new Prisma.Decimal(data.basicSalary);
    if (data.grossSalary !== undefined) updateData.grossSalary = new Prisma.Decimal(data.grossSalary);
    if (data.netSalary !== undefined) updateData.netSalary = new Prisma.Decimal(data.netSalary);
    if (data.components) updateData.components = data.components as any;
    if (data.currency) updateData.currency = data.currency;
    if (data.paymentFrequency) updateData.paymentFrequency = data.paymentFrequency;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    // Validate salary amounts if any are being updated
    const finalBasic = updateData.basicSalary ? Number(updateData.basicSalary) : Number(existing.basicSalary);
    const finalGross = updateData.grossSalary ? Number(updateData.grossSalary) : Number(existing.grossSalary);
    const finalNet = updateData.netSalary ? Number(updateData.netSalary) : Number(existing.netSalary);
    const finalCtc = updateData.ctc ? Number(updateData.ctc) : Number(existing.ctc);

    if (finalGross < finalBasic) {
      throw new AppError('Gross salary must be greater than or equal to basic salary', 400);
    }

    if (finalNet > finalGross) {
      throw new AppError('Net salary must be less than or equal to gross salary', 400);
    }

    if (finalCtc < finalGross) {
      throw new AppError('CTC must be greater than or equal to gross salary', 400);
    }

    const updated = await prisma.salaryTemplate.update({
      where: { id },
      data: updateData,
      include: {
        organization: {
          select: { id: true, name: true },
        },
        salaryStructure: {
          select: { id: true, name: true },
        },
      },
    });

    return updated;
  }

  /**
   * Delete salary template
   */
  async delete(id: string) {
    const existing = await prisma.salaryTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppError('Salary template not found', 404);
    }

    await prisma.salaryTemplate.delete({
      where: { id },
    });

    return { message: 'Salary template deleted successfully' };
  }
}

export const salaryTemplateService = new SalaryTemplateService();
