/**
 * Apply Event page – supports Leave and Permission event types.
 * Both flows create a LeaveRequest via /leaves/requests so manager approval,
 * calendar badges, and monthly details stay aligned in one pipeline.
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import attendanceComponentService from '../services/attendanceComponent.service';
import type { AttendanceComponent } from '../services/attendanceComponent.service';
import AppHeader from '../components/layout/AppHeader';

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

/** Leave/Permission attendance components for the Type dropdown */
function getEventComponents(components: AttendanceComponent[]): AttendanceComponent[] {
  return components.filter((c) => c.eventCategory === 'Leave' || c.eventCategory === 'Permission');
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
  const eventNameKey = component.eventName?.toLowerCase().trim() ?? '';
  const shortNameKey = component.shortName?.toLowerCase().trim() ?? '';
  if (!eventNameKey && !shortNameKey) return null;

  const match = leaveTypes.find((lt) => {
    const n = lt.name?.toLowerCase().trim() ?? '';
    const c = lt.code?.toLowerCase().trim() ?? '';
    return (
      (eventNameKey && (n === eventNameKey || c === eventNameKey)) ||
      (shortNameKey && (c === shortNameKey || n === shortNameKey))
    );
  });
  return match?.id ?? null;
}

interface MonthlyDetailsState {
  employeeId?: string;
  year?: number;
  month?: number;
  applyTab?: 'Leave' | 'Permission' | 'Onduty';
}

export default function ApplyEventPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;
  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id;

  const state = (location.state as MonthlyDetailsState | null) || {};
  const pageMode: 'Leave' | 'Permission' = state.applyTab === 'Leave' ? 'Leave' : 'Permission';
  const now = new Date();
  const contextEmployeeId = state.employeeId || user?.employee?.id;
  const contextYear = state.year ?? now.getFullYear();
  const contextMonth = state.month ?? now.getMonth() + 1;

  const [componentsRaw, setComponentsRaw] = useState<AttendanceComponent[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  /** component id -> leave type id from backend mapping */
  const [componentToLeaveTypeId, setComponentToLeaveTypeId] = useState<Record<string, string>>({});
  /** Leave/Permission names from monthly details – used to filter Type dropdown */
  const [monthlyDetailsLeaveNames, setMonthlyDetailsLeaveNames] = useState<string[]>([]);
  const [monthlyDetailsPermissionNames, setMonthlyDetailsPermissionNames] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [selectedComponentId, setSelectedComponentId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [fromDuration, setFromDuration] = useState<DurationOption>('FULL_DAY');
  const [toDuration, setToDuration] = useState<DurationOption>('FULL_DAY');
  const [entryDate, setEntryDate] = useState('');
  const [fromTime, setFromTime] = useState('');
  const [toTime, setToTime] = useState('');
  const [reason, setReason] = useState('');
  const [selectedLeaveTypeId, setSelectedLeaveTypeId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const typeSelected = !!selectedComponentId;

  const eventComponents = useMemo(() => {
    const all = getEventComponents(componentsRaw);
    if (pageMode === 'Leave') {
      return filterByMonthlyDetailsLeaves(
        all.filter((c) => c.eventCategory === 'Leave'),
        monthlyDetailsLeaveNames
      );
    }
    return filterByMonthlyDetailsLeaves(
      all.filter((c) => c.eventCategory === 'Permission'),
      monthlyDetailsPermissionNames
    );
  }, [componentsRaw, monthlyDetailsLeaveNames, monthlyDetailsPermissionNames, pageMode]);

  const selectedComponent = useMemo(
    () => eventComponents.find((c) => c.id === selectedComponentId) ?? null,
    [eventComponents, selectedComponentId]
  );
  const isPermissionType = selectedComponent?.eventCategory === 'Permission' || pageMode === 'Permission';

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
    ])
      .then(([componentsRes, leaveTypesRes, mappingRes]) => {
        if (cancelled) return;
        const comps = componentsRes.components ?? [];
        setComponentsRaw(comps);
        setLeaveTypes(leaveTypesRes.data?.data?.leaveTypes ?? []);
        setComponentToLeaveTypeId(mappingRes.data?.data?.mapping ?? {});
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
    if (!organizationId || !contextEmployeeId) {
      setMonthlyDetailsLeaveNames([]);
      return;
    }
    let cancelled = false;
    api
      .get<{ data: { leave?: Array<{ name: string }>; permission?: Array<{ name: string }> } }>('/attendance/monthly-details', {
        params: { organizationId, employeeId: contextEmployeeId, year: contextYear, month: contextMonth },
      })
      .then((res) => {
        if (!cancelled && res.data?.data) {
          setMonthlyDetailsLeaveNames((res.data.data.leave || []).map((r) => r.name).filter(Boolean));
          setMonthlyDetailsPermissionNames((res.data.data.permission || []).map((r) => r.name).filter(Boolean));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMonthlyDetailsLeaveNames([]);
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
    if (isPermissionType) {
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

    // Resolve leave type id:
    // 1) explicit mapping (preferred)
    // 2) manual selection from Leave Type dropdown (leave mode only)
    // 3) fallback name/code match for older data
    // 4) permission fallback (permission mode only)
    const fromMapping = componentToLeaveTypeId[selectedComponentId];
    const fromManual = isPermissionType ? undefined : (selectedLeaveTypeId || undefined);
    const fromNameMatch = resolveLeaveTypeIdFromComponent(leaveTypes, selectedComponent);
    const leaveTypeIdForSubmit = fromMapping || fromManual || fromNameMatch || (isPermissionType ? permissionFallback : undefined);

    if (!leaveTypeIdForSubmit) {
      setError(
        isPermissionType
          ? 'Permission event is not mapped to a Leave Type. Please configure Event Mapping for Permission.'
          : 'This event type is not linked to any leave type. Please either map it in Event Configuration or select a Leave Type below.'
      );
      return;
    }

    try {
      setSaving(true);

      let startDate = fromDate;
      let endDate = toDate;
      let totalDays: number | undefined;
      let submitReason = reason.trim();

      if (isPermissionType) {
        const [fromH, fromM] = fromTime.split(':').map(Number);
        const [toH, toM] = toTime.split(':').map(Number);
        const startMinutes = fromH * 60 + fromM;
        const endMinutes = toH * 60 + toM;
        const allowedStart = 8 * 60 + 30; // 08:30
        const allowedEnd = 17 * 60 + 30; // 17:30

        if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) {
          setError('Please provide valid From/To time.');
          return;
        }
        if (endMinutes <= startMinutes) {
          setError('To Time should be greater than From Time.');
          return;
        }
        if (startMinutes < allowedStart || endMinutes > allowedEnd) {
          setError('Permission can be applied only between 08:30 and 17:30.');
          return;
        }

        const durationMinutes = endMinutes - startMinutes;
        totalDays = Number((durationMinutes / 540).toFixed(4)); // 9-hour office window basis
        startDate = entryDate;
        endDate = entryDate;
        submitReason = `[Permission ${fromTime}-${toTime}] ${submitReason}`;
      } else {
        const isSingleDay = fromDate === toDate;
        const isHalfDaySelection = fromDuration !== 'FULL_DAY' || toDuration !== 'FULL_DAY';
        totalDays = isSingleDay && isHalfDaySelection ? 0.5 : undefined;
      }

      const payload = {
        leaveTypeId: leaveTypeIdForSubmit,
        startDate,
        endDate,
        reason: submitReason,
        ...(totalDays != null ? { totalDays } : {}),
      };

      await api.post('/leaves/requests', payload);

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
      (isPermissionType
        ? (entryDate && fromTime && toTime && reason.trim())
        : (fromDate && toDate && reason.trim())));

  if (!organizationId) {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
        <AppHeader
          title={pageMode === 'Permission' ? 'Apply Permission' : 'Apply Event'}
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
        title={pageMode === 'Permission' ? 'Apply Permission' : 'Apply Event'}
        subtitle={organizationName ? `Organization: ${organizationName}` : undefined}
        onLogout={handleLogout}
      />

      <div className="flex-1 overflow-auto p-4">
        <form onSubmit={handleSave} className="mx-auto flex w-full max-w-2xl flex-col rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
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

          {/* From Date, To Date, Reason, Leave Type – only after Type is selected */}
          {typeSelected && (
            <>
              {/* Optional explicit Leave Type selector when no mapping exists (leave mode only) */}
              {!isPermissionType && leaveTypes.length > 0 && !componentToLeaveTypeId[selectedComponentId] && (
                <div className="mb-6">
                  <label htmlFor="leaveType" className="block text-sm font-medium text-gray-700 mb-1">
                    Leave Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="leaveType"
                    value={selectedLeaveTypeId}
                    onChange={(e) => setSelectedLeaveTypeId(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 bg-white py-2 px-3 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Select leave type</option>
                    {leaveTypes.map((lt) => (
                      <option key={lt.id} value={lt.id}>
                        {lt.name} {lt.code ? `(${lt.code})` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    This event is not explicitly mapped. Choose the correct leave type to continue.
                  </p>
                </div>
              )}

              {isPermissionType ? (
                <>
                  <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                    Event can be applied from <span className="font-semibold">08:30</span> to <span className="font-semibold">17:30</span>
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
                          required={typeSelected}
                          className="flex-1 min-w-0 py-2 pl-2 pr-3 border-0 bg-transparent text-sm text-gray-900 focus:outline-none"
                        />
                      </div>
                      <div className="flex items-center gap-1 rounded-md border border-gray-300 bg-white py-1.5 pl-2 pr-1">
                        <select
                          value={toDuration}
                          onChange={(e) => setToDuration(e.target.value as DurationOption)}
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
