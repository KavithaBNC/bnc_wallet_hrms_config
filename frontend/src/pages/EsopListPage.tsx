import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';
import { esopSimpleService, EsopRecord } from '../services/esop.service';

function fullName(emp: EsopRecord['employee']) {
  if (!emp) return '—';
  const parts = [emp.firstName, emp.middleName, emp.lastName].filter(Boolean);
  return parts.join(' ').trim() || emp.employeeCode || '—';
}

export default function EsopListPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;
  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id || (user as any)?.organizationId;

  const [records, setRecords] = useState<EsopRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [financialYearFilter, setFinancialYearFilter] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!organizationId) return;
    setLoading(true);
    esopSimpleService
      .getAll({
        organizationId,
        page: pagination.page,
        limit: pagination.limit,
        financialYear: financialYearFilter || undefined,
        search: search.trim() || undefined,
      })
      .then((res) => {
        setRecords(res.esopRecords);
        setPagination((p) => ({
          ...p,
          total: res.pagination.total,
          totalPages: res.pagination.totalPages,
        }));
      })
      .catch(() => setRecords([]))
      .finally(() => setLoading(false));
  }, [organizationId, pagination.page, pagination.limit, financialYearFilter, search]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const financialYearOptions = (() => {
    const options: string[] = [];
    for (let y = 2020; y <= new Date().getFullYear() + 2; y++) {
      const yy1 = String(y).slice(-2);
      const yy2 = String(y + 1).slice(-2);
      options.push(`FY ${yy1}-${yy2}`);
    }
    return options;
  })();

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100 w-full h-full">
      <AppHeader
        title="ESOP"
        subtitle={organizationName ? organizationName : undefined}
        onLogout={handleLogout}
      />

      <main className="flex-1 min-h-0 flex flex-col w-full min-w-0 p-4 overflow-auto">
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Employee Stock Option Plan</h2>
            <p className="mt-0.5 text-sm text-gray-600">View and manage all ESOP records.</p>
          </div>
          <Link
            to="/esop/add"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
          >
            Add ESOP
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or employee code"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
            </div>
            <div className="w-40">
              <select
                value={financialYearFilter}
                onChange={(e) => setFinancialYearFilter(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              >
                <option value="">All FY</option>
                {financialYearOptions.map((fy) => (
                  <option key={fy} value={fy}>{fy}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-8 text-center text-gray-500">Loading...</div>
            ) : records.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No ESOP records found.{' '}
                <Link to="/esop/add" className="text-blue-600 hover:underline">
                  Add ESOP
                </Link>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Employee
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Financial Year
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      No of ESOP
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Date of Allocation
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Visted
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {records.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">
                          {fullName(r.employee)}
                        </div>
                        <div className="text-xs text-gray-500">{r.employee?.employeeCode ?? '—'}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{r.financialYear}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{r.noOfEsop}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {r.dateOfAllocation ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{r.visted ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {pagination.totalPages > 1 && (
            <div className="px-4 py-2 border-t border-gray-200 flex items-center justify-between text-sm">
              <span className="text-gray-600">
                Total: {pagination.total} record(s)
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPagination((p) => ({ ...p, page: Math.max(1, p.page - 1) }))}
                  disabled={pagination.page <= 1}
                  className="px-3 py-1 border rounded disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="py-1">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() =>
                    setPagination((p) => ({
                      ...p,
                      page: Math.min(p.totalPages, p.page + 1),
                    }))
                  }
                  disabled={pagination.page >= pagination.totalPages}
                  className="px-3 py-1 border rounded disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
