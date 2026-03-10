import { prisma } from '../utils/prisma';

/**
 * Audit Log Service
 *
 * Centralized audit logging for all critical operations.
 * All log operations are wrapped in try/catch — audit failures
 * MUST NEVER break the business logic flow.
 *
 * Entity types: PAYSLIP, PAYROLL_CYCLE, FNF_SETTLEMENT, EMPLOYEE_SALARY, EMPLOYEE_LOAN
 * Actions: CREATE, UPDATE, DELETE, LOCK, UNLOCK, APPROVE, DISBURSE, REJECT, PAID
 */
export class AuditLogService {
  /**
   * Log an action on a business entity.
   * Silently fails to avoid disrupting the caller's transaction.
   */
  async log(params: {
    organizationId: string;
    entityType: string;
    entityId: string;
    action: string;
    previousValue?: Record<string, unknown> | null;
    newValue?: Record<string, unknown> | null;
    changedBy?: string | null;
    ipAddress?: string | null;
    remarks?: string | null;
  }): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          organizationId: params.organizationId,
          entityType: params.entityType,
          entityId: params.entityId,
          action: params.action,
          previousValue: params.previousValue as any ?? null,
          newValue: params.newValue as any ?? null,
          changedBy: params.changedBy ?? null,
          ipAddress: params.ipAddress ?? null,
          remarks: params.remarks ?? null,
        },
      });
    } catch (err) {
      // Audit failures must never break business logic
      console.error('[AuditLog] Failed to write audit log:', err);
    }
  }

  /**
   * Retrieve audit history for a specific entity
   */
  async getHistory(params: {
    organizationId: string;
    entityType: string;
    entityId: string;
    page?: number;
    limit?: number;
  }) {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: {
          organizationId: params.organizationId,
          entityType: params.entityType,
          entityId: params.entityId,
        },
        orderBy: { changedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({
        where: {
          organizationId: params.organizationId,
          entityType: params.entityType,
          entityId: params.entityId,
        },
      }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Retrieve all audit logs for an organization (admin use)
   */
  async getOrganizationAuditTrail(params: {
    organizationId: string;
    entityType?: string;
    action?: string;
    changedBy?: string;
    fromDate?: Date;
    toDate?: Date;
    page?: number;
    limit?: number;
  }) {
    const page = params.page ?? 1;
    const limit = params.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: any = { organizationId: params.organizationId };
    if (params.entityType) where.entityType = params.entityType;
    if (params.action) where.action = params.action;
    if (params.changedBy) where.changedBy = params.changedBy;
    if (params.fromDate || params.toDate) {
      where.changedAt = {};
      if (params.fromDate) where.changedAt.gte = params.fromDate;
      if (params.toDate) where.changedAt.lte = params.toDate;
    }

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { changedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}

export const auditLogService = new AuditLogService();
