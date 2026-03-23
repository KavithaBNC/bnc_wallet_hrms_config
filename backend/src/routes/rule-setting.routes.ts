import { Router } from 'express';
import { RuleSettingController } from '../controllers/rule-setting.controller';
import { authenticate } from '../middlewares/auth';
import { checkPermission } from '../middlewares/permission';
import { enforceOrganizationAccess } from '../middlewares/rbac';

const router = Router();
const controller = new RuleSettingController();

router.use(authenticate);
router.use(enforceOrganizationAccess);

router.post(
  '/',
  checkPermission('rule_settings', 'create'),
  controller.create.bind(controller)
);

router.get('/', controller.getAll.bind(controller));

router.get('/:id', controller.getById.bind(controller));

router.put(
  '/:id',
  checkPermission('rule_settings', 'update'),
  controller.update.bind(controller)
);

router.delete(
  '/:id',
  checkPermission('rule_settings', 'delete'),
  controller.delete.bind(controller)
);

export default router;
