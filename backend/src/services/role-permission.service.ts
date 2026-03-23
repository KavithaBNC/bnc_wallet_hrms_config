
import type { UserRole as UserRoleType } from '@prisma/client';
import { UserRole } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { AppError } from '../middlewares/errorHandler';
import { ORG_SCOPED_ROLES } from '../utils/roles';

export interface AssignPermissionInput {
  role: UserRoleType | string;
  permissionIds: string[];
  organizationId?: string; // Optional: for org-specific permissions
}

export interface RemovePermissionInput {
  role: UserRoleType | string;
  permissionId: string;
  organizationId?: string;
}

export class RolePermissionService {
  /**
   * Assign permissions to a role
   */
  async assignPermissions(data: AssignPermissionInput): Promise<{
    assigned: number;
    skipped: number;
  }> {
    const { role, permissionIds, organizationId } = data;

    let assigned = 0;
    let skipped = 0;

    for (const permissionId of permissionIds) {
      // Check if permission exists
      const permission = await prisma.permission.findUnique({
        where: { id: permissionId },
      });

      if (!permission) {
        skipped++;
        continue;
      }

      // Check if already assigned
      const existing = await prisma.rolePermission.findFirst({
        where: {
          role: role as UserRole,
          permissionId,
          organizationId: organizationId || null,
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      // Assign permission
      await prisma.rolePermission.create({
        data: {
          role: role as UserRole,
          permissionId,
          organizationId: organizationId || null,
        },
      });

      assigned++;
    }

    return { assigned, skipped };
  }

  /**
   * Remove permission from a role
   */
  async removePermission(data: RemovePermissionInput): Promise<void> {
    const { role, permissionId, organizationId } = data;

    const rolePermission = await prisma.rolePermission.findFirst({
      where: {
        role: role as UserRole,
        permissionId,
        organizationId: organizationId || null,
      },
    });

    if (!rolePermission) {
      throw new AppError('Permission not assigned to this role', 404);
    }

    await prisma.rolePermission.delete({
      where: { id: rolePermission.id },
    });
  }

  /**
   * Get all permissions for a role
   */
  async getRolePermissions(
    role: UserRoleType,
    organizationId?: string
  ): Promise<any[]> {
    const rolePermissions = await prisma.rolePermission.findMany({
      where: {
        role: role as UserRole,
        organizationId: organizationId || null,
      },
      include: {
        permission: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Sort permissions manually by module, resource, action
    rolePermissions.sort((a, b) => {
      const permA = a.permission;
      const permB = b.permission;
      
      // First by module
      if (permA.module !== permB.module) {
        return (permA.module || '').localeCompare(permB.module || '');
      }
      // Then by resource
      if (permA.resource !== permB.resource) {
        return permA.resource.localeCompare(permB.resource);
      }
      // Finally by action
      return permA.action.localeCompare(permB.action);
    });

    return rolePermissions.map((rp) => ({
      id: rp.id,
      role: rp.role,
      permission: rp.permission,
      organizationId: rp.organizationId,
      createdAt: rp.createdAt,
    }));
  }

  /**
   * Check if a role has a specific permission.
   * For ORG_ADMIN, HR_MANAGER, MANAGER, EMPLOYEE with organizationId: only org-specific permission counts.
   */
  async hasPermission(
    role: UserRole,
    resource: string,
    action: string,
    organizationId?: string
  ): Promise<boolean> {
    const permission = await prisma.permission.findFirst({
      where: { resource, action },
    });

    if (!permission) {
      return false;
    }

    const onlyOrgSpecific = (ORG_SCOPED_ROLES as readonly string[]).includes(role) && organizationId;

    const rolePermission = await prisma.rolePermission.findFirst({
      where: {
        role: role as UserRole,
        permissionId: permission.id,
        ...(onlyOrgSpecific
          ? { organizationId }
          : {
              OR: [
                { organizationId: null },
                { organizationId: organizationId || null },
              ],
            }),
      },
    });

    return !!rolePermission;
  }

  /**
   * Get all permissions for a user (considering their role and organization).
   * For ORG_ADMIN, HR_MANAGER, MANAGER, EMPLOYEE with organizationId: only return org-specific
   * permissions so Org Admin's assignment fully controls what they see (no system-wide merge).
   */
  async getUserPermissions(
    role: UserRoleType,
    organizationId?: string
  ): Promise<any[]> {
    if ((ORG_SCOPED_ROLES as readonly string[]).includes(role) && organizationId) {
      const orgPermissions = await prisma.rolePermission.findMany({
        where: {
          role: role as UserRole,
          organizationId,
        },
        include: {
          permission: true,
        },
      });
      const list = orgPermissions.map((rp) => ({
        id: rp.permission.id,
        name: rp.permission.name,
        resource: rp.permission.resource,
        action: rp.permission.action,
        module: rp.permission.module,
        description: rp.permission.description,
      }));
      if (list.length > 0) {
        return list;
      }
      if (role === 'ORG_ADMIN') {
        return list;
      }
      const systemPermissions = await prisma.rolePermission.findMany({
        where: {
          role: role as UserRole,
          organizationId: null,
        },
        include: { permission: true },
      });
      return systemPermissions.map((rp) => ({
        id: rp.permission.id,
        name: rp.permission.name,
        resource: rp.permission.resource,
        action: rp.permission.action,
        module: rp.permission.module,
        description: rp.permission.description,
      }));
    }

    // Super Admin or no org: system-wide permissions only
    const systemPermissions = await prisma.rolePermission.findMany({
      where: {
        role: role as UserRole,
        organizationId: null,
      },
      include: {
        permission: true,
      },
    });

    return systemPermissions.map((rp) => ({
      id: rp.permission.id,
      name: rp.permission.name,
      resource: rp.permission.resource,
      action: rp.permission.action,
      module: rp.permission.module,
      description: rp.permission.description,
    }));
  }

  /**
   * Replace all permissions for a role (remove old, assign new).
   * When restrictToOrgModules is true (Org Admin assigning for their org), only permissions for
   * modules enabled for that organization are allowed. Super Admin is not restricted.
   */
  async replaceRolePermissions(
    role: UserRoleType | string,
    permissionIds: string[],
    organizationId?: string,
    restrictToOrgModules?: boolean
  ): Promise<{
    removed: number;
    assigned: number;
  }> {
    if (restrictToOrgModules && organizationId && permissionIds.length > 0) {
      const orgModules = await prisma.$queryRaw<Array<{ resource: string }>>`
        SELECT resource FROM organization_modules WHERE organization_id = ${organizationId}::uuid
      `;
      const allowedResources = new Set(orgModules.map((m) => m.resource));
      // Merge ORG_ADMIN's org-specific permissions so allowed list matches getModules (e.g. Event Configuration)
      const orgAdminPerms = await prisma.rolePermission.findMany({
        where: { role: UserRole.ORG_ADMIN, organizationId },
        include: { permission: { select: { resource: true } } },
      });
      for (const rp of orgAdminPerms) {
        allowedResources.add(rp.permission.resource);
      }
      // Payroll Master implies Employee Separation and Employee Rejoin when payroll is assigned
      if (allowedResources.has('payroll')) {
        allowedResources.add('employee_separations');
        allowedResources.add('employee_rejoin');
      }
      // Time attendance implies Shift Master / Shift Assign (resource: shifts)
      if (allowedResources.has('time_attendance')) {
        allowedResources.add('shifts');
      }
      // ESOP parent implies all ESOP sub-modules
      if (allowedResources.has('esop')) {
        for (const r of ['esop_pools', 'esop_vesting_plans', 'esop_grants', 'esop_vesting_schedules', 'esop_exercise_requests', 'esop_ledger']) {
          allowedResources.add(r);
        }
      }
      // Transaction modules: always allow so Org Admin can assign Increment, Transfer and Promotion Entry, Emp Code Transfer
      allowedResources.add('transfer_promotions');
      allowedResources.add('transfer_promotion_entry');
      const perms = await prisma.permission.findMany({
        where: { id: { in: permissionIds } },
        select: { id: true, resource: true },
      });
      const notAllowed = perms.find((p) => !allowedResources.has(p.resource));
      if (notAllowed) {
        throw new AppError(
          'Cannot assign permissions for modules not enabled for your organization. You can only assign within your allowed modules.',
          403
        );
      }
    }

    // Remove all existing permissions for this role (system-wide or org-specific)
    const deleted = await prisma.rolePermission.deleteMany({
      where: {
        role: role as UserRole,
        organizationId: organizationId || null,
      },
    });

    // Bulk-insert new permissions in a single DB call (avoids N×3 sequential queries)
    let assigned = 0;
    if (permissionIds.length > 0) {
      const toInsert = permissionIds.map((pid) => ({
        role: role as UserRole,
        permissionId: pid,
        organizationId: organizationId || null,
      }));
      const created = await prisma.rolePermission.createMany({
        data: toInsert,
        skipDuplicates: true,
      });
      assigned = created.count;
    }

    return {
      removed: deleted.count,
      assigned,
    };
  }
}

export const rolePermissionService = new RolePermissionService();
