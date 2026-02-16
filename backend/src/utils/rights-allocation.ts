import { prisma } from './prisma';
import { resolveWorkflowForEmployeeOrNull } from '../services/workflow-resolution.service';

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

export type ResolvedRightsAllocation = {
  id: string;
  shortName: string;
  longName: string;
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

export async function resolveRightsAllocationForEmployee(
  employeeId: string,
  organizationId: string
): Promise<ResolvedRightsAllocation | null> {
  const workflow = await resolveWorkflowForEmployeeOrNull(employeeId, organizationId);
  const template = workflow?.entryRightsTemplate?.trim();
  if (!template) return null;

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
      attendanceEvents: true,
      excessTimeEvents: true,
    },
  });

  return rights;
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

