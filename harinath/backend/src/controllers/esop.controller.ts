import { Request, Response, NextFunction } from 'express';
import { esopService } from '../services/esop.service';

export class EsopController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const record = await esopService.create(req.body);
      return res.status(201).json({
        status: 'success',
        message: 'ESOP record created successfully',
        data: { esop: record },
      });
    } catch (error) {
      return next(error);
    }
  }

  async createBulk(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await esopService.createBulk(req.body);
      return res.status(201).json({
        status: 'success',
        message: `${result.count} ESOP record(s) created successfully`,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await esopService.getAll(req.query as any);
      return res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  async getByEmployeeId(req: Request, res: Response, next: NextFunction) {
    try {
      const { employeeId } = req.params;
      const organizationId = req.rbac?.organizationId ?? undefined;
      const records = await esopService.getByEmployeeId(employeeId, organizationId);
      return res.status(200).json({
        status: 'success',
        data: { esopRecords: records },
      });
    } catch (error) {
      return next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const record = await esopService.getById(id);
      if (!record) {
        return res.status(404).json({
          status: 'fail',
          message: 'ESOP record not found',
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
        data: { esop: record },
      });
    } catch (error) {
      return next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const existing = await esopService.getById(id);
      if (!existing) {
        return res.status(404).json({
          status: 'fail',
          message: 'ESOP record not found',
        });
      }
      if (req.rbac?.organizationId && existing.organizationId !== req.rbac.organizationId) {
        return res.status(403).json({
          status: 'fail',
          message: 'Access denied.',
        });
      }
      const record = await esopService.update(id, req.body);
      return res.status(200).json({
        status: 'success',
        message: 'ESOP record updated successfully',
        data: { esop: record },
      });
    } catch (error) {
      return next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const existing = await esopService.getById(id);
      if (!existing) {
        return res.status(404).json({
          status: 'fail',
          message: 'ESOP record not found',
        });
      }
      if (req.rbac?.organizationId && existing.organizationId !== req.rbac.organizationId) {
        return res.status(403).json({
          status: 'fail',
          message: 'Access denied.',
        });
      }
      await esopService.delete(id);
      return res.status(200).json({
        status: 'success',
        message: 'ESOP record deleted successfully',
      });
    } catch (error) {
      return next(error);
    }
  }
}

export const esopController = new EsopController();
