import { Request, Response, NextFunction } from 'express';
import { transferPromotionService } from '../services/transfer-promotion.service';

export class TransferPromotionController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const record = await transferPromotionService.create(req.body);
      return res.status(201).json({
        status: 'success',
        message: 'Transfer and promotion record created successfully',
        data: { transferPromotion: record },
      });
    } catch (error) {
      return next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await transferPromotionService.getAll(req.query as any);
      return res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const record = await transferPromotionService.getById(id);
      if (!record) {
        return res.status(404).json({
          status: 'fail',
          message: 'Transfer and promotion record not found',
        });
      }
      if (req.rbac?.organizationId && record.organizationId !== req.rbac.organizationId) {
        return res.status(403).json({
          status: 'fail',
          message: 'Access denied.',
        });
      }
      return res.status(200).json({
        status: 'success',
        data: { transferPromotion: record },
      });
    } catch (error) {
      return next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const existing = await transferPromotionService.getById(id);
      if (!existing) {
        return res.status(404).json({
          status: 'fail',
          message: 'Transfer and promotion record not found',
        });
      }
      if (req.rbac?.organizationId && existing.organizationId !== req.rbac.organizationId) {
        return res.status(403).json({
          status: 'fail',
          message: 'Access denied.',
        });
      }
      const record = await transferPromotionService.update(id, req.body);
      return res.status(200).json({
        status: 'success',
        message: 'Transfer and promotion record updated successfully',
        data: { transferPromotion: record },
      });
    } catch (error) {
      return next(error);
    }
  }
}

export const transferPromotionController = new TransferPromotionController();
