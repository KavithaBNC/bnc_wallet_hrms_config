import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { checkPermission } from '../middlewares/permission';
import { enforceOrganizationAccess } from '../middlewares/rbac';
import { shiftController } from '../controllers/shift.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);
// Enforce organization access for non-SUPER_ADMIN users
router.use(enforceOrganizationAccess);

/**
 * @route   POST /api/v1/shifts
 * @desc    Create shift
 * @access  Private (SUPER_ADMIN, ORG_ADMIN, HR_MANAGER)
 */
router.post(
  '/',
  checkPermission('shifts', 'create'),
  shiftController.create.bind(shiftController)
);

/**
 * @route   GET /api/v1/shifts
 * @desc    Get all shifts
 * @access  Private (All authenticated users)
 */
router.get(
  '/',
  shiftController.getAll.bind(shiftController)
);

/**
 * @route   GET /api/v1/shifts/:id
 * @desc    Get shift by ID
 * @access  Private (All authenticated users)
 */
router.get(
  '/:id',
  shiftController.getById.bind(shiftController)
);

/**
 * @route   PUT /api/v1/shifts/:id
 * @desc    Update shift
 * @access  Private (SUPER_ADMIN, ORG_ADMIN, HR_MANAGER)
 */
router.put(
  '/:id',
  checkPermission('shifts', 'update'),
  shiftController.update.bind(shiftController)
);

/**
 * @route   DELETE /api/v1/shifts/:id
 * @desc    Delete shift
 * @access  Private (SUPER_ADMIN, ORG_ADMIN)
 */
router.delete(
  '/:id',
  checkPermission('shifts', 'delete'),
  shiftController.delete.bind(shiftController)
);

export default router;
