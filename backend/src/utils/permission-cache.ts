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
