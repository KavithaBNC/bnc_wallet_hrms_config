import { Request, Response, NextFunction } from 'express';
import { departmentService } from '../services/department.service';
import { prisma } from '../utils/prisma';

export class DepartmentController {
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
