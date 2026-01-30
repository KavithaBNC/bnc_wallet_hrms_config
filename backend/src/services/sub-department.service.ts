import { prisma } from '../utils/prisma';

export class SubDepartmentService {
  async getByOrganization(organizationId: string) {
    return prisma.subDepartment.findMany({
      where: { organizationId, isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
  }

  async create(organizationId: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('Sub-department name is required');
    }
    const existing = await prisma.subDepartment.findFirst({
      where: {
        organizationId,
        name: { equals: trimmed, mode: 'insensitive' },
      },
    });
    if (existing) {
      throw new Error('A sub-department with this name already exists');
    }
    return prisma.subDepartment.create({
      data: {
        organizationId,
        name: trimmed,
        isActive: true,
      },
      select: { id: true, name: true },
    });
  }
}

export const subDepartmentService = new SubDepartmentService();
