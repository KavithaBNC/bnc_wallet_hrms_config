import { Request, Response, NextFunction } from 'express';
import { departmentService } from '../services/department.service';
import { configuratorService } from '../services/configurator.service';
import { prisma } from '../utils/prisma';
import { generateDepartmentExcel, processDepartmentUpload } from '../services/department-masters-bulk.service';

export class DepartmentController {
  /**
   * List departments from Configurator (for cascading dropdown flow).
   * GET /api/v1/departments/list?organizationId=X&costCentreId=Y
   */
  async getConfiguratorList(req: Request, res: Response, next: NextFunction) {
    try {
      const { organizationId, costCentreId } = req.query as { organizationId?: string; costCentreId?: string };
      if (!organizationId) {
        return res.status(400).json({ status: 'fail', message: 'organizationId required' });
      }
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { configuratorCompanyId: true },
      });
      if (!org?.configuratorCompanyId || !req.user?.userId) {
        return res.status(200).json({ status: 'success', data: { departments: [] } });
      }
      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: { configuratorAccessToken: true },
      });
      if (!user?.configuratorAccessToken) {
        return res.status(200).json({ status: 'success', data: { departments: [] } });
      }
      const ccId = costCentreId ? parseInt(costCentreId, 10) : undefined;
      const configList = await configuratorService.getDepartments(user.configuratorAccessToken, {
        companyId: org.configuratorCompanyId,
        costCentreId: Number.isNaN(ccId) ? undefined : ccId,
      });
      const departments = configList.map((d: any) => ({
        id: String(typeof d === 'object' ? d.id : d),
        name: typeof d === 'object' ? (d.name ?? d.Name ?? '') : String(d),
        cost_centre_id: typeof d === 'object' ? (d.cost_centre_id ?? d.costCentreId ?? null) : null,
      })).sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
      return res.status(200).json({ status: 'success', data: { departments } });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Create new department (stores in Config DB when org has configuratorCompanyId)
   * POST /api/v1/departments
   */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      let configSync: { accessToken: string; companyId: number } | undefined;
      const orgId = req.body?.organizationId;
      if (orgId && req.user?.userId) {
        const [org, user] = await Promise.all([
          prisma.organization.findUnique({
            where: { id: orgId },
            select: { configuratorCompanyId: true },
          }),
          prisma.user.findUnique({
            where: { id: req.user.userId },
            select: { configuratorAccessToken: true },
          }),
        ]);
        if (org?.configuratorCompanyId != null && user?.configuratorAccessToken) {
          configSync = { accessToken: user.configuratorAccessToken, companyId: org.configuratorCompanyId };
        }
      }
      const department = await departmentService.create(req.body, configSync);

      res.status(201).json({
        status: 'success',
        message: 'Department created successfully',
        data: { department },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all departments with filtering
   * GET /api/v1/departments
   */
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await departmentService.getAll(req.query as any, req.user?.userId);

      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get department by ID
   * GET /api/v1/departments/:id
   */
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const department = await departmentService.getById(id);

      // Verify organization access for non-SUPER_ADMIN users
      if (req.rbac?.organizationId && department.organizationId !== req.rbac.organizationId) {
        return res.status(403).json({
          status: 'fail',
          message: 'Access denied. You can only access departments from your organization.',
        });
      }

      res.status(200).json({
        status: 'success',
        data: { department },
      });
      return;
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Update department
   * PUT /api/v1/departments/:id
   */
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      // Verify organization access before updating
      if (req.rbac?.organizationId) {
        const existing = await departmentService.getById(id);
        if (existing.organizationId !== req.rbac.organizationId) {
          return res.status(403).json({
            status: 'fail',
            message: 'Access denied. You can only update departments from your organization.',
          });
        }
      }

      const department = await departmentService.update(id, req.body);

      res.status(200).json({
        status: 'success',
        message: 'Department updated successfully',
        data: { department },
      });
      return;
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Delete department
   * DELETE /api/v1/departments/:id
   */
  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      // Verify organization access before deleting
      if (req.rbac?.organizationId) {
        const existing = await departmentService.getById(id);
        if (existing.organizationId !== req.rbac.organizationId) {
          return res.status(403).json({
            status: 'fail',
            message: 'Access denied. You can only delete departments from your organization.',
          });
        }
      }

      const result = await departmentService.delete(id);

      res.status(200).json({
        status: 'success',
        message: result.message,
      });
      return;
    } catch (error) {
      return next(error);
    }
  }

  /** Download sample Excel template. GET /api/v1/departments/download-excel */
  async downloadExcel(req: Request, res: Response, next: NextFunction) {
    try {
      const { organizationId } = req.query as { organizationId: string };
      if (!organizationId) {
        return res.status(400).json({ status: 'fail', message: 'organizationId required' });
      }
      const configToken = req.headers['x-configurator-token'] as string | undefined;
      const buffer = await generateDepartmentExcel(organizationId, req.user!.userId, configToken);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=departments_template_${new Date().toISOString().slice(0, 10)}.xlsx`);
      return res.send(buffer);
    } catch (error) {
      return next(error);
    }
  }

  /** Bulk upload departments from Excel. POST /api/v1/departments/upload-excel */
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
      const result = await processDepartmentUpload(req.file.buffer, organizationId, req.user!.userId, configToken);
      return res.status(200).json({
        status: 'success',
        message: `Import complete: ${result.created} created, ${result.skipped} skipped, ${result.failed} failed`,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get department hierarchy
   * GET /api/v1/departments/hierarchy/:organizationId
   */
  async getHierarchy(req: Request, res: Response, next: NextFunction) {
    try {
      const { organizationId } = req.params;
      const hierarchy = await departmentService.getHierarchy(organizationId);

      res.status(200).json({
        status: 'success',
        data: { hierarchy },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const departmentController = new DepartmentController();
