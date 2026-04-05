import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';
import validationProcessRuleService from '../services/validationProcessRule.service';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const VALIDATION_GROUPING_OPTIONS = [
  { value: 'Late', label: 'Late' },
  { value: 'Early Going', label: 'Early Going' },
  { value: 'Shortfall', label: 'Shortfall' },
  { value: 'Others', label: 'Others' },
];

const COLUMN_KEYS = [
  'displayName',
  'associate',
  'shift',
  'paygroup',
  'department',
  'effectiveDate',
  'priority',
  'action',
] as const;

type ColumnKey = (typeof COLUMN_KEYS)[number];

const COLUMN_LABELS: Record<ColumnKey, string> = {
  displayName: 'Display Name',
  associate: 'Associate',
  shift: 'Shift',
  paygroup: 'Paygroup',
  department: 'Department',
  effectiveDate: 'Effective Date',
  priority: 'Priority',
  action: 'Action',
};

export interface ValidationProcessRuleRow {
  id: string;
  displayName: string;
  associate: string;
  shift: string;
  paygroup: string;
  department: string;
  effectiveDate: string;
  priority: number | string;
}

function formatDate(d: string | undefined): string {
  if (!d) return '—';
  const date = new Date(d);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function ValidationProcessRulePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const isHrActivities = location.pathname.startsWith('/hr-activities');
  const basePath = isHrActivities ? '/hr-activities/validation-process' : '/others-configuration/validation-process-rule';
  const parentLabel = isHrActivities ? 'HR Activities' : 'Others Configuration';
  const listLabel = isHrActivities ? 'Validation Process' : 'Validation Process Rule';
  const parentPath = isHrActivities ? '/hr-activities' : '/others-configuration';
  const organizationName = user?.employee?.organization?.name;
  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id || (user as any)?.organizationId;

  const [rules, setRules] = useState<ValidationProcessRuleRow[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [validationGrouping, setValidationGrouping] = useState('Late');
  const [effectiveOn, setEffectiveOn] = useState(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(() => new Set(COLUMN_KEYS));
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const columnPickerRef = useRef<HTMLDivElement>(null);

  const toggleColumn = (col: ColumnKey) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col);
      else next.add(col);
      return next;
    });
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (columnPickerRef.current && !columnPickerRef.current.contains(e.target as Node)) {
        setShowColumnPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);
    validationProcessRuleService
      .getAll({
        organizationId,
        page,
        limit: pageSize,
        search: searchTerm || undefined,
        validationGrouping: validationGrouping || undefined,
        effectiveOn: effectiveOn || undefined,
      })
      .then((res) => {
        setRules(
          res.rules.map((r) => ({
            id: r.id,
            displayName: r.displayName,
            associate: Array.isArray(r.employeeIds) && r.employeeIds.length > 0 ? `${r.employeeIds.length} selected` : 'All',
            shift: Array.isArray(r.shiftIds) && r.shiftIds.length > 0 ? `${r.shiftIds.length} selected` : 'All',
            paygroup: Array.isArray(r.paygroupIds) && r.paygroupIds.length > 0 ? `${r.paygroupIds.length} selected` : '—',
            department: Array.isArray(r.departmentIds) && r.departmentIds.length > 0 ? `${r.departmentIds.length} selected` : 'All',
            effectiveDate: r.effectiveDate,
            priority: r.priority ?? '—',
          }))
        );
        setPagination({
          page: res.pagination.page,
          limit: res.pagination.limit,
          total: res.pagination.total,
          totalPages: res.pagination.totalPages,
        });
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load rules');
        setRules([]);
        setPagination({ page: 1, limit: pageSize, total: 0, totalPages: 0 });
      })
      .finally(() => setLoading(false));
  }, [organizationId, page, pageSize, validationGrouping, effectiveOn, searchTerm]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleAdd = () => {
    navigate(`${basePath}/add`);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSave = () => {
    // Bulk save not implemented; individual rules are saved via Add/Edit form
    alert('Rules are saved when you add or edit them. No bulk save.');
  };

  const handleEdit = (row: ValidationProcessRuleRow) => {
    navigate(`${basePath}/${row.id}/edit`);
  };

  const handleDelete = async (row: ValidationProcessRuleRow) => {
    if (!window.confirm(`Delete rule "${row.displayName}"?`)) return;
    try {
      await validationProcessRuleService.delete(row.id);
      setRules((prev) => prev.filter((r) => r.id !== row.id));
      setPagination((p) => ({ ...p, total: Math.max(0, p.total - 1) }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete rule');
    }
  };

  const totalPages = Math.max(1, pagination.totalPages);
  const startEntry = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const endEntry = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader
        title="Others Configuration"
        subtitle={organizationName ? `Organization: ${organizationName}` : undefined}
        onLogout={handleLogout}
      />

      <main className="flex-1 min-h-0 overflow-auto w-full bg-gray-100">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 bg-gray-50">
          {/* Breadcrumbs - same style as Employee / Late & Others */}
          <div className="mb-6">
            <nav className="flex items-center text-sm text-gray-600" aria-label="Breadcrumb">
              <Link to={parentPath} className="text-gray-500 hover:text-gray-900">
                {parentLabel}
              </Link>
              <span className="mx-1 text-gray-400">/</span>
              <span className="font-semibold text-gray-900">{listLabel}</span>
            </nav>
          </div>

          <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
            {/* Page title - Employee module style */}
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">{listLabel}</h2>
              <p className="text-gray-600 mt-1">Manage validation process rules by grouping and effective date</p>
            </div>

            {/* Filters and actions */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-500 mb-1.5">Validation Grouping</label>
                  <select
                    value={validationGrouping}
                    onChange={(e) => {
                      setValidationGrouping(e.target.value);
                      setPage(1);
                    }}
                    className="h-10 w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {VALIDATION_GROUPING_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-500 mb-1.5">Effective On</label>
                  <input
                    type="date"
                    value={effectiveOn}
                    onChange={(e) => {
                      setEffectiveOn(e.target.value);
                      setPage(1);
                    }}
                    className="h-10 w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-500 mb-1.5">Search</label>
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setPage(1);
                    }}
                    className="h-10 w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleAdd}
                  className="h-9 px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="h-9 px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 transition flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Print
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="h-9 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  Save
                </button>
                <div className="relative" ref={columnPickerRef}>
                  <button
                    type="button"
                    onClick={() => setShowColumnPicker((prev) => !prev)}
                    className="h-9 px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 transition flex items-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                    Show / hide columns
                  </button>
                  {showColumnPicker && (
                    <div className="absolute left-0 mt-1 py-1 w-52 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                      {COLUMN_KEYS.map((col) => (
                        <button
                          key={col}
                          type="button"
                          onClick={() => toggleColumn(col)}
                          className="w-full px-3 py-1.5 text-left text-sm flex items-center gap-2 hover:bg-gray-100"
                        >
                          <span className={visibleColumns.has(col) ? 'text-blue-600' : 'text-gray-400'}>
                            {visibleColumns.has(col) ? '✓' : '○'}
                          </span>
                          {COLUMN_LABELS[col]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {error && (
              <div className="px-6 py-4 bg-red-50 border-b border-red-200">
                <p className="font-semibold text-red-800">Error</p>
                <p className="text-sm mt-1 text-red-700">{error}</p>
              </div>
            )}

            {/* Table */}
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
                    {visibleColumns.has('shift') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Shift
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
                    {visibleColumns.has('action') && (
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Action
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan={visibleColumns.size || 8} className="px-4 py-8 text-center text-gray-500">
                        Loading...
                      </td>
                    </tr>
                  ) : rules.length === 0 ? (
                    <tr>
                      <td colSpan={visibleColumns.size || 8} className="px-4 py-8 text-center text-gray-500">
                        No rules found.
                      </td>
                    </tr>
                  ) : (
                    rules.map((rule) => (
                      <tr key={rule.id} className="hover:bg-gray-50">
                        {visibleColumns.has('displayName') && (
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                            {rule.displayName}
                          </td>
                        )}
                        {visibleColumns.has('associate') && (
                          <td className="px-4 py-3 text-sm text-gray-600">{rule.associate || '—'}</td>
                        )}
                        {visibleColumns.has('shift') && (
                          <td className="px-4 py-3 text-sm text-gray-600">{rule.shift || '—'}</td>
                        )}
                        {visibleColumns.has('paygroup') && (
                          <td className="px-4 py-3 text-sm text-gray-600">{rule.paygroup || '—'}</td>
                        )}
                        {visibleColumns.has('department') && (
                          <td className="px-4 py-3 text-sm text-gray-600">{rule.department || '—'}</td>
                        )}
                        {visibleColumns.has('effectiveDate') && (
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                            {formatDate(rule.effectiveDate)}
                          </td>
                        )}
                        {visibleColumns.has('priority') && (
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                            {rule.priority != null ? String(rule.priority) : '—'}
                          </td>
                        )}
                        {visibleColumns.has('action') && (
                          <td className="px-4 py-3 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => handleEdit(rule)}
                                className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded"
                                title="Edit"
                              >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                                  />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(rule)}
                                className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded"
                                title="Delete"
                              >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                  />
                                </svg>
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination footer - same as Late & Others / Employee */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-900">Show</label>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                    className="h-9 px-2 py-1 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 font-medium min-w-[4rem]"
                  >
                    {PAGE_SIZE_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <label className="text-sm font-medium text-gray-900">entries</label>
                </div>
                <div className="text-sm font-medium text-gray-900">
                  Showing {startEntry} to {endEntry} of {pagination.total} entries
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="h-9 px-3 py-1 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition"
                >
                  Previous
                </button>
                <span className="h-9 px-3 py-1 bg-blue-600 text-white rounded-lg text-sm font-medium flex items-center">
                  {page}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="h-9 px-3 py-1 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
