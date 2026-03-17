import { Request, Response, NextFunction } from 'express';
import { payrollService } from '../services/payroll.service';
import {
  createPayrollCycleSchema,
  updatePayrollCycleSchema,
  queryPayrollCyclesSchema,
  processPayrollCycleSchema,
} from '../utils/payroll.validation';

export class PayrollController {
  /**
   * Create new payroll cycle
   */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createPayrollCycleSchema.parse(req.body);
      const payrollCycle = await payrollService.create(data);
      res.status(201).json({
        success: true,
        data: payrollCycle,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all payroll cycles
   */
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const query = queryPayrollCyclesSchema.parse(req.query);
      const result = await payrollService.getAll(query);
      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get payroll cycle by ID
   */
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const payrollCycle = await payrollService.getById(id);
      res.json({
        success: true,
        data: payrollCycle,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update payroll cycle
   */
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = updatePayrollCycleSchema.parse(req.body);
      const payrollCycle = await payrollService.update(id, data);
      res.json({
        success: true,
        data: payrollCycle,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Process payroll cycle
   */
  async processPayrollCycle(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = processPayrollCycleSchema.parse(req.body);
      const userId = (req as any).user?.userId || (req as any).user?.id;
      const result = await payrollService.processPayrollCycle(id, data, userId);
      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Finalize payroll cycle (lock it)
   */
  async finalizePayrollCycle(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.userId || (req as any).user?.id;
      const payrollCycle = await payrollService.finalizePayrollCycle(id, userId);
      res.json({
        success: true,
        data: payrollCycle,
        message: 'Payroll cycle finalized and locked successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Rollback payroll cycle (unlock it)
   */
  async rollbackPayrollCycle(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.userId || (req as any).user?.id;
      const payrollCycle = await payrollService.rollbackPayrollCycle(id, userId);
      res.json({
        success: true,
        data: payrollCycle,
        message: 'Payroll cycle rolled back successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark payroll cycle as paid
   */
  async markAsPaid(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.userId || (req as any).user?.id;
      const payrollCycle = await payrollService.markAsPaid(id, userId);
      res.json({
        success: true,
        data: payrollCycle,
        message: 'Payroll cycle marked as paid successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete payroll cycle
   */
  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await payrollService.delete(id);
      res.json({
        success: true,
        message: 'Payroll cycle deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Pre-run checks before processing a payroll cycle
   */
  async preRunCheck(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await payrollService.preRunCheck(id);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }
}

export const payrollController = new PayrollController();
