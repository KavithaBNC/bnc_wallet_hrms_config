import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';
import { prisma } from '../utils/prisma';
import { userHasPermission } from '../utils/permission-cache';

/**
 * Optimized RBAC middleware for employee list access
 * Filters data based on Configurator module permissions and organization
 * Enforces organization-level data isolation
 */
export const employeeListAccess = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return next(new AppError('Authentication required', 401));
  }

  const userId = req.user.userId;
  const role = req.user?.role;

  // Role is the primary authority for data-scoping access level.
  // Configurator permission cache controls field visibility (sensitive fields),
  // but data scoping (which employees are visible) is always determined by JWT role.
  let canEditOrgs = false;
  let canEditEmployees = false;
  let canViewEmployees = false;

  if (role === 'SUPER_ADMIN' || role?.includes('SUPER_ADMIN')) {
    canEditOrgs = true;
  } else if (role === 'ORG_ADMIN' || role === 'HR_MANAGER' || role?.includes('HR_ADMIN') || role?.includes('ORG_ADMIN')) {
    // Full org access — sees all employees in their organization
    canEditEmployees = true;
    canViewEmployees = true;
  } else if (role === 'MANAGER') {
    // Team-level access — sees only direct reports (and self)
    canViewEmployees = true;
  }
  // EMPLOYEE: canViewAll=false, restrictToReports=false → self only (handled in controller)

  // Get user's organization ID for data isolation
  let userOrganizationId: string | null = null;

  // Users with org-level edit access can access all organizations - no filtering needed
  if (!canEditOrgs) {
    try {
      const employee = await prisma.employee.findUnique({
        where: { userId },
        select: { organizationId: true },
      });

      if (!employee) {
        return next(new AppError('Employee profile not found. Please contact administrator.', 403));
      }

      userOrganizationId = employee.organizationId;

      // Enforce organization filter in query params
      if (!req.query.organizationId) {
        req.query.organizationId = userOrganizationId;
      } else if (req.query.organizationId !== userOrganizationId) {
        return next(new AppError('Access denied. You can only view employees from your organization.', 403));
      }
    } catch (error) {
      return next(new AppError('Failed to verify organization access', 500));
    }
  }

  // Permission-based RBAC context
  if (canEditOrgs) {
    // Full access to ALL organizations (system-level)
    req.rbac = {
      canViewAll: true,
      canViewSensitive: true,
      restrictToDepartment: false,
      restrictToReports: false,
      organizationId: null,
    };
  } else if (canEditEmployees) {
    // Full access within organization (HR-level)
    req.rbac = {
      canViewAll: true,
      canViewSensitive: true,
      restrictToDepartment: false,
      restrictToReports: false,
      organizationId: userOrganizationId,
    };
  } else if (canViewEmployees) {
    // Team-level access (can view their team)
    req.rbac = {
      canViewAll: false,
      canViewSensitive: false,
      restrictToDepartment: true,
      restrictToReports: true,
      organizationId: userOrganizationId,
    };
  } else {
    // Self-service only
    req.rbac = {
      canViewAll: false,
      canViewSensitive: false,
      restrictToDepartment: false,
      restrictToReports: false,
      organizationId: userOrganizationId,
    };
  }

  next();
};

/**
 * Middleware to enforce organization-level data isolation
 * Users without org-level edit permission are restricted to their own organization
 */
export const enforceOrganizationAccess = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return next(new AppError('Authentication required', 401));
  }

  const userId = req.user.userId;

  // Users with org-level edit access can access all organizations
  // Fall back to JWT role when permission cache is empty (e.g. after server restart)
  const hasOrgEdit = userHasPermission(userId, '/organizations', 'can_edit') || req.user.role === 'SUPER_ADMIN';
  if (hasOrgEdit) {
    return next();
  }

  // For all other users, enforce organization isolation
  try {
    let userOrganizationId: string | null = req.rbac?.organizationId ?? null;

    if (!userOrganizationId) {
      const employee = await prisma.employee.findUnique({
        where: { userId },
        select: { organizationId: true },
      });

      if (!employee) {
        return next(new AppError('Employee profile not found. Please contact administrator.', 403));
      }

      userOrganizationId = employee.organizationId;
    }

    const providedOrgId = req.query.organizationId || req.body.organizationId || req.params.organizationId;

    if (providedOrgId && providedOrgId !== userOrganizationId) {
      return next(new AppError('Access denied. You can only access data from your organization.', 403));
    }

    if (!req.query) {
      req.query = {};
    }
    req.query.organizationId = userOrganizationId;

    if ((req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') && req.body && !req.body.organizationId) {
      req.body.organizationId = userOrganizationId;
    }

    if (!req.rbac) {
      req.rbac = {
        canViewAll: true,
        canViewSensitive: true,
        restrictToDepartment: false,
        restrictToReports: false,
        organizationId: userOrganizationId,
      };
    } else {
      req.rbac.organizationId = userOrganizationId;
    }

    next();
  } catch (error) {
    return next(new AppError('Failed to verify organization access', 500));
  }
};

/**
 * Field-level access control for employee data
 * Returns allowed fields based on Configurator permissions
 */
export const getEmployeeFieldsByRole = (_role: string, userId?: string): any => {
  const baseFields = {
    id: true,
    employeeCode: true,
    firstName: true,
    lastName: true,
    email: true,
    departmentId: true,
    positionId: true,
    employeeStatus: true,
    profilePictureUrl: true,
  };

  const sensitiveFields = {
    phone: true,
    personalEmail: true,
    officialEmail: true,
    dateOfBirth: true,
    gender: true,
    maritalStatus: true,
    nationality: true,
    reportingManagerId: true,
    dateOfJoining: true,
    workLocation: true,
    employmentType: true,
    address: true,
    emergencyContacts: true,
    bankDetails: true,
    taxInformation: true,
    costCentreId: true,
    placeOfTaxDeduction: true,
    configuratorUserId: true,
  };

  // If userId provided, use permission-based field access
  if (userId) {
    const canEdit = userHasPermission(userId, '/employees', 'can_edit');
    if (canEdit) {
      return { ...baseFields, ...sensitiveFields };
    }
    const canView = userHasPermission(userId, '/employees', 'can_view');
    if (canView) {
      return { ...baseFields, reportingManagerId: true, dateOfJoining: true, workLocation: true, employmentType: true };
    }
    return baseFields;
  }

  // Fallback: return all fields (route-level permission already verified)
  return { ...baseFields, ...sensitiveFields };
};

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      rbac?: {
        canViewAll: boolean;
        canViewSensitive: boolean;
        restrictToDepartment: boolean;
        restrictToReports: boolean;
        organizationId: string | null;
      };
    }
  }
}
