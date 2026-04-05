import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/layout/AppHeader';
import Modal from '../components/common/Modal';
import employeeSeparationService, {
  EmployeeSeparation,
  CreateEmployeeSeparationInput,
  SeparationType,
} from '../services/employeeSeparation.service';
import employeeService from '../services/employee.service';
import { useAuthStore } from '../store/authStore';
import SearchableSelect from '../components/common/SearchableSelect';

const SEPARATION_TYPES: { value: SeparationType; label: string }[] = [
  { value: 'RESIGNATION', label: 'Resignation' },
  { value: 'TERMINATION', label: 'Termination' },
  { value: 'RETIREMENT', label: 'Retirement' },
  { value: 'CONTRACT_END', label: 'Contract End' },
  { value: 'ABSONDING', label: 'Absonding' },
  { value: 'OTHER', label: 'Other' },
];

const NOTICE_PERIOD_REASONS = [
  { value: '', label: '-- Select --' },
  { value: 'WAIVED', label: 'Waived' },
  { value: 'BUYOUT', label: 'Buyout' },
  { value: 'SHORT_NOTICE', label: 'Short Notice' },
  { value: 'OTHER', label: 'Other' },
];

const REASONS_OF_LEAVING = [
  { value: '', label: '-- Select --' },
  { value: 'BETTER_OPPORTUNITY', label: 'Better Opportunity' },
  { value: 'PERSONAL', label: 'Personal' },
  { value: 'RELOCATION', label: 'Relocation' },
  { value: 'RETIREMENT', label: 'Retirement' },
  { value: 'TERMINATED', label: 'Terminated' },
  { value: 'CONTRACT_END', label: 'Contract End' },
  { value: 'OTHER', label: 'Other' },
];

function formatDate(d: string) {
  if (!d) return '—';
  const date = new Date(d);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function EmployeeSeparationPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id || (user as any)?.organizationId;
  const organizationName = user?.employee?.organization?.name;

  const [separations, setSeparations] = useState<EmployeeSeparation[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [separationTypeFilter, setSeparationTypeFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<EmployeeSeparation | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [employees, setEmployees] = useState<Array<{ value: string; label: string; source: 'configurator' | 'local' }>>([]);
  const [formData, setFormData] = useState<CreateEmployeeSeparationInput & { id?: string }>({
    employeeId: '',
    organizationId: organizationId || '',
    resignationApplyDate: '',
    noticePeriod: 0,
    noticePeriodReason: null,
    relievingDate: '',
    reasonOfLeaving: null,
    separationType: 'RESIGNATION',
    remarks: null,
  });
  const resignationDateRef = useRef<HTMLInputElement>(null);
  const relievingDateRef = useRef<HTMLInputElement>(null);

  type SortKey = 'employeeCode' | 'employeeName' | 'resignationApplyDate' | 'noticePeriod' | 'relievingDate' | 'separationType';
  type SortOrder = 'asc' | 'desc';
  const [sortBy, setSortBy] = useState<SortKey>('resignationApplyDate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const openDatePicker = (ref: React.RefObject<HTMLInputElement | null>) => {
    ref.current?.showPicker?.() ?? ref.current?.click();
  };

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
        sortBy: 'resignationApplyDate',
        sortOrder: 'desc',
      });
      setSeparations(result.separations);
      setPagination(result.pagination);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load separations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (organizationId) fetchList();
  }, [organizationId, page, pageSize, searchTerm]);

  const fetchEmployeesForDropdown = async () => {
    try {
      // Try Configurator API first
      const configUsers = await employeeSeparationService.getConfiguratorUsers();
      if (configUsers && configUsers.length > 0) {
        setEmployees(configUsers.map((u) => ({
          value: String(u.user_id),
          label: u.full_name || u.email || `User ${u.user_id}`,
          source: 'configurator' as const,
        })));
        return;
      }
    } catch (err) {
      console.warn('[Separation] Configurator users API failed, falling back to local:', err);
    }
    // Fallback: fetch from local employee list
    try {
      if (!organizationId) return;
      const res = await employeeService.getAll({
        organizationId,
        page: 1,
        limit: 500,
        listView: true,
        employeeStatus: 'ACTIVE',
      });
      const list = (res.employees || []).map((e: any) => ({
        value: e.id,
        label: `${e.employeeCode} - ${e.firstName} ${e.lastName}`.trim(),
        source: 'local' as const,
      }));
      setEmployees(list);
    } catch (err) {
      console.error('[Separation] Local employees fetch also failed:', err);
      setEmployees([]);
    }
  };

  const openAdd = () => {
    setEditing(null);
    setFormData({
      employeeId: '',
      organizationId: organizationId || '',
      resignationApplyDate: '',
      noticePeriod: 0,
      noticePeriodReason: null,
      relievingDate: '',
      reasonOfLeaving: null,
      separationType: 'RESIGNATION',
      remarks: null,
    });
    fetchEmployeesForDropdown();
    setShowForm(true);
  };

  const openEdit = (row: EmployeeSeparation) => {
    setEditing(row);
    setFormData({
      employeeId: row.employeeId,
      organizationId: row.organizationId,
      resignationApplyDate: row.resignationApplyDate.slice(0, 10),
      noticePeriod: row.noticePeriod,
      noticePeriodReason: row.noticePeriodReason ?? null,
      relievingDate: row.relievingDate.slice(0, 10),
      reasonOfLeaving: row.reasonOfLeaving ?? null,
      separationType: row.separationType,
      remarks: row.remarks ?? null,
      id: row.id,
    });
    fetchEmployeesForDropdown();
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.employeeId || !formData.resignationApplyDate || !formData.relievingDate || !formData.separationType) {
      alert('Please fill required fields: Employee, Resignation Apply Date, Relieving Date, Separation Type');
      return;
    }
    try {
      setSubmitting(true);
      if (editing && formData.id) {
        await employeeSeparationService.update(formData.id, {
          resignationApplyDate: formData.resignationApplyDate,
          noticePeriod: formData.noticePeriod,
          noticePeriodReason: formData.noticePeriodReason || null,
          relievingDate: formData.relievingDate,
          reasonOfLeaving: formData.reasonOfLeaving || null,
          separationType: formData.separationType,
          remarks: formData.remarks || null,
        });
        alert('Separation updated successfully');
      } else {
        const selectedEmp = employees.find((e) => e.value === formData.employeeId);
        const createData: CreateEmployeeSeparationInput = {
          organizationId: formData.organizationId,
          resignationApplyDate: formData.resignationApplyDate,
          noticePeriod: formData.noticePeriod,
          noticePeriodReason: formData.noticePeriodReason || null,
          relievingDate: formData.relievingDate,
          reasonOfLeaving: formData.reasonOfLeaving || null,
          separationType: formData.separationType,
          remarks: formData.remarks || null,
        };
        if (selectedEmp?.source === 'configurator') {
          createData.configuratorUserId = Number(formData.employeeId);
        } else {
          createData.employeeId = formData.employeeId;
        }
        await employeeSeparationService.create(createData);
        alert('Employee separation recorded successfully');
      }
      setShowForm(false);
      setEditing(null);
      fetchList();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this separation record?')) return;
    try {
      await employeeSeparationService.delete(id);
      fetchList();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete');
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (!organizationId) {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
        <AppHeader title="Employee Separation" onLogout={handleLogout} />
        <main className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg">
            <p className="font-semibold">Unable to load organization</p>
            <p className="text-sm mt-1">Please ensure you are logged in with an employee that has an organization.</p>
          </div>
        </main>
      </div>
    );
  }

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
      else if (sortBy === 'noticePeriod') cmp = (a.noticePeriod ?? 0) - (b.noticePeriod ?? 0);
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
  const currentYear = new Date().getFullYear();
  const thisYearCount = separations.filter((s) => new Date(s.resignationApplyDate).getFullYear() === currentYear).length;

  return (
    <div className="flex flex-col flex-1 min-h-0 min-w-0 w-full bg-gray-100">
      <AppHeader
        title="Employee Separation"
        subtitle={organizationName ? organizationName : undefined}
        onLogout={handleLogout}
      />

      <main className="flex-1 min-h-0 min-w-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-6 bg-gray-50">
        <div className="w-full max-w-[1600px] mx-auto">
          {/* Breadcrumb - match Employee page */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
            <nav className="flex items-center gap-1.5 text-sm text-gray-500" aria-label="Breadcrumb">
              <span className="font-semibold text-gray-900">Payroll Master</span>
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span className="text-gray-500">Payroll Master</span>
              <span className="mx-1 text-gray-400">/</span>
              <span className="text-gray-500">Employee Separation</span>
            </nav>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={openAdd}
                className="h-9 px-4 py-2 rounded-lg bg-orange-500 text-white font-medium text-sm hover:bg-orange-600 transition"
              >
                + Add Separation
              </button>
            </div>
          </div>

          {/* Filters - match Employee page grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-500 mb-1.5">Separation Type</label>
              <select
                value={separationTypeFilter}
                onChange={(e) => { setSeparationTypeFilter(e.target.value); setPage(1); }}
                className="h-10 w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="ALL">All Types</option>
                {SEPARATION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-500 mb-1.5">Search</label>
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                className="h-10 w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-700 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Summary Cards - match Employee page */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex items-center gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#333333] flex items-center justify-center">
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
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#2196F3] flex items-center justify-center">
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
              <p className="font-semibold">Error loading separations</p>
              <p className="text-sm mt-1">{error}</p>
              <button
                onClick={() => organizationId && fetchList()}
                className="mt-2 text-sm underline hover:no-underline"
              >
                Try again
              </button>
            </div>
          )}

          {/* Loading skeleton - match Employee page */}
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notice Period</th>
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
                      <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-8 animate-pulse" /></td>
                      <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-24 animate-pulse" /></td>
                      <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-20 animate-pulse" /></td>
                      <td className="px-6 py-4 text-right"><div className="h-4 bg-gray-200 rounded w-20 ml-auto animate-pulse" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Table - match Employee page */}
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
                      <th className="w-[12%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <button type="button" onClick={() => handleSort('employeeCode')} className="inline-flex items-center gap-1 group font-medium">
                          Employee Code <SortIcon column="employeeCode" />
                        </button>
                      </th>
                      <th className="w-[16%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <button type="button" onClick={() => handleSort('employeeName')} className="inline-flex items-center gap-1 group font-medium">
                          Employee Name <SortIcon column="employeeName" />
                        </button>
                      </th>
                      <th className="w-[14%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <button type="button" onClick={() => handleSort('resignationApplyDate')} className="inline-flex items-center gap-1 group font-medium">
                          Resignation Apply Date <SortIcon column="resignationApplyDate" />
                        </button>
                      </th>
                      <th className="w-[10%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <button type="button" onClick={() => handleSort('noticePeriod')} className="inline-flex items-center gap-1 group font-medium">
                          Notice Period <SortIcon column="noticePeriod" />
                        </button>
                      </th>
                      <th className="w-[14%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <button type="button" onClick={() => handleSort('relievingDate')} className="inline-flex items-center gap-1 group font-medium">
                          Relieving Date <SortIcon column="relievingDate" />
                        </button>
                      </th>
                      <th className="w-[14%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <button type="button" onClick={() => handleSort('separationType')} className="inline-flex items-center gap-1 group font-medium">
                          Separation Type <SortIcon column="separationType" />
                        </button>
                      </th>
                      <th className="w-[12%] px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sortedSeparations.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                          {searchTerm || separationTypeFilter !== 'ALL'
                            ? 'No separations found matching your filters'
                            : 'No separation records yet. Add your first record!'}
                        </td>
                      </tr>
                    ) : (
                      sortedSeparations.map((row) => (
                        <tr key={row.id} className="hover:bg-gray-50">
                          <td className="w-[12%] px-4 py-4 whitespace-nowrap text-sm font-mono text-gray-900 text-left truncate">
                            {row.employee?.employeeCode ?? '—'}
                          </td>
                          <td className="w-[16%] px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-left truncate">
                            {row.employee
                              ? `${row.employee.firstName} ${row.employee.lastName}`.trim()
                              : '—'}
                          </td>
                          <td className="w-[14%] px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-left">{formatDate(row.resignationApplyDate)}</td>
                          <td className="w-[10%] px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-left">{row.noticePeriod}</td>
                          <td className="w-[14%] px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-left">{formatDate(row.relievingDate)}</td>
                          <td className="w-[14%] px-4 py-4 whitespace-nowrap text-left">
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                              {SEPARATION_TYPES.find((t) => t.value === row.separationType)?.label ?? row.separationType}
                            </span>
                          </td>
                          <td className="w-[12%] px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              type="button"
                              onClick={() => openEdit(row)}
                              className="text-indigo-600 hover:text-indigo-900 p-1.5 rounded hover:bg-indigo-50"
                              title="Edit"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(row.id)}
                              className="text-red-600 hover:text-red-900 p-1.5 rounded hover:bg-red-50 ml-1"
                              title="Delete"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
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
                    Showing <span className="font-medium">{(page - 1) * pagination.limit + 1}</span> to <span className="font-medium">{Math.min(page * pagination.limit, pagination.total)}</span> of <span className="font-medium">{pagination.total}</span> results
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
                    <span className="px-3 py-1.5 text-sm text-gray-600">Page {page} of {Math.max(1, pagination.totalPages)}</span>
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
        </div>
      </main>

      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditing(null); }}
        title="Employee Separation"
        size="lg"
      >
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1.5">
              Employee <span className="text-red-500">*</span>
            </label>
            <SearchableSelect
              options={employees.map((emp) => ({ value: emp.value, label: emp.label }))}
              value={formData.employeeId || ''}
              onChange={(val) => setFormData((f) => ({ ...f, employeeId: val }))}
              placeholder="Select Employee..."
              disabled={!!editing}
              name="employeeId"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1.5">
              Resignation Apply Date <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                ref={resignationDateRef}
                type="date"
                required
                value={formData.resignationApplyDate}
                onChange={(e) => setFormData((f) => ({ ...f, resignationApplyDate: e.target.value }))}
                className="w-full bg-white rounded-lg border border-gray-200 shadow-sm py-2.5 pl-3 pr-10 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => openDatePicker(resignationDateRef)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700 focus:outline-none focus:text-gray-700"
                aria-label="Open calendar"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1.5">
              Notice Period (days) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min={0}
              required
              value={formData.noticePeriod}
              onChange={(e) => setFormData((f) => ({ ...f, noticePeriod: Number(e.target.value) || 0 }))}
              className="w-full bg-white rounded-lg border border-gray-200 shadow-sm py-2.5 px-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1.5">Notice Period Reason</label>
            <select
              value={formData.noticePeriodReason ?? ''}
              onChange={(e) => setFormData((f) => ({ ...f, noticePeriodReason: e.target.value || null }))}
              className="w-full bg-white rounded-lg border border-gray-200 shadow-sm py-2.5 px-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {NOTICE_PERIOD_REASONS.map((o) => (
                <option key={o.value || 'none'} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1.5">
              Relieving Date <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                ref={relievingDateRef}
                type="date"
                required
                value={formData.relievingDate}
                onChange={(e) => setFormData((f) => ({ ...f, relievingDate: e.target.value }))}
                className="w-full bg-white rounded-lg border border-gray-200 shadow-sm py-2.5 pl-3 pr-10 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => openDatePicker(relievingDateRef)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700 focus:outline-none focus:text-gray-700"
                aria-label="Open calendar"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1.5">Reason of Leaving</label>
            <select
              value={formData.reasonOfLeaving ?? ''}
              onChange={(e) => setFormData((f) => ({ ...f, reasonOfLeaving: e.target.value || null }))}
              className="w-full bg-white rounded-lg border border-gray-200 shadow-sm py-2.5 px-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {REASONS_OF_LEAVING.map((o) => (
                <option key={o.value || 'none'} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1.5">
              Separation Type <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={formData.separationType}
              onChange={(e) => setFormData((f) => ({ ...f, separationType: e.target.value as SeparationType }))}
              className="w-full bg-white rounded-lg border border-gray-200 shadow-sm py-2.5 px-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {SEPARATION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1.5">Remarks</label>
            <textarea
              value={formData.remarks ?? ''}
              onChange={(e) => setFormData((f) => ({ ...f, remarks: e.target.value || null }))}
              rows={3}
              placeholder="Optional remarks..."
              className="w-full bg-white rounded-lg border border-gray-200 shadow-sm py-2.5 px-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => { setShowForm(false); setEditing(null); }}
              className="px-4 py-2.5 bg-white rounded-lg border border-gray-200 shadow-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2.5 bg-blue-600 text-white rounded-lg shadow-sm hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
            >
              {submitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
