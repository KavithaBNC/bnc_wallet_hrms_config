import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';
import { prisma } from '../utils/prisma';
import { userHasPermission } from '../utils/permission-cache';

/**
 * Middleware to control payslip access based on Configurator permissions.
 * Users with can_edit on /payroll can access all payslips in their org.
 * Users with can_view on /payroll can access team members' payslips.
 * Others can only access their own payslips.
 */
export const payslipAccessControl = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return next(new AppError('Authentication required', 401));
  }

  const userId = req.user.userId || (req.user as any).id;
  const payslipId = req.params.id || req.params.payslipId;

  // If no payslip ID, skip (for list endpoints, handled by query filters)
  if (!payslipId) {
    return next();
  }

  // Users with edit permission on payroll can access all payslips
  if (userHasPermission(userId, '/payroll', 'can_edit')) {
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

  // Users with view permission on payroll can access team members' payslips
  if (userHasPermission(userId, '/payroll', 'can_view')) {
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

    const isDirectReport = payslipEmployee?.reportingManagerId === employee.id;
    const isDepartmentManager = payslipEmployee?.department?.managerId === employee.id;

    if (payslip.employeeId !== employee.id && !isDirectReport && !isDepartmentManager) {
      return next(new AppError('Access denied. You can only view payslips of your team members.', 403));
    }

    return next();
  }

  // Default: can only access own payslips
  if (payslip.employeeId !== employee.id) {
    return next(new AppError('Access denied. You can only view your own payslips.', 403));
  }

  next();
};
