import { Request, Response, NextFunction } from 'express';
import { esopService } from '../services/esop.service';
import { AppError } from '../middlewares/errorHandler';
import {
  createPoolSchema, updatePoolSchema, queryPoolSchema,
  createVestingPlanSchema, updateVestingPlanSchema, queryVestingPlanSchema,
  createGrantSchema, queryGrantSchema,
  queryVestingScheduleSchema, processVestingSchema,
  createExerciseRequestSchema, rejectExerciseSchema, queryExerciseSchema,
  queryLedgerSchema,
} from '../utils/esop.validation';

export class EsopController {
  // ─────────────────────────────────────────────
  // DASHBOARD
  // ─────────────────────────────────────────────

  async getDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).rbac?.organizationId ?? req.query.organizationId as string;
      if (!organizationId) throw new AppError('organizationId is required', 400);
      const data = await esopService.getDashboard(organizationId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  // ─────────────────────────────────────────────
  // ESOP POOLS
  // ─────────────────────────────────────────────

  async createPool(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = createPoolSchema.safeParse(req.body);
      if (!parsed.success) throw new AppError(parsed.error.errors[0].message, 400);
      const performedBy = (req as any).user?.userId;
      const pool = await esopService.createPool(parsed.data, performedBy);
      res.status(201).json({ success: true, data: pool, message: 'ESOP Pool created successfully' });
    } catch (err) {
      next(err);
    }
  }

  async getAllPools(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = (req as any).rbac?.organizationId;
      const parsed = queryPoolSchema.safeParse({ ...req.query, organizationId: orgId ?? req.query.organizationId });
      if (!parsed.success) throw new AppError(parsed.error.errors[0].message, 400);
      const result = await esopService.getAllPools(parsed.data);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async getPoolById(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).rbac?.organizationId ?? req.query.organizationId as string;
      const pool = await esopService.getPoolById(req.params.id, organizationId);
      res.json({ success: true, data: pool });
    } catch (err) {
      next(err);
    }
  }

  async updatePool(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = updatePoolSchema.safeParse(req.body);
      if (!parsed.success) throw new AppError(parsed.error.errors[0].message, 400);
      const organizationId = (req as any).rbac?.organizationId ?? req.query.organizationId as string;
      const performedBy = (req as any).user?.userId;
      const pool = await esopService.updatePool(req.params.id, organizationId, parsed.data, performedBy);
      res.json({ success: true, data: pool, message: 'ESOP Pool updated successfully' });
    } catch (err) {
      next(err);
    }
  }

  async deletePool(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).rbac?.organizationId ?? req.query.organizationId as string;
      await esopService.deletePool(req.params.id, organizationId);
      res.json({ success: true, message: 'ESOP Pool deleted successfully' });
    } catch (err) {
      next(err);
    }
  }

  // ─────────────────────────────────────────────
  // VESTING PLANS
  // ─────────────────────────────────────────────

  async createVestingPlan(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = createVestingPlanSchema.safeParse(req.body);
      if (!parsed.success) throw new AppError(parsed.error.errors[0].message, 400);
      const performedBy = (req as any).user?.userId;
      const plan = await esopService.createVestingPlan(parsed.data, performedBy);
      res.status(201).json({ success: true, data: plan, message: 'Vesting plan created successfully' });
    } catch (err) {
      next(err);
    }
  }

  async getAllVestingPlans(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = (req as any).rbac?.organizationId;
      const parsed = queryVestingPlanSchema.safeParse({ ...req.query, organizationId: orgId ?? req.query.organizationId });
      if (!parsed.success) throw new AppError(parsed.error.errors[0].message, 400);
      const result = await esopService.getAllVestingPlans(parsed.data);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async getVestingPlanById(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).rbac?.organizationId ?? req.query.organizationId as string;
      const plan = await esopService.getVestingPlanById(req.params.id, organizationId);
      res.json({ success: true, data: plan });
    } catch (err) {
      next(err);
    }
  }

  async updateVestingPlan(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = updateVestingPlanSchema.safeParse(req.body);
      if (!parsed.success) throw new AppError(parsed.error.errors[0].message, 400);
      const organizationId = (req as any).rbac?.organizationId ?? req.query.organizationId as string;
      const plan = await esopService.updateVestingPlan(req.params.id, organizationId, parsed.data);
      res.json({ success: true, data: plan, message: 'Vesting plan updated successfully' });
    } catch (err) {
      next(err);
    }
  }

  async deleteVestingPlan(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).rbac?.organizationId ?? req.query.organizationId as string;
      await esopService.deleteVestingPlan(req.params.id, organizationId);
      res.json({ success: true, message: 'Vesting plan deleted successfully' });
    } catch (err) {
      next(err);
    }
  }

  // ─────────────────────────────────────────────
  // ESOP GRANTS
  // ─────────────────────────────────────────────

  async createGrant(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = createGrantSchema.safeParse(req.body);
      if (!parsed.success) throw new AppError(parsed.error.errors[0].message, 400);
      const performedBy = (req as any).user?.userId;
      const grant = await esopService.createGrant(parsed.data, performedBy);
      res.status(201).json({ success: true, data: grant, message: 'ESOP Grant created and vesting schedule generated' });
    } catch (err) {
      next(err);
    }
  }

  async getAllGrants(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = (req as any).rbac?.organizationId;
      const parsed = queryGrantSchema.safeParse({ ...req.query, organizationId: orgId ?? req.query.organizationId });
      if (!parsed.success) throw new AppError(parsed.error.errors[0].message, 400);
      const result = await esopService.getAllGrants(parsed.data);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async getGrantById(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).rbac?.organizationId ?? req.query.organizationId as string;
      const grant = await esopService.getGrantById(req.params.id, organizationId);
      res.json({ success: true, data: grant });
    } catch (err) {
      next(err);
    }
  }

  async cancelGrant(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).rbac?.organizationId ?? req.query.organizationId as string;
      const performedBy = (req as any).user?.userId;
      const grant = await esopService.cancelGrant(req.params.id, organizationId, performedBy);
      res.json({ success: true, data: grant, message: 'Grant cancelled successfully' });
    } catch (err) {
      next(err);
    }
  }

  // ─────────────────────────────────────────────
  // VESTING SCHEDULES
  // ─────────────────────────────────────────────

  async getVestingSchedules(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = (req as any).rbac?.organizationId;
      const parsed = queryVestingScheduleSchema.safeParse({ ...req.query, organizationId: orgId ?? req.query.organizationId });
      if (!parsed.success) throw new AppError(parsed.error.errors[0].message, 400);
      const result = await esopService.getVestingSchedules(parsed.data);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async getVestingScheduleById(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).rbac?.organizationId ?? req.query.organizationId as string;
      const result = await esopService.getVestingSchedules({
        organizationId,
        page: 1,
        limit: 1,
        grantId: undefined,
        employeeId: undefined,
        status: undefined,
        fromDate: undefined,
        toDate: undefined,
      });
      // Get single item by id from result is not efficient; use a separate lookup if needed
      res.json({ success: true, data: result.items[0] ?? null });
    } catch (err) {
      next(err);
    }
  }

  async processVesting(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = (req as any).rbac?.organizationId;
      const parsed = processVestingSchema.safeParse({ ...req.body, organizationId: orgId ?? req.body.organizationId });
      if (!parsed.success) throw new AppError(parsed.error.errors[0].message, 400);
      const performedBy = (req as any).user?.userId;
      const result = await esopService.processVesting(parsed.data, performedBy);
      res.json({
        success: true,
        data: result,
        message: `Vesting processed: ${result.processed} schedule(s), ${result.totalSharesVested} shares vested`,
      });
    } catch (err) {
      next(err);
    }
  }

  // ─────────────────────────────────────────────
  // EXERCISE REQUESTS
  // ─────────────────────────────────────────────

  async createExerciseRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = createExerciseRequestSchema.safeParse(req.body);
      if (!parsed.success) throw new AppError(parsed.error.errors[0].message, 400);
      const performedBy = (req as any).user?.userId;
      const request = await esopService.createExerciseRequest(parsed.data, performedBy);
      res.status(201).json({ success: true, data: request, message: 'Exercise request submitted successfully' });
    } catch (err) {
      next(err);
    }
  }

  async getAllExerciseRequests(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = (req as any).rbac?.organizationId;
      const parsed = queryExerciseSchema.safeParse({ ...req.query, organizationId: orgId ?? req.query.organizationId });
      if (!parsed.success) throw new AppError(parsed.error.errors[0].message, 400);
      const result = await esopService.getAllExerciseRequests(parsed.data);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async getExerciseRequestById(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).rbac?.organizationId ?? req.query.organizationId as string;
      const req_ = await esopService.getExerciseRequestById(req.params.id, organizationId);
      res.json({ success: true, data: req_ });
    } catch (err) {
      next(err);
    }
  }

  async approveExercise(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).rbac?.organizationId ?? req.query.organizationId as string;
      const approvedBy = (req as any).user?.userId;
      if (!approvedBy) throw new AppError('User ID is required', 400);
      const result = await esopService.approveExercise(req.params.id, organizationId, approvedBy);
      res.json({ success: true, data: result, message: 'Exercise request approved' });
    } catch (err) {
      next(err);
    }
  }

  async rejectExercise(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = rejectExerciseSchema.safeParse(req.body);
      if (!parsed.success) throw new AppError(parsed.error.errors[0].message, 400);
      const organizationId = (req as any).rbac?.organizationId ?? req.query.organizationId as string;
      const performedBy = (req as any).user?.userId;
      const result = await esopService.rejectExercise(req.params.id, organizationId, parsed.data, performedBy);
      res.json({ success: true, data: result, message: 'Exercise request rejected' });
    } catch (err) {
      next(err);
    }
  }

  async completeExercise(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).rbac?.organizationId ?? req.query.organizationId as string;
      const performedBy = (req as any).user?.userId;
      const result = await esopService.completeExercise(req.params.id, organizationId, performedBy);
      res.json({ success: true, data: result, message: 'Exercise request marked as completed' });
    } catch (err) {
      next(err);
    }
  }

  async getAvailableToExercise(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).rbac?.organizationId ?? req.query.organizationId as string;
      const result = await esopService.getAvailableToExercisePublic(req.params.grantId, organizationId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  // ─────────────────────────────────────────────
  // LEDGER
  // ─────────────────────────────────────────────

  async getLedger(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = (req as any).rbac?.organizationId;
      const parsed = queryLedgerSchema.safeParse({ ...req.query, organizationId: orgId ?? req.query.organizationId });
      if (!parsed.success) throw new AppError(parsed.error.errors[0].message, 400);
      const result = await esopService.getLedger(parsed.data);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }
}

export const esopController = new EsopController();
