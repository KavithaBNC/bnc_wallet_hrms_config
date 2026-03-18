import { Request, Response, NextFunction } from 'express';
import { candidateService } from '../services/candidate.service';
import {
  createCandidateSchema,
  updateCandidateSchema,
  queryCandidatesSchema,
} from '../utils/ats.validation';

export class CandidateController {
  /**
   * Create new candidate
   */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createCandidateSchema.parse(req.body);

      const candidate = await candidateService.create(data);

      res.status(201).json({
        status: 'success',
        data: candidate,
      });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Get all candidates
   */
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const query = queryCandidatesSchema.parse(req.query);

      const result = await candidateService.getAll(query);

      res.status(200).json({
        status: 'success',
        ...result,
      });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Get candidate by ID
   */
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const candidate = await candidateService.getById(id);

      res.status(200).json({
        status: 'success',
        data: candidate,
      });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Get candidate by email
   */
  async getByEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.params;

      const candidate = await candidateService.getByEmail(email);

      if (!candidate) {
        res.status(404).json({
          status: 'error',
          message: 'Candidate not found',
        });
        return;
      }

      res.status(200).json({
        status: 'success',
        data: candidate,
      });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Update candidate
   */
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = updateCandidateSchema.parse(req.body);

      const candidate = await candidateService.update(id, data);

      res.status(200).json({
        status: 'success',
        data: candidate,
      });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Delete candidate
   */
  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const result = await candidateService.delete(id);

      res.status(200).json({
        status: 'success',
        message: result.message,
      });
    } catch (error: any) {
      next(error);
    }
  }
}

export const candidateController = new CandidateController();
