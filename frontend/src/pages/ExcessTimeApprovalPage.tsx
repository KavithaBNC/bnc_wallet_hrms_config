import { useCallback, useEffect, useState } from 'react';
import AppHeader from '../components/layout/AppHeader';
import { getModulePermissions } from '../config/configurator-module-mapping';
import { attendanceService, type CompOffRequestDetails, type CompOffRequestItem } from '../services/attendance.service';
import employeeService, { type Employee } from '../services/employee.service';
import { useAuthStore } from '../store/authStore';

function toHHMM(minutes: number): string {
  const safe = Math.max(0, Number.isFinite(minutes) ? Math.round(minutes) : 0);
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function statusBadge(status: string): string {
  if (status === 'APPROVED') return 'bg-green-100 text-green-800';
  if (status === 'REJECTED') return 'bg-red-100 text-red-800';
  return 'bg-orange-100 text-orange-800';
}

function fmtDate(value?: string | Date | null): string {
  if (!value) return '-';
  return new Date(value).toLocaleDateString();
}

function fmtDateTime(value?: string | Date | null): string {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

export default function ExcessTimeApprovalPage() {
  const { user, logout } = useAuthStore();
  const attendancePerms = getModulePermissions('/attendance');
  const canAccess = attendancePerms.can_view;
  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id || (user as any)?.organizationId;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<CompOffRequestItem[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [details, setDetails] = useState<CompOffRequestDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [status, setStatus] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [employeeId, setEmployeeId] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [rejectComment, setRejectComment] = useState('');

  const loadEmployees = useCallback(async () => {
    if (!organizationId || !canAccess) return;
    const params: any = { organizationId, page: 1, limit: 1000, employeeStatus: 'ACTIVE' };
    if (!attendancePerms.can_edit && attendancePerms.can_view && user?.employee?.id) params.reportingManagerId = user.employee.id;
    const res = await employeeService.getAll(params);
    setEmployees(res.employees || []);
  }, [organizationId, canAccess, attendancePerms.can_edit, attendancePerms.can_view, user?.employee?.id]);

  const loadRequests = useCallback(async () => {
    if (!organizationId || !canAccess) {
      setRequests([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await attendanceService.getCompOffRequests({
        organizationId,
        status,
        employeeId: employeeId || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page: 1,
        limit: 200,
      } as any);
      setRequests(data.requests || []);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Failed to load excess time requests');
    } finally {
      setLoading(false);
    }
  }, [organizationId, canAccess, status, employeeId, startDate, endDate]);

  useEffect(() => {
    loadEmployees().catch(() => {});
  }, [loadEmployees]);

  useEffect(() => {
    loadRequests().catch(() => {});
  }, [loadRequests]);

  const openDetails = async (requestId: string) => {
    if (!organizationId) return;
    setSelectedRequestId(requestId);
    setLoadingDetails(true);
    setDetails(null);
    setRejectComment('');
    try {
      const data = await attendanceService.getCompOffRequestDetails(requestId, organizationId);
      setDetails(data);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Failed to load request details');
      setSelectedRequestId(null);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleApprove = async (requestId: string) => {
    setActionLoading(true);
    try {
      await attendanceService.approveCompOffRequest(requestId);
      setSelectedRequestId(null);
      setDetails(null);
      await loadRequests();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Failed to approve request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (requestId: string) => {
    if (!rejectComment.trim()) {
      setError('Reject reason is required');
      return;
    }
    setActionLoading(true);
    try {
      await attendanceService.rejectCompOffRequest(requestId, rejectComment.trim());
      setSelectedRequestId(null);
      setDetails(null);
      await loadRequests();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Failed to reject request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  const handleExportCsv = () => {
    if (requests.length === 0) return;
    const rows = [
      [
        'Employee Name',
        'Employee ID',
        'Department',
        'Request Date',
        'Total Excess Minutes',
        'Eligible Conversion (Days)',
        'Requested Conversion Days',
        'Remaining Minutes',
        'Status',
        'Applied On',
      ],
      ...requests.map((r) => [
        `${r.employee?.firstName || ''} ${r.employee?.lastName || ''}`.trim(),
        r.employee?.employeeCode || '',
        r.departmentName || '',
        fmtDate(r.createdAt),
        String(r.totalExcessMinutes ?? ''),
        String(r.eligibleConversionDays ?? ''),
        String(r.convertedDays ?? ''),
        String(r.remainingMinutes ?? ''),
        r.status,
        fmtDateTime(r.createdAt),
      ]),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `excess-time-approval-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!canAccess) {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
        <AppHeader title="Excess Time Approval" subtitle="Attendance → Excess Time Approval" onLogout={handleLogout} />
        <main className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow p-6 text-sm text-red-700">Access denied. Only Manager/HR can view this page.</div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader title="Excess Time Approval" subtitle="Attendance → Excess Time Approval" onLogout={handleLogout} />
      <main className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

        <div className="bg-white rounded-lg shadow p-4 mb-4 grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Status</label>
            <select className="w-full rounded border border-gray-300 px-2 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value as any)}>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Employee</label>
            <select className="w-full rounded border border-gray-300 px-2 py-2 text-sm" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">All</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{`${e.employeeCode} - ${e.firstName} ${e.lastName}`}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Start Date</label>
            <input type="date" className="w-full rounded border border-gray-300 px-2 py-2 text-sm" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">End Date</label>
            <input type="date" className="w-full rounded border border-gray-300 px-2 py-2 text-sm" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="flex items-end">
            <button onClick={() => loadRequests()} className="w-full rounded bg-blue-600 text-white py-2 text-sm">Apply Filters</button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="mb-3 flex justify-end">
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={requests.length === 0}
              className="px-3 py-2 rounded border border-gray-300 text-sm bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Export CSV
            </button>
          </div>
          {loading ? (
            <div className="text-sm text-gray-500">Loading...</div>
          ) : requests.length === 0 ? (
            <div className="text-sm text-gray-500">No requests found.</div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs text-gray-500 uppercase">Employee</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-500 uppercase">Emp ID</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-500 uppercase">Department</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-500 uppercase">Request Date</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-500 uppercase">Total Excess</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-500 uppercase">Eligible</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-500 uppercase">Requested</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-500 uppercase">Remaining</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-500 uppercase">Status</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-500 uppercase">Applied On</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {requests.map((r) => (
                    <tr key={r.id}>
                      <td className="px-3 py-2 text-sm">{`${r.employee?.firstName || ''} ${r.employee?.lastName || ''}`.trim()}</td>
                      <td className="px-3 py-2 text-sm">{r.employee?.employeeCode || '-'}</td>
                      <td className="px-3 py-2 text-sm">{r.departmentName || '-'}</td>
                      <td className="px-3 py-2 text-sm">{fmtDate(r.createdAt)}</td>
                      <td className="px-3 py-2 text-sm">{r.totalExcessMinutes ?? '-'}</td>
                      <td className="px-3 py-2 text-sm">{r.eligibleConversionDays ?? '-'}</td>
                      <td className="px-3 py-2 text-sm">{r.convertedDays}</td>
                      <td className="px-3 py-2 text-sm">{r.remainingMinutes ?? '-'}</td>
                      <td className="px-3 py-2 text-sm"><span className={`px-2 py-0.5 rounded text-xs font-semibold ${statusBadge(r.status)}`}>{r.status}</span></td>
                      <td className="px-3 py-2 text-sm">{fmtDateTime(r.createdAt)}</td>
                      <td className="px-3 py-2 text-sm">
                        <button className="text-blue-600 hover:underline mr-2" onClick={() => openDetails(r.id)}>View</button>
                        {r.status === 'PENDING' && (
                          <>
                            <button className="text-green-600 hover:underline mr-2" onClick={() => handleApprove(r.id)}>Approve</button>
                            <button className="text-red-600 hover:underline" onClick={() => openDetails(r.id)}>Reject</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {selectedRequestId && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => { if (!actionLoading) { setSelectedRequestId(null); setDetails(null); } }}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl p-6" onClick={(e) => e.stopPropagation()}>
              {loadingDetails || !details ? (
                <div className="text-sm text-gray-500">Loading details...</div>
              ) : (
                <>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Excess Time Request Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 text-sm">
                    <div><span className="text-gray-500">Employee:</span> {details.request.employeeName}</div>
                    <div><span className="text-gray-500">Employee ID:</span> {details.request.employee?.employeeCode || '-'}</div>
                    <div><span className="text-gray-500">Department:</span> {details.request.departmentName || '-'}</div>
                    <div><span className="text-gray-500">Total accumulated:</span> {details.summary.totalExcessMinutes} min</div>
                    <div><span className="text-gray-500">Requested conversion:</span> {details.request.convertedDays} day(s)</div>
                    <div><span className="text-gray-500">Remaining:</span> {details.summary.remainingAfterEligibleConversionMinutes ?? 0} min</div>
                    <div><span className="text-gray-500">Rule:</span> {details.conversionRules.halfDayMinutes} min = 0.5 day, {details.conversionRules.fullDayMinutes} min = 1 day</div>
                    <div><span className="text-gray-500">Combine days:</span> {details.conversionRules.combineMultipleDays ? 'Yes' : 'No'}</div>
                    <div><span className="text-gray-500">Employee remarks:</span> {details.request.reason || '-'}</div>
                  </div>
                  <div className="max-h-56 overflow-auto border rounded">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs text-gray-500 uppercase">Date</th>
                          <th className="px-3 py-2 text-left text-xs text-gray-500 uppercase">Excess Minutes</th>
                          <th className="px-3 py-2 text-left text-xs text-gray-500 uppercase">HH:MM</th>
                          <th className="px-3 py-2 text-left text-xs text-gray-500 uppercase">Expiry Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {details.dailyBreakdown.map((d, idx) => (
                          <tr key={`${d.date}-${idx}`}>
                            <td className="px-3 py-2 text-sm">{new Date(d.date).toLocaleDateString()}</td>
                            <td className="px-3 py-2 text-sm">{d.excessMinutes}</td>
                            <td className="px-3 py-2 text-sm">{toHHMM(d.excessMinutes)}</td>
                            <td className="px-3 py-2 text-sm">{d.expiryDate ? new Date(d.expiryDate).toLocaleDateString() : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {details.request.status === 'PENDING' && (
                    <div className="mt-4">
                      <label className="block text-sm text-gray-700 mb-1">Reject reason (required for Reject)</label>
                      <textarea value={rejectComment} onChange={(e) => setRejectComment(e.target.value)} rows={2} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
                    </div>
                  )}
                  <div className="mt-4 flex justify-end gap-2">
                    <button className="px-3 py-2 border rounded text-sm" onClick={() => { if (!actionLoading) { setSelectedRequestId(null); setDetails(null); } }}>Close</button>
                    {details.request.status === 'PENDING' && (
                      <>
                        <button disabled={actionLoading} className="px-3 py-2 bg-red-600 text-white rounded text-sm disabled:opacity-50" onClick={() => handleReject(details.request.id)}>
                          Reject
                        </button>
                        <button disabled={actionLoading} className="px-3 py-2 bg-green-600 text-white rounded text-sm disabled:opacity-50" onClick={() => handleApprove(details.request.id)}>
                          Approve
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
