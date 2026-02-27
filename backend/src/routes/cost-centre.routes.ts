import { Router } from 'express';
import { costCentreController } from '../controllers/cost-centre.controller';
import { authenticate } from '../middlewares/auth';
import { enforceOrganizationAccess } from '../middlewares/rbac';

const router = Router();
router.use(authenticate);
router.use(enforceOrganizationAccess);

router.get('/', costCentreController.getByOrganization.bind(costCentreController));
export default router;
