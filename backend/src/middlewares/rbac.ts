import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { AppError } from './errorHandler';
import { prisma } from '../utils/prisma';

/**
 * Optimized RBAC middleware for employee list access
 * Filters data based on user role and organization for performance
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

  const userRole = req.user.role as UserRole;
  const userId = req.user.userId;

  // Get user's organization ID for data isolation
  let userOrganizationId: string | null = null;

  // SUPER_ADMIN can access all organizations - no filtering needed
  if (userRole !== 'SUPER_ADMIN') {
    try {
      // Fetch user's employee record to get organizationId
      const employee = await prisma.employee.findUnique({
        where: { userId },
        select: { organizationId: true },
      });

      if (!employee) {
        return next(new AppError('Employee profile not found. Please contact administrator.', 403));
      }

      userOrganizationId = employee.organizationId;

      // Enforce organization filter in query params
      // Override any organizationId in query to ensure data isolation
      if (!req.query.organizationId) {
        req.query.organizationId = userOrganizationId;
      } else if (req.query.organizationId !== userOrganizationId) {
        // User trying to access different organization - block it
        return next(new AppError('Access denied. You can only view employees from your organization.', 403));
      }
    } catch (error) {
      return next(new AppError('Failed to verify organization access', 500));
    }
  }

  // Role-based query optimization
  switch (userRole) {
    case 'SUPER_ADMIN':
      // HRMS_ADMIN (Platform Owner) - Full access to ALL organizations' data
      // Can view all employees, departments, attendance, leaves across all organizations
      req.rbac = {
        canViewAll: true,
        canViewSensitive: true,
        restrictToDepartment: false,
        restrictToReports: false,
        organizationId: null, // No restriction - can see all organizations
      };
      break;

    case 'ORG_ADMIN':
    case 'HR_MANAGER':
      // Full access within organization
      req.rbac = {
        canViewAll: true,
        canViewSensitive: true,
        restrictToDepartment: false,
        restrictToReports: false,
        organizationId: userOrganizationId,
      };
      break;

    case 'MANAGER':
      // Dept Admin/Manager: access + approvals for own team only
      // Can only see employees who report to them (subordinates)
      req.rbac = {
        canViewAll: false, // Cannot view all - only their team
        canViewSensitive: false, // Limited sensitive data
        restrictToDepartment: true, // Can see their department
        restrictToReports: true, // Can only see their direct reports
        organizationId: userOrganizationId,
      };
      break;

    case 'EMPLOYEE':
      // Employee: self-service only
      // Can only see and edit their own data
      req.rbac = {
        canViewAll: false, // Cannot view all employees
        canViewSensitive: false, // No sensitive data access
        restrictToDepartment: false,
        restrictToReports: false,
        organizationId: userOrganizationId,
      };
      break;

    default:
      return next(new AppError('Invalid user role', 403));
  }

  next();
};

/**
 * Middleware to enforce organization-level data isolation
 * For non-SUPER_ADMIN users, ensures organizationId is set from their employee record
 * and prevents access to other organizations' data
 */
export const enforceOrganizationAccess = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return next(new AppError('Authentication required', 401));
  }

  const userRole = req.user.role as UserRole;
  const userId = req.user.userId;

  // SUPER_ADMIN can access all organizations - no restriction
  if (userRole === 'SUPER_ADMIN') {
    return next();
  }

  // For all other roles, enforce organization isolation
  try {
    // Get user's organization ID from employee record
    const employee = await prisma.employee.findUnique({
      where: { userId },
      select: { organizationId: true },
    });

    if (!employee) {
      return next(new AppError('Employee profile not found. Please contact administrator.', 403));
    }

    const userOrganizationId = employee.organizationId;

    // If organizationId is provided in query/body/params, verify it matches user's organization
    const providedOrgId = req.query.organizationId || req.body.organizationId || req.params.organizationId;

    if (providedOrgId && providedOrgId !== userOrganizationId) {
      return next(new AppError('Access denied. You can only access data from your organization.', 403));
    }

    // Enforce organizationId in query/body for all requests
    if (!req.query) {
      req.query = {};
    }
    req.query.organizationId = userOrganizationId;
    
    // Only set in body if it's a POST/PUT/PATCH request and organizationId is not already set
    if ((req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') && req.body && !req.body.organizationId) {
      req.body.organizationId = userOrganizationId;
    }

    // Set in RBAC context
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
 * Returns allowed fields based on role
 */
export const getEmployeeFieldsByRole = (role: UserRole): any => {
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

  switch (role) {
    case 'SUPER_ADMIN':
    case 'ORG_ADMIN':
    case 'HR_MANAGER':
      return { ...baseFields, ...sensitiveFields };

    case 'MANAGER':
      return { ...baseFields, reportingManagerId: true, dateOfJoining: true, workLocation: true, employmentType: true };

    case 'EMPLOYEE':
    default:
      return baseFields;
  }
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
