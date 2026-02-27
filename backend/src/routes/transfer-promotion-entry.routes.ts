import { Router } from 'express';
import { transferPromotionEntryController } from '../controllers/transfer-promotion-entry.controller';
import { authenticate, authorize } from '../middlewares/auth';
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
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
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
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  validate(updateTransferPromotionEntrySchema),
  transferPromotionEntryController.update.bind(transferPromotionEntryController)
);

router.delete(
  '/:id',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  transferPromotionEntryController.delete.bind(transferPromotionEntryController)
);

export default router;
