/**
 * In-memory cache for Configurator module permissions.
 * Populated at login time from POST /api/v1/user-role-modules/project.
 * Read by checkPermission() middleware on every request.
 */

export interface ModulePermissions {
  is_enabled: boolean;
  can_view: boolean;
  can_add: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

// Map<userId, Record<pagePath, ModulePermissions>>
const permissionCache = new Map<string, Record<string, ModulePermissions>>();

export function setUserPermissions(userId: string, permissions: Record<string, ModulePermissions>): void {
  permissionCache.set(userId, permissions);
}

export function getUserPermissions(userId: string): Record<string, ModulePermissions> | undefined {
  return permissionCache.get(userId);
}

export function clearUserPermissions(userId: string): void {
  permissionCache.delete(userId);
}

/**
 * Check if a user has a specific permission on a module page path.
 * Used by services/controllers for data scoping instead of hardcoded role checks.
 * @param userId - HRMS user ID
 * @param pagePath - Configurator page path (e.g. '/attendance', '/employees')
 * @param flag - Permission flag to check ('can_view', 'can_add', 'can_edit', 'can_delete')
 * @returns true if user has the permission, false otherwise
 */
export function userHasPermission(
  userId: string,
  pagePath: string,
  flag: keyof ModulePermissions
): boolean {
  const perms = permissionCache.get(userId);
  if (!perms) return false;
  const modulePerm = perms[pagePath];
  return !!(modulePerm?.is_enabled && modulePerm[flag]);
}
