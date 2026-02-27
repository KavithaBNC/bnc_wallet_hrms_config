import { prisma } from '../utils/prisma';
import { CreateTransferPromotionInput, QueryTransferPromotionsInput, UpdateTransferPromotionInput } from '../utils/transfer-promotion.validation';
import { AppError } from '../middlewares/errorHandler';
import { Prisma } from '@prisma/client';
import { employeeSalaryService } from './employee-salary.service';

export class TransferPromotionService {
  private totalIncrementFromComponents(components: Array<{ incrementValue?: number }> | null | undefined): number {
    if (!Array.isArray(components) || components.length === 0) return 0;
    return components.reduce((sum, c) => sum + (Number(c.incrementValue) || 0), 0);
  }

  async create(data: CreateTransferPromotionInput) {
    const organizationId = data.organizationId;
    const employeeId = data.employeeId;

    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, organizationId },
      select: { id: true },
    });
    if (!employee) {
      throw new AppError('Employee not found in this organization', 404);
    }

    const paygroupId = data.paygroupId || null;

    const effectiveDate = new Date(data.effectiveDate);
    const incrementFrom = data.incrementFrom ? new Date(data.incrementFrom) : null;

    const record = await prisma.transferPromotion.create({
      data: {
        organizationId,
        employeeId,
        paygroupId,
        effectiveDate,
        appliedFrom: data.appliedFrom,
        isIncrement: data.isIncrement,
        incrementFrom,
        afterLOP: new Prisma.Decimal(data.afterLOP),
        beforeLOP: new Prisma.Decimal(data.beforeLOP),
        incrementComponents: data.incrementComponents ?? undefined,
        notes: data.notes ?? undefined,
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
        paygroup: { select: { id: true, name: true } },
      },
    });

    // Apply increment to employee salary: new fixed gross in salary details, previous preserved as history
    if (data.isIncrement && data.incrementComponents?.length) {
      const totalIncrement = this.totalIncrementFromComponents(data.incrementComponents);
      if (totalIncrement > 0) {
        try {
          await employeeSalaryService.applyIncrementFromTransferPromotion(
            employeeId,
            data.effectiveDate,
            totalIncrement
          );
        } catch (_) {
          // Non-fatal: transfer promotion record is saved; salary update can be retried
        }
      }
    }

    return this.toResponse(record);
  }

  async getAll(query: QueryTransferPromotionsInput) {
    const { organizationId, employeeId, page = 1, limit = 20, search } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.TransferPromotionWhereInput = { organizationId };
    if (employeeId) where.employeeId = employeeId;
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
      prisma.transferPromotion.findMany({
        where,
        orderBy: { effectiveDate: 'desc' },
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
          paygroup: { select: { id: true, name: true } },
        },
      }),
      prisma.transferPromotion.count({ where }),
    ]);

    return {
      transferPromotions: items.map((r) => this.toResponse(r)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string) {
    const record = await prisma.transferPromotion.findUnique({
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
        paygroup: { select: { id: true, name: true, code: true } },
        organization: { select: { id: true, name: true } },
      },
    });
    if (!record) return null;
    return this.toResponse(record);
  }

  async update(id: string, data: UpdateTransferPromotionInput) {
    const existing = await prisma.transferPromotion.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Transfer and promotion record not found', 404);
    }
    const updateData: Prisma.TransferPromotionUpdateInput = {};
    if (data.paygroupId !== undefined) {
      if (data.paygroupId) {
        updateData.paygroup = {
          connect: { id: data.paygroupId },
        };
      } else {
        updateData.paygroup = {
          disconnect: true,
        };
      }
    }
    if (data.effectiveDate !== undefined) updateData.effectiveDate = new Date(data.effectiveDate);
    if (data.appliedFrom !== undefined) updateData.appliedFrom = data.appliedFrom;
    if (data.isIncrement !== undefined) updateData.isIncrement = data.isIncrement;
    if (data.incrementFrom !== undefined) {
      updateData.incrementFrom = data.incrementFrom ? new Date(data.incrementFrom) : null;
    }
    if (data.afterLOP !== undefined) updateData.afterLOP = new Prisma.Decimal(data.afterLOP);
    if (data.beforeLOP !== undefined) updateData.beforeLOP = new Prisma.Decimal(data.beforeLOP);
    if (data.incrementComponents !== undefined) {
      updateData.incrementComponents =
        data.incrementComponents === null
          ? Prisma.JsonNull
          : data.incrementComponents;
    }
    if (data.notes !== undefined) updateData.notes = data.notes;

    const record = await prisma.transferPromotion.update({
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
        paygroup: { select: { id: true, name: true } },
      },
    });

    // Apply increment to employee salary on update (same as create)
    if (data.isIncrement && data.incrementComponents?.length && existing.employeeId) {
      const totalIncrement = this.totalIncrementFromComponents(data.incrementComponents);
      if (totalIncrement > 0) {
        const effectiveDateStr = data.effectiveDate ?? (existing.effectiveDate instanceof Date ? existing.effectiveDate.toISOString().slice(0, 10) : String(existing.effectiveDate).slice(0, 10));
        try {
          await employeeSalaryService.applyIncrementFromTransferPromotion(
            existing.employeeId,
            effectiveDateStr,
            totalIncrement
          );
        } catch (_) {
          // Non-fatal
        }
      }
    }

    return this.toResponse(record);
  }

  private toResponse(record: any) {
    return {
      id: record.id,
      organizationId: record.organizationId,
      employeeId: record.employeeId,
      paygroupId: record.paygroupId,
      effectiveDate: record.effectiveDate?.toISOString?.()?.slice(0, 10) ?? record.effectiveDate,
      appliedFrom: record.appliedFrom,
      isIncrement: record.isIncrement,
      incrementFrom: record.incrementFrom?.toISOString?.()?.slice(0, 10) ?? record.incrementFrom,
      afterLOP: Number(record.afterLOP),
      beforeLOP: Number(record.beforeLOP),
      incrementComponents: record.incrementComponents,
      notes: record.notes ?? null,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      employee: record.employee,
      paygroup: record.paygroup,
      organization: record.organization,
    };
  }
}

export const transferPromotionService = new TransferPromotionService();
