import { AppError } from '../middlewares/errorHandler';
import { prisma } from '../utils/prisma';
import { configOrgDataService } from './config-org-data.service';

export class CostCentreService {
  /**
   * Get cost centres for dropdown. Direct Config DB access (no RAG API).
   */
  async getByOrganization(organizationId: string, _userId?: string) {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { configuratorCompanyId: true },
    });
    if (!org?.configuratorCompanyId) return [];
    // Direct Config DB query — no token needed
    const configList = await configOrgDataService.getCostCentres(org.configuratorCompanyId);
    return configList.map((c: any) => ({
      id: String(typeof c === 'object' ? c.id : c),
      name: typeof c === 'object' ? (c.name ?? c.Name ?? '') : String(c),
      code: typeof c === 'object' ? (c.code ?? c.Code ?? '') : '',
    })).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }

  /** Create cost centre in Config DB, optionally sync to HRMS */
  async create(
    data: { name: string; code: string; organizationId: string },
    _userId?: string
  ) {
    const { name, code, organizationId } = data;
    if (!name?.trim() || !code?.trim() || !organizationId) {
      throw new AppError('name, code, and organizationId are required', 400);
    }
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { configuratorCompanyId: true },
    });
    if (!org?.configuratorCompanyId) {
      throw new AppError('Organization not linked to Configurator. Set configurator_company_id.', 400);
    }
    // Direct Config DB access — no token needed
    const created = await configOrgDataService.createCostCentre({
      name: name.trim(),
      code: code.trim(),
      company_id: org.configuratorCompanyId,
    });
    const existing = await prisma.costCentre.findFirst({
      where: { organizationId, code: code.trim() },
    });
    const local = existing
      ? await prisma.costCentre.update({
          where: { id: existing.id },
          data: { name: name.trim(), configuratorCostCentreId: created.id },
        })
      : await prisma.costCentre.create({
          data: {
            organizationId,
            name: name.trim(),
            code: code.trim(),
            configuratorCostCentreId: created.id,
            isActive: true,
          },
        });
    return { ...local, id: created.id, name: created.name, code: created.code };
  }
}
export const costCentreService = new CostCentreService();
