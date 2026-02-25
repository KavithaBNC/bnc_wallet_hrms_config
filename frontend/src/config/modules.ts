/**
 * App sidebar modules – single source of truth for menu and Module Permission screen.
 * New menus added here auto-sync to the permissions list (no manual module creation).
 * Backend must have permissions: <resource>.read, <resource>.create, <resource>.update, <resource>.delete
 * for each resource below (View = read, Add = create, Edit = update, Delete = delete).
 */

export type ModuleVisibility = 'all' | 'super_admin_only' | 'module_permission_only';

export interface AppModule {
  path: string;
  label: string;
  /** Used for permission checks: resource.read (view), resource.create (add), resource.update (edit), resource.delete (delete) */
  resource: string;
  /** 'all' = show in sidebar if user has view permission; 'super_admin_only' = only Super Admin; 'module_permission_only' = only Super Admin & Org Admin (Module Permission screen) */
  visibility: ModuleVisibility;
  /** If set, render this item as a sub-menu under the module with this path (e.g. Payroll Master -> Employee Separation) */
  parentPath?: string;
}

/** Sidebar modules in display order. Add new menu here and it appears in sidebar and in Module Permission screen.
 * Organization Management & Module Permission are near top so Super Admin / Org Admin see them without scrolling. */
export const APP_MODULES: AppModule[] = [
  { path: '/dashboard', label: 'Dashboard', resource: 'dashboard', visibility: 'all' },
  { path: '/organizations', label: 'Organization Management', resource: 'organizations', visibility: 'super_admin_only' },
  { path: '/permissions', label: 'Module Permission', resource: 'permissions', visibility: 'module_permission_only' },
  { path: '/employees', label: 'Employees', resource: 'employees', visibility: 'all' },
  { path: '/departments', label: 'Department', resource: 'departments', visibility: 'all' },
  { path: '/positions', label: 'Position', resource: 'positions', visibility: 'all' },
  { path: '/core-hr', label: 'Core HR', resource: 'core_hr', visibility: 'all' },
  { path: '/core-hr/overview', label: 'Overview', resource: 'core_hr', visibility: 'all', parentPath: '/core-hr' },
  { path: '/core-hr/compound-creation', label: 'Component Creation', resource: 'compound_creation', visibility: 'all', parentPath: '/core-hr' },
  { path: '/core-hr/rules-engine', label: 'Rules Engine', resource: 'rules_engine', visibility: 'all', parentPath: '/core-hr' },
  { path: '/core-hr/variable-input', label: 'Variable Input', resource: 'variable_input', visibility: 'all', parentPath: '/core-hr' },
  { path: '/event-configuration', label: 'Event Configuration', resource: 'event_configuration', visibility: 'all' },
  { path: '/event-configuration/attendance-components', label: 'Attendance Components', resource: 'attendance_components', visibility: 'all', parentPath: '/event-configuration' },
  { path: '/event-configuration/approval-workflow', label: 'Approval Workflow', resource: 'approval_workflow', visibility: 'all', parentPath: '/event-configuration' },
  { path: '/event-configuration/workflow-mapping', label: 'Workflow Mapping', resource: 'workflow_mapping', visibility: 'all', parentPath: '/event-configuration' },
  { path: '/event-configuration/rights-allocation', label: 'Rights Allocation', resource: 'rights_allocation', visibility: 'all', parentPath: '/event-configuration' },
  { path: '/event-configuration/rule-setting', label: 'Rule Setting', resource: 'rule_setting', visibility: 'all', parentPath: '/event-configuration' },
  { path: '/event-configuration/auto-credit-setting', label: 'Auto Credit Setting', resource: 'auto_credit_setting', visibility: 'all', parentPath: '/event-configuration' },
  { path: '/event-configuration/encashment-carry-forward', label: 'Encashment / Carry Forward', resource: 'encashment_carry_forward', visibility: 'all', parentPath: '/event-configuration' },
  { path: '/hr-activities', label: 'HR Activities', resource: 'hr_activities', visibility: 'all' },
  { path: '/hr-activities/validation-process', label: 'Validation Process', resource: 'validation_process', visibility: 'all', parentPath: '/hr-activities' },
  { path: '/hr-activities/post-to-payroll', label: 'Post to Payroll', resource: 'hr_activities', visibility: 'all', parentPath: '/hr-activities' },
  { path: '/others-configuration', label: 'Others Configuration', resource: 'others_configuration', visibility: 'all' },
  { path: '/others-configuration/validation-process-rule', label: 'Validation Process Rule', resource: 'validation_process_rule', visibility: 'all', parentPath: '/others-configuration' },
  { path: '/others-configuration/attendance-lock', label: 'Attendance Lock', resource: 'others_configuration', visibility: 'all', parentPath: '/others-configuration' },
  { path: '/others-configuration/post-to-payroll', label: 'Post to Payroll Setup', resource: 'others_configuration', visibility: 'all', parentPath: '/others-configuration' },
  { path: '/attendance', label: 'Attendance', resource: 'attendance', visibility: 'all' },
  { path: '/attendance/my-requests/excess-time-request', label: 'Excess Time Request', resource: 'attendance', visibility: 'all', parentPath: '/leave' },
  { path: '/attendance/excess-time-approval', label: 'Excess Time Approval', resource: 'attendance', visibility: 'all', parentPath: '/leave' },
  { path: '/attendance-policy', label: 'Attendance Policy', resource: 'attendance_policy', visibility: 'all' },
  { path: '/attendance-policy/late-and-others', label: 'Late & Others', resource: 'attendance_policy', visibility: 'all', parentPath: '/attendance-policy' },
  { path: '/attendance-policy/week-of-assign', label: 'Week of Assign', resource: 'attendance_policy', visibility: 'all', parentPath: '/attendance-policy' },
  { path: '/attendance-policy/holiday-assign', label: 'Holiday Assign', resource: 'attendance_policy', visibility: 'all', parentPath: '/attendance-policy' },
  { path: '/attendance-policy/excess-time-conversion', label: 'Excess Time Conversion', resource: 'attendance_policy', visibility: 'all', parentPath: '/attendance-policy' },
  { path: '/attendance-policy/ot-usage-rule', label: 'OT usage rule', resource: 'attendance_policy', visibility: 'all', parentPath: '/attendance-policy' },
  { path: '/leave', label: 'Event', resource: 'leaves', visibility: 'all' },
  { path: '/attendance/apply-event', label: 'Event Apply', resource: 'leaves', visibility: 'all', parentPath: '/leave' },
  { path: '/event/requests', label: 'Event Request', resource: 'leaves', visibility: 'all', parentPath: '/leave' },
  { path: '/leave/approvals', label: 'Event Approval', resource: 'leaves', visibility: 'all', parentPath: '/leave' },
  { path: '/event/balance-entry', label: 'Event Balance Entry', resource: 'leaves', visibility: 'all', parentPath: '/leave' },
  { path: '/time-attendance', label: 'Time attendance', resource: 'time_attendance', visibility: 'all' },
  { path: '/time-attendance/shift-master', label: 'Shift Master', resource: 'shifts', visibility: 'all', parentPath: '/time-attendance' },
  { path: '/time-attendance/shift-assign', label: 'Shift Assign', resource: 'shifts', visibility: 'all', parentPath: '/time-attendance' },
  { path: '/time-attendance/associate-shift-change', label: 'Associate Shift Change', resource: 'shifts', visibility: 'all', parentPath: '/time-attendance' },
  // Associate Shift Grid is accessed through Associate Shift Change flow, not as a separate menu item
  // { path: '/time-attendance/associate-shift-grid', label: 'Associate Shift', resource: 'shifts', visibility: 'all', parentPath: '/time-attendance' },
  { path: '/payroll', label: 'Payroll', resource: 'payroll', visibility: 'all' },
  { path: '/payroll-master', label: 'Payroll Master', resource: 'payroll', visibility: 'all' },
  { path: '/payroll/employee-separation', label: 'Employee Separation', resource: 'employee_separations', visibility: 'all', parentPath: '/payroll-master' },
  { path: '/payroll/employee-rejoin', label: 'Employee Rejoin', resource: 'employee_rejoin', visibility: 'all', parentPath: '/payroll-master' },
  { path: '/salary-structures', label: 'Salary Structure', resource: 'salary_structures', visibility: 'all' },
  { path: '/employee-salaries', label: 'Employee Salary', resource: 'employee_salaries', visibility: 'all' },
  { path: '/hr-audit-settings', label: 'HR Audit Settings', resource: 'hr_audit_settings', visibility: 'all' },
  { path: '/employee-master-approval', label: 'Employee Master Approval', resource: 'employee_master_approval', visibility: 'all' },
  { path: '/esop', label: 'ESOP', resource: 'esop', visibility: 'all' },
  { path: '/esop/add', label: 'Add ESOP', resource: 'esop', visibility: 'all', parentPath: '/esop' },
  { path: '/transaction', label: 'Transaction', resource: 'transfer_promotions', visibility: 'all' },
  { path: '/transaction/transfer-promotions', label: 'Increment', resource: 'transfer_promotions', visibility: 'all', parentPath: '/transaction' },
  { path: '/transaction/transfer-promotion-entry', label: 'Transfer and Promotion Entry', resource: 'transfer_promotion_entry', visibility: 'all', parentPath: '/transaction' },
  { path: '/transaction/emp-code-transfer', label: 'Emp Code Transfer', resource: 'transfer_promotions', visibility: 'all', parentPath: '/transaction' },
  { path: '/transaction/paygroup-transfer', label: 'Pay group Transfer', resource: 'transfer_promotions', visibility: 'all', parentPath: '/transaction' },
];

/** Actions used for module permissions (backend uses read/create/update/delete). */
export const MODULE_ACTIONS = ['read', 'create', 'update', 'delete'] as const;
export type ModuleAction = (typeof MODULE_ACTIONS)[number];

/** UI labels for actions (View, Add, Edit, Delete). */
export const MODULE_ACTION_LABELS: Record<ModuleAction, string> = {
  read: 'View',
  create: 'Add',
  update: 'Edit',
  delete: 'Delete',
};

/** Module Permission screen: only View, Add, Edit (no Delete). */
export const PERMISSION_SCREEN_ACTIONS = ['read', 'create', 'update'] as const;
export type PermissionScreenAction = (typeof PERMISSION_SCREEN_ACTIONS)[number];

export const PERMISSION_SCREEN_ACTION_LABELS: Record<PermissionScreenAction, string> = {
  read: 'View',
  create: 'Add',
  update: 'Edit',
};

/** Modules that appear in the Module Permission screen (all sidebar menus = modules). */
export function getModulesForPermissionScreen(): AppModule[] {
  return APP_MODULES;
}
