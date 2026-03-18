import { prisma } from './prisma';

export const EVENT_RULE_MARKER = '__EVENT_RULE_DATA__';

export type EventRuleData = {
  allowBeforeEntryDate?: boolean;
  combineMultipleDaysExcessTimeToCompOff?: boolean;
  considerExtraHours?: boolean;
  considerExtraHoursAsCompOff?: boolean;
  fullDayRequirementInWorkDay?: number;
  halfDayRequirementInWorkDay?: number;
};

type ShiftLike = {
  startTime?: string | null;
  endTime?: string | null;
};

export function extractEventRuleData(remarks: string | null | undefined): EventRuleData | null {
  if (!remarks) return null;
  const markerIdx = remarks.indexOf(EVENT_RULE_MARKER);
  if (markerIdx === -1) return null;
  try {
    return JSON.parse(remarks.slice(markerIdx + EVENT_RULE_MARKER.length)) as EventRuleData;
  } catch {
    return null;
  }
}

export function isExcessTimeConversionEnabled(ruleData: EventRuleData | null | undefined): boolean {
  if (!ruleData) return true;
  return ruleData.considerExtraHours !== false && ruleData.considerExtraHoursAsCompOff !== false;
}

export function computeExcessStayMinutesByShift(checkIn: Date, checkOut: Date, shift: ShiftLike): number {
  if (!shift.startTime || !shift.endTime) return 0;

  const [startH, startM] = String(shift.startTime).trim().split(':').map((x) => parseInt(x || '0', 10));
  const [endH, endM] = String(shift.endTime).trim().split(':').map((x) => parseInt(x || '0', 10));
  if (Number.isNaN(startH) || Number.isNaN(startM) || Number.isNaN(endH) || Number.isNaN(endM)) return 0;

  const shiftStart = new Date(checkIn.getFullYear(), checkIn.getMonth(), checkIn.getDate(), startH, startM, 0, 0);
  const shiftEnd = new Date(checkIn.getFullYear(), checkIn.getMonth(), checkIn.getDate(), endH, endM, 0, 0);
  if (shiftEnd <= shiftStart) shiftEnd.setDate(shiftEnd.getDate() + 1);

  const earlyComingMins =
    checkIn < shiftStart ? Math.round((shiftStart.getTime() - checkIn.getTime()) / (1000 * 60)) : 0;
  const lateLeavingMins =
    checkOut > shiftEnd ? Math.round((checkOut.getTime() - shiftEnd.getTime()) / (1000 * 60)) : 0;

  return Math.max(0, earlyComingMins + lateLeavingMins);
}

export async function getApplicableExcessTimeRule(
  employeeId: string,
  organizationId: string,
  asOfDate: Date
): Promise<{ ruleData: EventRuleData | null; effectiveDate: Date | null }> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, organizationId: true, paygroupId: true, departmentId: true },
  });
  if (!employee || employee.organizationId !== organizationId) return { ruleData: null, effectiveDate: null };

  const rules = await prisma.shiftAssignmentRule.findMany({
    where: {
      organizationId,
      effectiveDate: { lte: asOfDate },
      remarks: { contains: EVENT_RULE_MARKER },
    },
    orderBy: [{ priority: 'desc' }, { effectiveDate: 'desc' }],
  });

  const matchingRule = rules.find((rule) => {
    const employeeIds = Array.isArray(rule.employeeIds) ? (rule.employeeIds as string[]) : [];
    if (employeeIds.length > 0) return employeeIds.includes(employeeId);
    if (rule.paygroupId && rule.departmentId) {
      return rule.paygroupId === employee.paygroupId && rule.departmentId === employee.departmentId;
    }
    if (rule.paygroupId && !rule.departmentId) return rule.paygroupId === employee.paygroupId;
    if (!rule.paygroupId && rule.departmentId) return rule.departmentId === employee.departmentId;
    return true;
  });

  return {
    ruleData: extractEventRuleData(matchingRule?.remarks),
    effectiveDate: matchingRule?.effectiveDate ?? null,
  };
}
