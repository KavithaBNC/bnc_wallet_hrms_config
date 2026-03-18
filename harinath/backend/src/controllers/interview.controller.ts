import { Request, Response, NextFunction } from 'express';
import { interviewService } from '../services/interview.service';
import {
  createInterviewSchema,
  updateInterviewSchema,
  submitInterviewFeedbackSchema,
  queryInterviewsSchema,
} from '../utils/ats.validation';

export class InterviewController {
  /**
   * Create new interview
   */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId || (req as any).user?.id;
      const data = createInterviewSchema.parse(req.body);

      const interview = await interviewService.create(data, userId);

      res.status(201).json({
        status: 'success',
        data: interview,
      });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Get all interviews
   */
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user?.employee?.organizationId;
      const query = queryInterviewsSchema.parse(req.query);

      const result = await interviewService.getAll(query, organizationId);

      res.status(200).json({
        status: 'success',
        ...result,
      });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Get interview by ID
   */
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const interview = await interviewService.getById(id);

      res.status(200).json({
        status: 'success',
        data: interview,
      });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Update interview
   */
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = updateInterviewSchema.parse(req.body);

      const interview = await interviewService.update(id, data);

      res.status(200).json({
        status: 'success',
        data: interview,
      });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Submit interview feedback
   */
  async submitFeedback(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = submitInterviewFeedbackSchema.parse(req.body);

      const interview = await interviewService.submitFeedback(id, data);

      res.status(200).json({
        status: 'success',
        data: interview,
      });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Delete interview
   */
  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const result = await interviewService.delete(id);

      res.status(200).json({
        status: 'success',
        message: result.message,
      });
    } catch (error: any) {
      next(error);
    }
  }
}

export const interviewController = new InterviewController();
