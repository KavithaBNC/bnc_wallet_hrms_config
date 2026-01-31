import { AppError } from '../middlewares/errorHandler';
import { prisma } from '../utils/prisma';
import { rolePermissionService } from './role-permission.service';
import { UserRole } from '@prisma/client';

/** Resources that can be assigned per organization (exclude super_admin_only: organizations). */
export const ASSIGNABLE_MODULE_RESOURCES = [
  'dashboard',
  'permissions',
  'employees',
  'departments',
  'positions',
  'attendance',
  'leaves',
  'payroll',
  'employee_separations',
  'employee_rejoin',
  'salary_structures',
  'employee_salaries',
  'hr_audit_settings',
  'employee_master_approval',
] as const;

export type AssignableModuleResource = (typeof ASSIGNABLE_MODULE_RESOURCES)[number];

export class OrganizationModuleService {
  /**
   * Get enabled module resources for an organization.
   * Uses organization_modules table. If that is empty, falls back to ORG_ADMIN's
   * org-specific role_permissions so Org Admin sees modules assigned via Module Permission page.
   */
  async getModules(organizationId: string): Promise<string[]> {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!org) {
      throw new AppError('Organization not found', 404);
    }
    const rows = await prisma.organizationModule.findMany({
      where: { organizationId },
      select: { resource: true },
    });
    let resources: string[];
    if (rows.length > 0) {
      resources = rows.map((r) => r.resource);
    } else {
      const orgAdminPerms = await prisma.rolePermission.findMany({
        where: {
          role: UserRole.ORG_ADMIN,
          organizationId,
        },
        include: { permission: { select: { resource: true } } },
      });
      resources = [...new Set(orgAdminPerms.map((rp) => rp.permission.resource))];
    }
    // Payroll Master implies Employee Separation and Employee Rejoin: include when payroll is assigned
    if (resources.includes('payroll')) {
      if (!resources.includes('employee_separations')) resources = [...resources, 'employee_separations'];
      if (!resources.includes('employee_rejoin')) resources = [...resources, 'employee_rejoin'];
    }
    return resources;
  }

  /**
   * Set enabled modules for an organization (Super Admin only).
   * Also sets ORG_ADMIN's org-specific permissions to only these modules so Org Admin sees only assigned modules.
   */
  async setModules(organizationId: string, resources: string[]): Promise<{ updated: number }> {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!org) {
      throw new AppError('Organization not found', 404);
    }

    const valid = resources.filter((r) =>
      (ASSIGNABLE_MODULE_RESOURCES as readonly string[]).includes(r)
    );
    let unique = [...new Set(valid)];
    // Payroll Master implies Employee Separation and Employee Rejoin when payroll is assigned
    if (unique.includes('payroll')) {
      if (!unique.includes('employee_separations')) unique = [...unique, 'employee_separations'];
      if (!unique.includes('employee_rejoin')) unique = [...unique, 'employee_rejoin'];
    }

    await prisma.$transaction(async (tx) => {
      await tx.organizationModule.deleteMany({ where: { organizationId } });
      if (unique.length > 0) {
        await tx.organizationModule.createMany({
          data: unique.map((resource) => ({ organizationId, resource })),
        });
      }
    });

    // Set ORG_ADMIN's org-specific permissions so they only see assigned modules
    const permissionIds = await this.getPermissionIdsForResources(unique);
    await rolePermissionService.replaceRolePermissions(
      UserRole.ORG_ADMIN,
      permissionIds,
      organizationId
    );

    return { updated: unique.length };
  }

  /**
   * Get permission IDs for View (read), and for "permissions" module also Add (create) and Edit (update)
   */
  private async getPermissionIdsForResources(resources: string[]): Promise<string[]> {
    const actionsByResource: Record<string, string[]> = {};
    for (const resource of resources) {
      actionsByResource[resource] = ['read'];
      if (resource === 'permissions') {
        actionsByResource[resource].push('create', 'update');
      }
    }
    const permissions = await prisma.permission.findMany({
      where: {
        resource: { in: resources },
        action: { in: ['read', 'create', 'update'] },
      },
      select: { id: true, resource: true, action: true },
    });
    const ids: string[] = [];
    for (const p of permissions) {
      const allowed = actionsByResource[p.resource];
      if (allowed && allowed.includes(p.action)) {
        ids.push(p.id);
      }
    }
    return ids;
  }
}

export const organizationModuleService = new OrganizationModuleService();
