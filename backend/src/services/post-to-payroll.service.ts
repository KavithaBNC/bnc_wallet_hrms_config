import { AppError } from '../middlewares/errorHandler';
import { prisma } from '../utils/prisma';
import { getPredefinedEarnings, getPredefinedDeductions } from '../utils/salary-components';

/** Column keys from MonthlyAttendanceSummary - NOT from Attendance Components */
export const ATTENDANCE_COLUMN_OPTIONS = [
  { key: 'overtimeHours', label: 'Post To Payroll.Over Time', format: 'HH:MM' },
  { key: 'lopDays', label: 'Post To Payroll.LOP Current Month', format: '0.00' },
  { key: 'holidayDays', label: 'Post To Payroll.NFH', format: '0.00' },
  { key: 'weekendDays', label: 'Post To Payroll.WO', format: '0.00' },
  { key: 'presentDays', label: 'Post To Payroll.Present Days', format: '0' },
  { key: 'absentDays', label: 'Post To Payroll.Absent Days', format: '0' },
  { key: 'halfDays', label: 'Post To Payroll.Half Days', format: '0' },
  { key: 'paidDays', label: 'Post To Payroll.Paid Days', format: '0.00' },
];

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

  /** Get available column options (from MonthlyAttendanceSummary fields) */
  getColumnOptions() {
    return ATTENDANCE_COLUMN_OPTIONS;
  }

  /** Get salary element names for Element Mapping dropdown - from org's Salary Structures + predefined */
  async getSalaryElementNames(organizationId: string): Promise<string[]> {
    const names = new Set<string>();
    // 1. Predefined earnings and deductions (OT, LOP, Basic, HRA, PF, etc.)
    const earnings = getPredefinedEarnings();
    const deductions = getPredefinedDeductions();
    Object.values(earnings).forEach((c) => names.add(c.name));
    Object.values(deductions).forEach((c) => names.add(c.name));
    // 2. Custom components from org's Salary Structures
    const structures = await prisma.salaryStructure.findMany({
      where: { organizationId },
      select: { components: true },
    });
    for (const s of structures) {
      const comps = (s.components as { name?: string }[]) ?? [];
      for (const c of comps) {
        if (c?.name?.trim()) names.add(c.name.trim());
      }
    }
    return Array.from(names).sort();
  }

  // ============================================================================
  // HR Activities: Preview, Post, Unpost, Export
  // ============================================================================

  /** Get preview list: employees + MonthlyAttendanceSummary for month, columns from mappings */
  async getPreview(
    organizationId: string,
    year: number,
    month: number,
    associateFilter?: string,
    showAll: boolean = true
  ) {
    const mappings = await prisma.postToPayrollMapping.findMany({
      where: { organizationId, ...(showAll ? {} : { showInList: true }) },
      orderBy: { orderIndex: 'asc' },
    });

    const where: {
      organizationId: string;
      year: number;
      month: number;
      employee?: { OR: Array<{ employeeCode?: { contains: string; mode: 'insensitive' }; firstName?: { contains: string; mode: 'insensitive' }; lastName?: { contains: string; mode: 'insensitive' } }> };
    } = { organizationId, year, month };

    if (associateFilter?.trim()) {
      const q = associateFilter.trim();
      where.employee = {
        OR: [
          { employeeCode: { contains: q, mode: 'insensitive' } },
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
        ],
      };
    }

    const summaries = await prisma.monthlyAttendanceSummary.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { employee: { employeeCode: 'asc' } },
    });

    const colKeyToField: Record<string, string> = {
      overtimeHours: 'overtimeHours',
      lopDays: 'lopDays',
      holidayDays: 'holidayDays',
      weekendDays: 'weekendDays',
      presentDays: 'presentDays',
      absentDays: 'absentDays',
      halfDays: 'halfDays',
      paidDays: 'paidDays',
    };

    const formatValue = (val: unknown, format: string): string => {
      if (val === null || val === undefined) return '';
      const n = Number(val);
      if (format === 'HH:MM') {
        const h = Math.floor(n);
        const m = Math.round((n - h) * 60);
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      }
      if (format === '0') return String(Math.round(n));
      return n.toFixed(2);
    };

    const rows = summaries.map((s) => {
      const rec: Record<string, unknown> = {
        employeeId: s.employeeId,
        employeeCode: s.employee.employeeCode,
        employeeName: `${s.employee.firstName || ''} ${s.employee.lastName || ''}`.trim(),
      };
      for (const m of mappings) {
        const field = colKeyToField[m.columnKey];
        const raw = field ? (s as any)[field] : null;
        rec[m.columnKey] = formatValue(raw, m.format);
      }
      return rec;
    });

    return { rows, mappings };
  }

  /** Post month: create DRAFT PayrollCycle for the month. Month must be locked. */
  async postMonth(organizationId: string, year: number, month: number, postedBy?: string) {
    const lock = await prisma.monthlyAttendanceLock.findUnique({
      where: { organizationId_year_month: { organizationId, year, month } },
    });
    if (!lock) {
      throw new AppError('Month must be locked before posting to payroll', 400);
    }

    const existing = await prisma.payrollCycle.findUnique({
      where: {
        organizationId_payrollMonth_payrollYear: {
          organizationId,
          payrollMonth: month,
          payrollYear: year,
        },
      },
    });
    if (existing) {
      if (existing.status !== 'DRAFT') {
        throw new AppError(`Payroll cycle for ${month}/${year} already exists and is ${existing.status}`, 400);
      }
      return existing;
    }

    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0);
    const paymentDate = new Date(year, month, 5);

    const cycle = await prisma.payrollCycle.create({
      data: {
        organizationId,
        name: `Payroll ${month}/${year}`,
        periodStart,
        periodEnd,
        paymentDate,
        payrollMonth: month,
        payrollYear: year,
        status: 'DRAFT',
        notes: `Posted from HR Activities by ${postedBy || 'system'}`,
      } as any,
    });
    return cycle;
  }

  /** Unpost month: delete DRAFT PayrollCycle for the month */
  async unpostMonth(organizationId: string, year: number, month: number) {
    const cycle = await prisma.payrollCycle.findUnique({
      where: {
        organizationId_payrollMonth_payrollYear: {
          organizationId,
          payrollMonth: month,
          payrollYear: year,
        },
      },
    });
    if (!cycle) {
      throw new AppError(`No payroll cycle found for ${month}/${year}`, 404);
    }
    if (cycle.status !== 'DRAFT') {
      throw new AppError(`Cannot delete payroll cycle in ${cycle.status} status`, 400);
    }
    await prisma.payrollCycle.delete({ where: { id: cycle.id } });
    return { deleted: true, id: cycle.id };
  }

  /** Check if month is posted (has payroll cycle) */
  async getPostStatus(organizationId: string, year: number, month: number) {
    const cycle = await prisma.payrollCycle.findUnique({
      where: {
        organizationId_payrollMonth_payrollYear: {
          organizationId,
          payrollMonth: month,
          payrollYear: year,
        },
      },
    });
    return {
      posted: !!cycle,
      status: cycle?.status ?? null,
      cycleId: cycle?.id ?? null,
    };
  }
}
