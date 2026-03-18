import { Request, Response, NextFunction } from 'express';
import { transferPromotionEntryService } from '../services/transfer-promotion-entry.service';

export class TransferPromotionEntryController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const record = await transferPromotionEntryService.create(req.body);
      return res.status(201).json({
        status: 'success',
        message: 'Transfer and promotion entry created successfully',
        data: { transferPromotionEntry: record },
      });
    } catch (error) {
      return next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await transferPromotionEntryService.getAll(req.query as any);
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
      const record = await transferPromotionEntryService.getById(id);
      if (!record) {
        return res.status(404).json({
          status: 'fail',
          message: 'Transfer and promotion entry not found',
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
        data: { transferPromotionEntry: record },
      });
    } catch (error) {
      return next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const existing = await transferPromotionEntryService.getById(id);
      if (!existing) {
        return res.status(404).json({
          status: 'fail',
          message: 'Transfer and promotion entry not found',
        });
      }
      if (req.rbac?.organizationId && existing.organizationId !== req.rbac.organizationId) {
        return res.status(403).json({
          status: 'fail',
          message: 'Access denied.',
        });
      }
      const record = await transferPromotionEntryService.update(id, req.body);
      return res.status(200).json({
        status: 'success',
        message: 'Transfer and promotion entry updated successfully',
        data: { transferPromotionEntry: record },
      });
    } catch (error) {
      return next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const existing = await transferPromotionEntryService.getById(id);
      if (!existing) {
        return res.status(404).json({
          status: 'fail',
          message: 'Transfer and promotion entry not found',
        });
      }
      if (req.rbac?.organizationId && existing.organizationId !== req.rbac.organizationId) {
        return res.status(403).json({
          status: 'fail',
          message: 'Access denied.',
        });
      }
      await transferPromotionEntryService.delete(id);
      return res.status(200).json({
        status: 'success',
        message: 'Transfer and promotion entry deleted successfully',
      });
    } catch (error) {
      return next(error);
    }
  }
}

export const transferPromotionEntryController = new TransferPromotionEntryController();
