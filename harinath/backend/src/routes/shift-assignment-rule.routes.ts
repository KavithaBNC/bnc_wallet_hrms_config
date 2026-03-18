import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth';
import { enforceOrganizationAccess } from '../middlewares/rbac';
import { shiftAssignmentRuleController } from '../controllers/shift-assignment-rule.controller';

const router = Router();

router.use(authenticate);
router.use(enforceOrganizationAccess);

router.post(
  '/',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  shiftAssignmentRuleController.create.bind(shiftAssignmentRuleController)
);

router.get(
  '/',
  shiftAssignmentRuleController.getAll.bind(shiftAssignmentRuleController)
);

router.get(
  '/:id',
  shiftAssignmentRuleController.getById.bind(shiftAssignmentRuleController)
);

router.put(
  '/:id',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  shiftAssignmentRuleController.update.bind(shiftAssignmentRuleController)
);

router.delete(
  '/:id',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  shiftAssignmentRuleController.delete.bind(shiftAssignmentRuleController)
);

export default router;
