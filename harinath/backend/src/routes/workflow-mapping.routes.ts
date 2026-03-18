import { Router } from 'express';
import { WorkflowMappingController } from '../controllers/workflow-mapping.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { enforceOrganizationAccess } from '../middlewares/rbac';

const router = Router();
const controller = new WorkflowMappingController();

// All routes require authentication
router.use(authenticate);
// Enforce organization access for non-SUPER_ADMIN users
router.use(enforceOrganizationAccess);

/**
 * @route   POST /api/v1/workflow-mappings
 * @desc    Create workflow mapping
 * @access  Private (SUPER_ADMIN, ORG_ADMIN, HR_MANAGER)
 */
router.post(
  '/',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  controller.create.bind(controller)
);

/**
 * @route   GET /api/v1/workflow-mappings
 * @desc    Get all workflow mappings
 * @access  Private (All authenticated users)
 */
router.get(
  '/',
  controller.getAll.bind(controller)
);

/**
 * @route   GET /api/v1/workflow-mappings/resolve
 * @desc    Resolve workflow for employee (rule-based)
 * @access  Private (All authenticated users)
 */
router.get(
  '/resolve',
  controller.resolve.bind(controller)
);

/**
 * @route   GET /api/v1/workflow-mappings/:id
 * @desc    Get workflow mapping by ID
 * @access  Private (All authenticated users)
 */
router.get(
  '/:id',
  controller.getById.bind(controller)
);

/**
 * @route   PUT /api/v1/workflow-mappings/:id
 * @desc    Update workflow mapping
 * @access  Private (SUPER_ADMIN, ORG_ADMIN, HR_MANAGER)
 */
router.put(
  '/:id',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  controller.update.bind(controller)
);

/**
 * @route   DELETE /api/v1/workflow-mappings/:id
 * @desc    Delete workflow mapping
 * @access  Private (SUPER_ADMIN, ORG_ADMIN)
 */
router.delete(
  '/:id',
  authorize('SUPER_ADMIN', 'ORG_ADMIN'),
  controller.delete.bind(controller)
);

export default router;
