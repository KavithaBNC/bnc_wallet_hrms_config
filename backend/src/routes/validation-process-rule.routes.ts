import { Router } from 'express';
import { ValidationProcessRuleController } from '../controllers/validation-process-rule.controller';
import { authenticate } from '../middlewares/auth';
import { checkPermission } from '../middlewares/permission';
import { enforceOrganizationAccess } from '../middlewares/rbac';

const router = Router();
const controller = new ValidationProcessRuleController();

router.use(authenticate);
router.use(enforceOrganizationAccess);

router.post(
  '/',
  checkPermission('validation_process_rules', 'create'),
  controller.create.bind(controller)
);

router.get('/', controller.getAll.bind(controller));

router.get('/:id', controller.getById.bind(controller));

router.put(
  '/:id',
  checkPermission('validation_process_rules', 'update'),
  controller.update.bind(controller)
);

router.delete(
  '/:id',
  checkPermission('validation_process_rules', 'delete'),
  controller.delete.bind(controller)
);

export default router;
