/**
 * Shared role utilities.
 * Uses Prisma UserRole enum as the source of truth for valid roles.
 * Permission checks use the in-memory Configurator cache (userHasPermission).
 */
import { UserRole } from '@prisma/client';
import { userHasPermission } from './permission-cache';

/** All valid user roles from the Prisma enum (dynamic — auto-updates when enum changes). */
export const VALID_USER_ROLES = Object.values(UserRole) as UserRole[];

/** Roles that are scoped to an organization (all except SUPER_ADMIN). */
export const ORG_SCOPED_ROLES = VALID_USER_ROLES.filter((r) => r !== 'SUPER_ADMIN');

/** Roles that a non-Super-Admin (e.g. Org Admin) may assign permissions to. */
export const SUBORDINATE_ROLES = VALID_USER_ROLES.filter(
  (r) => r !== 'SUPER_ADMIN' && r !== 'ORG_ADMIN'
);

/**
 * Check if user can manage organization-level resources (cross-org access).
 * Equivalent to the old `role === 'SUPER_ADMIN'` org-scoping check.
 */
export function canManageOrgs(userId: string): boolean {
  return userHasPermission(userId, '/organizations', 'can_edit');
}

/**
 * Check if user has HR-level access for a given module path.
 * Equivalent to the old `role === 'HR_MANAGER' || role === 'ORG_ADMIN'` checks.
 */
export function hasModuleEditAccess(userId: string, modulePath: string): boolean {
  return userHasPermission(userId, modulePath, 'can_edit');
}

/**
 * Check if user has view-level access for a given module path.
 * Equivalent to the old `role === 'MANAGER'` level checks.
 */
export function hasModuleViewAccess(userId: string, modulePath: string): boolean {
  return userHasPermission(userId, modulePath, 'can_view');
}
