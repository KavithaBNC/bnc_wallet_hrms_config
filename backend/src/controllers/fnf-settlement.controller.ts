import { Request, Response, NextFunction } from 'express';
import { fnfSettlementService } from '../services/fnf-settlement.service';

export class FnfSettlementController {
  async calculate(req: Request, res: Response, next: NextFunction) {
    try {
      const { separationId } = req.body;
      const organizationId = req.rbac?.organizationId || req.body.organizationId;
      const calculatedBy = (req as any).user?.id;

      const result = await fnfSettlementService.calculateSettlement(
        separationId,
        organizationId,
        calculatedBy
      );

      return res.status(200).json({
        status: 'success',
        message: 'F&F settlement calculated successfully',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const query = {
        ...req.query,
        organizationId: req.rbac?.organizationId || (req.query.organizationId as string),
      } as any;

      const result = await fnfSettlementService.getAll(query);
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
      const organizationId = req.rbac?.organizationId || '';

      const settlement = await fnfSettlementService.getById(id, organizationId);
      return res.status(200).json({
        status: 'success',
        data: { settlement },
      });
    } catch (error) {
      return next(error);
    }
  }

  async approve(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const organizationId = req.rbac?.organizationId || '';
      const approvedBy = (req as any).user?.id;

      const settlement = await fnfSettlementService.approve(id, organizationId, approvedBy);
      return res.status(200).json({
        status: 'success',
        message: 'Settlement approved successfully',
        data: { settlement },
      });
    } catch (error) {
      return next(error);
    }
  }

  async markAsPaid(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const organizationId = req.rbac?.organizationId || '';

      const settlement = await fnfSettlementService.markAsPaid(id, organizationId);
      return res.status(200).json({
        status: 'success',
        message: 'Settlement marked as paid',
        data: { settlement },
      });
    } catch (error) {
      return next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const organizationId = req.rbac?.organizationId || '';

      const settlement = await fnfSettlementService.update(id, organizationId, req.body);
      return res.status(200).json({
        status: 'success',
        message: 'Settlement updated successfully',
        data: { settlement },
      });
    } catch (error) {
      return next(error);
    }
  }

  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = req.rbac?.organizationId || '';
      const stats = await fnfSettlementService.getStats(organizationId);
      return res.status(200).json({ status: 'success', data: stats });
    } catch (error) {
      return next(error);
    }
  }

  async getEligibleSeparations(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = req.rbac?.organizationId || '';
      const separations = await fnfSettlementService.getEligibleSeparations(organizationId);
      return res.status(200).json({ status: 'success', data: separations });
    } catch (error) {
      return next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const organizationId = req.rbac?.organizationId || '';

      await fnfSettlementService.delete(id, organizationId);
      return res.status(200).json({
        status: 'success',
        message: 'Settlement deleted',
      });
    } catch (error) {
      return next(error);
    }
  }
}

export const fnfSettlementController = new FnfSettlementController();
