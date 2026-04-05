/**
 * Configurator module code → HRMS dashboard card mapping.
 * Modules come from Config DB project_modules table, filtered by role_module_permissions.
 */

export interface ConfiguratorModule {
  id: number;
  module_id?: number;
  name: string;
  code: string;
  description?: string;
  is_active?: boolean;
  is_enabled?: boolean;
  can_view?: boolean;
  path?: string;
  page_name?: string;
  page_name_mobile?: string;
  role_id?: number;
  company_id?: number;
  project_id?: number;
  /** ID of the parent module (null for top-level modules) */
  parent_module_id?: number | null;
  /** Parent module details from API: { id, name, code } */
  parent_module?: { id: number; name: string; code: string } | null;
}

/** Configurator code → { path, icon, description } for dashboard cards */
export const CONFIGURATOR_CODE_TO_CARD: Record<
  string,
  { path: string; icon: string; description: string }
> = {
  EMPLOYEES: {
    path: '/employees',
    icon: '👥',
    description: 'Manage employee profiles, departments, and hierarchy',
  },
  EMPLOYEE_MANAGEMENT: {
    path: '/employees',
    icon: '👥',
    description: 'Manage employee profiles, departments, and hierarchy',
  },
  ATTENDANCE: {
    path: '/attendance',
    icon: '📅',
    description: 'Track attendance and check-in/out',
  },
  EVENT: {
    path: '/leave',
    icon: '🏖️',
    description: 'Manage leave requests and policies',
  },
  LEAVES: {
    path: '/leave',
    icon: '🏖️',
    description: 'Manage leave requests and policies',
  },
  LEAVE_MANAGEMENT: {
    path: '/leave',
    icon: '🏖️',
    description: 'Manage leave requests and policies',
  },
  DEPARTMENTS: {
    path: '/department-masters',
    icon: '🏢',
    description: 'Organize departments',
  },
  DEPARTMENT: {
    path: '/department-masters',
    icon: '🏢',
    description: 'Organize departments',
  },
  PAYROLL: {
    path: '/payroll',
    icon: '💰',
    description: 'Process payroll and manage salary structures',
  },
  SHIFTS: {
    path: '/time-attendance/shift-master',
    icon: '⏰',
    description: 'Shift master and assignments',
  },
  TIME_ATTENDANCE: {
    path: '/time-attendance/shift-master',
    icon: '⏰',
    description: 'Time attendance and shifts',
  },
  SALARY_STRUCTURES: {
    path: '/salary-structures',
    icon: '📊',
    description: 'Manage salary structures and components',
  },
  EMPLOYEE_SALARIES: {
    path: '/employee-salaries',
    icon: '💵',
    description: 'Assign and view employee salaries',
  },
  TRANSACTION: {
    path: '/transaction',
    icon: '🔄',
    description: 'View and manage transactions',
  },
  TRANSFER_PROMOTIONS: {
    path: '/transaction/transfer-promotions',
    icon: '🔄',
    description: 'Increment, transfer and promotion',
  },
  PERMISSIONS: {
    path: '/permissions',
    icon: '🔐',
    description: 'Manage role permissions and access control',
  },
  CORE_HR: {
    path: '/core-hr',
    icon: '📋',
    description: 'Core HR configuration',
  },
  EVENT_CONFIGURATION: {
    path: '/event-configuration',
    icon: '📆',
    description: 'Event configuration',
  },
  HR_ACTIVITIES: {
    path: '/hr-activities',
    icon: '📋',
    description: 'HR activities',
  },
  OTHERS_CONFIGURATION: {
    path: '/others-configuration',
    icon: '⚙️',
    description: 'Others configuration',
  },
  ATTENDANCE_POLICY: {
    path: '/attendance-policy',
    icon: '📋',
    description: 'Attendance policy',
  },
  PAYROLL_MASTER: {
    path: '/payroll-master',
    icon: '💰',
    description: 'Payroll master',
  },
  EMPLOYEE_SEPARATIONS: {
    path: '/payroll/employee-separation',
    icon: '🚪',
    description: 'Employee separation',
  },
  ESOP: {
    path: '/esop',
    icon: '📈',
    description: 'ESOP management',
  },
  HR_AUDIT_SETTINGS: {
    path: '/hr-audit-settings',
    icon: '📋',
    description: 'HR audit settings',
  },
  EMPLOYEE_MASTER_APPROVAL: {
    path: '/employee-master-approval',
    icon: '✅',
    description: 'Employee master approval',
  },
  COST_CENTRE_DEPARTMENT: {
    path: '/cost-centre-department',
    icon: '🏗️',
    description: 'Cost Centre & Department setup',
  },
  USER_MODULE: {
    path: '/user-module',
    icon: '👤',
    description: 'User role and module permission management',
  },
};

/** Get assigned modules from localStorage (set on Configurator login) */
export function getAssignedModules(): ConfiguratorModule[] {
  try {
    const raw = localStorage.getItem('modules');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Per-module permission flags from /api/v1/user-role-modules/project */
export interface ModulePermissions {
  is_enabled: boolean;
  can_view: boolean;
  can_add: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

/** Default permissions when no module permission entry is found for a specific path */
const DEFAULT_PERMISSIONS: ModulePermissions = {
  is_enabled: false,
  can_view: false,
  can_add: false,
  can_edit: false,
  can_delete: false,
};

/** Paths that are always accessible regardless of Config DB role_module_permissions — empty, all controlled via Config DB */
const ALWAYS_ACCESSIBLE_PATHS = new Set<string>();

/** Full-access permissions used as fallback when modulePermissions hasn't been loaded yet */
const FULL_ACCESS_PERMISSIONS: ModulePermissions = {
  is_enabled: true,
  can_view: true,
  can_add: true,
  can_edit: true,
  can_delete: true,
};

/**
 * Get permissions for a specific module/page path.
 * Reads from localStorage 'modulePermissions' which is populated during login
 * from POST /api/v1/user-role-modules/project.
 *
 * Tries exact match first, then checks if any stored path is a prefix of the given path.
 * Returns FULL_ACCESS if modulePermissions hasn't been populated yet (pre-login sessions).
 */
export function getModulePermissions(path: string): ModulePermissions {
  try {
    // Always-accessible modules get full access regardless of Config DB permissions
    if (ALWAYS_ACCESSIBLE_PATHS.has(path)) return FULL_ACCESS_PERMISSIONS;

    const raw = localStorage.getItem('modulePermissions');
    // No permissions map yet (e.g. session from before this feature was deployed) → allow all
    if (!raw) return FULL_ACCESS_PERMISSIONS;
    const map: Record<string, ModulePermissions> = JSON.parse(raw);

    // Exact match
    if (map[path]) return map[path];

    // Prefix match: e.g. path="/employees/123" matches stored "/employees"
    for (const key of Object.keys(map)) {
      if (path.startsWith(key + '/') || path === key) {
        return map[key];
      }
    }

    return DEFAULT_PERMISSIONS;
  } catch {
    return DEFAULT_PERMISSIONS;
  }
}

/**
 * Check if a module/page is enabled (visible in sidebar) for the current user's role.
 * Uses the is_enabled flag from /api/v1/user-role-modules/project.
 * Returns true when modulePermissions hasn't been loaded yet (backward compat).
 */
export function isModuleEnabled(path: string): boolean {
  return getModulePermissions(path).is_enabled;
}
