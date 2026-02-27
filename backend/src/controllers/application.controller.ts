import { Request, Response, NextFunction } from 'express';
import { applicationService } from '../services/application.service';
import {
  createApplicationSchema,
  updateApplicationSchema,
  queryApplicationsSchema,
} from '../utils/ats.validation';

export class ApplicationController {
  /**
   * Create new application
   */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createApplicationSchema.parse(req.body);

      const application = await applicationService.create(data);

      res.status(201).json({
        status: 'success',
        data: application,
      });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Get all applications
   */
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user?.employee?.organizationId;
      const query = queryApplicationsSchema.parse(req.query);

      const result = await applicationService.getAll(query, organizationId);

      res.status(200).json({
        status: 'success',
        ...result,
      });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Get application by ID
   */
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const application = await applicationService.getById(id);

      res.status(200).json({
        status: 'success',
        data: application,
      });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Update application
   */
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = updateApplicationSchema.parse(req.body);

      const application = await applicationService.update(id, data);

      res.status(200).json({
        status: 'success',
        data: application,
      });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Delete application
   */
  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const result = await applicationService.delete(id);

      res.status(200).json({
        status: 'success',
        message: result.message,
      });
    } catch (error: any) {
      next(error);
    }
  }
}

export const applicationController = new ApplicationController();
