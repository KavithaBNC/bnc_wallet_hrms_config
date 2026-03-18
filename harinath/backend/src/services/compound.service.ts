import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';

export interface CompoundValueInput {
  value: string;
  sortOrder?: number;
}

export interface CreateCompoundInput {
  organizationId: string;
  componentType: string;
  shortName: string;
  longName: string;
  type: string;
  isDropDown?: boolean;
  isCompulsory?: boolean;
  isFilterable?: boolean;
  reimbDetails?: string;
  showInPayslip?: boolean;
  values?: CompoundValueInput[];
}

export interface UpdateCompoundInput {
  componentType?: string;
  shortName?: string;
  longName?: string;
  type?: string;
  isDropDown?: boolean;
  isCompulsory?: boolean;
  isFilterable?: boolean;
  reimbDetails?: string;
  showInPayslip?: boolean;
  values?: CompoundValueInput[];
}

export interface ListCompoundsParams {
  organizationId: string;
  page?: number;
  limit?: number;
  search?: string;
  componentType?: string;
  type?: string;
}

export class CompoundService {
  async create(data: CreateCompoundInput) {
    try {
      return await prisma.$transaction(async (tx) => {
        const compound = await tx.compound.create({
          data: {
            organizationId: data.organizationId,
            componentType: data.componentType,
            shortName: data.shortName.trim(),
            longName: data.longName.trim(),
            type: data.type,
            isDropDown: data.isDropDown ?? false,
            isCompulsory: data.isCompulsory ?? false,
            isFilterable: data.isFilterable ?? false,
            reimbDetails: data.reimbDetails?.trim() || null,
            showInPayslip: data.showInPayslip ?? false,
          },
        });
        if (data.isDropDown && data.values?.length) {
          await tx.compoundValue.createMany({
            data: data.values.map((v, i) => ({
              compoundId: compound.id,
              value: v.value.trim(),
              sortOrder: v.sortOrder ?? i,
            })),
          });
        }
        return tx.compound.findUniqueOrThrow({
          where: { id: compound.id },
          include: { values: { orderBy: { sortOrder: 'asc' } } },
        }) as Promise<typeof compound & { values: { id: string; value: string; sortOrder: number }[] }>;
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const err = new Error('Short Name must be unique within this organization.') as Error & { status?: number };
        err.status = 400;
        throw err;
      }
      throw e;
    }
  }

  async getAll(params: ListCompoundsParams) {
    const { organizationId, page = 1, limit = 10, search, componentType, type } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.CompoundWhereInput = { organizationId };

    if (search?.trim()) {
      const term = search.trim();
      where.OR = [
        { longName: { contains: term, mode: 'insensitive' } },
        { shortName: { contains: term, mode: 'insensitive' } },
      ];
    }
    if (componentType?.trim()) {
      where.componentType = { equals: componentType.trim(), mode: 'insensitive' };
    }
    if (type?.trim()) {
      where.type = { equals: type.trim(), mode: 'insensitive' };
    }

    const [rows, total] = await Promise.all([
      prisma.compound.findMany({
        where,
        orderBy: [{ longName: 'asc' }],
        skip,
        take: limit,
      }),
      prisma.compound.count({ where }),
    ]);

    return {
      compounds: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string) {
    return prisma.compound.findUniqueOrThrow({
      where: { id },
      include: { values: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  async update(id: string, data: UpdateCompoundInput) {
    try {
      return await prisma.$transaction(async (tx) => {
        await tx.compound.update({
          where: { id },
          data: {
            ...(data.componentType != null && { componentType: data.componentType }),
            ...(data.shortName !== undefined && { shortName: data.shortName.trim() }),
            ...(data.longName != null && { longName: data.longName.trim() }),
            ...(data.type != null && { type: data.type }),
            ...(data.isDropDown !== undefined && { isDropDown: data.isDropDown }),
            ...(data.isCompulsory !== undefined && { isCompulsory: data.isCompulsory }),
            ...(data.isFilterable !== undefined && { isFilterable: data.isFilterable }),
            ...(data.reimbDetails !== undefined && { reimbDetails: data.reimbDetails?.trim() || null }),
            ...(data.showInPayslip !== undefined && { showInPayslip: data.showInPayslip }),
          },
        });
        if (data.values !== undefined) {
          await tx.compoundValue.deleteMany({ where: { compoundId: id } });
          if (data.values.length > 0) {
            await tx.compoundValue.createMany({
              data: data.values.map((v, i) => ({
                compoundId: id,
                value: v.value.trim(),
                sortOrder: v.sortOrder ?? i,
              })),
            });
          }
        }
        return tx.compound.findUniqueOrThrow({
          where: { id },
          include: { values: { orderBy: { sortOrder: 'asc' } } },
        });
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const err = new Error('Short Name must be unique within this organization.') as Error & { status?: number };
        err.status = 400;
        throw err;
      }
      throw e;
    }
  }

  async delete(id: string) {
    return prisma.compound.delete({
      where: { id },
    });
  }
}

export const compoundService = new CompoundService();
