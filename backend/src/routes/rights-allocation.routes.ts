import { Router } from 'express';
import { RightsAllocationController } from '../controllers/rights-allocation.controller';
import { authenticate } from '../middlewares/auth';
import { checkPermission } from '../middlewares/permission';
import { enforceOrganizationAccess } from '../middlewares/rbac';

const router = Router();
const controller = new RightsAllocationController();

// All routes require authentication
router.use(authenticate);
// Enforce organization access for non-SUPER_ADMIN users
router.use(enforceOrganizationAccess);

/**
 * @route   POST /api/v1/rights-allocations
 * @desc    Create rights allocation
 * @access  Private (SUPER_ADMIN, ORG_ADMIN, HR_MANAGER)
 */
router.post(
  '/',
  checkPermission('rights_allocations', 'create'),
  controller.create.bind(controller)
);

/**
 * @route   GET /api/v1/rights-allocations
 * @desc    Get all rights allocations
 * @access  Private (All authenticated users)
 */
router.get(
  '/',
  controller.getAll.bind(controller)
);

/**
 * @route   GET /api/v1/rights-allocations/:id
 * @desc    Get rights allocation by ID
 * @access  Private (All authenticated users)
 */
router.get(
  '/:id',
  controller.getById.bind(controller)
);

/**
 * @route   PUT /api/v1/rights-allocations/:id
 * @desc    Update rights allocation
 * @access  Private (SUPER_ADMIN, ORG_ADMIN, HR_MANAGER)
 */
router.put(
  '/:id',
  checkPermission('rights_allocations', 'update'),
  controller.update.bind(controller)
);

/**
 * @route   DELETE /api/v1/rights-allocations/:id
 * @desc    Delete rights allocation
 * @access  Private (SUPER_ADMIN, ORG_ADMIN)
 */
router.delete(
  '/:id',
  checkPermission('rights_allocations', 'delete'),
  controller.delete.bind(controller)
);

export default router;
