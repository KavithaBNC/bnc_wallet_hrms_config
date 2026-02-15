/**
 * Event configuration utilities.
 * Resolves AttendanceComponent (event config) for a LeaveType so that
 * configuration flags (hasBalance, allowAutoCreditRule, allowHourly, etc.)
 * can be enforced in leave balance, leave request, auto credit, and regularization.
 *
 * Linking: LeaveType is matched to AttendanceComponent by same organization and
 * (eventName ≈ leaveType.name) or (shortName ≈ leaveType.code).
 */

import { prisma } from './prisma';

export type AttendanceComponentFlags = {
  id: string;
  authorized: boolean;
  hasBalance: boolean;
  allowAutoCreditRule: boolean;
  allowHourly: boolean;
  allowDatewise: boolean;
  allowWeekOffSelection: boolean;
  allowHolidaySelection: boolean;
  applicableForRegularization: boolean;
};

type AttendanceComponentWithLabels = AttendanceComponentFlags & {
  eventName: string | null;
  shortName: string | null;
};

function toAttendanceComponentFlags(component: AttendanceComponentWithLabels): AttendanceComponentFlags {
  const { eventName, shortName, ...flags } = component;
  void eventName;
  void shortName;
  return flags;
}

/**
 * Find the AttendanceComponent that corresponds to a LeaveType in the same organization.
 * Match by: component.eventName ≈ leaveType.name (case-insensitive) or
 *          component.shortName ≈ leaveType.code (case-insensitive).
 * Returns null if no component is found (e.g. leave type not linked to an event config).
 */
export async function getAttendanceComponentForLeaveType(
  organizationId: string,
  leaveType: { id: string; name: string; code: string | null }
): Promise<AttendanceComponentFlags | null> {
  const nameKey = leaveType.name.toLowerCase().trim();
  const codeKey = leaveType.code ? leaveType.code.trim().toLowerCase() : '';

  const components = await prisma.attendanceComponent.findMany({
    where: {
      organizationId,
      eventCategory: 'Leave',
      OR: [
        { eventName: { equals: leaveType.name, mode: 'insensitive' as const } },
        ...(codeKey
          ? [{ shortName: { equals: leaveType.code!, mode: 'insensitive' as const } }]
          : []),
      ],
    },
    select: {
      id: true,
      eventName: true,
      shortName: true,
      authorized: true,
      hasBalance: true,
      allowAutoCreditRule: true,
      allowHourly: true,
      allowDatewise: true,
      allowWeekOffSelection: true,
      allowHolidaySelection: true,
      applicableForRegularization: true,
    },
  });

  // Prefer exact match by name, then by code (eventName/shortName used only for matching)
  const byName = components.find((c) => c.eventName?.toLowerCase().trim() === nameKey);
  if (byName) {
    return toAttendanceComponentFlags(byName as AttendanceComponentWithLabels);
  }
  if (codeKey) {
    const byCode = components.find((c) => c.shortName?.toLowerCase().trim() === codeKey);
    if (byCode) {
      return toAttendanceComponentFlags(byCode as AttendanceComponentWithLabels);
    }
  }
  if (components[0]) {
    return toAttendanceComponentFlags(components[0] as AttendanceComponentWithLabels);
  }
  return null;
}

/**
 * Get all LeaveType IDs in the organization that have allowAutoCreditRule = true
 * (so auto credit should run only for these).
 */
export async function getLeaveTypeIdsWithAutoCreditAllowed(
  organizationId: string
): Promise<Set<string>> {
  const [components, leaveTypes] = await Promise.all([
    prisma.attendanceComponent.findMany({
      where: { organizationId, eventCategory: 'Leave', allowAutoCreditRule: true },
      select: { eventName: true, shortName: true },
    }),
    prisma.leaveType.findMany({
      where: { organizationId, isActive: true },
      select: { id: true, name: true, code: true },
    }),
  ]);

  const ids = new Set<string>();
  for (const lt of leaveTypes) {
    const nameKey = lt.name.toLowerCase().trim();
    const codeKey = lt.code ? lt.code.trim().toLowerCase() : '';
    const matched = components.some(
      (c) =>
        c.eventName?.toLowerCase().trim() === nameKey ||
        (codeKey && c.shortName?.toLowerCase().trim() === codeKey)
    );
    if (matched) ids.add(lt.id);
  }
  return ids;
}

/**
 * Get all LeaveType IDs in the organization that have hasBalance = true
 * (system should maintain balance only for these).
 */
export async function getLeaveTypeIdsWithBalance(
  organizationId: string
): Promise<Set<string>> {
  const [components, leaveTypes] = await Promise.all([
    prisma.attendanceComponent.findMany({
      where: { organizationId, eventCategory: 'Leave', hasBalance: true },
      select: { eventName: true, shortName: true },
    }),
    prisma.leaveType.findMany({
      where: { organizationId, isActive: true },
      select: { id: true, name: true, code: true },
    }),
  ]);

  const ids = new Set<string>();
  for (const lt of leaveTypes) {
    const nameKey = lt.name.toLowerCase().trim();
    const codeKey = lt.code ? lt.code.trim().toLowerCase() : '';
    const matched = components.some(
      (c) =>
        c.eventName?.toLowerCase().trim() === nameKey ||
        (codeKey && c.shortName?.toLowerCase().trim() === codeKey)
    );
    if (matched) ids.add(lt.id);
  }
  return ids;
}

/**
 * Resolve leave type id for a single attendance component (Leave category).
 * Uses same rules as getAttendanceComponentForLeaveType: eventName ≈ leaveType.name
 * or shortName ≈ leaveType.code (case-insensitive). Returns null if no match.
 */
export async function getLeaveTypeIdForAttendanceComponent(
  organizationId: string,
  component: { eventName: string | null; shortName: string | null }
): Promise<string | null> {
  const eventNameKey = component.eventName?.toLowerCase().trim() ?? '';
  const shortNameKey = component.shortName?.toLowerCase().trim() ?? '';
  if (!eventNameKey && !shortNameKey) return null;

  const leaveTypes = await prisma.leaveType.findMany({
    where: { organizationId, isActive: true },
    select: { id: true, name: true, code: true },
  });

  const byName = leaveTypes.find((lt) => {
    const n = lt.name?.toLowerCase().trim() ?? '';
    const c = lt.code?.toLowerCase().trim() ?? '';
    return (eventNameKey && (n === eventNameKey || c === eventNameKey)) || (shortNameKey && (c === shortNameKey || n === shortNameKey));
  });
  return byName?.id ?? null;
}

/**
 * Return a map of attendance component id -> leave type id for all Leave-category
 * components in the organization. Used by Apply Event / leave application UI.
 */
export async function getLeaveComponentToLeaveTypeMapping(
  organizationId: string
): Promise<Record<string, string>> {
  const [components, leaveTypes] = await Promise.all([
    prisma.attendanceComponent.findMany({
      where: { organizationId, eventCategory: 'Leave' },
      select: { id: true, eventName: true, shortName: true },
    }),
    prisma.leaveType.findMany({
      where: { organizationId, isActive: true },
      select: { id: true, name: true, code: true },
    }),
  ]);

  const mapping: Record<string, string> = {};
  const nameKey = (s: string | null) => s?.toLowerCase().trim() ?? '';
  for (const c of components) {
    const en = nameKey(c.eventName);
    const sn = nameKey(c.shortName);
    const matched = leaveTypes.find(
      (lt) =>
        (en && (nameKey(lt.name) === en || nameKey(lt.code) === en)) ||
        (sn && (nameKey(lt.code) === sn || nameKey(lt.name) === sn))
    );
    if (matched) mapping[c.id] = matched.id;
  }
  return mapping;
}

/**
 * Get AttendanceComponent IDs (and flags) that are applicable for regularization.
 * Use when building regularization UI (e.g. dropdown of events) or when validating
 * that a chosen event can be used in regularization.
 */
export async function getComponentsApplicableForRegularization(organizationId: string) {
  return prisma.attendanceComponent.findMany({
    where: {
      organizationId,
      applicableForRegularization: true,
    },
    select: {
      id: true,
      shortName: true,
      eventName: true,
      eventCategory: true,
    },
    orderBy: [{ eventCategory: 'asc' }, { shortName: 'asc' }],
  });
}
