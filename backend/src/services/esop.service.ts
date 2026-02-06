import { prisma } from '../utils/prisma';
import {
  CreateEsopInput,
  CreateEsopBulkInput,
  QueryEsopInput,
  UpdateEsopInput,
} from '../utils/esop.validation';
import { AppError } from '../middlewares/errorHandler';
import { Prisma, Esop } from '@prisma/client';

export class EsopService {
  async create(data: CreateEsopInput) {
    const employee = await prisma.employee.findFirst({
      where: { id: data.employeeId, organizationId: data.organizationId },
      select: { id: true },
    });
    if (!employee) {
      throw new AppError('Employee not found in this organization', 404);
    }

    const record = await prisma.esop.create({
      data: {
        organizationId: data.organizationId,
        employeeId: data.employeeId,
        financialYear: data.financialYear,
        noOfEsop: data.noOfEsop,
        dateOfAllocation: data.dateOfAllocation ? new Date(data.dateOfAllocation) : null,
        visted: data.visted ?? null,
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            middleName: true,
            lastName: true,
          },
        },
      },
    });
    return this.toResponse(record);
  }

  async createBulk(data: CreateEsopBulkInput) {
    const created: ReturnType<typeof this.toResponse>[] = [];
    for (const rec of data.records) {
      if (rec.noOfEsop === 0 && !rec.dateOfAllocation && !rec.visted) continue;
      const record = await this.create({
        organizationId: data.organizationId,
        financialYear: data.financialYear,
        employeeId: rec.employeeId,
        noOfEsop: rec.noOfEsop,
        dateOfAllocation: rec.dateOfAllocation ?? undefined,
        visted: rec.visted ?? undefined,
      });
      created.push(record);
    }
    return { created, count: created.length };
  }

  async getAll(query: QueryEsopInput) {
    const { organizationId, employeeId, financialYear, page = 1, limit = 50, search } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.EsopWhereInput = { organizationId };
    if (employeeId) where.employeeId = employeeId;
    if (financialYear) where.financialYear = financialYear;
    if (search && search.trim()) {
      where.employee = {
        OR: [
          { employeeCode: { contains: search.trim(), mode: 'insensitive' } },
          { firstName: { contains: search.trim(), mode: 'insensitive' } },
          { lastName: { contains: search.trim(), mode: 'insensitive' } },
        ],
      };
    }

    const [items, total] = await Promise.all([
      prisma.esop.findMany({
        where,
        orderBy: [{ financialYear: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
        include: {
          employee: {
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              middleName: true,
              lastName: true,
            },
          },
        },
      }),
      prisma.esop.count({ where }),
    ]);

    return {
      esopRecords: items.map((r) => this.toResponse(r)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getByEmployeeId(employeeId: string, organizationId?: string) {
    const where: Prisma.EsopWhereInput = { employeeId };
    if (organizationId) where.organizationId = organizationId;

    const records = await prisma.esop.findMany({
      where,
      orderBy: [{ financialYear: 'desc' }, { createdAt: 'desc' }],
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            middleName: true,
            lastName: true,
          },
        },
      },
    });
    return records.map((r) => this.toResponse(r));
  }

  async getById(id: string) {
    const record = await prisma.esop.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            middleName: true,
            lastName: true,
            email: true,
          },
        },
        organization: { select: { id: true, name: true } },
      },
    });
    if (!record) return null;
    return this.toResponse(record);
  }

  async update(id: string, data: UpdateEsopInput) {
    const existing = await prisma.esop.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('ESOP record not found', 404);
    }

    const updateData: Prisma.EsopUpdateInput = {};
    if (data.noOfEsop !== undefined) updateData.noOfEsop = data.noOfEsop;
    if (data.dateOfAllocation !== undefined) {
      updateData.dateOfAllocation = data.dateOfAllocation ? new Date(data.dateOfAllocation) : null;
    }
    if (data.visted !== undefined) updateData.visted = data.visted;

    const record = await prisma.esop.update({
      where: { id },
      data: updateData,
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            middleName: true,
            lastName: true,
          },
        },
      },
    });
    return this.toResponse(record);
  }

  async delete(id: string) {
    const existing = await prisma.esop.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('ESOP record not found', 404);
    }
    await prisma.esop.delete({ where: { id } });
  }

  private toResponse(record: Esop & { employee?: any; organization?: any }) {
    return {
      id: record.id,
      organizationId: record.organizationId,
      employeeId: record.employeeId,
      financialYear: record.financialYear,
      noOfEsop: record.noOfEsop,
      dateOfAllocation: record.dateOfAllocation?.toISOString?.()?.slice(0, 10) ?? null,
      visted: record.visted ?? null,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      employee: record.employee,
      organization: record.organization,
    };
  }
}

export const esopService = new EsopService();
