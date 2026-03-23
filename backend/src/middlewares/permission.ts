import { Request, Response, NextFunction } from 'express';
import { getUserPermissions, type ModulePermissions } from '../utils/permission-cache';
import { AppError } from './errorHandler';

/**
 * Resource name → Configurator page path mapping.
 * Maps the resource names used in route files to the page_name paths
 * returned by the Configurator API (POST /api/v1/user-role-modules/project).
 */
const RESOURCE_TO_PATH: Record<string, string> = {
  // Employees
  employees: '/employees',
  employee_salaries: '/employee-salaries',
  employee_rejoin: '/employees',
  employee_change_requests: '/employees',

  // Departments & Organization structure
  departments: '/department-masters',
  sub_departments: '/department-masters',
  entities: '/department-masters',
  cost_centres: '/cost-centre-department',
  job_positions: '/employees',
  organizations: '/organizations',

  // Attendance & Time
  attendance: '/attendance',
  attendance_components: '/attendance',
  monthly_attendance_summary: '/attendance',
  validation_process: '/hr-activities/validation-process',
  shift_assignment_rules: '/time-attendance/shift-master',
  shifts: '/time-attendance/shift-master',

  // Leave / Event
  leaves: '/leave',
  leave_types: '/event-configuration',
  leave_balances: '/leave',
  leave_policies: '/event-configuration',
  auto_credit_settings: '/event-configuration',
  encashment_carry_forward: '/event-configuration',
  rights_allocations: '/event-configuration',

  // Payroll
  payroll: '/payroll',
  salary_structures: '/salary-structures',
  paygroups: '/payroll-master',
  post_to_payroll: '/hr-activities/post-to-payroll',
  compliance_reports: '/payroll',
  statutory_config: '/payroll-master',
  loans: '/payroll',

  // Employee Lifecycle
  employee_separations: '/payroll/employee-separation',
  fnf_settlements: '/payroll/employee-separation',
  transfer_promotions: '/transaction/transfer-promotions',
  transfer_promotion_entries: '/transaction/transfer-promotions',

  // HR Config
  approval_workflows: '/others-configuration',
  workflow_mappings: '/others-configuration',
  rule_settings: '/attendance-policy',
  validation_process_rules: '/attendance-policy',
  holidays: '/others-configuration',

  // ESOP
  esop: '/esop',

  // Permissions & Auth
  permissions: '/permissions',
  auth: '/employees',
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
