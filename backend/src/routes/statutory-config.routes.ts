import { Router } from 'express';
import { statutoryConfigController } from '../controllers/statutory-config.controller';
import { authenticate } from '../middlewares/auth';
import { checkPermission } from '../middlewares/permission';
import { enforceOrganizationAccess } from '../middlewares/rbac';

const router = Router();

router.use(authenticate);
router.use(enforceOrganizationAccess);

// GET /api/v1/statutory-config — HR_MANAGER+ can view
router.get(
  '/',
  checkPermission('statutory_config', 'read'),
  statutoryConfigController.getAll.bind(statutoryConfigController)
);

// POST /api/v1/statutory-config — ORG_ADMIN+ only
router.post(
  '/',
  checkPermission('statutory_config', 'create'),
  statutoryConfigController.create.bind(statutoryConfigController)
);

// PUT /api/v1/statutory-config/:id — ORG_ADMIN+ only
router.put(
  '/:id',
  checkPermission('statutory_config', 'update'),
  statutoryConfigController.update.bind(statutoryConfigController)
);

export default router;
