import { Router } from 'express';
import { AutoCreditSettingController } from '../controllers/auto-credit-setting.controller';
import { authenticate } from '../middlewares/auth';
import { checkPermission } from '../middlewares/permission';
import { enforceOrganizationAccess } from '../middlewares/rbac';

const router = Router();
const controller = new AutoCreditSettingController();

router.use(authenticate);
router.use(enforceOrganizationAccess);

router.post(
  '/',
  checkPermission('auto_credit_settings', 'create'),
  controller.create.bind(controller)
);

router.get('/', controller.getAll.bind(controller));

router.get('/:id', controller.getById.bind(controller));

router.put(
  '/:id',
  checkPermission('auto_credit_settings', 'update'),
  controller.update.bind(controller)
);

router.delete(
  '/:id',
  checkPermission('auto_credit_settings', 'delete'),
  controller.delete.bind(controller)
);

export default router;
