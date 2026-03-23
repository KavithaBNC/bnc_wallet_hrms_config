import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { checkPermission } from '../middlewares/permission';
import { enforceOrganizationAccess } from '../middlewares/rbac';
import { shiftAssignmentRuleController } from '../controllers/shift-assignment-rule.controller';

const router = Router();

router.use(authenticate);
router.use(enforceOrganizationAccess);

router.post(
  '/',
  checkPermission('shift_assignment_rules', 'create'),
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
  checkPermission('shift_assignment_rules', 'update'),
  shiftAssignmentRuleController.update.bind(shiftAssignmentRuleController)
);

router.delete(
  '/:id',
  checkPermission('shift_assignment_rules', 'delete'),
  shiftAssignmentRuleController.delete.bind(shiftAssignmentRuleController)
);

export default router;
