import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../store/authStore';
import permissionService from '../services/permission.service';

/**
 * Loads current user's permissions and exposes canView/canAdd/canEdit/canDelete per resource.
 * Use in pages to gate Add/Edit/Delete buttons and in-page actions.
 * Permissions are loaded from the backend for all roles (no hardcoded SUPER_ADMIN bypass —
 * backend returns full permissions for SUPER_ADMIN via the Config API).
 */
export function usePermissions() {
  const { user } = useAuthStore();
  const [permissionKeys, setPermissionKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPermissionKeys(new Set());
      setLoading(false);
      return;
    }
    setLoading(true);
    permissionService
      .getUserPermissions()
      .then((perms) => {
        const keys = new Set(perms.map((p) => `${p.resource}.${p.action}`));
        // If no permissions returned and user has a high-level role, grant wildcard
        // (backward compat: backend SUPER_ADMIN bypass means DB permissions may not exist)
        if (keys.size === 0 && user.role === 'SUPER_ADMIN') {
          setPermissionKeys(new Set(['*']));
        } else {
          setPermissionKeys(keys);
        }
      })
      .catch(() => {
        // On error, grant wildcard for SUPER_ADMIN to preserve backward compat
        if (user.role === 'SUPER_ADMIN') {
          setPermissionKeys(new Set(['*']));
        } else {
          setPermissionKeys(new Set());
        }
      })
      .finally(() => setLoading(false));
  }, [user?.id, user?.role]);

  return useMemo(() => {
    const has = (resource: string, action: string): boolean =>
      permissionKeys.has('*') || permissionKeys.has(`${resource}.${action}`);

    return {
      loading,
      canView: (resource: string) => has(resource, 'read'),
      canAdd: (resource: string) => has(resource, 'create'),
      canEdit: (resource: string) => has(resource, 'update'),
      canDelete: (resource: string) => has(resource, 'delete'),
      has: (resource: string, action: string) => has(resource, action),
    };
  }, [permissionKeys, loading]);
}
