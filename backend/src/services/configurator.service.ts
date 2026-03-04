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
  user?: {
    id: number;
    email: string;
    first_name?: string;
    last_name?: string;
    company_id?: number;
    roles?: Array<{ id: number; code: string; name: string }>;
  };
}

export interface ConfiguratorModule {
  id: number;
  name: string;
  code: string;
  description?: string;
  project_id?: number;
  parent_module?: number | null;
  is_active: boolean;
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
      const axiosErr = err as AxiosError<{ detail?: string | Array<{ msg?: string }> }>;
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
      if (axiosErr.code === 'ECONNREFUSED' || axiosErr.code === 'ETIMEDOUT') {
        throw new AppError('Configurator service unavailable. Please try again later.', 503);
      }
      throw new AppError(
        (axiosErr.response?.data as any)?.detail || 'Login failed',
        axiosErr.response?.status || 500
      );
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
   * GET /api/v1/user-role-modules/?role_id=X
   * API may support company_id, project_id; we filter response by company_id, project_id
   */
  async getUserRoleModules(
    accessToken: string,
    roleId: number,
    companyId: number,
    projectId?: number
  ): Promise<ConfiguratorRoleModulePermission[]> {
    const pid = projectId ?? HRMS_PROJECT_ID;
    try {
      const params: Record<string, number> = { role_id: roleId };
      const res = await axios.get<ConfiguratorRoleModulePermission[] | { data?: ConfiguratorRoleModulePermission[] }>(
        `${CONFIGURATOR_BASE}/api/v1/user-role-modules/`,
        {
          params,
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 15000,
        }
      );
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
   * Get user-assigned modules using /api/v1/user-role-modules/ + /api/v1/modules
   * 1. Get role_module_permissions for user's role (is_enabled=true)
   * 2. Get all project modules
   * 3. Return only modules that are enabled for the role
   */
  async getUserAssignedModules(
    accessToken: string,
    roleId: number,
    companyId: number,
    projectId?: number
  ): Promise<ConfiguratorModule[]> {
    const pid = projectId ?? HRMS_PROJECT_ID;

    // 1. Get role-module permissions (is_enabled=true for this role, company, project)
    const permissions = await this.getUserRoleModules(accessToken, roleId, companyId, projectId);
    const enabledModuleIds = new Set(
      permissions
        .filter((p) => p.company_id === companyId && p.project_id === pid && p.is_enabled)
        .map((p) => p.module_id)
    );

    if (enabledModuleIds.size === 0) {
      return [];
    }

    // 2. Get all project modules (may need token; some APIs are public for project modules)
    const allModules = await this.getModules(accessToken, projectId);

    // 3. Filter to only enabled modules
    return allModules.filter((m) => enabledModuleIds.has(m.id));
  }
}

export const configuratorService = new ConfiguratorService();
