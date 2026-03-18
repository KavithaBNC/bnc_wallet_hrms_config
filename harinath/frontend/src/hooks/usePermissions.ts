import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../store/authStore';
import permissionService from '../services/permission.service';

/**
 * Loads current user's permissions and exposes canView/canAdd/canEdit/canDelete per resource.
 * Use in pages to gate Add/Edit/Delete buttons and in-page actions.
 * Only Super Admin has all permissions by default; Org Admin and HR Manager use assigned permissions.
 */
export function usePermissions() {
  const { user } = useAuthStore();
  const [permissionKeys, setPermissionKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  useEffect(() => {
    if (!user) {
      setPermissionKeys(new Set());
      setLoading(false);
      return;
    }
    if (isSuperAdmin) {
      setPermissionKeys(new Set(['*']));
      setLoading(false);
      return;
    }
    setLoading(true);
    permissionService
      .getUserPermissions()
      .then((perms) => {
        const keys = new Set(perms.map((p) => `${p.resource}.${p.action}`));
        setPermissionKeys(keys);
      })
      .catch(() => setPermissionKeys(new Set()))
      .finally(() => setLoading(false));
  }, [user?.id, user?.role, isSuperAdmin]);

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
