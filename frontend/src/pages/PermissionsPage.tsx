import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import permissionService, { Permission, RolePermission } from '../services/permission.service';
import AppHeader from '../components/layout/AppHeader';
import organizationService, { Organization } from '../services/organization.service';
import {
  getModulesForPermissionScreen,
  PERMISSION_SCREEN_ACTIONS,
  PERMISSION_SCREEN_ACTION_LABELS,
  type PermissionScreenAction,
} from '../config/modules';

type UserRole = 'SUPER_ADMIN' | 'ORG_ADMIN' | 'HR_MANAGER' | 'MANAGER' | 'EMPLOYEE';

const ROLES_FOR_ASSIGNMENT_SUPER_ADMIN: UserRole[] = ['ORG_ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE'];
const ROLES_FOR_ASSIGNMENT_ORG_ADMIN: UserRole[] = ['HR_MANAGER', 'MANAGER', 'EMPLOYEE'];

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
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [loadingRolePerms, setLoadingRolePerms] = useState(false);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncingShiftModule, setSyncingShiftModule] = useState(false);
  const [rolesDropdownOpen, setRolesDropdownOpen] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);
  const orgDropdownRef = useRef<HTMLDivElement>(null);

  const roleUpper = user?.role != null ? String(user.role).toUpperCase() : '';
  const canManagePermissions = roleUpper === 'SUPER_ADMIN' || roleUpper === 'ORG_ADMIN';
  const isSuperAdmin = roleUpper === 'SUPER_ADMIN';
  const isOrgAdmin = roleUpper === 'ORG_ADMIN';
  const userOrgId = user?.employee?.organizationId ?? user?.employee?.organization?.id;
  const effectiveOrgId = isSuperAdmin ? selectedOrgId : userOrgId;

  const [orgEnabledResources, setOrgEnabledResources] = useState<string[]>([]);
  const [orgModulesLoaded, setOrgModulesLoaded] = useState(false);
  const allModules = useMemo(() => getModulesForPermissionScreen(), []);
  const modules = useMemo(() => {
    if (isSuperAdmin) return allModules;
    if (isOrgAdmin) {
      return allModules.filter((m) => orgEnabledResources.includes(m.resource));
    }
    return allModules;
  }, [isSuperAdmin, isOrgAdmin, orgEnabledResources, allModules]);

  const ROLES_FOR_ASSIGNMENT = isSuperAdmin ? ROLES_FOR_ASSIGNMENT_SUPER_ADMIN : ROLES_FOR_ASSIGNMENT_ORG_ADMIN;

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
        try {
          const res = await organizationService.getAll(1, 500);
          setOrganizations(res.organizations);
        } catch (e) {
          console.warn('Load organizations:', e);
          setOrganizations([]);
        }
      }
      if (isOrgAdmin) {
        if (userOrgId) {
          try {
            const list = await organizationService.getModules(userOrgId);
            setOrgEnabledResources(list);
          } catch (e) {
            console.warn('Load org modules:', e);
            setOrgEnabledResources([]);
          }
        }
        setOrgModulesLoaded(true);
      } else if (isSuperAdmin) {
        setOrgModulesLoaded(true);
      }
      await loadPermissions();
    };
    init();
  }, [isSuperAdmin, isOrgAdmin, userOrgId]);

  useEffect(() => {
    if (!selectedRole) {
      setSelectedPermissionIds([]);
      setRolePermissions([]);
      return;
    }
    // Org Admin: wait for org modules to be loaded so we filter pre-selection correctly
    if (isOrgAdmin && !orgModulesLoaded) return;
    loadRolePermissions();
  }, [selectedRole, effectiveOrgId ?? '', orgEnabledResources, isOrgAdmin, orgModulesLoaded]);

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
    if (!selectedRole) return;
    try {
      setLoadingRolePerms(true);
      const perms = await permissionService.getRolePermissions(
        selectedRole,
        effectiveOrgId ?? undefined
      );
      setRolePermissions(perms);
      // For Org Admin: only pre-select permissions for modules enabled for their org, so Save never sends "forbidden" IDs
      const ids = perms
        .filter((rp) => {
          if (!(PERMISSION_SCREEN_ACTIONS as readonly string[]).includes(rp.permission.action)) return false;
          if (isOrgAdmin && orgEnabledResources.length > 0 && !orgEnabledResources.includes(rp.permission.resource)) return false;
          return true;
        })
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
      if (selectedRole) await loadRolePermissions();
      alert(result.created > 0 ? `Created ${result.created} permission(s). All checkboxes should now be clickable.` : 'All permissions already exist.');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to sync permissions');
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncShiftModule = async () => {
    if (!isSuperAdmin) return;
    try {
      setSyncingShiftModule(true);
      setError(null);
      const result = await organizationService.syncShiftModule();
      alert(
        result.updated > 0
          ? `Done. Updated ${result.updated} organization(s). Orgs with no modules (e.g. ABC) now have full menus; others got Time attendance & Shift. Log in as Org Admin or HR (e.g. Deepa) to see menus.`
          : 'All organizations already have the shift module.'
      );
      if (selectedRole) await loadRolePermissions();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Sync shift module failed');
    } finally {
      setSyncingShiftModule(false);
    }
  };

  const selectRole = (role: UserRole) => {
    if (selectedRole === role) {
      setSelectedRole(null);
      setSelectedOrgId(null);
      setSelectedPermissionIds([]);
      setRolePermissions([]);
    } else {
      setSelectedRole(role);
      if (role !== 'ORG_ADMIN') {
        setSelectedOrgId(null);
      }
    }
  };

  const handleSave = async () => {
    if (!selectedRole) {
      setError('Please select a role.');
      return;
    }
    if (isOrgAdmin && !userOrgId) {
      setError('Your organization could not be determined. Please contact support.');
      return;
    }
    if (isSuperAdmin && selectedRole === 'ORG_ADMIN' && !effectiveOrgId) {
      setError('Please select an organization for Org Admin.');
      return;
    }
    try {
      setSaving(true);
      setError(null);
      const organizationId = effectiveOrgId ?? undefined;
      // Org Admin: only send permission IDs for resources enabled for their org (backend enforces same rule)
      let idsToSend = selectedPermissionIds;
      if (isOrgAdmin) {
        const allowedSet =
          orgEnabledResources.length > 0
            ? new Set(orgEnabledResources)
            : new Set(['transfer_promotions', 'transfer_promotion_entry']); // backend allows these even when org has no modules
        const idToResource: Record<string, string> = {};
        for (const p of permissions) idToResource[p.id] = p.resource;
        idsToSend = selectedPermissionIds.filter((id) => allowedSet.has(idToResource[id] ?? ''));
      }
      const result = await permissionService.replaceRolePermissions(
        selectedRole,
        idsToSend,
        organizationId
      );
      alert(
        `Permissions applied to ${ROLE_LABELS[selectedRole]}: ${result.assigned} assigned, ${result.removed} removed.`
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
      if (orgDropdownRef.current && !orgDropdownRef.current.contains(e.target as Node)) {
        setOrgDropdownOpen(false);
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

        {/* Org Admin: show their assigned modules (read-only) */}
        {isOrgAdmin && (
          <div className="bg-white rounded-lg shadow p-6 mb-6 border-l-4 border-blue-500">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Your assigned modules</h2>
            <p className="text-sm text-gray-500 mb-4">
              These are the modules Super Admin has enabled for your organization. You can access these in the sidebar and assign permissions for them to HR Manager, Manager, and Employee below.
            </p>
            {!orgEnabledResources.includes('shifts') && orgEnabledResources.length > 0 && (
              <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm font-medium text-amber-800">Time attendance & Shift Master not showing?</p>
                <p className="text-sm text-amber-700 mt-1">
                  Super Admin must enable them for your organization: go to <strong>Organization Management</strong> → click <strong>Sync shift module for all orgs</strong>, or open your org → <strong>Assign modules</strong> → check <strong>Time attendance</strong> / <strong>Shift Master</strong> → Save. Then refresh this page.
                </p>
              </div>
            )}
            {orgEnabledResources.length === 0 ? (
              <p className="text-sm text-amber-700">No modules assigned yet. Ask Super Admin to assign modules to your organization in Organization Management.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {modules.map((mod) => (
                  <span
                    key={mod.path}
                    className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-blue-50 text-blue-800 border border-blue-200"
                  >
                    {mod.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* All dropdowns in one row */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex flex-wrap items-end gap-4 sm:gap-6">
            {/* Select role(s) */}
            <div className="flex-1 min-w-[200px] sm:min-w-[240px]">
              <label className="block text-sm font-semibold text-gray-900 mb-2">Select role</label>
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setRolesDropdownOpen((o) => !o)}
                  className="w-full flex items-center justify-between gap-2 px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-left text-sm font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <span className="truncate">
                    {selectedRole ? ROLE_LABELS[selectedRole] : 'Select role...'}
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
                  <div className="absolute z-10 mt-1 left-0 right-0 min-w-[200px] rounded-lg border border-gray-200 bg-white shadow-lg py-1">
                    {ROLES_FOR_ASSIGNMENT.map((role) => {
                      const selected = selectedRole === role;
                      return (
                        <button
                          key={role}
                          type="button"
                          onClick={() => selectRole(role)}
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
            </div>

            {/* Select organization - only when Org Admin is selected (Super Admin) */}
            {isSuperAdmin && selectedRole === 'ORG_ADMIN' && (
              <div className="flex-1 min-w-[200px] sm:min-w-[240px]">
                <label className="block text-sm font-semibold text-gray-900 mb-2">Select organization</label>
                <div className="relative" ref={orgDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setOrgDropdownOpen((o) => !o)}
                    className="w-full flex items-center justify-between gap-2 px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-left text-sm font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <span className="truncate">
                      {selectedOrgId
                        ? organizations.find((o) => o.id === selectedOrgId)?.name ?? selectedOrgId
                        : 'Select organization...'}
                    </span>
                    <svg
                      className={`w-5 h-5 text-gray-400 flex-shrink-0 ${orgDropdownOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {orgDropdownOpen && (
                    <div className="absolute z-10 mt-1 left-0 right-0 min-w-[200px] rounded-lg border border-gray-200 bg-white shadow-lg py-1 max-h-60 overflow-y-auto">
                      {organizations.map((org) => (
                        <button
                          key={org.id}
                          type="button"
                          onClick={() => {
                            setSelectedOrgId(org.id);
                            setOrgDropdownOpen(false);
                            setSelectedPermissionIds([]);
                            setRolePermissions([]);
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm font-medium transition ${
                            selectedOrgId === org.id ? 'bg-blue-50 text-blue-800' : 'text-gray-900 hover:bg-gray-50'
                          }`}
                        >
                          {selectedOrgId === org.id && (
                            <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                          <span className={selectedOrgId === org.id ? 'font-semibold' : ''}>{org.name}</span>
                        </button>
                      ))}
                      {organizations.length === 0 && (
                        <p className="px-4 py-3 text-sm text-gray-500">No organizations found.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Sync shift module for all orgs - Super Admin only, in Module Permission flow */}
            {isSuperAdmin && (
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleSyncShiftModule}
                  disabled={syncingShiftModule}
                  className="px-4 py-2.5 rounded-lg text-sm font-medium bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  title="Add Time attendance & Shift Master to all orgs; fix orgs like ABC so HR sees menus"
                >
                  {syncingShiftModule ? 'Syncing...' : 'Sync shift module for all orgs'}
                </button>
              </div>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-4">
            {isSuperAdmin
              ? 'Select one role. If you select Org Admin, choose an organization. Then set View/Add/Edit per module below.'
              : 'You can assign module permissions only to HR Manager, Manager, and Employee, and only within the modules enabled for your organization.'}
          </p>
        </div>

        {/* Module Permission table: MODULE | View | Add | Edit (no Delete) */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-lg font-semibold text-gray-900">
              {!selectedRole
                ? 'Select role above'
                : `Permissions for ${ROLE_LABELS[selectedRole]}${isSuperAdmin && selectedOrgId ? ` (${organizations.find((o) => o.id === selectedOrgId)?.name ?? 'org'})` : ''}`}
            </h2>
            {loadingRolePerms ? (
              <span className="text-sm text-gray-500">Loading...</span>
            ) : (
              <button
                onClick={handleSave}
                disabled={saving || !selectedRole || (isOrgAdmin && !userOrgId) || (isSuperAdmin && selectedRole === 'ORG_ADMIN' && !effectiveOrgId)}
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
