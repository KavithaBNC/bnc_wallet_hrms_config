/**
 * Service for Configurator DB operations (departments, sub-departments, cost centres).
 * Proxied through Vite dev server to avoid CORS:
 *   Browser → /configurator-api/* → Vite proxy → http://localhost:8000/*
 *
 * Authentication: Bearer token from login stored in localStorage as 'configuratorAccessToken'.
 * company_id is stored in localStorage as 'configuratorCompanyId' at login.
 *
 * API Endpoints (all list endpoints are POST, not GET):
 *   POST /api/v1/cost-centres/list   — list cost centres     { company_id? }
 *   POST /api/v1/cost-centres/       — create cost centre     { name, company_id }
 *   POST /api/v1/departments/list    — list departments       { company_id?, cost_centre_id? }
 *   POST /api/v1/departments/        — create department      { name, cost_centre_id, company_id? }
 *   POST /api/v1/sub-departments/list — list sub-departments  { company_id }
 *   POST /api/v1/sub-departments/    — create sub-department  { name, department_id, company_id?, costcenter_id? }
 */

import axios, { AxiosInstance } from 'axios';

// Proxied through Vite dev server to avoid CORS issues.
// Vite rewrites /configurator-api/* → http://localhost:8000/*
const BASE_URL = '/configurator-api';

/**
 * Create a dedicated axios instance for the Configurator API.
 * Uses the configuratorAccessToken (from login) as Bearer token.
 * Includes a response interceptor to refresh the token on 401.
 */
function getConfiguratorApi(): AxiosInstance {
  const token = localStorage.getItem('configuratorAccessToken');
  if (!token) {
    console.error('[configuratorDataService] No configuratorAccessToken in localStorage. User must log in again.');
  }
  const instance = axios.create({
    baseURL: BASE_URL,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    timeout: 15000,
  });

  // Add 401 response interceptor to refresh Configurator token
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
          // Refresh failed — let the error propagate
        }
      }
      return Promise.reject(error);
    }
  );

  return instance;
}

/** Get the numeric company_id stored at login */
function getCompanyId(): number | undefined {
  const raw = localStorage.getItem('configuratorCompanyId');
  if (!raw) return undefined;
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * Get the numeric project_id.
 * 1. Try localStorage 'configuratorProjectId' (set at login).
 * 2. Fallback: extract from 'modules' array stored during login.
 */
function getProjectId(): number {
  // 1. Try localStorage (set at login or persisted from a previous session)
  const raw = localStorage.getItem('configuratorProjectId');
  if (raw) {
    const parsed = parseInt(raw, 10);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }
  // No hardcoded fallback — project ID must come from login response stored in localStorage
  return 0;
}

// ─── Interfaces ───────────────────────────────────────────────────────────

export interface ConfigDepartment {
  id: number;
  name: string;
  code?: string;
  company_id?: number;
  cost_centre_id?: number;
  is_active?: boolean;
}

export interface ConfigSubDepartment {
  id: number;
  name: string;
  code?: string;
  department_id?: number;
  company_id?: number;
  costcenter_id?: number;
  is_active?: boolean;
}

export interface ConfigCostCentre {
  id: number;
  name: string;
  code?: string;
  company_id?: number;
  is_active?: boolean;
}

export interface ConfigUserRole {
  role_id: number;
  name: string;
  company_id?: number;
  project_id?: number;
  is_active?: boolean;
}

export interface ConfigUser {
  // Actual API response fields from POST /api/v1/users/list
  user_id: number;
  full_name: string;
  email: string;
  code?: string | null;
  phone?: string;
  is_active?: boolean;
  role_id?: number | null;
  department?: { id: number; name: string; code?: string } | null;
  cost_centre?: { id: number; name: string; code?: string } | null;
  sub_department?: { id: number; name: string; code?: string } | null;
  project_role?: { id: number; name: string; code?: string } | null;
  project_role_active?: boolean;
  // Legacy flat fields (kept for backward compatibility with create flow)
  id?: number;
  first_name?: string;
  last_name?: string;
  company_id?: number;
  cost_centre_id?: number;
  department_id?: number;
  sub_department_id?: number;
  [key: string]: any; // allow additional fields from API response
}

// ─── Service ──────────────────────────────────────────────────────────────

const configuratorDataService = {
  // ─── Cost Centres ──────────────────────────────────────────────────

  async getCostCentres(): Promise<ConfigCostCentre[]> {
    try {
      const api = getConfiguratorApi();
      const company_id = getCompanyId();
      const { data } = await api.post('/api/v1/cost-centres/list', { company_id: company_id ?? null });
      const list = Array.isArray(data) ? data : (data?.data ?? data?.cost_centres ?? data?.results ?? []);
      return list.filter((item: any) => item.is_active !== false);
    } catch (err: any) {
      console.error('[configuratorDataService.getCostCentres] Error:', err?.message, err?.response?.data);
      throw err;
    }
  },

  async createCostCentre(name: string): Promise<ConfigCostCentre> {
    try {
      const company_id = getCompanyId();
      const payload = { name, company_id };
      const api = getConfiguratorApi();
      const { data } = await api.post('/api/v1/cost-centres/', payload);
      return data;
    } catch (err: any) {
      console.error('[configuratorDataService.createCostCentre] FAILED:', {
        status: err?.response?.status,
        data: err?.response?.data,
        message: err?.message,
      });
      throw err;
    }
  },

  // ─── Departments ────────────────────────────────────────────────────

  async getDepartments(costCentreId?: number): Promise<ConfigDepartment[]> {
    try {
      const api = getConfiguratorApi();
      const company_id = getCompanyId();
      const payload: Record<string, any> = { company_id: company_id ?? null };
      if (costCentreId != null) payload.cost_centre_id = costCentreId;
      const { data } = await api.post('/api/v1/departments/list', payload);
      const list = Array.isArray(data) ? data : (data?.data ?? data?.departments ?? data?.results ?? []);
      return list.filter((item: any) => item.is_active !== false);
    } catch (err: any) {
      console.error('[configuratorDataService.getDepartments] Error:', err?.message, err?.response?.data);
      throw err;
    }
  },

  async createDepartment(name: string, costCentreId: number): Promise<ConfigDepartment> {
    try {
      const company_id = getCompanyId();
      const payload: Record<string, any> = { name, cost_centre_id: costCentreId };
      if (company_id != null) payload.company_id = company_id;
      const api = getConfiguratorApi();
      const { data } = await api.post('/api/v1/departments/', payload);
      return data;
    } catch (err: any) {
      console.error('[configuratorDataService.createDepartment] FAILED:', {
        status: err?.response?.status,
        data: err?.response?.data,
        message: err?.message,
      });
      throw err;
    }
  },

  // ─── Sub-Departments ────────────────────────────────────────────────

  async getSubDepartments(): Promise<ConfigSubDepartment[]> {
    try {
      const api = getConfiguratorApi();
      const company_id = getCompanyId();
      const { data } = await api.post('/api/v1/sub-departments/list', { company_id: company_id ?? 0 });
      const list = Array.isArray(data) ? data : (data?.data ?? data?.sub_departments ?? data?.results ?? []);
      return list.filter((item: any) => item.is_active !== false);
    } catch (err: any) {
      console.error('[configuratorDataService.getSubDepartments] Error:', err?.message, err?.response?.data);
      throw err;
    }
  },

  async createSubDepartment(name: string, departmentId: number, costcenterId?: number): Promise<ConfigSubDepartment> {
    try {
      const company_id = getCompanyId();
      const payload: Record<string, any> = { name, department_id: departmentId };
      if (company_id != null) payload.company_id = company_id;
      if (costcenterId != null) payload.costcenter_id = String(costcenterId);
      const api = getConfiguratorApi();
      const { data } = await api.post('/api/v1/sub-departments/', payload);
      return data;
    } catch (err: any) {
      console.error('[configuratorDataService.createSubDepartment] FAILED:', {
        status: err?.response?.status,
        data: err?.response?.data,
        message: err?.message,
      });
      throw err;
    }
  },

  // ─── Edit & Delete (Departments) ────────────────────────────────

  async editDepartment(department_id: number, name: string, cost_centre_id: number): Promise<ConfigDepartment> {
    const api = getConfiguratorApi();
    const company_id = getCompanyId();
    const { data } = await api.put('/api/v1/departments/', { department_id, name, cost_centre_id, company_id: company_id ?? 0 });
    return data?.data ?? data;
  },

  async deleteDepartment(department_id: number): Promise<void> {
    const api = getConfiguratorApi();
    console.log('[configuratorDataService.deleteDepartment] Deleting department_id:', department_id);
    const { data } = await api.request({
      method: 'DELETE',
      url: '/api/v1/departments/',
      data: { department_id },
    });
    console.log('[configuratorDataService.deleteDepartment] Response:', data);
  },

  // ─── Edit & Delete (Sub-Departments) ──────────────────────────

  async editSubDepartment(sub_department_id: number, name: string, department_id: number, costcenter_id?: number): Promise<ConfigSubDepartment> {
    const api = getConfiguratorApi();
    const company_id = getCompanyId();
    const payload: Record<string, any> = { sub_department_id, name, department_id, company_id: company_id ?? 0 };
    if (costcenter_id != null) payload.costcenter_id = String(costcenter_id);
    const { data } = await api.put('/api/v1/sub-departments/', payload);
    return data?.data ?? data;
  },

  async deleteSubDepartment(sub_department_id: number): Promise<void> {
    const api = getConfiguratorApi();
    console.log('[configuratorDataService.deleteSubDepartment] Deleting sub_department_id:', sub_department_id);
    const { data } = await api.request({
      method: 'DELETE',
      url: '/api/v1/sub-departments/',
      data: { sub_department_id },
    });
    console.log('[configuratorDataService.deleteSubDepartment] Response:', data);
  },

  // ─── Edit & Delete (Cost Centres) ─────────────────────────────

  async editCostCentre(cost_centre_id: number, name: string): Promise<ConfigCostCentre> {
    const api = getConfiguratorApi();
    const company_id = getCompanyId();
    const { data } = await api.put('/api/v1/cost-centres/', { cost_centre_id, name, company_id: company_id ?? 0 });
    return data?.data ?? data;
  },

  async deleteCostCentre(cost_centre_id: number): Promise<void> {
    const api = getConfiguratorApi();
    console.log('[configuratorDataService.deleteCostCentre] Deleting cost_centre_id:', cost_centre_id);
    const { data } = await api.request({
      method: 'DELETE',
      url: '/api/v1/cost-centres/',
      data: { cost_centre_id },
    });
    console.log('[configuratorDataService.deleteCostCentre] Response:', data);
  },

  // ─── User Roles ──────────────────────────────────────────────────

  async getUserRoles(): Promise<ConfigUserRole[]> {
    try {
      const api = getConfiguratorApi();
      const company_id = getCompanyId();
      const project_id = getProjectId();
      const { data } = await api.post('/api/v1/user-roles/get', { company_id: company_id ?? 0, project_id });
      const list = Array.isArray(data) ? data : (data?.data ?? data?.user_roles ?? data?.results ?? []);
      return list;
    } catch (err: any) {
      console.error('[configuratorDataService.getUserRoles] Error:', err?.message, err?.response?.data);
      throw err;
    }
  },

  async createUserRole(name: string): Promise<ConfigUserRole> {
    try {
      const company_id = getCompanyId();
      const project_id = getProjectId();
      const payload = { name, company_id: company_id ?? 0, project_id };
      const api = getConfiguratorApi();
      const { data } = await api.post('/api/v1/user-roles/', payload);
      return data;
    } catch (err: any) {
      console.error('[configuratorDataService.createUserRole] FAILED:', {
        status: err?.response?.status,
        data: err?.response?.data,
        message: err?.message,
      });
      throw err;
    }
  },

  // ─── Users (Configurator DB) ──────────────────────────────────────

  async createConfiguratorUser(payload: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    password: string;
    company_id: number;
    project_id: number;
    role_id: number;
    cost_centre_id: number | null;
    department_id: number | null;
    sub_department_id: number | null;
  }): Promise<ConfigUser> {
    try {
      const api = getConfiguratorApi();
      console.log('[configuratorDataService.createConfiguratorUser] Calling POST /api/v1/users/add with:', JSON.stringify(payload));
      const { data } = await api.post('/api/v1/users/add', payload);
      console.log('[configuratorDataService.createConfiguratorUser] SUCCESS response:', JSON.stringify(data));
      // Unwrap nested data if API returns { data: { ... } } or { success: true, data: { ... } }
      const result = data?.data ?? data;
      return result;
    } catch (err: any) {
      console.error('[configuratorDataService.createConfiguratorUser] FAILED:', {
        status: err?.response?.status,
        data: err?.response?.data,
        message: err?.message,
      });
      throw err;
    }
  },

  async deleteConfiguratorUser(userId: number): Promise<void> {
    try {
      const api = getConfiguratorApi();
      // DELETE /api/v1/users/{user_id} with { user_id } in request body
      await api.delete(`/api/v1/users/${userId}`, { data: { user_id: userId } });
      console.log('[configuratorDataService.deleteConfiguratorUser] Deleted user:', userId);
    } catch (err: any) {
      console.error('[configuratorDataService.deleteConfiguratorUser] FAILED:', {
        status: err?.response?.status,
        data: err?.response?.data,
        message: err?.message,
      });
      throw err;
    }
  },

  /** GET /api/v1/users/{user_id} — fetch single user details */
  async getConfiguratorUser(userId: number): Promise<ConfigUser> {
    try {
      const api = getConfiguratorApi();
      console.log('[configuratorDataService.getConfiguratorUser] GET /api/v1/users/' + userId);
      const { data } = await api.get(`/api/v1/users/${userId}`);
      console.log('[configuratorDataService.getConfiguratorUser] Response:', data);
      return data;
    } catch (err: any) {
      console.error('[configuratorDataService.getConfiguratorUser] FAILED:', {
        status: err?.response?.status,
        data: err?.response?.data,
        message: err?.message,
      });
      throw err;
    }
  },

  /** PUT /api/v1/users/ — update user (user_id required in body) */
  async updateConfiguratorUser(payload: {
    user_id: number;
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    phone?: string | null;
    company_id?: number | null;
    project_id?: number | null;
    role_id?: number | null;
    department_id?: number | null;
    sub_department_id?: number | null;
    cost_centre_id?: number | null;
    password?: string | null;
  }): Promise<ConfigUser> {
    try {
      const api = getConfiguratorApi();
      console.log('[configuratorDataService.updateConfiguratorUser] PUT /api/v1/users/ with:', JSON.stringify(payload));
      const { data } = await api.put('/api/v1/users/', payload);
      console.log('[configuratorDataService.updateConfiguratorUser] Response:', data);
      return data;
    } catch (err: any) {
      console.error('[configuratorDataService.updateConfiguratorUser] FAILED:', {
        status: err?.response?.status,
        data: err?.response?.data,
        message: err?.message,
      });
      throw err;
    }
  },

  async listConfiguratorUsers(filters?: {
    cost_centre_id?: number;
    department_id?: number;
    sub_department_id?: number;
  }): Promise<ConfigUser[]> {
    try {
      const company_id = getCompanyId();
      const project_id = getProjectId();
      const api = getConfiguratorApi();
      const payload: Record<string, any> = { company_id: company_id ?? 0, project_id };
      if (filters?.cost_centre_id) payload.cost_centre_id = filters.cost_centre_id;
      if (filters?.department_id) payload.department_id = filters.department_id;
      if (filters?.sub_department_id) payload.sub_department_id = filters.sub_department_id;
      console.log('[configuratorDataService.listConfiguratorUsers] POST /api/v1/users/list payload:', JSON.stringify(payload));
      const response = await api.post('/api/v1/users/list', payload);
      const data = response.data;

      // Extract the array from any possible response shape
      let list: any[] = [];
      if (Array.isArray(data)) {
        list = data;
      } else if (data && typeof data === 'object') {
        // Try every known wrapper: data.data, data.users, data.results, or first array property
        const inner = data.data ?? data.users ?? data.results ?? data.list;
        if (Array.isArray(inner)) {
          list = inner;
        } else if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
          // Double-nested: data.data.data, data.data.users, etc.
          const deeper = inner.data ?? inner.users ?? inner.results ?? inner.list;
          if (Array.isArray(deeper)) {
            list = deeper;
          } else {
            // Last resort: find the first array value in the response
            const firstArr = Object.values(data).find((v) => Array.isArray(v));
            if (firstArr) list = firstArr as any[];
          }
        } else {
          // Last resort: find the first array value in the response
          const firstArr = Object.values(data).find((v) => Array.isArray(v));
          if (firstArr) list = firstArr as any[];
        }
      } else if (typeof data === 'string') {
        // API might return unparsed JSON string
        try {
          const parsed = JSON.parse(data);
          list = Array.isArray(parsed) ? parsed : (parsed?.data ?? parsed?.users ?? parsed?.results ?? []);
          if (!Array.isArray(list)) list = [];
        } catch { list = []; }
      }

      console.log('[configuratorDataService.listConfiguratorUsers] Response:', list.length, 'users', list);
      return list;
    } catch (err: any) {
      console.error('[listConfiguratorUsers] Error:', err?.message, err?.response?.status, err?.response?.data);
      throw err;
    }
  },
};

export default configuratorDataService;
