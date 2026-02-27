import { Router } from 'express';
import { rulesEngineController } from '../controllers/rules-engine.controller';
import { authenticate } from '../middlewares/auth';
import { enforceOrganizationAccess } from '../middlewares/rbac';

const router = Router();

router.use(authenticate);
router.use(enforceOrganizationAccess);

router.get('/', rulesEngineController.getRules.bind(rulesEngineController));
router.put('/', rulesEngineController.saveRules.bind(rulesEngineController));

export default router;
