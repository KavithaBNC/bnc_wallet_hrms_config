import { Request, Response, NextFunction } from 'express';
import { rolePermissionService } from '../services/role-permission.service';
import { AppError } from './errorHandler';

/**
 * Middleware to check if user has a specific permission
 * Usage: checkPermission('employees', 'create')
 */
export const checkPermission = (resource: string, action: string) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    const userRole = req.user.role as any;
    const organizationId = req.rbac?.organizationId || undefined;

    // SUPER_ADMIN always has access (system admin)
    if (userRole === 'SUPER_ADMIN') {
      return next();
    }

    const hasPermission = await rolePermissionService.hasPermission(
      userRole,
      resource,
      action,
      organizationId
    );

    if (!hasPermission) {
      return next(
        new AppError(
          `Access denied. You do not have permission to ${action} ${resource}.`,
          403
        )
      );
    }

    next();
  };
};

/**
 * Middleware to check multiple permissions (user needs at least one)
 * Usage: checkAnyPermission([{resource: 'employees', action: 'create'}, {resource: 'employees', action: 'read'}])
 */
export const checkAnyPermission = (
  permissions: Array<{ resource: string; action: string }>
) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    const userRole = req.user.role as any;
    const organizationId = req.rbac?.organizationId || undefined;

    // SUPER_ADMIN always has access
    if (userRole === 'SUPER_ADMIN') {
      return next();
    }

    for (const perm of permissions) {
      const hasPermission = await rolePermissionService.hasPermission(
        userRole,
        perm.resource,
        perm.action,
        organizationId
      );

      if (hasPermission) {
        return next();
      }
    }

    return next(
      new AppError('Access denied. Insufficient permissions.', 403)
    );
  };
};

/**
 * Middleware to check all permissions (user needs all)
 * Usage: checkAllPermissions([{resource: 'employees', action: 'create'}, {resource: 'employees', action: 'read'}])
 */
export const checkAllPermissions = (
  permissions: Array<{ resource: string; action: 'create' | 'read' | 'update' | 'delete' | 'approve' }>
) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    const userRole = req.user.role as any;
    const organizationId = req.rbac?.organizationId || undefined;

    // SUPER_ADMIN always has access
    if (userRole === 'SUPER_ADMIN') {
      return next();
    }

    // Check if user has all required permissions
    for (const perm of permissions) {
      const hasPermission = await rolePermissionService.hasPermission(
        userRole,
        perm.resource,
        perm.action,
        organizationId
      );

      if (!hasPermission) {
        return next(
          new AppError(
            `Access denied. Missing permission: ${perm.action} ${perm.resource}.`,
            403
          )
        );
      }
    }

    next();
  };
};
