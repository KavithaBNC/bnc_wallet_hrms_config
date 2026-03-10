import { AppError } from '../middlewares/errorHandler';
import { prisma } from '../utils/prisma';
import { rolePermissionService } from './role-permission.service';
import { permissionService } from './permission.service';
import { UserRole } from '@prisma/client';

/** Resources that can be assigned per organization (exclude super_admin_only: organizations). */
export const ASSIGNABLE_MODULE_RESOURCES = [
  'dashboard',
  'permissions',
  'employees',
  'departments',
  'positions',
  'event_configuration',
  'attendance_components',
  'encashment_carry_forward',
  'hr_activities',
  'others_configuration',
  'validation_process',
  'validation_process_rule',
  'rights_allocation',
  'workflow_mapping',
  'rule_setting',
  'auto_credit_setting',
  'approval_workflow',
  'attendance',
  'attendance_policy',
  'leaves',
  'time_attendance',
  'shifts',
  'payroll',
  'employee_separations',
  'employee_rejoin',
  'salary_structures',
  'salary_templates',
  'employee_salaries',
  'hr_audit_settings',
  'employee_master_approval',
  'esop',
  'transfer_promotions',
  'transfer_promotion_entry',
  'fnf_settlements',
  'employee_loans',
  'statutory_compliance',
  'epf_processing',
  'esic_processing',
  'professional_tax',
  'tds_income_tax',
  'reports',
] as const;

export type AssignableModuleResource = (typeof ASSIGNABLE_MODULE_RESOURCES)[number];

export class OrganizationModuleService {
  /**
   * Get enabled module resources for an organization.
   * Uses organization_modules table. If that is empty, falls back to ORG_ADMIN's
   * org-specific role_permissions so Org Admin sees modules assigned via Module Permission page.
   * Also merges in ORG_ADMIN's role_permission resources so the Module Permission table shows
   * every module the Org Admin can see (e.g. Event Configuration) and assign to HR/Manager/Employee.
   */
  async getModules(organizationId: string): Promise<string[]> {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!org) {
      throw new AppError('Organization not found', 404);
    }
    const rows = await prisma.$queryRaw<Array<{ resource: string }>>`
      SELECT resource FROM organization_modules WHERE organization_id = ${organizationId}::uuid
    `;
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
    // Merge ORG_ADMIN's org-specific permissions so Module Permission table shows all modules Org Admin can see
    const orgAdminPerms = await prisma.rolePermission.findMany({
      where: { role: UserRole.ORG_ADMIN, organizationId },
      include: { permission: { select: { resource: true } } },
    });
    const assignableList = ASSIGNABLE_MODULE_RESOURCES as readonly string[];
    const fromPerms = orgAdminPerms
      .map((rp) => rp.permission.resource)
      .filter((r) => assignableList.includes(r));
    resources = [...new Set([...resources, ...fromPerms])];
    // Payroll Master implies Employee Separation and Employee Rejoin: include when payroll is assigned
    if (resources.includes('payroll')) {
      if (!resources.includes('employee_separations')) resources = [...resources, 'employee_separations'];
      if (!resources.includes('employee_rejoin')) resources = [...resources, 'employee_rejoin'];
    }
    // Time attendance implies Shift Master / Shift Assign / Associate Shift Change (resource: shifts)
    if (resources.includes('time_attendance') && !resources.includes('shifts')) {
      resources = [...resources, 'shifts'];
    }
    // Transaction sub-modules: always include so Org Admin can see and assign Increment, Transfer and Promotion Entry, Emp Code Transfer
    if (!resources.includes('transfer_promotions')) resources = [...resources, 'transfer_promotions'];
    if (!resources.includes('transfer_promotion_entry')) resources = [...resources, 'transfer_promotion_entry'];
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
    // Time attendance implies shifts (Shift Master, Shift Assign, Associate Shift Change)
    if (unique.includes('time_attendance') && !unique.includes('shifts')) {
      unique = [...unique, 'shifts'];
    }

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`DELETE FROM organization_modules WHERE organization_id = ${organizationId}::uuid`;
      if (unique.length > 0) {
        for (const resource of unique) {
          await tx.$executeRaw`
            INSERT INTO organization_modules (id, organization_id, resource, created_at)
            VALUES (uuid_generate_v4(), ${organizationId}::uuid, ${resource}, NOW())
          `;
        }
      }
    });

    // Set ORG_ADMIN's and HR_MANAGER's org-specific permissions so they only see assigned modules
    const permissionIds = await this.getPermissionIdsForResources(unique);
    await rolePermissionService.replaceRolePermissions(
      UserRole.ORG_ADMIN,
      permissionIds,
      organizationId
    );
    await rolePermissionService.replaceRolePermissions(
      UserRole.HR_MANAGER,
      permissionIds,
      organizationId
    );

    return { updated: unique.length };
  }

  /**
   * Get permission IDs for View (read), Add (create), Edit (update) for each assigned resource.
   * So Org Admin and HR can see and use the assigned modules (e.g. Shift Master).
   */
  private async getPermissionIdsForResources(resources: string[]): Promise<string[]> {
    const actionsByResource: Record<string, string[]> = {};
    for (const resource of resources) {
      actionsByResource[resource] = ['read', 'create', 'update'];
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

  /**
   * Default modules for orgs that have none (e.g. ABC created manually, never had "Assign modules").
   * Full list so HR/Org Admin see sidebar and can use shift + other modules.
   */
  private getDefaultModulesForOrg(): string[] {
    return [...(ASSIGNABLE_MODULE_RESOURCES as readonly string[])];
  }

  /**
   * Backfill shift module for all organizations, and add default modules to orgs that have none.
   * Call once (Super Admin) to fix orgs like ABC so Deepa (HR) sees menus and shift modules.
   * Ensures time_attendance and shifts permissions exist before assigning (so one click is enough).
   */
  async syncShiftModuleForAllOrgs(): Promise<{ updated: number; orgIds: string[] }> {
    await permissionService.syncAppModulePermissions();
    const allOrgs = await prisma.organization.findMany({ select: { id: true } });
    const orgIds = allOrgs.map((o) => o.id);
    let updated = 0;
    for (const organizationId of orgIds) {
      const resourceRows = await prisma.$queryRaw<Array<{ resource: string }>>`
        SELECT resource FROM organization_modules WHERE organization_id = ${organizationId}::uuid
      `;
      const resources = resourceRows.map((r) => r.resource);
      let nextResources: string[];
      if (resources.length === 0) {
        nextResources = this.getDefaultModulesForOrg();
      } else {
        const hasShifts = resources.includes('shifts');
        const hasTimeAttendance = resources.includes('time_attendance');
        if (hasShifts && hasTimeAttendance) continue;
        nextResources = [...resources];
        if (!nextResources.includes('time_attendance')) nextResources.push('time_attendance');
        if (!nextResources.includes('shifts')) nextResources.push('shifts');
      }
      await this.setModules(organizationId, nextResources);
      updated++;
    }
    return { updated, orgIds };
  }
}

export const organizationModuleService = new OrganizationModuleService();
