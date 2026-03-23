import { Router } from 'express';
import { paygroupController } from '../controllers/paygroup.controller';
import { authenticate } from '../middlewares/auth';
import { checkPermission } from '../middlewares/permission';
import { enforceOrganizationAccess } from '../middlewares/rbac';
import { validate, validateQuery } from '../middlewares/validate';
import { queryPaygroupsSchema, createPaygroupSchema } from '../utils/paygroup.validation';

const router = Router();

router.use(authenticate);
router.use(enforceOrganizationAccess);

/**
 * @route   GET /api/v1/paygroups
 * @desc    Get all paygroups for an organization (for Associate create popup)
 * @access  Private
 */
router.get(
  '/',
  validateQuery(queryPaygroupsSchema),
  paygroupController.getAll.bind(paygroupController)
);

/**
 * @route   POST /api/v1/paygroups
 * @desc    Create new paygroup
 * @access  Private (SUPER_ADMIN, ORG_ADMIN, HR_MANAGER)
 */
router.post(
  '/',
  checkPermission('paygroups', 'create'),
  validate(createPaygroupSchema),
  paygroupController.create.bind(paygroupController)
);

/**
 * @route   GET /api/v1/paygroups/:id
 * @desc    Get paygroup by ID
 * @access  Private
 */
router.get(
  '/:id',
  paygroupController.getById.bind(paygroupController)
);

export default router;
