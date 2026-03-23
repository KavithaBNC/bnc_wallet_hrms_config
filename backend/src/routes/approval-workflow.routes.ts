import { Router } from 'express';
import { ApprovalWorkflowController } from '../controllers/approval-workflow.controller';
import { authenticate } from '../middlewares/auth';
import { checkPermission } from '../middlewares/permission';
import { enforceOrganizationAccess } from '../middlewares/rbac';

const router = Router();
const controller = new ApprovalWorkflowController();

router.use(authenticate);
router.use(enforceOrganizationAccess);

router.post(
  '/',
  checkPermission('approval_workflows', 'create'),
  controller.create.bind(controller)
);

router.get('/', controller.getAll.bind(controller));

router.get('/:id', controller.getById.bind(controller));

router.put(
  '/:id',
  checkPermission('approval_workflows', 'update'),
  controller.update.bind(controller)
);

router.delete(
  '/:id',
  checkPermission('approval_workflows', 'delete'),
  controller.delete.bind(controller)
);

export default router;
