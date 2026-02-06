import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';
import shiftAssignmentRuleService, {
  ShiftAssignmentRule,
} from '../services/shiftAssignmentRule.service';
import employeeService, { Employee } from '../services/employee.service';

const PAGE_SIZE_OPTIONS = [10, 20, 50];

const COLUMN_KEYS = [
  'displayName',
  'associate',
  'paygroup',
  'department',
  'shift',
  'effectiveDate',
  'priority',
  'remarks',
  'action',
] as const;

const COLUMN_LABELS: Record<(typeof COLUMN_KEYS)[number], string> = {
  displayName: 'Display Name',
  associate: 'Associate',
  paygroup: 'Paygroup',
  department: 'Department',
  shift: 'Shift',
  effectiveDate: 'Effective Date',
  priority: 'Priority',
  remarks: 'Remarks',
  action: 'Action',
};

function fullName(e: Employee): string {
  const parts = [e.firstName, e.middleName, e.lastName].filter(Boolean);
  return parts.join(' ').trim() || e.employeeCode || '—';
}

function formatDate(d: string | undefined): string {
  if (!d) return '—';
  const date = new Date(d);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Markers for embedded rule data - strip from list view, show only user remarks */
const REMARKS_DATA_MARKERS = [
  '__POLICY_RULES__',
  '__WEEK_OFF_DATA__',
  '__HOLIDAY_DATA__',
  '__EVENT_RULE_DATA__',
  '__OT_USAGE_RULE_DATA__',
];

/** Extract user remarks for display; hide raw policy/rule JSON in list view */
function formatRemarksForDisplay(remarks: string | null | undefined): { text: string; hasPolicy: boolean } {
  if (!remarks || typeof remarks !== 'string') return { text: '—', hasPolicy: false };
  let earliestIdx = -1;
  for (const marker of REMARKS_DATA_MARKERS) {
    const idx = remarks.indexOf(marker);
    if (idx >= 0 && (earliestIdx === -1 || idx < earliestIdx)) earliestIdx = idx;
  }
  if (earliestIdx === -1) return { text: remarks.trim() || '—', hasPolicy: false };
  const userPart = remarks.slice(0, earliestIdx).trim();
  return { text: userPart || '—', hasPolicy: true };
}

function associateDisplay(rule: ShiftAssignmentRule, nameMap: Map<string, string>): string {
  const ids = Array.isArray(rule.employeeIds) ? rule.employeeIds : [];
  if (ids.length === 0) return '—';
  const names = ids.map((id) => nameMap.get(id) ?? id.slice(0, 8)).filter(Boolean);
  return names.length ? names.join(', ') : '—';
}

export default function ShiftAssignPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;
  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id;

  const [rules, setRules] = useState<ShiftAssignmentRule[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [asOnDate, setAsOnDate] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(COLUMN_KEYS as unknown as string[]));
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [employeeNameMap, setEmployeeNameMap] = useState<Map<string, string>>(new Map());

  const fetchList = async () => {
    if (!organizationId) return;
    try {
      setLoading(true);
      setError(null);
      const result = await shiftAssignmentRuleService.getAll({
        organizationId,
        search: searchTerm.trim() || undefined,
        page,
        limit: pageSize,
        excludeAttendancePolicyRules: true,
      });
      setRules(result.rules || []);
      setPagination(result.pagination || { page: 1, limit: pageSize, total: 0, totalPages: 0 });
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : 'Failed to load assignments';
      setError(String(msg || 'Failed to load assignments'));
      setRules([]);
      setPagination({ page: 1, limit: pageSize, total: 0, totalPages: 0 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!organizationId) return;
    employeeService
      .getAll({ organizationId, page: 1, limit: 2000, employeeStatus: 'ACTIVE' })
      .then((res) => {
        const list = res.employees || [];
        const map = new Map<string, string>();
        list.forEach((e) => map.set(e.id, fullName(e)));
        setEmployeeNameMap(map);
      })
      .catch(() => {});
  }, [organizationId]);

  useEffect(() => {
    if (organizationId) fetchList();
  }, [organizationId, page, pageSize, searchTerm]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleAdd = () => navigate('/time-attendance/shift-assign/add');

  const handleEdit = (rule: ShiftAssignmentRule) => {
    navigate(`/time-attendance/shift-assign/edit/${rule.id}`);
  };

  const handleDelete = async (rule: ShiftAssignmentRule) => {
    if (!window.confirm(`Delete assignment "${rule.displayName}"?`)) return;
    try {
      await shiftAssignmentRuleService.delete(rule.id);
      await fetchList();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : 'Failed to delete';
      setError(String(msg || 'Failed to delete'));
    }
  };

  const toggleColumn = (key: string) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const totalPages = Math.max(1, pagination.totalPages);
  const startEntry = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const endEntry = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader
        title="Shift Assign"
        subtitle={organizationName ? `Organization: ${organizationName}` : undefined}
        onLogout={handleLogout}
      />

      <main className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-6 bg-gray-50">
        <div className="w-full max-w-[1600px] mx-auto">
          {/* Breadcrumbs + Add - match Employee list */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
            <nav className="flex items-center gap-1.5 text-sm text-gray-500" aria-label="Breadcrumb">
              <span className="font-semibold text-gray-900">Time attendance</span>
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-gray-500">Time attendance</span>
              <span className="mx-1 text-gray-400">/</span>
              <span className="text-gray-500">Shift Assign</span>
            </nav>
            <button
              type="button"
              onClick={handleAdd}
              className="h-9 px-4 py-2 rounded-lg bg-orange-500 text-white font-medium text-sm hover:bg-orange-600 transition"
            >
              + Add Assignment
            </button>
          </div>

          {/* Filters - match Employee list (label above, grid) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-500 mb-1.5">Search</label>
              <input
                type="text"
                placeholder="Search assignments..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="h-10 w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-700 placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-500 mb-1.5">As on Date</label>
              <input
                type="date"
                value={asOnDate}
                onChange={(e) => setAsOnDate(e.target.value)}
                className="h-10 w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            <div className="flex flex-col sm:col-span-2 lg:col-span-1">
              <label className="text-sm font-medium text-gray-500 mb-1.5">Columns</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowColumnPicker((v) => !v)}
                  className="h-10 w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-100 flex items-center justify-between"
                >
                  <span>Show / hide columns</span>
                  <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showColumnPicker && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowColumnPicker(false)} aria-hidden="true" />
                    <div className="absolute left-0 mt-1 w-56 py-2 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
                      {COLUMN_KEYS.filter((k) => k !== 'action').map((key) => (
                        <label key={key} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={visibleColumns.has(key)}
                            onChange={() => toggleColumn(key)}
                            className="rounded border-gray-300"
                          />
                          <span className="text-sm text-gray-700">{COLUMN_LABELS[key]}</span>
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Summary cards - match Employee list */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex items-center gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#333333] flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500">Total Assignments</div>
                <div className="text-2xl font-bold text-gray-900">{pagination.total}</div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex items-center gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#4CAF50] flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500">On This Page</div>
                <div className="text-2xl font-bold text-gray-900">{rules.length}</div>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              <p className="font-semibold">Error loading assignments</p>
              <p className="text-sm mt-1">{error}</p>
              <button onClick={() => fetchList()} className="mt-2 text-sm underline hover:no-underline">
                Try again
              </button>
            </div>
          )}

          {/* Table card - match Employee list */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>Row Per Page</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="h-9 px-3 py-1 bg-white border border-gray-300 rounded text-gray-700 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                >
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n} Entries
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {visibleColumns.has('displayName') && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Display Name
                    </th>
                  )}
                  {visibleColumns.has('associate') && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Associate
                    </th>
                  )}
                  {visibleColumns.has('paygroup') && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Paygroup
                    </th>
                  )}
                  {visibleColumns.has('department') && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Department
                    </th>
                  )}
                  {visibleColumns.has('shift') && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Shift
                    </th>
                  )}
                  {visibleColumns.has('effectiveDate') && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Effective Date
                    </th>
                  )}
                  {visibleColumns.has('priority') && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Priority
                    </th>
                  )}
                  {visibleColumns.has('remarks') && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Remarks
                    </th>
                  )}
                  {visibleColumns.has('action') && (
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={COLUMN_KEYS.length} className="px-4 py-8 text-center text-gray-500">
                      Loading...
                    </td>
                  </tr>
                ) : rules.length === 0 ? (
                  <tr>
                    <td colSpan={COLUMN_KEYS.length} className="px-4 py-8 text-center text-gray-500">
                      No shift assignments found.
                    </td>
                  </tr>
                ) : (
                  rules.map((rule) => {
                    const remarksDisplay = formatRemarksForDisplay(rule.remarks);
                    return (
                    <tr key={rule.id} className="hover:bg-gray-50">
                      {visibleColumns.has('displayName') && (
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                          {rule.displayName}
                        </td>
                      )}
                      {visibleColumns.has('associate') && (
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {associateDisplay(rule, employeeNameMap)}
                        </td>
                      )}
                      {visibleColumns.has('paygroup') && (
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                          {rule.paygroup?.name ?? '—'}
                        </td>
                      )}
                      {visibleColumns.has('department') && (
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                          {rule.department?.name ?? '—'}
                        </td>
                      )}
                      {visibleColumns.has('shift') && (
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                          {rule.shift?.name ?? '—'}
                        </td>
                      )}
                      {visibleColumns.has('effectiveDate') && (
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                          {formatDate(rule.effectiveDate)}
                        </td>
                      )}
                      {visibleColumns.has('priority') && (
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {rule.priority != null ? String(rule.priority) : '—'}
                        </td>
                      )}
                      {visibleColumns.has('remarks') && (
                        <td className="px-4 py-3 text-sm text-gray-500 max-w-[200px]" title={remarksDisplay.text || undefined}>
                          {remarksDisplay.text}
                        </td>
                      )}
                      {visibleColumns.has('action') && (
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleEdit(rule)}
                              className="p-2 text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded"
                              title="Edit"
                            >
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(rule)}
                              className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded"
                              title="Delete"
                            >
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

            {pagination.total > 0 && (
              <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between flex-wrap gap-2">
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{startEntry}</span> to <span className="font-medium">{endEntry}</span> of <span className="font-medium">{pagination.total}</span> results
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="px-3 py-1.5 text-sm text-gray-600">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
