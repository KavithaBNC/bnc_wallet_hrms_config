import { AppError } from '../middlewares/errorHandler';
import { prisma } from '../utils/prisma';
import { Prisma } from '@prisma/client';
import type {
  CreatePoolInput, UpdatePoolInput, QueryPoolInput,
  CreateVestingPlanInput, UpdateVestingPlanInput, QueryVestingPlanInput,
  CreateGrantInput, QueryGrantInput,
  QueryVestingScheduleInput, ProcessVestingInput,
  CreateExerciseRequestInput, RejectExerciseInput, QueryExerciseInput,
  QueryLedgerInput,
} from '../utils/esop.validation';

/**
 * Add months to a Date object (day-of-month preserved, clamped to month end)
 */
function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  // Clamp to last day of month if overflow (e.g. Jan 31 + 1 month → Feb 28)
  if (d.getDate() < day) d.setDate(0);
  return d;
}

/**
 * Generate vesting schedule tranches based on vesting plan settings.
 * Returns array of { trancheNumber, vestingDate, scheduledShares }.
 */
function generateVestingTranches(
  grantDate: Date,
  totalShares: number,
  vestingPeriodMonths: number,
  cliffMonths: number,
  frequency: string,
): Array<{ trancheNumber: number; vestingDate: Date; scheduledShares: number }> {
  const intervalMonths =
    frequency === 'MONTHLY' ? 1 : frequency === 'QUARTERLY' ? 3 : 12;

  // First vest offset: cliff if set, otherwise first interval
  const firstOffset = cliffMonths > 0 ? cliffMonths : intervalMonths;

  const vestOffsets: number[] = [];
  let offset = firstOffset;
  while (offset <= vestingPeriodMonths) {
    vestOffsets.push(offset);
    offset += intervalMonths;
  }

  if (vestOffsets.length === 0) {
    // Fallback: single tranche at vestingPeriodMonths
    vestOffsets.push(vestingPeriodMonths);
  }

  const numTranches = vestOffsets.length;
  const base = Math.floor(totalShares / numTranches);
  const remainder = totalShares - base * numTranches;

  return vestOffsets.map((off, i) => ({
    trancheNumber: i + 1,
    vestingDate: addMonths(grantDate, off),
    scheduledShares: i === numTranches - 1 ? base + remainder : base,
  }));
}

export class EsopService {
  // ─────────────────────────────────────────────
  // DASHBOARD
  // ─────────────────────────────────────────────

  async getDashboard(organizationId: string) {
    const [pools, grants, pendingExercises, pendingVesting] = await Promise.all([
      prisma.esopPool.aggregate({
        where: { organizationId },
        _sum: { totalShares: true, allocatedShares: true, availableShares: true },
        _count: { id: true },
      }),
      prisma.esopGrant.aggregate({
        where: { organizationId, status: 'ACTIVE' },
        _sum: { totalShares: true, vestedShares: true, exercisedShares: true },
        _count: { id: true },
      }),
      prisma.esopExerciseRequest.count({
        where: { organizationId, status: 'PENDING' },
      }),
      prisma.vestingSchedule.count({
        where: { organizationId, status: 'PENDING' },
      }),
    ]);

    return {
      totalPools: pools._count.id,
      totalPoolShares: pools._sum.totalShares ?? 0,
      totalAllocatedShares: pools._sum.allocatedShares ?? 0,
      totalAvailableShares: pools._sum.availableShares ?? 0,
      totalActiveGrants: grants._count.id,
      totalGrantedShares: grants._sum.totalShares ?? 0,
      totalVestedShares: grants._sum.vestedShares ?? 0,
      totalExercisedShares: grants._sum.exercisedShares ?? 0,
      pendingExerciseRequests: pendingExercises,
      pendingVestingSchedules: pendingVesting,
    };
  }

  // ─────────────────────────────────────────────
  // ESOP POOLS
  // ─────────────────────────────────────────────

  async createPool(data: CreatePoolInput, performedBy?: string) {
    const pool = await prisma.esopPool.create({
      data: {
        organizationId: data.organizationId,
        poolName: data.poolName,
        totalShares: data.totalShares,
        allocatedShares: 0,
        availableShares: data.totalShares,
        sharePrice: new Prisma.Decimal(data.sharePrice.toFixed(4)),
        currency: data.currency ?? 'INR',
        description: data.description ?? null,
        isActive: true,
        createdBy: performedBy ?? null,
      },
    });

    await prisma.esopLedger.create({
      data: {
        organizationId: data.organizationId,
        transactionType: 'POOL_CREATED',
        poolId: pool.id,
        sharesCount: data.totalShares,
        sharePrice: new Prisma.Decimal(data.sharePrice.toFixed(4)),
        description: `ESOP Pool created: ${data.poolName}`,
        performedBy: performedBy ?? null,
        metadata: { poolName: data.poolName, totalShares: data.totalShares },
      },
    });

    return pool;
  }

  async getAllPools(query: QueryPoolInput) {
    const { organizationId, search, isActive, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.EsopPoolWhereInput = {
      organizationId,
      ...(isActive !== undefined ? { isActive } : {}),
      ...(search ? { poolName: { contains: search, mode: 'insensitive' } } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.esopPool.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { _count: { select: { grants: true } } },
      }),
      prisma.esopPool.count({ where }),
    ]);

    return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getPoolById(id: string, organizationId: string) {
    const pool = await prisma.esopPool.findFirst({
      where: { id, organizationId },
      include: { _count: { select: { grants: true } } },
    });
    if (!pool) throw new AppError('ESOP Pool not found', 404);
    return pool;
  }

  async updatePool(id: string, organizationId: string, data: UpdatePoolInput, performedBy?: string) {
    const pool = await this.getPoolById(id, organizationId);

    if (data.totalShares !== undefined && data.totalShares < pool.allocatedShares) {
      throw new AppError(
        `Cannot reduce total shares below allocated amount (${pool.allocatedShares})`,
        400,
      );
    }

    const updateData: Prisma.EsopPoolUpdateInput = {};
    if (data.poolName !== undefined) updateData.poolName = data.poolName;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.sharePrice !== undefined)
      updateData.sharePrice = new Prisma.Decimal(data.sharePrice.toFixed(4));
    if (data.totalShares !== undefined) {
      updateData.totalShares = data.totalShares;
      updateData.availableShares = data.totalShares - pool.allocatedShares;
    }

    const updated = await prisma.esopPool.update({ where: { id }, data: updateData });

    await prisma.esopLedger.create({
      data: {
        organizationId,
        transactionType: 'POOL_UPDATED',
        poolId: id,
        description: `ESOP Pool updated: ${updated.poolName}`,
        performedBy: performedBy ?? null,
        metadata: { changes: data },
      },
    });

    return updated;
  }

  async deletePool(id: string, organizationId: string) {
    const pool = await this.getPoolById(id, organizationId);
    if (pool.allocatedShares > 0) {
      throw new AppError('Cannot delete a pool that has active grants', 400);
    }
    await prisma.esopPool.delete({ where: { id } });
  }

  // ─────────────────────────────────────────────
  // VESTING PLANS
  // ─────────────────────────────────────────────

  async createVestingPlan(data: CreateVestingPlanInput, performedBy?: string) {
    const plan = await prisma.vestingPlan.create({
      data: {
        organizationId: data.organizationId,
        planName: data.planName,
        description: data.description ?? null,
        vestingPeriodMonths: data.vestingPeriodMonths,
        cliffMonths: data.cliffMonths ?? 0,
        frequency: data.frequency,
        isActive: true,
        createdBy: performedBy ?? null,
      },
    });

    await prisma.esopLedger.create({
      data: {
        organizationId: data.organizationId,
        transactionType: 'PLAN_CREATED',
        description: `Vesting plan created: ${data.planName}`,
        performedBy: performedBy ?? null,
        metadata: { planId: plan.id, planName: plan.planName },
      },
    });

    return plan;
  }

  async getAllVestingPlans(query: QueryVestingPlanInput) {
    const { organizationId, isActive, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.VestingPlanWhereInput = {
      organizationId,
      ...(isActive !== undefined ? { isActive } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.vestingPlan.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { _count: { select: { grants: true } } },
      }),
      prisma.vestingPlan.count({ where }),
    ]);

    return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getVestingPlanById(id: string, organizationId: string) {
    const plan = await prisma.vestingPlan.findFirst({ where: { id, organizationId } });
    if (!plan) throw new AppError('Vesting plan not found', 404);
    return plan;
  }

  async updateVestingPlan(id: string, organizationId: string, data: UpdateVestingPlanInput) {
    const plan = await this.getVestingPlanById(id, organizationId);

    if (
      (data.vestingPeriodMonths !== undefined ||
        data.cliffMonths !== undefined ||
        data.frequency !== undefined) &&
      plan.isActive
    ) {
      const grantCount = await prisma.esopGrant.count({
        where: { vestingPlanId: id, status: 'ACTIVE' },
      });
      if (grantCount > 0) {
        throw new AppError(
          `Cannot change vesting structure: ${grantCount} active grant(s) reference this plan`,
          400,
        );
      }
    }

    const updateData: Prisma.VestingPlanUpdateInput = {};
    if (data.planName !== undefined) updateData.planName = data.planName;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.vestingPeriodMonths !== undefined) updateData.vestingPeriodMonths = data.vestingPeriodMonths;
    if (data.cliffMonths !== undefined) updateData.cliffMonths = data.cliffMonths;
    if (data.frequency !== undefined) updateData.frequency = data.frequency;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    return prisma.vestingPlan.update({ where: { id }, data: updateData });
  }

  async deleteVestingPlan(id: string, organizationId: string) {
    await this.getVestingPlanById(id, organizationId);
    const grantCount = await prisma.esopGrant.count({ where: { vestingPlanId: id } });
    if (grantCount > 0) {
      throw new AppError('Cannot delete a vesting plan that has associated grants', 400);
    }
    await prisma.vestingPlan.delete({ where: { id } });
  }

  // ─────────────────────────────────────────────
  // ESOP GRANTS
  // ─────────────────────────────────────────────

  async createGrant(data: CreateGrantInput, performedBy?: string) {
    const employee = await prisma.employee.findFirst({
      where: { id: data.employeeId, organizationId: data.organizationId },
      select: { id: true, firstName: true, lastName: true, employeeCode: true, employeeStatus: true },
    });
    if (!employee) throw new AppError('Employee not found in this organization', 404);
    if (employee.employeeStatus !== 'ACTIVE') {
      throw new AppError('Cannot grant ESOP to an inactive employee', 400);
    }

    const pool = await prisma.esopPool.findFirst({
      where: { id: data.poolId, organizationId: data.organizationId },
    });
    if (!pool) throw new AppError('ESOP Pool not found', 404);
    if (!pool.isActive) throw new AppError('ESOP Pool is not active', 400);
    if (pool.availableShares < data.totalShares) {
      throw new AppError(
        `Insufficient shares in pool. Available: ${pool.availableShares}, Requested: ${data.totalShares}`,
        400,
      );
    }

    const vestingPlan = await prisma.vestingPlan.findFirst({
      where: { id: data.vestingPlanId, organizationId: data.organizationId },
    });
    if (!vestingPlan) throw new AppError('Vesting plan not found', 404);
    if (!vestingPlan.isActive) throw new AppError('Vesting plan is not active', 400);

    const grantDate = new Date(data.grantDate);
    const tranches = generateVestingTranches(
      grantDate,
      data.totalShares,
      vestingPlan.vestingPeriodMonths,
      vestingPlan.cliffMonths,
      vestingPlan.frequency,
    );

    const result = await prisma.$transaction(async (tx) => {
      const grant = await tx.esopGrant.create({
        data: {
          organizationId: data.organizationId,
          employeeId: data.employeeId,
          poolId: data.poolId,
          vestingPlanId: data.vestingPlanId,
          grantDate,
          totalShares: data.totalShares,
          vestedShares: 0,
          exercisedShares: 0,
          grantPrice: new Prisma.Decimal(data.grantPrice.toFixed(4)),
          status: 'ACTIVE',
          remarks: data.remarks ?? null,
          grantedBy: performedBy ?? null,
        },
      });

      await tx.vestingSchedule.createMany({
        data: tranches.map((t) => ({
          organizationId: data.organizationId,
          grantId: grant.id,
          trancheNumber: t.trancheNumber,
          vestingDate: t.vestingDate,
          scheduledShares: t.scheduledShares,
          vestedShares: 0,
          status: 'PENDING' as const,
        })),
      });

      await tx.esopPool.update({
        where: { id: data.poolId },
        data: {
          allocatedShares: { increment: data.totalShares },
          availableShares: { decrement: data.totalShares },
        },
      });

      await tx.esopLedger.create({
        data: {
          organizationId: data.organizationId,
          transactionType: 'GRANT_ISSUED',
          poolId: data.poolId,
          grantId: grant.id,
          employeeId: data.employeeId,
          sharesCount: data.totalShares,
          sharePrice: new Prisma.Decimal(data.grantPrice.toFixed(4)),
          transactionValue: new Prisma.Decimal((data.totalShares * data.grantPrice).toFixed(2)),
          description: `ESOP grant issued to ${employee.firstName} ${employee.lastName} (${employee.employeeCode})`,
          performedBy: performedBy ?? null,
          metadata: { vestingTranches: tranches.length },
        },
      });

      return grant;
    });

    return result;
  }

  async getAllGrants(query: QueryGrantInput) {
    const { organizationId, employeeId, poolId, status, search, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.EsopGrantWhereInput = {
      organizationId,
      ...(employeeId ? { employeeId } : {}),
      ...(poolId ? { poolId } : {}),
      ...(status ? { status } : {}),
      ...(search
        ? {
            employee: {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { employeeCode: { contains: search, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.esopGrant.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          employee: {
            select: {
              id: true, employeeCode: true, firstName: true, lastName: true,
              department: { select: { name: true } },
            },
          },
          pool: { select: { id: true, poolName: true, sharePrice: true } },
          vestingPlan: {
            select: { id: true, planName: true, frequency: true, vestingPeriodMonths: true, cliffMonths: true },
          },
          _count: { select: { vestingSchedules: true, exerciseRequests: true } },
        },
      }),
      prisma.esopGrant.count({ where }),
    ]);

    return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getGrantById(id: string, organizationId: string) {
    const grant = await prisma.esopGrant.findFirst({
      where: { id, organizationId },
      include: {
        employee: {
          select: {
            id: true, employeeCode: true, firstName: true, lastName: true,
            department: { select: { name: true } },
          },
        },
        pool: { select: { id: true, poolName: true, sharePrice: true } },
        vestingPlan: true,
        vestingSchedules: { orderBy: { trancheNumber: 'asc' } },
        exerciseRequests: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!grant) throw new AppError('ESOP Grant not found', 404);
    return grant;
  }

  async cancelGrant(id: string, organizationId: string, performedBy?: string) {
    const grant = await this.getGrantById(id, organizationId);
    if (grant.status !== 'ACTIVE') {
      throw new AppError('Only active grants can be cancelled', 400);
    }

    const unvestedShares = grant.totalShares - grant.vestedShares;

    await prisma.$transaction(async (tx) => {
      await tx.esopGrant.update({ where: { id }, data: { status: 'CANCELLED' } });

      await tx.vestingSchedule.updateMany({
        where: { grantId: id, status: 'PENDING' },
        data: { status: 'LAPSED' },
      });

      if (unvestedShares > 0) {
        await tx.esopPool.update({
          where: { id: grant.poolId },
          data: {
            allocatedShares: { decrement: unvestedShares },
            availableShares: { increment: unvestedShares },
          },
        });
      }

      await tx.esopLedger.create({
        data: {
          organizationId,
          transactionType: 'GRANT_CANCELLED',
          grantId: id,
          poolId: grant.poolId,
          employeeId: grant.employeeId,
          sharesCount: unvestedShares,
          description: `ESOP grant cancelled. ${unvestedShares} unvested shares returned to pool.`,
          performedBy: performedBy ?? null,
        },
      });
    });

    return prisma.esopGrant.findUnique({ where: { id } });
  }

  // ─────────────────────────────────────────────
  // VESTING SCHEDULES
  // ─────────────────────────────────────────────

  async getVestingSchedules(query: QueryVestingScheduleInput) {
    const { organizationId, grantId, employeeId, status, fromDate, toDate, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.VestingScheduleWhereInput = {
      organizationId,
      ...(grantId ? { grantId } : {}),
      ...(status ? { status } : {}),
      ...(employeeId ? { grant: { employeeId } } : {}),
      ...(fromDate || toDate
        ? {
            vestingDate: {
              ...(fromDate ? { gte: new Date(fromDate) } : {}),
              ...(toDate ? { lte: new Date(toDate) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.vestingSchedule.findMany({
        where,
        orderBy: [{ vestingDate: 'asc' }, { trancheNumber: 'asc' }],
        skip,
        take: limit,
        include: {
          grant: {
            include: {
              employee: {
                select: { id: true, employeeCode: true, firstName: true, lastName: true },
              },
            },
          },
        },
      }),
      prisma.vestingSchedule.count({ where }),
    ]);

    return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async processVesting(data: ProcessVestingInput, performedBy?: string) {
    const asOf = data.asOf ? new Date(data.asOf) : new Date();
    asOf.setHours(23, 59, 59, 999);

    const dueSchedules = await prisma.vestingSchedule.findMany({
      where: {
        organizationId: data.organizationId,
        status: 'PENDING',
        vestingDate: { lte: asOf },
      },
      include: {
        grant: {
          include: {
            employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
          },
        },
      },
    });

    if (dueSchedules.length === 0) {
      return { processed: 0, totalSharesVested: 0 };
    }

    let totalSharesVested = 0;

    await prisma.$transaction(async (tx) => {
      for (const schedule of dueSchedules) {
        await tx.vestingSchedule.update({
          where: { id: schedule.id },
          data: { status: 'VESTED', vestedShares: schedule.scheduledShares, processedAt: new Date() },
        });

        await tx.esopGrant.update({
          where: { id: schedule.grantId },
          data: { vestedShares: { increment: schedule.scheduledShares } },
        });

        await tx.esopLedger.create({
          data: {
            organizationId: data.organizationId,
            transactionType: 'SHARES_VESTED',
            grantId: schedule.grantId,
            scheduleId: schedule.id,
            employeeId: schedule.grant.employeeId,
            sharesCount: schedule.scheduledShares,
            sharePrice: schedule.grant.grantPrice,
            transactionValue: new Prisma.Decimal(
              (schedule.scheduledShares * Number(schedule.grant.grantPrice)).toFixed(2),
            ),
            description: `Tranche ${schedule.trancheNumber} vested for ${schedule.grant.employee.firstName} ${schedule.grant.employee.lastName}`,
            performedBy: performedBy ?? null,
          },
        });

        totalSharesVested += schedule.scheduledShares;
      }
    });

    return { processed: dueSchedules.length, totalSharesVested };
  }

  // ─────────────────────────────────────────────
  // EXERCISE REQUESTS
  // ─────────────────────────────────────────────

  private async getAvailableToExercise(grantId: string, organizationId: string) {
    const grant = await prisma.esopGrant.findFirst({
      where: { id: grantId, organizationId },
      select: { id: true, vestedShares: true, status: true },
    });
    if (!grant) throw new AppError('Grant not found', 404);

    const committed = await prisma.esopExerciseRequest.aggregate({
      where: { grantId, status: { in: ['PENDING', 'APPROVED', 'COMPLETED'] } },
      _sum: { sharesRequested: true },
    });

    const committedShares = committed._sum.sharesRequested ?? 0;
    const availableToExercise = grant.vestedShares - committedShares;

    return { totalVested: grant.vestedShares, committedShares, availableToExercise };
  }

  async createExerciseRequest(data: CreateExerciseRequestInput, performedBy?: string) {
    const grant = await prisma.esopGrant.findFirst({
      where: { id: data.grantId, organizationId: data.organizationId },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
      },
    });
    if (!grant) throw new AppError('ESOP Grant not found', 404);
    if (grant.status !== 'ACTIVE') throw new AppError('Grant is not active', 400);
    if (grant.employeeId !== data.employeeId) {
      throw new AppError('Employee does not own this grant', 403);
    }

    const { availableToExercise } = await this.getAvailableToExercise(
      data.grantId,
      data.organizationId,
    );

    if (data.sharesRequested > availableToExercise) {
      throw new AppError(`Only ${availableToExercise} shares available to exercise`, 400);
    }

    const totalValue = data.sharesRequested * data.exercisePrice;

    const request = await prisma.$transaction(async (tx) => {
      const req = await tx.esopExerciseRequest.create({
        data: {
          organizationId: data.organizationId,
          grantId: data.grantId,
          employeeId: data.employeeId,
          sharesRequested: data.sharesRequested,
          exercisePrice: new Prisma.Decimal(data.exercisePrice.toFixed(4)),
          totalExerciseValue: new Prisma.Decimal(totalValue.toFixed(2)),
          requestDate: new Date(),
          status: 'PENDING',
          remarks: data.remarks ?? null,
        },
      });

      await tx.esopLedger.create({
        data: {
          organizationId: data.organizationId,
          transactionType: 'EXERCISE_REQUESTED',
          grantId: data.grantId,
          exerciseRequestId: req.id,
          employeeId: data.employeeId,
          sharesCount: data.sharesRequested,
          sharePrice: new Prisma.Decimal(data.exercisePrice.toFixed(4)),
          transactionValue: new Prisma.Decimal(totalValue.toFixed(2)),
          description: `Exercise request submitted by ${grant.employee.firstName} ${grant.employee.lastName}: ${data.sharesRequested} shares`,
          performedBy: performedBy ?? null,
        },
      });

      return req;
    });

    return request;
  }

  async getAllExerciseRequests(query: QueryExerciseInput) {
    const { organizationId, grantId, employeeId, status, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.EsopExerciseRequestWhereInput = {
      organizationId,
      ...(grantId ? { grantId } : {}),
      ...(employeeId ? { employeeId } : {}),
      ...(status ? { status } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.esopExerciseRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
          grant: { select: { id: true, grantDate: true, totalShares: true, vestedShares: true, grantPrice: true } },
        },
      }),
      prisma.esopExerciseRequest.count({ where }),
    ]);

    return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getExerciseRequestById(id: string, organizationId: string) {
    const req = await prisma.esopExerciseRequest.findFirst({
      where: { id, organizationId },
      include: {
        employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
        grant: {
          include: {
            vestingPlan: { select: { planName: true } },
            pool: { select: { poolName: true } },
          },
        },
      },
    });
    if (!req) throw new AppError('Exercise request not found', 404);
    return req;
  }

  async approveExercise(id: string, organizationId: string, approvedBy: string) {
    const req = await this.getExerciseRequestById(id, organizationId);
    if (req.status !== 'PENDING') {
      throw new AppError('Only pending exercise requests can be approved', 400);
    }

    await prisma.$transaction(async (tx) => {
      await tx.esopExerciseRequest.update({
        where: { id },
        data: { status: 'APPROVED', approvedBy, approvedAt: new Date() },
      });

      await tx.esopLedger.create({
        data: {
          organizationId,
          transactionType: 'EXERCISE_APPROVED',
          grantId: req.grantId,
          exerciseRequestId: id,
          employeeId: req.employeeId,
          sharesCount: req.sharesRequested,
          description: `Exercise request approved for ${req.sharesRequested} shares`,
          performedBy: approvedBy,
        },
      });
    });

    return prisma.esopExerciseRequest.findUnique({ where: { id } });
  }

  async rejectExercise(id: string, organizationId: string, data: RejectExerciseInput, performedBy?: string) {
    const req = await this.getExerciseRequestById(id, organizationId);
    if (req.status !== 'PENDING') {
      throw new AppError('Only pending exercise requests can be rejected', 400);
    }

    await prisma.$transaction(async (tx) => {
      await tx.esopExerciseRequest.update({
        where: { id },
        data: { status: 'REJECTED', rejectionReason: data.rejectionReason },
      });

      await tx.esopLedger.create({
        data: {
          organizationId,
          transactionType: 'EXERCISE_REJECTED',
          grantId: req.grantId,
          exerciseRequestId: id,
          employeeId: req.employeeId,
          sharesCount: req.sharesRequested,
          description: `Exercise request rejected: ${data.rejectionReason}`,
          performedBy: performedBy ?? null,
          metadata: { rejectionReason: data.rejectionReason },
        },
      });
    });

    return prisma.esopExerciseRequest.findUnique({ where: { id } });
  }

  async completeExercise(id: string, organizationId: string, performedBy?: string) {
    const req = await this.getExerciseRequestById(id, organizationId);
    if (req.status !== 'APPROVED') {
      throw new AppError('Only approved exercise requests can be completed', 400);
    }

    await prisma.$transaction(async (tx) => {
      await tx.esopExerciseRequest.update({
        where: { id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });

      await tx.esopGrant.update({
        where: { id: req.grantId },
        data: { exercisedShares: { increment: req.sharesRequested } },
      });

      await tx.esopLedger.create({
        data: {
          organizationId,
          transactionType: 'EXERCISE_COMPLETED',
          grantId: req.grantId,
          exerciseRequestId: id,
          employeeId: req.employeeId,
          sharesCount: req.sharesRequested,
          sharePrice: req.exercisePrice,
          transactionValue: req.totalExerciseValue,
          description: `Exercise completed: ${req.sharesRequested} shares at ₹${req.exercisePrice}`,
          performedBy: performedBy ?? null,
        },
      });
    });

    return prisma.esopExerciseRequest.findUnique({ where: { id } });
  }

  // ─────────────────────────────────────────────
  // LEDGER
  // ─────────────────────────────────────────────

  async getLedger(query: QueryLedgerInput) {
    const { organizationId, employeeId, grantId, transactionType, fromDate, toDate, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.EsopLedgerWhereInput = {
      organizationId,
      ...(employeeId ? { employeeId } : {}),
      ...(grantId ? { grantId } : {}),
      ...(transactionType ? { transactionType } : {}),
      ...(fromDate || toDate
        ? {
            transactionDate: {
              ...(fromDate ? { gte: new Date(fromDate) } : {}),
              ...(toDate ? { lte: new Date(toDate + 'T23:59:59') } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.esopLedger.findMany({
        where,
        orderBy: { transactionDate: 'desc' },
        skip,
        take: limit,
        include: {
          grant: {
            include: {
              employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
            },
          },
        },
      }),
      prisma.esopLedger.count({ where }),
    ]);

    return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getAvailableToExercisePublic(grantId: string, organizationId: string) {
    return this.getAvailableToExercise(grantId, organizationId);
  }
}

export const esopService = new EsopService();
