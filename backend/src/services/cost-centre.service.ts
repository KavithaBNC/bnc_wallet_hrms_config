import { prisma } from '../utils/prisma';

export class CostCentreService {
  async getByOrganization(organizationId: string) {
    return prisma.costCentre.findMany({
      where: { organizationId, isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true },
    });
  }
}
export const costCentreService = new CostCentreService();
