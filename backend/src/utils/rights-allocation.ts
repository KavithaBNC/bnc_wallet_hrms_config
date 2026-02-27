import { prisma } from './prisma';
import { resolveWorkflowForEmployeeOrNull } from '../services/workflow-resolution.service';
import { shiftAssignmentRuleService } from '../services/shift-assignment-rule.service';

type AttendanceAction = 'view' | 'add' | 'cancel' | 'delete';
type ExcessTimeAction = 'add';

type AttendanceEventPermission = {
  id?: string;
  name?: string;
  applicable?: boolean;
  view?: boolean;
  add?: boolean;
  cancel?: boolean;
  delete?: boolean;
};

type EventMatchContext = {
  eventId?: string | null;
  eventName?: string | null;
  shortName?: string | null;
  leaveTypeName?: string | null;
  leaveTypeCode?: string | null;
};

export type ResolvedRightsAllocationContext = {
  rights: ResolvedRightsAllocation | null;
  hasEntryRightsTemplate: boolean;
  template: string | null;
  shiftMatched: boolean;
};

export type ResolvedRightsAllocation = {
  id: string;
  shortName: string;
  longName: string;
  shiftId: string | null;
  attendanceEvents: unknown;
  excessTimeEvents: unknown;
};

const normalize = (value: string | null | undefined) =>
  (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

function toAttendanceEvents(value: unknown): AttendanceEventPermission[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v) => v && typeof v === 'object')
    .map((v) => v as AttendanceEventPermission);
}

function findAttendanceEvent(
  events: AttendanceEventPermission[],
  ctx: EventMatchContext
): AttendanceEventPermission | null {
  if (ctx.eventId) {
    const byId = events.find((e) => String(e.id || '') === String(ctx.eventId));
    if (byId) return byId;
  }

  const keys = [
    normalize(ctx.eventName),
    normalize(ctx.shortName),
    normalize(ctx.leaveTypeName),
    normalize(ctx.leaveTypeCode),
  ].filter(Boolean);
  if (!keys.length) return null;

  return (
    events.find((e) => {
      const eventKey = normalize(e.name);
      return eventKey ? keys.includes(eventKey) : false;
    }) || null
  );
}

export async function resolveRightsAllocationContextForEmployee(
  employeeId: string,
  organizationId: string,
  options?: { effectiveDate?: Date | null }
): Promise<ResolvedRightsAllocationContext> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { shiftId: true },
  });
  if (!employee) {
    return {
      rights: null,
      hasEntryRightsTemplate: false,
      template: null,
      shiftMatched: false,
    };
  }

  const workflow = await resolveWorkflowForEmployeeOrNull(employeeId, organizationId);
  const template = workflow?.entryRightsTemplate?.trim();
  if (!template) {
    return {
      rights: null,
      hasEntryRightsTemplate: false,
      template: null,
      shiftMatched: false,
    };
  }

  const where = isUuid(template)
    ? {
        organizationId,
        OR: [{ id: template }, { shortName: template }, { longName: template }],
      }
    : {
        organizationId,
        OR: [{ shortName: template }, { longName: template }],
      };

  const rights = await prisma.rightsAllocation.findFirst({
    where,
    select: {
      id: true,
      shortName: true,
      longName: true,
      shiftId: true,
      attendanceEvents: true,
      excessTimeEvents: true,
    },
  });

  if (!rights) {
    return {
      rights: null,
      hasEntryRightsTemplate: true,
      template,
      shiftMatched: false,
    };
  }

  // If a rights allocation is tied to a specific shift, apply it only when employee's
  // effective shift (master or shift-assignment-rule) matches.
  if (rights?.shiftId) {
    if (rights.shiftId === employee.shiftId) {
      return {
        rights,
        hasEntryRightsTemplate: true,
        template,
        shiftMatched: true,
      };
    }

    const effectiveDate = options?.effectiveDate ? new Date(options.effectiveDate) : new Date();
    if (Number.isNaN(effectiveDate.getTime())) {
      return {
        rights: null,
        hasEntryRightsTemplate: true,
        template,
        shiftMatched: false,
      };
    }
    const shiftFromRule = await shiftAssignmentRuleService.getApplicableShiftForEmployee(
      employeeId,
      effectiveDate,
      organizationId
    );
    if (!shiftFromRule || shiftFromRule.id !== rights.shiftId) {
      return {
        rights: null,
        hasEntryRightsTemplate: true,
        template,
        shiftMatched: false,
      };
    }
  }

  return {
    rights,
    hasEntryRightsTemplate: true,
    template,
    shiftMatched: true,
  };
}

export async function resolveRightsAllocationForEmployee(
  employeeId: string,
  organizationId: string,
  options?: { effectiveDate?: Date | null }
): Promise<ResolvedRightsAllocation | null> {
  const ctx = await resolveRightsAllocationContextForEmployee(employeeId, organizationId, options);
  return ctx.rights;
}

export function canPerformAttendanceEventAction(
  rights: ResolvedRightsAllocation | null,
  action: AttendanceAction,
  ctx: EventMatchContext
): boolean {
  if (!rights) return true;

  const events = toAttendanceEvents(rights.attendanceEvents);
  if (!events.length) return true;

  const matched = findAttendanceEvent(events, ctx);
  if (!matched) return true;

  if (matched.applicable === false) return false;
  const permission = matched[action];
  if (typeof permission === 'boolean') return permission;
  return true;
}

type ExcessTimeEventPermission = {
  id?: string;
  name?: string;
  applicable?: boolean;
  add?: boolean;
};

type ExcessTimeMatchContext = {
  eventId?: string | null;
  eventName?: string | null;
};

function toExcessTimeEvents(value: unknown): ExcessTimeEventPermission[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v) => v && typeof v === 'object')
    .map((v) => v as ExcessTimeEventPermission);
}

function findExcessTimeEvent(
  events: ExcessTimeEventPermission[],
  ctx: ExcessTimeMatchContext
): ExcessTimeEventPermission | null {
  if (ctx.eventId) {
    const byId = events.find((e) => String(e.id || '') === String(ctx.eventId));
    if (byId) return byId;
  }
  const eventNameKey = normalize(ctx.eventName);
  if (!eventNameKey) return null;
  return events.find((e) => normalize(e.name) === eventNameKey) || null;
}

export function canPerformExcessTimeEventAction(
  rights: ResolvedRightsAllocation | null,
  action: ExcessTimeAction,
  ctx: ExcessTimeMatchContext
): boolean {
  if (!rights) return true;
  const events = toExcessTimeEvents(rights.excessTimeEvents);
  if (!events.length) return true;

  const matched = findExcessTimeEvent(events, ctx);
  if (!matched) return true;

  if (matched.applicable === false) return false;
  const permission = matched[action];
  if (typeof permission === 'boolean') return permission;
  return true;
}

