import { Request, Response, NextFunction } from 'express';
import { salaryTemplateService } from '../services/salary-template.service';
import {
  createSalaryTemplateSchema,
  updateSalaryTemplateSchema,
  querySalaryTemplatesSchema,
} from '../utils/payroll.validation';

export class SalaryTemplateController {
  /**
   * Create new salary template
   */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createSalaryTemplateSchema.parse(req.body);
      const salaryTemplate = await salaryTemplateService.create(data);
      res.status(201).json({
        success: true,
        data: salaryTemplate,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all salary templates
   */
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const query = querySalaryTemplatesSchema.parse(req.query);
      const result = await salaryTemplateService.getAll(query);
      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get salary template by ID
   */
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const salaryTemplate = await salaryTemplateService.getById(id);
      res.json({
        success: true,
        data: salaryTemplate,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get salary templates by grade and level
   */
  async getByGradeAndLevel(req: Request, res: Response, next: NextFunction) {
    try {
      const { organizationId } = req.query;
      const { grade, level } = req.query;

      if (!organizationId || typeof organizationId !== 'string') {
        res.status(400).json({
          success: false,
          message: 'Organization ID is required',
        });
        return;
      }

      const templates = await salaryTemplateService.getByGradeAndLevel(
        organizationId,
        grade as string | undefined,
        level as string | undefined
      );

      res.json({
        success: true,
        data: templates,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update salary template
   */
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = updateSalaryTemplateSchema.parse(req.body);
      const salaryTemplate = await salaryTemplateService.update(id, data);
      res.json({
        success: true,
        data: salaryTemplate,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete salary template
   */
  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await salaryTemplateService.delete(id);
      res.json({
        success: true,
        message: 'Salary template deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const salaryTemplateController = new SalaryTemplateController();
