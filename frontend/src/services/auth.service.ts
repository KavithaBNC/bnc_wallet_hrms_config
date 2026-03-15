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
/** Display label for a resolved path — used when API provides no name */
const PATH_TO_LABEL: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/employees': 'Employees',
  '/departments': 'Departments',
  '/positions': 'Positions',
  '/attendance': 'Attendance',
  '/attendance/my-requests/excess-time-request': 'Excess Time Request',
  '/attendance/excess-time-approval': 'Excess Time Approval',
  '/attendance/apply-event': 'Apply Event',
  '/attendance-policy': 'Attendance Policy',
  '/attendance-policy/late-and-others': 'Late & Others',
  '/attendance-policy/week-of-assign': 'Week Off Assign',
  '/attendance-policy/holiday-assign': 'Holiday Assign',
  '/attendance-policy/excess-time-conversion': 'Excess Time Conversion',
  '/attendance-policy/ot-usage-rule': 'OT Usage Rule',
  '/leave': 'Event',
  '/leave/approvals': 'Approvals',
  '/event': 'Event',
  '/event/requests': 'Event Requests',
  '/event/balance-entry': 'Balance Entry',
  '/event-configuration': 'Event Configuration',
  '/event-configuration/attendance-components': 'Attendance Components',
  '/event-configuration/approval-workflow': 'Approval Workflow',
  '/event-configuration/workflow-mapping': 'Workflow Mapping',
  '/event-configuration/rights-allocation': 'Rights Allocation',
  '/event-configuration/rule-setting': 'Rule Setting',
  '/event-configuration/auto-credit-setting': 'Auto Credit Setting',
  '/event-configuration/encashment-carry-forward': 'Encashment / Carry Forward',
  '/hr-activities': 'HR Activities',
  '/hr-activities/validation-process': 'Validation Process',
  '/hr-activities/post-to-payroll': 'Post to Payroll',
  '/others-configuration': 'Others Configuration',
  '/others-configuration/validation-process-rule': 'Validation Process Rule',
  '/others-configuration/attendance-lock': 'Attendance Lock',
  '/others-configuration/post-to-payroll': 'Post to Payroll Setup',
  '/time-attendance': 'Time Attendance',
  '/time-attendance/shift-master': 'Shift Master',
  '/time-attendance/shift-assign': 'Shift Assign',
  '/time-attendance/associate-shift-change': 'Associate Shift Change',
  '/payroll': 'Payroll',
  '/payroll-master': 'Payroll Master',
  '/payroll/employee-separation': 'Employee Separation',
  '/payroll/employee-rejoin': 'Employee Rejoin',
  '/salary-structures': 'Salary Structure',
  '/employee-salaries': 'Employee Salary',
  '/hr-audit-settings': 'HR Audit Settings',
  '/employee-master-approval': 'Employee Master Approval',
  '/esop': 'ESOP',
  '/esop/add': 'Add ESOP',
  '/transaction': 'Transaction',
  '/transaction/transfer-promotions': 'Increment',
  '/transaction/transfer-promotion-entry': 'Transfer & Promotion Entry',
  '/transaction/emp-code-transfer': 'Emp Code Transfer',
  '/transaction/paygroup-transfer': 'Pay Group Transfer',
  '/permissions': 'Module Permission',
  '/organizations': 'Organization Management',
  '/user-module': 'User Module',
  '/core-hr': 'Core HR',
  '/core-hr/overview': 'Overview',
  '/core-hr/compound-creation': 'Component Creation',
  '/core-hr/rules-engine': 'Rules Engine',
  '/core-hr/variable-input': 'Variable Input',
  '/cost-centre-department': 'Cost Centre',
  '/master': 'Master',
  '/master/department': 'Department Masters',
};

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
  'user module': '/user-module',
  'master': '/master',
  'cost centre': '/cost-centre-department',
  // page_name fragments returned by /api/v1/user-role-modules/project (no leading slash)
  'apply-event': '/attendance/apply-event',
  'approvals': '/leave/approvals',
  'balance-entry': '/event/balance-entry',
  'requests': '/event/requests',
  'excess-time-request': '/attendance/my-requests/excess-time-request',
  'excess-time-approval': '/attendance/excess-time-approval',
  'late-and-others': '/attendance-policy/late-and-others',
  'week-of-assign': '/attendance-policy/week-of-assign',
  'holiday-assign': '/attendance-policy/holiday-assign',
  'excess-time-conversion': '/attendance-policy/excess-time-conversion',
  'ot-usage-rule': '/attendance-policy/ot-usage-rule',
  'shift-master': '/time-attendance/shift-master',
  'shift-assign': '/time-attendance/shift-assign',
  'associate-shift-change': '/time-attendance/associate-shift-change',
  'employee-separation': '/payroll/employee-separation',
  'employee-rejoin': '/payroll/employee-rejoin',
  'transfer-promotions': '/transaction/transfer-promotions',
  'transfer-promotion-entry': '/transaction/transfer-promotion-entry',
  'emp-code-transfer': '/transaction/emp-code-transfer',
  'paygroup-transfer': '/transaction/paygroup-transfer',
  'validation-process': '/hr-activities/validation-process',
  'post-to-payroll': '/hr-activities/post-to-payroll',
  'validation-process-rule': '/others-configuration/validation-process-rule',
  'attendance-lock': '/others-configuration/attendance-lock',
  'attendance-components': '/event-configuration/attendance-components',
  'approval-workflow': '/event-configuration/approval-workflow',
  'workflow-mapping': '/event-configuration/workflow-mapping',
  'rights-allocation': '/event-configuration/rights-allocation',
  'rule-setting': '/event-configuration/rule-setting',
  'auto-credit-setting': '/event-configuration/auto-credit-setting',
  'encashment-carry-forward': '/event-configuration/encashment-carry-forward',
  'compound-creation': '/core-hr/compound-creation',
  'rules-engine': '/core-hr/rules-engine',
  'variable-input': '/core-hr/variable-input',
  'overview': '/core-hr/overview',
  // page_name values returned by /api/v1/user-role-modules/project (with leading slash)
  '/employees': '/employees',
  '/departmentmasters': '/departments',
  '/departmentmaster': '/departments',
  '/departments': '/departments',
  '/department': '/departments',
  '/positions': '/positions',
  '/position': '/positions',
  '/attendance': '/attendance',
  '/leave': '/leave',
  '/payroll': '/payroll',
  '/salary-structures': '/salary-structures',
  '/salarystructures': '/salary-structures',
  '/employee-salaries': '/employee-salaries',
  '/employeesalaries': '/employee-salaries',
  '/permissions': '/permissions',
  '/organizations': '/organizations',
  '/cost-centre-department': '/cost-centre-department',
  '/costcentredepartment': '/cost-centre-department',
  '/core-hr': '/core-hr',
  '/corehr': '/core-hr',
  '/hr-activities': '/hr-activities',
  '/hractivities': '/hr-activities',
  '/event-configuration': '/event-configuration',
  '/eventconfiguration': '/event-configuration',
  '/attendance-policy': '/attendance-policy',
  '/attendancepolicy': '/attendance-policy',
  '/time-attendance': '/time-attendance',
  '/timeattendance': '/time-attendance',
  '/transaction': '/transaction',
  '/payroll-master': '/payroll-master',
  '/payrollmaster': '/payroll-master',
  '/hr-audit-settings': '/hr-audit-settings',
  '/hrauditsettings': '/hr-audit-settings',
  '/employee-master-approval': '/employee-master-approval',
  '/employeemasterapproval': '/employee-master-approval',
  '/esop': '/esop',
  '/others-configuration': '/others-configuration',
  '/othersconfiguration': '/others-configuration',
  '/dashboard': '/dashboard',
  '/user-module': '/user-module',
  '/usermodule': '/user-module',
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
  organizationId?: string;
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

    // Store Configurator refresh token separately (HRMS backend login will overwrite 'refreshToken')
    localStorage.setItem('configuratorRefreshToken', tokens.refreshToken);

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
        company_id: company.id || undefined,
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
        // Merge employee and organization data into user
        user.id = hrmsData.user.id || user.id;
        user.role = normalizeRole(hrmsData.user.role || user.role);
        if (hrmsData.user?.employee) {
          user.employee = hrmsData.user.employee;
        }
        if (hrmsData.user?.organizationId) {
          user.organizationId = hrmsData.user.organizationId;
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
   * Fetch modules + permissions from POST /api/v1/user-role-modules/project.
   * Stores modulePermissions map in localStorage for page-level permission checks.
   * Returns the raw list — single source of truth for both sidebar and permissions.
   */
  private async fetchUserRoleModulesProject(roleId: number, projectId: number, accessToken: string): Promise<any[]> {
    const response = await configuratorApi.post(
      '/api/v1/user-role-modules/project',
      { role_id: roleId, project_id: projectId },
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const data = response.data;
    const list = Array.isArray(data) ? data : (data?.data ?? []);
    if (!Array.isArray(list) || list.length === 0) return [];

    // Build permissions map: path → { is_enabled, can_view, can_add, can_edit, can_delete }
    const permissionsMap: Record<string, { is_enabled: boolean; can_view: boolean; can_add: boolean; can_edit: boolean; can_delete: boolean }> = {};
    for (const item of list) {
      const pageName = (item.page_name || '').toLowerCase().trim();
      const moduleName = (item.module_name || item.name || '').toLowerCase().trim();
      const path = MODULE_NAME_TO_PATH[pageName] || MODULE_NAME_TO_PATH[moduleName] || pageName || '';
      if (path) {
        permissionsMap[path] = {
          is_enabled: item.is_enabled === true || item.is_enabled === 1,
          can_view: item.can_view === true || item.can_view === 1,
          can_add: item.can_add === true || item.can_add === 1,
          can_edit: item.can_edit === true || item.can_edit === 1,
          can_delete: item.can_delete === true || item.can_delete === 1,
        };
      }
    }
    localStorage.setItem('modulePermissions', JSON.stringify(permissionsMap));
    return list;
  }

  /**
   * Fetch sidebar modules for the logged-in user's role.
   * Uses POST /api/v1/user-role-modules/project as the single source of truth.
   * Only modules with is_enabled = true are included in the sidebar list.
   */
  async fetchRoleModules(roleId: number, projectId: number, accessToken: string): Promise<any[]> {
    let list: any[];
    try {
      list = await this.fetchUserRoleModulesProject(roleId, projectId, accessToken);
    } catch {
      return [];
    }
    if (list.length === 0) return [];

    // Build sidebar module objects — only include is_enabled entries
    return list
      .filter((m: any) => m.is_enabled === true || m.is_enabled === 1)
      .map((m: any) => {
        const pageName = (m.page_name || '').toLowerCase().trim();
        const moduleName = (m.module_name || m.name || '').toLowerCase().trim();
        const path = MODULE_NAME_TO_PATH[pageName] || MODULE_NAME_TO_PATH[moduleName] || m.page_name || '';
        const label = m.module_name || m.name || PATH_TO_LABEL[path] || path.split('/').filter(Boolean).pop() || '';
        return {
          id: m.module_id ?? m.id,
          name: label,
          code: m.code || '',
          path,
          is_active: true,
          is_enabled: true,
          project_id: m.project_id,
          parent_module_id: m.parent_module_id ?? null,
          parent_module: m.parent_module ?? null,
        };
      });
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
      localStorage.removeItem('configuratorRefreshToken');
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
          organizationId: backendUser.organizationId ?? stored.organizationId,
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
   * Refresh access token — tries HRMS backend first, then Configurator API
   */
  async refreshToken(refreshToken: string) {
    // Try HRMS backend refresh first (uses HRMS refresh token)
    try {
      const response = await api.post('/auth/refresh-token', { refreshToken });
      const { tokens } = response.data.data;
      localStorage.setItem('accessToken', tokens.accessToken);
      localStorage.setItem('refreshToken', tokens.refreshToken);
      return tokens;
    } catch {
      // HRMS refresh failed, try Configurator API
    }

    // Fallback: Configurator API refresh (use stored Configurator refresh token)
    const configuratorRefresh = localStorage.getItem('configuratorRefreshToken') || refreshToken;
    const response = await configuratorApi.post('/api/v1/auth/token/refresh', {
      refresh_token: configuratorRefresh,
    });

    const newAccessToken = response.data.access_token || '';
    const newRefreshToken = response.data.refresh_token || configuratorRefresh;

    // Save Configurator tokens
    localStorage.setItem('configuratorAccessToken', newAccessToken);
    localStorage.setItem('configuratorRefreshToken', newRefreshToken);
    // Also use as main accessToken (HRMS backend has Configurator token fallback)
    localStorage.setItem('accessToken', newAccessToken);

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
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
   * Change password (legacy HRMS bcrypt flow — kept for compatibility)
   */
  async changePassword(data: { currentPassword: string; newPassword: string }) {
    const response = await api.post('/auth/change-password', data);
    return response.data;
  }

  /**
   * Sync password_hash in HRMS DB after Configurator password reset.
   * Stores the encrypted_password from Configurator as password_hash.
   */
  async syncPasswordHash(encryptedPassword: string): Promise<void> {
    await api.post('/auth/sync-password-hash', { encryptedPassword });
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
