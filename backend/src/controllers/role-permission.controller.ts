import { Request, Response, NextFunction } from 'express';
import { rolePermissionService } from '../services/role-permission.service';
import { prisma } from '../utils/prisma';
import { AppError } from '../middlewares/errorHandler';

export class RolePermissionController {
  /**
   * Assign permissions to a role
   * POST /api/v1/role-permissions/assign
   */
  async assignPermissions(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await rolePermissionService.assignPermissions(req.body);

      res.status(200).json({
        status: 'success',
        message: `Assigned ${result.assigned} permission(s). ${result.skipped} already assigned.`,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Remove permission from a role
   * DELETE /api/v1/role-permissions/remove
   */
  async removePermission(req: Request, res: Response, next: NextFunction) {
    try {
      await rolePermissionService.removePermission(req.body);

      res.status(200).json({
        status: 'success',
        message: 'Permission removed from role successfully',
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get all permissions for a role
   * GET /api/v1/role-permissions/:role
   */
  async getRolePermissions(req: Request, res: Response, next: NextFunction) {
    try {
      const { role } = req.params;
      let organizationId = req.query.organizationId as string | undefined;

      if (req.user?.role === 'ORG_ADMIN') {
        const employee = await prisma.employee.findUnique({
          where: { userId: req.user.userId },
          select: { organizationId: true },
        });
        if (!employee?.organizationId) {
          return res.status(403).json({
            status: 'fail',
            message: 'Your organization could not be determined.',
          });
        }
        organizationId = employee.organizationId;
        const allowedRoles = ['HR_MANAGER', 'MANAGER', 'EMPLOYEE'];
        if (!allowedRoles.includes(role)) {
          return res.status(403).json({
            status: 'fail',
            message: 'You can only view permissions for HR Manager, Manager, or Employee.',
          });
        }
      }

      const permissions = await rolePermissionService.getRolePermissions(
        role as any,
        organizationId
      );

      res.status(200).json({
        status: 'success',
        data: { permissions },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get user permissions (for current user)
   * GET /api/v1/role-permissions/user/permissions
   */
  async getUserPermissions(req: Request, res: Response, next: NextFunction) {
    try {
      const userRole = req.user?.role as any;
      let organizationId = req.rbac?.organizationId || undefined;

      if (!userRole) {
        return res.status(401).json({
          status: 'fail',
          message: 'Authentication required',
        });
      }

      if (!organizationId && userRole !== 'SUPER_ADMIN') {
        const employee = await prisma.employee.findUnique({
          where: { userId: req.user!.userId },
          select: { organizationId: true },
        });
        if (employee) organizationId = employee.organizationId;
      }

      const permissions = await rolePermissionService.getUserPermissions(
        userRole,
        organizationId
      );

      res.status(200).json({
        status: 'success',
        data: { permissions },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Replace all permissions for a role
   * PUT /api/v1/role-permissions/:role/replace
   */
  async replaceRolePermissions(req: Request, res: Response, next: NextFunction) {
    try {
      const { role } = req.params;
      let { permissionIds, organizationId } = req.body;

      if (!Array.isArray(permissionIds)) {
        return res.status(400).json({
          status: 'fail',
          message: 'permissionIds must be an array',
        });
      }

      if (req.user?.role === 'ORG_ADMIN') {
        const employee = await prisma.employee.findUnique({
          where: { userId: req.user.userId },
          select: { organizationId: true },
        });
        if (!employee?.organizationId) {
          throw new AppError('Your organization could not be determined.', 403);
        }
        organizationId = employee.organizationId;
        const allowedRoles = ['HR_MANAGER', 'MANAGER', 'EMPLOYEE'];
        if (!allowedRoles.includes(role)) {
          throw new AppError('You can only assign permissions to HR Manager, Manager, or Employee.', 403);
        }
      }

      const restrictToOrgModules = req.user?.role === 'ORG_ADMIN';
      const result = await rolePermissionService.replaceRolePermissions(
        role as any,
        permissionIds,
        organizationId,
        restrictToOrgModules
      );

      res.status(200).json({
        status: 'success',
        message: `Replaced permissions: removed ${result.removed}, assigned ${result.assigned}`,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Check if role has permission
   * POST /api/v1/role-permissions/check
   */
  async checkPermission(req: Request, res: Response, next: NextFunction) {
    try {
      const { role, resource, action, organizationId } = req.body;

      const hasPermission = await rolePermissionService.hasPermission(
        role,
        resource,
        action,
        organizationId
      );

      res.status(200).json({
        status: 'success',
        data: { hasPermission },
      });
    } catch (error) {
      return next(error);
    }
  }
}

export const rolePermissionController = new RolePermissionController();
