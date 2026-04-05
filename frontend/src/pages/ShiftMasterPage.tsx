import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';
import shiftService, { Shift } from '../services/shift.service';

const PAGE_SIZE_OPTIONS = [10, 20, 50];

const COLUMN_KEYS = [
  'shortName',
  'shiftName',
  'fromTime',
  'toTime',
  'firstHalfEnd',
  'secondHalfStart',
  'punchInTime',
  'punchOutTime',
  'active',
  'flexiType',
  'action',
] as const;

const COLUMN_LABELS: Record<(typeof COLUMN_KEYS)[number], string> = {
  shortName: 'Short Name',
  shiftName: 'Shift Name',
  fromTime: 'From Time',
  toTime: 'To Time',
  firstHalfEnd: 'First Half End',
  secondHalfStart: 'Second Half Start',
  punchInTime: 'PunchIn Time',
  punchOutTime: 'PunchOut Time',
  active: 'Active',
  flexiType: 'Flexi Type',
  action: 'Action',
};

export default function ShiftMasterPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;
  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id || (user as any)?.organizationId;

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [dateFormat24, setDateFormat24] = useState(true);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(COLUMN_KEYS as unknown as string[]));
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const fetchList = async () => {
    if (!organizationId) return;
    try {
      setLoading(true);
      setError(null);
      const result = await shiftService.getAll({
        organizationId,
        search: searchTerm.trim() || undefined,
        page,
        limit: pageSize,
      });
      setShifts(result.shifts);
      setPagination(result.pagination);
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : 'Failed to load shifts';
      setError(String(message || 'Failed to load shifts'));
      setShifts([]);
      setPagination({ page: 1, limit: pageSize, total: 0, totalPages: 0 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (organizationId) fetchList();
  }, [organizationId, page, pageSize, searchTerm]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleAdd = () => navigate('/time-attendance/shift-master/add');
  const handleDelete = async (id: string) => {
    try {
      await shiftService.delete(id);
      setDeleteConfirmId(null);
      fetchList();
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : 'Delete failed';
      setError(String(message));
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

  const formatTime = (time: string | null | undefined) => {
    if (!time) return '—';
    if (dateFormat24) return time;
    const [h, m] = time.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${period}`;
  };

  const activeCount = shifts.filter((s) => s.isActive).length;
  const inactiveCount = shifts.length - activeCount;

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader
        title="Shift Master"
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
              <span className="text-gray-500">Shift Master</span>
            </nav>
            <button
              type="button"
              onClick={handleAdd}
              className="h-9 px-4 py-2 rounded-lg bg-orange-500 text-white font-medium text-sm hover:bg-orange-600 transition"
            >
              + Add Shift
            </button>
          </div>

          {/* Filters - match Employee list (label above, grid) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-500 mb-1.5">Search</label>
              <input
                type="text"
                placeholder="Search shifts..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="h-10 w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-700 placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-500 mb-1.5">Time format</label>
              <div className="flex rounded-lg border border-gray-300 overflow-hidden h-10">
                <button
                  type="button"
                  onClick={() => setDateFormat24(true)}
                  className={`flex-1 px-3 py-2 text-sm font-medium ${dateFormat24 ? 'bg-gray-700 text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}
                >
                  24H
                </button>
                <button
                  type="button"
                  onClick={() => setDateFormat24(false)}
                  className={`flex-1 px-3 py-2 text-sm font-medium ${!dateFormat24 ? 'bg-gray-700 text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}
                >
                  12H
                </button>
              </div>
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
                <div className="text-sm font-medium text-gray-500">Total Shifts</div>
                <div className="text-2xl font-bold text-gray-900">{pagination.total}</div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex items-center gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#4CAF50] flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500">Active</div>
                <div className="text-2xl font-bold text-gray-900">{activeCount}</div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex items-center gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#F44336] flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500">Inactive</div>
                <div className="text-2xl font-bold text-gray-900">{inactiveCount}</div>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              <p className="font-semibold">Error loading shifts</p>
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
                    {visibleColumns.has('shortName') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Short Name</th>
                    )}
                    {visibleColumns.has('shiftName') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shift Name</th>
                    )}
                    {visibleColumns.has('fromTime') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">From Time</th>
                    )}
                    {visibleColumns.has('toTime') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">To Time</th>
                    )}
                    {visibleColumns.has('firstHalfEnd') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">First Half End</th>
                    )}
                    {visibleColumns.has('secondHalfStart') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Second Half Start</th>
                    )}
                    {visibleColumns.has('punchInTime') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PunchIn Time</th>
                    )}
                    {visibleColumns.has('punchOutTime') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PunchOut Time</th>
                    )}
                    {visibleColumns.has('active') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Active</th>
                    )}
                    {visibleColumns.has('flexiType') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Flexi Type</th>
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
                  ) : shifts.length === 0 ? (
                    <tr>
                      <td colSpan={COLUMN_KEYS.length} className="px-4 py-8 text-center text-gray-500">
                        No shifts found. Add a shift using the Add Shift button.
                      </td>
                    </tr>
                  ) : (
                    shifts.map((shift) => (
                      <tr key={shift.id} className="hover:bg-gray-50">
                        {visibleColumns.has('shortName') && (
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{shift.code ?? '—'}</td>
                        )}
                        {visibleColumns.has('shiftName') && (
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{shift.name}</td>
                        )}
                        {visibleColumns.has('fromTime') && (
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{formatTime(shift.startTime)}</td>
                        )}
                        {visibleColumns.has('toTime') && (
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{formatTime(shift.endTime)}</td>
                        )}
                        {visibleColumns.has('firstHalfEnd') && (
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{shift.firstHalfEnd ? formatTime(shift.firstHalfEnd) : '—'}</td>
                        )}
                        {visibleColumns.has('secondHalfStart') && (
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{shift.secondHalfStart ? formatTime(shift.secondHalfStart) : '—'}</td>
                        )}
                        {visibleColumns.has('punchInTime') && (
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{shift.punchInTime ? formatTime(shift.punchInTime) : '—'}</td>
                        )}
                        {visibleColumns.has('punchOutTime') && (
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{shift.punchOutTime ? formatTime(shift.punchOutTime) : '—'}</td>
                        )}
                        {visibleColumns.has('active') && (
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${shift.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}
                            >
                              {shift.isActive ? 'Yes' : 'No'}
                            </span>
                          </td>
                        )}
                        {visibleColumns.has('flexiType') && (
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                            {shift.flexiType === 'FULL_FLEXI'
                              ? 'Full Flexi'
                              : shift.flexiType === 'SHIFT_START'
                                ? 'Shift Start'
                                : shift.flexiType === 'SHIFT_END'
                                  ? 'Shift End'
                                  : shift.isFlexible
                                    ? 'Full Flexi'
                                    : 'None'}
                          </td>
                        )}
                        {visibleColumns.has('action') && (
                          <td className="px-4 py-3 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => navigate(`/time-attendance/shift-master/edit/${shift.id}`)}
                                className="p-2 text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded"
                                title="Edit"
                              >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>
                              {deleteConfirmId === shift.id ? (
                                <span className="flex items-center gap-1 text-xs">
                                  <button type="button" onClick={() => handleDelete(shift.id)} className="text-red-600 font-medium hover:underline">
                                    Confirm
                                  </button>
                                  <button type="button" onClick={() => setDeleteConfirmId(null)} className="text-gray-600 hover:underline">
                                    Cancel
                                  </button>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmId(shift.id)}
                                  className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded"
                                  title="Delete"
                                >
                                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
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
