import { Router } from 'express';
import { departmentController } from '../controllers/department.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { enforceOrganizationAccess } from '../middlewares/rbac';
import { validate, validateQuery } from '../middlewares/validate';
import {
  createDepartmentSchema,
  updateDepartmentSchema,
  queryDepartmentsSchema,
} from '../utils/department.validation';

const router = Router();

// All routes require authentication
router.use(authenticate);
// Enforce organization access for non-SUPER_ADMIN users
router.use(enforceOrganizationAccess);

/**
 * @route   GET /api/v1/departments/hierarchy/:organizationId
 * @desc    Get department hierarchy tree
 * @access  Private (All authenticated users)
 */
router.get(
  '/hierarchy/:organizationId',
  departmentController.getHierarchy.bind(departmentController)
);

/**
 * @route   GET /api/v1/departments
 * @desc    Get all departments with filtering
 * @access  Private (All authenticated users)
 */
router.get(
  '/',
  validateQuery(queryDepartmentsSchema),
  departmentController.getAll.bind(departmentController)
);

/**
 * @route   GET /api/v1/departments/:id
 * @desc    Get department by ID
 * @access  Private (All authenticated users)
 */
router.get(
  '/:id',
  departmentController.getById.bind(departmentController)
);

/**
 * @route   POST /api/v1/departments
 * @desc    Create new department
 * @access  Private (SUPER_ADMIN, ORG_ADMIN, HR_MANAGER)
 */
router.post(
  '/',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  validate(createDepartmentSchema),
  departmentController.create.bind(departmentController)
);

/**
 * @route   PUT /api/v1/departments/:id
 * @desc    Update department
 * @access  Private (SUPER_ADMIN, ORG_ADMIN, HR_MANAGER)
 */
router.put(
  '/:id',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  validate(updateDepartmentSchema),
  departmentController.update.bind(departmentController)
);

/**
 * @route   DELETE /api/v1/departments/:id
 * @desc    Delete department
 * @access  Private (SUPER_ADMIN, ORG_ADMIN)
 */
router.delete(
  '/:id',
  authorize('SUPER_ADMIN', 'ORG_ADMIN'),
  departmentController.delete.bind(departmentController)
);

export default router;
