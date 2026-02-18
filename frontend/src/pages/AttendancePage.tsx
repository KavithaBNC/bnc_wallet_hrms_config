import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { attendanceService, type CompOffSummary, type CompOffRequestItem } from '../services/attendance.service';
import employeeService, { type Employee } from '../services/employee.service';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';
import shiftService, { Shift } from '../services/shift.service';
import shiftAssignmentRuleService from '../services/shiftAssignmentRule.service';
import MonthlyDetailsSidebar from '../components/attendance/MonthlyDetailsSidebar';
import { startOfMonth, endOfMonth, eachDayOfInterval, format, isToday, getDay, addMonths } from 'date-fns';

interface AttendanceRecord {
  id: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
  breakHours?: number | null;
  workHours: number | null;
  overtimeHours: number | null;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeCode: string;
  };
  shift?: {
    id: string;
    name: string;
    startTime: string;
    endTime: string;
  } | null;
  isLate?: boolean | null;
  lateMinutes?: number | null;
  isEarly?: boolean | null;
  earlyMinutes?: number | null;
  isDeviation?: boolean | null;
  deviationReason?: string | null;
  otMinutes?: number | null;
  excessStayMinutes?: number | null;
}

interface AttendancePunch {
  id: string;
  employeeId: string;
  punchTime: string;
  status: string;
  punchSource?: string;
}

interface CalendarLeaveRequestItem {
  id: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | string;
  reason?: string | null;
  leaveType?: {
    id: string;
    name: string;
    code?: string | null;
  } | null;
}

/** Parse "[Permission HH:MM-HH:MM]" or "[Permission HH:MM - HH:MM]" from start of reason for calendar display. Shows timing even when leave type name is not "Permission" (e.g. 4–6 PM permission on 2nd). */
function parsePermissionTimingFromReason(reason: string | undefined | null, _leaveTypeName?: string | undefined): string | null {
  if (!reason?.trim()) return null;
  const match = reason.match(/^\[Permission\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\]/i);
  if (!match) return null;
  return `${match[1]} - ${match[2]}`;
}

function parseOndutyLabelFromReason(reason: string | undefined | null): string | null {
  if (!reason?.trim()) return null;
  const match = reason.match(/^\[Onduty(?:\s+([^\]]+))?\]/i);
  if (!match) return null;
  return (match[1] || '').trim() || 'Onduty';
}

function isOndutyOrWfhLeaveType(name: string | null | undefined): boolean {
  const key = (name || '').toLowerCase();
  return (
    key.includes('on duty') ||
    key.includes('onduty') ||
    key.includes('work from home') ||
    /\bwfh\b/.test(key)
  );
}

/** Get permission end time as Date on the given dateStr (yyyy-MM-dd) for display logic. Returns null if no approved permission with time. Matches reason pattern even when leave type name is not "Permission". */
function getPermissionEndTimeForDate(
  dateStr: string,
  leaveRequests: Array<{ status?: string; reason?: string | null; leaveType?: { name?: string } | null }>
): Date | null {
  const permissionReasonRegex = /^\[Permission\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\]/i;
  for (const lr of leaveRequests) {
    if ((lr.status || '').toUpperCase() !== 'APPROVED' || !lr.reason?.trim()) continue;
    const match = lr.reason.match(permissionReasonRegex);
    if (!match) continue;
    const endHHMM = match[2];
    const d = new Date(dateStr + 'T' + endHHMM + ':00');
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

/** Sum approved permission minutes for the day from reason pattern "[Permission HH:MM-HH:MM]". */
function getApprovedPermissionMinutesForDate(
  leaveRequests: Array<{ status?: string; reason?: string | null }>
): number {
  const permissionReasonRegex = /^\[Permission\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\]/i;
  let total = 0;
  for (const lr of leaveRequests) {
    if ((lr.status || '').toUpperCase() !== 'APPROVED' || !lr.reason?.trim()) continue;
    const match = lr.reason.match(permissionReasonRegex);
    if (!match) continue;
    const [startH, startM] = match[1].split(':').map(Number);
    const [endH, endM] = match[2].split(':').map(Number);
    const start = startH * 60 + startM;
    const end = endH * 60 + endM;
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      total += end - start;
    }
  }
  return total;
}

/** Convert decimal hours to 'HH:mm' (e.g. 0.2h → '00:12', 2.5h → '02:30'). */
function formatWorkHoursAsHHMM(decimalHours: number): string {
  const totalMinutes = Math.round(decimalHours * 60);
  const h = Math.floor(Math.abs(totalMinutes) / 60);
  const m = Math.abs(totalMinutes) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

type ShiftLike = { startTime?: string | null; endTime?: string | null; breakDuration?: number | null } | null;

/** Policy from Late & Others rule (__POLICY_RULES__) for applying grace and shortfall. */
type LateEarlyPolicy = {
  shiftStartGraceMinutes?: number | null;
  shiftEndGraceMinutes?: number | null;
  shiftStartGraceTime?: string | null;
  shiftEndGraceTime?: string | null;
  considerLateFromGraceTime?: boolean;
  considerEarlyGoingFromGraceTime?: boolean;
  considerLateAsShortfall?: boolean;
  considerEarlyGoingAsShortfall?: boolean;
  considerExcessBreakAsShortfall?: boolean;
  excessStayConsideredAsOT?: boolean;
  includingShiftBreak?: boolean;
  minBreakHoursAsDeviation?: string | null;
  minShortfallHoursAsDeviation?: string | null; // e.g. "00:10"
  minOTHoursPerDay?: string | null;
  otStartsAfterShiftEnd?: string | null;
} | null;

/** Parse "HH:MM" or "H:MM" to total minutes (e.g. "00:04" -> 4, "01:30" -> 90). */
function parseHHMMToMinutes(hhmm: string | null | undefined): number {
  if (!hhmm || typeof hhmm !== 'string') return 0;
  const parts = hhmm.trim().split(':');
  const h = parseInt(parts[0] || '0', 10);
  const m = parseInt(parts[1] || '0', 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

/** Resolve shift to use: record.shift or override (e.g. from Shift Master by name). */
function effectiveShift(record: AttendanceRecord, override: ShiftLike): ShiftLike {
  if (record.shift?.startTime != null || record.shift?.endTime != null) return record.shift;
  return override ?? record.shift ?? null;
}

/** Grace minutes for shift start from policy (minutes field overrides HH:MM). */
function getStartGraceMinutes(policy: LateEarlyPolicy): number {
  if (!policy) return 0;
  if (policy.shiftStartGraceMinutes != null) {
    const n = Number(policy.shiftStartGraceMinutes);
    return Number.isNaN(n) ? parseHHMMToMinutes(policy.shiftStartGraceTime) : n;
  }
  return parseHHMMToMinutes(policy.shiftStartGraceTime);
}

/** Grace minutes for shift end from policy (minutes field overrides HH:MM). */
function getEndGraceMinutes(policy: LateEarlyPolicy): number {
  if (!policy) return 0;
  if (policy.shiftEndGraceMinutes != null) {
    const n = Number(policy.shiftEndGraceMinutes);
    return Number.isNaN(n) ? parseHHMMToMinutes(policy.shiftEndGraceTime) : n;
  }
  return parseHHMMToMinutes(policy.shiftEndGraceTime);
}

/** Late minutes from backend, or computed from checkIn vs shift start (with grace when policy provided). Only mask when current policy says "Consider Late" = NO. */
function getLateMinutesFallback(record: AttendanceRecord, shiftOverride?: ShiftLike, policy?: LateEarlyPolicy): number | null {
  if (policy && policy.considerLateFromGraceTime === false) return null; // Policy says don't consider late
  if (record.isLate && record.lateMinutes != null) return record.lateMinutes;
  const shift = effectiveShift(record, shiftOverride ?? null);
  if (!record.checkIn || !shift?.startTime) return null;
  const inTime = new Date(record.checkIn);
  const parts = String(shift.startTime).trim().split(':');
  const startH = parseInt(parts[0] || '0', 10);
  const startM = parseInt(parts[1] || '0', 10);
  const shiftStart = new Date(inTime.getFullYear(), inTime.getMonth(), inTime.getDate(), startH, startM, 0, 0);
  const graceMs =
    policy?.considerLateFromGraceTime !== false && (policy?.shiftStartGraceMinutes != null || policy?.shiftStartGraceTime != null)
      ? getStartGraceMinutes(policy) * 60 * 1000
      : 0;
  const graceEnd = new Date(shiftStart.getTime() + graceMs);
  if (inTime <= graceEnd) return null;
  return Math.round((inTime.getTime() - graceEnd.getTime()) / (1000 * 60));
}

/** Early minutes from backend, or computed from checkOut vs shift end (with grace when policy provided). Only mask when current policy says "Consider Early Going" = NO. */
function getEarlyMinutes(record: AttendanceRecord, shiftOverride?: ShiftLike, policy?: LateEarlyPolicy): number | null {
  if (policy && policy.considerEarlyGoingFromGraceTime === false) return null; // Policy says don't consider early
  if (record.isEarly && record.earlyMinutes != null) return record.earlyMinutes;
  const shift = effectiveShift(record, shiftOverride ?? null);
  if (!record.checkOut || !shift?.endTime) return null;
  const out = new Date(record.checkOut);
  const parts = String(shift.endTime).trim().split(':');
  const endH = parseInt(parts[0] || '0', 10);
  const endM = parseInt(parts[1] || '0', 10);
  const shiftEnd = new Date(out.getFullYear(), out.getMonth(), out.getDate(), endH, endM, 0, 0);
  const graceMs =
    policy?.considerEarlyGoingFromGraceTime !== false && (policy?.shiftEndGraceMinutes != null || policy?.shiftEndGraceTime != null)
      ? getEndGraceMinutes(policy) * 60 * 1000
      : 0;
  const graceStart = new Date(shiftEnd.getTime() - graceMs);
  if (out >= graceStart) return null;
  return Math.round((graceStart.getTime() - out.getTime()) / (1000 * 60));
}

/** Parse min shortfall from policy (e.g. "00:10" -> 10 minutes). */
function getMinShortfallMinutes(policy: LateEarlyPolicy): number {
  if (!policy?.minShortfallHoursAsDeviation) return 0;
  return parseHHMMToMinutes(policy.minShortfallHoursAsDeviation);
}

function getMinOTMinutes(policy: LateEarlyPolicy): number {
  if (!policy?.minOTHoursPerDay) return 0;
  return parseHHMMToMinutes(policy.minOTHoursPerDay);
}

function getExcessStayMinutes(record: AttendanceRecord, shiftOverride: ShiftLike, _policy: LateEarlyPolicy): number {
  const shift = effectiveShift(record, shiftOverride ?? null);
  const shiftName = String((shift as { name?: string | null } | null)?.name ?? '').trim().toLowerCase();
  const isWeekOffLike =
    record.status === 'WEEKEND' ||
    record.status === 'HOLIDAY' ||
    shiftName === 'weekoff' ||
    shiftName === 'week off' ||
    shiftName === 'w';

  if (record.excessStayMinutes != null) {
    return Math.max(0, Number(record.excessStayMinutes));
  }
  if (isWeekOffLike && (!shift?.startTime || !shift?.endTime)) {
    if (!record.checkIn || !record.checkOut) return 0;
    const workHours = Number(record.workHours ?? 0);
    if (Number.isFinite(workHours) && workHours > 0) {
      return Math.max(0, Math.round(workHours * 60));
    }
    const mins = Math.round((new Date(record.checkOut).getTime() - new Date(record.checkIn).getTime()) / (1000 * 60));
    return Math.max(0, mins);
  }
  if (!record.checkIn || !record.checkOut || !shift?.startTime || !shift?.endTime) return 0;
  const inTime = new Date(record.checkIn);
  const outTime = new Date(record.checkOut);
  const [startH, startM] = String(shift.startTime).trim().split(':').map((x) => parseInt(x || '0', 10));
  const [endH, endM] = String(shift.endTime).trim().split(':').map((x) => parseInt(x || '0', 10));
  if (Number.isNaN(startH) || Number.isNaN(startM) || Number.isNaN(endH) || Number.isNaN(endM)) return 0;

  // Excess stay is informational: total time outside scheduled shift window
  // = early coming + late leaving.
  const shiftStart = new Date(inTime.getFullYear(), inTime.getMonth(), inTime.getDate(), startH, startM, 0, 0);
  const shiftEnd = new Date(inTime.getFullYear(), inTime.getMonth(), inTime.getDate(), endH, endM, 0, 0);
  if (shiftEnd <= shiftStart) shiftEnd.setDate(shiftEnd.getDate() + 1); // overnight shift

  const earlyComingMins = inTime < shiftStart ? Math.round((shiftStart.getTime() - inTime.getTime()) / (1000 * 60)) : 0;
  const lateLeavingMins = outTime > shiftEnd ? Math.round((outTime.getTime() - shiftEnd.getTime()) / (1000 * 60)) : 0;
  return Math.max(0, earlyComingMins + lateLeavingMins);
}

function getEarlyComingMinutes(record: AttendanceRecord, shiftOverride: ShiftLike): number {
  const shift = effectiveShift(record, shiftOverride ?? null);
  if (!record.checkIn || !shift?.startTime) return 0;
  const inTime = new Date(record.checkIn);
  const [startH, startM] = String(shift.startTime).trim().split(':').map((x) => parseInt(x || '0', 10));
  if (Number.isNaN(startH) || Number.isNaN(startM)) return 0;
  const shiftStart = new Date(inTime.getFullYear(), inTime.getMonth(), inTime.getDate(), startH, startM, 0, 0);
  if (inTime >= shiftStart) return 0;
  return Math.round((shiftStart.getTime() - inTime.getTime()) / (1000 * 60));
}

/**
 * Compute shortfall for display when policy says Consider Late/Early as Shortfall = YES.
 * Uses backend values or frontend fallback for late/early minutes; returns total shortfall minutes
 * and whether it meets the minimum so we can show Shortfall badge and D at read time.
 */
function getBreakExcessMinutes(record: AttendanceRecord, shiftOverride: ShiftLike, policy: LateEarlyPolicy): number {
  if (!record || record.breakHours == null) return 0;
  const breakHours = Number(record.breakHours);
  if (!Number.isFinite(breakHours) || breakHours <= 0) return 0;

  let allowedBreakHours = 24; // fallback matches backend behavior when no break policy is set
  if (policy?.includingShiftBreak) {
    const shift = effectiveShift(record, shiftOverride ?? null) as (ShiftLike & { breakDuration?: number | null }) | null;
    const breakDurationMinutes = shift?.breakDuration != null ? Number(shift.breakDuration) : 0;
    allowedBreakHours = Number.isFinite(breakDurationMinutes) && breakDurationMinutes > 0 ? breakDurationMinutes / 60 : 0;
  } else if (policy?.minBreakHoursAsDeviation) {
    allowedBreakHours = parseHHMMToMinutes(policy.minBreakHoursAsDeviation) / 60;
  }

  const excessBreakHours = Math.max(0, breakHours - allowedBreakHours);
  return Math.round(excessBreakHours * 60);
}

function getDisplayShortfall(
  record: AttendanceRecord,
  shiftOverride: ShiftLike,
  policy: LateEarlyPolicy,
  lateMin: number | null,
  earlyMin: number | null,
  breakExcessMinutes: number = 0
): { shortfallMinutes: number; showShortfall: boolean } {
  const late = lateMin ?? (record.lateMinutes ?? getLateMinutesFallback(record, shiftOverride, policy) ?? 0);
  const early = earlyMin ?? (record.earlyMinutes ?? getEarlyMinutes(record, shiftOverride, policy) ?? 0);
  let shortfallMinutes = 0;
  if (policy?.considerLateAsShortfall && late > 0) shortfallMinutes += late;
  if (policy?.considerEarlyGoingAsShortfall && early > 0) shortfallMinutes += early;
  if (policy?.considerExcessBreakAsShortfall && breakExcessMinutes > 0) shortfallMinutes += breakExcessMinutes;
  const minMins = getMinShortfallMinutes(policy);
  const showShortfall = shortfallMinutes > 0 && shortfallMinutes >= minMins;
  return { shortfallMinutes, showShortfall };
}

/**
 * Build clean In/Out session pairs from sorted punches.
 *
 * Rules:
 * - Walk sequentially using a simple state machine so each OUT is used at most once.
 * - Consecutive IN punches without an OUT in between → close previous session with no OUT, start new session.
 * - Stray OUT (no open IN) → ignored for session display.
 * - If the day ends with an open IN, we keep a final "In … | Out —" row.
 *
 * This avoids weird rows like "In 01:00 PM | Out 01:00 PM" and duplicate "In 09:00 AM | Out 01:00 PM"
 * that happened when we always paired each IN with the first later OUT using slice().find().
 */
function buildSessionPairs(punches: AttendancePunch[]): Array<{ in: string; out: string | null }> {
  const pairs: Array<{ in: string; out: string | null }> = [];
  if (!punches || punches.length === 0) return pairs;

  // Ensure punches are in chronological order (defensive – backend already sorts, but don't rely on it)
  const sorted = [...punches].sort(
    (a, b) => new Date(a.punchTime).getTime() - new Date(b.punchTime).getTime()
  );

  let openIn: AttendancePunch | null = null;

  for (const punch of sorted) {
    // IMPORTANT: mirror backend logic in calculateWorkHoursFromPunches:
    // const status = (p.status?.toUpperCase() === 'OUT' ? 'OUT' : 'IN');
    // i.e. anything that is not explicitly OUT is treated as IN.
    const raw = (punch.status?.toUpperCase() || '').trim();
    const status: 'IN' | 'OUT' = raw === 'OUT' ? 'OUT' : 'IN';

    if (status === 'IN') {
      if (!openIn) {
        // Normal case: start a new session
        openIn = punch;
      } else {
        // We already had an open IN and got another IN without an OUT in between.
        // Close the previous session without an OUT (device sent duplicate IN / user punched twice).
        pairs.push({ in: openIn.punchTime, out: null });
        openIn = punch;
      }
    } else {
      if (openIn) {
        // Normal case: close the current open session
        if (new Date(punch.punchTime).getTime() > new Date(openIn.punchTime).getTime()) {
          pairs.push({ in: openIn.punchTime, out: punch.punchTime });
        } else {
          // Guard: OUT time is not after IN (clock/device glitch) – show as open session instead of 0‑minute pair
          pairs.push({ in: openIn.punchTime, out: null });
        }
        openIn = null;
      } else {
        // Stray OUT with no matching IN – ignore for sessions (still visible in raw punch list via APIs if needed)
      }
    }
  }

  // Day ended with an open IN and no OUT
  if (openIn) {
    pairs.push({ in: openIn.punchTime, out: null });
  }

  return pairs;
}

// Calendar View Component
interface AttendanceCalendarViewProps {
  records: AttendanceRecord[];
  punches: AttendancePunch[];
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
  employeeId?: string;
  organizationId?: string;
  hideEmployeeName?: boolean;
  lateEarlyPolicy?: LateEarlyPolicy;
  approvedCompOffs?: CompOffRequestItem[];
  leaveRequests?: CalendarLeaveRequestItem[];
}

const AttendanceCalendarView = ({ records, punches, currentMonth, onMonthChange, employeeId, organizationId, hideEmployeeName = false, lateEarlyPolicy = null, approvedCompOffs = [], leaveRequests = [] }: AttendanceCalendarViewProps) => {
  const monthStart = useMemo(() => startOfMonth(currentMonth), [currentMonth]);
  const monthEnd = useMemo(() => endOfMonth(currentMonth), [currentMonth]);
  const daysInMonth = useMemo(
    () => eachDayOfInterval({ start: monthStart, end: monthEnd }),
    [monthStart, monthEnd]
  );
  
  // Get first day of month to calculate offset
  const firstDayOfWeek = getDay(monthStart);
  const daysOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1; // Monday = 0
  
  // State for shift assignments
  const [shiftAssignments, setShiftAssignments] = useState<Map<string, string>>(new Map()); // date -> shiftName
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [_loadingShifts, setLoadingShifts] = useState(false);
  
  // Fetch shifts from Shift Master
  useEffect(() => {
    if (!organizationId) return;
    
    shiftService.getAll({
      organizationId,
      limit: 1000,
    }).then((res) => {
      setShifts(res?.shifts || []);
    }).catch(() => {
      setShifts([]);
    });
  }, [organizationId]);
  
  // Fetch or determine shift assignments for each day
  const recordByDateForEmployee = useMemo(() => {
    const byDate = new Map<string, AttendanceRecord>();
    if (!employeeId) return byDate;
    for (const record of records) {
      if (record.employee.id !== employeeId) continue;
      const dateStr = format(new Date(record.date), 'yyyy-MM-dd');
      if (!byDate.has(dateStr)) byDate.set(dateStr, record);
    }
    return byDate;
  }, [records, employeeId]);

  useEffect(() => {
    if (!employeeId || !organizationId) return;

    setLoadingShifts(true);

    // Create shift assignments map - default to "General Shift" for all dates.
    // Sunday is default Week Off; Saturday and other days follow configured policy/records.
    // Override with explicitly assigned shifts from attendance records.
    const assignments = new Map<string, string>();
    const defaultShift = 'General Shift';

    for (const date of daysInMonth) {
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayOfWeek = date.getDay(); // 0=Sunday
      const dayRecord = recordByDateForEmployee.get(dateStr);

      if (dayOfWeek === 0) {
        assignments.set(dateStr, 'Weekoff');
      } else if (dayRecord?.shift?.name) {
        assignments.set(dateStr, dayRecord.shift.name);
      } else {
        assignments.set(dateStr, defaultShift);
      }
    }

    setShiftAssignments(assignments);
    setLoadingShifts(false);
  }, [daysInMonth, recordByDateForEmployee, employeeId, organizationId]);
  
  // Create a map of date strings to records for quick lookup.
  // Use checkIn's local date so punches show on the correct calendar day (fixes timezone "yesterday" bug).
  const recordsByDate = new Map<string, AttendanceRecord[]>();
  records.forEach(record => {
    const d = record.checkIn ? new Date(record.checkIn) : new Date(record.date);
    const dateStr = format(new Date(d.getFullYear(), d.getMonth(), d.getDate()), 'yyyy-MM-dd');
    if (!recordsByDate.has(dateStr)) {
      recordsByDate.set(dateStr, []);
    }
    recordsByDate.get(dateStr)!.push(record);
  });

  // Group punches by (dateStr, employeeId) so we can show every IN/OUT per day
  const punchesByDateEmployee = new Map<string, AttendancePunch[]>();
  punches.forEach(p => {
    const d = new Date(p.punchTime);
    const dateStr = format(new Date(d.getFullYear(), d.getMonth(), d.getDate()), 'yyyy-MM-dd');
    const key = `${dateStr}:${p.employeeId}`;
    if (!punchesByDateEmployee.has(key)) punchesByDateEmployee.set(key, []);
    punchesByDateEmployee.get(key)!.push(p);
  });
  punchesByDateEmployee.forEach((arr) => arr.sort((a, b) => new Date(a.punchTime).getTime() - new Date(b.punchTime).getTime()));

  // Map approved comp-off requests by approval date for calendar badges (only current month)
  const compOffByDate = new Map<string, CompOffRequestItem[]>();
  const monthStartStr = format(monthStart, 'yyyy-MM-dd');
  const monthEndStr = format(monthEnd, 'yyyy-MM-dd');
  (approvedCompOffs || []).forEach((co) => {
    const approvedDate = co.reviewedAt ? format(new Date(co.reviewedAt), 'yyyy-MM-dd') : null;
    if (approvedDate && approvedDate >= monthStartStr && approvedDate <= monthEndStr) {
      if (!compOffByDate.has(approvedDate)) compOffByDate.set(approvedDate, []);
      compOffByDate.get(approvedDate)!.push(co);
    }
  });

  // Map leave requests (pending/approved etc.) by each date in the current month
  const leaveByDate = new Map<string, CalendarLeaveRequestItem[]>();
  (leaveRequests || []).forEach((lr) => {
    const s = new Date(lr.startDate);
    const e = new Date(lr.endDate);
    s.setHours(0, 0, 0, 0);
    e.setHours(0, 0, 0, 0);
    const from = s < monthStart ? new Date(monthStart) : s;
    const to = e > monthEnd ? new Date(monthEnd) : e;
    if (to < from) return;
    const d = new Date(from);
    while (d <= to) {
      const key = format(d, 'yyyy-MM-dd');
      if (!leaveByDate.has(key)) leaveByDate.set(key, []);
      leaveByDate.get(key)!.push(lr);
      d.setDate(d.getDate() + 1);
    }
  });

  const navigateMonth = (direction: 'prev' | 'next') => {
    try {
      // Use date-fns addMonths to handle edge cases (e.g., Jan 31 -> Feb 28/29)
      const newDate = direction === 'prev' 
        ? addMonths(currentMonth, -1)
        : addMonths(currentMonth, 1);
      onMonthChange(newDate);
    } catch (error) {
      console.error('Error navigating month:', error);
      // Fallback: manually set month with proper handling
      const newDate = new Date(currentMonth);
      const currentDay = newDate.getDate();
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      // Ensure the date is valid (handle cases like Jan 31 -> Feb)
      if (newDate.getDate() !== currentDay) {
        // Date was adjusted, set to first day of month
        newDate.setDate(1);
      }
      onMonthChange(newDate);
    }
  };

  const goToToday = () => {
    onMonthChange(new Date());
  };

  return (
    <div className="p-6">
      {/* Calendar Header */}
      <div className="flex justify-between items-center mb-6">
        <button
          onClick={() => navigateMonth('prev')}
          className="px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
        >
          ← Previous
        </button>
        <div className="flex items-center space-x-4">
          <h3 className="text-xl font-semibold text-gray-900">
            {format(currentMonth, 'MMMM yyyy')}
          </h3>
          <button
            onClick={goToToday}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
          >
            Today
          </button>
        </div>
        <button
          onClick={() => navigateMonth('next')}
          className="px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
        >
          Next →
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-3">
        {/* Day Headers */}
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
          <div key={day} className="text-center text-sm font-semibold text-gray-700 py-2">
            {day}
          </div>
        ))}

        {/* Empty cells for days before month start */}
        {Array.from({ length: daysOffset }).map((_, idx) => (
          <div key={`empty-${idx}`} className="h-32 bg-gray-50 rounded-lg"></div>
        ))}

        {/* Calendar Days */}
        {daysInMonth.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const dayRecordsRaw = recordsByDate.get(dateStr) || [];
          // Some back-end flows can accidentally return more than one record for the same
          // employee and date (e.g. synthetic + real). For the calendar card we only want
          // one row per employee per day, so keep the last record per (employeeId, date).
          const byEmployee = new Map<string, AttendanceRecord>();
          dayRecordsRaw.forEach((r) => {
            const key = r.employee.id;
            byEmployee.set(key, r); // later entries overwrite earlier ones
          });
          const dayRecords = Array.from(byEmployee.values());
          const isCurrentDay = isToday(day);
          const dayNumber = format(day, 'd');
          const shiftName = shiftAssignments.get(dateStr) || 'General Shift'; // Default to "General Shift"

          return (
            <div
              key={dateStr}
              className={`min-h-32 bg-white border rounded-lg p-3 shadow-sm hover:shadow-md transition ${
                isCurrentDay
                  ? 'border-blue-400 ring-2 ring-blue-200'
                  : 'border-gray-200'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <span className={`text-sm font-semibold ${
                  isCurrentDay ? 'text-blue-700' : 'text-gray-900'
                }`}>
                  {dayNumber}
                </span>
              </div>
              
              <div className="space-y-1.5">
                {/* Display shift name badge - always shown (default is "General Shift") */}
                {shiftName && (
                  <div className={`inline-block px-2 py-1 rounded text-xs font-semibold mb-1 ${
                    shiftName === 'Weekoff' || shiftName === 'W' || shiftName === 'Week Off'
                      ? 'bg-gray-700 text-white'
                      : 'bg-blue-600 text-white'
                  }`}>
                    {shiftName === 'W' ? 'Week Off' : shiftName === 'Weekoff' ? 'Week Off' : shiftName}
                  </div>
                )}

                {/* Leave badges (pending/approved/rejected/cancelled) */}
                {(leaveByDate.get(dateStr) || []).map((lr) => {
                  const status = (lr.status || '').toUpperCase();
                  const leaveTypeName = lr.leaveType?.name || 'Leave';
                  const ondutyReasonLabel = parseOndutyLabelFromReason(lr.reason ?? undefined);
                  const displayLeaveTypeName = ondutyReasonLabel || leaveTypeName;
                  const isPermission = leaveTypeName.toLowerCase().includes('permission');
                  const permissionTiming = parsePermissionTimingFromReason(lr.reason ?? undefined, leaveTypeName);
                  const statusText =
                    status === 'APPROVED' ? 'Approved' :
                    status === 'REJECTED' ? 'Rejected' :
                    status === 'CANCELLED' ? 'Cancelled' : 'Pending';
                  const dayType = isPermission ? 'Permission' : (Number(lr.totalDays) >= 1 ? 'Full Day' : 'Half Day');
                  const titleParts = [displayLeaveTypeName, permissionTiming || dayType, statusText].filter(Boolean);
                  const tone =
                    status === 'APPROVED'
                      ? 'bg-emerald-500 text-white'
                      : status === 'REJECTED' || status === 'CANCELLED'
                        ? 'bg-red-500 text-white'
                        : 'bg-lime-500 text-white';
                  return (
                    <div
                      key={`leave-${lr.id}-${dateStr}`}
                      className={`inline-block max-w-full rounded px-2 py-1 text-xs font-semibold leading-tight ${tone}`}
                      title={titleParts.join(' - ')}
                    >
                      <div className="truncate">{displayLeaveTypeName}</div>
                      <div className="truncate">{permissionTiming || dayType} - {statusText}</div>
                    </div>
                  );
                })}
                
                {dayRecords.length > 0 ? (
                  dayRecords.map((record) => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const dayPunches = punchesByDateEmployee.get(`${dateStr}:${record.employee.id}`) || [];
                    const approvedLeavesForDay = (leaveByDate.get(dateStr) || []).filter(
                      (lr) => (lr.status || '').toUpperCase() === 'APPROVED'
                    );
                    const primaryApprovedLeave = approvedLeavesForDay[0];
                    const hasApprovedPermission = approvedLeavesForDay.some((lr) => {
                      const leaveTypeName = (lr.leaveType?.name || '').toLowerCase();
                      if (leaveTypeName.includes('permission')) return true;
                      return parsePermissionTimingFromReason(lr.reason ?? undefined, lr.leaveType?.name) !== null;
                    });
                    const workedMinutes = Number.isFinite(Number(record.workHours))
                      ? Math.round(Number(record.workHours) * 60)
                      : 0;
                    const isPermissionFullDayPresent =
                      (record.status || 'PRESENT') === 'PRESENT' &&
                      hasApprovedPermission &&
                      workedMinutes >= 7 * 60;
                    const isOndutyOrWfhFullDayPresent =
                      (record.status || 'PRESENT') === 'PRESENT' &&
                      approvedLeavesForDay.some((lr) =>
                        isOndutyOrWfhLeaveType(lr.leaveType?.name) || !!parseOndutyLabelFromReason(lr.reason ?? undefined)
                      );
                    const hasApprovedHalfDayLeave = (leaveByDate.get(dateStr) || []).some(
                      (lr) => (lr.status || '').toUpperCase() === 'APPROVED' && Number(lr.totalDays) > 0 && Number(lr.totalDays) < 1
                    );
                    const sessions = buildSessionPairs(dayPunches);
                    const firstIn = record.checkIn || (dayPunches.find((p) => (p.status?.toUpperCase() || '') === 'IN')?.punchTime);
                    const lastOut = record.checkOut || (dayPunches.filter((p) => (p.status?.toUpperCase() || '') === 'OUT').pop()?.punchTime);
                    const lastPunchOfDay = dayPunches.length > 0 ? dayPunches[dayPunches.length - 1] : null;
                    const isCurrentlyIn = firstIn && !lastOut && lastPunchOfDay && (lastPunchOfDay.status?.toUpperCase() || '') === 'IN';
                    const isSingleInPunchNoOut =
                      dayPunches.length === 1 &&
                      (dayPunches[0]?.status?.toUpperCase() || '') === 'IN' &&
                      !!firstIn &&
                      !lastOut;
                    const lastInTime = dayPunches.filter((p) => (p.status?.toUpperCase() || '') === 'IN').pop()?.punchTime;
                    const formatTime = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                    // Prefer a shift that has startTime/endTime so Late/Early fallback can compute; use Shift Master by name when record.shift lacks times
                    const shiftFromRecord = record.shift;
                    const shiftFromList = shiftName ? shifts.find((s) => s.name === shiftName) : null;
                    const hasFullShift = shiftFromRecord && shiftFromRecord.startTime != null && shiftFromRecord.endTime != null;
                    let effectiveShiftForRecord: ShiftLike = hasFullShift ? shiftFromRecord : (shiftFromList ?? shiftFromRecord ?? null);
                    // Last resort: if still no start/end (e.g. Shift Master not loaded or name mismatch), use default for common shift names so badges show
                    if ((!effectiveShiftForRecord?.startTime || !effectiveShiftForRecord?.endTime) && shiftName && shiftName !== 'Weekoff' && shiftName !== 'W' && shiftName !== 'Week Off') {
                      effectiveShiftForRecord = { startTime: '09:00', endTime: '18:00' };
                    }

                    return (
                      <div
                        key={record.id}
                        className="text-xs space-y-1"
                      >
                        {!hideEmployeeName && (
                          <div className="font-medium text-gray-900 truncate">
                            {record.employee.firstName} {record.employee.lastName}
                          </div>
                        )}
                        {/* First In and Last Out (or Currently In if still clocked in) */}
                        <div className="flex flex-wrap gap-x-2 gap-y-0.5 font-semibold">
                          {firstIn && (
                            <span className="text-blue-700">First In: {formatTime(typeof firstIn === 'string' ? firstIn : (firstIn as Date).toISOString())}</span>
                          )}
                          {lastOut ? (
                            <span className="text-red-700">Last Out: {formatTime(typeof lastOut === 'string' ? lastOut : (lastOut as Date).toISOString())}</span>
                          ) : isCurrentlyIn && lastInTime ? (
                            <span className="text-amber-700">Currently In (since {formatTime(lastInTime)})</span>
                          ) : firstIn ? (
                            <span className="text-amber-700">Still Working</span>
                          ) : (record.shift?.name) ? (
                            <span className="text-gray-600">Shift assigned – no punch yet</span>
                          ) : null}
                        </div>
                        {/* Every In/Out pair (sessions) so user sees where time was spent */}
                        {sessions.length > 0 && (
                          <div className="text-gray-600 space-y-0.5 border-l-2 border-gray-200 pl-1.5">
                            {sessions.map((pair, idx) => (
                              <div key={idx} className="leading-tight">
                                In: {formatTime(pair.in)} | {pair.out ? `Out: ${formatTime(pair.out)}` : 'Out: —'}
                              </div>
                            ))}
                          </div>
                        )}
                        {(record.status || (firstIn && lastOut && 'PRESENT')) && (
                          <div className={`text-xs font-medium ${
                            (((record.status || 'PRESENT') === 'LEAVE' && workedMinutes > 0)
                              ? 'PRESENT'
                              : (record.status || 'PRESENT')) === 'PRESENT'
                              ? 'text-green-700'
                              : ((((record.status || 'PRESENT') === 'LEAVE' && workedMinutes > 0)
                                ? 'PRESENT'
                                : (record.status || 'PRESENT')) === 'ABSENT')
                              ? 'text-red-700'
                              : ((((record.status || 'PRESENT') === 'LEAVE' && workedMinutes > 0)
                                ? 'PRESENT'
                                : (record.status || 'PRESENT')) === 'LEAVE')
                              ? 'text-purple-700'
                              : ((((record.status || 'PRESENT') === 'LEAVE' && workedMinutes > 0)
                                ? 'PRESENT'
                                : (record.status || 'PRESENT')) === 'HOLIDAY')
                              ? 'text-orange-700'
                              : 'text-yellow-700'
                          }`}>
                            {(() => {
                              const rawStatusText = record.status || 'PRESENT';
                              const statusText =
                                rawStatusText === 'LEAVE' && workedMinutes > 0 ? 'PRESENT' : rawStatusText;
                              if (isPermissionFullDayPresent || isOndutyOrWfhFullDayPresent) {
                                return 'Present: Full Day';
                              }
                              if (statusText === 'PRESENT' && (record.isDeviation || (() => {
                                const lateM = getLateMinutesFallback(record, effectiveShiftForRecord, lateEarlyPolicy);
                                const earlyMRaw = getEarlyMinutes(record, effectiveShiftForRecord, lateEarlyPolicy);
                                const earlyM = hasApprovedHalfDayLeave ? 0 : earlyMRaw;
                                const breakExcessM = getBreakExcessMinutes(record, effectiveShiftForRecord, lateEarlyPolicy);
                                return getDisplayShortfall(record, effectiveShiftForRecord, lateEarlyPolicy, lateM, earlyM, breakExcessM).showShortfall;
                              })())) {
                                return 'Present (with deviation)';
                              }
                              if (statusText === 'LEAVE' && primaryApprovedLeave?.leaveType) {
                                return primaryApprovedLeave.leaveType.code || primaryApprovedLeave.leaveType.name || 'LEAVE';
                              }
                              return statusText;
                            })()}
                          </div>
                        )}
                        {/* Policy indicators: L (Late), EG (Early Going), D (Deviation), OT (Overtime), Shortfall.
                            - When approved permission (e.g. 09:00-11:00) exists and first punch is at/after permission end, hide Late and shortfall from late.
                            - Use frontend fallback so calendar reflects current policy even when record wasn't recalculated. */}
                        {(() => {
                          const leavesForDay = leaveByDate.get(dateStr) || [];
                          const permissionEndTime = getPermissionEndTimeForDate(dateStr, leavesForDay);
                          const approvedPermissionMinutes = getApprovedPermissionMinutesForDate(leavesForDay);
                          const firstPunchTime = firstIn
                            ? new Date(typeof firstIn === 'string' ? firstIn : (firstIn as Date).toISOString())
                            : null;
                          const permissionCoversLate =
                            permissionEndTime != null &&
                            firstPunchTime != null &&
                            firstPunchTime >= permissionEndTime;
                          const permissionOnDay = leavesForDay.some((lr) => {
                            if ((lr.status || '').toUpperCase() !== 'APPROVED' || !lr.reason?.trim()) return false;
                            return /^\[Permission\s+\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}\]/i.test(lr.reason);
                          });

                          const lateMin = getLateMinutesFallback(record, effectiveShiftForRecord, lateEarlyPolicy);
                          const earlyMinRaw = getEarlyMinutes(record, effectiveShiftForRecord, lateEarlyPolicy);
                          const earlyMin = hasApprovedHalfDayLeave ? 0 : earlyMinRaw;
                          const breakExcessM = getBreakExcessMinutes(record, effectiveShiftForRecord, lateEarlyPolicy);
                          const adjustedBreakExcessM =
                            approvedPermissionMinutes > 0
                              ? Math.max(0, breakExcessM - approvedPermissionMinutes)
                              : breakExcessM;
                          const { showShortfall, shortfallMinutes } = getDisplayShortfall(
                            record,
                            effectiveShiftForRecord,
                            lateEarlyPolicy,
                            permissionCoversLate ? 0 : lateMin,
                            earlyMin,
                            adjustedBreakExcessM
                          );
                          const lateMinsForDisplay = permissionCoversLate ? 0 : (record.lateMinutes ?? lateMin ?? 0);
                          const shortfallFromLate = permissionCoversLate ? 0 : (record.lateMinutes ?? lateMin ?? 0);
                          const shortfallMinsForDisplay = Math.max(0, shortfallMinutes - (permissionCoversLate ? shortfallFromLate : 0));
                          const minShortfallMins = lateEarlyPolicy?.minShortfallHoursAsDeviation
                            ? (() => {
                                const [h, m] = (lateEarlyPolicy.minShortfallHoursAsDeviation || '00:00').split(':').map(Number);
                                return (h || 0) * 60 + (m || 0);
                              })()
                            : 0;
                          const shortfallWithoutPermission = Math.max(0, shortfallMinsForDisplay - approvedPermissionMinutes);
                          const showShortfallAdjusted =
                            shortfallWithoutPermission > 0 && shortfallWithoutPermission >= minShortfallMins;
                          const forceShortfallFromWorkedLeave =
                            (record.status || '').toUpperCase() === 'LEAVE' &&
                            workedMinutes > 0 &&
                            (record.earlyMinutes ?? earlyMin ?? 0) > 0;

                          const excessStayMins = getExcessStayMinutes(record, effectiveShiftForRecord, lateEarlyPolicy);
                          const earlyComingMins = getEarlyComingMinutes(record, effectiveShiftForRecord);
                          const showLate = !permissionCoversLate && (((record.lateMinutes ?? 0) > 0) || record.isLate || (lateMin ?? 0) > 0);
                          const showEarly =
                            !hasApprovedHalfDayLeave &&
                            (((record.earlyMinutes ?? 0) > 0) || record.isEarly || (earlyMin ?? 0) > 0);
                          const shortfallOnlyDeviationAdjusted =
                            approvedPermissionMinutes > 0 &&
                            !!record.isDeviation &&
                            (record.deviationReason ?? '').toLowerCase().includes('shortfall');
                          const showDeviation =
                            (!shortfallOnlyDeviationAdjusted && !!record.isDeviation) ||
                            showShortfallAdjusted ||
                            forceShortfallFromWorkedLeave;
                          const minOtMins = getMinOTMinutes(lateEarlyPolicy);
                          const showOt = record.otMinutes != null && record.otMinutes > 0 && record.otMinutes >= minOtMins;
                          const showExcessStay = excessStayMins > 0;
                          const showEarlyComing = earlyComingMins > 0;
                          const showFullDayPermissionBadge = isPermissionFullDayPresent || isOndutyOrWfhFullDayPresent;
                          const showIndicators =
                            showFullDayPermissionBadge ||
                            showLate ||
                            showEarly ||
                            showDeviation ||
                            showOt ||
                            showExcessStay ||
                            showEarlyComing ||
                            forceShortfallFromWorkedLeave;
                          return showIndicators ? (
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {showFullDayPermissionBadge && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">
                                Present: Full Day
                              </span>
                            )}
                            {showLate && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800">
                                Late: {(record.lateMinutes ?? lateMin ?? 0)} min
                              </span>
                            )}
                            {showEarly && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-800">
                                Early going: {(record.earlyMinutes ?? earlyMin ?? 0)} min
                              </span>
                            )}
                            {showDeviation && (
                              <span
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800"
                                title={record.deviationReason ?? (showShortfall ? 'Shortfall' : 'Deviation')}
                              >
                                D
                              </span>
                            )}
                            {/* Shortfall: when permission covers late we show adjusted shortfall (excluding late portion) */}
                            {(record.isDeviation && (record.deviationReason ?? '').includes('Shortfall') && !permissionCoversLate) ||
                            showShortfallAdjusted ||
                            forceShortfallFromWorkedLeave ? (() => {
                              const backendShortfall = (record.lateMinutes ?? 0) + (record.earlyMinutes ?? 0);
                              const forcedShortfall = forceShortfallFromWorkedLeave ? (record.earlyMinutes ?? earlyMin ?? 0) : 0;
                              const mins =
                                record.isDeviation && (record.deviationReason ?? '').includes('Shortfall') && backendShortfall > 0 && !permissionCoversLate
                                  ? backendShortfall
                                  : (shortfallWithoutPermission > 0 ? shortfallWithoutPermission : forcedShortfall);
                              return (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-800">
                                  {mins > 0 ? `Shortfall: ${mins} min` : 'Shortfall'}
                                </span>
                              );
                            })() : null}
                            {showOt && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800" title={`OT: ${formatWorkHoursAsHHMM((record.otMinutes ?? 0) / 60)}`}>OT {formatWorkHoursAsHHMM((record.otMinutes ?? 0) / 60)}</span>
                            )}
                            {showExcessStay && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-800" title="Time stayed after OT start threshold">
                                Excess Stay {formatWorkHoursAsHHMM(excessStayMins / 60)}
                              </span>
                            )}
                            {showEarlyComing && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-cyan-100 text-cyan-800" title="Time arrived before shift start">
                                Early Coming {formatWorkHoursAsHHMM(earlyComingMins / 60)}
                              </span>
                            )}
                          </div>
                          ) : null;
                        })()}
                        {/* Total Net Work Time in HH:mm right below PRESENT */}
                        {record.workHours !== null && record.workHours !== undefined && !isSingleInPunchNoOut && (
                          <div className="text-gray-800 font-medium">
                            Total Net Work Time: {formatWorkHoursAsHHMM(Number(record.workHours))}
                          </div>
                        )}
                        {isSingleInPunchNoOut ? (
                          <div className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800">
                            Single Punch
                          </div>
                        ) : Number(record.workHours ?? 0) >= 9 && !!lastOut && (
                          <div className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800">
                            Validation Completed
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-xs text-gray-400 text-center py-2">
                    {/* When a specific employee is selected and a shift is shown for this day but there is
                        no attendance record yet, treat it as "shift assigned – no punch yet" instead of
                        a blank "No records" message so the calendar feels prefilled by default. */}
                    {employeeId && shiftName && shiftName !== 'Weekoff' && shiftName !== 'W' && shiftName !== 'Week Off'
                      ? 'Shift assigned – no punch yet'
                      : 'No records'}
                  </div>
                )}

                {/* Comp Off credited badge */}
                {(compOffByDate.get(dateStr) || []).map((co) => (
                  <div
                    key={co.id}
                    className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800 border border-green-300"
                    title={`Comp Off approved on ${co.reviewedAt ? new Date(co.reviewedAt).toLocaleString() : dateStr}`}
                  >
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    Comp Off – {Number(co.requestDays) === 1 ? '1 Day' : `${co.requestDays} Day`}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-8 flex items-center justify-start space-x-6 text-sm">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
          <span className="text-gray-600">Today</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          <span className="text-gray-600">Present</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
          <span className="text-gray-600">Absent</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
          <span className="text-gray-600">Leave</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-green-600 rounded-full"></div>
          <span className="text-gray-600">Comp Off Credited</span>
        </div>
      </div>
    </div>
  );
};

const AttendancePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, loadUser, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [myRecords, setMyRecords] = useState<AttendanceRecord[]>([]);
  const [punches, setPunches] = useState<AttendancePunch[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMyRecords, setLoadingMyRecords] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState(false);
  const [componentError, setComponentError] = useState<string | null>(null);
  // Restore view and month from URL so refresh keeps selection
  const viewFromUrl = searchParams.get('view') === 'my' ? 'my' : 'team';
  const monthFromUrl = searchParams.get('month'); // YYYY-MM
  const initialMonth = monthFromUrl
    ? (() => {
        const [y, m] = monthFromUrl.split('-').map(Number);
        if (y && m >= 1 && m <= 12) return new Date(y, m - 1, 1);
        return new Date();
      })()
    : new Date();

  const [viewMode, setViewModeState] = useState<'team' | 'my'>(viewFromUrl);
  const [displayMode, setDisplayMode] = useState<'table' | 'calendar'>('calendar');
  const [currentMonth, setCurrentMonthState] = useState(initialMonth);

  const setViewMode = (mode: 'team' | 'my') => {
    setViewModeState(mode);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('view', mode);
      return next;
    });
  };
  const setCurrentMonth = (date: Date) => {
    setCurrentMonthState(date);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('month', format(date, 'yyyy-MM'));
      return next;
    });
  };
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncFromDate, setSyncFromDate] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [syncToDate, setSyncToDate] = useState(() => format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ synced: number; created: number; updated: number; skipped: number; errors: { employeeCode: string; date: string; message: string }[] } | null>(null);
  const [compOffSummary, setCompOffSummary] = useState<CompOffSummary | null>(null);
  const [loadingCompOffSummary, setLoadingCompOffSummary] = useState(false);
  const [showCompOffModal, setShowCompOffModal] = useState(false);
  const [compOffReason, setCompOffReason] = useState('');
  const [submittingCompOff, setSubmittingCompOff] = useState(false);
  const [compOffMessage, setCompOffMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Approved comp-off entries for calendar display
  const [approvedCompOffs, setApprovedCompOffs] = useState<CompOffRequestItem[]>([]);
  const [calendarLeaveRequests, setCalendarLeaveRequests] = useState<CalendarLeaveRequestItem[]>([]);

  // Manual punch (for testing): any date, multiple In/Out per day
  const [manualPunchDate, setManualPunchDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [manualPunchTime, setManualPunchTime] = useState(() => format(new Date(), 'HH:mm'));
  const [manualPunchEmployeeId, setManualPunchEmployeeId] = useState<string | null>(null); // null = self
  const [manualPunchSubmitting, setManualPunchSubmitting] = useState(false);
  const [manualPunchMessage, setManualPunchMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [manualPunchEmployeeList, setManualPunchEmployeeList] = useState<Employee[]>([]);
  const [lateEarlyPolicy, setLateEarlyPolicy] = useState<LateEarlyPolicy>(null);
  const [showLeaveAppliedBanner, setShowLeaveAppliedBanner] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Check if user is a manager
  const isManager = user?.role === 'MANAGER';
  const isHRManager = user?.role === 'HR_MANAGER';
  const isOrgAdmin = user?.role === 'ORG_ADMIN';
  const canViewTeamAttendance = isManager || isHRManager || isOrgAdmin;
  const canSyncBiometric = isHRManager || isOrgAdmin || user?.role === 'SUPER_ADMIN';
  const canManualPunch = isHRManager || isOrgAdmin || user?.role === 'SUPER_ADMIN';
  // HR-only: calendar view requires selecting one employee (no "all employees" by default)
  const isHRForCalendar = isHRManager || isOrgAdmin;
  const canChooseEmployeeCompOffSummary = isHRManager || isOrgAdmin || user?.role === 'SUPER_ADMIN' || isManager;

  // HR-only: single-employee selection for calendar/table (searchable dropdown); restore from URL on refresh
  const employeeIdFromUrl = searchParams.get('employeeId') || null;
  const [selectedEmployeeId, setSelectedEmployeeIdState] = useState<string | null>(employeeIdFromUrl);
  const setSelectedEmployeeId = (id: string | null) => {
    setSelectedEmployeeIdState(id);
    if (id) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('employeeId', id);
        return next;
      });
    } else {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('employeeId');
        return next;
      });
    }
  };
  // Sync state from URL when URL has employeeId (e.g. after refresh or back)
  useEffect(() => {
    if (employeeIdFromUrl) setSelectedEmployeeIdState(employeeIdFromUrl);
  }, [employeeIdFromUrl]);

  // Persist default view and month to URL on mount if missing, so refresh restores selection
  useEffect(() => {
    const view = searchParams.get('view');
    const month = searchParams.get('month');
    const needView = view !== 'my' && view !== 'team';
    const needMonth = !month || !/^\d{4}-\d{2}$/.test(month);
    if (needView || needMonth) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (needView) next.set('view', 'team');
        if (needMonth) next.set('month', format(new Date(), 'yyyy-MM'));
        return next;
      });
    }
  }, []);

  // Sync view and month state from URL when URL changes (e.g. refresh or back button)
  useEffect(() => {
    setViewModeState(viewFromUrl);
  }, [viewFromUrl]);
  useEffect(() => {
    if (!monthFromUrl || !/^\d{4}-\d{2}$/.test(monthFromUrl)) return;
    const [y, m] = monthFromUrl.split('-').map(Number);
    if (y && m >= 1 && m <= 12) {
      setCurrentMonthState(new Date(y, m - 1, 1));
    }
  }, [monthFromUrl]);

  const [employeeList, setEmployeeList] = useState<Employee[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employeeDropdownOpen, setEmployeeDropdownOpen] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const employeeDropdownRef = useRef<HTMLDivElement>(null);

  // Load user data if not available
  useEffect(() => {
    if (!user && !loadingUser) {
      setLoadingUser(true);
      loadUser()
        .catch((err) => {
          console.error('Failed to load user:', err);
          setComponentError('Failed to load user data. Please refresh the page.');
        })
        .finally(() => {
          setLoadingUser(false);
        });
    }
  }, [user, loadUser, loadingUser]);

  useEffect(() => {
    if (user) {
      (async () => {
        try {
          await Promise.allSettled([
            fetchRecords(),
            fetchMyRecords(),
            fetchPunches(),
            fetchCompOffSummary(),
            fetchApprovedCompOffs(),
            fetchCalendarLeaveRequests(),
          ]);
        } catch (err: any) {
          console.error('Error in useEffect:', err);
          setComponentError(err.message || 'Failed to initialize attendance page');
        }
      })();
    }
  }, [user, currentMonth, viewMode, selectedEmployeeId]);

  // Refetch when tab/window gains focus so device punches (or web check-in/out) are reflected without manual refresh
  useEffect(() => {
    const onFocus = () => {
      if (user) {
        // Keep existing values visible and refresh in background.
        fetchRecords({ silent: true });
        fetchMyRecords({ silent: true });
        fetchPunches();
        fetchCompOffSummary({ silent: true });
        fetchApprovedCompOffs();
        fetchCalendarLeaveRequests();
      }
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [user, currentMonth, viewMode, selectedEmployeeId]);

  // Refetch when returning from Face Attendance punch or Associate Shift Grid so calendar shows new data
  useEffect(() => {
    const state = location.state as { refreshFromFacePunch?: boolean; refreshFromShiftGrid?: boolean; leaveApplied?: boolean } | null;
    const shouldRefetch = (state?.refreshFromFacePunch || state?.refreshFromShiftGrid) && user;
    if (shouldRefetch) {
      const refetch = async () => {
        await Promise.all([fetchRecords(), fetchMyRecords(), fetchPunches(), fetchCalendarLeaveRequests()]);
        navigate('/attendance', { replace: true, state: {} });
      };
      refetch();
    }
    if (state?.leaveApplied) {
      setShowLeaveAppliedBanner(true);
      const refetchLeaveData = async () => {
        await Promise.all([fetchRecords({ silent: true }), fetchMyRecords({ silent: true }), fetchCalendarLeaveRequests()]);
        navigate('/attendance', { replace: true, state: {} });
      };
      refetchLeaveData();
    }
  }, [location.state, user]);

  const orgId = user?.employee?.organizationId || user?.employee?.organization?.id;
  // Auto-hide leave-applied success banner after 6 seconds
  useEffect(() => {
    if (!showLeaveAppliedBanner) return;
    const t = setTimeout(() => setShowLeaveAppliedBanner(false), 6000);
    return () => clearTimeout(t);
  }, [showLeaveAppliedBanner]);

  // HR-only: fetch employees for searchable dropdown when in team view
  useEffect(() => {
    if (!isHRForCalendar || viewMode !== 'team' || !orgId) return;
    let cancelled = false;
    setLoadingEmployees(true);
    employeeService.getAll({ organizationId: orgId, limit: 500, employeeStatus: 'ACTIVE' })
      .then((data) => {
        if (!cancelled) setEmployeeList(data.employees || []);
      })
      .catch(() => {
        if (!cancelled) setEmployeeList([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingEmployees(false);
      });
    return () => { cancelled = true; };
  }, [isHRForCalendar, viewMode, orgId]);

  // Fetch current attendance policy (Late & Others). Used for read-time shortfall/Late/Early display.
  // Call this after changing policy in UI so calendar reflects the new setting without full page reload.
  const fetchLateEarlyPolicy = useCallback(async () => {
    const orgId = user?.employee?.organizationId || user?.employee?.organization?.id;
    if (!orgId) {
      setLateEarlyPolicy(null);
      return;
    }
    try {
      const res = await shiftAssignmentRuleService.getAll({
        organizationId: orgId,
        remarksMarker: '__POLICY_RULES__',
        limit: 1,
      });
      const rule = res.rules?.[0];
      if (!rule?.remarks) {
        setLateEarlyPolicy(null);
        return;
      }
      const marker = '__POLICY_RULES__';
      const idx = rule.remarks.indexOf(marker);
      if (idx === -1) {
        setLateEarlyPolicy(null);
        return;
      }
      const policy = JSON.parse(rule.remarks.slice(idx + marker.length)) as LateEarlyPolicy;
      setLateEarlyPolicy(policy);
    } catch {
      setLateEarlyPolicy(null);
    }
  }, [user?.employee?.organizationId, user?.employee?.organization?.id]);

  useEffect(() => {
    fetchLateEarlyPolicy();
  }, [fetchLateEarlyPolicy]);

  // When user returns to this tab (e.g. after changing policy in another tab/page), refetch policy
  // so calendar shows according to the latest "Consider Early Going as Shortfall" etc. without code change.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchLateEarlyPolicy();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [fetchLateEarlyPolicy]);

  // Close HR employee dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (employeeDropdownRef.current && !employeeDropdownRef.current.contains(e.target as Node)) {
        setEmployeeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // When HR switches to "My Records", clear selected employee
  useEffect(() => {
    if (viewMode === 'my') setSelectedEmployeeId(null);
  }, [viewMode]);

  // Fetch employees for manual punch dropdown (HR/Admin only)
  useEffect(() => {
    if (!canManualPunch) return;
    let cancelled = false;
    employeeService.getAll({ limit: 500, employeeStatus: 'ACTIVE' })
      .then((data) => { if (!cancelled) setManualPunchEmployeeList(data.employees || []); })
      .catch(() => { if (!cancelled) setManualPunchEmployeeList([]); });
    return () => { cancelled = true; };
  }, [canManualPunch]);

  const fetchRecords = async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true;
    try {
      const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id;
      if (!organizationId) {
        console.warn('Organization ID not available, skipping fetchRecords');
        setRecords([]);
        if (!silent) setLoading(false);
        return;
      }
      if (isHRForCalendar && viewMode === 'team' && !selectedEmployeeId) {
        setRecords([]);
        if (!silent) setLoading(false);
        return;
      }
      if (!silent) setLoading(true);
      setError(null);
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);
      const params: Record<string, unknown> = {
        page: 1,
        limit: 1000,
        startDate: format(monthStart, 'yyyy-MM-dd'),
        endDate: format(monthEnd, 'yyyy-MM-dd'),
        organizationId,
      };
      if (viewMode === 'my' || !canViewTeamAttendance) {
        if (user?.employee?.id) params.employeeId = user.employee.id;
      } else if (isHRForCalendar && viewMode === 'team' && selectedEmployeeId) {
        params.employeeId = selectedEmployeeId;
      }
      const response = await api.get('/attendance/records', {
        params,
      });
      if (response.data?.data?.records) {
        setRecords(response.data.data.records);
      } else {
        setRecords([]);
      }
    } catch (err: any) {
      const status = err.response?.status;
      const errorMsg = err.response?.data?.message || err.message || 'Failed to fetch attendance records';
      
      // 404 or "not found" errors are expected when there are no records for a month
      // Don't show these as errors, just set empty records
      if (status === 404 || errorMsg.toLowerCase().includes('not found')) {
        console.log('No records found for this month (expected)');
        setRecords([]);
        setError(null); // Clear any previous errors
      } else {
        setError(errorMsg);
        console.error('Error fetching records:', err);
      }
      setRecords([]);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Fetch all IN/OUT punches for the month so calendar shows every punch (e.g. 4:31)
  const fetchPunches = async () => {
    const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
    let employeeId: string | undefined;
    if (!canViewTeamAttendance && user?.employee?.id) employeeId = user.employee.id; // EMPLOYEE: always own
    else if (viewMode === 'my' && user?.employee?.id) employeeId = user.employee.id;
    else if (isHRForCalendar && viewMode === 'team' && selectedEmployeeId) employeeId = selectedEmployeeId;
    else if (canViewTeamAttendance && viewMode === 'team' && !isHRForCalendar) {
      // Manager team mode can include many employees; this endpoint expects one employee.
      setPunches([]);
      return;
    }
    try {
      const params: { startDate: string; endDate: string; employeeId?: string } = {
        startDate: monthStart,
        endDate: monthEnd,
      };
      // For employee self-view, allow backend to infer employeeId from logged-in user.
      if (employeeId) params.employeeId = employeeId;
      const res = await api.get<{ data: { punches: AttendancePunch[] } }>('/attendance/punches', {
        params,
      });
      setPunches(res.data?.data?.punches || []);
    } catch {
      setPunches([]);
    }
  };

  // Fetch manager's own attendance records (for calendar/table when "My Records" is selected)
  const fetchMyRecords = async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true;
    if (!canViewTeamAttendance || !user?.employee?.id) return;
    
    const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id;
    if (!organizationId) {
      console.warn('Organization ID not available, skipping fetchMyRecords');
      setMyRecords([]);
      return;
    }
    
    try {
      if (!silent) setLoadingMyRecords(true);
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);
      const response = await api.get('/attendance/records', {
        params: {
          page: 1,
          limit: 100,
          employeeId: user.employee.id,
          startDate: format(monthStart, 'yyyy-MM-dd'),
          endDate: format(monthEnd, 'yyyy-MM-dd'),
          organizationId,
        },
      });
      if (response.data?.data?.records) {
        setMyRecords(response.data.data.records);
      } else {
        setMyRecords([]);
      }
    } catch (err: any) {
      const status = err.response?.status;
      // 404 or "not found" errors are expected when there are no records
      if (status === 404 || err.response?.data?.message?.toLowerCase().includes('not found')) {
        console.log('No my records found for this month (expected)');
      } else {
        console.error('Error fetching my records:', err);
      }
      setMyRecords([]);
    } finally {
      if (!silent) setLoadingMyRecords(false);
    }
  };

  const handleManualPunch = async () => {
    const employeeId = manualPunchEmployeeId || user?.employee?.id;
    if (!employeeId) {
      setManualPunchMessage({ type: 'error', text: 'Employee not found.' });
      return;
    }
    setManualPunchMessage(null);
    setManualPunchSubmitting(true);
    try {
      // Build punch timestamp in user's local time so 4:59 PM stays 4:59 PM (not interpreted as UTC)
      const timePart = manualPunchTime.length === 5 ? `${manualPunchTime}:00` : manualPunchTime;
      const punchAtLocal = new Date(`${manualPunchDate}T${timePart}`);
      const punchAtISO = punchAtLocal.toISOString();

      await api.post('/attendance/manual', {
        employeeId,
        date: manualPunchDate,
        time: manualPunchTime,
        punchAt: punchAtISO,
      });
      setManualPunchMessage({ type: 'success', text: 'Punch added (In/Out toggled for this date).' });
      await Promise.all([fetchRecords(), fetchMyRecords(), fetchPunches()]);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to add punch';
      setManualPunchMessage({ type: 'error', text: msg });
    } finally {
      setManualPunchSubmitting(false);
    }
  };

  // Show loading state while user is being loaded
  if (loadingUser || !user) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show error state if component error occurred
  if (componentError) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-800 mb-2">Error Loading Attendance Page</h2>
            <p className="text-red-700 mb-4">{componentError}</p>
            <button
              onClick={() => {
                setComponentError(null);
                window.location.reload();
              }}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
            >
              Reload Page
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleSyncBiometric = async () => {
    const orgId = user?.employee?.organizationId || user?.employee?.organization?.id;
    if (!orgId) {
      setError('Organization not found.');
      return;
    }
    try {
      setSyncing(true);
      setSyncResult(null);
      const result = await attendanceService.syncBiometric(orgId, syncFromDate, syncToDate);
      setSyncResult(result);
      await fetchRecords();
      if (viewMode === 'my') await fetchMyRecords();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Sync failed';
      setError(msg);
      setSyncResult(null);
    } finally {
      setSyncing(false);
    }
  };

  const fetchCompOffSummary = async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true;
    const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id;
    const currentUserEmployeeId = user?.employee?.id;
    const targetEmployeeId =
      canChooseEmployeeCompOffSummary && viewMode === 'team' && selectedEmployeeId
        ? selectedEmployeeId
        : currentUserEmployeeId;
    if (!organizationId) {
      setCompOffSummary(null);
      return;
    }
    try {
      if (!silent) setLoadingCompOffSummary(true);
      const summary = await attendanceService.getCompOffSummary(organizationId, targetEmployeeId || undefined);
      setCompOffSummary(summary);
    } catch (err: any) {
      if (!silent) {
        const msg = err.response?.data?.message || err.message || 'Failed to load excess time summary';
        setCompOffMessage({ type: 'error', text: msg });
      }
      setCompOffSummary(null);
    } finally {
      if (!silent) setLoadingCompOffSummary(false);
    }
  };

  // Fetch approved comp-off requests for calendar overlay
  const fetchApprovedCompOffs = async () => {
    const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id;
    if (!organizationId) {
      setApprovedCompOffs([]);
      return;
    }
    const targetEmpId =
      viewMode === 'my' || !canViewTeamAttendance
        ? user?.employee?.id
        : selectedEmployeeId || user?.employee?.id;
    try {
      const res = await attendanceService.getCompOffRequests({
        organizationId,
        employeeId: targetEmpId,
        status: 'APPROVED',
        page: 1,
        limit: 500,
      });
      setApprovedCompOffs(res.requests || []);
    } catch {
      setApprovedCompOffs([]);
    }
  };

  const fetchCalendarLeaveRequests = async () => {
    const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id;
    if (!organizationId) {
      setCalendarLeaveRequests([]);
      return;
    }
    const targetEmpId =
      viewMode === 'my' || !canViewTeamAttendance
        ? user?.employee?.id
        : selectedEmployeeId || user?.employee?.id;
    if (!targetEmpId) {
      setCalendarLeaveRequests([]);
      return;
    }

    const dateFrom = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const dateTo = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
    try {
      const response = await api.get('/leaves/requests', {
        params: {
          organizationId,
          employeeId: targetEmpId,
          dateFrom,
          dateTo,
          page: 1,
          limit: 500,
          sortBy: 'appliedOn',
          sortOrder: 'desc',
        },
      });
      const requests = response.data?.data?.leaveRequests || response.data?.data?.requests || [];
      setCalendarLeaveRequests(requests);
    } catch {
      setCalendarLeaveRequests([]);
    }
  };

  const approvedHalfDayLeaveDateSet = new Set<string>();
  (calendarLeaveRequests || []).forEach((lr) => {
    if ((lr.status || '').toUpperCase() !== 'APPROVED') return;
    const totalDays = Number(lr.totalDays);
    if (!(totalDays > 0 && totalDays < 1)) return;
    const start = new Date(lr.startDate);
    const end = new Date(lr.endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    const cursor = new Date(start);
    while (cursor <= end) {
      approvedHalfDayLeaveDateSet.add(format(cursor, 'yyyy-MM-dd'));
      cursor.setDate(cursor.getDate() + 1);
    }
  });

  const showingSelectedEmployeeSummary =
    canChooseEmployeeCompOffSummary && viewMode === 'team' && !!selectedEmployeeId;
  const isOwnCompOffSummary = !showingSelectedEmployeeSummary || selectedEmployeeId === user?.employee?.id;

  const handleOpenCompOffModal = () => {
    setCompOffMessage(null);
    setCompOffReason('');
    setShowCompOffModal(true);
  };

  const handleCreateCompOffRequest = async () => {
    const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id;
    if (!organizationId) {
      setCompOffMessage({ type: 'error', text: 'Organization not found.' });
      return;
    }
    if ((compOffSummary?.eligibleCompOffDays ?? 0) <= 0) {
      const minMinutes = compOffSummary?.halfDayMinutes ?? 240;
      setCompOffMessage({ type: 'error', text: `No eligible conversion. Minimum ${minMinutes} minutes must be available in a valid bucket.` });
      return;
    }
    try {
      setSubmittingCompOff(true);
      setCompOffMessage(null);
      await attendanceService.convertExcessTimeToCompOff(organizationId, compOffReason.trim() || undefined);
      setShowCompOffModal(false);
      setCompOffMessage({ type: 'success', text: 'Excess Time conversion request submitted and sent for approval.' });
      await fetchCompOffSummary();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to submit Excess Time conversion request';
      setCompOffMessage({ type: 'error', text: msg });
    } finally {
      setSubmittingCompOff(false);
    }
  };

  const openSyncModal = () => {
    setSyncFromDate(format(startOfMonth(currentMonth), 'yyyy-MM-dd'));
    setSyncToDate(format(endOfMonth(currentMonth), 'yyyy-MM-dd'));
    setSyncResult(null);
    setShowSyncModal(true);
  };

  // Refresh policy + records so calendar/table shows according to current Attendance Policy (e.g. after you change "Consider Early Going as Shortfall").
  const handleRefreshPolicyAndRecords = async () => {
    setRefreshing(true);
    try {
      await fetchLateEarlyPolicy();
      await fetchRecords();
      await fetchPunches();
      if (viewMode === 'my' || !canViewTeamAttendance) await fetchMyRecords();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader
        title="Attendance Management"
        subtitle={organizationName ? `Organization: ${organizationName}` : undefined}
        onLogout={handleLogout}
      />

      {/* Main Content */}
      <main className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {showLeaveAppliedBanner && (
          <div className="mb-4 flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            <span>
              Leave request submitted. It is shown as Pending in calendar now; once manager approves, status updates to Approved automatically.
            </span>
            <button type="button" onClick={() => setShowLeaveAppliedBanner(false)} className="ml-2 shrink-0 rounded p-1 hover:bg-green-100" aria-label="Dismiss">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        )}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Manual punch (for testing): select any date, multiple In/Out per day */}
        {canManualPunch && (
          <div className="bg-white rounded-lg shadow p-6 mb-8 border border-amber-200">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Manual punch (for testing)</h2>
            <p className="text-sm text-gray-600 mb-4">
              Select a date (including previous dates) and time, then add a punch. Multiple In/Out in a single date are allowed — each click toggles In → Out → In for that date.
            </p>
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={manualPunchDate}
                  onChange={(e) => setManualPunchDate(e.target.value)}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                <input
                  type="time"
                  value={manualPunchTime}
                  onChange={(e) => setManualPunchTime(e.target.value)}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                />
              </div>
              {canManualPunch && manualPunchEmployeeList.length > 0 && (
                <div className="min-w-[200px]">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
                  <select
                    value={manualPunchEmployeeId || user?.employee?.id || ''}
                    onChange={(e) => setManualPunchEmployeeId(e.target.value === (user?.employee?.id || '') ? null : e.target.value || null)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                  >
                    <option value={user?.employee?.id || ''}>Myself</option>
                    {manualPunchEmployeeList.map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName} ({emp.employeeCode})</option>
                    ))}
                  </select>
                </div>
              )}
              <button
                onClick={handleManualPunch}
                disabled={manualPunchSubmitting}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-amber-500 text-white hover:bg-amber-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {manualPunchSubmitting ? 'Adding...' : 'Add punch (In/Out)'}
              </button>
              <button
                onClick={() => navigate('/attendance/face')}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition"
              >
                Face Punch
              </button>
            </div>
            {manualPunchMessage && (
              <p className={`mt-3 text-sm ${manualPunchMessage.type === 'success' ? 'text-green-700' : 'text-red-700'}`}>
                {manualPunchMessage.text}
              </p>
            )}
          </div>
        )}

        {/* Attendance Records — badges (Late, Early going, Shortfall, D) follow current Attendance Policy; use Refresh after changing policy. */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">
                {canViewTeamAttendance 
                  ? (viewMode === 'team' 
                      ? (isHRForCalendar && selectedEmployeeId
                          ? (() => {
                              const emp = employeeList.find((e) => e.id === selectedEmployeeId);
                              return emp ? `Attendance: ${emp.firstName} ${emp.lastName}` : 'Attendance';
                            })()
                          : isManager ? 'Team Attendance' : 'All Employees Attendance')
                      : 'My Attendance Records')
                  : 'My Attendance Records'}
              </h2>
              <div className="flex items-center space-x-4">
                <button
                  onClick={handleRefreshPolicyAndRecords}
                  disabled={refreshing}
                  title="Reload policy and records so Late/Shortfall/Early badges match current Attendance Policy (e.g. after changing Consider Early Going as Shortfall)"
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-200 text-gray-800 hover:bg-gray-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {refreshing ? 'Refreshing...' : '🔄 Refresh'}
                </button>
                {canSyncBiometric && (
                  <button
                    onClick={openSyncModal}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-orange-500 text-white hover:bg-orange-600 transition"
                  >
                    Sync eSSL
                  </button>
                )}
                {/* View Toggle: Table or Calendar */}
                <div className="flex bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setDisplayMode('table')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                      displayMode === 'table'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    📋 Table
                  </button>
                  <button
                    onClick={() => setDisplayMode('calendar')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                      displayMode === 'calendar'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    📅 Calendar
                  </button>
                </div>
                {canViewTeamAttendance && (
                  <>
                    <div className="flex bg-gray-100 rounded-lg p-1">
                      <button
                        onClick={() => setViewMode('team')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                          viewMode === 'team'
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        {isManager ? '👥 Team' : '👥 All Employees'}
                      </button>
                      <button
                        onClick={() => setViewMode('my')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                          viewMode === 'my'
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        👤 My Records
                      </button>
                    </div>
                    {viewMode === 'team' && !isHRForCalendar && (
                      <span className="text-sm text-gray-600 bg-blue-50 px-3 py-1 rounded-full">
                        📊 Viewing your team members
                      </span>
                    )}
                {viewMode === 'team' && isHRForCalendar && (
                      <span className="text-sm text-gray-600 bg-amber-50 px-3 py-1 rounded-full">
                        Select one employee below to view attendance
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* HR-only: searchable employee dropdown (calendar shows only after selection) */}
          {isHRForCalendar && viewMode === 'team' && (
            <div className="px-6 pb-4 border-b border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">Employee</label>
              <div className="relative max-w-md" ref={employeeDropdownRef}>
                <input
                  type="text"
                  placeholder="Search by name or code..."
                  value={selectedEmployeeId
                    ? (() => {
                        const emp = employeeList.find((e) => e.id === selectedEmployeeId);
                        return emp ? `${emp.firstName} ${emp.lastName} (${emp.employeeCode})` : '';
                      })()
                    : employeeSearch}
                  readOnly={!!selectedEmployeeId}
                  onChange={(e) => {
                    if (selectedEmployeeId) return;
                    setEmployeeSearch(e.target.value);
                    setEmployeeDropdownOpen(true);
                  }}
                  onFocus={() => !selectedEmployeeId && setEmployeeDropdownOpen(true)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 pr-10 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (selectedEmployeeId) {
                      setSelectedEmployeeId(null);
                      setEmployeeSearch('');
                      setEmployeeDropdownOpen(true);
                    } else {
                      setEmployeeDropdownOpen(!employeeDropdownOpen);
                    }
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                  title={selectedEmployeeId ? 'Clear selection' : 'Open list'}
                >
                  {selectedEmployeeId ? '✕' : '▼'}
                </button>
                {employeeDropdownOpen && (
                  <ul className="absolute z-10 mt-1 w-full max-h-60 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg py-1">
                    {loadingEmployees ? (
                      <li className="px-3 py-2 text-sm text-gray-500">Loading...</li>
                    ) : (
                      (() => {
                        const q = employeeSearch.trim().toLowerCase();
                        const filtered = q
                          ? employeeList.filter(
                              (e) =>
                                e.firstName?.toLowerCase().includes(q) ||
                                e.lastName?.toLowerCase().includes(q) ||
                                e.employeeCode?.toLowerCase().includes(q)
                            )
                          : employeeList;
                        return filtered.length === 0 ? (
                          <li className="px-3 py-2 text-sm text-gray-500">No employees found</li>
                        ) : (
                          filtered.map((emp) => (
                            <li
                              key={emp.id}
                              onClick={() => {
                                setSelectedEmployeeId(emp.id);
                                setEmployeeSearch('');
                                setEmployeeDropdownOpen(false);
                              }}
                              className="px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 text-gray-900"
                            >
                              {emp.firstName} {emp.lastName} <span className="text-gray-500">({emp.employeeCode})</span>
                            </li>
                          ))
                        );
                      })()
                    )}
                  </ul>
                )}
              </div>
              {!selectedEmployeeId && (
                <p className="mt-2 text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
                  Select an employee from the dropdown above to view their attendance calendar.
                </p>
              )}
            </div>
          )}

          {isHRForCalendar && viewMode === 'team' && !selectedEmployeeId ? (
            <div className="p-12 text-center text-gray-600">
              <p className="text-lg font-medium">Select an employee above to view their attendance calendar.</p>
              <p className="text-sm mt-2">Use the searchable dropdown to find an employee by name or code.</p>
            </div>
          ) : loading || (viewMode === 'my' && loadingMyRecords) ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : displayMode === 'calendar' ? (
            <div className="flex flex-1 min-h-0">
              <div className="flex-1 min-w-0 overflow-auto">
                <AttendanceCalendarView
                  records={viewMode === 'my' && myRecords.length > 0 ? myRecords : records}
                  punches={punches}
                  currentMonth={currentMonth}
                  onMonthChange={setCurrentMonth}
                  employeeId={viewMode === 'my' || !canViewTeamAttendance ? user?.employee?.id : (selectedEmployeeId || user?.employee?.id)}
                  organizationId={user?.employee?.organizationId || user?.employee?.organization?.id}
                  hideEmployeeName={viewMode === 'my' || !canViewTeamAttendance}
                  lateEarlyPolicy={lateEarlyPolicy}
                  approvedCompOffs={approvedCompOffs}
                  leaveRequests={calendarLeaveRequests}
                />
              </div>
              <MonthlyDetailsSidebar
                organizationId={user?.employee?.organizationId || user?.employee?.organization?.id}
                employeeId={viewMode === 'my' || !canViewTeamAttendance ? user?.employee?.id : (selectedEmployeeId || user?.employee?.id)}
                year={currentMonth.getFullYear()}
                month={currentMonth.getMonth() + 1}
              />
            </div>
          ) : (viewMode === 'my' ? myRecords : records).length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {viewMode === 'my' 
                ? 'No attendance records found for you' 
                : 'No attendance records found'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Employee
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Check In
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Check Out
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Work Hours
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      L / EG / D / OT
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Overtime
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(viewMode === 'my' ? myRecords : records).map((record) => (
                    <tr key={record.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(record.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.employee.firstName} {record.employee.lastName}
                        <br />
                        <span className="text-gray-500 text-xs">{record.employee.employeeCode}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.checkIn
                          ? new Date(record.checkIn).toLocaleTimeString()
                          : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.checkOut
                          ? new Date(record.checkOut).toLocaleTimeString()
                          : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            ((record.status === 'LEAVE' && record.checkIn && record.checkOut) ? 'PRESENT' : record.status) === 'PRESENT'
                              ? 'bg-green-100 text-green-800'
                              : ((record.status === 'LEAVE' && record.checkIn && record.checkOut) ? 'PRESENT' : record.status) === 'ABSENT'
                              ? 'bg-red-100 text-red-800'
                              : ((record.status === 'LEAVE' && record.checkIn && record.checkOut) ? 'PRESENT' : record.status) === 'LEAVE'
                              ? 'bg-purple-100 text-purple-800'
                              : ((record.status === 'LEAVE' && record.checkIn && record.checkOut) ? 'PRESENT' : record.status) === 'HOLIDAY'
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {(() => {
                            const effectiveStatus =
                              record.status === 'LEAVE' && record.checkIn && record.checkOut ? 'PRESENT' : record.status;
                            return effectiveStatus === 'PRESENT' && record.isDeviation
                              ? 'Present (with deviation)'
                              : effectiveStatus;
                          })()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {(() => {
                          const shiftT = record.shift ?? null;
                          const recordDateKey = format(new Date(record.date), 'yyyy-MM-dd');
                          const hasApprovedHalfDayLeave = approvedHalfDayLeaveDateSet.has(recordDateKey);
                          const lateM = getLateMinutesFallback(record, shiftT, lateEarlyPolicy);
                          const earlyMRaw = getEarlyMinutes(record, shiftT, lateEarlyPolicy);
                          const earlyM = hasApprovedHalfDayLeave ? 0 : earlyMRaw;
                          const breakExcessM = getBreakExcessMinutes(record, shiftT, lateEarlyPolicy);
                          const { showShortfall, shortfallMinutes } = getDisplayShortfall(record, shiftT, lateEarlyPolicy, lateM, earlyM, breakExcessM);
                          const excessStayMins = getExcessStayMinutes(record, shiftT, lateEarlyPolicy);
                          const earlyComingMins = getEarlyComingMinutes(record, shiftT);
                          const showLate = ((record.lateMinutes ?? 0) > 0) || record.isLate || (lateM ?? 0) > 0;
                          const showEarly = !hasApprovedHalfDayLeave && (((record.earlyMinutes ?? 0) > 0) || record.isEarly || (earlyM ?? 0) > 0);
                          const forceShortfallFromWorkedLeave =
                            record.status === 'LEAVE' &&
                            !!record.checkIn &&
                            !!record.checkOut &&
                            (record.earlyMinutes ?? earlyM ?? 0) > 0;
                          const showDeviation = !!record.isDeviation || showShortfall || forceShortfallFromWorkedLeave;
                          const minOtMins = getMinOTMinutes(lateEarlyPolicy);
                          const otMinutes = record.otMinutes ?? 0;
                          const showOt = otMinutes > 0 && otMinutes >= minOtMins;
                          const showExcessStay = excessStayMins > 0;
                          const showEarlyComing = earlyComingMins > 0;
                          const showIndicators =
                            showLate || showEarly || showDeviation || showOt || showExcessStay || showEarlyComing || forceShortfallFromWorkedLeave;
                          return showIndicators ? (
                          <div className="flex flex-wrap gap-1">
                            {showLate && (
                              <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800">
                                Late: {(record.lateMinutes ?? lateM ?? 0)} min
                              </span>
                            )}
                            {showEarly && (
                              <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-800">Early going: {(record.earlyMinutes ?? earlyM ?? 0)} min</span>
                            )}
                            {showDeviation && (
                              <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800" title={record.deviationReason ?? (showShortfall ? 'Shortfall' : 'Deviation')}>D</span>
                            )}
                            {((record.isDeviation && (record.deviationReason ?? '').includes('Shortfall')) || showShortfall || forceShortfallFromWorkedLeave) && (
                              <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-800">
                                {record.isDeviation && (record.deviationReason ?? '').includes('Shortfall') && ((record.lateMinutes ?? 0) + (record.earlyMinutes ?? 0)) > 0
                                  ? `Shortfall: ${(record.lateMinutes ?? 0) + (record.earlyMinutes ?? 0)} min`
                                  : `Shortfall: ${shortfallMinutes > 0 ? shortfallMinutes : (record.earlyMinutes ?? earlyM ?? 0)} min`}
                              </span>
                            )}
                            {showOt && <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800" title="Overtime">OT {formatWorkHoursAsHHMM(otMinutes / 60)}</span>}
                            {showExcessStay && <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-800" title="Time stayed after OT start threshold">Excess Stay {formatWorkHoursAsHHMM(excessStayMins / 60)}</span>}
                            {showEarlyComing && <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-cyan-100 text-cyan-800" title="Time arrived before shift start">Early Coming {formatWorkHoursAsHHMM(earlyComingMins / 60)}</span>}
                          </div>
                          ) : '-';
                        })()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.workHours ? `${Number(record.workHours).toFixed(2)} hrs` : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.overtimeHours ? `${Number(record.overtimeHours).toFixed(2)} hrs` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Sync eSSL Biometric Modal */}
        {showCompOffModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCompOffModal(false)}>
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Convert to Comp Off</h3>
              <div className="space-y-4">
                <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm text-indigo-900">
                  <p>You have {compOffSummary?.availableExcessMinutesForRequest ?? 0} minutes.</p>
                  <p>Eligible: {compOffSummary?.eligibleCompOffDays ?? 0} day(s).</p>
                  <p>Remaining: {compOffSummary?.remainingAfterEligibleConversionMinutes ?? 0} minutes.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Remarks (optional)</label>
                  <textarea
                    value={compOffReason}
                    onChange={(e) => setCompOffReason(e.target.value)}
                    rows={3}
                    maxLength={500}
                    className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-black"
                    placeholder="Add reason/notes"
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCompOffModal(false)}
                  className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateCompOffRequest}
                  disabled={submittingCompOff}
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                  {submittingCompOff ? 'Submitting...' : 'Proceed'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showSyncModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowSyncModal(false)}>
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Sync eSSL Biometric</h3>
              <p className="text-sm text-gray-600 mb-4">
                Pull attendance from eSSL Cloud for the selected date range. Employee codes in eSSL must match HRMS employee codes.
              </p>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">From date</label>
                  <input
                    type="date"
                    value={syncFromDate}
                    onChange={(e) => setSyncFromDate(e.target.value)}
                    className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-black"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">To date</label>
                  <input
                    type="date"
                    value={syncToDate}
                    onChange={(e) => setSyncToDate(e.target.value)}
                    className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-black"
                  />
                </div>
              </div>
              {syncResult && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm">
                  <p className="font-medium text-gray-900">Synced: {syncResult.synced} (created: {syncResult.created}, updated: {syncResult.updated})</p>
                  {syncResult.skipped > 0 && <p className="text-gray-600">Skipped: {syncResult.skipped}</p>}
                  {syncResult.errors.length > 0 && (
                    <ul className="mt-2 text-amber-700 text-xs list-disc list-inside">
                      {syncResult.errors.slice(0, 5).map((e, i) => (
                        <li key={i}>{e.employeeCode} ({e.date}): {e.message}</li>
                      ))}
                      {syncResult.errors.length > 5 && <li>… and {syncResult.errors.length - 5} more</li>}
                    </ul>
                  )}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSyncModal(false)}
                  className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleSyncBiometric}
                  disabled={syncing}
                  className="px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 disabled:opacity-50"
                >
                  {syncing ? 'Syncing...' : 'Sync'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AttendancePage;
