import { prisma } from '../utils/prisma';
import {
  CreateTransferPromotionEntryInput,
  QueryTransferPromotionEntriesInput,
  UpdateTransferPromotionEntryInput,
} from '../utils/transfer-promotion-entry.validation';
import { AppError } from '../middlewares/errorHandler';
import { Prisma } from '@prisma/client';

export class TransferPromotionEntryService {
  async create(data: CreateTransferPromotionEntryInput) {
    const organizationId = data.organizationId;
    const employeeId = data.employeeId;

    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, organizationId },
      select: { id: true },
    });
    if (!employee) {
      throw new AppError('Employee not found in this organization', 404);
    }

    const paygroupId = data.paygroupId && data.paygroupId.trim() !== '' ? data.paygroupId : null;
    const promotionFromId = data.promotionFromId && data.promotionFromId.trim() !== '' ? data.promotionFromId : null;
    const promotionToId = data.promotionToId && data.promotionToId.trim() !== '' ? data.promotionToId : null;

    const effectiveDate = new Date(data.effectiveDate);
    const record = await prisma.transferPromotionEntry.create({
      data: {
        organizationId,
        employeeId,
        paygroupId,
        effectiveDate,
        remarks: data.remarks ?? undefined,
        promotionEnabled: data.promotionEnabled,
        promotionFromId,
        promotionToId,
        transferComponents: data.transferComponents ?? undefined,
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
        promotionFrom: { select: { id: true, title: true } },
        promotionTo: { select: { id: true, title: true } },
      },
    });

    // Apply changes to employee when effective date is reached (today or past)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const effectiveOnly = new Date(effectiveDate);
    effectiveOnly.setHours(0, 0, 0, 0);
    if (effectiveOnly <= today) {
      const employeeUpdateData: { positionId?: string; reportingManagerId?: string | null; departmentId?: string | null; locationId?: string | null } = {};
      if (data.promotionEnabled && promotionToId) {
        employeeUpdateData.positionId = promotionToId;
      }
      await this.applyTransferComponentsToEmployee(organizationId, data.transferComponents, employeeUpdateData);
      if (Object.keys(employeeUpdateData).length > 0) {
        await prisma.employee.update({
          where: { id: employeeId },
          data: employeeUpdateData,
        });
      }
    }

    return this.toResponse(record);
  }

  async getAll(query: QueryTransferPromotionEntriesInput) {
    const { organizationId, employeeId, page = 1, limit = 20, search } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.TransferPromotionEntryWhereInput = { organizationId };
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
      prisma.transferPromotionEntry.findMany({
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
      prisma.transferPromotionEntry.count({ where }),
    ]);

    return {
      transferPromotionEntries: items.map((r) => this.toResponse(r)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string) {
    const record = await prisma.transferPromotionEntry.findUnique({
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
        promotionFrom: { select: { id: true, title: true, code: true } },
        promotionTo: { select: { id: true, title: true, code: true } },
        organization: { select: { id: true, name: true } },
      },
    });
    if (!record) return null;
    return this.toResponse(record);
  }

  async update(id: string, data: UpdateTransferPromotionEntryInput) {
    const existing = await prisma.transferPromotionEntry.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Transfer and promotion entry not found', 404);
    }

    const updateData: Prisma.TransferPromotionEntryUpdateInput = {};
    if (data.paygroupId !== undefined) {
      if (data.paygroupId && data.paygroupId.trim() !== '') {
        updateData.paygroup = { connect: { id: data.paygroupId } };
      } else {
        updateData.paygroup = { disconnect: true };
      }
    }
    if (data.effectiveDate !== undefined) updateData.effectiveDate = new Date(data.effectiveDate);
    if (data.remarks !== undefined) updateData.remarks = data.remarks;
    if (data.promotionEnabled !== undefined) updateData.promotionEnabled = data.promotionEnabled;
    if (data.promotionFromId !== undefined) {
      if (data.promotionFromId && data.promotionFromId.trim() !== '') {
        updateData.promotionFrom = { connect: { id: data.promotionFromId } };
      } else {
        updateData.promotionFrom = { disconnect: true };
      }
    }
    if (data.promotionToId !== undefined) {
      if (data.promotionToId && data.promotionToId.trim() !== '') {
        updateData.promotionTo = { connect: { id: data.promotionToId } };
      } else {
        updateData.promotionTo = { disconnect: true };
      }
    }
    if (data.transferComponents !== undefined) {
      updateData.transferComponents =
        data.transferComponents === null ? Prisma.JsonNull : data.transferComponents;
    }

    const record = await prisma.transferPromotionEntry.update({
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
        promotionFrom: { select: { id: true, title: true } },
        promotionTo: { select: { id: true, title: true } },
      },
    });

    // Apply changes to employee when effective date is reached (today or past)
    const promotionToId = data.promotionToId ?? existing.promotionToId;
    const effectiveDate = data.effectiveDate != null ? new Date(data.effectiveDate) : existing.effectiveDate;
    const transferComponents = data.transferComponents !== undefined ? data.transferComponents : (existing.transferComponents as Array<{ component: string; currentValue: string; newValue: string }> | null);
    if (effectiveDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const effectiveOnly = new Date(effectiveDate);
      effectiveOnly.setHours(0, 0, 0, 0);
      if (effectiveOnly <= today) {
        const employeeUpdateData: { positionId?: string; reportingManagerId?: string | null; departmentId?: string | null; locationId?: string | null } = {};
        if (record.promotionEnabled && promotionToId) {
          employeeUpdateData.positionId = promotionToId;
        }
        await this.applyTransferComponentsToEmployee(existing.organizationId, transferComponents, employeeUpdateData);
        if (Object.keys(employeeUpdateData).length > 0) {
          await prisma.employee.update({
            where: { id: existing.employeeId },
            data: employeeUpdateData,
          });
        }
      }
    }

    return this.toResponse(record);
  }

  /**
   * Apply transfer components (Reporting Manager, Department, Location) to employee update payload.
   * Validates that newValue ids belong to the same organization.
   */
  private async applyTransferComponentsToEmployee(
    organizationId: string,
    transferComponents: Array<{ component: string; currentValue: string; newValue: string }> | null | undefined,
    employeeUpdateData: { positionId?: string; reportingManagerId?: string | null; departmentId?: string | null; locationId?: string | null },
  ): Promise<void> {
    if (!transferComponents || transferComponents.length === 0) return;

    for (const tc of transferComponents) {
      const newValue = (tc.newValue || '').trim();
      if (!newValue) continue;

      if (tc.component === 'Reporting Manager') {
        const manager = await prisma.employee.findFirst({
          where: { id: newValue, organizationId, deletedAt: null },
          select: { id: true },
        });
        if (manager) {
          employeeUpdateData.reportingManagerId = manager.id;
        }
      } else if (tc.component === 'Department') {
        const dept = await prisma.department.findFirst({
          where: { id: newValue, organizationId },
          select: { id: true },
        });
        if (dept) {
          employeeUpdateData.departmentId = dept.id;
        }
      } else if (tc.component === 'Location') {
        const loc = await prisma.location.findFirst({
          where: { id: newValue, organizationId },
          select: { id: true },
        });
        if (loc) {
          employeeUpdateData.locationId = loc.id;
        }
      }
    }
  }

  async delete(id: string) {
    const existing = await prisma.transferPromotionEntry.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Transfer and promotion entry not found', 404);
    }
    await prisma.transferPromotionEntry.delete({ where: { id } });
  }

  private toResponse(record: any) {
    return {
      id: record.id,
      organizationId: record.organizationId,
      employeeId: record.employeeId,
      paygroupId: record.paygroupId,
      effectiveDate: record.effectiveDate?.toISOString?.()?.slice(0, 10) ?? record.effectiveDate,
      remarks: record.remarks ?? null,
      promotionEnabled: record.promotionEnabled,
      promotionFromId: record.promotionFromId,
      promotionToId: record.promotionToId,
      transferComponents: record.transferComponents,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      employee: record.employee,
      paygroup: record.paygroup,
      promotionFrom: record.promotionFrom,
      promotionTo: record.promotionTo,
      organization: record.organization,
    };
  }
}

export const transferPromotionEntryService = new TransferPromotionEntryService();
