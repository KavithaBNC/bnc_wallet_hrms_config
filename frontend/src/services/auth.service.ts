import axios from 'axios';
import api from './api';

/**
 * Configurator API base URL.
 * Proxied through Vite dev server: /configurator-api/* → http://localhost:8000/*
 */
const CONFIGURATOR_BASE = '/configurator-api';

/** Axios instance for Configurator API */
const configuratorApi = axios.create({
  baseURL: CONFIGURATOR_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

/**
 * Normalize role names from the Configurator API to UPPER_SNAKE_CASE
 * expected by frontend RBAC checks.
 * e.g. "Super Admin" → "SUPER_ADMIN", "HR Manager" → "HR_MANAGER"
 */
function normalizeRole(role: string): string {
  if (!role) return '';
  if (/^[A-Z_]+$/.test(role)) return role;
  return role.trim().toUpperCase().replace(/\s+/g, '_');
}

/**
 * Map Configurator module name → frontend sidebar route path.
 * Key: lowercase module name, Value: sidebar path.
 */
const MODULE_NAME_TO_PATH: Record<string, string> = {
  'dashboard': '/dashboard',
  'department': '/departments',
  'employees': '/employees',
  'positions': '/positions',
  'position': '/positions',
  'core hr': '/core-hr',
  'overview': '/core-hr/overview',
  'component creation': '/core-hr/compound-creation',
  'rules engine': '/core-hr/rules-engine',
  'variable input': '/core-hr/variable-input',
  'event configuration': '/event-configuration',
  'attendance components': '/event-configuration/attendance-components',
  'approval workflow': '/event-configuration/approval-workflow',
  'workflow mapping': '/event-configuration/workflow-mapping',
  'rights allocation': '/event-configuration/rights-allocation',
  'rule setting': '/event-configuration/rule-setting',
  'auto credit setting': '/event-configuration/auto-credit-setting',
  'encashment / carry forward': '/event-configuration/encashment-carry-forward',
  'hr activities': '/hr-activities',
  'validation process': '/hr-activities/validation-process',
  'others configuration': '/others-configuration',
  'validation process rule': '/others-configuration/validation-process-rule',
  'attendance lock': '/others-configuration/attendance-lock',
  'post to payroll': '/hr-activities/post-to-payroll',
  'post to payroll setup': '/others-configuration/post-to-payroll',
  'attendance': '/attendance',
  'excess time request': '/attendance/my-requests/excess-time-request',
  'excess time approval': '/attendance/excess-time-approval',
  'attendance policy': '/attendance-policy',
  'late & others': '/attendance-policy/late-and-others',
  'week of assign': '/attendance-policy/week-of-assign',
  'holiday assign': '/attendance-policy/holiday-assign',
  'excess time conversion': '/attendance-policy/excess-time-conversion',
  'ot usage rule': '/attendance-policy/ot-usage-rule',
  'event': '/leave',
  'event apply': '/attendance/apply-event',
  'event request': '/event/requests',
  'event approval': '/leave/approvals',
  'event balance entry': '/event/balance-entry',
  'time attendance': '/time-attendance',
  'shift master': '/time-attendance/shift-master',
  'shift assign': '/time-attendance/shift-assign',
  'associate shift change': '/time-attendance/associate-shift-change',
  'payroll': '/payroll',
  'payroll master': '/payroll-master',
  'employee separation': '/payroll/employee-separation',
  'employee rejoin': '/payroll/employee-rejoin',
  'salary structure': '/salary-structures',
  'employee salary': '/employee-salaries',
  'hr audit settings': '/hr-audit-settings',
  'employee master approval': '/employee-master-approval',
  'esop': '/esop',
  'add esop': '/esop/add',
  'transaction': '/transaction',
  'increment': '/transaction/transfer-promotions',
  'transfer and promotion entry': '/transaction/transfer-promotion-entry',
  'emp code transfer': '/transaction/emp-code-transfer',
  'pay group transfer': '/transaction/paygroup-transfer',
  'organization management': '/organizations',
  'module permission': '/permissions',
  'master': '/master',
  'cost centre': '/cost-centre-department',
};

export interface CreateOrganizationData {
  name: string;
  legalName?: string;
  industry?: string;
  sizeRange?: '1-10' | '11-50' | '51-200' | '201-500' | '501-1000' | '1000+';
  timezone?: string;
  currency?: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  organizationId?: string;
  createOrganization?: CreateOrganizationData;
}

export interface LoginData {
  company_name_or_code: string;
  username: string;
  password: string;
}

export interface CompanyVerifyResponse {
  success: boolean;
  step?: number;
  message?: string;
  company?: {
    id: number;
    name: string;
    code?: string;
  };
  [key: string]: any;
}

export interface ForgotPasswordData {
  email: string;
}

export interface ResetPasswordData {
  token: string;
  newPassword: string;
}

export interface User {
  id: string;
  email: string;
  role: string;
  fullname?: string;
  isEmailVerified: boolean;
  employee?: {
    id: string;
    organizationId: string;
    employeeCode?: string;
    firstName: string;
    lastName: string;
    profilePictureUrl?: string;
    department?: {
      name: string;
    };
    position?: {
      title: string;
    };
    organization?: {
      id: string;
      name: string;
    };
  };
}

export interface AuthResponse {
  user: User;
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

class AuthService {
  /**
   * Register a new user
   */
  async register(data: RegisterData) {
    const response = await api.post('/auth/register', data);
    return response.data;
  }

  /**
   * Step 1: Verify company exists by name or code
   * Calls Configurator API directly: POST /api/v1/auth/login with only { company_name_or_code }
   */
  async verifyCompany(companyNameOrCode: string): Promise<CompanyVerifyResponse> {
    try {
      const response = await configuratorApi.post('/api/v1/auth/login', {
        company_name_or_code: companyNameOrCode,
      });
      return response.data;
    } catch (error: any) {
      // Configurator may return error in response body (e.g. 404 for unknown company)
      if (error.response?.data) {
        return error.response.data;
      }
      throw error;
    }
  }

  /**
   * Step 2: Login user with company + credentials
   * Calls Configurator API directly: POST /api/v1/auth/login
   *
   * After successful login, extracts project_id and role_id from
   * projects[0] and immediately fetches role modules via
   * GET /api/v1/modules/my-modules?project_id=X&role_id=Y (with Bearer token).
   */
  async login(data: LoginData): Promise<AuthResponse> {
    // ── Step 2a: Call login API ──
    const response = await configuratorApi.post('/api/v1/auth/login', {
      company_name_or_code: data.company_name_or_code,
      username: data.username,
      password: data.password,
    });

    const res = response.data;

    // Check success flag from Configurator API
    if (res.success !== true) {
      throw new Error(res.message || 'Login failed. Please check your credentials.');
    }

    // Extract tokens from flat Configurator response
    const tokens = {
      accessToken: res.access_token || '',
      refreshToken: res.refresh_token || '',
    };

    // Extract user details from Configurator response
    const apiUser = res.user || {};
    const company = res.company || {};
    const projects: any[] = Array.isArray(res.projects) ? res.projects : [];

    // Extract role from the HRMS project (or first project)
    const hrmsProject = projects.find((p: any) => p.code === 'HRMS001' || p.name === 'HRMS') || projects[0];
    const projectRoleName = hrmsProject?.role_name || '';
    const projectRoleCode = hrmsProject?.role_code || '';

    const user: User = {
      id: String(apiUser.id || ''),
      email: apiUser.email || '',
      role: normalizeRole(projectRoleCode || projectRoleName || apiUser.role_name || ''),
      fullname: apiUser.fullname || '',
      isEmailVerified: true,
    };

    // ── Save tokens to localStorage ──
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    localStorage.setItem('user', JSON.stringify(user));

    // Store Configurator access token for direct Configurator API calls (departments, etc.)
    localStorage.setItem('configuratorAccessToken', tokens.accessToken);

    // Store company details
    if (company.id != null) {
      localStorage.setItem('configuratorCompanyId', String(company.id));
    }
    if (company.name) {
      localStorage.setItem('companyName', company.name);
    }
    if (company.code) {
      localStorage.setItem('companyCode', company.code);
    }

    // Store project details
    if (projects.length > 0) {
      localStorage.setItem('projects', JSON.stringify(projects));
      if (hrmsProject?.id != null) {
        localStorage.setItem('configuratorProjectId', String(hrmsProject.id));
      }
    }

    // Keep original Configurator token for Configurator API calls (modules, etc.)
    const configuratorAccessToken = tokens.accessToken;

    // ── Step 2b: Sync with HRMS backend to get employee/organization data ──
    // Call HRMS backend configurator login — it syncs/creates the HRMS user record
    // and returns employee data with organizationId.
    try {
      const hrmsLoginRes = await api.post('/auth/configurator/login', {
        username: data.username,
        password: data.password,
        company_name_or_code: data.company_name_or_code,
      });
      const hrmsData = hrmsLoginRes.data?.data;
      if (hrmsData) {
        // Use HRMS tokens for HRMS backend API calls
        if (hrmsData.tokens?.accessToken) {
          tokens.accessToken = hrmsData.tokens.accessToken;
          tokens.refreshToken = hrmsData.tokens.refreshToken || tokens.refreshToken;
          localStorage.setItem('accessToken', tokens.accessToken);
          localStorage.setItem('refreshToken', tokens.refreshToken);
        }
        // Merge employee data into user
        if (hrmsData.user?.employee) {
          user.id = hrmsData.user.id || user.id;
          user.employee = hrmsData.user.employee;
          user.role = normalizeRole(hrmsData.user.role || user.role);
        }
        localStorage.setItem('user', JSON.stringify(user));
      }
    } catch (err) {
      console.warn('HRMS backend sync failed (employee data may be unavailable):', err);
    }

    // ── Step 2c: Fetch role modules using Configurator token ──
    if (hrmsProject?.id != null && hrmsProject?.role_id != null) {
      try {
        const modules = await this.fetchRoleModules(hrmsProject.role_id, hrmsProject.id, configuratorAccessToken);
        if (modules.length > 0) {
          localStorage.setItem('modules', JSON.stringify(modules));
        }
      } catch (err) {
        console.warn('Failed to fetch role modules after login:', err);
      }
    }

    return { user, tokens };
  }

  /**
   * Check if modules are enabled by calling POST /api/v1/user-role-modules/project.
   * Returns true only when the API responds successfully with data.
   * Also stores per-module permission flags (can_view, can_add, can_edit, can_delete)
   * in localStorage keyed by page path for use by page components.
   */
  private async checkUserRoleModulesProject(roleId: number, projectId: number, accessToken: string): Promise<boolean> {
    try {
      const response = await configuratorApi.post(
        '/api/v1/user-role-modules/project',
        { role_id: roleId, project_id: projectId },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const data = response.data;
      const list = Array.isArray(data) ? data : (data?.data ?? []);
      if (!Array.isArray(list) || list.length === 0) return false;

      // Build permissions map: path → { can_view, can_add, can_edit, can_delete }
      const permissionsMap: Record<string, { can_view: boolean; can_add: boolean; can_edit: boolean; can_delete: boolean }> = {};
      for (const item of list) {
        // Resolve path from page_name or module name
        const pageName = (item.page_name || '').toLowerCase().trim();
        const moduleName = (item.module_name || item.name || '').toLowerCase().trim();
        const path = MODULE_NAME_TO_PATH[pageName] || MODULE_NAME_TO_PATH[moduleName] || pageName || '';
        if (path) {
          permissionsMap[path] = {
            can_view: item.can_view === true || item.can_view === 1,
            can_add: item.can_add === true || item.can_add === 1,
            can_edit: item.can_edit === true || item.can_edit === 1,
            can_delete: item.can_delete === true || item.can_delete === 1,
          };
        }
      }
      localStorage.setItem('modulePermissions', JSON.stringify(permissionsMap));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Step 3: Fetch modules for the logged-in user's role
   * GET /api/v1/modules/my-modules?project_id=X&role_id=Y
   * Authorization: Bearer {accessToken} (token from login response)
   *
   * project_id → projects[0].id from login response
   * role_id    → projects[0].role_id from login response
   *
   * Returns modules mapped to the ConfiguratorModule format
   * that the sidebar/DashboardLayout expects.
   *
   * Modules are only returned when POST /api/v1/user-role-modules/project
   * responds successfully with data; otherwise an empty array is returned.
   */
  async fetchRoleModules(roleId: number, projectId: number, accessToken: string): Promise<any[]> {
    // Gate: only enable modules when /api/v1/user-role-modules/project returns data
    const enabled = await this.checkUserRoleModulesProject(roleId, projectId, accessToken);
    if (!enabled) {
      return [];
    }

    const response = await configuratorApi.get('/api/v1/modules/my-modules', {
      params: { project_id: projectId, role_id: roleId },
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const rawModules: any[] = Array.isArray(response.data)
      ? response.data
      : (response.data?.data ?? response.data?.modules ?? []);

    // Map API modules to frontend-friendly objects for the sidebar
    // API returns: { id, name, code, project_id, is_active, parent_module_id, parent_module: { id, name, code } }
    // Sidebar needs: { name, code, path, parent_module_id, parent_module }
    return rawModules
      .filter((m: any) => m.is_active)
      .map((m: any) => ({
        id: m.id,
        name: m.name || '',
        code: m.code || '',
        path: MODULE_NAME_TO_PATH[(m.name || '').toLowerCase()] || '',
        is_active: m.is_active,
        is_enabled: true,
        project_id: m.project_id,
        parent_module_id: m.parent_module_id ?? null,
        parent_module: m.parent_module ?? null,
        description: m.description,
      }));
  }

  /**
   * Logout user
   */
  async logout() {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear all auth data from localStorage
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      localStorage.removeItem('modules');
      localStorage.removeItem('modulePermissions');
      localStorage.removeItem('configuratorAccessToken');
      localStorage.removeItem('configuratorCompanyId');
      localStorage.removeItem('configuratorProjectId');
      localStorage.removeItem('companyName');
      localStorage.removeItem('companyCode');
      localStorage.removeItem('projects');
    }
  }

  /**
   * Get current user — fetches from HRMS backend /auth/me to resolve
   * employee & organization data, then merges with stored user and
   * persists back to localStorage.
   */
  async getCurrentUser(): Promise<User> {
    const stored = this.getStoredUser();
    if (!stored) {
      throw new Error('No user data found. Please log in again.');
    }

    // If employee data already present, return immediately
    if (stored.employee?.organizationId || stored.employee?.organization?.id) {
      return stored;
    }

    // Fetch full profile from HRMS backend (works with Configurator token)
    try {
      const response = await api.get('/auth/me');
      const backendUser = response.data?.data?.user;
      if (backendUser) {
        const merged: User = {
          ...stored,
          role: stored.role || backendUser.role,
          employee: backendUser.employee ?? stored.employee,
        };
        localStorage.setItem('user', JSON.stringify(merged));
        return merged;
      }
    } catch (err) {
      console.warn('Failed to fetch user profile from HRMS backend:', err);
    }

    return stored;
  }

  /**
   * Get assigned modules — re-fetches role modules from Configurator API
   * Uses stored project_id and role_id from login response.
   *
   * Modules are gated by POST /api/v1/user-role-modules/project —
   * if that API fails or returns empty, modules are cleared and an empty
   * array is returned so the sidebar stays disabled.
   */
  async getModules(): Promise<{ id: number; name: string; code: string; path?: string }[]> {
    try {
      // Try to get role_id, project_id and token from stored data
      const token = localStorage.getItem('configuratorAccessToken');
      const projectsRaw = localStorage.getItem('projects');
      if (projectsRaw && token) {
        const projects = JSON.parse(projectsRaw);
        const hrmsProject = Array.isArray(projects)
          ? (projects.find((p: any) => p.code === 'HRMS001' || p.name === 'HRMS') || projects[0])
          : null;
        if (hrmsProject?.role_id != null && hrmsProject?.id != null) {
          // fetchRoleModules already gates on /api/v1/user-role-modules/project
          const modules = await this.fetchRoleModules(hrmsProject.role_id, hrmsProject.id, token);
          localStorage.setItem('modules', JSON.stringify(modules));
          return modules;
        }
      }

      // Fallback: return whatever is already in localStorage
      const stored = localStorage.getItem('modules');
      return stored ? JSON.parse(stored) : [];
    } catch (error: any) {
      console.warn('getModules error:', error);
      return [];
    }
  }

  /**
   * Request password reset
   */
  async forgotPassword(data: ForgotPasswordData) {
    const response = await api.post('/auth/forgot-password', data);
    return response.data;
  }

  /**
   * Reset password
   */
  async resetPassword(data: ResetPasswordData) {
    const response = await api.post('/auth/reset-password', data);
    return response.data;
  }

  /**
   * Verify email
   */
  async verifyEmail(token: string) {
    const response = await api.post('/auth/verify-email', { token });
    return response.data;
  }

  /**
   * Refresh access token via Configurator API
   */
  async refreshToken(refreshToken: string) {
    try {
      const response = await configuratorApi.post('/api/v1/auth/token/refresh', {
        refresh_token: refreshToken,
      });

      const newAccessToken = response.data.access_token || '';
      const newRefreshToken = response.data.refresh_token || refreshToken;

      // Save new tokens
      localStorage.setItem('accessToken', newAccessToken);
      localStorage.setItem('refreshToken', newRefreshToken);
      localStorage.setItem('configuratorAccessToken', newAccessToken);

      return { accessToken: newAccessToken, refreshToken: newRefreshToken };
    } catch (error) {
      // Fallback: try HRMS backend refresh
      const response = await api.post('/auth/refresh-token', { refreshToken });
      const { tokens } = response.data.data;
      localStorage.setItem('accessToken', tokens.accessToken);
      localStorage.setItem('refreshToken', tokens.refreshToken);
      return tokens;
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!localStorage.getItem('accessToken');
  }

  /**
   * Get stored user from localStorage
   */
  getStoredUser(): User | null {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;

    try {
      const user = JSON.parse(userStr);
      if (user?.role) user.role = normalizeRole(user.role);
      return user;
    } catch (error) {
      return null;
    }
  }

  /**
   * Change password
   */
  async changePassword(data: { currentPassword: string; newPassword: string }) {
    const response = await api.post('/auth/change-password', data);
    return response.data;
  }

  /**
   * Update profile
   */
  async updateProfile(data: { firstName?: string; lastName?: string; phone?: string }): Promise<User> {
    const response = await api.put('/auth/profile', data);
    const user = response.data.data.user;

    // Update localStorage
    localStorage.setItem('user', JSON.stringify(user));

    return user;
  }
}

export const authService = new AuthService();
