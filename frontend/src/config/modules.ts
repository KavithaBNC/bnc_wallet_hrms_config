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
  { path: '/attendance', label: 'Attendance', resource: 'attendance', visibility: 'all' },
  { path: '/leave', label: 'Leave Management', resource: 'leaves', visibility: 'all' },
  { path: '/payroll', label: 'Payroll', resource: 'payroll', visibility: 'all' },
  { path: '/payroll-master', label: 'Payroll Master', resource: 'payroll', visibility: 'all' },
  { path: '/payroll/employee-separation', label: 'Employee Separation', resource: 'employee_separations', visibility: 'all', parentPath: '/payroll-master' },
  { path: '/payroll/employee-rejoin', label: 'Employee Rejoin', resource: 'employee_rejoin', visibility: 'all', parentPath: '/payroll-master' },
  { path: '/salary-structures', label: 'Salary Structure', resource: 'salary_structures', visibility: 'all' },
  { path: '/employee-salaries', label: 'Employee Salary', resource: 'employee_salaries', visibility: 'all' },
  { path: '/hr-audit-settings', label: 'HR Audit Settings', resource: 'hr_audit_settings', visibility: 'all' },
  { path: '/employee-master-approval', label: 'Employee Master Approval', resource: 'employee_master_approval', visibility: 'all' },
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
