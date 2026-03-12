/**
 * Configurator API Service
 * HRMS fetches auth, modules, permissions from Configurator (RAG API)
 * Base URL: configured via CONFIGURATOR_API_URL env var
 */

import axios, { AxiosError } from 'axios';
import jwt from 'jsonwebtoken';
import { config } from '../config/config';
import { AppError } from '../middlewares/errorHandler';

let CONFIGURATOR_BASE = config.configuratorApiUrl;
const CONFIGURATOR_FALLBACK = config.configuratorApiFallbackUrl;
const HRMS_PROJECT_ID = config.configuratorHrmsProjectId;

/**
 * Try a request to the primary URL; if it fails with a connection error
 * and a fallback URL is configured, retry on the fallback and switch
 * CONFIGURATOR_BASE for subsequent calls.
 */
async function withFallback<T>(fn: (base: string) => Promise<T>): Promise<T> {
  try {
    return await fn(CONFIGURATOR_BASE);
  } catch (err) {
    const code = (err as AxiosError)?.code;
    if (
      CONFIGURATOR_FALLBACK &&
      CONFIGURATOR_FALLBACK !== CONFIGURATOR_BASE &&
      (code === 'ECONNREFUSED' || code === 'ETIMEDOUT' || code === 'ENOTFOUND' || code === 'ECONNABORTED')
    ) {
      console.log(`[configuratorService] Primary URL unreachable (${code}), switching to fallback: ${CONFIGURATOR_FALLBACK}`);
      CONFIGURATOR_BASE = CONFIGURATOR_FALLBACK;
      return await fn(CONFIGURATOR_BASE);
    }
    throw err;
  }
}

export interface ConfiguratorLoginRequest {
  username: string;
  password: string;
  company_id?: number;
  company_name_or_code?: string;
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
  company?: {
    id: number;
    name: string;
    code?: string;
    is_active?: boolean;
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

/** Role module permission from POST /api/v1/user-role-modules/project (includes page_name) */
export interface ConfiguratorRoleModuleWithPage {
  id: number;
  company_id: number;
  role_id: number;
  project_id: number;
  module_id: number;
  is_enabled: boolean;
  page_name?: string;
  page_name_mobile?: string;
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
   * Step 1: Verify company exists via Configurator API
   * POST /api/v1/auth/login with only { company_name_or_code }
   * Returns the raw response from the external API (success, step, message, etc.)
   */
  async verifyCompany(companyNameOrCode: string): Promise<any> {
    return withFallback(async (base) => {
      const url = `${base}/api/v1/auth/login`;
      console.log('[verifyCompany] POST', url);
      try {
        const res = await axios.post(
          url,
          { company_name_or_code: companyNameOrCode },
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: 15000,
          }
        );
        console.log('[verifyCompany] OK — company:', res.data?.company?.name || 'verified');
        return res.data;
      } catch (err) {
        const axiosErr = err as AxiosError<any>;
        console.warn('[verifyCompany] Error:', axiosErr.response?.status);
        if (axiosErr.response?.data) {
          return axiosErr.response.data;
        }
        throw err; // let withFallback handle connection errors
      }
    });
  }

  /**
   * Login via Configurator API
   * POST /api/v1/auth/login
   */
  async login(data: ConfiguratorLoginRequest): Promise<ConfiguratorLoginResponse> {
    return withFallback(async (base) => {
      const url = `${base}/api/v1/auth/login`;
      const payload: Record<string, any> = {
        username: data.username,
        password: data.password,
      };
      if (data.company_name_or_code) payload.company_name_or_code = data.company_name_or_code;
      if (data.company_id) payload.company_id = data.company_id;
      console.log('[configuratorService.login] POST', url, '— user:', data.username);
      try {
        const res = await axios.post<ConfiguratorLoginResponse & { success?: boolean; message?: string }>(
          url,
          payload,
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: 15000,
          }
        );
        const body = res.data as any;
        if (body.success === false) {
          console.error('[configuratorService.login] API returned success:false —', body.message);
          const rawMsg = (body.message || '').toLowerCase();
          let userMsg = 'Invalid username or password';
          if (rawMsg.includes('company not found')) {
            userMsg = 'Company not found. Please check the name or code.';
          } else if (rawMsg.includes('user not found') || rawMsg.includes('no user')) {
            userMsg = 'Invalid username or password';
          }
          throw new AppError(userMsg, 401);
        }
        if (!res.data.access_token) {
          throw new AppError('Login failed: no access token received', 401);
        }
        console.log('[configuratorService.login] Success — user_role_id:', res.data.user_role_id, 'user:', res.data.user?.email);
        return res.data;
      } catch (err) {
        if (err instanceof AppError) throw err;
        const axiosErr = err as AxiosError<{ detail?: string | Array<{ msg?: string }>; message?: string }>;
        console.error('[configuratorService.login] Error:', axiosErr.response?.status || axiosErr.code);
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
        // Re-throw connection errors for withFallback to handle
        throw err;
      }
    });
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
      `${CONFIGURATOR_BASE}/api/v1/modules/my-modules`,
      `${CONFIGURATOR_BASE}/api/v1/modules`,
      `${CONFIGURATOR_BASE}/api/v1/project-modules`,
    ];
    for (const url of urls) {
      try {
        // Try each modules endpoint in order
        const res = await axios.get<ConfiguratorModule[] | { modules?: ConfiguratorModule[] }>(
          url,
          { params: { project_id: pid }, headers, timeout: 15000 }
        );
        const arr = Array.isArray(res.data) ? res.data : (res.data as any)?.modules;
        if (Array.isArray(arr) && arr.length > 0) {
          console.log('[configuratorService.getModules] Got', arr.length, 'modules');
          return arr;
        }
      } catch (e: any) {
        // Endpoint not available, try next
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
   * Get role-module permissions via POST /api/v1/user-role-modules/project
   * Returns modules with page_name and is_enabled in a single call.
   */
  async getRoleModulesByProject(
    accessToken: string,
    roleId: number,
    projectId?: number
  ): Promise<ConfiguratorRoleModuleWithPage[]> {
    const pid = projectId ?? HRMS_PROJECT_ID;
    try {
      const res = await axios.post<ConfiguratorRoleModuleWithPage[]>(
        `${CONFIGURATOR_BASE}/api/v1/user-role-modules/project`,
        { role_id: roleId, project_id: pid },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        }
      );
      const data = res.data;
      return Array.isArray(data) ? data : (data as any)?.data ?? [];
    } catch (err) {
      const axiosErr = err as AxiosError;
      if (axiosErr.response?.status === 401) {
        throw new AppError('Invalid or expired token. Please login again.', 401);
      }
      if (axiosErr.code === 'ECONNREFUSED' || axiosErr.code === 'ETIMEDOUT') {
        throw new AppError('Configurator service unavailable.', 503);
      }
      throw new AppError(
        'Failed to fetch role modules by project',
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
   * Payload: { company_id, name, is_active }
   */
  async createDepartment(
    accessToken: string,
    data: {
      name: string;
      company_id: number;
      is_active?: boolean;
      // Extra fields accepted for type compatibility but NOT sent to the API
      code?: string;
      cost_centre_id?: number;
      description?: string;
      manager_id?: number;
      cost_centre_name?: string;
      branch_id?: number;
      location?: string;
    }
  ): Promise<{ id: number; name: string; company_id: number }> {
    const payload: Record<string, any> = {
      company_id: data.company_id,
      name: data.name,
      is_active: data.is_active ?? true,
    };
    if (data.cost_centre_id != null) payload.cost_centre_id = data.cost_centre_id;
    console.log('[configuratorService.createDepartment]', data.name);
    try {
      const res = await axios.post(
        `${CONFIGURATOR_BASE}/api/v1/departments/`,
        payload,
        {
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          timeout: 15000,
        }
      );
      console.log('[configuratorService.createDepartment] OK — id:', res.data?.id);
      return res.data;
    } catch (err: any) {
      const errData = err.response?.data;
      const status = err.response?.status;
      console.error('[configuratorService.createDepartment] FAILED:', status);
      throw new AppError(
        errData?.detail || errData?.message || `Configurator API error ${status}: Failed to create department`,
        status || 500
      );
    }
  }

  /**
   * Create sub-department in Config DB
   * POST /api/v1/sub-departments/
   * Payload: { company_id, name, is_active }
   */
  async createSubDepartment(
    accessToken: string,
    data: {
      name: string;
      company_id: number;
      department_id?: number;
      is_active?: boolean;
      // Extra fields accepted for type compatibility but NOT sent to the API
      code?: string;
      costcenter_id?: string;
    }
  ): Promise<{ id: number; name: string; company_id: number }> {
    const payload: Record<string, any> = {
      company_id: data.company_id,
      name: data.name,
      is_active: data.is_active ?? true,
    };
    if (data.department_id != null) payload.department_id = data.department_id;
    if (data.costcenter_id != null) payload.costcenter_id = data.costcenter_id;
    console.log('[configuratorService.createSubDepartment]', data.name);
    try {
      const res = await axios.post(
        `${CONFIGURATOR_BASE}/api/v1/sub-departments/`,
        payload,
        {
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          timeout: 15000,
        }
      );
      console.log('[configuratorService.createSubDepartment] OK — id:', res.data?.id);
      return res.data;
    } catch (err: any) {
      const errData = err.response?.data;
      const status = err.response?.status;
      console.error('[configuratorService.createSubDepartment] FAILED:', status);
      throw new AppError(
        errData?.detail || errData?.message || `Configurator API error ${status}: Failed to create sub-department`,
        status || 500
      );
    }
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
      // Fetch departments from Configurator
      const res = await axios.get(`${CONFIGURATOR_BASE}/api/v1/departments/`, {
        params,
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 15000,
      });
      const data = res.data;
      const result = Array.isArray(data) ? data : (data?.data ?? data?.departments ?? []);
      // departments fetched
      return result;
    } catch (err: any) {
      console.error('[configuratorService.getDepartments] FAILED:', err.response?.status);
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
      // Fetch sub-departments from Configurator
      const res = await axios.get(`${CONFIGURATOR_BASE}/api/v1/sub-departments/`, {
        params: { ...params, skip: 0, limit: 500 },
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 15000,
      });
      const data = res.data;
      const result = Array.isArray(data) ? data : (data?.data ?? data?.sub_departments ?? []);
      // sub-departments fetched
      return result;
    } catch (err: any) {
      console.error('[configuratorService.getSubDepartments] FAILED:', err.response?.status);
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
   * POST /api/v1/users/add
   */
  async createUser(
    accessToken: string,
    data: {
      email: string;
      first_name?: string;
      last_name?: string;
      phone?: string;
      company_id: number;
      project_id?: number;
      role_id?: number;
      cost_centre_id?: number;
      department_id?: number;
      sub_department_id?: number;
      password: string;
      username?: string;
    }
  ): Promise<{ id: number; email: string; first_name?: string; last_name?: string }> {
    try {
      const res = await axios.post(
        `${CONFIGURATOR_BASE}/api/v1/users/add`,
        {
          email: data.email,
          first_name: data.first_name ?? '',
          last_name: data.last_name ?? '',
          phone: data.phone ?? '',
          company_id: data.company_id,
          project_id: data.project_id ?? 0,
          role_id: data.role_id ?? 0,
          cost_centre_id: data.cost_centre_id ?? 0,
          department_id: data.department_id ?? 0,
          sub_department_id: data.sub_department_id ?? 0,
          password: data.password,
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
      department_id?: number | null;
      cost_centre_id?: number | null;
      sub_department_id?: number | null;
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
      if (data.department_id != null) body.department_id = data.department_id;
      if (data.cost_centre_id != null) body.cost_centre_id = data.cost_centre_id;
      if (data.sub_department_id != null) body.sub_department_id = data.sub_department_id;
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
