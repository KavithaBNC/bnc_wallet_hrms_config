import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import fnfSettlementService, { FnfSettlement, FnfPagination } from '../services/fnfSettlement.service';

const statusConfig: Record<string, { label: string; color: string }> = {
  DRAFT:      { label: 'Draft',       color: 'bg-gray-100 text-gray-700' },
  CALCULATED: { label: 'Calculated',  color: 'bg-blue-100 text-blue-700' },
  APPROVED:   { label: 'HR Approved', color: 'bg-orange-100 text-orange-700' },
  PAID:       { label: 'Completed',   color: 'bg-green-100 text-green-700' },
};

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const fmtDate = (d: string) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function FnfHistoryPage() {
  const navigate = useNavigate();

  const [items, setItems] = useState<FnfSettlement[]>([]);
  const [pagination, setPagination] = useState<FnfPagination>({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const load = async () => {
    try {
      setLoading(true);
      const result = await fnfSettlementService.getAll({
        organizationId: '',
        page,
        limit: 15,
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(search ? { search } : {}),
      });
      setItems(result.items || []);
      setPagination(result.pagination);
    } catch {
      setError('Failed to load settlements');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page, statusFilter]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      load();
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const handleClearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setPage(1);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">F&amp;F Settlement History</h1>
          <p className="text-sm text-gray-500 mt-1">All settlement records with filters and quick actions</p>
        </div>
        <button
          onClick={() => navigate('/payroll/fnf-settlement/initiate')}
          className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
        >
          + Initiate New
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-52">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by employee name or code..."
            className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
        >
          <option value="">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="CALCULATED">Calculated</option>
          <option value="APPROVED">HR Approved</option>
          <option value="PAID">Completed</option>
        </select>
        {(search || statusFilter) && (
          <button
            onClick={handleClearFilters}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Clear Filters
          </button>
        )}
        <p className="ml-auto text-xs text-gray-400">
          {pagination.total} record{pagination.total !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-gray-400 text-sm">No settlements found matching your filters.</p>
            {(search || statusFilter) && (
              <button onClick={handleClearFilters} className="mt-2 text-sm text-indigo-600 hover:underline">
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Employee', 'Department', 'Last Working Date', 'Yrs of Service', 'Net Settlement', 'Status', 'Calculated', 'Action'].map((h) => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {items.map((s) => {
                    const cfg = statusConfig[s.status] || statusConfig.DRAFT;
                    return (
                      <tr
                        key={s.id}
                        className="hover:bg-gray-50 cursor-pointer transition"
                        onClick={() => navigate(`/payroll/fnf-settlement/${s.id}`)}
                      >
                        <td className="px-5 py-3.5">
                          <p className="font-medium text-gray-900">{s.employee?.firstName} {s.employee?.lastName}</p>
                          <p className="text-xs text-gray-400">{s.employee?.employeeCode}</p>
                        </td>
                        <td className="px-5 py-3.5 text-gray-600">{s.employee?.department?.name || '—'}</td>
                        <td className="px-5 py-3.5 text-gray-600">{fmtDate(s.lastWorkingDate)}</td>
                        <td className="px-5 py-3.5 text-gray-600">{Number(s.yearsOfService || 0).toFixed(1)} yrs</td>
                        <td className="px-5 py-3.5 font-semibold text-gray-900">{fmt(Number(s.netSettlement))}</td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-gray-500 text-xs">{fmtDate(s.calculatedAt || s.createdAt)}</td>
                        <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-2">
                            <button
                              onClick={() => navigate(`/payroll/fnf-settlement/${s.id}`)}
                              className="text-indigo-600 hover:text-indigo-800 text-xs font-medium"
                            >
                              View
                            </button>
                            <button
                              onClick={() => navigate(`/payroll/fnf-settlement/${s.id}/statement`)}
                              className="text-gray-500 hover:text-gray-700 text-xs"
                            >
                              📄
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  Showing {(page - 1) * pagination.limit + 1}–{Math.min(page * pagination.limit, pagination.total)} of {pagination.total}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                  >
                    ← Prev
                  </button>
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    const p = Math.max(1, Math.min(pagination.totalPages - 4, page - 2)) + i;
                    return (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`px-3 py-1.5 text-sm border rounded-lg ${p === page ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 hover:bg-gray-50'}`}
                      >
                        {p}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                    disabled={page === pagination.totalPages}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
