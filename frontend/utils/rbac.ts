/**
 * Role-Based Access Control (RBAC) utilities for frontend
 */

export type UserRole = 'SUPER_ADMIN' | 'ORG_ADMIN' | 'HR_MANAGER' | 'MANAGER' | 'EMPLOYEE';

/**
 * Check if user can create employees
 */
export const canCreateEmployee = (role?: string): boolean => {
  if (!role) return false;
  return ['SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'].includes(role);
};

/**
 * Check if user can update employees
 */
export const canUpdateEmployee = (role?: string): boolean => {
  if (!role) return false;
  return ['SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'].includes(role);
};

/**
 * Check if user can delete employees
 */
export const canDeleteEmployee = (role?: string): boolean => {
  if (!role) return false;
  return ['SUPER_ADMIN', 'ORG_ADMIN'].includes(role);
};

/**
 * Check if user can view employee statistics
 */
export const canViewStatistics = (role?: string): boolean => {
  if (!role) return false;
  return ['SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'].includes(role);
};

/**
 * Check if user can view employee hierarchy
 */
export const canViewHierarchy = (role?: string): boolean => {
  if (!role) return false;
  return ['SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER', 'MANAGER'].includes(role);
};

/**
 * Check if user can view sensitive employee data
 */
export const canViewSensitiveData = (role?: string): boolean => {
  if (!role) return false;
  return ['SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'].includes(role);
};

/**
 * Get user-friendly role name
 */
export const getRoleName = (role?: string): string => {
  if (!role) return 'Unknown';
  return role.replace(/_/g, ' ');
};
