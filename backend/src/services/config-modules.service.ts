/**
 * Config Modules Service — Direct Config DB access (replaces RAG API module calls)
 * Replaces: GET /api/v1/modules/my-modules, GET /api/v1/project-modules,
 *           GET /api/v1/user-role-modules/{role_id}/{project_id},
 *           POST /api/v1/user-role-modules/project
 */

import { configPrisma } from '../utils/config-prisma';
import { config } from '../config/config';

export interface ConfigModule {
  id: number;
  name: string;
  code: string;
  description?: string | null;
  project_id: number;
  parent_module?: string | null;
  parent_module_id?: number | null;
  is_active: boolean;
  page_name?: string | null;
  page_name_mobile?: string | null;
  icon?: string | null;
  position?: number | null;
}

export interface ConfigRoleModulePermission {
  id: number;
  company_id: number;
  role_id: number;
  project_id: number;
  module_id: number;
  is_enabled: boolean | null;
  can_view: boolean;
  can_add: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export interface ConfigRoleModuleWithPage extends ConfigRoleModulePermission {
  page_name?: string | null;
  page_name_mobile?: string | null;
}

const HRMS_PROJECT_ID = config.configuratorHrmsProjectId;

class ConfigModulesService {
  /**
   * Get all project modules from Config DB
   * Replaces: GET /api/v1/modules/my-modules and GET /api/v1/project-modules
   */
  async getModules(projectId?: number): Promise<ConfigModule[]> {
    const pid = projectId ?? HRMS_PROJECT_ID;
    try {
      const modules = await configPrisma.project_modules.findMany({
        where: { project_id: pid, is_active: true },
        orderBy: [{ position: 'asc' }, { name: 'asc' }],
      });
      return modules.map((m) => ({
        id: m.id,
        name: m.name,
        code: m.code,
        description: m.description,
        project_id: m.project_id,
        parent_module: m.parent_module,
        parent_module_id: m.parent_module_id,
        is_active: m.is_active,
        page_name: m.page_name,
        page_name_mobile: m.page_name_mobile,
        icon: m.icon,
        position: m.position,
      }));
    } catch (err) {
      console.error('[configModulesService.getModules] Error:', err);
      return [];
    }
  }

  /**
   * Get role-module permissions from Config DB
   * Replaces: GET /api/v1/user-role-modules/{role_id}/{project_id}
   */
  async getRoleModulePermissions(
    roleId: number,
    companyId: number,
    projectId?: number
  ): Promise<ConfigRoleModulePermission[]> {
    const pid = projectId ?? HRMS_PROJECT_ID;
    try {
      const perms = await configPrisma.role_module_permissions.findMany({
        where: { role_id: roleId, company_id: companyId, project_id: pid },
      });
      return perms.map((p) => ({
        id: p.id,
        company_id: p.company_id,
        role_id: p.role_id,
        project_id: p.project_id,
        module_id: p.module_id,
        is_enabled: p.is_enabled,
        can_view: p.can_view,
        can_add: p.can_add,
        can_edit: p.can_edit,
        can_delete: p.can_delete,
      }));
    } catch (err) {
      console.error('[configModulesService.getRoleModulePermissions] Error:', err);
      return [];
    }
  }

  /**
   * Get role modules with page_name from Config DB
   * Replaces: POST /api/v1/user-role-modules/project
   */
  async getRoleModulesByProject(
    roleId: number,
    projectId?: number,
    companyId?: number
  ): Promise<ConfigRoleModuleWithPage[]> {
    const pid = projectId ?? HRMS_PROJECT_ID;
    try {
      const where: any = { role_id: roleId, project_id: pid };
      if (companyId) where.company_id = companyId;
      const perms = await configPrisma.role_module_permissions.findMany({
        where,
        include: {
          project_modules: {
            select: { page_name: true, page_name_mobile_app: true, page_name_mobile: true },
          },
        },
      });
      return perms.map((p) => ({
        id: p.id,
        company_id: p.company_id,
        role_id: p.role_id,
        project_id: p.project_id,
        module_id: p.module_id,
        is_enabled: p.is_enabled,
        can_view: p.can_view,
        can_add: p.can_add,
        can_edit: p.can_edit,
        can_delete: p.can_delete,
        page_name: p.project_modules?.page_name ?? null,
        page_name_mobile: p.project_modules?.page_name_mobile ?? null,
      }));
    } catch (err) {
      console.error('[configModulesService.getRoleModulesByProject] Error:', err);
      return [];
    }
  }

  /**
   * Get user-assigned modules — only those enabled for the user's role(s)
   */
  async getUserAssignedModules(
    roleId: number,
    companyId: number,
    projectId?: number
  ): Promise<ConfigModule[]> {
    return this.getUserAssignedModulesForRoles([roleId], companyId, projectId);
  }

  /**
   * Get user-assigned modules for multiple roles (merge)
   */
  async getUserAssignedModulesForRoles(
    roleIds: number[],
    companyId: number,
    projectId?: number
  ): Promise<ConfigModule[]> {
    const pid = projectId ?? HRMS_PROJECT_ID;
    const enabledModuleIds = new Set<number>();

    for (const roleId of roleIds) {
      const permissions = await this.getRoleModulePermissions(roleId, companyId, projectId);
      for (const p of permissions) {
        if (p.company_id === companyId && p.project_id === pid && p.is_enabled) {
          enabledModuleIds.add(p.module_id);
        }
      }
    }

    if (enabledModuleIds.size === 0) return [];

    const allModules = await this.getModules(projectId);
    return allModules.filter((m) => enabledModuleIds.has(m.id));
  }
}

export const configModulesService = new ConfigModulesService();
