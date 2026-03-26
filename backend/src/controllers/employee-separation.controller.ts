import { Request, Response, NextFunction } from 'express';
import { employeeSeparationService } from '../services/employee-separation.service';

export class EmployeeSeparationController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const body = req.body as any;
      if (req.rbac?.organizationId && !body.organizationId) {
        body.organizationId = req.rbac.organizationId;
      }
      const separation = await employeeSeparationService.create(body, req.user?.userId);
      return res.status(201).json({
        status: 'success',
        message: 'Employee separation recorded successfully',
        data: { separation },
      });
    } catch (error) {
      return next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await employeeSeparationService.getAll(req.query as any);
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
      const separation = await employeeSeparationService.getById(id);
      if (req.rbac?.organizationId && separation.organizationId !== req.rbac.organizationId) {
        return res.status(403).json({
          status: 'fail',
          message: 'Access denied. You can only access separations from your organization.',
        });
      }
      return res.status(200).json({
        status: 'success',
        data: { separation },
      });
    } catch (error) {
      return next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (req.rbac?.organizationId) {
        const existing = await employeeSeparationService.getById(id);
        if (existing.organizationId !== req.rbac.organizationId) {
          return res.status(403).json({
            status: 'fail',
            message: 'Access denied. You can only update separations from your organization.',
          });
        }
      }
      const separation = await employeeSeparationService.update(id, req.body);
      return res.status(200).json({
        status: 'success',
        message: 'Separation updated successfully',
        data: { separation },
      });
    } catch (error) {
      return next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (req.rbac?.organizationId) {
        const existing = await employeeSeparationService.getById(id);
        if (existing.organizationId !== req.rbac.organizationId) {
          return res.status(403).json({
            status: 'fail',
            message: 'Access denied. You can only delete separations from your organization.',
          });
        }
      }
      await employeeSeparationService.delete(id);
      return res.status(200).json({
        status: 'success',
        message: 'Separation record deleted',
      });
    } catch (error) {
      return next(error);
    }
  }
}

export const employeeSeparationController = new EmployeeSeparationController();
