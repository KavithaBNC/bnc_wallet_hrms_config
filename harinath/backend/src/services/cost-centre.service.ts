import { AppError } from '../middlewares/errorHandler';
import { prisma } from '../utils/prisma';
import { configuratorService } from './configurator.service';

export class CostCentreService {
  /**
   * Get cost centres for dropdown. ALWAYS calls Config API only (never HRMS).
   * Returns Config list directly. When org not linked or no token, returns [].
   */
  async getByOrganization(organizationId: string, userId?: string) {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { configuratorCompanyId: true },
    });
    if (!org?.configuratorCompanyId || !userId) return [];
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { configuratorAccessToken: true },
    });
    if (!user?.configuratorAccessToken) return [];
    const configList = await configuratorService.getCostCentres(
      user.configuratorAccessToken,
      org.configuratorCompanyId
    );
    return configList.map((c: any) => ({
      id: String(typeof c === 'object' ? c.id : c),
      name: typeof c === 'object' ? (c.name ?? c.Name ?? '') : String(c),
      code: typeof c === 'object' ? (c.code ?? c.Code ?? '') : '',
    })).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }

  /** Create cost centre in Config DB, optionally sync to HRMS */
  async create(
    data: { name: string; code: string; organizationId: string },
    userId?: string
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
    const user = userId
      ? await prisma.user.findUnique({
          where: { id: userId },
          select: { configuratorAccessToken: true },
        })
      : null;
    if (!user?.configuratorAccessToken) {
      throw new AppError('Configurator token not found. Please login again.', 401);
    }
    const created = await configuratorService.createCostCentre(user.configuratorAccessToken, {
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
