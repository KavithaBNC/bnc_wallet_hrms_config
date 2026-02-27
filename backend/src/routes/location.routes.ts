import { Router } from 'express';
import { locationController } from '../controllers/location.controller';
import { authenticate } from '../middlewares/auth';
import { enforceOrganizationAccess } from '../middlewares/rbac';

const router = Router();
router.use(authenticate);
router.use(enforceOrganizationAccess);

router.get('/', locationController.list.bind(locationController));
router.post('/', locationController.create.bind(locationController));
export default router;
