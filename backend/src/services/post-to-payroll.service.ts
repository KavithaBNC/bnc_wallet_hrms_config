import { AppError } from '../middlewares/errorHandler';
import { prisma } from '../utils/prisma';

export interface PostToPayrollMappingInput {
  columnKey: string;
  columnName: string;
  format: string;
  elementMapping?: string | null;
  orderIndex: number;
  showInList?: boolean;
}

export class PostToPayrollService {
  async getAll(organizationId: string, showAll?: boolean) {
    const where: { organizationId: string; showInList?: boolean } = { organizationId };
    if (showAll === false) {
      where.showInList = true;
    }
    const list = await prisma.postToPayrollMapping.findMany({
      where,
      orderBy: { orderIndex: 'asc' },
    });
    return list;
  }

  async saveAll(organizationId: string, rows: PostToPayrollMappingInput[]) {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org) {
      throw new AppError('Organization not found', 404);
    }
    await prisma.$transaction(async (tx) => {
      await tx.postToPayrollMapping.deleteMany({
        where: { organizationId },
      });
      if (rows.length > 0) {
        await tx.postToPayrollMapping.createMany({
          data: rows.map((r, i) => ({
            organizationId,
            columnKey: r.columnKey.trim(),
            columnName: r.columnName.trim(),
            format: r.format.trim() || '0.00',
            elementMapping: r.elementMapping?.trim() || null,
            orderIndex: r.orderIndex ?? i,
            showInList: r.showInList ?? true,
          })),
        });
      }
    });
    return this.getAll(organizationId);
  }
}
