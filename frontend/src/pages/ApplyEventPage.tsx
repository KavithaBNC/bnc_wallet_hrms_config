/**
 * Apply Event page – opened when user clicks Leave from the calendar Monthly Details.
 * Type dropdown is populated from attendance components (event names).
 * From Date, To Date, and Reason show only after Type is selected.
 * On Save, a LeaveRequest is created via /leaves/requests so that,
 * once approved, opening/used/balance in the calendar sidebar update automatically.
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import attendanceComponentService from '../services/attendanceComponent.service';
import type { AttendanceComponent } from '../services/attendanceComponent.service';

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

/** Leave-category attendance components for the Type dropdown */
function getLeaveComponents(components: AttendanceComponent[]): AttendanceComponent[] {
  return components.filter((c) => c.eventCategory === 'Leave');
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
}

export default function ApplyEventPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id;

  const state = (location.state as MonthlyDetailsState | null) || {};
  const now = new Date();
  const contextEmployeeId = state.employeeId || user?.employee?.id;
  const contextYear = state.year ?? now.getFullYear();
  const contextMonth = state.month ?? now.getMonth() + 1;

  const [componentsRaw, setComponentsRaw] = useState<AttendanceComponent[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  /** component id -> leave type id from backend mapping */
  const [componentToLeaveTypeId, setComponentToLeaveTypeId] = useState<Record<string, string>>({});
  /** Leave names from monthly details – used to filter Type dropdown to only configured leaves */
  const [monthlyDetailsLeaveNames, setMonthlyDetailsLeaveNames] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [selectedComponentId, setSelectedComponentId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [fromDuration, setFromDuration] = useState<DurationOption>('FULL_DAY');
  const [toDuration, setToDuration] = useState<DurationOption>('FULL_DAY');
  const [reason, setReason] = useState('');
  const [selectedLeaveTypeId, setSelectedLeaveTypeId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const typeSelected = !!selectedComponentId;

  const leaveComponents = useMemo(() => {
    const leaveOnly = getLeaveComponents(componentsRaw);
    return filterByMonthlyDetailsLeaves(leaveOnly, monthlyDetailsLeaveNames);
  }, [componentsRaw, monthlyDetailsLeaveNames]);

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
      .get<{ data: { leave?: Array<{ name: string }> } }>('/attendance/monthly-details', {
        params: { organizationId, employeeId: contextEmployeeId, year: contextYear, month: contextMonth },
      })
      .then((res) => {
        if (!cancelled && res.data?.data?.leave) {
          setMonthlyDetailsLeaveNames(res.data.data.leave.map((r) => r.name).filter(Boolean));
        }
      })
      .catch(() => {
        if (!cancelled) setMonthlyDetailsLeaveNames([]);
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId, contextEmployeeId, contextYear, contextMonth]);

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
    if (typeSelected && (!fromDate || !toDate || !reason.trim())) {
      setError('From Date, To Date and Reason are required.');
      return;
    }

    const selectedComponent =
      leaveComponents.find((c) => c.id === selectedComponentId) ?? null;

    // Resolve leave type id:
    // 1) explicit mapping (preferred)
    // 2) manual selection from Leave Type dropdown
    // 3) fallback name/code match for older data
    const fromMapping = componentToLeaveTypeId[selectedComponentId];
    const fromManual = selectedLeaveTypeId || undefined;
    const fromNameMatch = resolveLeaveTypeIdFromComponent(leaveTypes, selectedComponent);
    const leaveTypeIdForSubmit = fromMapping || fromManual || fromNameMatch;

    if (!leaveTypeIdForSubmit) {
      setError(
        'This event type is not linked to any leave type. Please either map it in Event Configuration or select a Leave Type below.'
      );
      return;
    }

    try {
      setSaving(true);

      const payload = {
        leaveTypeId: leaveTypeIdForSubmit,
        startDate: fromDate,
        endDate: toDate,
        reason: reason.trim(),
        // totalDays omitted – backend calculates working days between start & end
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
        setError('Failed to submit leave request. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  const canSubmit =
    !!selectedComponentId && (!typeSelected || (fromDate && toDate && reason.trim()));

  if (!organizationId) {
    return (
      <div className="flex flex-col min-h-0 flex-1">
        <header className="flex-shrink-0 bg-[#1e3a5f] px-4 py-3">
          <h1 className="text-lg font-semibold text-white">Apply Event</h1>
        </header>
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
    <div className="flex flex-col min-h-0 flex-1 bg-white">
      {/* Dark blue header */}
      <header className="flex-shrink-0 bg-[#1e3a5f] px-4 py-3">
        <h1 className="text-lg font-semibold text-white">Apply Event</h1>
      </header>

      <div className="flex-1 overflow-auto">
        <form onSubmit={handleSave} className="p-4 flex flex-col max-w-xl">
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
                disabled={loading}
                className="flex-1 min-w-0 py-2 pl-3 pr-8 bg-transparent text-sm text-gray-900 focus:outline-none disabled:bg-gray-100 disabled:text-gray-500 border-0 rounded-md"
              >
                <option value="">: Type</option>
                {leaveComponents.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.eventName || c.shortName || c.id}
                  </option>
                ))}
              </select>
              {selectedComponentId && (
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
              {/* Optional explicit Leave Type selector when no mapping exists */}
              {leaveTypes.length > 0 && !componentToLeaveTypeId[selectedComponentId] && (
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
