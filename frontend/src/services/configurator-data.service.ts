/**
 * Service for Configurator DB operations (departments, sub-departments, cost centres).
 * Proxied through Vite dev server to avoid CORS:
 *   Browser → /configurator-api/* → Vite proxy → http://bnc-ai.com:8001/*
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
// Vite rewrites /configurator-api/* → http://bnc-ai.com:8001/*
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
    timeout: 30000,
  });

  // Add response interceptor for 401 (token refresh) and 429 (rate limit retry)
  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest: any = error.config;

      // 429 Too Many Requests — retry after delay (up to 3 times)
      if (error.response?.status === 429) {
        const retryCount = originalRequest._retryCount || 0;
        if (retryCount < 3) {
          originalRequest._retryCount = retryCount + 1;
          const delay = (retryCount + 1) * 1000; // 1s, 2s, 3s
          await new Promise(resolve => setTimeout(resolve, delay));
          return instance(originalRequest);
        }
      }

      // 401 Unauthorized — refresh token
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

export interface ConfigBranch {
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
  password?: string | null;
  encrypted_password?: string | null;
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

  // ─── Branches ────────────────────────────────────────────────────────

  async getBranches(): Promise<ConfigBranch[]> {
    try {
      const api = getConfiguratorApi();
      const company_id = getCompanyId();
      const { data } = await api.post('/api/v1/branches/list', { company_id: company_id ?? null });
      const list = Array.isArray(data) ? data : (data?.data ?? data?.branches ?? data?.results ?? []);
      return list
        .filter((item: any) => item.is_active !== false)
        .map((item: any) => ({
          id: item.id ?? item.branch_id,
          name: item.name ?? item.branch_name,
          code: item.code,
          company_id: item.company_id,
          is_active: item.is_active,
        }));
    } catch (err: any) {
      console.error('[configuratorDataService.getBranches] Error:', err?.message, err?.response?.data);
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
    manager_id?: number | null;
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
      // DELETE /api/v1/users/  body: { user_id }
      await api.delete('/api/v1/users/', { data: { user_id: userId } });
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
    manager_id?: number | null;
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

  /**
   * Reset a Configurator user's password.
   * POST /api/v1/users/reset-password
   * Returns encrypted_password (preferred) or plain password from response — to be stored as password_hash.
   */
  async resetConfiguratorUserPassword(userId: number, newPassword: string): Promise<string> {
    try {
      const company_id = getCompanyId() ?? 0;
      const project_id = getProjectId();
      const api = getConfiguratorApi();
      const payload = { company_id, project_id, user_id: userId, password: newPassword };
      console.log('[configuratorDataService.resetConfiguratorUserPassword] POST /api/v1/users/reset-password with user_id:', userId);
      const { data } = await api.post('/api/v1/users/reset-password', payload);
      console.log('[configuratorDataService.resetConfiguratorUserPassword] Response:', data);
      // Use encrypted_password if available (same as employee create flow), else plain password
      return data?.encrypted_password ?? data?.password ?? newPassword;
    } catch (err: any) {
      console.error('[configuratorDataService.resetConfiguratorUserPassword] FAILED:', {
        status: err?.response?.status,
        data: err?.response?.data,
        message: err?.message,
      });
      throw err;
    }
  },

  /**
   * Get a Configurator user's plain password and user_id by email.
   * Calls POST /api/v1/users/list and finds the matching user.
   */
  async getConfiguratorUserByEmail(email: string): Promise<{ user_id: number; password: string | null } | null> {
    try {
      const company_id = getCompanyId() ?? 0;
      const project_id = getProjectId();
      const api = getConfiguratorApi();
      const { data } = await api.post('/api/v1/users/list', { company_id, project_id });
      const list: any[] = Array.isArray(data) ? data : (data?.data ?? data?.users ?? data?.results ?? []);
      const user = list.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
      if (!user) return null;
      return { user_id: user.user_id, password: user.password ?? null };
    } catch (err: any) {
      console.error('[configuratorDataService.getConfiguratorUserByEmail] FAILED:', err?.message);
      return null;
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
  /** POST /api/v1/users/inactive-users — fetch inactive users list */
  async listInactiveUsers(): Promise<ConfigUser[]> {
    try {
      const api = getConfiguratorApi();
      const company_id = getCompanyId();
      console.log('[configuratorDataService.listInactiveUsers] POST /api/v1/users/inactive-users payload:', JSON.stringify({ company_id: company_id ?? 0 }));
      const response = await api.post('/api/v1/users/inactive-users', { company_id: company_id ?? 0 });
      const data = response.data;

      // Extract the array from any possible response shape (same logic as listConfiguratorUsers)
      let list: any[] = [];
      if (Array.isArray(data)) {
        list = data;
      } else if (data && typeof data === 'object') {
        const inner = data.data ?? data.users ?? data.results ?? data.list;
        if (Array.isArray(inner)) {
          list = inner;
        } else if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
          const deeper = inner.data ?? inner.users ?? inner.results ?? inner.list;
          if (Array.isArray(deeper)) {
            list = deeper;
          } else {
            const firstArr = Object.values(data).find((v) => Array.isArray(v));
            if (firstArr) list = firstArr as any[];
          }
        } else {
          const firstArr = Object.values(data).find((v) => Array.isArray(v));
          if (firstArr) list = firstArr as any[];
        }
      } else if (typeof data === 'string') {
        try {
          const parsed = JSON.parse(data);
          list = Array.isArray(parsed) ? parsed : (parsed?.data ?? parsed?.users ?? parsed?.results ?? []);
          if (!Array.isArray(list)) list = [];
        } catch { list = []; }
      }

      // Normalize fields to match ConfigUser shape expected by the table
      // (inactive-users API may return different field names than /users/list)
      list = list.map((u: any) => ({
        ...u,
        user_id: u.user_id ?? u.id ?? u.userId,
        full_name: (u.full_name ?? u.name ?? u.fullname ?? u.full_Name ?? [u.first_name, u.last_name].filter(Boolean).join(' ')) || '',
        email: u.email ?? u.Email ?? '',
        code: u.code ?? u.employee_code ?? u.empCode ?? u.emp_code ?? '',
        phone: u.phone ?? u.mobile ?? u.phone_number ?? '',
        is_active: u.is_active ?? false,
        project_role: u.project_role ?? (u.role_name ? { id: u.role_id, name: u.role_name } : u.project_role) ?? null,
        cost_centre: u.cost_centre ?? (u.cost_centre_name ? { id: u.cost_centre_id, name: u.cost_centre_name } : null) ?? null,
        department: u.department ?? (u.department_name ? { id: u.department_id, name: u.department_name } : null) ?? null,
        sub_department: u.sub_department ?? (u.sub_department_name ? { id: u.sub_department_id, name: u.sub_department_name } : null) ?? null,
      }));

      console.log('[configuratorDataService.listInactiveUsers] Response:', list.length, 'users', list);
      return list;
    } catch (err: any) {
      console.error('[listInactiveUsers] Error:', err?.message, err?.response?.status, err?.response?.data);
      throw err;
    }
  },
};

export default configuratorDataService;
