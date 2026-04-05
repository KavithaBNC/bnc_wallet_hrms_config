import { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';
import shiftAssignmentRuleService, {
  ShiftAssignmentRule,
} from '../services/shiftAssignmentRule.service';
import employeeService, { Employee } from '../services/employee.service';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

function fullName(e: Employee): string {
  const parts = [e.firstName, e.middleName, e.lastName].filter(Boolean);
  return parts.join(' ').trim() || e.employeeCode || '—';
}

function associateDisplay(rule: ShiftAssignmentRule, nameMap: Map<string, string>): string {
  const ids = Array.isArray(rule.employeeIds) ? rule.employeeIds : [];
  if (ids.length === 0) return '';
  const names = ids.map((id) => nameMap.get(id) ?? id.slice(0, 8)).filter(Boolean);
  return names.length ? names.join(', ') : '';
}

// Overtime Type options
const OVERTIME_TYPES = [
  { id: 'OVERTIME', name: 'Over-time' },
  { id: 'COMP_OFF', name: 'Comp Off' },
  { id: 'OTHERS', name: 'Others' },
];

export default function OTUsageRulePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;
  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id || (user as any)?.organizationId;

  const [rules, setRules] = useState<ShiftAssignmentRule[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [overtimeType, setOvertimeType] = useState('OVERTIME');
  const [employeeNameMap, setEmployeeNameMap] = useState<Map<string, string>>(new Map());
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    new Set(['displayName', 'associate', 'paygroup', 'department', 'priority', 'action'])
  );
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

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
        remarksMarker: '__OT_USAGE_RULE_DATA__', // Filter for OT Usage Rule sub-module
      });
      setRules(result.rules || []);
      setPagination(result.pagination || { page: 1, limit: pageSize, total: 0, totalPages: 0 });
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : 'Failed to load rules';
      setError(String(msg || 'Failed to load rules'));
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
  }, [organizationId, page, pageSize, searchTerm, location.pathname]);

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };
    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showExportMenu]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleAdd = () => navigate('/attendance-policy/ot-usage-rule/add');

  const handleValidate = () => {
    alert('Validate functionality will be implemented.');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = async () => {
    setShowExportMenu(false);
    
    try {
      const result = await shiftAssignmentRuleService.getAll({
        organizationId: organizationId!,
        page: 1,
        limit: 10000,
        search: searchTerm.trim() || undefined,
        remarksMarker: '__OT_USAGE_RULE_DATA__', // Filter for OT Usage Rule sub-module
      });

      const allRules = result.rules || [];
      
      if (allRules.length === 0) {
        alert('No records to export.');
        return;
      }

      const headers = ['Display Name', 'Associate', 'Paygroup', 'Department', 'Priority'];
      const rows = allRules.map((rule) => {
        return [
          rule.displayName || '',
          associateDisplay(rule, employeeNameMap) || '—',
          rule.paygroup?.name ?? 'All',
          rule.department?.name ?? 'All',
          rule.priority != null ? String(rule.priority) : '—',
        ];
      });

      const csvContent = [headers, ...rows]
        .map((row) =>
          row
            .map((value) => {
              const safe = String(value ?? '').replace(/"/g, '""');
              return `"${safe}"`;
            })
            .join(',')
        )
        .join('\r\n');

      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `ot-usage-rule_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to export. Please try again.');
      console.error('Export error:', err);
    }
  };

  const handleExportPdf = async () => {
    setShowExportMenu(false);
    
    try {
      const result = await shiftAssignmentRuleService.getAll({
        organizationId: organizationId!,
        page: 1,
        limit: 10000,
        search: searchTerm.trim() || undefined,
        remarksMarker: '__OT_USAGE_RULE_DATA__', // Filter for OT Usage Rule sub-module
      });

      const allRules = result.rules || [];
      
      if (allRules.length === 0) {
        alert('No records to export.');
        return;
      }

      const rowsHtml = allRules
        .map((rule) => {
          const displayName = rule.displayName || '—';
          const associate = associateDisplay(rule, employeeNameMap) || '—';
          const paygroup = rule.paygroup?.name ?? 'All';
          const department = rule.department?.name ?? 'All';
          const priority = rule.priority != null ? String(rule.priority) : '—';

          return `<tr>
            <td>${displayName}</td>
            <td>${associate}</td>
            <td>${paygroup}</td>
            <td>${department}</td>
            <td>${priority}</td>
          </tr>`;
        })
        .join('');

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>OT Usage Rule Export</title>
            <style>
              body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 16px; }
              table { width: 100%; border-collapse: collapse; }
              th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; }
              th { background: #f3f4f6; text-align: left; }
            </style>
          </head>
          <body>
            <h2>OT Usage Rule</h2>
            <table>
              <thead>
                <tr>
                  <th>Display Name</th>
                  <th>Associate</th>
                  <th>Paygroup</th>
                  <th>Department</th>
                  <th>Priority</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
            <script>window.onload = function () { window.print(); };</script>
          </body>
        </html>
      `;

      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
      }
    } catch (err) {
      alert('Failed to export. Please try again.');
      console.error('Export error:', err);
    }
  };

  const handleEdit = (rule: ShiftAssignmentRule) => navigate(`/attendance-policy/ot-usage-rule/edit/${rule.id}`);

  const handleDelete = async (rule: ShiftAssignmentRule) => {
    if (!window.confirm(`Delete rule "${rule.displayName}"?`)) return;
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

  const toggleColumn = (column: string) => {
    setVisibleColumns((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(column)) {
        newSet.delete(column);
      } else {
        newSet.add(column);
      }
      return newSet;
    });
  };

  const totalPages = Math.max(1, pagination.totalPages);
  const startEntry = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const endEntry = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader
        title="Attendance Policy"
        subtitle={organizationName ? `Organization: ${organizationName}` : undefined}
        onLogout={handleLogout}
      />

      <main className="flex-1 min-h-0 overflow-auto w-full bg-gray-100">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 bg-gray-50">
          {/* Breadcrumbs - Employee module style */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
            <nav className="flex items-center gap-1.5 text-sm text-gray-500" aria-label="Breadcrumb">
              <span className="font-semibold text-gray-900">Attendance Policy</span>
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span className="text-gray-500">Attendance Policy</span>
              <span className="mx-1 text-gray-400">/</span>
              <span className="text-gray-500">OT Usage Rule</span>
            </nav>
          </div>

          <div className="bg-white rounded-lg shadow mb-6">
            {/* Header Section - Employee module style */}
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">OT Usage Rule</h2>
              <p className="text-gray-600 mt-1">Manage overtime usage rules</p>
            </div>

            {/* Filters and actions */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-500 mb-1.5">Overtime Type</label>
                  <select
                    value={overtimeType}
                    onChange={(e) => setOvertimeType(e.target.value)}
                    className="h-10 w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {OVERTIME_TYPES.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-500 mb-1.5">Search</label>
                  <input
                    type="text"
                    placeholder="All Column"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setPage(1);
                    }}
                    className="h-10 w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                  onClick={handleValidate}
                  className="h-9 px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 transition flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Validate
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
                <div className="relative" ref={exportMenuRef}>
                  <button
                    type="button"
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    className="h-9 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition flex items-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Export
                  </button>
                  {showExportMenu && (
                    <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1">
                      <button
                        type="button"
                        onClick={handleExportExcel}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Export Excel
                      </button>
                      <button
                        type="button"
                        onClick={handleExportPdf}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        Export PDF
                      </button>
                    </div>
                  )}
                </div>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowColumnMenu(!showColumnMenu)}
                    className="h-9 px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 transition flex items-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    Show / hide columns
                  </button>
                  {showColumnMenu && (
                    <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1">
                      {['displayName', 'associate', 'paygroup', 'department', 'priority'].map((col) => (
                        <label key={col} className="flex items-center px-4 py-2 hover:bg-gray-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={visibleColumns.has(col)}
                            onChange={() => toggleColumn(col)}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-700 capitalize">{col.replace(/([A-Z])/g, ' $1').trim()}</span>
                        </label>
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
                <button onClick={() => fetchList()} className="mt-2 text-sm underline hover:no-underline text-red-700">
                  Try again
                </button>
              </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                <tr>
                  {visibleColumns.has('displayName') && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Display Name</th>
                  )}
                  {visibleColumns.has('associate') && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Associate</th>
                  )}
                  {visibleColumns.has('paygroup') && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paygroup</th>
                  )}
                  {visibleColumns.has('department') && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                  )}
                  {visibleColumns.has('priority') && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                  )}
                  {visibleColumns.has('action') && (
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={visibleColumns.size} className="px-4 py-8 text-center text-gray-500">
                      Loading...
                    </td>
                  </tr>
                ) : rules.length === 0 ? (
                  <tr>
                    <td colSpan={visibleColumns.size} className="px-4 py-8 text-center text-gray-500">
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
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {associateDisplay(rule, employeeNameMap) || '—'}
                        </td>
                      )}
                      {visibleColumns.has('paygroup') && (
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {rule.paygroup?.name ?? 'All'}
                        </td>
                      )}
                      {visibleColumns.has('department') && (
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {rule.department?.name ?? 'All'}
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
                  ))
                )}
              </tbody>
              </table>
            </div>

            {/* Pagination footer */}
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
                    className="h-9 px-3 py-1 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition"
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
                <span className="h-9 px-3 py-1 bg-blue-600 text-white rounded-lg text-sm font-medium flex items-center">{page}</span>
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
