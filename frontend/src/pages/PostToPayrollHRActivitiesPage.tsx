import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';
import postToPayrollService from '../services/postToPayroll.service';
import type { PostToPayrollMapping } from '../services/postToPayroll.service';

/**
 * HR Activities > Post to Payroll – filter by Month & Associate, then Delete / Post / Export.
 * This is a different page from Others Configuration > Post to Payroll (mapping config).
 */
export default function PostToPayrollHRActivitiesPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id;
  const organizationName = user?.employee?.organization?.name;

  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [associate, setAssociate] = useState('');
  const [showAll, setShowAll] = useState(true);

  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [mappings, setMappings] = useState<PostToPayrollMapping[]>([]);
  const [postStatus, setPostStatus] = useState<{ posted: boolean; status: string | null }>({
    posted: false,
    status: null,
  });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [year, monthNum] = month.includes('-')
    ? month.split('-').map((x) => parseInt(x, 10))
    : [new Date().getFullYear(), new Date().getMonth() + 1];

  const fetchPreview = async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { rows: r, mappings: m } = await postToPayrollService.getPreview(
        organizationId,
        year,
        monthNum,
        associate?.trim() || undefined,
        showAll
      );
      setRows(r);
      setMappings(m);
    } catch (err: unknown) {
      const backendMsg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      const msg = backendMsg || 'Failed to load preview';
      setError(msg);
      setRows([]);
      setMappings([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchPostStatus = async () => {
    if (!organizationId) return;
    try {
      const s = await postToPayrollService.getPostStatus(organizationId, year, monthNum);
      setPostStatus({ posted: s.posted, status: s.status });
    } catch {
      setPostStatus({ posted: false, status: null });
    }
  };

  useEffect(() => {
    fetchPreview();
  }, [organizationId, year, monthNum, associate, showAll]);

  useEffect(() => {
    fetchPostStatus();
  }, [organizationId, year, monthNum]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleDelete = async () => {
    if (!organizationId) return;
    if (!postStatus.posted) {
      setError('No payroll cycle to delete. Month is not posted.');
      return;
    }
    if (postStatus.status !== 'DRAFT') {
      setError(`Cannot delete – payroll cycle is ${postStatus.status}. Only DRAFT can be unposted.`);
      return;
    }
    if (!window.confirm(`Unpost ${month}? This will delete the DRAFT payroll cycle.`)) return;
    setActionLoading(true);
    setError(null);
    try {
      await postToPayrollService.unpostMonth(organizationId, year, monthNum);
      await fetchPostStatus();
      await fetchPreview();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : 'Failed to unpost';
      setError(String(msg));
    } finally {
      setActionLoading(false);
    }
  };

  const handlePost = async () => {
    if (!organizationId) return;
    if (postStatus.posted) {
      setError(`Month already posted (${postStatus.status}).`);
      return;
    }
    if (!window.confirm(`Post ${month} to payroll? This creates a DRAFT payroll cycle. Month must be locked.`))
      return;
    setActionLoading(true);
    setError(null);
    try {
      await postToPayrollService.postMonth(organizationId, year, monthNum);
      await fetchPostStatus();
      await fetchPreview();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : 'Failed to post';
      setError(String(msg));
    } finally {
      setActionLoading(false);
    }
  };

  const handleExport = () => {
    if (rows.length === 0) {
      setError('No data to export.');
      return;
    }
    const cols = ['employeeCode', 'employeeName', ...mappings.map((m) => m.columnKey)];
    const header = cols.join(',');
    const lines = rows.map((r) =>
      cols.map((c) => {
        const v = r[c];
        const s = v === null || v === undefined ? '' : String(v);
        return s.includes(',') ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(',')
    );
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `post-to-payroll-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!user) {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-gray-100 items-center justify-center p-8">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader
        title="HR Activities"
        subtitle={organizationName ? `Organization: ${organizationName}` : undefined}
        onLogout={handleLogout}
      />

      <main className="flex-1 min-h-0 overflow-auto w-full bg-gray-100">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-6 bg-gray-50">
          {/* Breadcrumbs */}
          <div className="mb-6">
            <nav className="flex items-center text-sm text-gray-600" aria-label="Breadcrumb">
              <Link to="/hr-activities/validation-process" className="text-gray-500 hover:text-gray-900">
                HR Activities
              </Link>
              <span className="mx-1 text-gray-400">/</span>
              <span className="font-semibold text-gray-900">Post to Payroll</span>
            </nav>
          </div>

          <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-white">
              <h1 className="text-2xl font-bold text-gray-900">Post to Payroll</h1>
              <p className="text-sm text-gray-600 mt-1">
                Preview attendance data for the month. Post creates a DRAFT payroll cycle (month must be locked).
              </p>
              {postStatus.posted && (
                <p className="text-sm text-amber-700 mt-1 font-medium">
                  Status: Posted ({postStatus.status})
                </p>
              )}
            </div>

            {/* Filters */}
            <div className="px-6 py-5 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-900 pb-2 mb-4 border-b-2 border-gray-300">
                Filters
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Month</label>
                  <input
                    type="month"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    className="w-full h-10 pl-4 pr-10 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Associate</label>
                  <input
                    type="text"
                    value={associate}
                    onChange={(e) => setAssociate(e.target.value)}
                    placeholder="Employee code or name"
                    className="w-full h-10 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white placeholder-gray-400 focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">Show All columns</span>
                <span className="text-sm text-gray-500">:</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={showAll}
                  onClick={() => setShowAll((v) => !v)}
                  className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 ${
                    showAll ? 'bg-orange-500' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition ${
                      showAll ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
                <span className="text-sm font-medium text-gray-700">{showAll ? 'YES' : 'NO'}</span>
              </div>
            </div>

            {!organizationId && (
              <div className="px-6 py-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                No organization assigned.
              </div>
            )}

            {organizationId && (
              <>
                {error && (
                  <div className="mx-6 mt-4 rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
                    {error}
                  </div>
                )}

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Code
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Name
                        </th>
                        {mappings.map((m) => (
                          <th
                            key={m.id}
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                          >
                            {m.columnName || m.columnKey}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {loading ? (
                        <tr>
                          <td colSpan={2 + mappings.length} className="px-4 py-8 text-center text-gray-500 text-sm">
                            Loading…
                          </td>
                        </tr>
                      ) : rows.length === 0 ? (
                        <tr>
                          <td colSpan={2 + mappings.length} className="px-4 py-8 text-center text-gray-500 text-sm">
                            No data for this month. Ensure summaries are built and finalized/locked.
                          </td>
                        </tr>
                      ) : (
                        rows.map((row, i) => (
                          <tr key={(row.employeeId as string) || i} className="hover:bg-gray-50">
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {String(row.employeeCode ?? '')}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {String(row.employeeName ?? '')}
                            </td>
                            {mappings.map((m) => (
                              <td key={m.id} className="px-4 py-2 text-sm text-gray-700">
                                {String(row[m.columnKey] ?? '')}
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Footer actions */}
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex flex-wrap justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={actionLoading || !postStatus.posted || postStatus.status !== 'DRAFT'}
                    className="h-9 px-4 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 hover:text-red-700 hover:border-red-300 disabled:opacity-50 disabled:cursor-not-allowed transition inline-flex items-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Unpost
                  </button>
                  <button
                    type="button"
                    onClick={handlePost}
                    disabled={actionLoading || postStatus.posted}
                    className="h-9 px-4 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition inline-flex items-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                    {actionLoading ? 'Posting…' : 'Post'}
                  </button>
                  <button
                    type="button"
                    onClick={handleExport}
                    disabled={rows.length === 0}
                    className="h-9 px-4 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition inline-flex items-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Export
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
