import { Router } from 'express';
import { jobPositionController } from '../controllers/job-position.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { enforceOrganizationAccess } from '../middlewares/rbac';
import { validate, validateQuery } from '../middlewares/validate';
import {
  createJobPositionSchema,
  updateJobPositionSchema,
  queryJobPositionsSchema,
} from '../utils/job-position.validation';

const router = Router();

// All routes require authentication
router.use(authenticate);
// Enforce organization access for non-SUPER_ADMIN users
router.use(enforceOrganizationAccess);

/**
 * @route   GET /api/v1/positions/statistics/:organizationId
 * @desc    Get position statistics
 * @access  Private (SUPER_ADMIN, ORG_ADMIN, HR_MANAGER)
 */
router.get(
  '/statistics/:organizationId',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  // Note: enforceOrganizationAccess is already applied at router level, but we need to check params
  jobPositionController.getStatistics.bind(jobPositionController)
);

/**
 * @route   GET /api/v1/positions/department/:departmentId
 * @desc    Get positions by department
 * @access  Private (All authenticated users)
 */
router.get(
  '/department/:departmentId',
  jobPositionController.getByDepartment.bind(jobPositionController)
);

/**
 * @route   GET /api/v1/positions
 * @desc    Get all positions with filtering
 * @access  Private (All authenticated users)
 */
router.get(
  '/',
  validateQuery(queryJobPositionsSchema),
  jobPositionController.getAll.bind(jobPositionController)
);

/**
 * @route   GET /api/v1/positions/:id
 * @desc    Get position by ID
 * @access  Private (All authenticated users)
 */
router.get(
  '/:id',
  jobPositionController.getById.bind(jobPositionController)
);

/**
 * @route   POST /api/v1/positions
 * @desc    Create new position
 * @access  Private (SUPER_ADMIN, ORG_ADMIN, HR_MANAGER)
 */
router.post(
  '/',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  validate(createJobPositionSchema),
  jobPositionController.create.bind(jobPositionController)
);

/**
 * @route   PUT /api/v1/positions/:id
 * @desc    Update position
 * @access  Private (SUPER_ADMIN, ORG_ADMIN, HR_MANAGER)
 */
router.put(
  '/:id',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  validate(updateJobPositionSchema),
  jobPositionController.update.bind(jobPositionController)
);

/**
 * @route   DELETE /api/v1/positions/:id
 * @desc    Delete position
 * @access  Private (SUPER_ADMIN, ORG_ADMIN)
 */
router.delete(
  '/:id',
  authorize('SUPER_ADMIN', 'ORG_ADMIN'),
  jobPositionController.delete.bind(jobPositionController)
);

export default router;
