import { Router } from 'express';
import { organizationController } from '../controllers/organization.controller';
import { authenticate } from '../middlewares/auth';
import { checkPermission } from '../middlewares/permission';
import { validate } from '../middlewares/validate';
import { createOrganizationSchema, updateOrganizationSchema, addDeviceSchema } from '../utils/organization.validation';
import { createOrgAdminSchema } from '../utils/validation';

const router = Router();

/**
 * @route   POST /api/v1/organizations
 * @desc    Create new organization
 * @access  Private (SUPER_ADMIN only)
 */
router.post(
  '/',
  authenticate,
  checkPermission('organizations', 'create'),
  validate(createOrganizationSchema),
  organizationController.create.bind(organizationController)
);

// All routes below require authentication
router.use(authenticate);

/**
 * @route   GET /api/v1/organizations
 * @desc    Get all organizations
 * @access  Private (SUPER_ADMIN only)
 */
router.get(
  '/',
  checkPermission('organizations', 'read'),
  organizationController.getAll.bind(organizationController)
);

/**
 * @route   POST /api/v1/organizations/sync-shift-module
 * @desc    Backfill Time attendance & Shift Master for all orgs that have modules (fix ABC etc). Super Admin only.
 * @access  Private (SUPER_ADMIN only)
 */
router.post(
  '/sync-shift-module',
  checkPermission('organizations', 'update'),
  organizationController.syncShiftModule.bind(organizationController)
);

/**
 * @route   GET /api/v1/organizations/:id/modules
 * @desc    Get enabled modules for an organization (SAP-style per-org assignment)
 * @access  Private (SUPER_ADMIN for any org; ORG_ADMIN for own org only - enforce in controller if needed)
 */
router.get(
  '/:id/modules',
  organizationController.getModules.bind(organizationController)
);

/**
 * @route   PUT /api/v1/organizations/:id/modules
 * @desc    Set enabled modules for an organization (Super Admin only). Org Admin will only see these modules.
 * @access  Private (SUPER_ADMIN only)
 */
router.put(
  '/:id/modules',
  checkPermission('organizations', 'update'),
  organizationController.setModules.bind(organizationController)
);

/**
 * @route   GET /api/v1/organizations/:id
 * @desc    Get organization by ID
 * @access  Private (All authenticated users - including HRMS_ADMIN for org management)
 */
router.get(
  '/:id',
  organizationController.getById.bind(organizationController)
);

/**
 * @route   PUT /api/v1/organizations/:id
 * @desc    Update organization
 * @access  Private (SUPER_ADMIN, ORG_ADMIN)
 */
router.put(
  '/:id',
  checkPermission('organizations', 'update'),
  validate(updateOrganizationSchema),
  organizationController.update.bind(organizationController)
);

/**
 * @route   POST /api/v1/organizations/:id/logo
 * @desc    Update organization logo
 * @access  Private (SUPER_ADMIN, ORG_ADMIN)
 */
router.post(
  '/:id/logo',
  checkPermission('organizations', 'update'),
  organizationController.updateLogo.bind(organizationController)
);

/**
 * @route   POST /api/v1/organizations/:id/admins
 * @desc    Create organization admin user
 * @access  Private (SUPER_ADMIN only)
 */
router.post(
  '/:id/admins',
  checkPermission('organizations', 'create'),
  validate(createOrgAdminSchema),
  organizationController.createAdmin.bind(organizationController)
);

/**
 * @route   GET /api/v1/organizations/:id/statistics
 * @desc    Get organization statistics
 * @access  Private (SUPER_ADMIN, ORG_ADMIN, HR_MANAGER)
 */
router.get(
  '/:id/statistics',
  checkPermission('organizations', 'read'),
  organizationController.getStatistics.bind(organizationController)
);

/**
 * @route   GET /api/v1/organizations/:id/devices
 * @desc    Get biometric devices for an organization
 * @access  Private (SUPER_ADMIN only)
 */
router.get(
  '/:id/devices',
  checkPermission('organizations', 'read'),
  organizationController.getDevices.bind(organizationController)
);

/**
 * @route   POST /api/v1/organizations/:id/devices
 * @desc    Add a biometric device to an organization
 * @access  Private (SUPER_ADMIN only)
 */
router.post(
  '/:id/devices',
  checkPermission('organizations', 'create'),
  validate(addDeviceSchema),
  organizationController.addDevice.bind(organizationController)
);

export default router;
