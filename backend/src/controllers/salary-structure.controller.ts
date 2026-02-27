import { Request, Response, NextFunction } from 'express';
import { salaryStructureService } from '../services/salary-structure.service';
import {
  createSalaryStructureSchema,
  updateSalaryStructureSchema,
  querySalaryStructuresSchema,
} from '../utils/payroll.validation';
import { getPredefinedEarnings, getPredefinedDeductions } from '../utils/salary-components';

export class SalaryStructureController {
  /**
   * Create new salary structure
   */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createSalaryStructureSchema.parse(req.body);
      const salaryStructure = await salaryStructureService.create(data);
      res.status(201).json({
        success: true,
        data: salaryStructure,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all salary structures
   */
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const query = querySalaryStructuresSchema.parse(req.query);
      const result = await salaryStructureService.getAll(query);
      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get salary structure by ID
   */
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const salaryStructure = await salaryStructureService.getById(id);
      res.json({
        success: true,
        data: salaryStructure,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update salary structure
   */
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = updateSalaryStructureSchema.parse(req.body);
      const salaryStructure = await salaryStructureService.update(id, data);
      res.json({
        success: true,
        data: salaryStructure,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete salary structure
   */
  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await salaryStructureService.delete(id);
      res.json({
        success: true,
        message: 'Salary structure deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get predefined salary components (earnings and deductions)
   * GET /api/v1/payroll/salary-components
   */
  async getPredefinedComponents(_req: Request, res: Response, next: NextFunction) {
    try {
      const earnings = getPredefinedEarnings();
      const deductions = getPredefinedDeductions();

      res.json({
        success: true,
        data: {
          earnings: Object.values(earnings),
          deductions: Object.values(deductions),
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const salaryStructureController = new SalaryStructureController();
