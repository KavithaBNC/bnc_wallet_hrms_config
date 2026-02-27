import { Router } from 'express';
import { transferPromotionController } from '../controllers/transfer-promotion.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { enforceOrganizationAccess } from '../middlewares/rbac';
import { validate, validateQuery } from '../middlewares/validate';
import {
  createTransferPromotionSchema,
  updateTransferPromotionSchema,
  queryTransferPromotionsSchema,
} from '../utils/transfer-promotion.validation';

const router = Router();

router.use(authenticate);
router.use(enforceOrganizationAccess);

/**
 * @route   POST /api/v1/transaction/transfer-promotions
 * @desc    Create transfer and promotion record
 * @access  Private (SUPER_ADMIN, ORG_ADMIN, HR_MANAGER)
 */
router.post(
  '/',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  validate(createTransferPromotionSchema),
  transferPromotionController.create.bind(transferPromotionController)
);

/**
 * @route   GET /api/v1/transaction/transfer-promotions
 * @desc    List transfer and promotion records
 * @access  Private
 */
router.get(
  '/',
  validateQuery(queryTransferPromotionsSchema),
  transferPromotionController.getAll.bind(transferPromotionController)
);

/**
 * @route   GET /api/v1/transaction/transfer-promotions/:id
 * @desc    Get transfer and promotion by ID
 * @access  Private
 */
router.get(
  '/:id',
  transferPromotionController.getById.bind(transferPromotionController)
);

/**
 * @route   PUT /api/v1/transaction/transfer-promotions/:id
 * @desc    Update transfer and promotion record
 * @access  Private (SUPER_ADMIN, ORG_ADMIN, HR_MANAGER)
 */
router.put(
  '/:id',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  validate(updateTransferPromotionSchema),
  transferPromotionController.update.bind(transferPromotionController)
);

export default router;
