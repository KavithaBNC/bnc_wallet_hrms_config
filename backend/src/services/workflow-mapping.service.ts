import { AppError } from '../middlewares/errorHandler';
import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { parsePagination, parseString } from '../utils/queryParser';

const EMPLOYEE_APPROVAL_ERROR = 'Employee Approval is not allowed for Leave workflows. Employees must not approve their own leave.';

/** Legacy static id - reject if used */
const LEGACY_EMPLOYEE_APPROVAL_IDS = ['employee_approval'];

async function validateNoEmployeeApproval(
  approvalLevels: unknown,
  organizationId: string
): Promise<void> {
  if (!Array.isArray(approvalLevels) || approvalLevels.length === 0) return;

  for (const level of approvalLevels) {
    const approvalLevel = (level as { approvalLevel?: string })?.approvalLevel;
    if (!approvalLevel || typeof approvalLevel !== 'string') continue;

    const val = approvalLevel.trim().toLowerCase();
    if (LEGACY_EMPLOYEE_APPROVAL_IDS.includes(val)) {
      throw new AppError(EMPLOYEE_APPROVAL_ERROR, 400);
    }

    if (/^[0-9a-f-]{36}$/i.test(approvalLevel)) {
      const workflow = await prisma.approvalWorkflow.findFirst({
        where: { id: approvalLevel, organizationId },
        select: { workflowType: true, shortName: true },
      });
      if (workflow?.workflowType === 'Employee') {
        throw new AppError(EMPLOYEE_APPROVAL_ERROR, 400);
      }
    }
  }
}

export class WorkflowMappingService {
  /**
   * Create new workflow mapping
   */
  async create(data: {
    organizationId: string;
    displayName: string;
    associate?: string;
    associateIds?: string[] | null;
    paygroupId?: string;
    paygroupIds?: string[] | null;
    departmentId?: string;
    departmentIds?: string[] | null;
    priority?: number;
    remarks?: string;
    entryRightsTemplate?: string;
    approvalLevels?: any;
  }) {
    // Validate organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: data.organizationId },
    });

    if (!organization) {
      throw new AppError('Organization not found', 404);
    }

    // Validate paygroup if provided
    if (data.paygroupId) {
      const paygroup = await prisma.paygroup.findUnique({
        where: { id: data.paygroupId },
      });
      if (!paygroup || paygroup.organizationId !== data.organizationId) {
        throw new AppError('Paygroup not found', 404);
      }
    }

    // Validate department if provided
    if (data.departmentId) {
      const department = await prisma.department.findUnique({
        where: { id: data.departmentId },
      });
      if (!department || department.organizationId !== data.organizationId) {
        throw new AppError('Department not found', 404);
      }
    }

    const associateIdsArr = data.associateIds && data.associateIds.length > 0 ? data.associateIds.filter(Boolean) : null;
    const paygroupIdsArr = data.paygroupIds && data.paygroupIds.length > 0 ? data.paygroupIds.filter(Boolean) : null;
    const departmentIdsArr = data.departmentIds && data.departmentIds.length > 0 ? data.departmentIds.filter(Boolean) : null;

    if (associateIdsArr && associateIdsArr.length > 0) {
      const empCount = await prisma.employee.count({
        where: { id: { in: associateIdsArr }, organizationId: data.organizationId },
      });
      if (empCount !== associateIdsArr.length) {
        throw new AppError('One or more associates not found or do not belong to this organization', 400);
      }
    }
    if (paygroupIdsArr && paygroupIdsArr.length > 0) {
      const pgCount = await prisma.paygroup.count({
        where: { id: { in: paygroupIdsArr }, organizationId: data.organizationId },
      });
      if (pgCount !== paygroupIdsArr.length) {
        throw new AppError('One or more paygroups not found or do not belong to this organization', 400);
      }
    }
    if (departmentIdsArr && departmentIdsArr.length > 0) {
      const deptCount = await prisma.department.count({
        where: { id: { in: departmentIdsArr }, organizationId: data.organizationId },
      });
      if (deptCount !== departmentIdsArr.length) {
        throw new AppError('One or more departments not found or do not belong to this organization', 400);
      }
    }

    await validateNoEmployeeApproval(data.approvalLevels, data.organizationId);

    const workflowMapping = await prisma.workflowMapping.create({
      data: {
        organizationId: data.organizationId,
        displayName: data.displayName.trim(),
        associate: data.associate?.trim() || null,
        associateIds: associateIdsArr as Prisma.InputJsonValue | undefined,
        paygroupId: data.paygroupId || (paygroupIdsArr?.length === 1 ? paygroupIdsArr[0] : null),
        paygroupIds: paygroupIdsArr as Prisma.InputJsonValue | undefined,
        departmentId: data.departmentId || (departmentIdsArr?.length === 1 ? departmentIdsArr[0] : null),
        departmentIds: departmentIdsArr as Prisma.InputJsonValue | undefined,
        priority: data.priority ?? null,
        remarks: data.remarks?.trim() || null,
        entryRightsTemplate: data.entryRightsTemplate?.trim() || null,
        approvalLevels: data.approvalLevels
          ? (data.approvalLevels as unknown as Prisma.JsonArray)
          : Prisma.JsonNull,
      },
      include: {
        paygroup: {
          select: {
            id: true,
            name: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return workflowMapping;
  }

  /**
   * Get all workflow mappings with pagination
   */
  async getAll(query: {
    organizationId?: string;
    page?: string;
    limit?: string;
    search?: string;
    workflowType?: string;
  }) {
    const { page, limit } = parsePagination(query.page, query.limit);
    const skip = (page - 1) * limit;
    const search = parseString(query.search);

    const where: Prisma.WorkflowMappingWhereInput = {};

    if (query.organizationId) {
      where.organizationId = query.organizationId;
    }

    if (search) {
      where.OR = [
        { displayName: { contains: search, mode: 'insensitive' } },
        { associate: { contains: search, mode: 'insensitive' } },
        { remarks: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.workflowMapping.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          paygroup: {
            select: {
              id: true,
              name: true,
            },
          },
          department: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prisma.workflowMapping.count({ where }),
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
   * Get workflow mapping by ID
   */
  async getById(id: string) {
    const workflowMapping = await prisma.workflowMapping.findUnique({
      where: { id },
      include: {
        paygroup: {
          select: {
            id: true,
            name: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!workflowMapping) {
      throw new AppError('Workflow mapping not found', 404);
    }

    return workflowMapping;
  }

  /**
   * Update workflow mapping
   */
  async update(
    id: string,
    data: {
      displayName?: string;
      associate?: string;
      associateIds?: string[] | null;
      paygroupId?: string;
      paygroupIds?: string[] | null;
      departmentId?: string;
      departmentIds?: string[] | null;
      priority?: number;
      remarks?: string;
      entryRightsTemplate?: string;
      approvalLevels?: any;
    }
  ) {
    const existing = await prisma.workflowMapping.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppError('Workflow mapping not found', 404);
    }

    // Validate paygroup if provided
    if (data.paygroupId !== undefined) {
      if (data.paygroupId) {
        const paygroup = await prisma.paygroup.findUnique({
          where: { id: data.paygroupId },
        });
        if (!paygroup || paygroup.organizationId !== existing.organizationId) {
          throw new AppError('Paygroup not found', 404);
        }
      }
    }

    // Validate department if provided
    if (data.departmentId !== undefined) {
      if (data.departmentId) {
        const department = await prisma.department.findUnique({
          where: { id: data.departmentId },
        });
        if (!department || department.organizationId !== existing.organizationId) {
          throw new AppError('Department not found', 404);
        }
      }
    }

    const associateIdsArr = data.associateIds !== undefined
      ? (data.associateIds && data.associateIds.length > 0 ? data.associateIds.filter(Boolean) : null)
      : undefined;
    const paygroupIdsArr = data.paygroupIds !== undefined
      ? (data.paygroupIds && data.paygroupIds.length > 0 ? data.paygroupIds.filter(Boolean) : null)
      : undefined;
    const departmentIdsArr = data.departmentIds !== undefined
      ? (data.departmentIds && data.departmentIds.length > 0 ? data.departmentIds.filter(Boolean) : null)
      : undefined;

    if (associateIdsArr && associateIdsArr.length > 0) {
      const empCount = await prisma.employee.count({
        where: { id: { in: associateIdsArr }, organizationId: existing.organizationId },
      });
      if (empCount !== associateIdsArr.length) {
        throw new AppError('One or more associates not found or do not belong to this organization', 400);
      }
    }
    if (paygroupIdsArr && paygroupIdsArr.length > 0) {
      const pgCount = await prisma.paygroup.count({
        where: { id: { in: paygroupIdsArr }, organizationId: existing.organizationId },
      });
      if (pgCount !== paygroupIdsArr.length) {
        throw new AppError('One or more paygroups not found or do not belong to this organization', 400);
      }
    }
    if (departmentIdsArr && departmentIdsArr.length > 0) {
      const deptCount = await prisma.department.count({
        where: { id: { in: departmentIdsArr }, organizationId: existing.organizationId },
      });
      if (deptCount !== departmentIdsArr.length) {
        throw new AppError('One or more departments not found or do not belong to this organization', 400);
      }
    }

    const updateData: Prisma.WorkflowMappingUpdateInput = {};

    if (data.displayName !== undefined) {
      updateData.displayName = data.displayName.trim();
    }
    if (data.associate !== undefined) {
      updateData.associate = data.associate?.trim() || null;
    }
    if (associateIdsArr !== undefined) {
      updateData.associateIds = associateIdsArr as Prisma.InputJsonValue;
    }
    if (paygroupIdsArr !== undefined) {
      updateData.paygroupIds = paygroupIdsArr as Prisma.InputJsonValue;
      updateData.paygroup = paygroupIdsArr?.length === 1 ? { connect: { id: paygroupIdsArr[0] } } : { disconnect: true };
    } else if (data.paygroupId !== undefined) {
      if (data.paygroupId) {
        updateData.paygroup = { connect: { id: data.paygroupId } };
      } else {
        updateData.paygroup = { disconnect: true };
      }
    }
    if (departmentIdsArr !== undefined) {
      updateData.departmentIds = departmentIdsArr as Prisma.InputJsonValue;
      updateData.department = departmentIdsArr?.length === 1 ? { connect: { id: departmentIdsArr[0] } } : { disconnect: true };
    } else if (data.departmentId !== undefined) {
      if (data.departmentId) {
        updateData.department = { connect: { id: data.departmentId } };
      } else {
        updateData.department = { disconnect: true };
      }
    }
    if (data.priority !== undefined) {
      updateData.priority = data.priority ?? null;
    }
    if (data.remarks !== undefined) {
      updateData.remarks = data.remarks?.trim() || null;
    }
    if (data.entryRightsTemplate !== undefined) {
      updateData.entryRightsTemplate = data.entryRightsTemplate?.trim() || null;
    }
    if (data.approvalLevels !== undefined) {
      await validateNoEmployeeApproval(data.approvalLevels, existing.organizationId);
      updateData.approvalLevels = data.approvalLevels
        ? (data.approvalLevels as unknown as Prisma.JsonArray)
        : Prisma.JsonNull;
    }

    const workflowMapping = await prisma.workflowMapping.update({
      where: { id },
      data: updateData,
      include: {
        paygroup: {
          select: {
            id: true,
            name: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return workflowMapping;
  }

  /**
   * Delete workflow mapping
   */
  async delete(id: string) {
    const existing = await prisma.workflowMapping.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppError('Workflow mapping not found', 404);
    }

    await prisma.workflowMapping.delete({
      where: { id },
    });
  }
}
