import { AppError } from '../middlewares/errorHandler';
import { prisma } from '../utils/prisma';
import { CreateEntityInput } from '../utils/entity.validation';

export class EntityService {
  async getByOrganization(organizationId: string) {
    return prisma.entity.findMany({
      where: { organizationId, isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true },
    });
  }

  async create(data: CreateEntityInput) {
    const existing = await prisma.entity.findFirst({
      where: {
        organizationId: data.organizationId,
        name: { equals: data.name.trim(), mode: 'insensitive' },
      },
    });
    if (existing) {
      throw new AppError('An entity with this name already exists in the organization', 400);
    }

    return prisma.entity.create({
      data: {
        organizationId: data.organizationId,
        name: data.name.trim(),
        code: data.code?.trim() || null,
      },
      select: { id: true, name: true, code: true, organizationId: true },
    });
  }
}
export const entityService = new EntityService();
