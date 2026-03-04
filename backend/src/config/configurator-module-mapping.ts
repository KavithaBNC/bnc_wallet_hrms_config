/**
 * Configurator module code → HRMS resource/path mapping.
 * Configurator modules come from Config DB project_modules table.
 * Role-module-permissions in Config DB filter which modules a user sees.
 * HRMS uses this mapping to show only assigned modules in Dashboard and sidebar.
 */

/** Configurator code (uppercase) → HRMS resource (for permission checks) */
export const CONFIGURATOR_CODE_TO_HRMS_RESOURCE: Record<string, string> = {
  EMPLOYEES: 'employees',
  EMPLOYEE_MANAGEMENT: 'employees',
  ATTENDANCE: 'attendance',
  EVENT: 'leaves',
  LEAVES: 'leaves',
  LEAVE_MANAGEMENT: 'leaves',
  DEPARTMENTS: 'departments',
  DEPARTMENT: 'departments',
  PAYROLL: 'payroll',
  SHIFTS: 'shifts',
  TIME_ATTENDANCE: 'time_attendance',
  SALARY_STRUCTURES: 'salary_structures',
  EMPLOYEE_SALARIES: 'employee_salaries',
  TRANSACTION: 'transfer_promotions',
  TRANSFER_PROMOTIONS: 'transfer_promotions',
  PERMISSIONS: 'permissions',
  CORE_HR: 'core_hr',
  EVENT_CONFIGURATION: 'event_configuration',
  HR_ACTIVITIES: 'hr_activities',
  OTHERS_CONFIGURATION: 'others_configuration',
  ATTENDANCE_POLICY: 'attendance_policy',
  PAYROLL_MASTER: 'payroll',
  EMPLOYEE_SEPARATIONS: 'employee_separations',
  ESOP: 'esop',
  HR_AUDIT_SETTINGS: 'hr_audit_settings',
  EMPLOYEE_MASTER_APPROVAL: 'employee_master_approval',
};

/** Configurator code → HRMS path (for routing) */
export const CONFIGURATOR_CODE_TO_HRMS_PATH: Record<string, string> = {
  EMPLOYEES: '/employees',
  EMPLOYEE_MANAGEMENT: '/employees',
  ATTENDANCE: '/attendance',
  EVENT: '/leave',
  LEAVES: '/leave',
  LEAVE_MANAGEMENT: '/leave',
  DEPARTMENTS: '/departments',
  DEPARTMENT: '/departments',
  PAYROLL: '/payroll',
  SHIFTS: '/time-attendance/shift-master',
  TIME_ATTENDANCE: '/time-attendance/shift-master',
  SALARY_STRUCTURES: '/salary-structures',
  EMPLOYEE_SALARIES: '/employee-salaries',
  TRANSACTION: '/transaction',
  TRANSFER_PROMOTIONS: '/transaction/transfer-promotions',
  PERMISSIONS: '/permissions',
  CORE_HR: '/core-hr',
  EVENT_CONFIGURATION: '/event-configuration',
  HR_ACTIVITIES: '/hr-activities',
  OTHERS_CONFIGURATION: '/others-configuration',
  ATTENDANCE_POLICY: '/attendance-policy',
  PAYROLL_MASTER: '/payroll-master',
  EMPLOYEE_SEPARATIONS: '/payroll/employee-separation',
  ESOP: '/esop',
  HR_AUDIT_SETTINGS: '/hr-audit-settings',
  EMPLOYEE_MASTER_APPROVAL: '/employee-master-approval',
};
