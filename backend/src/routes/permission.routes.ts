import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth';
import { permissionController } from '../controllers/permission.controller';
import { rolePermissionController } from '../controllers/role-permission.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/v1/permissions
 * @desc    Create new permission
 * @access  Private (ORG_ADMIN, HR_MANAGER only)
 */
router.post(
  '/',
  authorize('ORG_ADMIN', 'HR_MANAGER'),
  permissionController.create.bind(permissionController)
);

/**
 * @route   GET /api/v1/permissions
 * @desc    Get all permissions
 * @access  Private (All authenticated users)
 */
router.get(
  '/',
  permissionController.getAll.bind(permissionController)
);

/**
 * @route   POST /api/v1/permissions/sync-app-modules
 * @desc    Ensure all app-module permissions exist (read/create/update). Super Admin only.
 * @access  Private (SUPER_ADMIN only)
 */
router.post(
  '/sync-app-modules',
  authorize('SUPER_ADMIN'),
  permissionController.syncAppModulePermissions.bind(permissionController)
);

/**
 * @route   GET /api/v1/permissions/:id
 * @desc    Get permission by ID
 * @access  Private (All authenticated users)
 */
router.get(
  '/:id',
  permissionController.getById.bind(permissionController)
);

/**
 * @route   PUT /api/v1/permissions/:id
 * @desc    Update permission
 * @access  Private (ORG_ADMIN, HR_MANAGER only)
 */
router.put(
  '/:id',
  authorize('ORG_ADMIN', 'HR_MANAGER'),
  permissionController.update.bind(permissionController)
);

/**
 * @route   DELETE /api/v1/permissions/:id
 * @desc    Delete permission
 * @access  Private (ORG_ADMIN, HR_MANAGER only)
 */
router.delete(
  '/:id',
  authorize('ORG_ADMIN', 'HR_MANAGER'),
  permissionController.delete.bind(permissionController)
);

/**
 * @route   GET /api/v1/permissions/resource/:resource
 * @desc    Get permissions by resource
 * @access  Private (All authenticated users)
 */
router.get(
  '/resource/:resource',
  permissionController.getByResource.bind(permissionController)
);

/**
 * @route   GET /api/v1/permissions/module/:module
 * @desc    Get permissions by module
 * @access  Private (All authenticated users)
 */
router.get(
  '/module/:module',
  permissionController.getByModule.bind(permissionController)
);

// ============================================================================
// ROLE PERMISSION ROUTES
// ============================================================================

/**
 * @route   POST /api/v1/permissions/role-permissions/assign
 * @desc    Assign permissions to a role
 * @access  Private (ORG_ADMIN, HR_MANAGER only)
 */
router.post(
  '/role-permissions/assign',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  rolePermissionController.assignPermissions.bind(rolePermissionController)
);

/**
 * @route   DELETE /api/v1/permissions/role-permissions/remove
 * @desc    Remove permission from a role
 * @access  Private (ORG_ADMIN, HR_MANAGER only)
 */
router.delete(
  '/role-permissions/remove',
  authorize('ORG_ADMIN', 'HR_MANAGER'),
  rolePermissionController.removePermission.bind(rolePermissionController)
);

/**
 * @route   GET /api/v1/permissions/role-permissions/:role
 * @desc    Get all permissions for a role
 * @access  Private (All authenticated users)
 */
router.get(
  '/role-permissions/:role',
  rolePermissionController.getRolePermissions.bind(rolePermissionController)
);

/**
 * @route   GET /api/v1/permissions/role-permissions/user/permissions
 * @desc    Get current user's permissions
 * @access  Private (All authenticated users)
 */
router.get(
  '/role-permissions/user/permissions',
  rolePermissionController.getUserPermissions.bind(rolePermissionController)
);

/**
 * @route   PUT /api/v1/permissions/role-permissions/:role/replace
 * @desc    Replace all permissions for a role
 * @access  Private (ORG_ADMIN, HR_MANAGER only)
 */
router.put(
  '/role-permissions/:role/replace',
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  rolePermissionController.replaceRolePermissions.bind(rolePermissionController)
);

/**
 * @route   POST /api/v1/permissions/role-permissions/check
 * @desc    Check if role has permission
 * @access  Private (All authenticated users)
 */
router.post(
  '/role-permissions/check',
  rolePermissionController.checkPermission.bind(rolePermissionController)
);

export default router;
