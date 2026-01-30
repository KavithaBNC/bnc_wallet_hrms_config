import { Router } from 'express';
import { entityController } from '../controllers/entity.controller';
import { authenticate } from '../middlewares/auth';
import { enforceOrganizationAccess } from '../middlewares/rbac';

const router = Router();
router.use(authenticate);
router.use(enforceOrganizationAccess);

router.get('/', entityController.getByOrganization.bind(entityController));
router.post('/', entityController.create.bind(entityController));
export default router;
