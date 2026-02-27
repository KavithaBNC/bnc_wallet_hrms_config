import { Request, Response, NextFunction } from 'express';
import { offerService } from '../services/offer.service';
import {
  createOfferSchema,
  updateOfferSchema,
  acceptOfferSchema,
  rejectOfferSchema,
  queryOffersSchema,
} from '../utils/ats.validation';

export class OfferController {
  /**
   * Create new offer
   */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId || (req as any).user?.id;
      const data = createOfferSchema.parse(req.body);

      const offer = await offerService.create(data, userId);

      res.status(201).json({
        status: 'success',
        data: offer,
      });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Get all offers
   */
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user?.employee?.organizationId;
      const query = queryOffersSchema.parse(req.query);

      const result = await offerService.getAll(query, organizationId);

      res.status(200).json({
        status: 'success',
        ...result,
      });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Get offer by ID
   */
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const offer = await offerService.getById(id);

      res.status(200).json({
        status: 'success',
        data: offer,
      });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Update offer
   */
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = updateOfferSchema.parse(req.body);

      const offer = await offerService.update(id, data);

      res.status(200).json({
        status: 'success',
        data: offer,
      });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Send offer
   */
  async send(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const offer = await offerService.send(id);

      res.status(200).json({
        status: 'success',
        data: offer,
      });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Accept offer
   */
  async accept(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = acceptOfferSchema.parse(req.body);

      const offer = await offerService.accept(id, data);

      res.status(200).json({
        status: 'success',
        data: offer,
      });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Reject offer
   */
  async reject(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = rejectOfferSchema.parse(req.body);

      const offer = await offerService.reject(id, data);

      res.status(200).json({
        status: 'success',
        data: offer,
      });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Delete offer
   */
  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const result = await offerService.delete(id);

      res.status(200).json({
        status: 'success',
        message: result.message,
      });
    } catch (error: any) {
      next(error);
    }
  }
}

export const offerController = new OfferController();
