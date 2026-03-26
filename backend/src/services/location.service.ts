import { AppError } from '../middlewares/errorHandler';
import { prisma } from '../utils/prisma';
import { CreateLocationInput } from '../utils/location.validation';

export class LocationService {
  async getByOrganization(organizationId: string, search?: string) {
    const where: any = { organizationId, isActive: true };
    const searchTerm = (search || '').trim();
    if (searchTerm) {
      where.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { code: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }
    return prisma.location.findMany({
      where,
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true, entityId: true },
    });
  }

  async getByEntity(entityId: string, search?: string) {
    const where: any = { entityId, isActive: true };
    const searchTerm = (search || '').trim();
    if (searchTerm) {
      where.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { code: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }
    return prisma.location.findMany({
      where,
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true, entityId: true },
    });
  }

  async create(data: CreateLocationInput) {
    const entity = await prisma.entity.findUnique({
      where: { id: data.entityId },
      select: { id: true, organizationId: true },
    });
    if (!entity) {
      throw new AppError('Entity not found', 404);
    }
    if (entity.organizationId !== data.organizationId) {
      throw new AppError('Entity does not belong to this organization', 400);
    }

    const existing = await prisma.location.findFirst({
      where: {
        entityId: data.entityId,
        name: { equals: data.name.trim(), mode: 'insensitive' },
      },
    });
    if (existing) {
      throw new AppError('A location with this name already exists for this entity', 400);
    }

    return prisma.location.create({
      data: {
        organizationId: data.organizationId,
        entityId: data.entityId,
        name: data.name.trim(),
        code: data.code?.trim() || null,
      },
      select: { id: true, name: true, code: true, entityId: true },
    });
  }
}
export const locationService = new LocationService();
