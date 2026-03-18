import { Request, Response, NextFunction } from 'express';
import { getUserPermissions, type ModulePermissions } from '../utils/permission-cache';
import { AppError } from './errorHandler';

/**
 * Resource name → Configurator page path mapping.
 * Maps the resource names used in route files to the page_name paths
 * returned by the Configurator API (POST /api/v1/user-role-modules/project).
 */
const RESOURCE_TO_PATH: Record<string, string> = {
  employees: '/employees',
  employee_salaries: '/employee-salaries',
  salary_structures: '/salary-structures',
  payroll: '/payroll',
  departments: '/department-masters',
  permissions: '/permissions',
  attendance: '/attendance',
  leaves: '/leave',
  shifts: '/time-attendance/shift-master',
  employee_separations: '/payroll/employee-separation',
  employee_rejoin: '/employees',
  esop: '/esop',
  organizations: '/organizations',
};

/**
 * Action → Configurator permission flag mapping.
 */
const ACTION_TO_FLAG: Record<string, keyof ModulePermissions> = {
  read: 'can_view',
  create: 'can_add',
  update: 'can_edit',
  delete: 'can_delete',
};

/**
 * Middleware to check if user has a specific permission.
 * Reads from in-memory cache populated at login time from Configurator API.
 * Usage: checkPermission('employees', 'create')
 */
export const checkPermission = (resource: string, action: string) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    // SUPER_ADMIN always has access
    if (req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    const modulePerms = getUserPermissions(req.user.userId);
    if (!modulePerms) {
      return next(
        new AppError('Module permissions not loaded. Please re-login.', 403)
      );
    }

    const path = RESOURCE_TO_PATH[resource];
    const flag = ACTION_TO_FLAG[action];
    if (!path || !flag) {
      return next(new AppError(`Unknown resource/action: ${resource}.${action}`, 403));
    }

    const perms = modulePerms[path];
    if (perms?.is_enabled && perms[flag]) {
      return next();
    }

    return next(
      new AppError(
        `Access denied. You do not have permission to ${action} ${resource}.`,
        403
      )
    );
  };
};

/**
 * Middleware to check multiple permissions (user needs at least one).
 * Usage: checkAnyPermission([{resource: 'employees', action: 'create'}, {resource: 'employees', action: 'read'}])
 */
export const checkAnyPermission = (
  permissions: Array<{ resource: string; action: string }>
) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    // SUPER_ADMIN always has access
    if (req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    const modulePerms = getUserPermissions(req.user.userId);
    if (!modulePerms) {
      return next(new AppError('Module permissions not loaded. Please re-login.', 403));
    }

    for (const perm of permissions) {
      const path = RESOURCE_TO_PATH[perm.resource];
      const flag = ACTION_TO_FLAG[perm.action];
      if (path && flag) {
        const perms = modulePerms[path];
        if (perms?.is_enabled && perms[flag]) {
          return next();
        }
      }
    }

    return next(
      new AppError('Access denied. Insufficient permissions.', 403)
    );
  };
};

/**
 * Middleware to check all permissions (user needs all).
 * Usage: checkAllPermissions([{resource: 'employees', action: 'create'}, {resource: 'employees', action: 'read'}])
 */
export const checkAllPermissions = (
  permissions: Array<{ resource: string; action: string }>
) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    // SUPER_ADMIN always has access
    if (req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    const modulePerms = getUserPermissions(req.user.userId);
    if (!modulePerms) {
      return next(new AppError('Module permissions not loaded. Please re-login.', 403));
    }

    for (const perm of permissions) {
      const path = RESOURCE_TO_PATH[perm.resource];
      const flag = ACTION_TO_FLAG[perm.action];
      if (!path || !flag) {
        return next(new AppError(`Unknown resource/action: ${perm.resource}.${perm.action}`, 403));
      }
      const perms = modulePerms[path];
      if (!perms?.is_enabled || !perms[flag]) {
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
