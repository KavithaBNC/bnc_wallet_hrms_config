/**
 * Configurator module code → HRMS dashboard card mapping.
 * Modules come from Config DB project_modules table, filtered by role_module_permissions.
 */

export interface ConfiguratorModule {
  id: number;
  name: string;
  code: string;
  description?: string;
  is_active?: boolean;
  path?: string;
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
    path: '/departments',
    icon: '🏢',
    description: 'Organize departments',
  },
  DEPARTMENT: {
    path: '/departments',
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
