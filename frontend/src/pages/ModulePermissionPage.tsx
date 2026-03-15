import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';
import userRoleModuleService, { RoleModule } from '../services/userRoleModule.service';
import { getAssignedModules } from '../config/configurator-module-mapping';

interface GroupedModule {
  parent: { id: number; name: string };
  children: RoleModule[];
}

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
  const [collapsedGroups, setCollapsedGroups] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!numericRoleId) return;
    fetchModules();
  }, [numericRoleId]);

  const fetchModules = async () => {
    setLoading(true);
    setError(null);
    try {
      // Two API calls:
      // 1. getModuleNames() → login role_id, project_id: 0 → Module Name column
      // 2. getRolePermissions() → selected role_id → checkbox values (Enabled, View, Add, Edit, Delete)
      const [moduleNames, rolePermissions] = await Promise.all([
        userRoleModuleService.getModuleNames(),
        userRoleModuleService.getRolePermissions(numericRoleId),
      ]);

      // Build permission map from selected role's response (keyed by module_id)
      const permMap = new Map<number, RoleModule>();
      rolePermissions.forEach((p) => permMap.set(p.module_id, p));

      // Enrich with sidebar data for parent info and display names
      const sidebarModules = getAssignedModules();
      const sidebarMap = new Map<number, any>();
      sidebarModules.forEach((sm) => {
        const id = sm.id ?? sm.module_id;
        if (id != null) sidebarMap.set(id, sm);
      });

      // Merge: module names from login role, checkbox values from selected role
      const merged = moduleNames.map((m) => {
        const perm = permMap.get(m.module_id);
        const sidebar = sidebarMap.get(m.module_id);
        const updated: RoleModule = {
          ...m,
          // Checkbox values from selected role's API response
          is_enabled: perm?.is_enabled ?? false,
          can_view: perm?.can_view ?? false,
          can_add: perm?.can_add ?? false,
          can_edit: perm?.can_edit ?? false,
          can_delete: perm?.can_delete ?? false,
        };

        // Enrich module_name from sidebar if current name is empty or is a path
        if (sidebar?.name && (!updated.module_name || updated.module_name.startsWith('/'))) {
          updated.module_name = sidebar.name;
        }

        // Enrich parent info from sidebar
        if (updated.parent_module_id == null && sidebar?.parent_module_id != null) {
          updated.parent_module_id = sidebar.parent_module_id;
          updated.parent_module = sidebar.parent_module ?? null;
        }

        return updated;
      });

      setModules(merged);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to fetch modules');
    } finally {
      setLoading(false);
    }
  };

  // Build hierarchical groups: parent modules with their children (like sidebar)
  const groupedModules = useMemo<GroupedModule[]>(() => {
    const parentMap = new Map<number, GroupedModule>();
    const standalone: RoleModule[] = [];

    // Get sidebar modules for parent name resolution
    const sidebarModules = getAssignedModules();
    const sidebarById = new Map<number, any>();
    sidebarModules.forEach((sm) => {
      const id = sm.id ?? sm.module_id;
      if (id != null) sidebarById.set(id, sm);
    });

    // First pass: identify all modules that are parents (referenced by others)
    const parentIds = new Set<number>();
    modules.forEach((m) => {
      if (m.parent_module_id != null) {
        parentIds.add(m.parent_module_id);
      }
    });

    // Second pass: group children under parents
    modules.forEach((m) => {
      if (m.parent_module_id != null) {
        // This is a child module
        const pid = m.parent_module_id;
        if (!parentMap.has(pid)) {
          // Resolve parent name: prefer sidebar name, then parent_module field
          const sidebarParent = sidebarById.get(pid);
          const parentName =
            sidebarParent?.name ||
            m.parent_module?.name ||
            `Module #${pid}`;
          parentMap.set(pid, { parent: { id: pid, name: parentName }, children: [] });
        }
        parentMap.get(pid)!.children.push(m);
      } else if (parentIds.has(m.module_id)) {
        // This module is a parent (other modules reference it) — create group but don't add as child
        if (!parentMap.has(m.module_id)) {
          parentMap.set(m.module_id, { parent: { id: m.module_id, name: m.module_name }, children: [] });
        } else {
          parentMap.get(m.module_id)!.parent.name = m.module_name;
        }
      } else {
        // Standalone module (no parent, not referenced as parent)
        standalone.push(m);
      }
    });

    const groups: GroupedModule[] = [];

    // Add grouped parents first
    parentMap.forEach((group) => {
      groups.push(group);
    });

    // Add standalone modules as individual groups
    standalone.forEach((m) => {
      groups.push({ parent: { id: m.module_id, name: m.module_name }, children: [m] });
    });

    return groups;
  }, [modules]);

  const toggleGroup = (parentId: number) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(parentId)) {
        next.delete(parentId);
      } else {
        next.add(parentId);
      }
      return next;
    });
  };

  const handleToggle = (moduleId: number, field: keyof RoleModule) => {
    setModules((prev) =>
      prev.map((m) => {
        if (m.module_id !== moduleId) return m;
        const updated = { ...m, [field]: !m[field] };
        if (field !== 'is_enabled' && updated[field]) {
          updated.is_enabled = true;
        }
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

  // Checkbox cell helper
  const CheckboxCell = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <td className="px-4 py-3 whitespace-nowrap text-center">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
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
            <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
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
                    {['Enabled', 'View', 'Add', 'Edit', 'Delete'].map((label) => {
                      const field = label === 'Enabled' ? 'is_enabled' : `can_${label.toLowerCase()}` as 'is_enabled' | 'can_view' | 'can_add' | 'can_edit' | 'can_delete';
                      return (
                        <th key={label} className="w-[11%] px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          <div className="flex flex-col items-center gap-1">
                            <span>{label}</span>
                            <input
                              type="checkbox"
                              checked={modules.length > 0 && modules.every((m) => m[field])}
                              onChange={() => handleSelectAll(field)}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                              title="Select/Deselect All"
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
                      const isCollapsed = collapsedGroups.has(group.parent.id);
                      const hasChildren = group.children.length > 0;
                      const isStandalone = group.children.length === 1 && group.children[0].module_id === group.parent.id;

                      if (isStandalone) {
                        const mod = group.children[0];
                        rowCounter++;
                        return (
                          <tr key={mod.module_id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{rowCounter}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-medium">{mod.module_name}</td>
                            <CheckboxCell checked={mod.is_enabled} onChange={() => handleToggle(mod.module_id, 'is_enabled')} />
                            <CheckboxCell checked={mod.can_view} onChange={() => handleToggle(mod.module_id, 'can_view')} />
                            <CheckboxCell checked={mod.can_add} onChange={() => handleToggle(mod.module_id, 'can_add')} />
                            <CheckboxCell checked={mod.can_edit} onChange={() => handleToggle(mod.module_id, 'can_edit')} />
                            <CheckboxCell checked={mod.can_delete} onChange={() => handleToggle(mod.module_id, 'can_delete')} />
                          </tr>
                        );
                      }

                      rowCounter++;
                      const parentRowNum = rowCounter;

                      return (
                        <React.Fragment key={`group-${group.parent.id}`}>
                          {/* Parent Row - collapsible header like sidebar */}
                          <tr
                            className="bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors border-l-4 border-l-blue-400"
                            onClick={() => toggleGroup(group.parent.id)}
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
                                <span>{group.parent.name}</span>
                                <span className="text-xs font-normal text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full">
                                  {group.children.length} sub-module{group.children.length !== 1 ? 's' : ''}
                                </span>
                              </div>
                            </td>
                          </tr>

                          {/* Child Rows - indented sub-modules */}
                          {!isCollapsed && hasChildren && group.children.map((mod, idx) => (
                            <tr key={mod.module_id} className="hover:bg-blue-50/40 transition-colors bg-white">
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400 pl-10">{parentRowNum}.{idx + 1}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 pl-12">
                                <div className="flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0"></span>
                                  {mod.module_name}
                                </div>
                              </td>
                              <CheckboxCell checked={mod.is_enabled} onChange={() => handleToggle(mod.module_id, 'is_enabled')} />
                              <CheckboxCell checked={mod.can_view} onChange={() => handleToggle(mod.module_id, 'can_view')} />
                              <CheckboxCell checked={mod.can_add} onChange={() => handleToggle(mod.module_id, 'can_add')} />
                              <CheckboxCell checked={mod.can_edit} onChange={() => handleToggle(mod.module_id, 'can_edit')} />
                              <CheckboxCell checked={mod.can_delete} onChange={() => handleToggle(mod.module_id, 'can_delete')} />
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
