import { Request, Response, NextFunction } from 'express';
import { subDepartmentService } from '../services/sub-department.service';
import { generateSubDepartmentExcel, processSubDepartmentUpload } from '../services/department-masters-bulk.service';

export class SubDepartmentController {
  async getByOrganization(req: Request, res: Response, next: NextFunction) {
    try {
      const { organizationId, departmentId } = req.query as { organizationId: string; departmentId?: string };
      if (!organizationId) {
        return res.status(400).json({ status: 'fail', message: 'organizationId required' });
      }
      const deptId = departmentId ? parseInt(departmentId, 10) : undefined;
      const list = await subDepartmentService.getByOrganization(
        organizationId,
        req.user?.userId,
        Number.isNaN(deptId) ? undefined : deptId
      );
      return res.status(200).json({ status: 'success', data: { subDepartments: list } });
    } catch (error) {
      return next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { organizationId, name, code, departmentId } = req.body as {
        organizationId: string;
        name: string;
        code?: string;
        departmentId?: number;
      };
      if (!organizationId || !name?.trim()) {
        return res.status(400).json({ status: 'fail', message: 'organizationId and name are required' });
      }
      const created = await subDepartmentService.create(
        organizationId,
        name.trim(),
        req.user?.userId,
        { code, departmentId }
      );
      return res.status(201).json({ status: 'success', data: { subDepartment: created } });
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        return res.status(409).json({ status: 'fail', message: error.message });
      }
      return next(error);
    }
  }
  /** Download sample Excel template. GET /api/v1/sub-departments/download-excel */
  async downloadExcel(req: Request, res: Response, next: NextFunction) {
    try {
      const { organizationId } = req.query as { organizationId: string };
      if (!organizationId) {
        return res.status(400).json({ status: 'fail', message: 'organizationId required' });
      }
      const configToken = req.headers['x-configurator-token'] as string | undefined;
      const buffer = await generateSubDepartmentExcel(organizationId, req.user!.userId, configToken);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=sub_departments_template_${new Date().toISOString().slice(0, 10)}.xlsx`);
      return res.send(buffer);
    } catch (error) {
      return next(error);
    }
  }

  /** Bulk upload sub-departments from Excel. POST /api/v1/sub-departments/upload-excel */
  async uploadExcel(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        return res.status(400).json({ status: 'fail', message: 'Excel file is required' });
      }
      const organizationId = req.body.organizationId;
      if (!organizationId) {
        return res.status(400).json({ status: 'fail', message: 'organizationId is required' });
      }
      const configToken = req.headers['x-configurator-token'] as string | undefined;
      const result = await processSubDepartmentUpload(req.file.buffer, organizationId, req.user!.userId, configToken);
      return res.status(200).json({
        status: 'success',
        message: `Import complete: ${result.created} created, ${result.skipped} skipped, ${result.failed} failed`,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }
}

export const subDepartmentController = new SubDepartmentController();
