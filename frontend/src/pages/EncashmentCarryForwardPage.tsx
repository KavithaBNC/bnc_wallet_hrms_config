import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';
import employeeService, { Employee } from '../services/employee.service';
import paygroupService from '../services/paygroup.service';
import departmentService from '../services/department.service';
import encashmentCarryForwardService from '../services/encashmentCarryForward.service';

interface EncashmentCarryForward {
  id: string;
  displayName: string;
  associate: string | null;
  paygroup: string | null;
  department: string | null;
  eventType: string;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const COLUMN_KEYS = [
  'displayName',
  'associate',
  'paygroup',
  'department',
  'action',
] as const;

const COLUMN_LABELS: Record<(typeof COLUMN_KEYS)[number], string> = {
  displayName: 'Display Name',
  associate: 'Associate',
  paygroup: 'Paygroup',
  department: 'Department',
  action: 'Action',
};

function fullName(e: Employee): string {
  const parts = [e.firstName, e.middleName, e.lastName].filter(Boolean);
  return parts.join(' ').trim() || e.employeeCode || '';
}

export default function EncashmentCarryForwardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;
  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id;

  const [items, setItems] = useState<EncashmentCarryForward[]>([]);
  const [rawItems, setRawItems] = useState<any[]>([]); // Store raw API data
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(COLUMN_KEYS as unknown as string[]));
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  
  // Event Type filter
  const EVENT_TYPES = [
    'Earned Leave',
    'Sick Leave',
    'Casual Leave',
    'Loss of Pay',
    'Comp Off',
    'Maternity Leave',
    'Paternity Leave',
    'Other',
  ];
  
  const [selectedEventType, setSelectedEventType] = useState<string>('Earned Leave');
  const [eventTypeSearch, setEventTypeSearch] = useState('');
  const [showEventTypeDropdown, setShowEventTypeDropdown] = useState(false);
  const eventTypeDropdownRef = useRef<HTMLDivElement>(null);
  const columnPickerRef = useRef<HTMLDivElement>(null);
  
  // Employee name mapping
  const [_employeeNameMap, setEmployeeNameMap] = useState<Map<string, string>>(new Map());
  const [paygroups, setPaygroups] = useState<Array<{ id: string; name: string }>>([]);
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);

  // Fetch employees, paygroups, departments for display
  useEffect(() => {
    if (!organizationId) return;
    Promise.all([
      employeeService.getAll({ organizationId, page: 1, limit: 2000, employeeStatus: 'ACTIVE' }),
      paygroupService.getAll({ organizationId }),
      departmentService.getAll({ organizationId, limit: 500 }),
    ]).then(([empRes, pgList, deptRes]) => {
      const list = empRes.employees || [];
      const map = new Map<string, string>();
      list.forEach((e) => map.set(e.id, fullName(e)));
      setEmployeeNameMap(map);
      setPaygroups((pgList || []).map((p) => ({ id: p.id, name: p.name })));
      setDepartments((deptRes?.departments || []).map((d) => ({ id: d.id, name: d.name })));
    }).catch(() => {});
  }, [organizationId]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (eventTypeDropdownRef.current && !eventTypeDropdownRef.current.contains(event.target as Node)) {
        setShowEventTypeDropdown(false);
      }
      if (columnPickerRef.current && !columnPickerRef.current.contains(event.target as Node)) {
        setShowColumnPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchList = async () => {
    if (!organizationId) return;
    try {
      setLoading(true);
      setError(null);
      const result = await encashmentCarryForwardService.getAll({
        organizationId,
        eventType: selectedEventType,
        page,
        limit: pageSize,
        search: searchTerm.trim() || undefined,
      });
      
      // Store raw data for later transformation
      // Ensure paygroupIds and departmentIds are arrays
      const normalizedItems = result.items.map((item: any) => ({
        ...item,
        paygroupIds: Array.isArray(item.paygroupIds) ? item.paygroupIds : 
                     (item.paygroupIds ? JSON.parse(JSON.stringify(item.paygroupIds)) : null),
        departmentIds: Array.isArray(item.departmentIds) ? item.departmentIds : 
                       (item.departmentIds ? JSON.parse(JSON.stringify(item.departmentIds)) : null),
      }));
      setRawItems(normalizedItems);
      setPagination(result.pagination);
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : 'Failed to load encashment/carry forward';
      setError(String(msg || 'Failed to load encashment/carry forward'));
      setItems([]);
      setPagination({ page: 1, limit: pageSize, total: 0, totalPages: 0 });
    } finally {
      setLoading(false);
    }
  };

  // Transform raw items when paygroups/departments are loaded
  useEffect(() => {
    if (rawItems.length === 0) {
      setItems([]);
      return;
    }
    
    const transformedItems: EncashmentCarryForward[] = rawItems.map((item) => {
      // Format associate name
      let associateName: string | null = null;
      if (item.associate) {
        const parts = [item.associate.firstName, item.associate.middleName, item.associate.lastName].filter(Boolean);
        associateName = parts.join(' ').trim() || item.associate.employeeCode || null;
      }
      
      // Format paygroup names
      let paygroupName: string | null = null;
      if (item.paygroupIds && Array.isArray(item.paygroupIds) && item.paygroupIds.length > 0 && paygroups.length > 0) {
        const pgNames = item.paygroupIds
          .map((pgId: string) => {
            const pg = paygroups.find((pg) => pg.id === pgId);
            return pg?.name;
          })
          .filter(Boolean);
        paygroupName = pgNames.length > 0 ? pgNames.join(', ') : null;
      }
      
      // Format department names
      let departmentName: string | null = null;
      if (item.departmentIds && Array.isArray(item.departmentIds) && item.departmentIds.length > 0 && departments.length > 0) {
        const deptNames = item.departmentIds
          .map((deptId: string) => {
            const dept = departments.find((dept) => dept.id === deptId);
            return dept?.name;
          })
          .filter(Boolean);
        departmentName = deptNames.length > 0 ? deptNames.join(', ') : null;
      }
      
      return {
        id: item.id,
        displayName: item.displayName,
        associate: associateName,
        paygroup: paygroupName,
        department: departmentName,
        eventType: item.eventType,
      };
    });
    
    setItems(transformedItems);
  }, [rawItems, paygroups, departments]);

  useEffect(() => {
    if (organizationId) fetchList();
  }, [organizationId, page, pageSize, selectedEventType, searchTerm]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleAdd = () => {
    navigate('/event-configuration/encashment-carry-forward/add');
  };

  const handleEdit = (item: EncashmentCarryForward) => {
    navigate(`/event-configuration/encashment-carry-forward/edit/${item.id}`);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSave = () => {
    // TODO: Implement save functionality
    alert('Save functionality will be implemented');
  };

  const handleDelete = async (item: EncashmentCarryForward) => {
    if (!window.confirm(`Delete "${item.displayName}"?`)) return;
    try {
      await encashmentCarryForwardService.delete(item.id);
      await fetchList();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : 'Failed to delete';
      setError(String(msg || 'Failed to delete'));
    }
  };

  const filteredEventTypes = EVENT_TYPES.filter((t) =>
    t.toLowerCase().includes(eventTypeSearch.toLowerCase())
  );

  const toggleColumn = (key: string) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const startEntry = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const endEntry = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader
        title="Event Configuration"
        subtitle={organizationName ? `Organization: ${organizationName}` : undefined}
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
              <span className="text-gray-500">Encashment / Carry Forward</span>
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
                className="h-9 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                Save
              </button>
              <button
                type="button"
                onClick={handleAdd}
                className="h-9 px-4 py-2 rounded-lg bg-orange-500 text-white font-medium text-sm hover:bg-orange-600 transition"
              >
                + Add
              </button>
            </div>
          </div>

          {/* Filters - match Employee list (label above, grid) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-500 mb-1.5">Search</label>
              <input
                type="text"
                placeholder="Search display name..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="h-10 w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-700 placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-500 mb-1.5">Event Type</label>
              <div className="relative" ref={eventTypeDropdownRef}>
                <input
                  type="text"
                  value={showEventTypeDropdown ? eventTypeSearch : selectedEventType}
                  onChange={(e) => {
                    setEventTypeSearch(e.target.value);
                    setShowEventTypeDropdown(true);
                  }}
                  onFocus={() => {
                    setShowEventTypeDropdown(true);
                    setEventTypeSearch('');
                  }}
                  placeholder="Select event type..."
                  className="h-10 w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-700 placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
                <svg
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {showEventTypeDropdown && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filteredEventTypes.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-gray-500">No event types found</div>
                    ) : (
                      filteredEventTypes.map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => {
                            setSelectedEventType(type);
                            setEventTypeSearch('');
                            setShowEventTypeDropdown(false);
                            setPage(1);
                          }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 ${
                            selectedEventType === type ? 'bg-blue-50 text-blue-700' : 'text-gray-900'
                          }`}
                        >
                          {type}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col sm:col-span-2 lg:col-span-1">
              <label className="text-sm font-medium text-gray-500 mb-1.5">Columns</label>
              <div className="relative" ref={columnPickerRef}>
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
                <div className="text-sm font-medium text-gray-500">Total Items</div>
                <div className="text-2xl font-bold text-gray-900">{pagination.total}</div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex items-center gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#4CAF50] flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500">On This Page</div>
                <div className="text-2xl font-bold text-gray-900">{items.length}</div>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              <p className="font-semibold">Error loading encashment/carry forward</p>
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
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={COLUMN_KEYS.length} className="px-4 py-8 text-center text-gray-500">
                        No encashment/carry forward items found.
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        {visibleColumns.has('displayName') && (
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                            {item.displayName}
                          </td>
                        )}
                        {visibleColumns.has('associate') && (
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                            {item.associate || '—'}
                          </td>
                        )}
                        {visibleColumns.has('paygroup') && (
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                            {item.paygroup || '—'}
                          </td>
                        )}
                        {visibleColumns.has('department') && (
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                            {item.department || '—'}
                          </td>
                        )}
                        {visibleColumns.has('action') && (
                          <td className="px-4 py-3 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => handleEdit(item)}
                                className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded"
                                title="Edit"
                              >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(item)}
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
            {/* Pagination */}
            <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>Show</span>
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
                      {n} entries
                    </option>
                  ))}
                </select>
              </div>
              {pagination.total > 0 && (
                <div className="text-sm text-gray-600">
                  Showing {startEntry} to {endEntry} of {pagination.total} entries
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`px-3 py-1 text-sm border rounded ${
                      page === pageNum
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}
                <button
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={page >= pagination.totalPages}
                  className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
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
