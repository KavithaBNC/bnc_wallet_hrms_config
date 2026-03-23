import { useCallback, useEffect, useMemo, useState } from 'react';
import AppHeader from '../components/layout/AppHeader';
import { getModulePermissions } from '../config/configurator-module-mapping';
import { attendanceService, type CompOffRequestItem, type CompOffSummary } from '../services/attendance.service';
import { useAuthStore } from '../store/authStore';
import employeeService, { type Employee } from '../services/employee.service';

function toHHMM(minutes: number): string {
  const safe = Math.max(0, Number.isFinite(minutes) ? Math.round(minutes) : 0);
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function statusClass(status: string): string {
  if (status === 'APPROVED') return 'bg-green-100 text-green-800';
  if (status === 'REJECTED') return 'bg-red-100 text-red-800';
  return 'bg-yellow-100 text-yellow-800';
}

type TabMode = 'my' | 'team';

export default function ExcessTimeRequestPage() {
  const { user, logout } = useAuthStore();
  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id;
  const attendancePerms = getModulePermissions('/attendance');
  const isHRScope = attendancePerms.can_view;
  const selfEmployeeId = user?.employee?.id;
  const selfName = [user?.employee?.firstName, user?.employee?.lastName].filter(Boolean).join(' ') || 'Me';

  // Tab state – only relevant for HR/Manager scope
  const [activeTab, setActiveTab] = useState<TabMode>('my');

  const [summary, setSummary] = useState<CompOffSummary | null>(null);
  const [requests, setRequests] = useState<CompOffRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  const getErrMsg = (e: unknown, fallback: string) => {
    const err = e as { response?: { data?: { message?: string } }; message?: string };
    return err?.response?.data?.message || err?.message || fallback;
  };

  // Determine which employeeId to use for API calls
  const effectiveEmployeeId = useMemo(() => {
    if (!isHRScope) return undefined; // regular employee → backend uses logged-in user
    if (activeTab === 'my') return selfEmployeeId; // HR own request
    return selectedEmployeeId || undefined; // team member
  }, [isHRScope, activeTab, selfEmployeeId, selectedEmployeeId]);

  // Selected team member name for display
  const selectedEmployeeName = useMemo(() => {
    if (!isHRScope || activeTab === 'my') return selfName;
    const emp = employees.find((e) => e.id === selectedEmployeeId);
    if (!emp) return '';
    return [emp.employeeCode, '-', emp.firstName, emp.middleName, emp.lastName].filter(Boolean).join(' ');
  }, [isHRScope, activeTab, selfName, employees, selectedEmployeeId]);

  // Load employees list for team tab
  useEffect(() => {
    const loadEmployees = async () => {
      if (!organizationId || !isHRScope) return;
      try {
        setLoadingEmployees(true);
        const res = await employeeService.getAll({ organizationId, page: 1, limit: 2000, employeeStatus: 'ACTIVE' });
        const list = res.employees || [];
        setEmployees(list);
        // Default to first employee that is NOT self, or first in list
        if (!selectedEmployeeId && list.length > 0) {
          const other = list.find((e) => e.id !== selfEmployeeId);
          setSelectedEmployeeId(other ? other.id : list[0].id);
        }
      } catch {
        setEmployees([]);
      } finally {
        setLoadingEmployees(false);
      }
    };
    loadEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, isHRScope]);

  const load = useCallback(async () => {
    if (!organizationId) {
      setSummary(null);
      setRequests([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [sum, req] = await Promise.all([
        attendanceService.getCompOffSummary(organizationId, effectiveEmployeeId),
        attendanceService.getCompOffRequests({
          organizationId,
          page: 1,
          limit: 100,
          employeeId: effectiveEmployeeId,
        }),
      ]);
      setSummary(sum);
      setRequests(req.requests || []);
    } catch (e: unknown) {
      setError(getErrMsg(e, 'Failed to load excess time requests'));
    } finally {
      setLoading(false);
    }
  }, [organizationId, effectiveEmployeeId]);

  useEffect(() => {
    load();
  }, [load]);

  const convertible = useMemo(() => {
    if (!summary) return false;
    return summary.conversionEnabled && (summary.eligibleCompOffDays ?? 0) > 0;
  }, [summary]);

  const handleConvert = async () => {
    if (!organizationId || !summary) return;
    if (!convertible) {
      setError(`Minimum ${summary.halfDayMinutes || 240} minutes is required for conversion`);
      return;
    }
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      // For "my" tab, pass selfEmployeeId so HR's own record is used;
      // for "team" tab, pass selectedEmployeeId
      const targetId = isHRScope
        ? activeTab === 'my'
          ? selfEmployeeId
          : selectedEmployeeId || undefined
        : undefined;

      const res = await attendanceService.convertExcessTimeToCompOff(organizationId, undefined, targetId);
      const who = activeTab === 'team' ? selectedEmployeeName : 'Your';
      setMessage(
        `${who} request submitted: ${res.conversion.convertedMinutes} min converted (${res.conversion.eligibleCompOffDays} day(s)); remaining ${res.conversion.remainingMinutes} min.`
      );
      setShowConfirm(false);
      await load();
    } catch (e: unknown) {
      setError(getErrMsg(e, 'Failed to submit conversion request'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  const handleTabChange = (tab: TabMode) => {
    setActiveTab(tab);
    setError(null);
    setMessage(null);
    setSummary(null);
    setRequests([]);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader
        title="Excess Time Request"
        subtitle="Attendance → My Requests → Excess Time Request"
        onLogout={handleLogout}
      />
      <main className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
        {message && <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{message}</div>}

        {/* ── Tab Selector (only for HR/Manager) ── */}
        {isHRScope && (
          <div className="mb-6 flex gap-1 bg-white rounded-lg shadow p-1 w-fit">
            <button
              type="button"
              onClick={() => handleTabChange('my')}
              className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'my'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              My Excess Time Request
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('team')}
              className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'team'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Team Member Request
            </button>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Valid Excess Time Balance</h2>
          {/* Employee name display */}
          <p className="text-sm text-gray-600 mb-4">
            {isHRScope && activeTab === 'my' && (
              <>Employee: <span className="font-semibold text-gray-900">{selfName}</span> (Self)</>
            )}
            {isHRScope && activeTab === 'team' && selectedEmployeeName && (
              <>Employee: <span className="font-semibold text-gray-900">{selectedEmployeeName}</span></>
            )}
            {!isHRScope && (
              <>Employee: <span className="font-semibold text-gray-900">{selfName}</span></>
            )}
          </p>

          {/* Employee dropdown – only on team tab for HR */}
          {isHRScope && activeTab === 'team' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Employee</label>
              <select
                className="w-full md:w-96 rounded border border-gray-300 bg-white px-3 py-2 text-sm text-black"
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                disabled={loadingEmployees}
              >
                {(employees || []).map((e) => (
                  <option key={e.id} value={e.id}>
                    {`${e.employeeCode} - ${[e.firstName, e.middleName, e.lastName].filter(Boolean).join(' ')}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {loading || !summary ? (
            <div className="text-sm text-gray-500">Loading...</div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-lg border border-gray-200 p-4">
                  <p className="text-xs text-gray-500">Total Available Excess</p>
                  <p className="text-xl font-semibold text-gray-900">{toHHMM(summary.availableExcessMinutesForRequest ?? 0)}</p>
                </div>
                <div className="rounded-lg border border-gray-200 p-4">
                  <p className="text-xs text-gray-500">Eligible Conversion (Days)</p>
                  <p className="text-xl font-semibold text-gray-900">{summary.eligibleCompOffDays ?? 0}</p>
                </div>
                <div className="rounded-lg border border-gray-200 p-4">
                  <p className="text-xs text-gray-500">Remaining Minutes After Conversion</p>
                  <p className="text-xl font-semibold text-gray-900">
                    {summary.remainingAfterEligibleConversionMinutes ?? Math.max(0, (summary.availableExcessMinutesForRequest ?? 0) - (summary.eligibleConversionMinutes ?? 0))}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={!convertible || submitting}
                  onClick={() => setShowConfirm(true)}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700"
                >
                  {submitting ? 'Submitting...' : 'Convert to Comp Off'}
                </button>
                {!summary.conversionEnabled && (
                  <span className="text-sm text-amber-700">Conversion is disabled by Excess Time Conversion rule.</span>
                )}
                {summary.expiryDaysForWorkDay && summary.expiryDaysForWorkDay > 0 && (
                  <span className="text-sm text-gray-600">Expiry window: last {summary.expiryDaysForWorkDay} days</span>
                )}
              </div>
            </>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {isHRScope && activeTab === 'team' ? 'Employee Excess Time Requests' : 'My Excess Time Requests'}
          </h2>
          {loading ? (
            <div className="text-sm text-gray-500">Loading...</div>
          ) : requests.length === 0 ? (
            <div className="text-sm text-gray-500">No requests yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {isHRScope && activeTab === 'team' && (
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                    )}
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Requested On</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Converted Days</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Converted Minutes</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Remaining Excess Minutes</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {requests.map((r) => (
                    <tr key={r.id}>
                      {isHRScope && activeTab === 'team' && (
                        <td className="px-4 py-2 text-sm text-gray-700">{(r as any).employeeName || selectedEmployeeName}</td>
                      )}
                      <td className="px-4 py-2 text-sm text-gray-700">{new Date(r.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${statusClass(r.status)}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700">{r.convertedDays}</td>
                      <td className="px-4 py-2 text-sm text-gray-700">{r.convertedMinutes}</td>
                      <td className="px-4 py-2 text-sm text-gray-700">{summary?.availableExcessMinutesForRequest ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {showConfirm && summary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Confirm Conversion</h3>
            {isHRScope && activeTab === 'team' && (
              <p className="text-sm text-blue-700 font-medium mb-2">
                Converting on behalf of: {selectedEmployeeName}
              </p>
            )}
            <p className="text-sm text-gray-700 whitespace-pre-line mb-4">
              {`Available: ${summary.availableExcessMinutesForRequest ?? 0} minutes\nEligible: ${summary.eligibleCompOffDays ?? 0} Day(s)\nRemaining: ${summary.remainingAfterEligibleConversionMinutes ?? 0} minutes\nProceed?`}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="px-3 py-2 rounded border border-gray-300 text-sm"
                onClick={() => setShowConfirm(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-3 py-2 rounded bg-blue-600 text-white text-sm disabled:opacity-50"
                onClick={handleConvert}
                disabled={submitting}
              >
                {submitting ? 'Submitting...' : 'Proceed'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
