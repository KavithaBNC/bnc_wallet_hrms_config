import { Router } from 'express';
import { costCentreController } from '../controllers/cost-centre.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { enforceOrganizationAccess } from '../middlewares/rbac';

const router = Router();
router.use(authenticate);
router.use(enforceOrganizationAccess);

router.get('/', costCentreController.getByOrganization.bind(costCentreController));
router.get('/list', costCentreController.getByOrganization.bind(costCentreController));
router.post('/', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'), costCentreController.create.bind(costCentreController));
export default router;
