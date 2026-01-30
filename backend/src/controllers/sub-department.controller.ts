import { Request, Response, NextFunction } from 'express';
import { subDepartmentService } from '../services/sub-department.service';

export class SubDepartmentController {
  async getByOrganization(req: Request, res: Response, next: NextFunction) {
    try {
      const { organizationId } = req.query as { organizationId: string };
      if (!organizationId) {
        return res.status(400).json({ status: 'fail', message: 'organizationId required' });
      }
      const list = await subDepartmentService.getByOrganization(organizationId);
      return res.status(200).json({ status: 'success', data: { subDepartments: list } });
    } catch (error) {
      return next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { organizationId, name } = req.body as { organizationId: string; name: string };
      if (!organizationId || !name?.trim()) {
        return res.status(400).json({ status: 'fail', message: 'organizationId and name are required' });
      }
      const created = await subDepartmentService.create(organizationId, name.trim());
      return res.status(201).json({ status: 'success', data: { subDepartment: created } });
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        return res.status(409).json({ status: 'fail', message: error.message });
      }
      return next(error);
    }
  }
}

export const subDepartmentController = new SubDepartmentController();
