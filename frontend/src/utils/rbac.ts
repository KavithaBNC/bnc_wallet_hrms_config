/**
 * Role-Based Access Control (RBAC) utilities for frontend
 */

export type UserRole = 'SUPER_ADMIN' | 'ORG_ADMIN' | 'HR_MANAGER' | 'MANAGER' | 'EMPLOYEE';

/** Known base roles in priority order (most privileged first) */
const BASE_ROLES: UserRole[] = ['SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE'];

/**
 * Extract the base role from a potentially prefixed role code.
 * e.g. "HRMS001_SUPER_ADMIN" → "SUPER_ADMIN", "ORG_ADMIN" → "ORG_ADMIN"
 */
export function resolveBaseRole(role?: string): UserRole | undefined {
  if (!role) return undefined;
  const upper = role.toUpperCase();
  return BASE_ROLES.find((base) => upper === base || upper.endsWith('_' + base));
}

/** Employee form tab keys (must match EmployeeFormTabKey in EmployeeForm) */
export type EmployeeFormTabKey =
  | 'company'
  | 'personal'
  | 'statutory'
  | 'bank'
  | 'salary'
  | 'assets'
  | 'academic'
  | 'previousEmployment'
  | 'family'
  | 'others'
  | 'newFields';

/** Map form tab key to permission resource name (backend employee_* permissions) */
export const EMPLOYEE_TAB_TO_RESOURCE: Record<EmployeeFormTabKey, string> = {
  company: 'employee_company',
  personal: 'employee_personal',
  statutory: 'employee_statutory',
  bank: 'employee_bank',
  salary: 'employee_salary',
  assets: 'employee_assets',
  academic: 'employee_academic',
  previousEmployment: 'employee_previous_employment',
  family: 'employee_family',
  others: 'employee_others',
  newFields: 'employee_new_fields',
};

export interface PermissionLike {
  resource: string;
  action: string;
}

/**
 * From user's permissions, get list of employee form tabs this user can edit (action === 'update').
 * If user has employees.update (full), returns undefined (all tabs editable).
 */
export function getEditableTabsFromPermissions(permissions: PermissionLike[]): EmployeeFormTabKey[] | undefined {
  const hasFullUpdate = permissions.some((p) => p.resource === 'employees' && p.action === 'update');
  if (hasFullUpdate) return undefined;

  const tabKeys = Object.keys(EMPLOYEE_TAB_TO_RESOURCE) as EmployeeFormTabKey[];
  const editable: EmployeeFormTabKey[] = [];
  for (const tab of tabKeys) {
    const resource = EMPLOYEE_TAB_TO_RESOURCE[tab];
    if (permissions.some((p) => p.resource === resource && p.action === 'update')) {
      editable.push(tab);
    }
  }
  return editable.length > 0 ? editable : undefined;
}

/**
 * True if user can edit at least one employee tab (either full employees.update or any employee_*.update).
 */
export function canEditEmployeeByPermission(permissions: PermissionLike[]): boolean {
  if (permissions.some((p) => p.resource === 'employees' && p.action === 'update')) return true;
  return permissions.some((p) => p.resource.startsWith('employee_') && p.action === 'update');
}

/**
 * True if user can view at least one employee tab (employees.read or any employee_*.read).
 */
export function canViewEmployeeByPermission(permissions: PermissionLike[]): boolean {
  if (permissions.some((p) => p.resource === 'employees' && (p.action === 'read' || p.action === 'view_all'))) return true;
  return permissions.some((p) => p.resource.startsWith('employee_') && p.action === 'read');
}

/**
 * Check if user can create employees
 */
export const canCreateEmployee = (role?: string): boolean => {
  const base = resolveBaseRole(role);
  if (!base) return false;
  return ['SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'].includes(base);
};

/**
 * Check if user can update employees
 */
export const canUpdateEmployee = (role?: string): boolean => {
  const base = resolveBaseRole(role);
  if (!base) return false;
  return ['SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'].includes(base);
};

/**
 * Check if user can delete employees
 */
export const canDeleteEmployee = (role?: string): boolean => {
  const base = resolveBaseRole(role);
  if (!base) return false;
  return ['SUPER_ADMIN', 'ORG_ADMIN'].includes(base);
};

/**
 * Check if user can view employee statistics
 */
export const canViewStatistics = (role?: string): boolean => {
  const base = resolveBaseRole(role);
  if (!base) return false;
  return ['SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'].includes(base);
};

/**
 * Check if user can view employee hierarchy
 */
export const canViewHierarchy = (role?: string): boolean => {
  const base = resolveBaseRole(role);
  if (!base) return false;
  return ['SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER', 'MANAGER'].includes(base);
};

/**
 * Check if user can view sensitive employee data
 */
export const canViewSensitiveData = (role?: string): boolean => {
  const base = resolveBaseRole(role);
  if (!base) return false;
  return ['SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'].includes(base);
};

/**
 * Get user-friendly role name
 */
export const getRoleName = (role?: string): string => {
  if (!role) return 'Unknown';
  return role.replace(/_/g, ' ');
};
