/**
 * Service for Configurator DB operations (departments, sub-departments, cost centres, users).
 * All calls go through the HRMS backend at /api/v1/configurator-data/*
 * which queries the Config DB (Nemi_Config) directly via Prisma.
 */

import api from './api';

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
  status?: string;
}

export interface ConfigUserRole {
  role_id: number;
  name: string;
  company_id?: number;
  project_id?: number;
  is_active?: boolean;
}

export interface ConfigUser {
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
  paygroup?: { id: string; name: string; code?: string } | null;
  entity?: { id: string; name: string; code?: string } | null;
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
  [key: string]: any;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function extractList(data: any, ...keys: string[]): any[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    // Handle { status, data: [...] } or { status, data: { users: [...] } }
    for (const key of keys) {
      if (Array.isArray(data[key])) return data[key];
      if (data.data && Array.isArray(data.data[key])) return data.data[key];
    }
    if (Array.isArray(data.data)) return data.data;
    // Recurse one level for nested data objects
    if (data.data && typeof data.data === 'object' && !Array.isArray(data.data)) {
      const inner = data.data;
      const firstArr = Object.values(inner).find((v) => Array.isArray(v));
      if (firstArr) return firstArr as any[];
    }
    const firstArr = Object.values(data).find((v) => Array.isArray(v));
    if (firstArr) return firstArr as any[];
  }
  return [];
}

// ─── Service ──────────────────────────────────────────────────────────────

const configuratorDataService = {
  // ─── Cost Centres ──────────────────────────────────────────────────

  async getCostCentres(): Promise<ConfigCostCentre[]> {
    try {
      const { data } = await api.get('/configurator-data/cost-centres');
      return extractList(data, 'cost_centres', 'costCentres', 'results');
    } catch (err: any) {
      console.error('[configuratorDataService.getCostCentres] Error:', err?.message);
      throw err;
    }
  },

  async createCostCentre(name: string): Promise<ConfigCostCentre> {
    try {
      const { data } = await api.post('/configurator-data/cost-centres', { name });
      return data?.data ?? data;
    } catch (err: any) {
      console.error('[configuratorDataService.createCostCentre] FAILED:', err?.message);
      throw err;
    }
  },

  async editCostCentre(cost_centre_id: number, name: string): Promise<ConfigCostCentre> {
    const { data } = await api.put(`/configurator-data/cost-centres/${cost_centre_id}`, { name });
    return data?.data ?? data;
  },

  async deleteCostCentre(cost_centre_id: number): Promise<void> {
    await api.delete(`/configurator-data/cost-centres/${cost_centre_id}`);
  },

  // ─── Branches ────────────────────────────────────────────────────────

  async getBranches(): Promise<ConfigBranch[]> {
    try {
      const { data } = await api.get('/configurator-data/branches');
      const list = extractList(data, 'branches', 'results');
      return list.map((item: any) => ({
        id: item.id ?? item.branch_id,
        name: item.name ?? item.branch_name,
        code: item.code,
        company_id: item.company_id,
        is_active: item.status === 'active',
        status: item.status,
      }));
    } catch (err: any) {
      console.error('[configuratorDataService.getBranches] Error:', err?.message);
      throw err;
    }
  },

  // ─── Departments ────────────────────────────────────────────────────

  async getDepartments(costCentreId?: number): Promise<ConfigDepartment[]> {
    try {
      const params: Record<string, any> = {};
      if (costCentreId != null) params.cost_centre_id = costCentreId;
      const { data } = await api.get('/configurator-data/departments', { params });
      return extractList(data, 'departments', 'results');
    } catch (err: any) {
      console.error('[configuratorDataService.getDepartments] Error:', err?.message);
      throw err;
    }
  },

  async createDepartment(name: string, costCentreId: number): Promise<ConfigDepartment> {
    try {
      const { data } = await api.post('/configurator-data/departments', {
        name,
        cost_centre_id: costCentreId,
      });
      return data?.data ?? data;
    } catch (err: any) {
      console.error('[configuratorDataService.createDepartment] FAILED:', err?.message);
      throw err;
    }
  },

  async editDepartment(department_id: number, name: string, cost_centre_id: number): Promise<ConfigDepartment> {
    const { data } = await api.put(`/configurator-data/departments/${department_id}`, {
      name,
      cost_centre_id,
    });
    return data?.data ?? data;
  },

  async deleteDepartment(department_id: number): Promise<void> {
    await api.delete(`/configurator-data/departments/${department_id}`);
  },

  // ─── Sub-Departments ────────────────────────────────────────────────

  async getSubDepartments(): Promise<ConfigSubDepartment[]> {
    try {
      const { data } = await api.get('/configurator-data/sub-departments');
      return extractList(data, 'sub_departments', 'subDepartments', 'results');
    } catch (err: any) {
      console.error('[configuratorDataService.getSubDepartments] Error:', err?.message);
      throw err;
    }
  },

  async createSubDepartment(name: string, departmentId: number, costcenterId?: number): Promise<ConfigSubDepartment> {
    try {
      const payload: Record<string, any> = { name, department_id: departmentId };
      if (costcenterId != null) payload.costcenter_id = String(costcenterId);
      const { data } = await api.post('/configurator-data/sub-departments', payload);
      return data?.data ?? data;
    } catch (err: any) {
      console.error('[configuratorDataService.createSubDepartment] FAILED:', err?.message);
      throw err;
    }
  },

  async editSubDepartment(sub_department_id: number, name: string, department_id: number, costcenter_id?: number): Promise<ConfigSubDepartment> {
    const payload: Record<string, any> = { name, department_id };
    if (costcenter_id != null) payload.costcenter_id = String(costcenter_id);
    const { data } = await api.put(`/configurator-data/sub-departments/${sub_department_id}`, payload);
    return data?.data ?? data;
  },

  async deleteSubDepartment(sub_department_id: number): Promise<void> {
    await api.delete(`/configurator-data/sub-departments/${sub_department_id}`);
  },

  // ─── User Roles ──────────────────────────────────────────────────────

  async getUserRoles(): Promise<ConfigUserRole[]> {
    try {
      const { data } = await api.get('/configurator-data/roles');
      const list = extractList(data, 'roles', 'user_roles', 'results');
      return list.map((r: any) => ({
        ...r,
        role_id: r.role_id ?? r.id,
        name: r.name || r.role_name || '',
      }));
    } catch (err: any) {
      console.error('[configuratorDataService.getUserRoles] Error:', err?.message);
      throw err;
    }
  },

  async createUserRole(name: string): Promise<ConfigUserRole> {
    try {
      const { data } = await api.post('/configurator-data/roles', { name });
      return data?.data ?? data;
    } catch (err: any) {
      console.error('[configuratorDataService.createUserRole] FAILED:', err?.message);
      throw err;
    }
  },

  // ─── Users (Config DB) ────────────────────────────────────────────────

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
      console.log('[configuratorDataService.createConfiguratorUser] POST /configurator-data/users with:', JSON.stringify(payload));
      const { data } = await api.post('/configurator-data/users', payload);
      console.log('[configuratorDataService.createConfiguratorUser] SUCCESS:', JSON.stringify(data));
      return data?.data ?? data;
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
      await api.delete(`/configurator-data/users/${userId}`);
      console.log('[configuratorDataService.deleteConfiguratorUser] Deleted user:', userId);
    } catch (err: any) {
      console.error('[configuratorDataService.deleteConfiguratorUser] FAILED:', err?.message);
      throw err;
    }
  },

  async getConfiguratorUser(userId: number): Promise<ConfigUser> {
    try {
      const { data } = await api.get(`/configurator-data/users/${userId}`);
      return data?.data ?? data;
    } catch (err: any) {
      console.error('[configuratorDataService.getConfiguratorUser] FAILED:', err?.message);
      throw err;
    }
  },

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
      const { user_id, ...body } = payload;
      console.log('[configuratorDataService.updateConfiguratorUser] PUT /configurator-data/users/' + user_id);
      const { data } = await api.put(`/configurator-data/users/${user_id}`, body);
      return data?.data ?? data;
    } catch (err: any) {
      console.error('[configuratorDataService.updateConfiguratorUser] FAILED:', err?.message);
      throw err;
    }
  },

  /**
   * Reset a Config DB user password.
   * Returns the new hashed password string from the backend response.
   */
  async resetConfiguratorUserPassword(userId: number, newPassword: string): Promise<string> {
    try {
      const { data } = await api.put(`/configurator-data/users/${userId}`, { password: newPassword });
      return data?.encrypted_password ?? data?.password ?? newPassword;
    } catch (err: any) {
      console.error('[configuratorDataService.resetConfiguratorUserPassword] FAILED:', err?.message);
      throw err;
    }
  },

  /**
   * Find a Config DB user by email.
   * Falls back to listing all users and filtering client-side.
   */
  async getConfiguratorUserByEmail(email: string): Promise<{ user_id: number; password: string | null } | null> {
    try {
      const { data } = await api.get('/configurator-data/users', { params: { email } });
      const list: any[] = extractList(data, 'users', 'results');
      const user = list.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
      if (!user) return null;
      return { user_id: user.user_id ?? user.id, password: user.password ?? null };
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
      const params: Record<string, any> = {};
      if (filters?.cost_centre_id) params.cost_centre_id = filters.cost_centre_id;
      if (filters?.department_id) params.department_id = filters.department_id;
      if (filters?.sub_department_id) params.sub_department_id = filters.sub_department_id;
      console.log('[configuratorDataService.listConfiguratorUsers] GET /configurator-data/users params:', params);
      const { data } = await api.get('/configurator-data/users', { params });
      const list = extractList(data, 'users', 'results');
      console.log('[configuratorDataService.listConfiguratorUsers] Response:', list.length, 'users');
      return list;
    } catch (err: any) {
      console.error('[listConfiguratorUsers] Error:', err?.message);
      throw err;
    }
  },

  /** List inactive users from Config DB */
  async listInactiveUsers(): Promise<ConfigUser[]> {
    try {
      console.log('[configuratorDataService.listInactiveUsers] GET /configurator-data/users?inactive=true');
      const { data } = await api.get('/configurator-data/users', { params: { inactive: true } });
      const list = extractList(data, 'users', 'results');
      console.log('[configuratorDataService.listInactiveUsers] Response:', list.length, 'users');
      return list;
    } catch (err: any) {
      console.error('[listInactiveUsers] Error:', err?.message);
      throw err;
    }
  },
};

export default configuratorDataService;
