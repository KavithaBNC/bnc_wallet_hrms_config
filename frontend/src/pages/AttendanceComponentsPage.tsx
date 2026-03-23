import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';
import BackNavigation from '../components/common/BackNavigation';
import attendanceComponentService from '../services/attendanceComponent.service';
import { getModulePermissions } from '../config/configurator-module-mapping';

interface AttendanceComponent {
  id: string;
  shortName: string;
  eventName: string;
  description: string | null;
  eventCategory: string;
  authorized: boolean;
  considerAsWorkHours: boolean;
  hasBalance: boolean;
  allowHourly: boolean;
  allowDatewise: boolean;
  allowWeekOffSelection: boolean;
  allowHolidaySelection: boolean;
  cannotOverlapWith: string | null;
  priority: number | null;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const COLUMN_KEYS = [
  'shortName',
  'eventName',
  'description',
  'eventCategory',
  'authorized',
  'considerAsWorkHours',
  'hasBalance',
  'allowHourly',
  'allowDatewise',
  'allowWeekOffSelection',
  'allowHolidaySelection',
  'cannotOverlapWith',
  'priority',
  'action',
] as const;

const COLUMN_LABELS: Record<(typeof COLUMN_KEYS)[number], string> = {
  shortName: 'Short Name',
  eventName: 'Event Name',
  description: 'Description',
  eventCategory: 'Event Category',
  authorized: 'Authorized',
  considerAsWorkHours: 'Consider as work hours',
  hasBalance: 'Has balance',
  allowHourly: 'Hourly',
  allowDatewise: 'Date Wise',
  allowWeekOffSelection: 'Allow WeekOff Selection',
  allowHolidaySelection: 'Allow Holiday Selection',
  cannotOverlapWith: "Can't overlap with",
  priority: 'Priority',
  action: 'Action',
};

export default function AttendanceComponentsPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;
  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id;

  const [components, setComponents] = useState<AttendanceComponent[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(COLUMN_KEYS as unknown as string[]));
  const [showColumnPicker, setShowColumnPicker] = useState(false);

  const fetchList = async () => {
    if (!organizationId) return;
    try {
      setLoading(true);
      setError(null);
      const result = await attendanceComponentService.getAll({
        organizationId,
        search: searchTerm.trim() || undefined,
        page,
        limit: pageSize,
      });
      
      setComponents(result.components);
      setPagination(result.pagination);
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : 'Failed to load attendance components';
      setError(String(msg || 'Failed to load attendance components'));
      setComponents([]);
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

  const handleAdd = () => {
    navigate('/event-configuration/attendance-components/add');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSave = () => {
    // TODO: Implement save functionality
    alert('Save functionality will be implemented');
  };

  const handleEdit = (component: AttendanceComponent) => {
    navigate(`/event-configuration/attendance-components/edit/${component.id}`);
  };

  const handleDelete = async (component: AttendanceComponent) => {
    if (!window.confirm(`Delete attendance component "${component.eventName}"?`)) return;
    try {
      await attendanceComponentService.delete(component.id);
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

  const modulePerms = getModulePermissions('/event-configuration/attendance-components');
  const canAdd = modulePerms.can_add;
  const canEdit = modulePerms.can_edit;
  const canDelete = modulePerms.can_delete;

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <BackNavigation to="/event-configuration" label="Event Configuration" />
      <AppHeader
        title="Event Configuration"
        subtitle={organizationName ? organizationName : undefined}
        onLogout={handleLogout}
      />

      <main className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-6 bg-gray-50">
        <div className="w-full max-w-[1600px] mx-auto">
          {/* Breadcrumbs - match Employee list */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
            <nav className="flex items-center gap-1.5 text-sm text-gray-500" aria-label="Breadcrumb">
              <span className="font-semibold text-gray-900">Attendance</span>
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span className="text-gray-500">Event Configuration</span>
              <span className="mx-1 text-gray-400">/</span>
              <span className="text-gray-500">Attendance Components</span>
            </nav>
            <div className="flex items-center gap-2 flex-wrap">
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
                className="h-9 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                Save
              </button>
              {canAdd && (
              <button
                type="button"
                onClick={handleAdd}
                className="h-9 px-4 py-2 rounded-lg bg-orange-500 text-white font-medium text-sm hover:bg-orange-600 transition"
              >
                + Add Component
              </button>
              )}
            </div>
          </div>

          {/* Filters - match Employee list (label above, grid) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-500 mb-1.5">Search</label>
              <input
                type="text"
                placeholder="Search event name..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="h-10 w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-700 placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500">Total Components</div>
                <div className="text-2xl font-bold text-gray-900">{pagination.total}</div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex items-center gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#2196F3] flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500">On This Page</div>
                <div className="text-2xl font-bold text-gray-900">{components.length}</div>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              <p className="font-semibold">Error loading attendance components</p>
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
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Short Name
                      </th>
                    )}
                    {visibleColumns.has('eventName') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Event Name
                      </th>
                    )}
                    {visibleColumns.has('description') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Description
                      </th>
                    )}
                    {visibleColumns.has('eventCategory') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Event Category
                      </th>
                    )}
                    {visibleColumns.has('authorized') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Authorized
                      </th>
                    )}
                    {visibleColumns.has('considerAsWorkHours') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Consider as work hours
                      </th>
                    )}
                    {visibleColumns.has('hasBalance') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Has balance
                      </th>
                    )}
                    {visibleColumns.has('allowHourly') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Hourly
                      </th>
                    )}
                    {visibleColumns.has('allowDatewise') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date Wise
                      </th>
                    )}
                    {visibleColumns.has('allowWeekOffSelection') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Allow WeekOff Selection
                      </th>
                    )}
                    {visibleColumns.has('allowHolidaySelection') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Allow Holiday Selection
                      </th>
                    )}
                    {visibleColumns.has('cannotOverlapWith') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Can't overlap with
                      </th>
                    )}
                    {visibleColumns.has('priority') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Priority
                      </th>
                    )}
                    {visibleColumns.has('action') && (
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
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
                  ) : components.length === 0 ? (
                    <tr>
                      <td colSpan={COLUMN_KEYS.length} className="px-4 py-8 text-center text-gray-500">
                        No attendance components found.
                      </td>
                    </tr>
                  ) : (
                    components.map((component) => (
                      <tr key={component.id} className="hover:bg-gray-50">
                        {visibleColumns.has('shortName') && (
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                            {component.shortName}
                          </td>
                        )}
                        {visibleColumns.has('eventName') && (
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                            {component.eventName}
                          </td>
                        )}
                        {visibleColumns.has('description') && (
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {component.description || '—'}
                          </td>
                        )}
                        {visibleColumns.has('eventCategory') && (
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                            {component.eventCategory}
                          </td>
                        )}
                        {visibleColumns.has('authorized') && (
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                            {component.authorized ? 'Yes' : 'No'}
                          </td>
                        )}
                        {visibleColumns.has('considerAsWorkHours') && (
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                            {component.considerAsWorkHours ? 'Yes' : 'No'}
                          </td>
                        )}
                        {visibleColumns.has('hasBalance') && (
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                            {component.hasBalance ? 'Yes' : 'No'}
                          </td>
                        )}
                        {visibleColumns.has('allowHourly') && (
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                            {component.allowHourly ? 'Yes' : 'No'}
                          </td>
                        )}
                        {visibleColumns.has('allowDatewise') && (
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                            {component.allowDatewise ? 'Yes' : 'No'}
                          </td>
                        )}
                        {visibleColumns.has('allowWeekOffSelection') && (
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                            {component.allowWeekOffSelection ? 'Yes' : 'No'}
                          </td>
                        )}
                        {visibleColumns.has('allowHolidaySelection') && (
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                            {component.allowHolidaySelection ? 'Yes' : 'No'}
                          </td>
                        )}
                        {visibleColumns.has('cannotOverlapWith') && (
                          <td className="px-4 py-3 text-sm text-gray-500 max-w-[300px]">
                            {component.cannotOverlapWith || '—'}
                          </td>
                        )}
                        {visibleColumns.has('priority') && (
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            {component.priority != null ? String(component.priority) : '—'}
                          </td>
                        )}
                        {visibleColumns.has('action') && (
                          <td className="px-4 py-3 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-1">
                              {canEdit && (
                              <button
                                type="button"
                                onClick={() => handleEdit(component)}
                                className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded"
                                title="Edit"
                              >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>
                              )}
                              {canDelete && (
                              <button
                                type="button"
                                onClick={() => handleDelete(component)}
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
