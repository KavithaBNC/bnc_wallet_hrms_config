import { prisma } from '../utils/prisma';
import { QueryPaygroupsInput, CreatePaygroupInput } from '../utils/paygroup.validation';
import { AppError } from '../middlewares/errorHandler';

export class PaygroupService {
  /**
   * Get all paygroups for an organization (for dropdown / searchable list)
   */
  async getAll(query: QueryPaygroupsInput) {
    const where: { organizationId: string; isActive?: boolean } = {
      organizationId: query.organizationId,
    };
    if (query.isActive === 'true') {
      where.isActive = true;
    }

    const paygroups = await prisma.paygroup.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        code: true,
        isActive: true,
      },
    });

    // Optional client-side search filter (or we could use Prisma contains)
    const search = (query.search || '').trim().toLowerCase();
    if (search) {
      return paygroups.filter(
        (p) =>
          p.name.toLowerCase().includes(search) ||
          (p.code && p.code.toLowerCase().includes(search))
      );
    }
    return paygroups;
  }

  async getById(id: string) {
    return prisma.paygroup.findUnique({
      where: { id },
      include: {
        organization: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Create new paygroup
   */
  async create(data: CreatePaygroupInput) {
    // Check if paygroup with same name already exists for this organization
    const existing = await prisma.paygroup.findFirst({
      where: {
        organizationId: data.organizationId,
        name: data.name,
      },
    });

    if (existing) {
      throw new AppError('Paygroup with this name already exists', 400);
    }

    const paygroup = await prisma.paygroup.create({
      data: {
        organizationId: data.organizationId,
        name: data.name,
        code: data.code || null,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        code: true,
        isActive: true,
      },
    });

    return paygroup;
  }
}

export const paygroupService = new PaygroupService();
