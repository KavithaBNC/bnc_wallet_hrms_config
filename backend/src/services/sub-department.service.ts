import { AppError } from '../middlewares/errorHandler';
import { prisma } from '../utils/prisma';
import { configOrgDataService } from './config-org-data.service';

export class SubDepartmentService {
  /**
   * Get sub-departments for dropdown. Direct Config DB access (no RAG API).
   * @param departmentId - optional Config department id to filter sub-departments
   */
  async getByOrganization(organizationId: string, _userId?: string, departmentId?: number) {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { configuratorCompanyId: true },
    });
    if (!org?.configuratorCompanyId) return [];
    // Direct Config DB query — no token needed
    const configList = await configOrgDataService.getSubDepartments(org.configuratorCompanyId, departmentId);
    return configList.map((s: any) => ({
      id: String(typeof s === 'object' ? s.id : s),
      name: typeof s === 'object' ? (s.name ?? s.Name ?? '') : String(s),
    })).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }

  async create(
    organizationId: string,
    name: string,
    _userId?: string,
    options?: { code?: string; departmentId?: number }
  ) {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new AppError('Sub-department name is required', 400);
    }
    const existing = await prisma.subDepartment.findFirst({
      where: {
        organizationId,
        name: { equals: trimmed, mode: 'insensitive' },
      },
    });
    if (existing) {
      throw new AppError('A sub-department with this name already exists', 409);
    }
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { configuratorCompanyId: true },
    });
    let configId: number | undefined;
    if (org?.configuratorCompanyId != null && options?.departmentId != null) {
      try {
        // Direct Config DB access — no token needed
        const created = await configOrgDataService.createSubDepartment({
          name: trimmed,
          code: options.code ?? trimmed.replace(/\s+/g, '_').toUpperCase(),
          department_id: options.departmentId,
          company_id: org.configuratorCompanyId,
        });
        configId = created.id;
      } catch (err: any) {
        console.warn('Config sub-department sync failed:', err?.message);
      }
    }
    return prisma.subDepartment.create({
      data: {
        organizationId,
        name: trimmed,
        configuratorSubDepartmentId: configId,
        isActive: true,
      },
      select: { id: true, name: true, configuratorSubDepartmentId: true },
    });
  }
}

export const subDepartmentService = new SubDepartmentService();
