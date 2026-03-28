/**
 * Apply Event page – supports Leave, Onduty and Permission event types.
 * Both flows create a LeaveRequest via /leaves/requests so manager approval,
 * calendar badges, and monthly details stay aligned in one pipeline.
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import attendanceComponentService from '../services/attendanceComponent.service';
import type { AttendanceComponent } from '../services/attendanceComponent.service';
import shiftService from '../services/shift.service';
import AppHeader from '../components/layout/AppHeader';
import { getModulePermissions } from '../config/configurator-module-mapping';

type DurationOption = 'FULL_DAY' | 'FIRST_HALF' | 'SECOND_HALF';

const DURATION_LABELS: Record<DurationOption, string> = {
  FULL_DAY: 'Full Day',
  FIRST_HALF: 'First Half',
  SECOND_HALF: 'Second Half',
};

interface LeaveType {
  id: string;
  name: string;
  code: string;
}

interface LeaveApplyHint {
  leaveTypeId: string;
  openingBalance: number;
  usedBalance: number;
  availableBalance: number;
  fixedDurationEnforced: boolean;
  fixedDays: number | null;
  recommendedFromDate: string;
  recommendedEndDate: string;
  allowWeekOffSelection: boolean;
  allowHolidaySelection: boolean;
}

function normalizeKey(value: string | null | undefined): string {
  return (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Leave/Onduty/Permission attendance components for the Type dropdown */
function getEventComponents(components: AttendanceComponent[]): AttendanceComponent[] {
  return components.filter((c) =>
    c.eventCategory === 'Leave' || c.eventCategory === 'Permission' || c.eventCategory === 'Onduty'
  );
}

/** Filter to only components that appear in monthly details leave rows (by name match) */
function filterByMonthlyDetailsLeaves(
  components: AttendanceComponent[],
  monthlyLeaveNames: string[]
): AttendanceComponent[] {
  if (monthlyLeaveNames.length === 0) return components;
  const namesLower = new Set(monthlyLeaveNames.map((n) => n.toLowerCase().trim()));
  return components.filter((c) => {
    const en = (c.eventName || '').toLowerCase().trim();
    const sn = (c.shortName || '').toLowerCase().trim();
    return (en && namesLower.has(en)) || (sn && namesLower.has(sn));
  });
}

/** Fallback: resolve leave type by matching eventName/shortName to leave type name/code */
function resolveLeaveTypeIdFromComponent(
  leaveTypes: LeaveType[],
  component: AttendanceComponent | null
): string | null {
  if (!component) return null;
  const eventNameKey = normalizeKey(component.eventName);
  const shortNameKey = normalizeKey(component.shortName);
  if (!eventNameKey && !shortNameKey) return null;

  const match = leaveTypes.find((lt) => {
    const n = normalizeKey(lt.name);
    const c = normalizeKey(lt.code);
    const exact =
      (eventNameKey && (n === eventNameKey || c === eventNameKey)) ||
      (shortNameKey && (c === shortNameKey || n === shortNameKey));
    if (exact) return true;

    // Fuzzy support for naming differences: "Onduty" vs "On Duty", etc.
    return (
      (eventNameKey && n && (eventNameKey.includes(n) || n.includes(eventNameKey))) ||
      (eventNameKey && c && (eventNameKey.includes(c) || c.includes(eventNameKey))) ||
      (shortNameKey && n && (shortNameKey.includes(n) || n.includes(shortNameKey))) ||
      (shortNameKey && c && (shortNameKey.includes(c) || c.includes(shortNameKey)))
    );
  });
  return match?.id ?? null;
}

interface MonthlyDetailsState {
  employeeId?: string;
  year?: number;
  month?: number;
  applyTab?: 'Leave' | 'Permission' | 'Onduty';
  employeeName?: string;
}

function isOndutyLikeComponent(component: AttendanceComponent | null): boolean {
  if (!component) return false;
  const categoryKey = (component.eventCategory || '').toLowerCase().replace(/\s+/g, '');
  if (categoryKey === 'onduty') return true;
  const label = `${component.eventName || ''} ${component.shortName || ''}`.toLowerCase();
  return (
    label.includes('on duty') ||
    label.includes('onduty') ||
    label.includes('work from home') ||
    /\bwfh\b/.test(label)
  );
}

function isWfhLikeComponent(component: AttendanceComponent | null): boolean {
  if (!component) return false;
  const key = normalizeKey(`${component.eventName || ''}${component.shortName || ''}`);
  return key.includes('workfromhome') || key.includes('wfh');
}

function isWfhLikeLeaveType(leaveType: LeaveType | undefined | null): boolean {
  if (!leaveType) return false;
  const key = normalizeKey(`${leaveType.name || ''}${leaveType.code || ''}`);
  return key.includes('workfromhome') || key === 'wfh';
}

function isOndutyLikeLeaveType(leaveType: LeaveType | undefined | null): boolean {
  if (!leaveType) return false;
  const key = normalizeKey(`${leaveType.name || ''}${leaveType.code || ''}`);
  return key.includes('onduty') || key.includes('ondutyleave');
}

type PermissionWindow = {
  startMinutes: number;
  endMinutes: number;
};

const DEFAULT_PERMISSION_WINDOW: PermissionWindow = {
  startMinutes: 9 * 60,
  endMinutes: 18 * 60,
};

const parseHHMMToMinutes = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const parts = value.split(':').map(Number);
  if (parts.length < 2) return null;
  const [h, m] = parts;
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
};

const formatMinutesToHHMM = (totalMinutes: number): string => {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export default function ApplyEventPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;
  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id;

  const state = (location.state as MonthlyDetailsState | null) || {};
  const pageMode: 'Leave' | 'Permission' | 'Onduty' =
    state.applyTab === 'Permission' ? 'Permission' : state.applyTab === 'Onduty' ? 'Onduty' : 'Leave';
  const now = new Date();
  const contextEmployeeId = state.employeeId || user?.employee?.id;
  const contextYear = state.year ?? now.getFullYear();
  const contextMonth = state.month ?? now.getMonth() + 1;

  // HR/Manager mode: when HR/Admin/Manager applies leave on behalf of another employee
  const leavePerms = getModulePermissions('/leave');
  const isHR = leavePerms.can_edit;
  const isManager = !isHR && getModulePermissions('/event/approvals').can_view;
  const isApplyingForOther = (isHR || isManager) && !!state.employeeId && state.employeeId !== user?.employee?.id;
  const targetEmployeeId = isApplyingForOther ? state.employeeId : undefined;
  const targetEmployeeName = state.employeeName;

  const [componentsRaw, setComponentsRaw] = useState<AttendanceComponent[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  /** component id -> leave type id from backend mapping */
  const [componentToLeaveTypeId, setComponentToLeaveTypeId] = useState<Record<string, string>>({});
  /** Leave/Permission names from monthly details – used to filter Type dropdown */
  const [monthlyDetailsLeaveNames, setMonthlyDetailsLeaveNames] = useState<string[]>([]);
  const [monthlyDetailsOndutyNames, setMonthlyDetailsOndutyNames] = useState<string[]>([]);
  const [monthlyDetailsPermissionNames, setMonthlyDetailsPermissionNames] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [selectedComponentId, setSelectedComponentId] = useState('');
  const [selectedLeaveTypeId, setSelectedLeaveTypeId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [fromDuration, setFromDuration] = useState<DurationOption>('FULL_DAY');
  const [toDuration, setToDuration] = useState<DurationOption>('FULL_DAY');
  const [entryDate, setEntryDate] = useState('');
  const [fromTime, setFromTime] = useState('');
  const [toTime, setToTime] = useState('');
  const [reason, setReason] = useState('');
  const [ondutyHourlyEnabled, setOndutyHourlyEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leaveHint, setLeaveHint] = useState<LeaveApplyHint | null>(null);
  const [defaultPermissionWindow, setDefaultPermissionWindow] = useState<PermissionWindow>(
    DEFAULT_PERMISSION_WINDOW
  );
  const [permissionWindow, setPermissionWindow] = useState<PermissionWindow>(
    DEFAULT_PERMISSION_WINDOW
  );

  const typeSelected = !!selectedComponentId;

  const eventComponents = useMemo(() => {
    const all = getEventComponents(componentsRaw);
    if (pageMode === 'Leave') {
      return filterByMonthlyDetailsLeaves(
        all.filter((c) => c.eventCategory === 'Leave'),
        monthlyDetailsLeaveNames
      );
    }
    if (pageMode === 'Onduty') {
      return filterByMonthlyDetailsLeaves(
        all.filter((c) => isOndutyLikeComponent(c)),
        monthlyDetailsOndutyNames
      );
    }
    return filterByMonthlyDetailsLeaves(
      all.filter((c) => c.eventCategory === 'Permission'),
      monthlyDetailsPermissionNames
    );
  }, [componentsRaw, monthlyDetailsLeaveNames, monthlyDetailsOndutyNames, monthlyDetailsPermissionNames, pageMode]);

  const selectedComponent = useMemo(
    () => eventComponents.find((c) => c.id === selectedComponentId) ?? null,
    [eventComponents, selectedComponentId]
  );
  const isPermissionType = selectedComponent?.eventCategory === 'Permission' || pageMode === 'Permission';
  const isOndutyType = isOndutyLikeComponent(selectedComponent) || pageMode === 'Onduty';
  const requiresTimeWindow = isPermissionType || (isOndutyType && ondutyHourlyEnabled);
  const selectedLeaveTypeIdForHint = useMemo(() => {
    if (!selectedComponentId || isPermissionType || isOndutyType) return null;
    const fromMapping = componentToLeaveTypeId[selectedComponentId];
    const fromNameMatch = resolveLeaveTypeIdFromComponent(leaveTypes, selectedComponent);
    return fromMapping || fromNameMatch || selectedLeaveTypeId || leaveTypes[0]?.id || null;
  }, [
    selectedComponentId,
    isPermissionType,
    isOndutyType,
    componentToLeaveTypeId,
    leaveTypes,
    selectedComponent,
    selectedLeaveTypeId,
  ]);
  const fixedDurationEnforced = !!leaveHint?.fixedDurationEnforced;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  useEffect(() => {
    if (!organizationId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      attendanceComponentService.getAll({ organizationId, page: 1, limit: 500 }),
      api.get<{ data: { leaveTypes?: LeaveType[] } }>('/leaves/types', {
        params: { organizationId, isActive: true },
      }),
      api.get<{ data: { mapping?: Record<string, string> } }>('/attendance-components/leave-type-mapping', {
        params: { organizationId },
      }),
      shiftService.getAll({
        organizationId,
        page: 1,
        limit: 1000,
        isActive: true,
      }),
    ])
      .then(([componentsRes, leaveTypesRes, mappingRes, shiftsRes]) => {
        if (cancelled) return;
        const comps = componentsRes.components ?? [];
        setComponentsRaw(comps);
        setLeaveTypes(leaveTypesRes.data?.data?.leaveTypes ?? []);
        setComponentToLeaveTypeId(mappingRes.data?.data?.mapping ?? {});

        const shifts = shiftsRes?.shifts ?? [];
        const preferredShift =
          shifts.find((s) => (s.name || '').toLowerCase().includes('general morning')) ||
          shifts.find((s) => (s.name || '').toLowerCase().includes('general')) ||
          shifts[0];
        const start = parseHHMMToMinutes(preferredShift?.startTime);
        const end = parseHHMMToMinutes(preferredShift?.endTime);
        const resolvedWindow =
          start != null && end != null && end > start
            ? { startMinutes: start, endMinutes: end }
            : DEFAULT_PERMISSION_WINDOW;
        setDefaultPermissionWindow(resolvedWindow);
        setPermissionWindow(resolvedWindow);
      })
      .catch((err: any) => {
        if (!cancelled) {
          setError(err?.response?.data?.message || 'Failed to load data for Apply Event.');
          setComponentsRaw([]);
          setLeaveTypes([]);
          setComponentToLeaveTypeId({});
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  useEffect(() => {
    if (!requiresTimeWindow || !organizationId || !contextEmployeeId || !entryDate) {
      setPermissionWindow(defaultPermissionWindow);
      return;
    }

    let cancelled = false;
    api
      .get('/attendance/records', {
        params: {
          page: 1,
          limit: 50,
          organizationId,
          employeeId: contextEmployeeId,
          startDate: entryDate,
          endDate: entryDate,
        },
      })
      .then((res) => {
        if (cancelled) return;
        const records = res?.data?.data?.records ?? [];
        const withShift = records.find(
          (r: any) =>
            r?.shift?.startTime &&
            r?.shift?.endTime
        );
        const start = parseHHMMToMinutes(withShift?.shift?.startTime);
        const end = parseHHMMToMinutes(withShift?.shift?.endTime);
        if (start != null && end != null && end > start) {
          setPermissionWindow({ startMinutes: start, endMinutes: end });
        } else {
          setPermissionWindow(defaultPermissionWindow);
        }
      })
      .catch(() => {
        if (!cancelled) setPermissionWindow(defaultPermissionWindow);
      });

    return () => {
      cancelled = true;
    };
  }, [requiresTimeWindow, organizationId, contextEmployeeId, entryDate, defaultPermissionWindow]);

  useEffect(() => {
    if (!organizationId || !contextEmployeeId) {
      setMonthlyDetailsLeaveNames([]);
      setMonthlyDetailsOndutyNames([]);
      setMonthlyDetailsPermissionNames([]);
      return;
    }
    let cancelled = false;
    api
      .get<{ data: { leave?: Array<{ name: string }>; onduty?: Array<{ name: string }>; permission?: Array<{ name: string }> } }>('/attendance/monthly-details', {
        params: { organizationId, employeeId: contextEmployeeId, year: contextYear, month: contextMonth },
      })
      .then((res) => {
        if (!cancelled && res.data?.data) {
          setMonthlyDetailsLeaveNames((res.data.data.leave || []).map((r) => r.name).filter(Boolean));
          setMonthlyDetailsOndutyNames((res.data.data.onduty || []).map((r) => r.name).filter(Boolean));
          setMonthlyDetailsPermissionNames((res.data.data.permission || []).map((r) => r.name).filter(Boolean));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMonthlyDetailsLeaveNames([]);
          setMonthlyDetailsOndutyNames([]);
          setMonthlyDetailsPermissionNames([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId, contextEmployeeId, contextYear, contextMonth]);

  useEffect(() => {
    if (selectedComponentId || eventComponents.length === 0) return;
    setSelectedComponentId(eventComponents[0].id);
  }, [selectedComponentId, eventComponents]);

  useEffect(() => {
    setSelectedLeaveTypeId('');
  }, [selectedComponentId]);

  useEffect(() => {
    if (!typeSelected || isPermissionType || isOndutyType || selectedLeaveTypeId || leaveTypes.length === 0) return;
    setSelectedLeaveTypeId(leaveTypes[0].id);
  }, [typeSelected, isPermissionType, isOndutyType, selectedComponent, selectedLeaveTypeId, leaveTypes]);

  useEffect(() => {
    if (!typeSelected || isPermissionType || isOndutyType || !selectedLeaveTypeIdForHint || !fromDate) {
      setLeaveHint(null);
      return;
    }
    let cancelled = false;
    api
      .get<{ data: LeaveApplyHint }>('/leaves/requests/apply-hint', {
        params: {
          leaveTypeId: selectedLeaveTypeIdForHint,
          startDate: fromDate,
          ...(isApplyingForOther && targetEmployeeId ? { targetEmployeeId } : {}),
        },
      })
      .then((res) => {
        if (cancelled) return;
        const hint = res.data?.data ?? null;
        setLeaveHint(hint);
        if (hint?.fixedDurationEnforced) {
          setFromDuration('FULL_DAY');
          setToDuration('FULL_DAY');
          if (hint.recommendedEndDate) {
            setToDate(hint.recommendedEndDate);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setLeaveHint(null);
      });
    return () => {
      cancelled = true;
    };
  }, [typeSelected, isPermissionType, isOndutyType, selectedLeaveTypeIdForHint, fromDate]);

  useEffect(() => {
    if (!isOndutyType) {
      setOndutyHourlyEnabled(false);
      return;
    }
    // Default hourly mode from selected component config; user can change it.
    setOndutyHourlyEnabled(!!selectedComponent?.allowHourly);
  }, [isOndutyType, selectedComponent?.id, selectedComponent?.allowHourly]);

  const handleCancel = () => {
    navigate('/attendance', { replace: true });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedComponentId) {
      setError('Please select a Type.');
      return;
    }
    if (requiresTimeWindow) {
      if (typeSelected && (!entryDate || !fromTime || !toTime || !reason.trim())) {
        setError('Entry Date, From Time, To Time and Reason are required.');
        return;
      }
    } else {
      if (typeSelected && (!fromDate || !toDate || !reason.trim())) {
        setError('From Date, To Date and Reason are required.');
        return;
      }
    }

    const permissionFallback = leaveTypes.find((lt) => {
      const key = `${lt.name || ''} ${lt.code || ''}`.toLowerCase();
      return key.includes('permission');
    })?.id;
    const selectedIsWfh = isWfhLikeComponent(selectedComponent);
    const mappedOndutyFallback = isOndutyType
      ? eventComponents
          .filter((c) => isOndutyLikeComponent(c))
          .map((c) => componentToLeaveTypeId[c.id])
          .filter((id): id is string => !!id)
          .find((id) => {
            const lt = leaveTypes.find((x) => x.id === id);
            const key = normalizeKey(`${lt?.name || ''} ${lt?.code || ''}`);
            if (!key) return false;
            if (selectedIsWfh) return key.includes('workfromhome') || key === 'wfh';
            return (
              (key.includes('onduty') || key.includes('ondutyleave')) &&
              !key.includes('workfromhome') &&
              key !== 'wfh'
            );
          })
      : undefined;
    const ondutyFallback = isOndutyType
      ? leaveTypes.find((lt) => {
          const key = normalizeKey(`${lt.name || ''} ${lt.code || ''}`);
          if (selectedIsWfh) {
            return key.includes('workfromhome') || key === 'wfh';
          }
          return (
            (key.includes('onduty') || key.includes('ondutyleave')) &&
            !key.includes('workfromhome') &&
            key !== 'wfh'
          );
        })?.id
      : undefined;

    // Resolve leave type id:
    // 1) explicit mapping (preferred)
    // 2) fallback name/code match for older data
    // 3) permission fallback (permission mode only)
    const fromMappingRaw = componentToLeaveTypeId[selectedComponentId];
    const fromNameMatchRaw = resolveLeaveTypeIdFromComponent(leaveTypes, selectedComponent);
    const fromMappingLeaveType = fromMappingRaw ? leaveTypes.find((lt) => lt.id === fromMappingRaw) : undefined;
    const fromNameMatchLeaveType = fromNameMatchRaw ? leaveTypes.find((lt) => lt.id === fromNameMatchRaw) : undefined;
    const fromMapping = isOndutyType
      ? (selectedIsWfh ? isWfhLikeLeaveType(fromMappingLeaveType) : isOndutyLikeLeaveType(fromMappingLeaveType))
        ? fromMappingRaw
        : undefined
      : fromMappingRaw;
    const fromNameMatch = isOndutyType
      ? (selectedIsWfh ? isWfhLikeLeaveType(fromNameMatchLeaveType) : isOndutyLikeLeaveType(fromNameMatchLeaveType))
        ? fromNameMatchRaw
        : undefined
      : fromNameMatchRaw;
    const leaveTypeIdForSubmit = isPermissionType
      ? fromMapping || fromNameMatch || permissionFallback
      : isOndutyType
        // Strict: Onduty must map only to Onduty/WFH leave type; never generic fallback like Comp Off.
        ? fromMapping || fromNameMatch || mappedOndutyFallback || ondutyFallback || leaveTypes[0]?.id
        : fromMapping || fromNameMatch;

    if (!leaveTypeIdForSubmit) {
      setError(
        isPermissionType
          ? 'Permission event is not mapped to a Leave Type. Please configure Event Mapping for Permission.'
          : isOndutyType
            ? 'On Duty type is not linked to an On Duty leave type. Map it in Event Configuration.'
            : 'This event type is not linked to any leave type. Map it in Event Configuration.'
      );
      return;
    }

    try {
      setSaving(true);

      let startDate = fromDate;
      let endDate = toDate;
      let totalDays: number | undefined;
      let submitReason = reason.trim();

      if (requiresTimeWindow) {
        const [fromH, fromM] = fromTime.split(':').map(Number);
        const [toH, toM] = toTime.split(':').map(Number);
        const startMinutes = fromH * 60 + fromM;
        const endMinutes = toH * 60 + toM;
        const allowedStart = permissionWindow.startMinutes;
        const allowedEnd = permissionWindow.endMinutes;

        if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) {
          setError('Please provide valid From/To time.');
          return;
        }
        if (endMinutes <= startMinutes) {
          setError('To Time should be greater than From Time.');
          return;
        }
        if (startMinutes < allowedStart || endMinutes > allowedEnd) {
          setError(
            `Permission can be applied only between ${formatMinutesToHHMM(allowedStart)} and ${formatMinutesToHHMM(allowedEnd)}.`
          );
          return;
        }

        const durationMinutes = endMinutes - startMinutes;
        if (durationMinutes > 120) {
          setError('Permission cannot exceed 2 hours (120 minutes) per request.');
          return;
        }
        const shiftWindowMinutes = Math.max(1, allowedEnd - allowedStart);
        totalDays = Number((durationMinutes / shiftWindowMinutes).toFixed(4));
        startDate = entryDate;
        endDate = entryDate;
        submitReason = isPermissionType
          ? `[Permission ${fromTime}-${toTime}] ${submitReason}`
          : submitReason;
      } else {
        const isSingleDay = fromDate === toDate;
        const isHalfDaySelection = fromDuration !== 'FULL_DAY' || toDuration !== 'FULL_DAY';
        totalDays = isSingleDay && isHalfDaySelection ? 0.5 : undefined;
        if (isSingleDay && isHalfDaySelection) {
          const halfLabel = fromDuration === 'FIRST_HALF' ? 'First Half'
                          : fromDuration === 'SECOND_HALF' ? 'Second Half'
                          : null;
          if (halfLabel) {
            submitReason = `[${halfLabel}] ${submitReason}`;
          }
        }
        if (fixedDurationEnforced && leaveHint?.fixedDays && leaveHint.fixedDays > 0) {
          endDate = leaveHint.recommendedEndDate;
          totalDays = leaveHint.fixedDays;
        }
      }

      if (isOndutyType) {
        const ondutyLabel = selectedComponent?.eventName || selectedComponent?.shortName || 'Onduty';
        if (!/^\[Onduty(?:\s+[^\]]+)?\]/i.test(submitReason)) {
          submitReason = `[Onduty ${ondutyLabel}] ${submitReason}`;
        }
      }

      const payload = {
        leaveTypeId: leaveTypeIdForSubmit,
        startDate,
        endDate,
        reason: submitReason,
        ...(totalDays != null ? { totalDays } : {}),
      };

      if (isApplyingForOther && targetEmployeeId) {
        await api.post('/leaves/hr-assign', { ...payload, targetEmployeeId });
      } else {
        await api.post('/leaves/requests', payload);
      }

      // After successful submit, go back to Attendance so sidebar can refresh;
      // AttendancePage listens to leaveApplied flag to show success banner.
      navigate('/attendance', { replace: true, state: { leaveApplied: true } });
    } catch (err: any) {
      if (err?.response?.data?.errors && Array.isArray(err.response.data.errors)) {
        const msg = err.response.data.errors
          .map((er: any) => `${er.field}: ${er.message}`)
          .join(', ');
        setError(msg);
      } else if (err?.response?.data?.message) {
        setError(err.response.data.message);
      } else if (err?.message) {
        setError(err.message);
      } else {
        setError('Failed to submit event request. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  const canSubmit =
    !!selectedComponentId &&
    (!typeSelected ||
      (requiresTimeWindow
        ? (entryDate && fromTime && toTime && reason.trim())
        : (fromDate && toDate && reason.trim())));

  if (!organizationId) {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
        <AppHeader
          title={pageMode === 'Permission' ? 'Apply Permission' : pageMode === 'Onduty' ? 'Apply On Duty' : 'Apply Event'}
          subtitle={organizationName ? `Organization: ${organizationName}` : undefined}
          onLogout={handleLogout}
        />
        <div className="flex-1 p-4">
          <p className="text-sm text-gray-600">Organization not found. Please go back to Attendance.</p>
          <button type="button" onClick={() => navigate('/attendance')} className="mt-2 text-blue-600 hover:underline">
            Back to Attendance
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader
        title={pageMode === 'Permission' ? 'Apply Permission' : pageMode === 'Onduty' ? 'Apply On Duty' : 'Apply Event'}
        subtitle={organizationName ? `Organization: ${organizationName}` : undefined}
        onLogout={handleLogout}
      />

      <div className="flex-1 overflow-auto p-4">
        <form onSubmit={handleSave} className="mx-auto flex w-full max-w-2xl flex-col rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          {isApplyingForOther && (
            <div className="mb-4 rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-sm text-blue-800">
              Assigning on behalf of <strong>{targetEmployeeName || targetEmployeeId}</strong> — will be auto-approved ({isHR ? 'HR Direct Assignment' : 'Manager Direct Assignment'})
            </div>
          )}
          {error && (
            <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          {/* Type field – always visible */}
          <div className="mb-6">
            <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">
              Type <span className="text-red-500">*</span>
            </label>
            <div className="mt-1 relative flex items-center gap-1 rounded-md border border-gray-300 bg-white shadow-sm focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500">
              <select
                id="type"
                value={selectedComponentId}
                onChange={(e) => setSelectedComponentId(e.target.value)}
                required
                disabled={loading || pageMode === 'Permission'}
                className="flex-1 min-w-0 py-2 pl-3 pr-8 bg-transparent text-sm text-gray-900 focus:outline-none disabled:bg-gray-100 disabled:text-gray-500 border-0 rounded-md"
              >
                <option value="">: Type</option>
                {eventComponents.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.eventName || c.shortName || c.id}
                  </option>
                ))}
              </select>
              {selectedComponentId && pageMode !== 'Permission' && (
                <button
                  type="button"
                  onClick={() => setSelectedComponentId('')}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
                  aria-label="Clear type"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              <span className="pointer-events-none pr-2 text-gray-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </div>
          </div>

          {/* From Date, To Date, Reason – only after Type is selected */}
          {typeSelected && (
            <>
              {!isPermissionType && !isOndutyType && leaveTypes.length > 0 && (
                <div className="mb-6">
                  <label htmlFor="leaveTypeFallback" className="block text-sm font-medium text-gray-700 mb-1">
                    Leave Type (Fallback)
                  </label>
                  <select
                    id="leaveTypeFallback"
                    value={selectedLeaveTypeId}
                    onChange={(e) => setSelectedLeaveTypeId(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 bg-white py-2 px-3 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Auto resolve</option>
                    {leaveTypes.map((lt) => (
                      <option key={lt.id} value={lt.id}>
                        {lt.name} {lt.code ? `(${lt.code})` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Use this only when auto mapping is unavailable.
                  </p>
                  {leaveHint && (
                    <div className="mt-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                      Opening: <span className="font-semibold">{leaveHint.openingBalance}</span> | Used:{' '}
                      <span className="font-semibold">{leaveHint.usedBalance}</span> | Available:{' '}
                      <span className="font-semibold">{leaveHint.availableBalance}</span>
                      {leaveHint.fixedDurationEnforced && leaveHint.fixedDays != null && (
                        <>
                          {' '}| Fixed Apply Days:{' '}
                          <span className="font-semibold">{leaveHint.fixedDays}</span> (To Date auto-calculated)
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
              {isOndutyType && !isPermissionType && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Hourly <span className="text-red-500">*</span>
                  </label>
                  <div className="mt-1 inline-flex rounded-md border border-gray-300 bg-white p-0.5">
                    <button
                      type="button"
                      onClick={() => setOndutyHourlyEnabled(true)}
                      className={`px-3 py-1 text-xs font-medium rounded ${
                        ondutyHourlyEnabled ? 'bg-green-600 text-white' : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      YES
                    </button>
                    <button
                      type="button"
                      onClick={() => setOndutyHourlyEnabled(false)}
                      className={`px-3 py-1 text-xs font-medium rounded ${
                        !ondutyHourlyEnabled ? 'bg-red-600 text-white' : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      NO
                    </button>
                  </div>
                </div>
              )}

              {requiresTimeWindow ? (
                <>
                  <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                    Event can be applied from{' '}
                    <span className="font-semibold">{formatMinutesToHHMM(permissionWindow.startMinutes)}</span>{' '}
                    to{' '}
                    <span className="font-semibold">{formatMinutesToHHMM(permissionWindow.endMinutes)}</span>
                  </div>
                  <div className="mb-6">
                    <label htmlFor="entryDate" className="block text-sm font-medium text-gray-700 mb-1">
                      Entry Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="entryDate"
                      type="date"
                      value={entryDate}
                      onChange={(e) => setEntryDate(e.target.value)}
                      required={typeSelected}
                      className="mt-1 block w-full rounded-md border border-gray-300 bg-white py-2 px-3 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor="fromTime" className="block text-sm font-medium text-gray-700 mb-1">
                        From Time <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="fromTime"
                        type="time"
                        value={fromTime}
                        onChange={(e) => setFromTime(e.target.value)}
                        required={typeSelected}
                        className="mt-1 block w-full rounded-md border border-gray-300 bg-white py-2 px-3 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="toTime" className="block text-sm font-medium text-gray-700 mb-1">
                        To Time <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="toTime"
                        type="time"
                        value={toTime}
                        onChange={(e) => setToTime(e.target.value)}
                        required={typeSelected}
                        className="mt-1 block w-full rounded-md border border-gray-300 bg-white py-2 px-3 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* From Date */}
                  <div className="mb-6">
                    <label htmlFor="fromDate" className="block text-sm font-medium text-gray-700 mb-1">
                      From Date <span className="text-red-500">*</span>
                    </label>
                    <div className="mt-1 flex gap-2 items-center flex-wrap">
                      <div className="flex-1 min-w-[140px] relative flex items-center rounded-md border border-gray-300 bg-white shadow-sm focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500">
                        <span className="pl-3 text-gray-400 pointer-events-none">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </span>
                        <input
                          id="fromDate"
                          type="date"
                          value={fromDate}
                          onChange={(e) => setFromDate(e.target.value)}
                          required={typeSelected}
                          className="flex-1 min-w-0 py-2 pl-2 pr-3 border-0 bg-transparent text-sm text-gray-900 focus:outline-none"
                        />
                      </div>
                      <div className="flex items-center gap-1 rounded-md border border-gray-300 bg-white py-1.5 pl-2 pr-1">
                        <select
                          value={fromDuration}
                          onChange={(e) => setFromDuration(e.target.value as DurationOption)}
                          disabled={fixedDurationEnforced}
                          className="text-sm text-gray-900 focus:outline-none border-0 bg-transparent py-0 pr-6"
                        >
                          {(Object.keys(DURATION_LABELS) as DurationOption[]).map((d) => (
                            <option key={d} value={d}>
                              {DURATION_LABELS[d]}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => setFromDuration('FULL_DAY')}
                          disabled={fixedDurationEnforced}
                          className="p-1 text-gray-400 hover:text-gray-600 rounded"
                          aria-label="Clear duration"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* To Date */}
                  <div className="mb-6">
                    <label htmlFor="toDate" className="block text-sm font-medium text-gray-700 mb-1">
                      To Date <span className="text-red-500">*</span>
                    </label>
                    <div className="mt-1 flex gap-2 items-center flex-wrap">
                      <div className="flex-1 min-w-[140px] relative flex items-center rounded-md border border-gray-300 bg-white shadow-sm focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500">
                        <span className="pl-3 text-gray-400 pointer-events-none">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </span>
                        <input
                          id="toDate"
                          type="date"
                          value={toDate}
                          onChange={(e) => setToDate(e.target.value)}
                          disabled={fixedDurationEnforced}
                          required={typeSelected}
                          className="flex-1 min-w-0 py-2 pl-2 pr-3 border-0 bg-transparent text-sm text-gray-900 focus:outline-none"
                        />
                      </div>
                      <div className="flex items-center gap-1 rounded-md border border-gray-300 bg-white py-1.5 pl-2 pr-1">
                        <select
                          value={toDuration}
                          onChange={(e) => setToDuration(e.target.value as DurationOption)}
                          disabled={fixedDurationEnforced}
                          className="text-sm text-gray-900 focus:outline-none border-0 bg-transparent py-0 pr-6"
                        >
                          {(Object.keys(DURATION_LABELS) as DurationOption[]).map((d) => (
                            <option key={d} value={d}>
                              {DURATION_LABELS[d]}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => setToDuration('FULL_DAY')}
                          disabled={fixedDurationEnforced}
                          className="p-1 text-gray-400 hover:text-gray-600 rounded"
                          aria-label="Clear duration"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Reason */}
              <div className="mb-6">
                <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">
                  Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required={typeSelected}
                  placeholder="Reason"
                  rows={4}
                  className="mt-1 block w-full rounded-md border border-gray-300 bg-white py-2 px-3 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
                />
              </div>
            </>
          )}

          {/* Spacer when no extra fields */}
          {!typeSelected && <div className="flex-1 min-h-[120px]" />}

          {/* Action buttons */}
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleCancel}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !canSubmit || loading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
