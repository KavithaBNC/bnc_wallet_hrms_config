/**
 * Configurator API Service
 * HRMS fetches auth, modules, permissions from Configurator (RAG API)
 * Base URL: http://bnc-ai.com:8001
 */

import axios, { AxiosError } from 'axios';
import jwt from 'jsonwebtoken';
import { config } from '../config/config';
import { AppError } from '../middlewares/errorHandler';

const CONFIGURATOR_BASE = config.configuratorApiUrl;
const HRMS_PROJECT_ID = config.configuratorHrmsProjectId;

export interface ConfiguratorLoginRequest {
  username: string;
  password: string;
  company_id: number;
}

export interface ConfiguratorLoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  /** Role id from Config - use with GET /api/v1/user-roles/{role_id} */
  user_role_id?: number;
  user?: {
    id: number;
    email: string;
    first_name?: string;
    last_name?: string;
    company_id?: number;
    role_id?: number;
    roles?: Array<{ id: number; code: string; name: string }>;
  };
}

/** Role from GET /api/v1/user-roles/{role_id} */
export interface ConfiguratorRole {
  id: number;
  name: string;
  code: string;
  description?: string;
  company_id?: number;
  is_active?: boolean;
}

export interface ConfiguratorModule {
  id: number;
  name: string;
  code: string;
  description?: string;
  project_id?: number;
  parent_module?: number | null;
  is_active: boolean;
  /** Route path - from Config DB page_name (preferred), path, or fallback mapping */
  path?: string;
  /** Config DB project_modules.page_name - frontend route path */
  page_name?: string;
}

export interface ConfiguratorRefreshRequest {
  refresh_token: string;
}

/** Role module permission from GET /api/v1/user-role-modules/ */
export interface ConfiguratorRoleModulePermission {
  id: number;
  company_id: number;
  role_id: number;
  project_id: number;
  module_id: number;
  is_enabled: boolean;
}

/** Decoded Configurator JWT payload (sub = user id) */
export interface ConfiguratorTokenPayload {
  sub: string;
  email?: string;
  company_id?: number;
  exp?: number;
  type?: string;
}

export class ConfiguratorService {
  /** Decode Configurator JWT without verification (we trust it from Configurator API) */
  decodeToken(accessToken: string): ConfiguratorTokenPayload | null {
    try {
      const decoded = jwt.decode(accessToken) as ConfiguratorTokenPayload;
      return decoded;
    } catch {
      return null;
    }
  }

  /**
   * Login via Configurator API
   * POST /api/v1/auth/login
   */
  async login(data: ConfiguratorLoginRequest): Promise<ConfiguratorLoginResponse> {
    try {
      const res = await axios.post<ConfiguratorLoginResponse>(
        `${CONFIGURATOR_BASE}/api/v1/auth/login`,
        {
          username: data.username,
          password: data.password,
          company_id: data.company_id,
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 15000,
        }
      );
      return res.data;
    } catch (err) {
      const axiosErr = err as AxiosError<{ detail?: string | Array<{ msg?: string }>; message?: string }>;
      if (axiosErr.response?.status === 401) {
        throw new AppError('Invalid username or password', 401);
      }
      if (axiosErr.response?.status === 422) {
        const detail = axiosErr.response.data?.detail;
        const msg = Array.isArray(detail)
          ? detail.map((d) => d.msg || JSON.stringify(d)).join(', ')
          : String(detail || 'Validation error');
        throw new AppError(msg || 'Invalid request', 422);
      }
      if (
        axiosErr.code === 'ECONNREFUSED' ||
        axiosErr.code === 'ETIMEDOUT' ||
        axiosErr.code === 'ENOTFOUND' ||
        axiosErr.code === 'ECONNABORTED'
      ) {
        throw new AppError(
          'Configurator service unavailable. Please check CONFIGURATOR_API_URL and try again later.',
          503
        );
      }
      const data = axiosErr.response?.data as any;
      const msg =
        data?.message ||
        (typeof data?.detail === 'string' ? data.detail : null) ||
        (Array.isArray(data?.detail) ? data.detail.map((d: any) => d?.msg || d).join(', ') : null) ||
        'Login failed. Please try again.';
      throw new AppError(msg, axiosErr.response?.status || 500);
    }
  }

  /**
   * Refresh token via Configurator API
   * POST /api/v1/auth/token/refresh
   */
  async refreshToken(refreshToken: string): Promise<ConfiguratorLoginResponse> {
    try {
      const res = await axios.post<ConfiguratorLoginResponse>(
        `${CONFIGURATOR_BASE}/api/v1/auth/token/refresh`,
        { refresh_token: refreshToken },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 15000,
        }
      );
      return res.data;
    } catch (err) {
      const axiosErr = err as AxiosError;
      if (axiosErr.response?.status === 401) {
        throw new AppError('Invalid or expired refresh token', 401);
      }
      throw new AppError('Token refresh failed', axiosErr.response?.status || 500);
    }
  }

  /**
   * Get role by id from Configurator API
   * GET /api/v1/user-roles/{role_id}
   */
  async getUserRole(accessToken: string, roleId: number): Promise<ConfiguratorRole | null> {
    try {
      const res = await axios.get<ConfiguratorRole>(`${CONFIGURATOR_BASE}/api/v1/user-roles/${roleId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 10000,
      });
      return res.data ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Get modules for HRMS project
   * Tries GET /api/v1/modules?project_id=X and GET /api/v1/project-modules?project_id=X
   * Returns modules from Config DB project_modules table.
   */
  async getModules(accessToken: string, projectId?: number): Promise<ConfiguratorModule[]> {
    const pid = projectId ?? HRMS_PROJECT_ID;
    const headers = { Authorization: `Bearer ${accessToken}` };
    const urls = [
      `${CONFIGURATOR_BASE}/api/v1/modules`,
      `${CONFIGURATOR_BASE}/api/v1/project-modules`,
    ];
    for (const url of urls) {
      try {
        const res = await axios.get<ConfiguratorModule[] | { modules?: ConfiguratorModule[] }>(
          url,
          { params: { project_id: pid }, headers, timeout: 15000 }
        );
        const arr = Array.isArray(res.data) ? res.data : (res.data as any)?.modules;
        if (Array.isArray(arr)) return arr;
      } catch {
        // Try next URL
      }
    }
    return [];
  }

  /**
   * Get role-module permissions from Configurator
   * GET /api/v1/user-role-modules/{role_id}/{project_id}
   * Returns role_module_permissions from Config DB.
   */
  async getUserRoleModules(
    accessToken: string,
    roleId: number,
    companyId: number,
    projectId?: number
  ): Promise<ConfiguratorRoleModulePermission[]> {
    const pid = projectId ?? HRMS_PROJECT_ID;
    try {
      const res = await axios.get<
        ConfiguratorRoleModulePermission[] | { data?: ConfiguratorRoleModulePermission[] }
      >(`${CONFIGURATOR_BASE}/api/v1/user-role-modules/${roleId}/${pid}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 15000,
      });
      const raw = res.data;
      const list = Array.isArray(raw) ? raw : (Array.isArray((raw as any)?.data) ? (raw as any).data : []);
      return list.filter((p: ConfiguratorRoleModulePermission) => p.company_id === companyId && p.project_id === pid);
    } catch (err) {
      const axiosErr = err as AxiosError;
      if (axiosErr.response?.status === 401) {
        throw new AppError('Invalid or expired token. Please login again.', 401);
      }
      if (axiosErr.code === 'ECONNREFUSED' || axiosErr.code === 'ETIMEDOUT') {
        throw new AppError('Configurator service unavailable.', 503);
      }
      throw new AppError(
        'Failed to fetch role modules',
        axiosErr.response?.status || 500
      );
    }
  }

  /**
   * Get user-assigned modules using /api/v1/user-role-modules/{role_id}/{project_id} + /api/v1/modules
   * 1. Get role_module_permissions for user's role(s) (is_enabled=true)
   * 2. Get all project modules
   * 3. Return only modules that are enabled for any of the roles
   */
  async getUserAssignedModules(
    accessToken: string,
    roleId: number,
    companyId: number,
    projectId?: number
  ): Promise<ConfiguratorModule[]> {
    return this.getUserAssignedModulesForRoles(accessToken, [roleId], companyId, projectId);
  }

  /**
   * Get user-assigned modules for multiple roles (merge from Config DB).
   * User sees module if ANY of their roles has is_enabled=true.
   */
  async getUserAssignedModulesForRoles(
    accessToken: string,
    roleIds: number[],
    companyId: number,
    projectId?: number
  ): Promise<ConfiguratorModule[]> {
    const pid = projectId ?? HRMS_PROJECT_ID;
    const enabledModuleIds = new Set<number>();

    for (const roleId of roleIds) {
      try {
        const permissions = await this.getUserRoleModules(accessToken, roleId, companyId, projectId);
        for (const p of permissions) {
          if (p.company_id === companyId && p.project_id === pid && p.is_enabled) {
            enabledModuleIds.add(p.module_id);
          }
        }
      } catch {
        // Skip failed role, continue with others
      }
    }

    if (enabledModuleIds.size === 0) {
      return [];
    }

    const allModules = await this.getModules(accessToken, projectId);
    return allModules.filter((m) => enabledModuleIds.has(m.id));
  }

  /**
   * Create department in Config DB
   * POST /api/v1/departments/
   */
  async createDepartment(
    accessToken: string,
    data: {
      name: string;
      code?: string;
      cost_centre_id?: number;
      company_id: number;
      description?: string;
      manager_id?: number;
      cost_centre_name?: string;
      branch_id?: number;
      location?: string;
    }
  ): Promise<{ id: number; name: string; code?: string }> {
    const res = await axios.post(
      `${CONFIGURATOR_BASE}/api/v1/departments/`,
      data,
      {
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        timeout: 15000,
      }
    );
    return res.data;
  }

  /**
   * Create sub-department in Config DB
   * POST /api/v1/sub-departments/
   */
  async createSubDepartment(
    accessToken: string,
    data: {
      name: string;
      code?: string;
      department_id: number;
      company_id: number;
      costcenter_id?: string;
    }
  ): Promise<{ id: number; name: string; code?: string }> {
    if (!data.department_id) {
      throw new AppError('department_id is required for Config sub-department', 400);
    }
    const res = await axios.post(
      `${CONFIGURATOR_BASE}/api/v1/sub-departments/`,
      data,
      {
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        timeout: 15000,
      }
    );
    return res.data;
  }

  /**
   * Get departments from Config DB
   * GET /api/v1/departments/?company_id=X&cost_centre_id=Y&skip=0&limit=500
   */
  async getDepartments(
    accessToken: string,
    opts: { companyId: number; costCentreId?: number }
  ): Promise<any[]> {
    try {
      const params: Record<string, number> = { company_id: opts.companyId, skip: 0, limit: 500 };
      if (opts.costCentreId != null) params.cost_centre_id = opts.costCentreId;
      const res = await axios.get(`${CONFIGURATOR_BASE}/api/v1/departments/`, {
        params,
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 15000,
      });
      const data = res.data;
      return Array.isArray(data) ? data : (data?.data ?? data?.departments ?? []);
    } catch {
      return [];
    }
  }

  /**
   * Get sub-departments from Config DB
   * GET /api/v1/sub-departments/?company_id=X or ?department_id=Y
   */
  async getSubDepartments(
    accessToken: string,
    opts: { companyId: number; departmentId?: number }
  ): Promise<any[]> {
    try {
      const params: Record<string, number> = { company_id: opts.companyId };
      if (opts.departmentId != null) params.department_id = opts.departmentId;
      const res = await axios.get(`${CONFIGURATOR_BASE}/api/v1/sub-departments/`, {
        params: { ...params, skip: 0, limit: 500 },
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 15000,
      });
      const data = res.data;
      return Array.isArray(data) ? data : (data?.data ?? data?.sub_departments ?? []);
    } catch {
      return [];
    }
  }

  /**
   * Create cost centre in Config DB
   * POST /api/v1/cost-centres/
   */
  async createCostCentre(
    accessToken: string,
    data: { name: string; code: string; company_id: number }
  ): Promise<{ id: number; name: string; code: string }> {
    const res = await axios.post(
      `${CONFIGURATOR_BASE}/api/v1/cost-centres/`,
      data,
      {
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        timeout: 15000,
      }
    );
    return res.data;
  }

  /**
   * Get cost centres from Config DB
   * GET /api/v1/cost-centres/?company_id=X&skip=0&limit=500
   */
  async getCostCentres(accessToken: string, companyId: number): Promise<any[]> {
    try {
      const res = await axios.get(`${CONFIGURATOR_BASE}/api/v1/cost-centres/`, {
        params: { company_id: companyId, skip: 0, limit: 500 },
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 15000,
      });
      const data = res.data;
      return Array.isArray(data) ? data : (data?.data ?? data?.cost_centres ?? []);
    } catch {
      return [];
    }
  }

  /**
   * Create user in Config DB users table
   * POST /api/v1/users/
   */
  async createUser(
    accessToken: string,
    data: {
      email: string;
      first_name?: string;
      last_name?: string;
      phone?: string;
      company_id: number;
      role_id?: number;
      password: string;
      username?: string;
    }
  ): Promise<{ id: number; email: string; first_name?: string; last_name?: string }> {
    try {
      const res = await axios.post(
        `${CONFIGURATOR_BASE}/api/v1/users/`,
        {
          email: data.email,
          first_name: data.first_name ?? '',
          last_name: data.last_name ?? '',
          phone: data.phone ?? '',
          company_id: data.company_id,
          role_id: data.role_id ?? 0,
          password: data.password,
          username: data.username ?? data.email.split('@')[0],
        },
        {
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          timeout: 15000,
        }
      );
      return res.data;
    } catch (err: any) {
      const axiosErr = err as AxiosError<{ detail?: string }>;
      if (axiosErr.response?.status === 400 || axiosErr.response?.status === 422) {
        const msg = typeof axiosErr.response?.data?.detail === 'string'
          ? axiosErr.response.data.detail
          : JSON.stringify(axiosErr.response?.data ?? 'User creation failed');
        throw new AppError(msg, axiosErr.response.status);
      }
      throw err;
    }
  }

  /**
   * Update user in Config DB users table
   * PUT /api/v1/users/{user_id}
   */
  async updateUser(
    accessToken: string,
    userId: number,
    data: {
      email?: string;
      first_name?: string;
      last_name?: string;
      phone?: string;
      company_id?: number;
      role_id?: number;
      password?: string;
      is_active?: boolean;
    }
  ): Promise<{ id: number; email: string; first_name?: string; last_name?: string }> {
    try {
      const body: Record<string, unknown> = {
        email: data.email ?? '',
        first_name: data.first_name ?? '',
        last_name: data.last_name ?? '',
        phone: data.phone ?? '',
        company_id: data.company_id ?? 0,
        role_id: data.role_id ?? 0,
        is_active: data.is_active ?? true,
      };
      if (data.password != null && data.password !== '') {
        body.password = data.password;
      }
      const res = await axios.put(
        `${CONFIGURATOR_BASE}/api/v1/users/${userId}`,
        body,
        {
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          timeout: 15000,
        }
      );
      return res.data;
    } catch (err: any) {
      const axiosErr = err as AxiosError<{ detail?: string }>;
      if (axiosErr.response?.status === 400 || axiosErr.response?.status === 404) {
        const msg = typeof axiosErr.response?.data?.detail === 'string'
          ? axiosErr.response.data.detail
          : JSON.stringify(axiosErr.response?.data ?? 'User update failed');
        throw new AppError(msg, axiosErr.response.status);
      }
      throw err;
    }
  }
}

export const configuratorService = new ConfiguratorService();
