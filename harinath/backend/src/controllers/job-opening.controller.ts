import { Request, Response, NextFunction } from 'express';
import { jobOpeningService } from '../services/job-opening.service';
import {
  createJobOpeningSchema,
  updateJobOpeningSchema,
  queryJobOpeningsSchema,
} from '../utils/ats.validation';

export class JobOpeningController {
  /**
   * Create new job opening
   */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId || (req as any).user?.id;
      const data = createJobOpeningSchema.parse(req.body);

      const jobOpening = await jobOpeningService.create(data, userId);

      res.status(201).json({
        status: 'success',
        data: jobOpening,
      });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Get all job openings
   */
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user?.employee?.organizationId;
      const query = queryJobOpeningsSchema.parse(req.query);

      const result = await jobOpeningService.getAll(query, organizationId);

      res.status(200).json({
        status: 'success',
        ...result,
      });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Get job opening by ID
   */
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const jobOpening = await jobOpeningService.getById(id);

      res.status(200).json({
        status: 'success',
        data: jobOpening,
      });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Update job opening
   */
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = updateJobOpeningSchema.parse(req.body);

      const jobOpening = await jobOpeningService.update(id, data);

      res.status(200).json({
        status: 'success',
        data: jobOpening,
      });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Delete job opening
   */
  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const result = await jobOpeningService.delete(id);

      res.status(200).json({
        status: 'success',
        message: result.message,
      });
    } catch (error: any) {
      next(error);
    }
  }
}

export const jobOpeningController = new JobOpeningController();
