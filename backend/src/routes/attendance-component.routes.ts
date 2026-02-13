import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth';
import { enforceOrganizationAccess } from '../middlewares/rbac';
import { attendanceComponentController } from '../controllers/attendance-component.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);
// Enforce organization access for non-SUPER_ADMIN users
router.use(enforceOrganizationAccess);

/**
 * @route   POST /api/v1/attendance-components
 * @desc    Create attendance component
 * @access  Private (SUPER_ADMIN, ORG_ADMIN, HR_MANAGER)
 */
router.post(
  '/',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  attendanceComponentController.create.bind(attendanceComponentController)
);

/**
 * @route   GET /api/v1/attendance-components
 * @desc    Get all attendance components
 * @access  Private (All authenticated users)
 */
router.get(
  '/',
  attendanceComponentController.getAll.bind(attendanceComponentController)
);

/**
 * @route   GET /api/v1/attendance-components/leave-type-mapping
 * @desc    Get component id -> leave type id for Leave category (for apply-event UI)
 * @access  Private (All authenticated users)
 */
router.get(
  '/leave-type-mapping',
  attendanceComponentController.getLeaveTypeMapping.bind(attendanceComponentController)
);

/**
 * @route   GET /api/v1/attendance-components/unmapped-leave-components
 * @desc    List Leave-category components not linked to any Leave Type
 * @access  Private (All authenticated users)
 */
router.get(
  '/unmapped-leave-components',
  attendanceComponentController.getUnmappedLeaveComponents.bind(attendanceComponentController)
);

/**
 * @route   GET /api/v1/attendance-components/:id
 * @desc    Get attendance component by ID
 * @access  Private (All authenticated users)
 */
router.get(
  '/:id',
  attendanceComponentController.getById.bind(attendanceComponentController)
);

/**
 * @route   PUT /api/v1/attendance-components/:id
 * @desc    Update attendance component
 * @access  Private (SUPER_ADMIN, ORG_ADMIN, HR_MANAGER)
 */
router.put(
  '/:id',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  attendanceComponentController.update.bind(attendanceComponentController)
);

/**
 * @route   DELETE /api/v1/attendance-components/:id
 * @desc    Delete attendance component
 * @access  Private (SUPER_ADMIN, ORG_ADMIN)
 */
router.delete(
  '/:id',
  authorize('SUPER_ADMIN', 'ORG_ADMIN'),
  attendanceComponentController.delete.bind(attendanceComponentController)
);

export default router;
