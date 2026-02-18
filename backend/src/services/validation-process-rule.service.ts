import { AppError } from '../middlewares/errorHandler';
import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { parsePagination, parseString } from '../utils/queryParser';

export interface ValidationRuleLimitInput {
  periodicity: string;
  maxMinutes?: number | null;
  count?: number | null;
  applyAfterEveryCount?: boolean;
  deductPriority?: string | null;
  sortOrder?: number;
}

export interface ValidationProcessActionInput {
  name: string;
  condition: string;
  correctionMethod: string;
  attendanceComponentId?: string | null;
  autoApply: string;
  dayType: string;
  days: string;
  daysValue?: number | string | null;
  sortOrder?: number;
}

export interface CreateValidationProcessRuleInput {
  organizationId: string;
  displayName: string;
  effectiveDate: string | Date;
  priority?: number | null;
  remarks?: string | null;
  autoCorrect?: boolean;
  correctAfterDays?: number | string | null;
  primaryAction?: boolean;
  hasLimit?: boolean;
  validationGrouping?: string | null;
  employeeIds?: string[] | null;
  shiftIds?: string[] | null;
  paygroupIds?: string[] | null;
  departmentIds?: string[] | null;
  limits?: ValidationRuleLimitInput[];
  actions?: ValidationProcessActionInput[];
}

export class ValidationProcessRuleService {
  async create(data: CreateValidationProcessRuleInput) {
    const organization = await prisma.organization.findUnique({
      where: { id: data.organizationId },
    });
    if (!organization) {
      throw new AppError('Organization not found', 404);
    }

    const effectiveDate = typeof data.effectiveDate === 'string'
      ? new Date(data.effectiveDate)
      : data.effectiveDate;

    const correctAfterDays = data.correctAfterDays != null && data.correctAfterDays !== ''
      ? new Prisma.Decimal(String(data.correctAfterDays))
      : null;

    const rule = await prisma.validationProcessRule.create({
      data: {
        organizationId: data.organizationId,
        displayName: data.displayName.trim(),
        effectiveDate,
        priority: data.priority ?? null,
        remarks: data.remarks?.trim() || null,
        autoCorrect: data.autoCorrect ?? false,
        correctAfterDays,
        primaryAction: data.primaryAction ?? false,
        hasLimit: data.hasLimit ?? false,
        validationGrouping: data.validationGrouping?.trim() || null,
        employeeIds: (data.employeeIds && data.employeeIds.length > 0 ? data.employeeIds : null) as Prisma.InputJsonValue,
        shiftIds: (data.shiftIds && data.shiftIds.length > 0 ? data.shiftIds : null) as Prisma.InputJsonValue,
        paygroupIds: (data.paygroupIds && data.paygroupIds.length > 0 ? data.paygroupIds : null) as Prisma.InputJsonValue,
        departmentIds: (data.departmentIds && data.departmentIds.length > 0 ? data.departmentIds : null) as Prisma.InputJsonValue,
      },
    });

    if (data.limits && data.limits.length > 0) {
      await prisma.validationRuleLimit.createMany({
        data: data.limits.map((l, i) => ({
          validationProcessRuleId: rule.id,
          periodicity: l.periodicity,
          maxMinutes: l.maxMinutes ?? null,
          count: l.count ?? null,
          applyAfterEveryCount: l.applyAfterEveryCount ?? false,
          deductPriority: l.deductPriority || null,
          sortOrder: l.sortOrder ?? i,
        })),
      });
    }

    if (data.actions && data.actions.length > 0) {
      await prisma.validationProcessAction.createMany({
        data: data.actions.map((a, i) => ({
          validationProcessRuleId: rule.id,
          name: a.name,
          condition: a.condition,
          correctionMethod: a.correctionMethod,
          attendanceComponentId: a.attendanceComponentId || null,
          autoApply: a.autoApply,
          dayType: a.dayType,
          days: a.days,
          daysValue: a.daysValue != null && a.daysValue !== '' ? new Prisma.Decimal(String(a.daysValue)) : null,
          sortOrder: a.sortOrder ?? i,
        })),
      });
    }

    return this.getById(rule.id);
  }

  async getAll(query: {
    organizationId?: string;
    validationGrouping?: string;
    effectiveOn?: string;
    page?: string;
    limit?: string;
    search?: string;
  }) {
    const { page, limit } = parsePagination(query.page, query.limit);
    const skip = (page - 1) * limit;
    const search = parseString(query.search);

    const where: Prisma.ValidationProcessRuleWhereInput = {};
    if (query.organizationId) {
      where.organizationId = query.organizationId;
    }
    if (query.validationGrouping) {
      where.validationGrouping = query.validationGrouping;
    }
    if (query.effectiveOn) {
      const d = new Date(query.effectiveOn);
      where.effectiveDate = { lte: d };
    }
    if (search) {
      where.displayName = { contains: search, mode: 'insensitive' };
    }

    const [items, total] = await Promise.all([
      prisma.validationProcessRule.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ priority: 'asc' }, { effectiveDate: 'desc' }],
        include: {
          limits: { orderBy: { sortOrder: 'asc' } },
          actions: {
            orderBy: { sortOrder: 'asc' },
            include: {
              attendanceComponent: { select: { id: true, eventName: true, shortName: true } },
            },
          },
        },
      }),
      prisma.validationProcessRule.count({ where }),
    ]);

    return {
      rules: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string) {
    const rule = await prisma.validationProcessRule.findUnique({
      where: { id },
      include: {
        limits: { orderBy: { sortOrder: 'asc' } },
        actions: {
          orderBy: { sortOrder: 'asc' },
          include: {
            attendanceComponent: { select: { id: true, eventName: true, shortName: true } },
          },
        },
      },
    });
    if (!rule) {
      throw new AppError('Validation process rule not found', 404);
    }
    return rule;
  }

  async update(id: string, data: Partial<CreateValidationProcessRuleInput>) {
    const existing = await prisma.validationProcessRule.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Validation process rule not found', 404);
    }

    const updateData: Prisma.ValidationProcessRuleUpdateInput = {};
    if (data.displayName !== undefined) updateData.displayName = data.displayName.trim();
    if (data.effectiveDate !== undefined) {
      updateData.effectiveDate = typeof data.effectiveDate === 'string' ? new Date(data.effectiveDate) : data.effectiveDate;
    }
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.remarks !== undefined) updateData.remarks = data.remarks?.trim() || null;
    if (data.autoCorrect !== undefined) updateData.autoCorrect = data.autoCorrect;
    if (data.correctAfterDays !== undefined) {
      updateData.correctAfterDays = data.correctAfterDays != null && data.correctAfterDays !== ''
        ? new Prisma.Decimal(String(data.correctAfterDays))
        : null;
    }
    if (data.primaryAction !== undefined) updateData.primaryAction = data.primaryAction;
    if (data.hasLimit !== undefined) updateData.hasLimit = data.hasLimit;
    if (data.validationGrouping !== undefined) updateData.validationGrouping = data.validationGrouping?.trim() || null;
    if (data.employeeIds !== undefined) {
      updateData.employeeIds = (data.employeeIds && data.employeeIds.length > 0 ? data.employeeIds : null) as Prisma.InputJsonValue;
    }
    if (data.shiftIds !== undefined) {
      updateData.shiftIds = (data.shiftIds && data.shiftIds.length > 0 ? data.shiftIds : null) as Prisma.InputJsonValue;
    }
    if (data.paygroupIds !== undefined) {
      updateData.paygroupIds = (data.paygroupIds && data.paygroupIds.length > 0 ? data.paygroupIds : null) as Prisma.InputJsonValue;
    }
    if (data.departmentIds !== undefined) {
      updateData.departmentIds = (data.departmentIds && data.departmentIds.length > 0 ? data.departmentIds : null) as Prisma.InputJsonValue;
    }

    await prisma.validationProcessRule.update({
      where: { id },
      data: updateData,
    });

    if (data.limits !== undefined) {
      await prisma.validationRuleLimit.deleteMany({ where: { validationProcessRuleId: id } });
      if (data.limits.length > 0) {
        await prisma.validationRuleLimit.createMany({
          data: data.limits.map((l, i) => ({
            validationProcessRuleId: id,
            periodicity: l.periodicity,
            maxMinutes: l.maxMinutes ?? null,
            count: l.count ?? null,
            applyAfterEveryCount: l.applyAfterEveryCount ?? false,
            deductPriority: l.deductPriority || null,
            sortOrder: l.sortOrder ?? i,
          })),
        });
      }
    }

    if (data.actions !== undefined) {
      await prisma.validationProcessAction.deleteMany({ where: { validationProcessRuleId: id } });
      if (data.actions.length > 0) {
        await prisma.validationProcessAction.createMany({
          data: data.actions.map((a, i) => ({
            validationProcessRuleId: id,
            name: a.name,
            condition: a.condition,
            correctionMethod: a.correctionMethod,
            attendanceComponentId: a.attendanceComponentId || null,
            autoApply: a.autoApply,
            dayType: a.dayType,
            days: a.days,
            daysValue: a.daysValue != null && a.daysValue !== '' ? new Prisma.Decimal(String(a.daysValue)) : null,
            sortOrder: a.sortOrder ?? i,
          })),
        });
      }
    }

    return this.getById(id);
  }

  async delete(id: string) {
    const existing = await prisma.validationProcessRule.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Validation process rule not found', 404);
    }
    await prisma.validationProcessRule.delete({ where: { id } });
  }

  /**
   * Find the best matching Validation Process Rule for a **Late** scenario.
   * This is read-only and designed to fail soft (returns null on any Prisma error)
   * so that attendance flow is never broken even if validation tables are missing.
   */
  async getApplicableRuleForLate(params: {
    organizationId: string;
    employeeId: string;
    paygroupId?: string | null;
    departmentId?: string | null;
    shiftId?: string | null;
    attendanceDate: Date;
  }) {
    try {
      const baseRules = await prisma.validationProcessRule.findMany({
        where: {
          organizationId: params.organizationId,
          validationGrouping: 'Late',
          effectiveDate: { lte: params.attendanceDate },
        },
        orderBy: [{ priority: 'asc' }, { effectiveDate: 'desc' }],
        include: {
          limits: true,
          actions: true,
        },
      });

      if (!baseRules.length) return null;

      const scored = baseRules
        .map((rule) => {
          const employeeIds = (rule.employeeIds as string[] | null) ?? null;
          const shiftIds = (rule.shiftIds as string[] | null) ?? null;
          const paygroupIds = (rule.paygroupIds as string[] | null) ?? null;
          const departmentIds = (rule.departmentIds as string[] | null) ?? null;

          let score = -1;

          if (employeeIds && employeeIds.includes(params.employeeId)) {
            score = 4;
          } else if (
            paygroupIds &&
            departmentIds &&
            params.paygroupId &&
            params.departmentId &&
            paygroupIds.includes(params.paygroupId) &&
            departmentIds.includes(params.departmentId)
          ) {
            score = 3;
          } else if (paygroupIds && params.paygroupId && paygroupIds.includes(params.paygroupId)) {
            score = 2;
          } else if (departmentIds && params.departmentId && departmentIds.includes(params.departmentId)) {
            score = 2;
          } else if (shiftIds && params.shiftId && shiftIds.includes(params.shiftId)) {
            score = 1;
          } else if (!employeeIds && !paygroupIds && !departmentIds && !shiftIds) {
            // Organization-wide fallback
            score = 0;
          }

          return { rule, score };
        })
        .filter((x) => x.score >= 0);

      if (!scored.length) return null;

      scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const pa = a.rule.priority ?? 0;
        const pb = b.rule.priority ?? 0;
        return pa - pb;
      });

      return scored[0].rule;
    } catch {
      // Table might not exist on some environments; never break attendance flow.
      return null;
    }
  }

  /**
   * Check if today's late instance is still within the configured limits.
   * Currently supports only Monthly count; returns true when no limit is configured.
   * Fails soft (returns true) on any Prisma error.
   */
  async isLateWithinLimits(args: {
    rule: {
      id: string;
      limits?: {
        periodicity: string;
        maxMinutes: number | null;
        count: number | null;
      }[];
    };
    employeeId: string;
    attendanceDate: Date;
    lateMinutesToday: number;
  }): Promise<boolean> {
    try {
      const limits = (args.rule.limits ?? []) as {
        periodicity: string;
        maxMinutes: number | null;
        count: number | null;
      }[];

      const monthly = limits.find((l) => l.periodicity === 'Monthly');
      if (!monthly) return true;

      const year = args.attendanceDate.getUTCFullYear();
      const month = args.attendanceDate.getUTCMonth();
      const monthStart = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));

      // Count previous late days in the same month (before current date)
      const previousCount = await prisma.attendanceRecord.count({
        where: {
          employeeId: args.employeeId,
          isLate: true,
          date: {
            gte: monthStart,
            lt: args.attendanceDate,
          },
        },
      });

      const totalCount = previousCount + 1; // including today

      if (monthly.count == null) {
        // No count cap configured
        return true;
      }

      if (totalCount > monthly.count) {
        return false;
      }

      // You can optionally also enforce maxMinutes here later
      // if (monthly.maxMinutes != null && args.lateMinutesToday > monthly.maxMinutes) return false;

      return true;
    } catch {
      // Any error (including table missing) should not break attendance processing
      return true;
    }
  }
}
