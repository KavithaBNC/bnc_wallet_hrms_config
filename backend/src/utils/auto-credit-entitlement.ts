import { prisma } from './prisma';
import { getAttendanceComponentForLeaveType } from './event-config';

export function readEntitlementDays(rule: unknown): number | null {
  if (!rule || typeof rule !== 'object') return null;
  const r = rule as Record<string, unknown>;
  const keys = ['entitlementDays', 'EntitlementDays', 'entitlement_days', 'entitlementdays'];
  for (const k of keys) {
    const v = r[k];
    const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return null;
}

export function isAutoCreditApplicableToEmployee(
  s: { paygroupId: string | null; departmentId: string | null; associate: string | null },
  employee: { paygroupId: string | null; departmentId: string | null; employeeCode: string; id: string }
): boolean {
  if (s.paygroupId && s.paygroupId !== employee.paygroupId) return false;
  if (s.departmentId && s.departmentId !== employee.departmentId) return false;
  if (s.associate) {
    const a = s.associate.trim();
    if (a && a !== employee.employeeCode && a !== employee.id) return false;
  }
  return true;
}

export type EmployeeForEntitlement = {
  id: string;
  organizationId: string;
  paygroupId: string | null;
  departmentId: string | null;
  employeeCode: string;
  dateOfJoining?: Date | null;
};

export type LeaveTypeForEntitlement = {
  id: string;
  name: string;
  code: string | null;
  defaultDaysPerYear: unknown;
};

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function normalizeRuleText(value: unknown): string {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function computeProratedEntitlementForYear(
  baseEntitlement: number,
  rule: unknown,
  employeeDateOfJoining: Date | null | undefined,
  year: number
): number {
  if (!employeeDateOfJoining) return baseEntitlement;
  const doj = new Date(employeeDateOfJoining);
  if (Number.isNaN(doj.getTime())) return baseEntitlement;

  const daysCalculation = normalizeRuleText((rule as Record<string, unknown> | null)?.daysCalculation);
  const effectiveFrom = normalizeRuleText((rule as Record<string, unknown> | null)?.effectiveFrom);

  const isProrataDateBasis = daysCalculation.includes('prorataondatebasis');
  const isProrataMonthBasis = daysCalculation.includes('prorataonmonthbasis');
  if (!isProrataDateBasis && !isProrataMonthBasis) return baseEntitlement;

  const joinYear = doj.getUTCFullYear();
  if (joinYear > year) return 0;
  if (joinYear < year) return baseEntitlement;

  const yearStart = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
  const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
  const dayMs = 24 * 60 * 60 * 1000;

  if (isProrataDateBasis) {
    // Date-of-joining based prorata: credit only for remaining days in joining year.
    let periodStart = yearStart;
    if (effectiveFrom.includes('dateofjoining')) {
      periodStart = new Date(Date.UTC(joinYear, doj.getUTCMonth(), doj.getUTCDate(), 0, 0, 0, 0));
    }
    if (periodStart > yearEnd) return 0;
    const remainingDays = Math.floor((yearEnd.getTime() - periodStart.getTime()) / dayMs) + 1;
    const totalDays = isLeapYear(year) ? 366 : 365;
    return Number(((baseEntitlement * remainingDays) / totalDays).toFixed(4));
  }

  // Month-basis prorata: credit by remaining months in joining year.
  const remainingMonths = 12 - doj.getUTCMonth();
  return Number(((baseEntitlement * remainingMonths) / 12).toFixed(4));
}

export function readEntitlementDaysForEmployeeYear(
  rule: unknown,
  employeeDateOfJoining: Date | null | undefined,
  year: number
): number | null {
  const base = readEntitlementDays(rule);
  if (base == null) return null;
  return computeProratedEntitlementForYear(base, rule, employeeDateOfJoining, year);
}

/**
 * Get entitlement days for an employee + leave type from Auto Credit settings.
 * Only settings that match the employee's department and paygroup are applied.
 * Auto credit is applied only when the event config has Allow Auto Credit Rule = true.
 * @returns { entitlement, hasAutoCreditInOrg } - use defaultDaysPerYear only when !hasAutoCreditInOrg
 */
export async function getEntitlementForEmployeeAndLeaveType(
  organizationId: string,
  employee: EmployeeForEntitlement,
  leaveType: LeaveTypeForEntitlement & { id: string },
  year: number
): Promise<{ entitlement: number; hasAutoCreditInOrg: boolean }> {
  const defaultDays =
    leaveType.defaultDaysPerYear != null ? Number(leaveType.defaultDaysPerYear) : 0;

  const component = await getAttendanceComponentForLeaveType(organizationId, leaveType);
  if (component && !component.allowAutoCreditRule) {
    return { entitlement: defaultDays, hasAutoCreditInOrg: false };
  }

  const autoCreditSettings = await prisma.autoCreditSetting.findMany({
    where: {
      organizationId,
      effectiveDate: { lte: new Date(year, 11, 31) },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date(year, 0, 1) } }],
    },
    select: {
      eventType: true,
      displayName: true,
      paygroupId: true,
      departmentId: true,
      associate: true,
      autoCreditRule: true,
    },
  });

  const nameKey = leaveType.name.toLowerCase().trim();
  const codeKey = leaveType.code ? leaveType.code.trim().toUpperCase() : '';
  let hasAutoCreditInOrg = false;
  for (const s of autoCreditSettings) {
    const matchByName = s.eventType && s.eventType.toLowerCase().trim() === nameKey;
    const matchByCode = s.displayName && s.displayName.trim().toUpperCase() === codeKey;
    if (matchByName || matchByCode) {
      hasAutoCreditInOrg = true;
      break;
    }
  }

  const applicableSettings = autoCreditSettings.filter((s) =>
    isAutoCreditApplicableToEmployee(s, employee)
  );

  for (const s of applicableSettings) {
    const n = readEntitlementDaysForEmployeeYear(
      s.autoCreditRule,
      employee.dateOfJoining,
      year
    );
    if (n == null) continue;
    const matchByName = s.eventType && s.eventType.toLowerCase().trim() === nameKey;
    const matchByCode = s.displayName && s.displayName.trim().toUpperCase() === codeKey;
    if (matchByName || matchByCode) {
      return { entitlement: n, hasAutoCreditInOrg: true };
    }
  }

  return {
    entitlement: hasAutoCreditInOrg ? 0 : defaultDays,
    hasAutoCreditInOrg,
  };
}
