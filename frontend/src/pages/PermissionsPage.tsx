import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import permissionService, { Permission, RolePermission } from '../services/permission.service';
import AppHeader from '../components/layout/AppHeader';
import {
  getModulesForPermissionScreen,
  PERMISSION_SCREEN_ACTIONS,
  PERMISSION_SCREEN_ACTION_LABELS,
  type PermissionScreenAction,
} from '../config/modules';

type UserRole = 'SUPER_ADMIN' | 'ORG_ADMIN' | 'HR_MANAGER' | 'MANAGER' | 'EMPLOYEE';

const ROLES_FOR_ASSIGNMENT: UserRole[] = ['ORG_ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE'];

const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  ORG_ADMIN: 'Org Admin',
  HR_MANAGER: 'HR Manager',
  MANAGER: 'Manager',
  EMPLOYEE: 'Employee',
};

const PermissionsPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [loadingRolePerms, setLoadingRolePerms] = useState(false);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [rolesDropdownOpen, setRolesDropdownOpen] = useState(false);

  const roleUpper = user?.role != null ? String(user.role).toUpperCase() : '';
  const canManagePermissions = roleUpper === 'SUPER_ADMIN' || roleUpper === 'ORG_ADMIN';
  const isSuperAdmin = roleUpper === 'SUPER_ADMIN';

  const modules = useMemo(() => getModulesForPermissionScreen(), []);

  /** Map (resource.action) -> Permission for View/Add/Edit only (no Delete). */
  const permissionByKey = useMemo(() => {
    const map: Record<string, Permission> = {};
    const resources = new Set(modules.map((m) => m.resource));
    for (const p of permissions) {
      if (
        resources.has(p.resource) &&
        (PERMISSION_SCREEN_ACTIONS as readonly string[]).includes(p.action)
      ) {
        map[`${p.resource}.${p.action}`] = p;
      }
    }
    return map;
  }, [permissions, modules]);


  useEffect(() => {
    const init = async () => {
      if (isSuperAdmin) {
        try {
          await permissionService.syncAppModulePermissions();
        } catch (e) {
          console.warn('Sync app modules:', e);
        }
      }
      await loadPermissions();
    };
    init();
  }, [isSuperAdmin]);

  useEffect(() => {
    if (selectedRoles.length > 0) {
      loadRolePermissions();
    } else {
      setSelectedPermissionIds([]);
      setRolePermissions([]);
    }
  }, [selectedRoles.join(',')]);

  const loadPermissions = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await permissionService.getAll({ limit: '500' });
      setPermissions(result.permissions);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load permissions');
      console.error('Error loading permissions:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadRolePermissions = async () => {
    if (selectedRoles.length === 0) return;
    try {
      setLoadingRolePerms(true);
      const firstRole = selectedRoles[0];
      const perms = await permissionService.getRolePermissions(firstRole);
      setRolePermissions(perms);
      // All roles (Org Admin, HR Manager, Manager, Employee): show only what is assigned
      const ids = perms
        .filter((rp) =>
          (PERMISSION_SCREEN_ACTIONS as readonly string[]).includes(rp.permission.action)
        )
        .map((rp) => rp.permission.id);
      setSelectedPermissionIds(ids);
    } catch (err: any) {
      console.error('Error loading role permissions:', err);
      setSelectedPermissionIds([]);
    } finally {
      setLoadingRolePerms(false);
    }
  };

  const getPermissionId = (resource: string, action: PermissionScreenAction): string | null => {
    return permissionByKey[`${resource}.${action}`]?.id ?? null;
  };

  const isChecked = (resource: string, action: PermissionScreenAction): boolean => {
    const id = getPermissionId(resource, action);
    return id != null && selectedPermissionIds.includes(id);
  };

  const toggle = (resource: string, action: PermissionScreenAction) => {
    const id = getPermissionId(resource, action);
    if (id == null) return;
    setSelectedPermissionIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSyncPermissions = async () => {
    if (!isSuperAdmin) return;
    try {
      setSyncing(true);
      setError(null);
      const result = await permissionService.syncAppModulePermissions();
      await loadPermissions();
      if (selectedRoles.length > 0) await loadRolePermissions();
      alert(result.created > 0 ? `Created ${result.created} permission(s). All checkboxes should now be clickable.` : 'All permissions already exist.');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to sync permissions');
    } finally {
      setSyncing(false);
    }
  };

  const toggleRole = (role: UserRole) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const handleSave = async () => {
    if (selectedRoles.length === 0) {
      setError('Please select at least one role.');
      return;
    }
    try {
      setSaving(true);
      setError(null);
      let totalAssigned = 0;
      let totalRemoved = 0;
      for (const role of selectedRoles) {
        // All roles get only the checkboxes Super Admin selects (no automatic full access)
        const result = await permissionService.replaceRolePermissions(role, selectedPermissionIds);
        totalAssigned += result.assigned;
        totalRemoved += result.removed;
      }
      alert(
        `Permissions applied to ${selectedRoles.length} role(s): ${totalAssigned} assigned, ${totalRemoved} removed.`
      );
      await loadRolePermissions();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save permissions');
      console.error('Error saving permissions:', err);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setRolesDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!canManagePermissions) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
          <p className="text-gray-600">
            Module Permission is visible only to Super Admin and Org Admin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader
        title="Module Permission"
        subtitle="Assign View, Add, Edit per module for each role"
        onLogout={handleLogout}
      />

      <main className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Role selection: multi-select dropdown */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Select role(s)</h2>
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setRolesDropdownOpen((o) => !o)}
              className="w-full sm:w-80 flex items-center justify-between gap-2 px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-left text-sm font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <span className="truncate">
                {selectedRoles.length === 0
                  ? 'Select roles...'
                  : selectedRoles.map((r) => ROLE_LABELS[r]).join(', ')}
              </span>
              <svg
                className={`w-5 h-5 text-gray-400 flex-shrink-0 ${rolesDropdownOpen ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {rolesDropdownOpen && (
              <div className="absolute z-10 mt-1 w-full sm:w-80 rounded-lg border border-gray-200 bg-white shadow-lg py-1">
                {ROLES_FOR_ASSIGNMENT.map((role) => {
                  const selected = selectedRoles.includes(role);
                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => toggleRole(role)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm font-medium transition ${
                        selected
                          ? 'bg-blue-50 text-blue-800'
                          : 'text-gray-900 hover:bg-gray-50'
                      }`}
                    >
                      {selected && (
                        <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                      <span className={selected ? 'font-semibold' : ''}>{ROLE_LABELS[role]}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-3">
            Super Admin has all permissions by default and cannot be restricted. Access for Org Admin,
            HR Manager, Manager, and Employee is based only on the checkboxes you select below.
          </p>
        </div>

        {/* Module Permission table: MODULE | View | Add | Edit (no Delete) */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-lg font-semibold text-gray-900">
              {selectedRoles.length === 0
                ? 'Select role(s) above'
                : `Permissions for ${selectedRoles.map((r) => ROLE_LABELS[r]).join(', ')}`}
            </h2>
            {loadingRolePerms ? (
              <span className="text-sm text-gray-500">Loading...</span>
            ) : (
              <button
                onClick={handleSave}
                disabled={saving || selectedRoles.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {saving ? 'Saving...' : 'Apply to selected roles'}
              </button>
            )}
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading permissions...</div>
          ) : (
            <>
              {isSuperAdmin && (
                <div className="px-6 py-2 border-b border-gray-200 bg-gray-50 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSyncPermissions}
                    disabled={syncing}
                    className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
                  >
                    {syncing ? 'Syncing...' : 'Sync permissions (make all checkboxes clickable)'}
                  </button>
                  <span className="text-xs text-gray-500">
                    Run this if any checkbox is disabled or not clickable.
                  </span>
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        MODULE
                      </th>
                      {PERMISSION_SCREEN_ACTIONS.map((action) => (
                        <th
                          key={action}
                          className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider"
                        >
                          {PERMISSION_SCREEN_ACTION_LABELS[action]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {modules.map((mod) => (
                      <tr key={mod.path} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {mod.label}
                        </td>
                        {PERMISSION_SCREEN_ACTIONS.map((action) => {
                          const id = getPermissionId(mod.resource, action);
                          const checked = id != null && selectedPermissionIds.includes(id);
                          const noPermission = id == null;
                          return (
                            <td
                              key={action}
                              className="px-6 py-4 whitespace-nowrap text-center"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={noPermission}
                                onChange={() => toggle(mod.resource, action)}
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                title={
                                  noPermission
                                    ? 'Click "Sync permissions" above to enable'
                                    : `${PERMISSION_SCREEN_ACTION_LABELS[action]} ${mod.label}`
                                }
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default PermissionsPage;
