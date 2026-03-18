import { Request, Response, NextFunction } from 'express';
import { paygroupService } from '../services/paygroup.service';

export class PaygroupController {
  /**
   * Get all paygroups for an organization
   * GET /api/v1/paygroups?organizationId=...
   */
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await paygroupService.getAll(req.query as any);
      return res.status(200).json({
        status: 'success',
        data: { paygroups: result },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Create new paygroup
   * POST /api/v1/paygroups
   */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const paygroup = await paygroupService.create(req.body);
      return res.status(201).json({
        status: 'success',
        message: 'Paygroup created successfully',
        data: { paygroup },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get paygroup by ID
   * GET /api/v1/paygroups/:id
   */
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const paygroup = await paygroupService.getById(id);
      if (!paygroup) {
        return res.status(404).json({
          status: 'fail',
          message: 'Paygroup not found',
        });
      }
      if (req.rbac?.organizationId && (paygroup as any).organizationId !== req.rbac.organizationId) {
        return res.status(403).json({
          status: 'fail',
          message: 'Access denied.',
        });
      }
      return res.status(200).json({
        status: 'success',
        data: { paygroup },
      });
    } catch (error) {
      return next(error);
    }
  }
}

export const paygroupController = new PaygroupController();
