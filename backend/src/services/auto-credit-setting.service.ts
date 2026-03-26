import { AppError } from '../middlewares/errorHandler';
import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { parsePagination, parseString } from '../utils/queryParser';
import { leaveBalanceService } from './leave-balance.service';
import { logger } from '../utils/logger';

export class AutoCreditSettingService {
  async create(data: {
    organizationId: string;
    eventType: string;
    displayName: string;
    associate?: string;
    associateIds?: string[] | null;
    paygroupId?: string;
    paygroupIds?: string[] | null;
    departmentId?: string;
    departmentIds?: string[] | null;
    condition?: string;
    effectiveDate: string;
    effectiveTo?: string;
    priority?: number;
    remarks?: string;
    autoCreditRule?: Record<string, unknown>;
  }) {
    const organization = await prisma.organization.findUnique({
      where: { id: data.organizationId },
    });
    if (!organization) {
      throw new AppError('Organization not found', 404);
    }
    if (data.paygroupId) {
      const paygroup = await prisma.paygroup.findUnique({
        where: { id: data.paygroupId },
      });
      if (!paygroup || paygroup.organizationId !== data.organizationId) {
        throw new AppError('Paygroup not found', 404);
      }
    }
    if (data.departmentId) {
      const department = await prisma.department.findUnique({
        where: { id: data.departmentId },
      });
      if (!department || department.organizationId !== data.organizationId) {
        throw new AppError('Department not found', 404);
      }
    }

    const associateIdsArr = data.associateIds?.length ? data.associateIds.filter(Boolean) : null;
    const paygroupIdsArr = data.paygroupIds?.length ? data.paygroupIds.filter(Boolean) : null;
    const departmentIdsArr = data.departmentIds?.length ? data.departmentIds.filter(Boolean) : null;

    if (associateIdsArr?.length) {
      const empCount = await prisma.employee.count({
        where: { id: { in: associateIdsArr }, organizationId: data.organizationId },
      });
      if (empCount !== associateIdsArr.length) {
        throw new AppError('One or more associates not found', 400);
      }
    }
    if (paygroupIdsArr?.length) {
      const pgCount = await prisma.paygroup.count({
        where: { id: { in: paygroupIdsArr }, organizationId: data.organizationId },
      });
      if (pgCount !== paygroupIdsArr.length) {
        throw new AppError('One or more paygroups not found', 400);
      }
    }
    if (departmentIdsArr?.length) {
      const deptCount = await prisma.department.count({
        where: { id: { in: departmentIdsArr }, organizationId: data.organizationId },
      });
      if (deptCount !== departmentIdsArr.length) {
        throw new AppError('One or more departments not found', 400);
      }
    }

    const effectiveDate = new Date(data.effectiveDate);
    if (isNaN(effectiveDate.getTime())) {
      throw new AppError('Invalid effective date', 400);
    }
    let effectiveTo: Date | null = null;
    if (data.effectiveTo) {
      effectiveTo = new Date(data.effectiveTo);
      if (isNaN(effectiveTo.getTime())) effectiveTo = null;
    }

    const autoCreditSetting = await prisma.autoCreditSetting.create({
      data: {
        organizationId: data.organizationId,
        eventType: data.eventType.trim(),
        displayName: data.displayName.trim(),
        associate: data.associate?.trim() || null,
        associateIds: associateIdsArr as Prisma.InputJsonValue | undefined,
        paygroupId: data.paygroupId || (paygroupIdsArr?.length === 1 ? paygroupIdsArr[0] : null),
        paygroupIds: paygroupIdsArr as Prisma.InputJsonValue | undefined,
        departmentId: data.departmentId || (departmentIdsArr?.length === 1 ? departmentIdsArr[0] : null),
        departmentIds: departmentIdsArr as Prisma.InputJsonValue | undefined,
        condition: data.condition?.trim() || null,
        effectiveDate,
        effectiveTo,
        priority: data.priority ?? 0,
        remarks: data.remarks?.trim() || null,
        autoCreditRule: (data.autoCreditRule ?? undefined) as Prisma.InputJsonValue | undefined,
      },
      include: {
        paygroup: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
      },
    });

    // Trigger background sync so all active employees immediately get updated balances
    setImmediate(() => {
      leaveBalanceService.syncOrgLeaveBalances(data.organizationId)
        .catch((err) => logger.error('Post-create auto-credit sync failed:', err));
    });

    return autoCreditSetting;
  }

  async getAll(query: {
    organizationId?: string;
    eventType?: string;
    page?: string;
    limit?: string;
    search?: string;
  }) {
    const { page, limit } = parsePagination(query.page, query.limit);
    const skip = (page - 1) * limit;
    const search = parseString(query.search);

    const where: Prisma.AutoCreditSettingWhereInput = {};
    if (query.organizationId) {
      where.organizationId = query.organizationId;
    }
    if (query.eventType) {
      where.eventType = query.eventType;
    }
    if (search) {
      where.OR = [
        { displayName: { contains: search, mode: 'insensitive' } },
        { associate: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.autoCreditSetting.findMany({
        where,
        skip,
        take: limit,
        orderBy: { priority: 'asc' },
        include: {
          paygroup: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
        },
      }),
      prisma.autoCreditSetting.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string) {
    const autoCreditSetting = await prisma.autoCreditSetting.findUnique({
      where: { id },
      include: {
        paygroup: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
      },
    });
    if (!autoCreditSetting) {
      throw new AppError('Auto credit setting not found', 404);
    }
    return autoCreditSetting;
  }

  async update(
    id: string,
    data: {
      eventType?: string;
      displayName?: string;
      associate?: string;
      associateIds?: string[] | null;
      paygroupId?: string;
      paygroupIds?: string[] | null;
      departmentId?: string;
      departmentIds?: string[] | null;
      condition?: string;
      effectiveDate?: string;
      effectiveTo?: string;
      priority?: number;
      remarks?: string;
      autoCreditRule?: Record<string, unknown>;
    }
  ) {
    const existing = await prisma.autoCreditSetting.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Auto credit setting not found', 404);
    }
    if (data.paygroupId !== undefined && data.paygroupId) {
      const paygroup = await prisma.paygroup.findUnique({
        where: { id: data.paygroupId },
      });
      if (!paygroup || paygroup.organizationId !== existing.organizationId) {
        throw new AppError('Paygroup not found', 404);
      }
    }
    if (data.departmentId !== undefined && data.departmentId) {
      const department = await prisma.department.findUnique({
        where: { id: data.departmentId },
      });
      if (!department || department.organizationId !== existing.organizationId) {
        throw new AppError('Department not found', 404);
      }
    }

    const associateIdsArr = data.associateIds !== undefined
      ? (data.associateIds?.length ? data.associateIds.filter(Boolean) : null)
      : undefined;
    const paygroupIdsArr = data.paygroupIds !== undefined
      ? (data.paygroupIds?.length ? data.paygroupIds.filter(Boolean) : null)
      : undefined;
    const departmentIdsArr = data.departmentIds !== undefined
      ? (data.departmentIds?.length ? data.departmentIds.filter(Boolean) : null)
      : undefined;

    if (associateIdsArr?.length) {
      const empCount = await prisma.employee.count({
        where: { id: { in: associateIdsArr }, organizationId: existing.organizationId },
      });
      if (empCount !== associateIdsArr.length) {
        throw new AppError('One or more associates not found', 400);
      }
    }
    if (paygroupIdsArr?.length) {
      const pgCount = await prisma.paygroup.count({
        where: { id: { in: paygroupIdsArr }, organizationId: existing.organizationId },
      });
      if (pgCount !== paygroupIdsArr.length) {
        throw new AppError('One or more paygroups not found', 400);
      }
    }
    if (departmentIdsArr?.length) {
      const deptCount = await prisma.department.count({
        where: { id: { in: departmentIdsArr }, organizationId: existing.organizationId },
      });
      if (deptCount !== departmentIdsArr.length) {
        throw new AppError('One or more departments not found', 400);
      }
    }

    const updateData: Prisma.AutoCreditSettingUpdateInput = {};
    if (data.eventType !== undefined) updateData.eventType = data.eventType.trim();
    if (data.displayName !== undefined) updateData.displayName = data.displayName.trim();
    if (data.associate !== undefined) updateData.associate = data.associate?.trim() || null;
    if (associateIdsArr !== undefined) updateData.associateIds = associateIdsArr as Prisma.InputJsonValue;
    if (paygroupIdsArr !== undefined) {
      updateData.paygroupIds = paygroupIdsArr as Prisma.InputJsonValue;
      updateData.paygroup = paygroupIdsArr?.length === 1 ? { connect: { id: paygroupIdsArr[0] } } : { disconnect: true };
    } else if (data.paygroupId !== undefined) {
      updateData.paygroup = data.paygroupId ? { connect: { id: data.paygroupId } } : { disconnect: true };
    }
    if (departmentIdsArr !== undefined) {
      updateData.departmentIds = departmentIdsArr as Prisma.InputJsonValue;
      updateData.department = departmentIdsArr?.length === 1 ? { connect: { id: departmentIdsArr[0] } } : { disconnect: true };
    } else if (data.departmentId !== undefined) {
      updateData.department = data.departmentId ? { connect: { id: data.departmentId } } : { disconnect: true };
    }
    if (data.condition !== undefined) updateData.condition = data.condition?.trim() || null;
    if (data.effectiveDate !== undefined) {
      const effectiveDate = new Date(data.effectiveDate);
      if (!isNaN(effectiveDate.getTime())) updateData.effectiveDate = effectiveDate;
    }
    if (data.effectiveTo !== undefined) {
      if (!data.effectiveTo) updateData.effectiveTo = null;
      else {
        const effectiveTo = new Date(data.effectiveTo);
        if (!isNaN(effectiveTo.getTime())) updateData.effectiveTo = effectiveTo;
      }
    }
    if (data.priority !== undefined) updateData.priority = data.priority ?? 0;
    if (data.remarks !== undefined) updateData.remarks = data.remarks?.trim() || null;
    if (data.autoCreditRule !== undefined) updateData.autoCreditRule = data.autoCreditRule as Prisma.InputJsonValue;

    const autoCreditSetting = await prisma.autoCreditSetting.update({
      where: { id },
      data: updateData,
      include: {
        paygroup: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
      },
    });

    // Trigger background sync so all active employees immediately get updated balances
    setImmediate(() => {
      leaveBalanceService.syncOrgLeaveBalances(existing.organizationId)
        .catch((err) => logger.error('Post-update auto-credit sync failed:', err));
    });

    return autoCreditSetting;
  }

  async delete(id: string) {
    const existing = await prisma.autoCreditSetting.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Auto credit setting not found', 404);
    }
    await prisma.autoCreditSetting.delete({ where: { id } });
  }
}
