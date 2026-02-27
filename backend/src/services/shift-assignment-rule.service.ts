import { AppError } from '../middlewares/errorHandler';
import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';

export class ShiftAssignmentRuleService {
  async create(data: {
    organizationId: string;
    displayName: string;
    shiftId?: string;
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

    if (!data.shiftId) {
      throw new AppError('Shift is required', 400);
    }

    if (data.shiftId) {
      const shift = await prisma.shift.findUnique({
        where: { id: data.shiftId },
      });
      if (!shift || shift.organizationId !== data.organizationId) {
        throw new AppError('Shift not found', 404);
      }
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
        paygroupId: data.paygroupId || undefined,
        departmentId: data.departmentId || undefined,
        effectiveDate: new Date(data.effectiveDate),
        priority: data.priority ?? undefined,
        remarks: data.remarks || undefined,
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

  /** Markers used by attendance policy sub-modules - exclude these for "pure" Shift Assign list */
  static readonly ATTENDANCE_POLICY_MARKERS = [
    '__HOLIDAY_DATA__',
    '__EVENT_RULE_DATA__',
    '__OT_USAGE_RULE_DATA__',
    '__WEEK_OFF_DATA__',
    '__POLICY_RULES__',
  ];

  async getAll(query: {
    organizationId?: string;
    page?: string;
    limit?: string;
    search?: string;
    remarksMarker?: string; // Filter by specific marker in remarks (e.g., '__POLICY_RULES__', '__WEEK_OFF_DATA__', etc.)
    excludeAttendancePolicyRules?: string; // 'true' to exclude rules from attendance policy sub-modules (Holiday, Comp Off, OT, Week Off, Late & Others)
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
    // Exclude attendance policy rules (Shift Assign list shows only "pure" shift assignments)
    if (query.excludeAttendancePolicyRules === 'true') {
      const markers = ShiftAssignmentRuleService.ATTENDANCE_POLICY_MARKERS;
      where.AND = [
        ...(where.AND as Prisma.ShiftAssignmentRuleWhereInput[] || []),
        ...markers.map((m) => ({
          OR: [{ remarks: null }, { remarks: { not: { contains: m } } }],
        })),
      ];
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
      paygroupId: string | null;
      departmentId: string | null;
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
        ...(data.paygroupId !== undefined && { paygroupId: data.paygroupId || undefined }),
        ...(data.departmentId !== undefined && { departmentId: data.departmentId || undefined }),
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
   * Get applicable attendance policy rules for a shift, employee, and date.
   * Fetches rules by: employee-specific, department, paygroup, or global (All).
   * If multiple rules apply, returns the one with the highest priority.
   */
  async getApplicablePolicyRules(
    shiftId: string | null,
    employeeId: string,
    attendanceDate: Date,
    organizationId: string
  ): Promise<Record<string, any> | null> {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { paygroupId: true, departmentId: true },
    });
    if (!employee) return null;

    const dateStart = new Date(attendanceDate);
    dateStart.setHours(0, 0, 0, 0);

    const rules = await prisma.shiftAssignmentRule.findMany({
      where: {
        organizationId,
        ...(shiftId ? { shiftId } : {}),
        effectiveDate: { lte: dateStart },
        remarks: { contains: '__POLICY_RULES__' },
      },
      orderBy: [
        { priority: 'desc' },
        { effectiveDate: 'desc' },
      ],
      include: {
        shift: { select: { id: true, name: true } },
        paygroup: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
      },
    });

    if (rules.length === 0) return null;

    // Collect all rules that match this employee (any scope: employee / dept / paygroup / global)
    const matchingRules = rules.filter((rule) => {
      const employeeIds = Array.isArray(rule.employeeIds) ? (rule.employeeIds as string[]) : [];
      if (employeeIds.length > 0 && employeeIds.includes(employeeId)) return true;
      if (rule.paygroupId && rule.departmentId) {
        return rule.paygroupId === employee.paygroupId && rule.departmentId === employee.departmentId;
      }
      if (rule.paygroupId && !rule.departmentId) return rule.paygroupId === employee.paygroupId;
      if (!rule.paygroupId && rule.departmentId) return rule.departmentId === employee.departmentId;
      return true; // org-wide
    });

    const matchedRule = matchingRules[0] ?? null;
    if (!matchedRule?.remarks) return null;

    const POLICY_MARKER = '__POLICY_RULES__';
    const markerIdx = matchedRule.remarks.indexOf(POLICY_MARKER);
    if (markerIdx === -1) return null;

    try {
      return JSON.parse(matchedRule.remarks.slice(markerIdx + POLICY_MARKER.length)) as Record<string, any>;
    } catch {
      return null;
    }
  }

  /**
   * Get applicable holiday for an employee on a date from Holiday Assign rules (ShiftAssignmentRule with __HOLIDAY_DATA__).
   * Returns the holiday name if the date is in a holiday rule that applies to this employee (by employee / paygroup / department).
   * Used by calendar so holidays show on employee calendar.
   * @param dateStr - Calendar date as YYYY-MM-DD (use this for comparison to avoid timezone shifting; e.g. 16th stays 16th)
   */
  async getApplicableHolidayForEmployee(
    employeeId: string,
    dateStr: string,
    organizationId: string
  ): Promise<{ name: string } | null> {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { paygroupId: true, departmentId: true },
    });
    if (!employee) return null;

    const normDateStr = dateStr.slice(0, 10); // YYYY-MM-DD

    // For holiday rules we do NOT filter by effectiveDate <= date because
    // the rule is created on (or after) the holiday dates it contains.
    // Instead we check each holiday's own date field inside the JSON.
    const rules = await prisma.shiftAssignmentRule.findMany({
      where: {
        organizationId,
        remarks: { contains: '__HOLIDAY_DATA__' },
      },
      orderBy: [
        { priority: 'desc' },
        { effectiveDate: 'desc' },
      ],
    });

    for (const rule of rules) {
      const employeeIds = Array.isArray(rule.employeeIds) ? (rule.employeeIds as string[]) : [];
      let matches = false;
      if (employeeIds.length > 0) {
        matches = employeeIds.includes(employeeId);
      } else if (rule.paygroupId && rule.departmentId) {
        matches = rule.paygroupId === employee.paygroupId && rule.departmentId === employee.departmentId;
      } else if (rule.paygroupId && !rule.departmentId) {
        matches = rule.paygroupId === employee.paygroupId;
      } else if (!rule.paygroupId && rule.departmentId) {
        matches = rule.departmentId === employee.departmentId;
      } else {
        matches = true; // org-wide
      }
      if (!matches || !rule.remarks) continue;

      const markerIdx = rule.remarks.indexOf('__HOLIDAY_DATA__');
      if (markerIdx === -1) continue;
      try {
        const jsonStr = rule.remarks.slice(markerIdx + '__HOLIDAY_DATA__'.length);
        const parsed = JSON.parse(jsonStr) as { holidayDetails?: Array<{ date?: string; name?: string; type?: string }> };
        const details = parsed?.holidayDetails;
        if (!details || !Array.isArray(details)) continue;
        const found = details.find((h) => {
          const d = h.date;
          if (!d) return false;
          const norm = d.slice(0, 10); // YYYY-MM-DD
          return norm === normDateStr;
        });
        if (found?.name) {
          return { name: found.name };
        }
      } catch {
        // ignore parse error
      }
    }
    return null;
  }

  /**
   * Get applicable week off for an employee on a date from Week Off Assign rules.
   * Returns a synthetic "Week Off" shift when the date is a week-off day per rule (employee / paygroup / department).
   * Used by calendar so week off days are displayed.
   */
  async getApplicableWeekOffForEmployee(
    employeeId: string,
    date: Date,
    organizationId: string
  ): Promise<{ id: string; name: string; startTime: string; endTime: string } | null> {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { paygroupId: true, departmentId: true },
    });
    if (!employee) return null;

    const dateStart = new Date(date);
    dateStart.setHours(0, 0, 0, 0);

    const rules = await prisma.shiftAssignmentRule.findMany({
      where: {
        organizationId,
        effectiveDate: { lte: dateStart },
        remarks: { contains: '__WEEK_OFF_DATA__' },
      },
      orderBy: [
        { priority: 'desc' },
        { effectiveDate: 'desc' },
      ],
    });

    for (const rule of rules) {
      const employeeIds = Array.isArray(rule.employeeIds) ? (rule.employeeIds as string[]) : [];
      let matches = false;
      if (employeeIds.length > 0) {
        matches = employeeIds.includes(employeeId);
      } else if (rule.paygroupId && rule.departmentId) {
        matches = rule.paygroupId === employee.paygroupId && rule.departmentId === employee.departmentId;
      } else if (rule.paygroupId && !rule.departmentId) {
        matches = rule.paygroupId === employee.paygroupId;
      } else if (!rule.paygroupId && rule.departmentId) {
        matches = rule.departmentId === employee.departmentId;
      } else {
        matches = true; // org-wide
      }
      if (!matches || !rule.remarks) continue;

      const markerIdx = rule.remarks.indexOf('__WEEK_OFF_DATA__');
      if (markerIdx === -1) continue;
      try {
        const jsonStr = rule.remarks.slice(markerIdx + '__WEEK_OFF_DATA__'.length);
        const parsed = JSON.parse(jsonStr) as { weekOffDetails?: boolean[][]; alternateSaturdayOff?: string };
        let weekOffDetails = parsed?.weekOffDetails;
        if (!weekOffDetails || !Array.isArray(weekOffDetails)) continue;
        // If rule is "1st & 3rd" or "2nd & 4th" Saturday off, treat Sunday (day 0) as not week off
        // so only the selected Saturdays show as Week Off (fixes old data where Sunday was default true)
        const altSat = (parsed?.alternateSaturdayOff || '').toUpperCase();
        if ((altSat.includes('1ST') && altSat.includes('3RD')) || (altSat.includes('2ND') && altSat.includes('4TH'))) {
          weekOffDetails = weekOffDetails.map((week) => {
            const row = [...week];
            if (row[0] !== undefined) row[0] = false; // Sunday = not week off
            return row;
          });
        }
        // Week of month: 1-7 -> 0, 8-14 -> 1, ... (0-5)
        const dayOfMonth = dateStart.getDate();
        const weekIndex = Math.min(5, Math.max(0, Math.ceil(dayOfMonth / 7) - 1));
        const dayIndex = dateStart.getDay(); // 0=Sun, 6=Sat
        if (weekOffDetails[weekIndex]?.[dayIndex]) {
          return {
            id: 'week-off',
            name: 'Week Off',
            startTime: '00:00',
            endTime: '00:00',
          };
        }
      } catch {
        // ignore parse error
      }
    }
    return null;
  }

  /**
   * Get applicable shift for an employee on a date from Shift Assign rules (department / paygroup / associate).
   * Used by calendar so shift assigned at any level is reflected.
   * Excludes rules that are attendance-policy-only (Holiday, Week Off, OT, etc.).
   */
  async getApplicableShiftForEmployee(
    employeeId: string,
    date: Date,
    organizationId: string
  ): Promise<{ id: string; name: string; startTime: string; endTime: string } | null> {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { paygroupId: true, departmentId: true },
    });
    if (!employee) return null;

    const dateStart = new Date(date);
    dateStart.setHours(0, 0, 0, 0);

    const markers = ShiftAssignmentRuleService.ATTENDANCE_POLICY_MARKERS;
    const rules = await prisma.shiftAssignmentRule.findMany({
      where: {
        organizationId,
        effectiveDate: { lte: dateStart },
        OR: [
          { remarks: null },
          ...markers.map((m) => ({ remarks: { not: { contains: m } } })),
        ],
      },
      orderBy: [
        { priority: 'desc' },
        { effectiveDate: 'desc' },
      ],
      include: {
        shift: { select: { id: true, name: true, startTime: true, endTime: true } },
      },
    });

    for (const rule of rules) {
      if (!rule.shift) continue; // skip policy-only rules with no shift
      const employeeIds = Array.isArray(rule.employeeIds) ? (rule.employeeIds as string[]) : [];
      if (employeeIds.length > 0) {
        // Associate-specific rules are strict: if employeeIds is provided and employee
        // is not listed, do not fallback to paygroup/department for the same rule.
        if (employeeIds.includes(employeeId)) {
          return rule.shift;
        }
        continue;
      }
      if (rule.paygroupId && rule.departmentId) {
        if (rule.paygroupId === employee.paygroupId && rule.departmentId === employee.departmentId) {
          return rule.shift;
        }
      } else if (rule.paygroupId && !rule.departmentId) {
        if (rule.paygroupId === employee.paygroupId) {
          return rule.shift;
        }
      } else if (!rule.paygroupId && rule.departmentId) {
        if (rule.departmentId === employee.departmentId) {
          return rule.shift;
        }
      } else if (!rule.paygroupId && !rule.departmentId) {
        return rule.shift;
      }
    }
    return null;
  }
}

export const shiftAssignmentRuleService = new ShiftAssignmentRuleService();
