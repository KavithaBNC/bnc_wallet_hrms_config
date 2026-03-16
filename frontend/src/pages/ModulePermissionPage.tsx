import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';
import userRoleModuleService, { RoleModule } from '../services/userRoleModule.service';

interface GroupedModule {
  parentSlug: string;
  parentLabel: string;
  children: RoleModule[];
}

/** Convert slug to Title Case: "time-attendance" → "Time Attendance" */
const slugToLabel = (slug: string) =>
  slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Parse page_name to extract parent slug.
 * "/time-attendance/associate-shift-change" → "time-attendance"
 * "/employees" → null (top-level)
 */
const getParentSlug = (pageName: string | undefined): string | null => {
  if (!pageName) return null;
  const segments = pageName.replace(/^\//, '').split('/').filter(Boolean);
  if (segments.length >= 2) return segments[0];
  return null;
};

/**
 * Get a readable display name for a module.
 * Priority: module_name (if not empty/path) → derive from page_name last segment → fallback slug
 */
const getModuleDisplayName = (mod: RoleModule): string => {
  // If module_name exists and is not a path (doesn't start with /)
  if (mod.module_name && !mod.module_name.startsWith('/') && mod.module_name.trim() !== '') {
    return mod.module_name;
  }
  // Derive from page_name
  if (mod.page_name) {
    const segments = mod.page_name.replace(/^\//, '').split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1];
    if (lastSegment) return slugToLabel(lastSegment);
  }
  // Fallback
  return mod.module_name || 'Unknown Module';
};

export default function ModulePermissionPage() {
  const { roleId } = useParams<{ roleId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuthStore();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const roleName = (location.state as any)?.roleName || `Role #${roleId}`;
  const numericRoleId = Number(roleId);

  const [modules, setModules] = useState<RoleModule[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!numericRoleId) return;
    fetchModules();
  }, [numericRoleId]);

  const fetchModules = async () => {
    setLoading(true);
    setError(null);
    try {
      const [moduleNames, rolePermissions] = await Promise.all([
        userRoleModuleService.getModuleNames(),
        userRoleModuleService.getRolePermissions(numericRoleId),
      ]);

      // Build permission map from selected role's response (keyed by module_id)
      const permMap = new Map<number, RoleModule>();
      rolePermissions.forEach((p) => permMap.set(p.module_id, p));

      // Merge: module names from login role, checkbox values from selected role
      const merged = moduleNames.map((m) => {
        const perm = permMap.get(m.module_id);
        const updated: RoleModule = {
          ...m,
          is_enabled: perm?.is_enabled ?? false,
          can_view: perm?.can_view ?? false,
          can_add: perm?.can_add ?? false,
          can_edit: perm?.can_edit ?? false,
          can_delete: perm?.can_delete ?? false,
        };
        return updated;
      });

      setModules(merged);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to fetch modules');
    } finally {
      setLoading(false);
    }
  };

  // Build hierarchical groups using page_name to determine parent-child
  const groupedModules = useMemo<GroupedModule[]>(() => {
    const groupMap = new Map<string, GroupedModule>();
    const standalone: RoleModule[] = [];

    for (const m of modules) {
      const parentSlug = getParentSlug(m.page_name);

      if (parentSlug) {
        // Child module — group under parent
        if (!groupMap.has(parentSlug)) {
          groupMap.set(parentSlug, {
            parentSlug,
            parentLabel: slugToLabel(parentSlug),
            children: [],
          });
        }
        groupMap.get(parentSlug)!.children.push(m);
      } else {
        // Top-level or parent-only module — handle after processing all children
        standalone.push(m);
      }
    }

    // For standalone modules: check if they are a parent of some group
    // If so, don't show them as standalone — they're the section header
    const result: GroupedModule[] = [];
    const usedSlugs = new Set<string>();

    // Add groups that have children
    for (const [slug, group] of groupMap) {
      // Check if there's a standalone module that IS the parent
      const parentModule = standalone.find((s) => {
        const selfSlug = (s.page_name || '').replace(/^\//, '').split('/').filter(Boolean);
        return selfSlug.length === 1 && selfSlug[0] === slug;
      });
      if (parentModule) {
        group.parentLabel = getModuleDisplayName(parentModule);
        usedSlugs.add(slug);
      }
      result.push(group);
    }

    // Add remaining standalone modules (those not used as parent headers)
    for (const m of standalone) {
      const selfSlug = (m.page_name || '').replace(/^\//, '').split('/').filter(Boolean)[0];
      if (selfSlug && usedSlugs.has(selfSlug)) continue;
      // Standalone as its own group
      result.push({
        parentSlug: `standalone-${m.module_id}`,
        parentLabel: getModuleDisplayName(m),
        children: [m],
      });
    }

    return result;
  }, [modules]);

  const toggleGroup = (slug: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const handleToggle = (moduleId: number, field: keyof RoleModule) => {
    setModules((prev) =>
      prev.map((m) => {
        if (m.module_id !== moduleId) return m;
        const updated = { ...m, [field]: !m[field] };
        // If turning on any permission, auto-enable the module
        if (field !== 'is_enabled' && updated[field]) {
          updated.is_enabled = true;
        }
        // If disabling module, disable all permissions
        if (field === 'is_enabled' && !updated.is_enabled) {
          updated.can_view = false;
          updated.can_add = false;
          updated.can_edit = false;
          updated.can_delete = false;
        }
        return updated;
      })
    );
    setSuccessMsg(null);
  };

  const handleSelectAll = (field: 'is_enabled' | 'can_view' | 'can_add' | 'can_edit' | 'can_delete') => {
    const allChecked = modules.every((m) => m[field]);
    setModules((prev) =>
      prev.map((m) => {
        if (field === 'is_enabled') {
          if (allChecked) {
            return { ...m, is_enabled: false, can_view: false, can_add: false, can_edit: false, can_delete: false };
          }
          return { ...m, is_enabled: true };
        }
        return {
          ...m,
          [field]: !allChecked,
          is_enabled: !allChecked ? true : m.is_enabled,
        };
      })
    );
    setSuccessMsg(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await userRoleModuleService.savePermissions(numericRoleId, modules);
      setSuccessMsg('Permissions saved successfully!');
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  // Toggle switch component for is_enabled
  const ToggleSwitch = ({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={disabled ? undefined : onChange}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
      } ${checked ? 'bg-blue-600' : 'bg-gray-300'}`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );

  // Checkbox cell helper — disabled when is_enabled is false
  const CheckboxCell = ({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) => (
    <td className="px-4 py-3 whitespace-nowrap text-center">
      <input
        type="checkbox"
        checked={checked}
        onChange={disabled ? undefined : onChange}
        disabled={disabled}
        className={`w-4 h-4 border-gray-300 rounded focus:ring-blue-500 ${
          disabled ? 'text-gray-300 cursor-not-allowed opacity-50' : 'text-blue-600 cursor-pointer'
        }`}
      />
    </td>
  );

  let rowCounter = 0;

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader title={`Module Permission - ${roleName}`} onLogout={handleLogout} />

      <main className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-5xl mx-auto">
          {/* Back Button & Save */}
          <div className="mb-6 flex items-center justify-between">
            <button
              onClick={() => navigate('/user-module')}
              className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Roles
            </button>
            <button
              onClick={handleSave}
              disabled={saving || loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Save Permission
                </>
              )}
            </button>
          </div>

          {/* Messages */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}
          {successMsg && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-sm">
              {successMsg}
            </div>
          )}

          {/* Loading */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            /* Permission Table */
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="w-[5%] px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">#</th>
                    <th className="w-[33%] px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Module Name</th>
                    <th className="w-[11%] px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      <div className="flex flex-col items-center gap-1">
                        <span>Enabled</span>
                        <ToggleSwitch
                          checked={modules.length > 0 && modules.every((m) => m.is_enabled)}
                          onChange={() => handleSelectAll('is_enabled')}
                        />
                      </div>
                    </th>
                    {['View', 'Add', 'Edit', 'Delete'].map((label) => {
                      const field = `can_${label.toLowerCase()}` as 'can_view' | 'can_add' | 'can_edit' | 'can_delete';
                      return (
                        <th key={label} className="w-[11%] px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          <div className="flex flex-col items-center gap-1">
                            <span>{label}</span>
                            <input
                              type="checkbox"
                              checked={modules.length > 0 && modules.every((m) => m[field])}
                              onChange={() => handleSelectAll(field)}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                              title={`Select/Deselect All ${label}`}
                            />
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {groupedModules.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-gray-500 text-sm">
                        No modules found.
                      </td>
                    </tr>
                  ) : (
                    groupedModules.map((group) => {
                      const isCollapsed = collapsedGroups.has(group.parentSlug);
                      const isStandalone = group.parentSlug.startsWith('standalone-');

                      if (isStandalone && group.children.length === 1) {
                        const mod = group.children[0];
                        rowCounter++;
                        return (
                          <tr key={mod.module_id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{rowCounter}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-medium">{getModuleDisplayName(mod)}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-center">
                              <ToggleSwitch checked={mod.is_enabled} onChange={() => handleToggle(mod.module_id, 'is_enabled')} />
                            </td>
                            <CheckboxCell checked={mod.can_view} onChange={() => handleToggle(mod.module_id, 'can_view')} disabled={!mod.is_enabled} />
                            <CheckboxCell checked={mod.can_add} onChange={() => handleToggle(mod.module_id, 'can_add')} disabled={!mod.is_enabled} />
                            <CheckboxCell checked={mod.can_edit} onChange={() => handleToggle(mod.module_id, 'can_edit')} disabled={!mod.is_enabled} />
                            <CheckboxCell checked={mod.can_delete} onChange={() => handleToggle(mod.module_id, 'can_delete')} disabled={!mod.is_enabled} />
                          </tr>
                        );
                      }

                      rowCounter++;
                      const parentRowNum = rowCounter;

                      return (
                        <React.Fragment key={`group-${group.parentSlug}`}>
                          {/* Parent Row - collapsible section header */}
                          <tr
                            className="bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors border-l-4 border-l-blue-400"
                            onClick={() => toggleGroup(group.parentSlug)}
                          >
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-700">{parentRowNum}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900" colSpan={6}>
                              <div className="flex items-center gap-2">
                                <svg
                                  className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-90'}`}
                                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                                <span>{group.parentLabel}</span>
                                <span className="text-xs font-normal text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full">
                                  {group.children.length} sub-module{group.children.length !== 1 ? 's' : ''}
                                </span>
                              </div>
                            </td>
                          </tr>

                          {/* Child Rows */}
                          {!isCollapsed && group.children.map((mod, idx) => (
                            <tr key={mod.module_id} className="hover:bg-blue-50/40 transition-colors bg-white">
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400 pl-10">{parentRowNum}.{idx + 1}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 pl-12">
                                <div className="flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0"></span>
                                  {getModuleDisplayName(mod)}
                                </div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-center">
                                <ToggleSwitch checked={mod.is_enabled} onChange={() => handleToggle(mod.module_id, 'is_enabled')} />
                              </td>
                              <CheckboxCell checked={mod.can_view} onChange={() => handleToggle(mod.module_id, 'can_view')} disabled={!mod.is_enabled} />
                              <CheckboxCell checked={mod.can_add} onChange={() => handleToggle(mod.module_id, 'can_add')} disabled={!mod.is_enabled} />
                              <CheckboxCell checked={mod.can_edit} onChange={() => handleToggle(mod.module_id, 'can_edit')} disabled={!mod.is_enabled} />
                              <CheckboxCell checked={mod.can_delete} onChange={() => handleToggle(mod.module_id, 'can_delete')} disabled={!mod.is_enabled} />
                            </tr>
                          ))}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
