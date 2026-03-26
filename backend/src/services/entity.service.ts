import { AppError } from '../middlewares/errorHandler';
import { prisma } from '../utils/prisma';
import { CreateEntityInput, UpdateEntityInput } from '../utils/entity.validation';

export class EntityService {
  async getByOrganization(organizationId: string, search?: string) {
    const where: any = { organizationId, isActive: true };
    const searchTerm = (search || '').trim();
    if (searchTerm) {
      where.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { code: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }
    return prisma.entity.findMany({
      where,
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true, isActive: true },
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
      select: { id: true, name: true, code: true, organizationId: true, isActive: true },
    });
  }

  async update(id: string, data: UpdateEntityInput) {
    const existing = await prisma.entity.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Entity not found', 404);
    }

    if (data.name && data.name.trim().toLowerCase() !== existing.name.toLowerCase()) {
      const duplicate = await prisma.entity.findFirst({
        where: {
          organizationId: existing.organizationId,
          name: { equals: data.name.trim(), mode: 'insensitive' },
          id: { not: id },
        },
      });
      if (duplicate) {
        throw new AppError('An entity with this name already exists in the organization', 400);
      }
    }

    return prisma.entity.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.code !== undefined ? { code: data.code?.trim() || null } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
      select: { id: true, name: true, code: true, organizationId: true, isActive: true },
    });
  }

  async softDelete(id: string) {
    const existing = await prisma.entity.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Entity not found', 404);
    }

    await prisma.entity.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: 'Entity deleted successfully' };
  }
}
export const entityService = new EntityService();
