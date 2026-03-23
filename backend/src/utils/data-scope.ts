/**
 * Shared data scoping utility.
 * Replaces the repeated if(EMPLOYEE)/if(MANAGER)/if(HR_MANAGER|ORG_ADMIN) pattern
 * with dynamic permission-based scoping via the Configurator cache.
 */
import { userHasPermission } from './permission-cache';

export type DataScope = 'self' | 'team' | 'org';

/**
 * Determine the data visibility scope for a user on a given module.
 *
 * - 'org'  → can_edit on the module path (HR/OrgAdmin level — sees all org records)
 * - 'team' → can_view on the module path (Manager level — sees team records)
 * - 'self' → no special permission (Employee level — sees own records only)
 *
 * Note: SUPER_ADMIN will have can_edit via Config API, so they get 'org' scope.
 */
export function getDataScope(userId: string, modulePath: string): DataScope {
  if (userHasPermission(userId, modulePath, 'can_edit')) {
    return 'org';
  }
  if (userHasPermission(userId, modulePath, 'can_view')) {
    return 'team';
  }
  return 'self';
}
