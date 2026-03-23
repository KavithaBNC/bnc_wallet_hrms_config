import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AppHeader from '../components/layout/AppHeader';
import BackNavigation from '../components/common/BackNavigation';
import { useAuthStore } from '../store/authStore';
import { attendanceService, type CompletedListRow } from '../services/attendance.service';

export default function RevertProcessPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [searchParams] = useSearchParams();
  const organizationIdParam = searchParams.get('organizationId') || '';
  const organizationId = organizationIdParam || user?.employee?.organizationId || (user?.employee?.organization as { id?: string } | undefined)?.id || '';
  const fromDate = searchParams.get('fromDate') || '';
  const toDate = searchParams.get('toDate') || '';
  const paygroupId = searchParams.get('paygroupId') || undefined;
  const organizationName = user?.employee?.organization?.name;

  const [rows, setRows] = useState<CompletedListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  // Revert dialog
  const [showRevertDialog, setShowRevertDialog] = useState(false);
  const [revertRemarks, setRevertRemarks] = useState('');
  const [revertLoading, setRevertLoading] = useState(false);
  const [revertResult, setRevertResult] = useState<{ reverted: number; leaveRequestsDeleted: number; balancesRestored: number; errors: { employeeId: string; date: string; message: string }[] } | null>(null);

  // On Hold dialog
  const [showOnHoldDialog, setShowOnHoldDialog] = useState(false);
  const [holdAssociateCanModify, setHoldAssociateCanModify] = useState(false);
  const [holdManagerCanModify, setHoldManagerCanModify] = useState(false);
  const [holdRevertRegularization, setHoldRevertRegularization] = useState(false);
  const [holdReason, setHoldReason] = useState('');
  const [holdLoading, setHoldLoading] = useState(false);
  const [holdResult, setHoldResult] = useState<{ updated: number; errors: { employeeId: string; date: string; message: string }[] } | null>(null);

  const limit = 50;

  const rowKey = (r: CompletedListRow) => `${r.employeeId}:${r.date}`;

  const fetchRows = useCallback(async (pg = 1, searchTerm = '') => {
    if (!organizationId || !fromDate || !toDate) return;
    setLoading(true);
    try {
      const res = await attendanceService.getCompletedList({
        organizationId, fromDate, toDate, paygroupId,
        search: searchTerm || undefined, page: pg, limit,
      });
      setRows(res.rows);
      setTotal(res.total);
      setPage(pg);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [organizationId, fromDate, toDate, paygroupId, limit]);

  useEffect(() => { fetchRows(1, search); }, [fetchRows, search]);

  const toggleSelect = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedKeys.size === rows.length) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(rows.map(rowKey)));
    }
  };

  const selectedRows = rows.filter((r) => selectedKeys.has(rowKey(r)));

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleRevert = async () => {
    if (selectedRows.length === 0) return;
    setRevertLoading(true);
    try {
      const result = await attendanceService.revertByRows({
        organizationId,
        selectedRows: selectedRows.map((r) => ({ employeeId: r.employeeId, date: r.date })),
        remarks: revertRemarks || undefined,
      });
      setRevertResult(result);
      setShowRevertDialog(false);
      setRevertRemarks('');
      setSelectedKeys(new Set());
      fetchRows(page, search);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to revert';
      setRevertResult({ reverted: 0, leaveRequestsDeleted: 0, balancesRestored: 0, errors: [{ employeeId: '', date: '', message: msg }] });
      setShowRevertDialog(false);
    } finally {
      setRevertLoading(false);
    }
  };

  const handleOnHold = async () => {
    if (selectedRows.length === 0) return;
    setHoldLoading(true);
    try {
      const result = await attendanceService.putOnHold({
        organizationId,
        selectedRows: selectedRows.map((r) => ({ employeeId: r.employeeId, date: r.date })),
        holdAssociateCanModify,
        holdManagerCanModify,
        revertRegularization: holdRevertRegularization,
        reason: holdReason || undefined,
      });
      setHoldResult(result);
      setShowOnHoldDialog(false);
      setHoldReason('');
      setSelectedKeys(new Set());
      fetchRows(page, search);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to put on hold';
      setHoldResult({ updated: 0, errors: [{ employeeId: '', date: '', message: msg }] });
      setShowOnHoldDialog(false);
    } finally {
      setHoldLoading(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  if (!user) {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-gray-100 items-center justify-center p-8">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <BackNavigation to="/hr-activities/validation-process" label="Validation Process" />
      <AppHeader
        title="Revert / Validation On Hold"
        subtitle={organizationName ? organizationName : undefined}
        onLogout={handleLogout}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Breadcrumbs */}
        <div className="mb-4">
          <nav className="flex items-center text-sm text-gray-600" aria-label="Breadcrumb">
            <Link to="/hr-activities/validation-process" className="text-gray-500 hover:text-gray-900">
              HR Activities
            </Link>
            <span className="mx-1 text-gray-400">/</span>
            <Link to="/hr-activities/validation-process" className="text-gray-500 hover:text-gray-900">
              Validation Process
            </Link>
            <span className="mx-1 text-gray-400">/</span>
            <span className="font-semibold text-gray-900">Revert Process</span>
          </nav>
        </div>

        {/* Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/hr-activities/validation-process')}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back
            </button>
            <div className="text-sm text-gray-500">
              {fromDate && toDate ? `${fromDate} to ${toDate}` : 'Select date range'} &middot; <span className="font-medium text-gray-700">{total} completed/on-hold records</span>
            </div>
          </div>
          <div className="relative">
            <input
              type="text"
              placeholder="Search by name or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-9 pr-3 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-64"
            />
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 w-10">
                    <input type="checkbox" checked={rows.length > 0 && selectedKeys.size === rows.length} onChange={toggleSelectAll} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">#</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Associate Code</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Associate Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Date</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {!organizationId || !fromDate || !toDate ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">Open from Validation Process with organization and date range.</td></tr>
                ) : loading ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">Loading...</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">No completed/on-hold records found for the selected period.</td></tr>
                ) : rows.map((row, idx) => {
                  const key = rowKey(row);
                  return (
                    <tr key={key} className={`hover:bg-blue-50/40 ${selectedKeys.has(key) ? 'bg-blue-50' : ''}`}>
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selectedKeys.has(key)} onChange={() => toggleSelect(key)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                      </td>
                      <td className="px-4 py-3 text-gray-400">{(page - 1) * limit + idx + 1}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{row.employeeCode}</td>
                      <td className="px-4 py-3 text-gray-700">{row.employeeName}</td>
                      <td className="px-4 py-3 text-gray-700">{row.date}</td>
                      <td className="px-4 py-3 text-center">
                        {row.isOnHold ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">On Hold</span>
                        ) : row.isCompleted ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Completed</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Pending</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 text-sm text-gray-500">
              <span>Showing {(page - 1) * limit + 1}&ndash;{Math.min(page * limit, total)} of {total}</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => fetchRows(page - 1, search)} disabled={page === 1} className="h-8 px-3 rounded border border-gray-300 bg-white text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-40">Prev</button>
                <button type="button" onClick={() => fetchRows(page + 1, search)} disabled={page >= totalPages} className="h-8 px-3 rounded border border-gray-300 bg-white text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Action Bar */}
        <div className="mt-4 flex items-center justify-between bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-4">
          <div className="text-sm text-gray-600">
            {selectedKeys.size > 0 ? <span className="font-medium text-blue-700">{selectedKeys.size} selected</span> : 'Select rows to revert or put on hold'}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/hr-activities/validation-process')}
              className="h-9 px-4 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={selectedKeys.size === 0}
              onClick={() => setShowOnHoldDialog(true)}
              className="h-9 px-4 rounded-lg border border-orange-300 bg-orange-50 text-sm font-medium text-orange-700 hover:bg-orange-100 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Validation On Hold
            </button>
            <button
              type="button"
              disabled={selectedKeys.size === 0}
              onClick={() => setShowRevertDialog(true)}
              className="h-9 px-4 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
              Revert
            </button>
          </div>
        </div>
      </div>

      {/* Revert Confirmation Dialog */}
      {showRevertDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => !revertLoading && setShowRevertDialog(false)}>
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-md flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 bg-red-50 rounded-t-xl">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">Confirm Revert</h3>
                <p className="text-xs text-gray-500 mt-0.5">{selectedKeys.size} row(s) will be reverted</p>
              </div>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                <p className="font-medium mb-1">What will be reverted:</p>
                <ul className="list-disc list-inside space-y-0.5 text-xs">
                  <li>HR-applied leave deductions will be removed</li>
                  <li>Leave balances will be restored</li>
                  <li>Validation status will be set to Pending</li>
                </ul>
              </div>
              <textarea
                rows={2}
                value={revertRemarks}
                onChange={(e) => setRevertRemarks(e.target.value)}
                placeholder="Reason for revert..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
              />
            </div>
            <div className="flex justify-end gap-3 px-6 py-3 border-t border-gray-200 bg-gray-50 rounded-b-xl">
              <button type="button" onClick={() => { setShowRevertDialog(false); setRevertRemarks(''); }} disabled={revertLoading} className="h-9 px-4 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">Cancel</button>
              <button type="button" onClick={handleRevert} disabled={revertLoading} className="h-9 px-4 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 inline-flex items-center gap-1.5">
                {revertLoading ? (
                  <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Reverting...</>
                ) : (
                  <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>Yes, Revert</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revert Result Dialog */}
      {revertResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setRevertResult(null)}>
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-md flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className={`flex items-center gap-3 px-6 py-4 border-b border-gray-200 rounded-t-xl ${revertResult.errors.length > 0 ? 'bg-amber-50' : 'bg-blue-50'}`}>
              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${revertResult.errors.length > 0 ? 'bg-amber-100' : 'bg-blue-100'}`}>
                {revertResult.errors.length > 0 ? (
                  <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                ) : (
                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                )}
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">Revert {revertResult.errors.length > 0 ? 'Completed with Issues' : 'Successful'}</h3>
                <p className="text-xs text-gray-500 mt-0.5">Validation corrections have been undone</p>
              </div>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-blue-800">{revertResult.reverted}</p>
                  <p className="text-xs text-blue-600 mt-0.5">Records Reverted</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-red-800">{revertResult.leaveRequestsDeleted}</p>
                  <p className="text-xs text-red-600 mt-0.5">Leaves Removed</p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-blue-800">{revertResult.balancesRestored}</p>
                  <p className="text-xs text-blue-600 mt-0.5">Balances Restored</p>
                </div>
              </div>
              {revertResult.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-h-32 overflow-y-auto">
                  <p className="text-xs font-semibold text-red-700 mb-1">Errors ({revertResult.errors.length}):</p>
                  {revertResult.errors.map((e, i) => <p key={i} className="text-xs text-red-600">{e.message}</p>)}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-3 border-t border-gray-200 bg-gray-50 rounded-b-xl">
              <button type="button" onClick={() => setRevertResult(null)} className="h-9 px-4 rounded-lg bg-gray-800 text-white text-sm font-medium hover:bg-gray-700">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* On Hold Confirmation Dialog */}
      {showOnHoldDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => !holdLoading && setShowOnHoldDialog(false)}>
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-md flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 bg-orange-50 rounded-t-xl">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">Validation On Hold</h3>
                <p className="text-xs text-gray-500 mt-0.5">{selectedKeys.size} row(s) will be put on hold</p>
              </div>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-800">
                <p className="font-medium">Selected validation records will be temporarily frozen.</p>
                <p className="text-xs mt-1">They will not appear as completed until released.</p>
              </div>

              <div className="space-y-3">
                <label className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">Associate Can Modify</span>
                  <button type="button" onClick={() => setHoldAssociateCanModify(!holdAssociateCanModify)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${holdAssociateCanModify ? 'bg-blue-600' : 'bg-gray-200'}`}>
                    <span className={`inline-block h-4 w-4 rounded-full bg-white transition ${holdAssociateCanModify ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </label>
                <label className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">Managers Can Modify</span>
                  <button type="button" onClick={() => setHoldManagerCanModify(!holdManagerCanModify)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${holdManagerCanModify ? 'bg-blue-600' : 'bg-gray-200'}`}>
                    <span className={`inline-block h-4 w-4 rounded-full bg-white transition ${holdManagerCanModify ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </label>
                <label className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">Revert Regularization</span>
                  <button type="button" onClick={() => setHoldRevertRegularization(!holdRevertRegularization)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${holdRevertRegularization ? 'bg-blue-600' : 'bg-gray-200'}`}>
                    <span className={`inline-block h-4 w-4 rounded-full bg-white transition ${holdRevertRegularization ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </label>
              </div>

              <textarea
                rows={2}
                value={holdReason}
                onChange={(e) => setHoldReason(e.target.value)}
                placeholder="Reason for hold..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none"
              />
            </div>
            <div className="flex justify-end gap-3 px-6 py-3 border-t border-gray-200 bg-gray-50 rounded-b-xl">
              <button type="button" onClick={() => { setShowOnHoldDialog(false); setHoldReason(''); }} disabled={holdLoading} className="h-9 px-4 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">Cancel</button>
              <button type="button" onClick={handleOnHold} disabled={holdLoading} className="h-9 px-4 rounded-lg bg-orange-600 text-white text-sm font-medium hover:bg-orange-700 disabled:opacity-50 inline-flex items-center gap-1.5">
                {holdLoading ? (
                  <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Processing...</>
                ) : (
                  <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>Put On Hold</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* On Hold Result Dialog */}
      {holdResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setHoldResult(null)}>
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-md flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className={`flex items-center gap-3 px-6 py-4 border-b border-gray-200 rounded-t-xl ${holdResult.errors.length > 0 ? 'bg-amber-50' : 'bg-blue-50'}`}>
              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${holdResult.errors.length > 0 ? 'bg-amber-100' : 'bg-blue-100'}`}>
                {holdResult.errors.length > 0 ? (
                  <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                ) : (
                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                )}
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">{holdResult.errors.length > 0 ? 'On Hold with Issues' : 'On Hold Successful'}</h3>
                <p className="text-xs text-gray-500 mt-0.5">Selected records have been put on hold</p>
              </div>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-orange-800">{holdResult.updated}</p>
                <p className="text-xs text-orange-600 mt-0.5">Records Put On Hold</p>
              </div>
              {holdResult.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-h-32 overflow-y-auto">
                  <p className="text-xs font-semibold text-red-700 mb-1">Errors ({holdResult.errors.length}):</p>
                  {holdResult.errors.map((e, i) => <p key={i} className="text-xs text-red-600">{e.message}</p>)}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-3 border-t border-gray-200 bg-gray-50 rounded-b-xl">
              <button type="button" onClick={() => setHoldResult(null)} className="h-9 px-4 rounded-lg bg-gray-800 text-white text-sm font-medium hover:bg-gray-700">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
