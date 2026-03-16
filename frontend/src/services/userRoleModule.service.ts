/**
 * Service for User Role Module Permission operations (Configurator API).
 *
 * API Endpoints:
 *   POST /api/v1/user-roles/get       — list roles       { project_id, company_id }
 *   POST /api/v1/user-role-modules/project — get modules      { role_id (from login), project_id }
 *   POST /api/v1/user-role-modules/project — save permissions  { company_id, role_id, project_id, modules }
 */

import axios, { AxiosInstance } from 'axios';

const BASE_URL = '/configurator-api';

function getConfiguratorApi(): AxiosInstance {
  const token = localStorage.getItem('configuratorAccessToken');
  const instance = axios.create({
    baseURL: BASE_URL,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    timeout: 15000,
  });

  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest: any = error.config;
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;
        try {
          const refreshToken = localStorage.getItem('configuratorRefreshToken');
          if (!refreshToken) throw new Error('No configurator refresh token');
          const res = await axios.post(`${BASE_URL}/api/v1/auth/token/refresh`, {
            refresh_token: refreshToken,
          });
          const newToken = res.data.access_token || '';
          const newRefresh = res.data.refresh_token || refreshToken;
          localStorage.setItem('configuratorAccessToken', newToken);
          localStorage.setItem('configuratorRefreshToken', newRefresh);
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return instance(originalRequest);
        } catch {
          // Refresh failed
        }
      }
      return Promise.reject(error);
    }
  );

  return instance;
}

function getCompanyId(): number {
  const raw = localStorage.getItem('configuratorCompanyId');
  if (!raw) return 0;
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getProjectId(): number {
  const raw = localStorage.getItem('configuratorProjectId');
  if (raw) {
    const parsed = parseInt(raw, 10);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }
  return 0;
}

function getLoginRoleId(): number {
  try {
    const raw = localStorage.getItem('projects');
    if (!raw) return 0;
    const projects = JSON.parse(raw);
    const hrms = Array.isArray(projects)
      ? projects.find((p: any) => p.code === 'HRMS001' || p.name === 'HRMS') || projects[0]
      : null;
    return hrms?.role_id ?? 0;
  } catch {
    return 0;
  }
}

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

// ─── Service ──────────────────────────────────────────────────────────────

const userRoleModuleService = {
  /** Fetch all roles */
  async getRoles(): Promise<UserRole[]> {
    const api = getConfiguratorApi();
    const { data } = await api.post('/api/v1/user-roles/get', {
      project_id: getProjectId(),
      company_id: getCompanyId(),
    });
    const list = Array.isArray(data) ? data : (data?.data ?? data?.user_roles ?? data?.results ?? []);
    return list.map((r: any) => ({
      ...r,
      name: r.name || r.role_name || '',
    }));
  },

  /** Fetch module list using logged-in user's role_id (for Module Name column) */
  async getModuleNames(): Promise<RoleModule[]> {
    const api = getConfiguratorApi();
    const { data } = await api.post('/api/v1/user-role-modules/project', {
      role_id: getLoginRoleId(),
      project_id: getProjectId(),
    });
    const list = Array.isArray(data) ? data : (data?.data ?? data?.modules ?? data?.results ?? []);
    return list.map((m: any) => ({
      ...m,
      module_name: m.module_name || m.name || '',
      page_name: m.page_name || '',
      is_enabled: m.is_enabled === true || m.is_enabled === 1,
      can_view: m.can_view === true || m.can_view === 1,
      can_add: m.can_add === true || m.can_add === 1,
      can_edit: m.can_edit === true || m.can_edit === 1,
      can_delete: m.can_delete === true || m.can_delete === 1,
      parent_module_id: m.parent_module_id ?? null,
      parent_module: m.parent_module ?? null,
    }));
  },

  /** Fetch permissions for a selected role (for View/Add/Edit/Delete checkboxes) */
  async getRolePermissions(role_id: number): Promise<RoleModule[]> {
    const api = getConfiguratorApi();
    const { data } = await api.post('/api/v1/user-role-modules/project', {
      role_id,
      project_id: getProjectId(),
    });
    const list = Array.isArray(data) ? data : (data?.data ?? data?.modules ?? data?.results ?? []);
    return list.map((m: any) => ({
      ...m,
      module_name: m.module_name || m.name || '',
      page_name: m.page_name || '',
      is_enabled: m.is_enabled === true || m.is_enabled === 1,
      can_view: m.can_view === true || m.can_view === 1,
      can_add: m.can_add === true || m.can_add === 1,
      can_edit: m.can_edit === true || m.can_edit === 1,
      can_delete: m.can_delete === true || m.can_delete === 1,
      parent_module_id: m.parent_module_id ?? null,
      parent_module: m.parent_module ?? null,
    }));
  },

  /** Save module permissions for a role */
  async savePermissions(role_id: number, modules: RoleModule[]): Promise<any> {
    const api = getConfiguratorApi();
    const payload = {
      company_id: getCompanyId(),
      role_id,
      project_id: getProjectId(),
      modules: modules.map((m) => ({
        module_id: m.module_id,
        is_enabled: m.is_enabled,
        can_view: m.can_view,
        can_add: m.can_add,
        can_edit: m.can_edit,
        can_delete: m.can_delete,
      })),
    };
    const { data } = await api.post('/api/v1/user-role-modules/', payload);
    return data;
  },
};

export default userRoleModuleService;
