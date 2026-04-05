import api from './api';

/**
 * Normalize role string to UPPER_SNAKE_CASE.
 * The backend is the source of truth for role mapping (synced from Configurator API).
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
  '/device-setting': 'Device Setting',
  '/attendance/device-setting': 'Device Setting',
  '/leave/excess-time-request': 'Excess Time Request',
  '/leave/excess-time-approval': 'Excess Time Approval',
  '/leave/apply-event': 'Apply Event',
  '/attendance-policy': 'Attendance Policy',
  '/attendance-policy/late-and-others': 'Late & Others',
  '/attendance-policy/week-of-assign': 'Week Off Assign',
  '/attendance-policy/holiday-assign': 'Holiday Assign',
  '/attendance-policy/excess-time-conversion': 'Excess Time Conversion',
  '/attendance-policy/ot-usage-rule': 'OT Usage Rule',
  '/leave': 'Event',
  '/leave/approvals': 'Approvals',
  '/leave/requests': 'Requests',
  '/leave/balance-entry': 'Balance Entry',
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
  '/payroll-master': 'Payroll',
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
  '/department-masters': 'Department Masters',
  '/departmentmasters': 'Department Masters',
  '/payroll_master': 'Payroll Master',
  '/time-attendanc': 'Time Attendance',
  // ESOP sub-pages
  '/esop/dashboard': 'ESOP Dashboard',
  '/esop/pools': 'ESOP Pools',
  '/esop/grants': 'ESOP Grants',
  '/esop/vesting-schedules': 'Vesting Schedules',
  '/esop/vesting-plans': 'Vesting Plans',
  '/esop/exercise-requests': 'Exercise Requests',
  '/esop/ledger': 'ESOP Ledger',
  '/esop/my-holdings': 'My Holdings',
  // Standalone ESOP aliases (page_name without /esop/ prefix)
  '/vesting-plans': 'Vesting Plans',
  '/exercise-requests': 'Exercise Requests',
  // Statutory Compliance
  '/statutory': 'Statutory Compliance',
  '/statutory/epf': 'EPF',
  '/statutory/esic': 'ESIC',
  '/statutory/professional-tax': 'Professional Tax',
  '/statutory/tds': 'TDS / Income Tax',
  // Reports
  '/reports': 'Reports',
  '/reports/payroll-register': 'Payroll Register',
  '/reports/epf': 'EPF Report',
  '/reports/esic': 'ESIC Report',
  '/reports/professional-tax': 'Professional Tax Report',
  '/reports/tds-working': 'TDS Working',
  '/reports/form16': 'Form 16',
  '/reports/fnf-settlement': 'FnF Settlement Report',
  // Payroll sub-pages
  '/payroll/dashboard': 'Payroll Dashboard',
  '/payroll/run': 'Run Payroll',
  '/payroll/history': 'Payroll History',
  '/payroll/fnf-settlement': 'FnF Settlement',
  '/payroll/loans': 'Loans',
  // Other missing
  '/salary-templates': 'Salary Templates',
  '/department_masters': 'Department Masters',
  '/employee-rejoin': 'Employee Rejoin',
};

const MODULE_NAME_TO_PATH: Record<string, string> = {
  'dashboard': '/dashboard',
  'department': '/department-masters',
  'departments': '/department-masters',
  'employees': '/employees',
  'positions': '/positions',
  'position': '/positions',
  'core hr': '/core-hr',
  'overview': '/core-hr/overview',
  'component creation': '/core-hr/compound-creation',
  'rules engine': '/core-hr/rules-engine',
  'variable input': '/core-hr/variable-input',
  'event configuration': '/event-configuration',
  'leave type': '/event-configuration/attendance-components',
  'leave types': '/event-configuration/attendance-components',
  'event category': '/event-configuration/attendance-components',
  'event categories': '/event-configuration/attendance-components',
  'attendance components': '/event-configuration/attendance-components',
  'attendance component': '/event-configuration/attendance-components',
  'approval workflow': '/event-configuration/approval-workflow',
  'workflow mapping': '/event-configuration/workflow-mapping',
  'rights allocation': '/event-configuration/rights-allocation',
  'rule setting': '/event-configuration/rule-setting',
  'rule settings': '/event-configuration/rule-setting',
  'auto credit setting': '/event-configuration/auto-credit-setting',
  'auto credit': '/event-configuration/auto-credit-setting',
  'encashment / carry forward': '/event-configuration/encashment-carry-forward',
  'encashment carry forward': '/event-configuration/encashment-carry-forward',
  'encashment': '/event-configuration/encashment-carry-forward',
  'hr activities': '/hr-activities',
  'validation process': '/hr-activities/validation-process',
  'others configuration': '/others-configuration',
  'validation process rule': '/others-configuration/validation-process-rule',
  'attendance lock': '/others-configuration/attendance-lock',
  'post to payroll': '/hr-activities/post-to-payroll',
  'post to payroll setup': '/others-configuration/post-to-payroll',
  'attendance': '/attendance',
  'device setting': '/device-setting',
  'device settings': '/device-setting',
  'face attendance': '/attendance/face',
  'excess time request': '/leave/excess-time-request',
  'excess time approval': '/leave/excess-time-approval',
  'attendance policy': '/attendance-policy',
  'late & others': '/attendance-policy/late-and-others',
  'week of assign': '/attendance-policy/week-of-assign',
  'holiday assign': '/attendance-policy/holiday-assign',
  'excess time conversion': '/attendance-policy/excess-time-conversion',
  'ot usage rule': '/attendance-policy/ot-usage-rule',
  'event': '/leave',
  'event apply': '/leave/apply-event',
  'apply event': '/leave/apply-event',
  'event request': '/leave/requests',
  'event requests': '/leave/requests',
  'event approval': '/leave/approvals',
  'event approvals': '/leave/approvals',
  'event balance entry': '/leave/balance-entry',
  'balance entry': '/leave/balance-entry',
  'time attendance': '/time-attendance',
  'shift master': '/time-attendance/shift-master',
  'shift assign': '/time-attendance/shift-assign',
  'associate shift change': '/time-attendance/associate-shift-change',
  'payroll': '/payroll',
  'payroll master': '/payroll',
  'employee separation': '/payroll/employee-separation',
  'employee rejoin': '/payroll/employee-rejoin',
  'fnf settlement': '/payroll/fnf-settlement',
  'fnf': '/payroll/fnf-settlement',
  'loans': '/payroll/loans',
  'loan': '/payroll/loans',
  'salary structure': '/salary-structures',
  'employee salary': '/employee-salaries',
  'hr audit settings': '/hr-audit-settings',
  'employee master approval': '/employee-master-approval',
  'esop': '/esop',
  'add esop': '/esop/add',
  'esop add': '/esop/add',
  'esop my holdings': '/esop/my-holdings',
  'esop my-holdings': '/esop/my-holdings',
  'esop exercise requests': '/esop/exercise-requests',
  'esop vesting schedules': '/esop/vesting-schedules',
  'esop vesting plans': '/esop/vesting-plans',
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
  'departmentmasters': '/department-masters',
  'departmentmaster': '/department-masters',
  'department masters': '/department-masters',
  'apply-event': '/leave/apply-event',
  'approvals': '/leave/approvals',
  'balance-entry': '/leave/balance-entry',
  'requests': '/leave/requests',
  'excess-time-request': '/leave/excess-time-request',
  'excess-time-approval': '/leave/excess-time-approval',
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
  'leave-type': '/event-configuration/attendance-components',
  'leave-types': '/event-configuration/attendance-components',
  'leavetype': '/event-configuration/attendance-components',
  'event-category': '/event-configuration/attendance-components',
  'event-categories': '/event-configuration/attendance-components',
  'device-setting': '/device-setting',
  'device-settings': '/device-setting',
  'approval-workflow': '/event-configuration/approval-workflow',
  'workflow-mapping': '/event-configuration/workflow-mapping',
  'rights-allocation': '/event-configuration/rights-allocation',
  'rule-setting': '/event-configuration/rule-setting',
  'auto-credit-setting': '/event-configuration/auto-credit-setting',
  'encashment-carry-forward': '/event-configuration/encashment-carry-forward',
  'compound-creation': '/core-hr/compound-creation',
  'rules-engine': '/core-hr/rules-engine',
  'variable-input': '/core-hr/variable-input',
  // page_name values returned by /api/v1/user-role-modules/project (with leading slash)
  '/employees': '/employees',
  '/departmentmasters': '/department-masters',
  '/departmentmaster': '/department-masters',
  '/departments': '/department-masters',
  '/department': '/department-masters',
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
  '/event-configuration/leave-type': '/event-configuration/attendance-components',
  '/event-configuration/leave-types': '/event-configuration/attendance-components',
  '/event-configuration/leavetype': '/event-configuration/attendance-components',
  '/event-category': '/event-configuration/attendance-components',
  '/eventcategory': '/event-configuration/attendance-components',
  '/device-setting': '/device-setting',
  '/devicesetting': '/device-setting',
  '/event': '/leave',
  '/event/apply-event': '/leave/apply-event',
  '/event/apply': '/leave/apply-event',
  '/event/requests': '/leave/requests',
  '/event/approvals': '/leave/approvals',
  '/event/balance-entry': '/leave/balance-entry',
  '/event/excess-time-request': '/leave/excess-time-request',
  '/event/excess-time-approval': '/leave/excess-time-approval',
  '/leave/apply-event': '/leave/apply-event',
  '/leave/requests': '/leave/requests',
  '/leave/balance-entry': '/leave/balance-entry',
  '/leave/excess-time-request': '/leave/excess-time-request',
  '/leave/excess-time-approval': '/leave/excess-time-approval',
  '/attendance-policy': '/attendance-policy',
  '/attendancepolicy': '/attendance-policy',
  '/time-attendance': '/time-attendance',
  '/timeattendance': '/time-attendance',
  '/transaction': '/transaction',
  '/payroll-master': '/payroll',
  '/payrollmaster': '/payroll',
  '/payroll-master/employee-separation': '/payroll/employee-separation',
  '/payroll-master/fnf-settlement': '/payroll/fnf-settlement',
  '/payroll-master/loans': '/payroll/loans',
  '/payroll-master/employee-rejoin': '/payroll/employee-rejoin',
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
  // ESOP sub-pages (page_name with leading slash from API)
  '/esop/dashboard': '/esop/dashboard',
  '/esop/pools': '/esop/pools',
  '/esop/grants': '/esop/grants',
  '/esop/vesting-schedules': '/esop/vesting-schedules',
  '/esop/vesting-plans': '/esop/vesting-plans',
  '/esop/exercise-requests': '/esop/exercise-requests',
  '/esop/ledger': '/esop/ledger',
  '/esop/my-holdings': '/esop/my-holdings',
  // Standalone aliases (page_name without /esop/ prefix)
  '/vesting-plans': '/esop/vesting-plans',
  '/exercise-requests': '/esop/exercise-requests',
  'vesting-plans': '/esop/vesting-plans',
  'exercise-requests': '/esop/exercise-requests',
  'esop dashboard': '/esop/dashboard',
  'esop pools': '/esop/pools',
  'esop grants': '/esop/grants',
  'vesting schedules': '/esop/vesting-schedules',
  'esop ledger': '/esop/ledger',
  'my holdings': '/esop/my-holdings',
  // Statutory Compliance
  '/statutory': '/statutory',
  '/statutory/epf': '/statutory/epf',
  '/statutory/esic': '/statutory/esic',
  '/statutory/professional-tax': '/statutory/professional-tax',
  '/statutory/tds': '/statutory/tds',
  'statutory': '/statutory',
  'statutory compliance': '/statutory',
  'epf': '/statutory/epf',
  'esic': '/statutory/esic',
  'professional tax': '/statutory/professional-tax',
  'tds': '/statutory/tds',
  'tds / income tax': '/statutory/tds',
  // Reports
  '/reports': '/reports',
  '/reports/payroll-register': '/reports/payroll-register',
  '/reports/epf': '/reports/epf',
  '/reports/esic': '/reports/esic',
  '/reports/professional-tax': '/reports/professional-tax',
  '/reports/tds-working': '/reports/tds-working',
  '/reports/form16': '/reports/form16',
  '/reports/fnf-settlement': '/reports/fnf-settlement',
  'reports': '/reports',
  'payroll register': '/reports/payroll-register',
  'epf report': '/reports/epf',
  'esic report': '/reports/esic',
  'professional tax report': '/reports/professional-tax',
  'tds working': '/reports/tds-working',
  'form 16': '/reports/form16',
  'form16': '/reports/form16',
  'fnf settlement report': '/reports/fnf-settlement',
  // Payroll sub-pages
  '/payroll/dashboard': '/payroll/dashboard',
  '/payroll/run': '/payroll/run',
  '/payroll/history': '/payroll/history',
  '/payroll/fnf-settlement': '/payroll/fnf-settlement',
  '/payroll/loans': '/payroll/loans',
  'payroll/dashboard': '/payroll/dashboard',
  'payroll dashboard': '/payroll/dashboard',
  'run payroll': '/payroll/run',
  'payroll history': '/payroll/history',
  // Other missing
  '/salary-templates': '/salary-templates',
  'salary-templates': '/salary-templates',
  'salary templates': '/salary-templates',
  '/department_masters': '/department-masters',
  'department_masters': '/department-masters',
  '/employee-rejoin': '/payroll/employee-rejoin',
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
  /** Display-friendly role name from Configurator (e.g., "HRMS HR Admin") */
  roleName?: string;
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
   * Calls HRMS backend: POST /api/v1/configurator-data/verify-company
   */
  async verifyCompany(companyNameOrCode: string): Promise<CompanyVerifyResponse> {
    try {
      const response = await api.post('/configurator-data/verify-company', {
        company_name_or_code: companyNameOrCode,
      });
      return response.data;
    } catch (error: any) {
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
    // ── Placeholder tokens/user — will be overwritten by Step 2b HRMS backend response ──
    const tokens = { accessToken: '', refreshToken: '' };
    const user: User = {
      id: '',
      email: data.username,
      role: '',
      isEmailVerified: true,
    };

    let hrmsBackendModules: any[] | undefined;

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
        // Merge employee and organization data into user
        user.id = hrmsData.user.id || user.id;
        // Keep Configurator roleName for display; use backend role for authorization
        if (!user.roleName && hrmsData.user.role) {
          user.roleName = hrmsData.user.role;
        }
        user.role = normalizeRole(hrmsData.user.role || user.role);
        if (hrmsData.user?.employee) {
          user.employee = hrmsData.user.employee;
        }
        if (hrmsData.user?.organizationId) {
          user.organizationId = hrmsData.user.organizationId;
        }
        // Store Configurator company ID and access token for Config DB operations
        if (hrmsData.configuratorCompanyId) {
          localStorage.setItem('configuratorCompanyId', String(hrmsData.configuratorCompanyId));
        }
        if (hrmsData.configuratorProjectId) {
          localStorage.setItem('configuratorProjectId', String(hrmsData.configuratorProjectId));
        }
        if (hrmsData.configuratorAccessToken) {
          localStorage.setItem('configuratorAccessToken', hrmsData.configuratorAccessToken);
        }
        localStorage.setItem('user', JSON.stringify(user));
        // Capture backend modules for fallback
        if (Array.isArray(hrmsData.modules)) {
          hrmsBackendModules = hrmsData.modules;
        }
      }
    } catch (err) {
      console.warn('HRMS backend sync failed (employee data may be unavailable):', err);
    }

    // ── Step 2c: Use modules from HRMS backend (Config DB) — no RAG API ──
    if (Array.isArray(hrmsBackendModules) && hrmsBackendModules.length > 0) {
      console.log('[login] Using modules from HRMS backend (Config DB):', hrmsBackendModules.length);
      const { modules: sidebarModules, permissionsMap } = this.buildModulesAndPermissions(hrmsBackendModules);
      if (sidebarModules.length > 0) {
        localStorage.setItem('modules', JSON.stringify(sidebarModules));
      }
      localStorage.setItem('modulePermissions', JSON.stringify(permissionsMap));
      console.log('[login] modulePermissions set:', Object.keys(permissionsMap).length, 'paths');
    } else {
      console.warn('[login] No modules from HRMS backend — modulePermissions not set');
    }

    return { user, tokens };
  }

  /**
   * Build sidebar modules + permissions map from HRMS backend modules (Config DB).
   * No RAG API call needed — modules come from HRMS backend login response or GET /auth/modules.
   */
  private buildModulesAndPermissions(moduleList: any[]): {
    modules: any[];
    permissionsMap: Record<string, { is_enabled: boolean; can_view: boolean; can_add: boolean; can_edit: boolean; can_delete: boolean }>;
  } {
    const permissionsMap: Record<string, { is_enabled: boolean; can_view: boolean; can_add: boolean; can_edit: boolean; can_delete: boolean }> = {};

    // Helper to slugify a name: "My Holdings" → "my-holdings"
    const slugify = (s: string) => s.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    // Pass 1: Resolve paths for all modules (direct lookup)
    const resolved = moduleList.filter((m: any) => m.is_enabled).map((m: any) => {
      const rawPageName = (m.page_name || m.path || '').trim();
      const pageName = rawPageName.toLowerCase();
      const moduleName = (m.name || '').toLowerCase().trim();
      const pageNameNorm = pageName.replace(/[^a-z0-9]/g, '');
      const moduleNameNorm = moduleName.replace(/[^a-z0-9]/g, '');
      const path = rawPageName.startsWith('/')
        ? (MODULE_NAME_TO_PATH[pageName] || rawPageName)
        : (MODULE_NAME_TO_PATH[pageName] || MODULE_NAME_TO_PATH[moduleName]
          || MODULE_NAME_TO_PATH[pageNameNorm] || MODULE_NAME_TO_PATH[moduleNameNorm] || '');
      return { raw: m, path };
    });

    // Build parent module_id → resolved path map (for child fallback in pass 2)
    const parentIdToPath = new Map<number, string>();
    for (const r of resolved) {
      const mid = r.raw.module_id ?? r.raw.id;
      if (mid != null && r.path) parentIdToPath.set(mid, r.path);
    }

    // Pass 2: For unresolved children, try parentPath + '/' + slugify(childName)
    const modules = resolved.map(({ raw: m, path: directPath }) => {
      let path = directPath;
      if (!path && m.parent_module_id) {
        const parentPath = parentIdToPath.get(m.parent_module_id);
        if (parentPath) {
          const childSlug = slugify(m.name || m.page_name || '');
          if (childSlug) {
            const candidate = parentPath + '/' + childSlug;
            // Accept if MODULE_NAME_TO_PATH recognises it or if it starts with parent
            path = MODULE_NAME_TO_PATH[candidate] || candidate;
          }
        }
      }

      const label = m.name || PATH_TO_LABEL[path] || path.split('/').filter(Boolean).pop() || '';

      // Coerce permission flags — Config DB may send boolean, number (0/1), or string ("true"/"1")
      const toBool = (v: any) => v === true || v === 1 || v === '1' || v === 'true';
      if (path) {
        permissionsMap[path] = {
          is_enabled: toBool(m.is_enabled) || m.is_enabled !== false,
          can_view: toBool(m.can_view) || m.can_view !== false,
          can_add: toBool(m.can_add),
          can_edit: toBool(m.can_edit),
          can_delete: toBool(m.can_delete),
        };
      }

      return {
        id: m.module_id ?? m.id,
        module_id: m.module_id ?? m.id,
        name: label,
        code: m.code || '',
        path,
        page_name: m.page_name || m.path || '',
        is_active: true,
        is_enabled: true,
        can_view: toBool(m.can_view) || m.can_view !== false,
        project_id: m.project_id,
        parent_module_id: m.parent_module_id ?? null,
        parent_module: m.parent_module ?? null,
      };
    });
    return { modules, permissionsMap };
  }

  /**
   * Fetch sidebar modules for the logged-in user's role from HRMS backend (Config DB).
   * No RAG API — calls GET /api/v1/auth/modules on HRMS backend.
   */
  async fetchRoleModules(_roleId?: number, _projectId?: number, _accessToken?: string): Promise<any[]> {
    try {
      const response = await api.get('/auth/modules');
      const data = response.data?.data;
      const list = Array.isArray(data?.modules) ? data.modules : [];
      if (list.length === 0) return [];

      const { modules, permissionsMap } = this.buildModulesAndPermissions(list);
      localStorage.setItem('modulePermissions', JSON.stringify(permissionsMap));
      console.log('[fetchRoleModules] Got', modules.length, 'modules from HRMS backend (Config DB)');
      return modules;
    } catch (err) {
      console.warn('[fetchRoleModules] HRMS backend modules fetch failed:', err);
      return [];
    }
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
      // Fetch modules from HRMS backend (Config DB) — no RAG API needed
      const modules = await this.fetchRoleModules();
      if (modules.length > 0) {
        localStorage.setItem('modules', JSON.stringify(modules));
        return modules;
      }

      // Fallback: return whatever is already in localStorage
      const stored = localStorage.getItem('modules');
      return stored ? JSON.parse(stored) : [];
    } catch (error: any) {
      console.warn('getModules error:', error);
      const stored = localStorage.getItem('modules');
      return stored ? JSON.parse(stored) : [];
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
   * Refresh access token via HRMS backend
   */
  async refreshToken(refreshToken: string) {
    const response = await api.post('/auth/refresh-token', { refreshToken });
    const { tokens } = response.data.data;
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    return tokens;
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
