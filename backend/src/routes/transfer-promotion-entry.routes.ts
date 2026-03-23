import { Router } from 'express';
import { transferPromotionEntryController } from '../controllers/transfer-promotion-entry.controller';
import { authenticate } from '../middlewares/auth';
import { checkPermission } from '../middlewares/permission';
import { enforceOrganizationAccess } from '../middlewares/rbac';
import { validate, validateQuery } from '../middlewares/validate';
import {
  createTransferPromotionEntrySchema,
  updateTransferPromotionEntrySchema,
  queryTransferPromotionEntriesSchema,
} from '../utils/transfer-promotion-entry.validation';

const router = Router();

router.use(authenticate);
router.use(enforceOrganizationAccess);

router.post(
  '/',
  checkPermission('transfer_promotion_entries', 'create'),
  validate(createTransferPromotionEntrySchema),
  transferPromotionEntryController.create.bind(transferPromotionEntryController)
);

router.get(
  '/',
  validateQuery(queryTransferPromotionEntriesSchema),
  transferPromotionEntryController.getAll.bind(transferPromotionEntryController)
);

router.get(
  '/:id',
  transferPromotionEntryController.getById.bind(transferPromotionEntryController)
);

router.put(
  '/:id',
  checkPermission('transfer_promotion_entries', 'update'),
  validate(updateTransferPromotionEntrySchema),
  transferPromotionEntryController.update.bind(transferPromotionEntryController)
);

router.delete(
  '/:id',
  checkPermission('transfer_promotion_entries', 'delete'),
  transferPromotionEntryController.delete.bind(transferPromotionEntryController)
);

export default router;
