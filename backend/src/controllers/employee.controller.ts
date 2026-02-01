import { Request, Response, NextFunction } from 'express';
import { employeeService } from '../services/employee.service';
import { getEmployeeFieldsByRole } from '../middlewares/rbac';
import { UserRole } from '@prisma/client';
import { prisma } from '../utils/prisma';

export class EmployeeController {
  /**
   * Create new employee
   * POST /api/v1/employees
   */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await employeeService.create(req.body);
      const { temporaryPassword, ...employee } = result;

      const response: any = {
        status: 'success',
        message: 'Employee created successfully',
        data: { employee },
      };

      // Include temporary password in response if it was generated
      if (temporaryPassword) {
        response.data.temporaryPassword = temporaryPassword;
        response.message += '. Please save the temporary password below.';
      }

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Rejoin: create new employee record from a separated (resigned/terminated) employee.
   * POST /api/v1/employees/rejoin
   */
  async rejoin(req: Request, res: Response, next: NextFunction) {
    try {
      const allowedOrganizationId =
        req.user?.role === 'SUPER_ADMIN'
          ? undefined
          : (await prisma.user.findUnique({
              where: { id: req.user!.userId },
              select: { organizationId: true },
            }))?.organizationId ?? undefined;
      const result = await employeeService.rejoin(req.body, allowedOrganizationId);
      const { temporaryPassword, ...employee } = result;
      const response: any = {
        status: 'success',
        message: 'Employee rejoin successful. New employee record created.',
        data: { employee },
      };
      if (temporaryPassword) {
        response.data.temporaryPassword = temporaryPassword;
        response.message += ' Please save the temporary password below.';
      }
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all employees with filtering (RBAC optimized)
   * GET /api/v1/employees
   */
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      // Get allowed fields based on user role for optimized query
      const userRole = req.user?.role as UserRole;
      const selectFields = getEmployeeFieldsByRole(userRole);

      // Prepare query with RBAC context
      const query: any = { ...req.query };
      query.rbacContext = req.rbac;

      // For MANAGER role: Get their employee ID to filter subordinates
      if (userRole === 'MANAGER' && req.user?.userId) {
        const managerEmployee = await prisma.employee.findUnique({
          where: { userId: req.user.userId },
          select: { id: true, departmentId: true },
        });
        if (managerEmployee) {
          query.managerEmployeeId = managerEmployee.id;
          query.managerDepartmentId = managerEmployee.departmentId;
        }
      }

      // For EMPLOYEE role: Get their employee ID for self-service
      if (userRole === 'EMPLOYEE' && req.user?.userId) {
        const employee = await prisma.employee.findUnique({
          where: { userId: req.user.userId },
          select: { id: true },
        });
        if (employee) {
          query.employeeId = employee.id;
        }
      }

      // Pass select fields and RBAC context to service for database-level filtering
      const result = await employeeService.getAll(query, selectFields);

      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get employee by ID
   * GET /api/v1/employees/:id
   */
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const employee = await employeeService.getById(id);

      // Verify organization access for non-SUPER_ADMIN users
      if (req.rbac?.organizationId && employee.organizationId !== req.rbac.organizationId) {
        return res.status(403).json({
          status: 'fail',
          message: 'Access denied. You can only access employees from your organization.',
        });
      }

      res.status(200).json({
        status: 'success',
        data: { employee },
      });
      return;
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Update employee
   * PUT /api/v1/employees/:id
   */
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      // Verify organization access before updating
      if (req.rbac?.organizationId) {
        const existing = await employeeService.getById(id);
        if (existing.organizationId !== req.rbac.organizationId) {
          return res.status(403).json({
            status: 'fail',
            message: 'Access denied. You can only update employees from your organization.',
          });
        }
      }

      const employee = await employeeService.update(id, req.body);

      res.status(200).json({
        status: 'success',
        message: 'Employee updated successfully',
        data: { employee },
      });
      return;
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Delete employee (soft delete)
   * DELETE /api/v1/employees/:id
   */
  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      // Verify organization access before deleting
      if (req.rbac?.organizationId) {
        const existing = await employeeService.getById(id);
        if (existing.organizationId !== req.rbac.organizationId) {
          return res.status(403).json({
            status: 'fail',
            message: 'Access denied. You can only delete employees from your organization.',
          });
        }
      }

      const result = await employeeService.delete(id);

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
   * Get employee hierarchy
   * GET /api/v1/employees/:id/hierarchy
   */
  async getHierarchy(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await employeeService.getHierarchy(id);

      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get employee statistics
   * GET /api/v1/employees/statistics/:organizationId
   */
  async getStatistics(req: Request, res: Response, next: NextFunction) {
    try {
      const { organizationId } = req.params;
      const statistics = await employeeService.getStatistics(organizationId);

      res.status(200).json({
        status: 'success',
        data: { statistics },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get employee credentials (for SUPER_ADMIN, ORG_ADMIN, HR_MANAGER).
   * SUPER_ADMIN: no organizationId = all employees; ?organizationId= = that org only.
   * ORG_ADMIN / HR_MANAGER: use their org.
   */
  async getEmployeeCredentials(req: Request, res: Response, next: NextFunction) {
    try {
      const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
      let organizationId = req.query.organizationId as string | undefined;

      if (!organizationId) {
        organizationId = req.rbac?.organizationId ?? undefined;
      }
      if (!organizationId && req.user && !isSuperAdmin) {
        const employee = await prisma.employee.findUnique({
          where: { userId: req.user.userId },
          select: { organizationId: true },
        });
        if (employee) {
          organizationId = employee.organizationId;
        }
      }

      // SUPER_ADMIN with no org = all employees; others need an org
      if (!organizationId && !isSuperAdmin) {
        return res.status(403).json({
          status: 'fail',
          message: 'Access denied. Organization ID required. Ensure your employee profile is set up.',
        });
      }

      const credentials = await employeeService.getEmployeeCredentials(organizationId);

      res.status(200).json({
        status: 'success',
        data: { credentials },
      });
      return;
    } catch (error) {
      return next(error);
    }
  }
}

export const employeeController = new EmployeeController();
