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
   * GET /api/v1/modules?project_id=X
   * Requires Authorization: Bearer <access_token>
   * Returns modules from Config DB project_modules table.
   * When called with user token, Configurator should return only modules assigned to user's role
   * (filtered by role_module_permissions where is_enabled=true).
   */
  async getModules(accessToken: string, projectId?: number): Promise<ConfiguratorModule[]> {
    const pid = projectId ?? HRMS_PROJECT_ID;
    try {
      const res = await axios.get<ConfiguratorModule[]>(
        `${CONFIGURATOR_BASE}/api/v1/modules`,
        {
          params: { project_id: pid },
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          timeout: 15000,
        }
      );
      return Array.isArray(res.data) ? res.data : [];
    } catch (err) {
      const axiosErr = err as AxiosError;
      if (axiosErr.response?.status === 401) {
        throw new AppError('Invalid or expired token. Please login again.', 401);
      }
      if (axiosErr.code === 'ECONNREFUSED' || axiosErr.code === 'ETIMEDOUT') {
        throw new AppError('Configurator service unavailable.', 503);
      }
      throw new AppError(
        'Failed to fetch modules',
        axiosErr.response?.status || 500
      );
    }
  }

  /**
   * Get user-assigned modules (role-module-permission filtered).
   * Tries GET /api/v1/user/modules first; falls back to getModules.
   * Configurator should return only modules from project_modules where
   * role_module_permissions has is_enabled=true for user's roles.
   */
  async getUserAssignedModules(
    accessToken: string,
    projectId?: number
  ): Promise<ConfiguratorModule[]> {
    const pid = projectId ?? HRMS_PROJECT_ID;
    try {
      const res = await axios.get<ConfiguratorModule[]>(
        `${CONFIGURATOR_BASE}/api/v1/user/modules`,
        {
          params: { project_id: pid },
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 15000,
        }
      );
      if (Array.isArray(res.data)) return res.data;
    } catch {
      // Fallback: /user/modules may not exist; use /modules (Configurator may filter by token)
    }
    return this.getModules(accessToken, projectId);
  }
}

export const configuratorService = new ConfiguratorService();
