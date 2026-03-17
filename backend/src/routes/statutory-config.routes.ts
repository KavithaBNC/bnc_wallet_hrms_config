import { Router } from 'express';
import { statutoryConfigController } from '../controllers/statutory-config.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { enforceOrganizationAccess } from '../middlewares/rbac';

const router = Router();

router.use(authenticate);
router.use(enforceOrganizationAccess);

// GET /api/v1/statutory-config — HR_MANAGER+ can view
router.get(
  '/',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  statutoryConfigController.getAll.bind(statutoryConfigController)
);

// POST /api/v1/statutory-config — ORG_ADMIN+ only
router.post(
  '/',
  authorize('SUPER_ADMIN', 'ORG_ADMIN'),
  statutoryConfigController.create.bind(statutoryConfigController)
);

// PUT /api/v1/statutory-config/:id — ORG_ADMIN+ only
router.put(
  '/:id',
  authorize('SUPER_ADMIN', 'ORG_ADMIN'),
  statutoryConfigController.update.bind(statutoryConfigController)
);

export default router;
