import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { AppError } from './errorHandler';
import { prisma } from '../utils/prisma';

/**
 * Middleware to ensure employees can only access their own payslips
 * ORG_ADMIN, HR_MANAGER, and MANAGER can access all payslips in their organization
 */
export const payslipAccessControl = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return next(new AppError('Authentication required', 401));
  }

  const userRole = req.user.role as UserRole;
  const userId = req.user.userId || (req.user as any).id;
  const payslipId = req.params.id || req.params.payslipId;

  // If no payslip ID, skip (for list endpoints, handled by query filters)
  if (!payslipId) {
    return next();
  }

  // SUPER_ADMIN, ORG_ADMIN, HR_MANAGER can access all payslips
  if (userRole === 'SUPER_ADMIN' || userRole === 'ORG_ADMIN' || userRole === 'HR_MANAGER') {
    return next();
  }

  // Get payslip to check ownership
  const payslip = await prisma.payslip.findUnique({
    where: { id: payslipId },
    select: {
      id: true,
      employeeId: true,
      employee: {
        select: {
          organizationId: true,
        },
      },
    },
  });

  if (!payslip) {
    return next(new AppError('Payslip not found', 404));
  }

  // Get user's employee record
  const employee = await prisma.employee.findUnique({
    where: { userId },
    select: {
      id: true,
      organizationId: true,
    },
  });

  if (!employee) {
    return next(new AppError('Employee profile not found', 403));
  }

  // Check organization match
  if (employee.organizationId !== payslip.employee.organizationId) {
    return next(new AppError('Access denied. Payslip belongs to different organization.', 403));
  }

  // MANAGER can access payslips of their team members
  if (userRole === 'MANAGER') {
    // Check if the payslip employee reports to this manager
    const payslipEmployee = await prisma.employee.findUnique({
      where: { id: payslip.employeeId },
      select: {
        reportingManagerId: true,
        department: {
          select: {
            managerId: true,
          },
        },
      },
    });

    // Manager can access if:
    // 1. Payslip belongs to them (self)
    // 2. Payslip employee reports to them directly
    // 3. Payslip employee's department manager is them
    const isDirectReport = payslipEmployee?.reportingManagerId === employee.id;
    const isDepartmentManager = payslipEmployee?.department?.managerId === employee.id;
    
    if (payslip.employeeId !== employee.id && !isDirectReport && !isDepartmentManager) {
      return next(new AppError('Access denied. You can only view payslips of your team members.', 403));
    }

    return next();
  }

  // EMPLOYEE can only access their own payslips
  if (userRole === 'EMPLOYEE') {
    if (payslip.employeeId !== employee.id) {
      return next(new AppError('Access denied. You can only view your own payslips.', 403));
    }
  }

  next();
};
