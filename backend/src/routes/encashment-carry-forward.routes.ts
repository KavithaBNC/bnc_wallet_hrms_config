import { Router } from 'express';
import { EncashmentCarryForwardController } from '../controllers/encashment-carry-forward.controller';
import { authenticate } from '../middlewares/auth';
import { checkPermission } from '../middlewares/permission';
import { enforceOrganizationAccess } from '../middlewares/rbac';

const router = Router();
const controller = new EncashmentCarryForwardController();

// All routes require authentication
router.use(authenticate);
// Enforce organization access for non-SUPER_ADMIN users
router.use(enforceOrganizationAccess);

/**
 * @route   POST /api/v1/encashment-carry-forwards
 * @desc    Create encashment/carry forward rule
 * @access  Private (SUPER_ADMIN, ORG_ADMIN, HR_MANAGER)
 */
router.post(
  '/',
  checkPermission('encashment_carry_forward', 'create'),
  controller.create.bind(controller)
);

/**
 * @route   GET /api/v1/encashment-carry-forwards
 * @desc    Get all encashment/carry forward rules
 * @access  Private (All authenticated users)
 */
router.get(
  '/',
  controller.getAll.bind(controller)
);

/**
 * @route   GET /api/v1/encashment-carry-forwards/:id
 * @desc    Get encashment/carry forward rule by ID
 * @access  Private (All authenticated users)
 */
router.get(
  '/:id',
  controller.getById.bind(controller)
);

/**
 * @route   PUT /api/v1/encashment-carry-forwards/:id
 * @desc    Update encashment/carry forward rule
 * @access  Private (SUPER_ADMIN, ORG_ADMIN, HR_MANAGER)
 */
router.put(
  '/:id',
  checkPermission('encashment_carry_forward', 'update'),
  controller.update.bind(controller)
);

/**
 * @route   DELETE /api/v1/encashment-carry-forwards/:id
 * @desc    Delete encashment/carry forward rule
 * @access  Private (SUPER_ADMIN, ORG_ADMIN)
 */
router.delete(
  '/:id',
  checkPermission('encashment_carry_forward', 'delete'),
  controller.delete.bind(controller)
);

export default router;
