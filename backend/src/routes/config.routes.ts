import { Router } from 'express';
import { ConfigController } from '../controllers/config.controller';
import { authenticate } from '../middlewares/auth';
import { enforceOrganizationAccess } from '../middlewares/rbac';

const router = Router();
const controller = new ConfigController();

router.use(authenticate);
router.use(enforceOrganizationAccess);

router.get('/workflow-approval-options', controller.getWorkflowApprovalOptions.bind(controller));

export default router;
