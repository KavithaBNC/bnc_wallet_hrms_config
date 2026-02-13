import { AppError } from '../middlewares/errorHandler';
import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { parsePagination, parseString } from '../utils/queryParser';

const WORKFLOW_TYPES = ['Employee', 'Manager', 'HR', 'Org Admin', 'Super Admin'];

export class ApprovalWorkflowService {
  /**
   * Create new approval workflow
   */
  async create(data: {
    organizationId: string;
    workflowType: string;
    shortName: string;
    longName: string;
    remarks?: string;
    attendanceEvents?: any;
    excessTimeEvents?: any;
    requestTypeEvents?: any;
    validationGroupEvents?: any;
  }) {
    const organization = await prisma.organization.findUnique({
      where: { id: data.organizationId },
    });

    if (!organization) {
      throw new AppError('Organization not found', 404);
    }

    if (!WORKFLOW_TYPES.includes(data.workflowType)) {
      throw new AppError('Invalid workflow type. Must be one of: Employee, Manager, HR, Org Admin, Super Admin', 400);
    }

    const existing = await prisma.approvalWorkflow.findFirst({
      where: {
        organizationId: data.organizationId,
        workflowType: data.workflowType,
        shortName: data.shortName.trim(),
      },
    });

    if (existing) {
      throw new AppError('Short name already exists for this workflow type in this organization', 400);
    }

    const approvalWorkflow = await prisma.approvalWorkflow.create({
      data: {
        organizationId: data.organizationId,
        workflowType: data.workflowType,
        shortName: data.shortName.trim(),
        longName: data.longName.trim(),
        remarks: data.remarks?.trim() || null,
        attendanceEvents: data.attendanceEvents ? (data.attendanceEvents as unknown as Prisma.JsonArray) : Prisma.JsonNull,
        excessTimeEvents: data.excessTimeEvents ? (data.excessTimeEvents as unknown as Prisma.JsonArray) : Prisma.JsonNull,
        requestTypeEvents: data.requestTypeEvents ? (data.requestTypeEvents as unknown as Prisma.JsonArray) : Prisma.JsonNull,
        validationGroupEvents: data.validationGroupEvents ? (data.validationGroupEvents as unknown as Prisma.JsonArray) : Prisma.JsonNull,
      },
    });

    return approvalWorkflow;
  }

  /**
   * Get all approval workflows with pagination
   */
  async getAll(query: {
    organizationId?: string;
    workflowType?: string;
    page?: string;
    limit?: string;
    search?: string;
  }) {
    const { page, limit } = parsePagination(query.page, query.limit);
    const skip = (page - 1) * limit;
    const search = parseString(query.search);

    const where: Prisma.ApprovalWorkflowWhereInput = {};

    if (query.organizationId) {
      where.organizationId = query.organizationId;
    }

    if (query.workflowType) {
      where.workflowType = query.workflowType;
    }

    if (search) {
      where.OR = [
        { shortName: { contains: search, mode: 'insensitive' } },
        { longName: { contains: search, mode: 'insensitive' } },
        { remarks: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.approvalWorkflow.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.approvalWorkflow.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Get approval workflow by ID
   */
  async getById(id: string) {
    const approvalWorkflow = await prisma.approvalWorkflow.findUnique({
      where: { id },
    });

    if (!approvalWorkflow) {
      throw new AppError('Approval workflow not found', 404);
    }

    return approvalWorkflow;
  }

  /**
   * Update approval workflow
   */
  async update(
    id: string,
    data: {
      workflowType?: string;
      shortName?: string;
      longName?: string;
      remarks?: string;
      attendanceEvents?: any;
      excessTimeEvents?: any;
      requestTypeEvents?: any;
      validationGroupEvents?: any;
    }
  ) {
    const existing = await prisma.approvalWorkflow.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppError('Approval workflow not found', 404);
    }

    if (data.workflowType && !WORKFLOW_TYPES.includes(data.workflowType)) {
      throw new AppError('Invalid workflow type. Must be one of: Employee, Manager, HR, Org Admin, Super Admin', 400);
    }

    if (data.shortName && data.shortName.trim() !== existing.shortName) {
      const duplicate = await prisma.approvalWorkflow.findFirst({
        where: {
          organizationId: existing.organizationId,
          workflowType: data.workflowType || existing.workflowType,
          shortName: data.shortName.trim(),
          id: { not: id },
        },
      });

      if (duplicate) {
        throw new AppError('Short name already exists for this workflow type in this organization', 400);
      }
    }

    const updateData: Prisma.ApprovalWorkflowUpdateInput = {};

    if (data.workflowType !== undefined) updateData.workflowType = data.workflowType;
    if (data.shortName !== undefined) updateData.shortName = data.shortName.trim();
    if (data.longName !== undefined) updateData.longName = data.longName.trim();
    if (data.remarks !== undefined) updateData.remarks = data.remarks?.trim() || null;
    if (data.attendanceEvents !== undefined) {
      updateData.attendanceEvents = data.attendanceEvents
        ? (data.attendanceEvents as unknown as Prisma.JsonArray)
        : Prisma.JsonNull;
    }
    if (data.excessTimeEvents !== undefined) {
      updateData.excessTimeEvents = data.excessTimeEvents
        ? (data.excessTimeEvents as unknown as Prisma.JsonArray)
        : Prisma.JsonNull;
    }
    if (data.requestTypeEvents !== undefined) {
      updateData.requestTypeEvents = data.requestTypeEvents
        ? (data.requestTypeEvents as unknown as Prisma.JsonArray)
        : Prisma.JsonNull;
    }
    if (data.validationGroupEvents !== undefined) {
      updateData.validationGroupEvents = data.validationGroupEvents
        ? (data.validationGroupEvents as unknown as Prisma.JsonArray)
        : Prisma.JsonNull;
    }

    return prisma.approvalWorkflow.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Delete approval workflow
   */
  async delete(id: string) {
    const existing = await prisma.approvalWorkflow.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppError('Approval workflow not found', 404);
    }

    await prisma.approvalWorkflow.delete({
      where: { id },
    });
  }
}
