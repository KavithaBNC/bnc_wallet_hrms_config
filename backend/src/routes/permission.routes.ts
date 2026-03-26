import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate } from '../middlewares/auth';
import { checkPermission } from '../middlewares/permission';
import { permissionController } from '../controllers/permission.controller';
import { rolePermissionController } from '../controllers/role-permission.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/v1/permissions/roles
 * @desc    List all user roles (for searchable dropdown)
 * @access  Private (All authenticated users)
 */
router.get('/roles', (req, res) => {
  const search = ((req.query.search as string) || '').trim().toLowerCase();
  const roles = Object.values(UserRole).map((value) => ({
    value,
    label: value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
  }));
  const filtered = search
    ? roles.filter((r) => r.label.toLowerCase().includes(search) || r.value.toLowerCase().includes(search))
    : roles;
  return res.status(200).json({ status: 'success', data: { roles: filtered } });
});

/**
 * @route   POST /api/v1/permissions
 * @desc    Create new permission
 * @access  Private (dynamic permission: permissions.create)
 */
router.post(
  '/',
  checkPermission('permissions', 'create'),
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
 * @access  Private (SUPER_ADMIN only — this is a system-level operation)
 */
router.post(
  '/sync-app-modules',
  checkPermission('permissions', 'create'),
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
 * @access  Private (dynamic permission: permissions.update)
 */
router.put(
  '/:id',
  checkPermission('permissions', 'update'),
  permissionController.update.bind(permissionController)
);

/**
 * @route   DELETE /api/v1/permissions/:id
 * @desc    Delete permission
 * @access  Private (dynamic permission: permissions.update)
 */
router.delete(
  '/:id',
  checkPermission('permissions', 'update'),
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
 * @access  Private (dynamic permission: permissions.update)
 */
router.post(
  '/role-permissions/assign',
  checkPermission('permissions', 'update'),
  rolePermissionController.assignPermissions.bind(rolePermissionController)
);

/**
 * @route   DELETE /api/v1/permissions/role-permissions/remove
 * @desc    Remove permission from a role
 * @access  Private (dynamic permission: permissions.update)
 */
router.delete(
  '/role-permissions/remove',
  checkPermission('permissions', 'update'),
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
 * @access  Private (dynamic permission: permissions.update)
 */
router.put(
  '/role-permissions/:role/replace',
  checkPermission('permissions', 'update'),
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
