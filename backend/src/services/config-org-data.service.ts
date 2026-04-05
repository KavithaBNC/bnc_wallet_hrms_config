/**
 * Config Org Data Service — Direct Config DB access (replaces RAG API org data calls)
 * Replaces: POST /api/v1/departments/list, POST /api/v1/departments/,
 *           POST /api/v1/sub-departments/list, POST /api/v1/sub-departments/,
 *           GET /api/v1/cost-centres/, POST /api/v1/cost-centres/
 */

import { configPrisma } from '../utils/config-prisma';
import { AppError } from '../middlewares/errorHandler';

class ConfigOrgDataService {
  // ─── DEPARTMENTS ───────────────────────────────────────────

  /**
   * Get departments from Config DB
   * Replaces: POST /api/v1/departments/list
   */
  async getDepartments(companyId: number): Promise<any[]> {
    try {
      const departments = await configPrisma.departments.findMany({
        where: { company_id: companyId, is_active: true },
        include: {
          cost_centres: { select: { id: true, name: true, code: true } },
        },
        orderBy: { name: 'asc' },
      });
      return departments.map((d) => ({
        id: d.id,
        company_id: d.company_id,
        name: d.name,
        code: d.code,
        description: d.description,
        cost_centre_id: d.cost_centre_id,
        cost_centre_name: d.cost_centre_name || d.cost_centres?.name || null,
        branch_id: d.branch_id,
        manager_id: d.manager_id,
        location: d.location,
        is_active: d.is_active,
        created_at: d.created_at,
        updated_at: d.updated_at,
      }));
    } catch (err) {
      console.error('[configOrgDataService.getDepartments] Error:', err);
      return [];
    }
  }

  /**
   * Create department in Config DB
   * Replaces: POST /api/v1/departments/
   */
  async createDepartment(data: {
    name: string;
    company_id: number;
    code?: string;
    cost_centre_id?: number;
    cost_centre_name?: string;
    branch_id?: number;
    manager_id?: number;
    description?: string;
    location?: string;
    is_active?: boolean;
  }): Promise<{ id: number; name: string; company_id: number | null }> {
    try {
      const dept = await configPrisma.departments.create({
        data: {
          company_id: data.company_id,
          name: data.name,
          code: data.code ?? '',
          cost_centre_id: data.cost_centre_id ?? null,
          cost_centre_name: data.cost_centre_name ?? null,
          branch_id: data.branch_id ?? null,
          manager_id: data.manager_id ?? null,
          description: data.description ?? null,
          location: data.location ?? null,
          is_active: data.is_active ?? true,
        },
      });
      console.log('[configOrgDataService.createDepartment] OK — id:', dept.id);
      return { id: dept.id, name: dept.name, company_id: dept.company_id };
    } catch (err: any) {
      console.error('[configOrgDataService.createDepartment] FAILED:', err.message);
      throw new AppError(err.message || 'Failed to create department in Config DB', 500);
    }
  }

  // ─── SUB-DEPARTMENTS ──────────────────────────────────────

  /**
   * Get sub-departments from Config DB
   * Replaces: POST /api/v1/sub-departments/list
   */
  async getSubDepartments(companyId: number, departmentId?: number): Promise<any[]> {
    try {
      const where: any = { company_id: companyId, is_active: true };
      if (departmentId) where.department_id = departmentId;

      const subDepts = await configPrisma.sub_departments.findMany({
        where,
        include: {
          departments: { select: { id: true, name: true, code: true } },
        },
        orderBy: { name: 'asc' },
      });
      return subDepts.map((sd) => ({
        id: sd.id,
        company_id: sd.company_id,
        department_id: sd.department_id,
        name: sd.name,
        code: sd.code,
        costcenter_id: sd.costcenter_id,
        is_active: sd.is_active,
        department: sd.departments ? { id: sd.departments.id, name: sd.departments.name, code: sd.departments.code } : null,
        created_at: sd.created_at,
        updated_at: sd.updated_at,
      }));
    } catch (err) {
      console.error('[configOrgDataService.getSubDepartments] Error:', err);
      return [];
    }
  }

  /**
   * Create sub-department in Config DB
   * Replaces: POST /api/v1/sub-departments/
   */
  async createSubDepartment(data: {
    name: string;
    company_id: number;
    department_id?: number;
    code?: string;
    costcenter_id?: string;
    is_active?: boolean;
  }): Promise<{ id: number; name: string; company_id: number | null }> {
    try {
      const subDept = await configPrisma.sub_departments.create({
        data: {
          company_id: data.company_id,
          name: data.name,
          department_id: data.department_id ?? null,
          code: data.code ?? '',
          costcenter_id: data.costcenter_id ?? null,
          is_active: data.is_active ?? true,
        },
      });
      console.log('[configOrgDataService.createSubDepartment] OK — id:', subDept.id);
      return { id: subDept.id, name: subDept.name, company_id: subDept.company_id };
    } catch (err: any) {
      console.error('[configOrgDataService.createSubDepartment] FAILED:', err.message);
      throw new AppError(err.message || 'Failed to create sub-department in Config DB', 500);
    }
  }

  // ─── COST CENTRES ─────────────────────────────────────────

  /**
   * Get cost centres from Config DB
   * Replaces: GET /api/v1/cost-centres/?company_id=X
   */
  async getCostCentres(companyId: number): Promise<any[]> {
    try {
      const costCentres = await configPrisma.cost_centres.findMany({
        where: { company_id: companyId, is_active: true },
        orderBy: { name: 'asc' },
      });
      return costCentres.map((cc) => ({
        id: cc.id,
        company_id: cc.company_id,
        name: cc.name,
        code: cc.code,
        description: cc.description,
        is_active: cc.is_active,
        created_at: cc.created_at,
        updated_at: cc.updated_at,
      }));
    } catch (err) {
      console.error('[configOrgDataService.getCostCentres] Error:', err);
      return [];
    }
  }

  /**
   * Create cost centre in Config DB
   * Replaces: POST /api/v1/cost-centres/
   */
  async createCostCentre(data: {
    name: string;
    code: string;
    company_id: number;
    description?: string;
  }): Promise<{ id: number; name: string; code: string | null }> {
    try {
      const cc = await configPrisma.cost_centres.create({
        data: {
          company_id: data.company_id,
          name: data.name,
          code: data.code,
          description: data.description ?? null,
          is_active: true,
        },
      });
      console.log('[configOrgDataService.createCostCentre] OK — id:', cc.id);
      return { id: cc.id, name: cc.name, code: cc.code };
    } catch (err: any) {
      console.error('[configOrgDataService.createCostCentre] FAILED:', err.message);
      throw new AppError(err.message || 'Failed to create cost centre in Config DB', 500);
    }
  }
}

export const configOrgDataService = new ConfigOrgDataService();
