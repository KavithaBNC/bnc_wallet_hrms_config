import { Router } from 'express';
import { subDepartmentController } from '../controllers/sub-department.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { enforceOrganizationAccess } from '../middlewares/rbac';

const router = Router();
router.use(authenticate);
router.use(enforceOrganizationAccess);

router.get('/', subDepartmentController.getByOrganization.bind(subDepartmentController));
router.get('/list', subDepartmentController.getByOrganization.bind(subDepartmentController));
router.post('/', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'), subDepartmentController.create.bind(subDepartmentController));

export default router;
