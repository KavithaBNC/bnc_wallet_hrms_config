import { Router } from 'express';
import { PostToPayrollController } from '../controllers/post-to-payroll.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { enforceOrganizationAccess } from '../middlewares/rbac';

const router = Router();
const controller = new PostToPayrollController();

router.use(authenticate);
router.use(enforceOrganizationAccess);

router.get('/', controller.getAll.bind(controller));

router.post(
  '/save',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  controller.saveAll.bind(controller)
);

export default router;
