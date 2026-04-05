/**
 * Service for User Role Module Permission operations.
 * All calls go through HRMS backend at /api/v1/configurator-data/*
 * which queries Config DB (Nemi_Config) directly via Prisma.
 */

import api from './api';

// ─── Interfaces ───────────────────────────────────────────────────────────

export interface UserRole {
  role_id: number;
  name: string;
  role_name?: string;
  company_id?: number;
  project_id?: number;
  is_active?: boolean;
}

export interface RoleModule {
  module_id: number;
  module_name: string;
  page_name?: string;
  is_enabled: boolean;
  can_view: boolean;
  can_add: boolean;
  can_edit: boolean;
  can_delete: boolean;
  parent_module_id?: number | null;
  parent_module?: { id: number; name: string; code: string } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function extractList(data: any, ...keys: string[]): any[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    for (const key of keys) {
      if (Array.isArray(data[key])) return data[key];
      if (data.data && Array.isArray(data.data[key])) return data.data[key];
    }
    if (Array.isArray(data.data)) return data.data;
  }
  return [];
}

function normalizeModule(m: any): RoleModule {
  return {
    ...m,
    module_id: m.module_id ?? m.id,
    module_name: m.module_name || m.name || '',
    page_name: m.page_name || '',
    is_enabled: m.is_enabled === true || m.is_enabled === 1,
    can_view: m.can_view === true || m.can_view === 1,
    can_add: m.can_add === true || m.can_add === 1,
    can_edit: m.can_edit === true || m.can_edit === 1,
    can_delete: m.can_delete === true || m.can_delete === 1,
    parent_module_id: m.parent_module_id ?? null,
    parent_module: m.parent_module ?? null,
  };
}

// ─── Service ──────────────────────────────────────────────────────────────

const userRoleModuleService = {
  /** Fetch all roles from Config DB */
  async getRoles(): Promise<UserRole[]> {
    const { data } = await api.get('/configurator-data/roles');
    const list = extractList(data, 'roles', 'user_roles', 'results');
    return list.map((r: any) => ({
      ...r,
      role_id: r.role_id ?? r.id,
      name: r.name || r.role_name || '',
    }));
  },

  /** Fetch module list for the logged-in user's role (for Module Name column header) */
  async getModuleNames(): Promise<RoleModule[]> {
    const { data } = await api.get('/configurator-data/role-modules');
    const list = extractList(data, 'modules', 'role_modules', 'results');
    return list.map(normalizeModule);
  },

  /** Fetch permissions for a selected role_id */
  async getRolePermissions(role_id: number): Promise<RoleModule[]> {
    const { data } = await api.get('/configurator-data/role-modules', {
      params: { role_id },
    });
    const list = extractList(data, 'modules', 'role_modules', 'results');
    return list.map(normalizeModule);
  },

  /** Save module permissions for a role */
  async savePermissions(role_id: number, modules: RoleModule[]): Promise<any> {
    const { data } = await api.put('/configurator-data/role-modules', {
      role_id,
      modules: modules.map((m) => ({
        module_id: m.module_id,
        is_enabled: m.is_enabled,
        can_view: m.can_view,
        can_add: m.can_add,
        can_edit: m.can_edit,
        can_delete: m.can_delete,
      })),
    });
    return data;
  },
};

export default userRoleModuleService;
