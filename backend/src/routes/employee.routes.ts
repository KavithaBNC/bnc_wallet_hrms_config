import { Router } from 'express';
import { employeeController } from '../controllers/employee.controller';
import { authenticate, authorize, authorizeEmployeeUpdate } from '../middlewares/auth';
import { employeeListAccess, enforceOrganizationAccess } from '../middlewares/rbac';
import { validate, validateQuery } from '../middlewares/validate';
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  queryEmployeesSchema,
} from '../utils/employee.validation';

const router = Router();

// All routes require authentication
router.use(authenticate);
// Enforce organization access for non-SUPER_ADMIN users (except for routes that use employeeListAccess)
// Note: employeeListAccess already handles organization filtering, but we need this for POST/PUT/DELETE routes

/**
 * @route   GET /api/v1/employees/credentials
 * @desc    Get employee credentials (for SUPER_ADMIN, ORG_ADMIN, HR_MANAGER)
 * @access  Private (SUPER_ADMIN, ORG_ADMIN, HR_MANAGER)
 */
router.get(
  '/credentials',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  employeeListAccess, // This sets req.rbac.organizationId
  employeeController.getEmployeeCredentials.bind(employeeController)
);

/**
 * @route   GET /api/v1/employees/statistics/:organizationId
 * @desc    Get employee statistics
 * @access  Private (SUPER_ADMIN, ORG_ADMIN, HR_MANAGER)
 */
router.get(
  '/statistics/:organizationId',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  enforceOrganizationAccess, // Verify organizationId in params matches user's organization
  employeeController.getStatistics.bind(employeeController)
);

/**
 * @route   GET /api/v1/employees/:id/hierarchy
 * @desc    Get employee hierarchy (reporting structure)
 * @access  Private (SUPER_ADMIN, ORG_ADMIN, HR_MANAGER, MANAGER)
 */
router.get(
  '/:id/hierarchy',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER', 'MANAGER'),
  employeeController.getHierarchy.bind(employeeController)
);

/**
 * @route   GET /api/v1/employees
 * @desc    Get all employees with filtering (RBAC optimized)
 * @access  Private (Role-based field filtering)
 */
router.get(
  '/',
  employeeListAccess,
  validateQuery(queryEmployeesSchema),
  employeeController.getAll.bind(employeeController)
);

/**
 * @route   GET /api/v1/employees/:id
 * @desc    Get employee by ID
 * @access  Private (All authenticated users)
 */
router.get(
  '/:id',
  employeeListAccess, // Ensure organization filtering for employee access
  employeeController.getById.bind(employeeController)
);

/**
 * @route   POST /api/v1/employees
 * @desc    Create new employee
 * @access  Private (SUPER_ADMIN, ORG_ADMIN, HR_MANAGER)
 */
router.post(
  '/',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  enforceOrganizationAccess, // Ensure organizationId is set from user's organization
  validate(createEmployeeSchema),
  employeeController.create.bind(employeeController)
);

/**
 * @route   PUT /api/v1/employees/:id
 * @desc    Update employee. SUPER_ADMIN/ORG_ADMIN/HR_MANAGER: any employee. MANAGER/EMPLOYEE: own profile only (tab-level by permission).
 * @access  Private (SUPER_ADMIN, ORG_ADMIN, HR_MANAGER for all; MANAGER, EMPLOYEE for own profile)
 */
router.put(
  '/:id',
  authorizeEmployeeUpdate, // Allows admin roles for any update; MANAGER/EMPLOYEE only for own profile
  enforceOrganizationAccess, // Ensure organizationId set; sets req.rbac for controller
  validate(updateEmployeeSchema),
  employeeController.update.bind(employeeController)
);

/**
 * @route   DELETE /api/v1/employees/:id
 * @desc    Delete employee (soft delete)
 * @access  Private (SUPER_ADMIN, ORG_ADMIN)
 */
router.delete(
  '/:id',
  authorize('SUPER_ADMIN', 'ORG_ADMIN'),
  employeeListAccess, // Ensure organization filtering
  employeeController.delete.bind(employeeController)
);

export default router;
