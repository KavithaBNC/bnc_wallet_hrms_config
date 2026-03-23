import { Request, Response, NextFunction } from 'express';
import { employeeService } from '../services/employee.service';
import { getEmployeeFieldsByRole } from '../middlewares/rbac';
import { prisma } from '../utils/prisma';
import { userHasPermission } from '../utils/permission-cache';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class EmployeeController {
  /**
   * Create new employee
   * POST /api/v1/employees
   */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const employee = await employeeService.create(req.body, req.user?.userId);

      res.status(201).json({
        status: 'success',
        message: 'Employee created successfully',
        data: { employee },
      });
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
      const hasOrgAccess = req.user?.userId ? userHasPermission(req.user.userId, '/organizations', 'can_edit') : false;
      const allowedOrganizationId =
        hasOrgAccess
          ? undefined
          : (await prisma.user.findUnique({
              where: { id: req.user!.userId },
              select: { organizationId: true },
            }))?.organizationId ?? undefined;
      const employee = await employeeService.rejoin(req.body, allowedOrganizationId);
      res.status(201).json({
        status: 'success',
        message: 'Employee rejoin successful. New employee record created.',
        data: { employee },
      });
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
      // Get allowed fields based on Configurator permissions
      const selectFields = getEmployeeFieldsByRole(req.user?.role || '', req.user?.userId);

      // Prepare query with RBAC context
      const query: any = { ...req.query };
      query.rbacContext = req.rbac;

      // For users with team-level access (can_view but not can_edit): filter to subordinates
      if (req.rbac?.restrictToReports && req.user?.userId) {
        const managerEmployee = await prisma.employee.findUnique({
          where: { userId: req.user.userId },
          select: { id: true, departmentId: true },
        });
        if (managerEmployee) {
          query.managerEmployeeId = managerEmployee.id;
          query.managerDepartmentId = managerEmployee.departmentId;
        }
      }

      // For users with self-service only (no can_view): restrict to own record
      if (!req.rbac?.canViewAll && !req.rbac?.restrictToReports && req.user?.userId) {
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
      if (!UUID_REGEX.test(id)) {
        return res.status(400).json({ status: 'fail', message: 'Invalid employee ID format' });
      }
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
   * Get employee by Configurator user_id
   * GET /api/v1/employees/configurator/:configuratorUserId
   */
  async getByConfiguratorUserId(req: Request, res: Response, next: NextFunction) {
    try {
      const configuratorUserId = parseInt(req.params.configuratorUserId, 10);
      if (isNaN(configuratorUserId) || configuratorUserId <= 0) {
        return res.status(400).json({ status: 'fail', message: 'Invalid configurator user ID' });
      }

      const employee = await employeeService.getByConfiguratorUserId(configuratorUserId);
      if (!employee) {
        return res.status(404).json({ status: 'fail', message: 'Employee not found' });
      }

      // Verify organization access
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
      if (!UUID_REGEX.test(id)) {
        return res.status(400).json({ status: 'fail', message: 'Invalid employee ID format' });
      }

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

      const employee = await employeeService.update(id, req.body, req.user?.userId);

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
      if (!UUID_REGEX.test(id)) {
        return res.status(400).json({ status: 'fail', message: 'Invalid employee ID format' });
      }

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

      const result = await employeeService.delete(id, req.user?.userId);

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
   * Delete employee by Configurator user_id (soft delete)
   * DELETE /api/v1/employees/configurator/:configuratorUserId
   */
  async deleteByConfiguratorUserId(req: Request, res: Response, next: NextFunction) {
    try {
      const configuratorUserId = parseInt(req.params.configuratorUserId, 10);
      if (isNaN(configuratorUserId) || configuratorUserId <= 0) {
        return res.status(400).json({ status: 'fail', message: 'Invalid configurator user ID' });
      }
      const result = await employeeService.deleteByConfiguratorUserId(configuratorUserId, req.user?.userId);
      res.status(200).json({ status: 'success', message: result.message });
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
      const hasOrgAccess = req.user?.userId ? userHasPermission(req.user.userId, '/organizations', 'can_view') : false;
      let organizationId = req.query.organizationId as string | undefined;

      if (!organizationId) {
        organizationId = req.rbac?.organizationId ?? undefined;
      }
      if (!organizationId && req.user && !hasOrgAccess) {
        const employee = await prisma.employee.findUnique({
          where: { userId: req.user.userId },
          select: { organizationId: true },
        });
        if (employee) {
          organizationId = employee.organizationId;
        }
      }

      // Users with org access and no org = all employees; others need an org
      if (!organizationId && !hasOrgAccess) {
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
