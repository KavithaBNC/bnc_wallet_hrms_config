import { Router } from 'express';
import { compoundController } from '../controllers/compound.controller';
import { authenticate } from '../middlewares/auth';
import { enforceOrganizationAccess } from '../middlewares/rbac';

const router = Router();

router.use(authenticate);
router.use(enforceOrganizationAccess);

router.post('/', compoundController.create.bind(compoundController));
router.get('/', compoundController.getAll.bind(compoundController));
router.get('/:id', compoundController.getById.bind(compoundController));
router.put('/:id', compoundController.update.bind(compoundController));
router.delete('/:id', compoundController.delete.bind(compoundController));

export default router;
