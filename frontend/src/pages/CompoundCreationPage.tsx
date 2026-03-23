import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { getModulePermissions } from '../config/configurator-module-mapping';
import AppHeader from '../components/layout/AppHeader';
import BackNavigation from '../components/common/BackNavigation';
import compoundService, { type Compound } from '../services/compound.service';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const COMPONENT_TYPE_OPTIONS = ['MASTER', 'TRANSACTION', 'PAYROLL', 'EARNING', 'DEDUCTION', 'ATTENDANCE', 'LEAVE', 'REIMBURSEMENT', 'All'];
const TYPE_OPTIONS = ['TEXT', 'TEXTAREA', 'NUMBER', 'DECIMAL', 'DATE', 'DROPDOWN', 'MULTI_SELECT', 'CHECKBOX', 'RADIO', 'FILE', 'EMAIL', 'PHONE', 'PERCENTAGE', 'CURRENCY', 'All'];
const ALL_ENTRIES_VALUE = 9999;

export default function CompoundCreationPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;
  const organizationId = user?.employee?.organizationId || (user?.employee?.organization as { id?: string } | undefined)?.id;

  const [compounds, setCompounds] = useState<Compound[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [legendOpen, setLegendOpen] = useState(false);
  const [filterShortName, setFilterShortName] = useState('');
  const [filterLongName, setFilterLongName] = useState('');
  const [filterComponentType, setFilterComponentType] = useState('All');
  const [filterType, setFilterType] = useState('All');
  const [filterComponentDetails, setFilterComponentDetails] = useState('');

  const fetchComponents = useCallback(() => {
    if (!organizationId) {
      setLoading(false);
      setCompounds([]);
      setTotal(0);
      return;
    }
    setLoading(true);
    setListError(null);
    compoundService
      .getAll({
        organizationId,
        page,
        limit: pageSize === ALL_ENTRIES_VALUE ? 9999 : pageSize,
        search: searchTerm.trim() || undefined,
        componentType: filterComponentType && filterComponentType !== 'All' ? filterComponentType : undefined,
        type: filterType && filterType !== 'All' ? filterType : undefined,
      })
      .then((res) => {
        setCompounds(res.compounds);
        setTotal(res.pagination.total);
      })
      .catch(() => {
        setListError('Failed to load components.');
        setCompounds([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [organizationId, page, pageSize, searchTerm, filterComponentType, filterType]);

  useEffect(() => {
    fetchComponents();
  }, [fetchComponents]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleAdd = () => {
    navigate('/core-hr/compound-creation/add');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSave = () => {
    alert('Save – bulk save can be implemented if needed.');
  };

  const handleEdit = (row: Compound) => {
    navigate(`/core-hr/compound-creation/edit/${row.id}`);
  };

  const handleDelete = async (row: Compound) => {
    if (!window.confirm(`Delete component "${row.longName}"?`)) return;
    try {
      await compoundService.delete(row.id);
      setCompounds((prev) => prev.filter((c) => c.id !== row.id));
      setTotal((t) => Math.max(0, t - 1));
    } catch {
      setListError('Failed to delete component.');
    }
  };

  // Client-side filter by Short Name / Long Name (filter row)
  const filteredRows = compounds.filter((r) => {
    if (filterShortName.trim()) {
      if (!r.shortName.toLowerCase().includes(filterShortName.toLowerCase())) return false;
    }
    if (filterLongName.trim()) {
      if (!r.longName.toLowerCase().includes(filterLongName.toLowerCase())) return false;
    }
    return true;
  });

  const effectivePageSize = pageSize === ALL_ENTRIES_VALUE ? Math.max(1, total) : pageSize;
  const totalPages = Math.max(1, Math.ceil(total / effectivePageSize));
  const pageRows = filteredRows;
  const startEntry = total === 0 ? 0 : (page - 1) * effectivePageSize + 1;
  const endEntry = Math.min(page * effectivePageSize, total);

  const modulePerms = getModulePermissions('/core-hr/compound-creation');
  const canAdd = modulePerms.can_add;
  const canEdit = modulePerms.can_edit;
  const canDelete = modulePerms.can_delete;

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <BackNavigation to="/core-hr" label="Core HR" />
      <AppHeader
        title="Component Creation"
        subtitle={organizationName ? organizationName : undefined}
        onLogout={handleLogout}
      />

      <main className="flex-1 min-h-0 overflow-y-auto w-full px-4 sm:px-6 lg:px-8 py-6 bg-gray-50">
        <div className="w-full">
          {/* Breadcrumbs – project theme */}
          <div className="mb-4">
            <nav className="flex items-center text-sm text-gray-600" aria-label="Breadcrumb">
              <Link to="/core-hr" className="text-gray-500 hover:text-gray-900">
                Core HR
              </Link>
              <span className="mx-1 text-gray-400">/</span>
              <span className="font-semibold text-gray-900">Component Creation</span>
            </nav>
          </div>

          {/* Title bar with Legend – project theme (gray/white, no blue) */}
          <div className="bg-white rounded-lg shadow border border-gray-200 mb-4">
            <div className="px-6 py-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-2xl font-bold text-gray-900">Component Creation</h2>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setLegendOpen((v) => !v)}
                  className="h-9 px-4 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 inline-flex items-center gap-2"
                >
                  Legend
                  <svg className={`w-4 h-4 transition-transform ${legendOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {legendOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setLegendOpen(false)} aria-hidden="true" />
                    <div className="absolute right-0 mt-1 w-48 py-2 bg-white border border-gray-200 rounded-lg shadow-lg z-20 text-sm text-gray-700">
                      <div className="px-3 py-2 border-b border-gray-100 font-medium text-gray-900">Legend</div>
                      <div className="px-3 py-2">Filterable: column has filter</div>
                      <div className="px-3 py-2">Edit / Delete in Action</div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Action buttons – project theme: Add orange, Print/Save gray */}
            <div className="px-6 py-3 border-b border-gray-200 bg-gray-50 flex flex-wrap items-center justify-end gap-2">
              {canAdd && (
              <button
                type="button"
                onClick={handleAdd}
                className="h-9 px-4 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition inline-flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add
              </button>
              )}
              <button
                type="button"
                onClick={handlePrint}
                className="h-9 px-4 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 transition inline-flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="h-9 px-4 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 transition inline-flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                Save
              </button>
            </div>

            {listError && (
              <div className="mx-6 mt-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm text-red-800">
                  {listError} From the project root run <code className="bg-red-100 px-1 rounded">npm run dev</code> to start backend and frontend together, then click Retry.
                </span>
                <button
                  type="button"
                  onClick={() => fetchComponents()}
                  className="shrink-0 h-9 px-4 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition"
                >
                  Retry
                </button>
              </div>
            )}
            {loading && (
              <div className="px-6 py-8 text-center text-gray-500">Loading...</div>
            )}
            {/* Search above table – right aligned */}
            {!loading && (
            <>
            <div className="px-6 py-3 border-b border-gray-200 flex flex-wrap items-center justify-end">
              <label className="text-sm font-medium text-gray-700 mr-2">Search: Component Name</label>
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="h-9 px-3 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 placeholder-gray-500 min-w-[180px] focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
              />
            </div>

            {/* Table with filter row – project theme thead bg-gray-50 */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Short Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Long Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Component Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Component Details
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Reimb. Details
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Show in Payslip
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                  {/* Filter row */}
                  <tr className="bg-gray-50 border-t border-gray-100">
                    <th className="px-4 py-2">
                      <input
                        type="text"
                        placeholder="Short Name"
                        value={filterShortName}
                        onChange={(e) => setFilterShortName(e.target.value)}
                        className="h-8 w-full px-2 text-sm border border-gray-300 rounded bg-white text-gray-700 focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
                      />
                    </th>
                    <th className="px-4 py-2">
                      <input
                        type="text"
                        placeholder="Long Name"
                        value={filterLongName}
                        onChange={(e) => setFilterLongName(e.target.value)}
                        className="h-8 w-full px-2 text-sm border border-gray-300 rounded bg-white text-gray-700 focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
                      />
                    </th>
                    <th className="px-4 py-2">
                      <select
                        value={filterComponentType}
                        onChange={(e) => { setFilterComponentType(e.target.value); setPage(1); }}
                        className="h-8 w-full px-2 text-sm border border-gray-300 rounded bg-white text-gray-700 focus:ring-2 focus:ring-gray-400"
                      >
                        {COMPONENT_TYPE_OPTIONS.map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    </th>
                    <th className="px-4 py-2">
                      <select
                        value={filterType}
                        onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
                        className="h-8 w-full px-2 text-sm border border-gray-300 rounded bg-white text-gray-700 focus:ring-2 focus:ring-gray-400"
                      >
                        {TYPE_OPTIONS.map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    </th>
                    <th className="px-4 py-2">
                      <select
                        value={filterComponentDetails}
                        onChange={(e) => setFilterComponentDetails(e.target.value)}
                        className="h-8 w-full px-2 text-sm border border-gray-300 rounded bg-white text-gray-700 focus:ring-2 focus:ring-gray-400"
                      >
                        <option value="">None selected</option>
                        <option value="Filterable">Filterable</option>
                      </select>
                    </th>
                    <th className="px-4 py-2" />
                    <th className="px-4 py-2" />
                    <th className="px-4 py-2" />
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                        No components found.
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.shortName}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{row.longName}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{row.componentType}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{row.type}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                            {[row.isFilterable && 'Filterable', row.isCompulsory && 'Compulsory'].filter(Boolean).join(', ') || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">{row.reimbDetails ?? '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {row.showInPayslip ? (
                            <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">Yes</span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">No</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {row.createdAt ? new Date(row.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {canEdit && (
                            <button
                              type="button"
                              onClick={() => handleEdit(row)}
                              className="p-1.5 rounded text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                              title="Edit"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                            )}
                            {canDelete && (
                            <button
                              type="button"
                              onClick={() => handleDelete(row)}
                              className="p-1.5 rounded text-gray-500 hover:bg-red-50 hover:text-red-600"
                              title="Delete"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination – project theme (gray) */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <span>Show</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="h-9 px-2 py-1 border border-gray-300 rounded-lg text-sm bg-white text-gray-700 font-medium min-w-[4rem] focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
                >
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                  <option value={ALL_ENTRIES_VALUE}>All</option>
                </select>
                <span>entries</span>
              </div>
              <div className="text-sm font-medium text-gray-700">
                Showing {startEntry} to {endEntry} of {total} entries
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
                <span className="px-2 text-sm text-gray-600">
                  Page {page} of {totalPages}
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
            </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
