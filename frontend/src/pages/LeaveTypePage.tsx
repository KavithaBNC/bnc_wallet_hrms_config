import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';
import leaveTypeService, { LeaveType } from '../services/leaveType.service';

const PAGE_SIZE_OPTIONS = [10, 20, 50];

export default function LeaveTypePage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;
  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id;

  const [items, setItems] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const fetchList = async () => {
    if (!organizationId) return;
    try {
      setLoading(true);
      setError(null);
      const result = await leaveTypeService.getAll({
        organizationId,
        page: currentPage,
        limit: pageSize,
      });
      setItems(result.leaveTypes);
      setTotal(result.pagination.total);
      setTotalPages(result.pagination.totalPages);
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : 'Failed to load';
      setError(String(msg || 'Failed to load'));
      setItems([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (organizationId) void fetchList();
  }, [organizationId, currentPage, pageSize]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleEdit = (item: LeaveType) => {
    navigate(`/event-configuration/leave-types/edit/${item.id}`);
  };

  const handleDelete = async (item: LeaveType) => {
    if (!window.confirm(`Delete leave type "${item.name}"?`)) return;
    try {
      await leaveTypeService.delete(item.id);
      await fetchList();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : 'Failed to delete';
      setError(String(msg || 'Failed to delete'));
    }
  };

  const filteredItems = items.filter((item) =>
    searchTerm
      ? item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.code || '').toLowerCase().includes(searchTerm.toLowerCase())
      : true
  );

  const startEntry = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endEntry = Math.min(currentPage * pageSize, total);

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader
        title="Event Configuration"
        subtitle={organizationName ? `Organization: ${organizationName}` : undefined}
        onLogout={handleLogout}
      />

      <main className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-6 bg-gray-50">
        <div className="w-full max-w-[1600px] mx-auto">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
            <nav className="flex items-center gap-1.5 text-sm text-gray-500" aria-label="Breadcrumb">
              <span className="font-semibold text-gray-900">Event Configuration</span>
              <span className="mx-1 text-gray-400">/</span>
              <span className="text-gray-500">Leave Types</span>
            </nav>
            <button
              type="button"
              onClick={() => navigate('/event-configuration/leave-types/add')}
              className="h-9 px-4 py-2 rounded-lg bg-orange-500 text-white font-medium text-sm hover:bg-orange-600 transition flex items-center gap-1.5"
            >
              + Add
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-500 mb-1.5">Search</label>
              <input
                type="text"
                placeholder="Search by name or code..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-10 w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-700 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex items-center gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#333333] flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500">Total</div>
                <div className="text-2xl font-bold text-gray-900">{total}</div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex items-center gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#4CAF50] flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500">Active</div>
                <div className="text-2xl font-bold text-gray-900">{items.filter((i) => i.isActive).length}</div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex items-center gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#2196F3] flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500">Paid</div>
                <div className="text-2xl font-bold text-gray-900">{items.filter((i) => i.isPaid).length}</div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex items-center gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#FF9800] flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500">Unpaid</div>
                <div className="text-2xl font-bold text-gray-900">{items.filter((i) => !i.isPaid).length}</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>Row Per Page</span>
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                  className="h-9 px-3 py-1 bg-white border border-gray-300 rounded text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>{n} Entries</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 table-fixed">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="w-[20%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="w-[10%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                    <th className="w-[8%] px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Paid</th>
                    <th className="w-[10%] px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Days/Year</th>
                    <th className="w-[10%] px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Carry Forward</th>
                    <th className="w-[12%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Accrual</th>
                    <th className="w-[8%] px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Approval</th>
                    <th className="w-[8%] px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="w-[8%] px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-gray-500">Loading...</td>
                    </tr>
                  ) : filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                        {searchTerm
                          ? 'No leave types found matching your search'
                          : 'No leave types yet. Click "+ Add" to create one.'}
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="w-[20%] px-4 py-4 text-sm font-medium text-gray-900 truncate min-w-0">
                          {item.name}
                        </td>
                        <td className="w-[10%] px-4 py-4 text-sm text-gray-600 truncate min-w-0">
                          {item.code || '—'}
                        </td>
                        <td className="w-[8%] px-4 py-4 text-center">
                          <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${item.isPaid ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                            {item.isPaid ? 'Paid' : 'Unpaid'}
                          </span>
                        </td>
                        <td className="w-[10%] px-4 py-4 text-sm text-gray-600 text-center">
                          {item.defaultDaysPerYear ?? '—'}
                        </td>
                        <td className="w-[10%] px-4 py-4 text-sm text-gray-600 text-center">
                          {item.maxCarryForward ?? '—'}
                        </td>
                        <td className="w-[12%] px-4 py-4 text-sm text-gray-600">
                          {item.accrualType || '—'}
                        </td>
                        <td className="w-[8%] px-4 py-4 text-center">
                          <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${item.requiresApproval ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                            {item.requiresApproval ? 'Required' : 'Auto'}
                          </span>
                        </td>
                        <td className="w-[8%] px-4 py-4 text-center">
                          <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${item.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {item.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="w-[8%] px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleEdit(item)}
                              title="Edit"
                              className="p-2 rounded text-indigo-600 hover:bg-indigo-50"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(item)}
                              title="Delete"
                              className="p-2 rounded text-red-600 hover:bg-red-50"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {total > 0 && (
              <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between flex-wrap gap-2">
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{startEntry}</span> to <span className="font-medium">{endEntry}</span> of <span className="font-medium">{total}</span> results
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="px-3 py-1.5 text-sm text-gray-600">Page {currentPage} of {totalPages}</span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages || totalPages === 0}
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
