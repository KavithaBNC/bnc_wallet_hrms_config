import { AppError } from '../middlewares/errorHandler';
import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';

export class ShiftAssignmentRuleService {
  async create(data: {
    organizationId: string;
    displayName: string;
    shiftId: string;
    paygroupId?: string;
    departmentId?: string;
    effectiveDate: string; // YYYY-MM-DD
    priority?: number;
    remarks?: string;
    employeeIds?: string[];
  }) {
    const organization = await prisma.organization.findUnique({
      where: { id: data.organizationId },
    });
    if (!organization) throw new AppError('Organization not found', 404);

    const shift = await prisma.shift.findUnique({
      where: { id: data.shiftId },
    });
    if (!shift || shift.organizationId !== data.organizationId) {
      throw new AppError('Shift not found', 404);
    }

    if (data.paygroupId) {
      const pg = await prisma.paygroup.findUnique({
        where: { id: data.paygroupId },
      });
      if (!pg || pg.organizationId !== data.organizationId) {
        throw new AppError('Paygroup not found', 404);
      }
    }
    if (data.departmentId) {
      const dept = await prisma.department.findUnique({
        where: { id: data.departmentId },
      });
      if (!dept || dept.organizationId !== data.organizationId) {
        throw new AppError('Department not found', 404);
      }
    }

    const rule = await prisma.shiftAssignmentRule.create({
      data: {
        organizationId: data.organizationId,
        displayName: data.displayName,
        shiftId: data.shiftId,
        paygroupId: data.paygroupId || null,
        departmentId: data.departmentId || null,
        effectiveDate: new Date(data.effectiveDate),
        priority: data.priority ?? null,
        remarks: data.remarks || null,
        employeeIds: (data.employeeIds ?? []) as unknown as Prisma.JsonArray,
      },
      include: {
        shift: { select: { id: true, name: true, code: true } },
        paygroup: { select: { id: true, name: true, code: true } },
        department: { select: { id: true, name: true, code: true } },
      },
    });
    return rule;
  }

  async getAll(query: {
    organizationId?: string;
    page?: string;
    limit?: string;
    search?: string;
    remarksMarker?: string; // Filter by specific marker in remarks (e.g., '__POLICY_RULES__', '__WEEK_OFF_DATA__', etc.)
  }) {
    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '20');
    const skip = (page - 1) * limit;
    const where: Prisma.ShiftAssignmentRuleWhereInput = {};
    if (query.organizationId) where.organizationId = query.organizationId;
    if (query.search?.trim()) {
      where.OR = [
        { displayName: { contains: query.search.trim(), mode: 'insensitive' } },
      ];
    }
    // Filter by remarks marker to identify sub-module type
    if (query.remarksMarker) {
      where.remarks = { contains: query.remarksMarker };
    }
    const [rules, total] = await Promise.all([
      prisma.shiftAssignmentRule.findMany({
        where,
        skip,
        take: limit,
        orderBy: { effectiveDate: 'desc' },
        include: {
          shift: { select: { id: true, name: true, code: true } },
          paygroup: { select: { id: true, name: true, code: true } },
          department: { select: { id: true, name: true, code: true } },
        },
      }),
      prisma.shiftAssignmentRule.count({ where }),
    ]);
    return {
      rules,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(id: string) {
    const rule = await prisma.shiftAssignmentRule.findUnique({
      where: { id },
      include: {
        shift: { select: { id: true, name: true, code: true } },
        paygroup: { select: { id: true, name: true, code: true } },
        department: { select: { id: true, name: true, code: true } },
      },
    });
    if (!rule) throw new AppError('Shift assignment rule not found', 404);
    return rule;
  }

  async update(
    id: string,
    data: Partial<{
      displayName: string;
      shiftId: string;
      paygroupId: string;
      departmentId: string;
      effectiveDate: string;
      priority: number;
      remarks: string;
      employeeIds: string[];
    }>
  ) {
    const existing = await prisma.shiftAssignmentRule.findUnique({
      where: { id },
    });
    if (!existing) throw new AppError('Shift assignment rule not found', 404);

    if (data.shiftId) {
      const shift = await prisma.shift.findUnique({
        where: { id: data.shiftId },
      });
      if (!shift || shift.organizationId !== existing.organizationId) {
        throw new AppError('Shift not found', 404);
      }
    }

    const rule = await prisma.shiftAssignmentRule.update({
      where: { id },
      data: {
        ...(data.displayName !== undefined && { displayName: data.displayName }),
        ...(data.shiftId !== undefined && { shiftId: data.shiftId }),
        ...(data.paygroupId !== undefined && { paygroupId: data.paygroupId || null }),
        ...(data.departmentId !== undefined && { departmentId: data.departmentId || null }),
        ...(data.effectiveDate !== undefined && { effectiveDate: new Date(data.effectiveDate) }),
        ...(data.priority !== undefined && { priority: data.priority }),
        ...(data.remarks !== undefined && { remarks: data.remarks }),
        ...(data.employeeIds !== undefined && { employeeIds: data.employeeIds as unknown as Prisma.JsonArray }),
      },
      include: {
        shift: { select: { id: true, name: true, code: true } },
        paygroup: { select: { id: true, name: true, code: true } },
        department: { select: { id: true, name: true, code: true } },
      },
    });
    return rule;
  }

  async delete(id: string) {
    const existing = await prisma.shiftAssignmentRule.findUnique({
      where: { id },
    });
    if (!existing) throw new AppError('Shift assignment rule not found', 404);
    await prisma.shiftAssignmentRule.delete({ where: { id } });
    return { message: 'Shift assignment rule deleted successfully' };
  }

  /**
   * Get applicable attendance policy rules for a shift, employee, and date
   * This finds the most specific rule matching:
   * - shiftId
   * - effectiveDate (on or before the attendance date)
   * - employeeId (if specified in rule), paygroup, department, or organization-wide
   * Returns parsed policy rules JSON or null if no rule found
   */
  async getApplicablePolicyRules(
    shiftId: string,
    employeeId: string,
    attendanceDate: Date,
    organizationId: string
  ): Promise<Record<string, any> | null> {
    // Get employee info to match paygroup/department
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        paygroupId: true,
        departmentId: true,
      },
    });

    if (!employee) {
      return null;
    }

    const dateStart = new Date(attendanceDate);
    dateStart.setHours(0, 0, 0, 0);

    // Find all rules for this shift that are effective on or before the attendance date
    const rules = await prisma.shiftAssignmentRule.findMany({
      where: {
        organizationId,
        shiftId,
        effectiveDate: {
          lte: dateStart,
        },
      },
      orderBy: [
        { priority: 'desc' }, // Higher priority first
        { effectiveDate: 'desc' }, // More recent first
      ],
      include: {
        shift: { select: { id: true, name: true } },
        paygroup: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
      },
    });

    if (rules.length === 0) {
      return null;
    }

    // Find the most specific matching rule
    // Priority order: employee-specific > paygroup+department > paygroup only > department only > organization-wide
    let matchedRule = null;

    for (const rule of rules) {
      const employeeIds = Array.isArray(rule.employeeIds) ? (rule.employeeIds as string[]) : [];
      
      // Check employee-specific match
      if (employeeIds.length > 0 && employeeIds.includes(employeeId)) {
        matchedRule = rule;
        break;
      }

      // Check paygroup + department match
      if (rule.paygroupId && rule.departmentId) {
        if (rule.paygroupId === employee.paygroupId && rule.departmentId === employee.departmentId) {
          matchedRule = rule;
          break;
        }
      }
      // Check paygroup only match
      else if (rule.paygroupId && !rule.departmentId) {
        if (rule.paygroupId === employee.paygroupId) {
          matchedRule = rule;
          break;
        }
      }
      // Check department only match
      else if (!rule.paygroupId && rule.departmentId) {
        if (rule.departmentId === employee.departmentId) {
          matchedRule = rule;
          break;
        }
      }
      // Organization-wide (no paygroup, no department)
      else if (!rule.paygroupId && !rule.departmentId) {
        matchedRule = rule;
        break;
      }
    }

    if (!matchedRule || !matchedRule.remarks) {
      return null;
    }

    // Parse policy rules from remarks
    const POLICY_MARKER = '__POLICY_RULES__';
    const markerIdx = matchedRule.remarks.indexOf(POLICY_MARKER);
    
    if (markerIdx === -1) {
      return null;
    }

    const jsonStr = matchedRule.remarks.slice(markerIdx + POLICY_MARKER.length);
    try {
      return JSON.parse(jsonStr) as Record<string, any>;
    } catch {
      return null;
    }
  }
}

export const shiftAssignmentRuleService = new ShiftAssignmentRuleService();
