import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/layout/AppHeader';
import Modal from '../components/common/Modal';
import employeeSeparationService, { EmployeeSeparation } from '../services/employeeSeparation.service';
import { useAuthStore } from '../store/authStore';

const SEPARATION_TYPES: { value: string; label: string }[] = [
  { value: 'RESIGNATION', label: 'Resignation' },
  { value: 'TERMINATION', label: 'Termination' },
  { value: 'RETIREMENT', label: 'Retirement' },
  { value: 'CONTRACT_END', label: 'Contract End' },
  { value: 'ABSONDING', label: 'Absonding' },
  { value: 'OTHER', label: 'Other' },
];

const NOTICE_PERIOD_REASONS: { value: string; label: string }[] = [
  { value: '', label: '-- Select --' },
  { value: 'WAIVED', label: 'Waived' },
  { value: 'BUYOUT', label: 'Buyout' },
  { value: 'SHORT_NOTICE', label: 'Short Notice' },
  { value: 'OTHER', label: 'Other' },
];

const REASONS_OF_LEAVING: { value: string; label: string }[] = [
  { value: '', label: '-- Select --' },
  { value: 'BETTER_OPPORTUNITY', label: 'Better Opportunity' },
  { value: 'PERSONAL', label: 'Personal' },
  { value: 'RELOCATION', label: 'Relocation' },
  { value: 'RETIREMENT', label: 'Retirement' },
  { value: 'TERMINATED', label: 'Terminated' },
  { value: 'CONTRACT_END', label: 'Contract End' },
  { value: 'OTHER', label: 'Other' },
];

const readOnlyInputClass =
  'w-full bg-gray-50 rounded-lg border border-gray-200 py-2.5 px-3 text-gray-900 cursor-default';
const readOnlySelectClass =
  'w-full bg-gray-50 rounded-lg border border-gray-200 py-2.5 pl-3 pr-10 text-gray-900 cursor-default flex items-center';
const dateIconClass = 'absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none';
const selectIconClass = 'absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none';

function formatDate(d: string) {
  if (!d) return '—';
  const date = new Date(d);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function EmployeeRejoinPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id;
  const organizationName = user?.employee?.organization?.name;

  const [separations, setSeparations] = useState<EmployeeSeparation[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [separationTypeFilter, setSeparationTypeFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewSeparation, setViewSeparation] = useState<EmployeeSeparation | null>(null);
  const [loadingSeparation, setLoadingSeparation] = useState(false);
  type SortKey = 'employeeCode' | 'employeeName' | 'resignationApplyDate' | 'relievingDate' | 'separationType';
  type SortOrder = 'asc' | 'desc';
  const [sortBy, setSortBy] = useState<SortKey>('relievingDate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const fetchList = async () => {
    if (!organizationId) return;
    try {
      setLoading(true);
      setError(null);
      const result = await employeeSeparationService.getAll({
        organizationId,
        search: searchTerm || undefined,
        page,
        limit: pageSize,
        sortBy: 'relievingDate',
        sortOrder: 'desc',
      });
      setSeparations(result.separations);
      setPagination(result.pagination);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load separation list');
      setSeparations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, [organizationId, page, pageSize, searchTerm]);

  const filteredSeparations =
    separationTypeFilter === 'ALL'
      ? separations
      : separations.filter((s) => s.separationType === separationTypeFilter);

  const sortedSeparations = useMemo(() => {
    const list = [...filteredSeparations];
    const mult = sortOrder === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      let cmp = 0;
      const codeA = a.employee?.employeeCode ?? '';
      const codeB = b.employee?.employeeCode ?? '';
      const nameA = a.employee ? `${a.employee.firstName} ${a.employee.lastName}`.trim() : '';
      const nameB = b.employee ? `${b.employee.firstName} ${b.employee.lastName}`.trim() : '';
      if (sortBy === 'employeeCode') cmp = codeA.localeCompare(codeB);
      else if (sortBy === 'employeeName') cmp = nameA.localeCompare(nameB);
      else if (sortBy === 'resignationApplyDate') cmp = (a.resignationApplyDate ?? '').localeCompare(b.resignationApplyDate ?? '');
      else if (sortBy === 'relievingDate') cmp = (a.relievingDate ?? '').localeCompare(b.relievingDate ?? '');
      else if (sortBy === 'separationType') cmp = (a.separationType ?? '').localeCompare(b.separationType ?? '');
      return mult * cmp;
    });
    return list;
  }, [filteredSeparations, sortBy, sortOrder]);

  const handleSort = (key: SortKey) => {
    setSortOrder((prev) => (sortBy === key && prev === 'asc' ? 'desc' : 'asc'));
    setSortBy(key);
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortBy !== column) return <span className="inline-block w-4 opacity-0 group-hover:opacity-40">↕</span>;
    return sortOrder === 'asc' ? <span className="inline-block w-4 text-gray-700">↑</span> : <span className="inline-block w-4 text-gray-700">↓</span>;
  };

  const resignationCount = separations.filter((s) => s.separationType === 'RESIGNATION').length;
  const terminationCount = separations.filter((s) => s.separationType === 'TERMINATION').length;
  const thisYearCount = separations.filter((s) => {
    const y = new Date(s.relievingDate).getFullYear();
    return y === new Date().getFullYear();
  }).length;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleViewSeparation = async (id: string) => {
    setLoadingSeparation(true);
    try {
      const sep = await employeeSeparationService.getById(id);
      setViewSeparation(sep);
      setShowViewModal(true);
    } catch (_) {
      setViewSeparation(null);
      setShowViewModal(false);
    } finally {
      setLoadingSeparation(false);
    }
  };

  const handleRejoinEmployee = (employeeId: string) => {
    navigate(`/payroll/employee-rejoin/edit/${employeeId}`);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-50">
      <AppHeader
        title="Employee Rejoin"
        subtitle={organizationName ? `Organization: ${organizationName}` : 'Separation list'}
        onLogout={handleLogout}
      />

      <main className="flex-1 min-h-0 overflow-auto w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Breadcrumb */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <nav className="flex items-center gap-2 text-sm text-gray-600">
            <span className="font-semibold text-gray-900">Payroll Master</span>
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-gray-700">Employee Rejoin</span>
          </nav>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1.5">Separation Type</label>
            <select
              value={separationTypeFilter}
              onChange={(e) => { setSeparationTypeFilter(e.target.value); setPage(1); }}
              className="w-full h-10 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="ALL">All Types</option>
              {SEPARATION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1.5">Search</label>
            <input
              type="text"
              placeholder="Code, name..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              className="w-full h-10 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex items-center gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500">Total Separations</div>
              <div className="text-2xl font-bold text-gray-900">{pagination.total}</div>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex items-center gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#4CAF50] flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500">Resignation</div>
              <div className="text-2xl font-bold text-gray-900">{resignationCount}</div>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex items-center gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#F44336] flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500">Termination</div>
              <div className="text-2xl font-bold text-gray-900">{terminationCount}</div>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex items-center gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#2196F3] flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500">This Year</div>
              <div className="text-2xl font-bold text-gray-900">{thisYearCount}</div>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            <p className="font-semibold">Error loading separation list</p>
            <p className="text-sm mt-1">{error}</p>
            <button onClick={() => organizationId && fetchList()} className="mt-2 text-sm underline hover:no-underline">
              Try again
            </button>
          </div>
        )}

        {loading && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200">
              <div className="h-9 w-32 bg-gray-200 rounded animate-pulse" />
            </div>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee Code</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resignation Apply Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Relieving Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Separation Type</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {[1, 2, 3, 4, 5].map((i) => (
                  <tr key={i}>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-16 animate-pulse" /></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-28 animate-pulse" /></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-24 animate-pulse" /></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-24 animate-pulse" /></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-20 animate-pulse" /></td>
                    <td className="px-6 py-4 text-right"><div className="h-4 bg-gray-200 rounded w-16 ml-auto animate-pulse" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>Row Per Page</span>
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                  className="h-9 px-3 py-1 bg-white border border-gray-300 rounded text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value={10}>10 Entries</option>
                  <option value={20}>20 Entries</option>
                  <option value={50}>50 Entries</option>
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 table-fixed">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="w-[14%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button type="button" onClick={() => handleSort('employeeCode')} className="inline-flex items-center gap-1 group font-medium">
                        Employee Code <SortIcon column="employeeCode" />
                      </button>
                    </th>
                    <th className="w-[20%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button type="button" onClick={() => handleSort('employeeName')} className="inline-flex items-center gap-1 group font-medium">
                        Employee Name <SortIcon column="employeeName" />
                      </button>
                    </th>
                    <th className="w-[18%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button type="button" onClick={() => handleSort('resignationApplyDate')} className="inline-flex items-center gap-1 group font-medium">
                        Resignation Apply Date <SortIcon column="resignationApplyDate" />
                      </button>
                    </th>
                    <th className="w-[18%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button type="button" onClick={() => handleSort('relievingDate')} className="inline-flex items-center gap-1 group font-medium">
                        Relieving Date <SortIcon column="relievingDate" />
                      </button>
                    </th>
                    <th className="w-[16%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button type="button" onClick={() => handleSort('separationType')} className="inline-flex items-center gap-1 group font-medium">
                        Separation Type <SortIcon column="separationType" />
                      </button>
                    </th>
                    <th className="w-[14%] px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedSeparations.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                        {searchTerm || separationTypeFilter !== 'ALL'
                          ? 'No separations found matching your filters'
                          : 'No separation records yet.'}
                      </td>
                    </tr>
                  ) : (
                    sortedSeparations.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50">
                        <td className="w-[14%] px-4 py-4 whitespace-nowrap text-sm font-mono text-gray-900 text-left truncate">
                          {row.employee?.employeeCode ?? '—'}
                        </td>
                        <td className="w-[20%] px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-left truncate">
                          {row.employee
                            ? `${row.employee.firstName} ${row.employee.lastName}`.trim()
                            : '—'}
                        </td>
                        <td className="w-[18%] px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-left">{formatDate(row.resignationApplyDate)}</td>
                        <td className="w-[18%] px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-left">{formatDate(row.relievingDate)}</td>
                        <td className="w-[16%] px-4 py-4 whitespace-nowrap text-left">
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                            {SEPARATION_TYPES.find((t) => t.value === row.separationType)?.label ?? row.separationType}
                          </span>
                        </td>
                        <td className="w-[14%] px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            type="button"
                            onClick={() => handleViewSeparation(row.id)}
                            disabled={loadingSeparation}
                            className="text-indigo-600 hover:text-indigo-900 p-1.5 rounded hover:bg-indigo-50 inline-flex items-center justify-center"
                            title="View separation"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                          {row.employee?.id && (
                            <button
                              type="button"
                              onClick={() => handleRejoinEmployee(row.employee!.id)}
                              className="text-amber-600 hover:text-amber-900 p-1.5 rounded hover:bg-amber-50 inline-flex items-center justify-center ml-1"
                              title="Rejoin (create new employee record)"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {pagination.total > 0 && (
              <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between flex-wrap gap-2">
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{(page - 1) * pagination.limit + 1}</span> to{' '}
                  <span className="font-medium">{Math.min(page * pagination.limit, pagination.total)}</span> of{' '}
                  <span className="font-medium">{pagination.total}</span> results
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
                    Page {page} of {Math.max(1, pagination.totalPages)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                    disabled={page >= pagination.totalPages || pagination.totalPages === 0}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Separation view modal – same layout as Employee Separation form (read-only) */}
        <Modal
          isOpen={showViewModal}
          onClose={() => { setShowViewModal(false); setViewSeparation(null); }}
          title="Employee Separation"
          size="lg"
        >
          {loadingSeparation ? (
            <div className="p-6 text-center text-gray-500">Loading...</div>
          ) : viewSeparation ? (
            <div className="space-y-4">
              {/* Employee * */}
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1.5">
                  Employee <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className={readOnlySelectClass}>
                    {viewSeparation.employee
                      ? `${viewSeparation.employee.employeeCode ?? ''} - ${[viewSeparation.employee.firstName, viewSeparation.employee.lastName].filter(Boolean).join(' ')}`.trim()
                      : '—'}
                  </div>
                  <svg className={`w-5 h-5 ${selectIconClass}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Resignation Apply Date * */}
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1.5">
                  Resignation Apply Date <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    readOnly
                    value={formatDate(viewSeparation.resignationApplyDate)}
                    className={readOnlyInputClass}
                  />
                  <svg className={`w-5 h-5 ${dateIconClass}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>

              {/* Notice Period (days) * */}
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1.5">
                  Notice Period (days) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  readOnly
                  value={String(viewSeparation.noticePeriod)}
                  className={readOnlyInputClass}
                />
              </div>

              {/* Notice Period Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1.5">Notice Period Reason</label>
                <div className="relative">
                  <div className={readOnlySelectClass}>
                    {NOTICE_PERIOD_REASONS.find((r) => r.value === viewSeparation.noticePeriodReason)?.label ??
                      viewSeparation.noticePeriodReason ??
                      '—'}
                  </div>
                  <svg className={`w-5 h-5 ${selectIconClass}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Relieving Date * */}
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1.5">
                  Relieving Date <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    readOnly
                    value={formatDate(viewSeparation.relievingDate)}
                    className={readOnlyInputClass}
                  />
                  <svg className={`w-5 h-5 ${dateIconClass}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>

              {/* Reason of Leaving */}
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1.5">Reason of Leaving</label>
                <div className="relative">
                  <div className={readOnlySelectClass}>
                    {REASONS_OF_LEAVING.find((r) => r.value === viewSeparation.reasonOfLeaving)?.label ??
                      viewSeparation.reasonOfLeaving ??
                      '—'}
                  </div>
                  <svg className={`w-5 h-5 ${selectIconClass}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Separation Type * */}
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1.5">
                  Separation Type <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className={readOnlySelectClass}>
                    {SEPARATION_TYPES.find((t) => t.value === viewSeparation.separationType)?.label ??
                      viewSeparation.separationType}
                  </div>
                  <svg className={`w-5 h-5 ${selectIconClass}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {viewSeparation.remarks && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1.5">Remarks</label>
                  <div className={`${readOnlyInputClass} min-h-[80px] whitespace-pre-wrap`}>
                    {viewSeparation.remarks}
                  </div>
                </div>
              )}

              <div className="pt-4 flex justify-end border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => { setShowViewModal(false); setViewSeparation(null); }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back
                </button>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-gray-500">Failed to load separation details.</div>
          )}
        </Modal>
      </main>
    </div>
  );
}
