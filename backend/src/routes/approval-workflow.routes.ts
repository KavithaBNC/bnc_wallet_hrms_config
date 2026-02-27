import { Router } from 'express';
import { ApprovalWorkflowController } from '../controllers/approval-workflow.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { enforceOrganizationAccess } from '../middlewares/rbac';

const router = Router();
const controller = new ApprovalWorkflowController();

router.use(authenticate);
router.use(enforceOrganizationAccess);

router.post(
  '/',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  controller.create.bind(controller)
);

router.get('/', controller.getAll.bind(controller));

router.get('/:id', controller.getById.bind(controller));

router.put(
  '/:id',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  controller.update.bind(controller)
);

router.delete(
  '/:id',
  authorize('SUPER_ADMIN', 'ORG_ADMIN'),
  controller.delete.bind(controller)
);

export default router;
