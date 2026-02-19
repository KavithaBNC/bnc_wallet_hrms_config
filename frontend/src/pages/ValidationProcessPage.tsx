import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';
import paygroupService from '../services/paygroup.service';
import employeeService from '../services/employee.service';
import { attendanceService, type ValidationDaySummary, type LateDeductionEmployee, type LateDeductionResult } from '../services/attendance.service';

type TabKey = 'process' | 'status' | 'lateDeductions';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const EMPTY_DAY: ValidationDaySummary = {
  completed: 0,
  approvalPending: 0,
  late: 0,
  earlyGoing: 0,
  noOutPunch: 0,
  shiftChange: 0,
  absent: 0,
  shortfall: 0,
  overtime: 0,
};

/** Table rows for Validation Grouping modal: label + count key */
const VALIDATION_GROUPING_ROWS: { label: string; key: keyof ValidationDaySummary }[] = [
  { label: 'Absent', key: 'absent' },
  { label: 'Approval Pending', key: 'approvalPending' },
  { label: 'Early Going', key: 'earlyGoing' },
  { label: 'Late', key: 'late' },
  { label: 'No Out Punch', key: 'noOutPunch' },
  { label: 'OverTime', key: 'overtime' },
  { label: 'Shift Change', key: 'shiftChange' },
  { label: 'Shortfall', key: 'shortfall' },
  { label: 'Completed', key: 'completed' },
];

function getDayCellBgClass(dayStats: ValidationDaySummary): string {
  const hasAnomaly =
    dayStats.approvalPending > 0 ||
    dayStats.late > 0 ||
    dayStats.earlyGoing > 0 ||
    dayStats.noOutPunch > 0 ||
    dayStats.absent > 0 ||
    dayStats.shortfall > 0;
  const hasCompleted = dayStats.completed > 0;
  if (hasAnomaly && hasCompleted) return 'bg-amber-50';
  if (hasAnomaly) return 'bg-red-50';
  if (hasCompleted) return 'bg-green-50';
  return 'bg-white';
}

function associateDisplayName(firstName?: string, middleName?: string, lastName?: string, employeeCode?: string): string {
  const parts = [firstName, middleName, lastName].filter(Boolean);
  const fullName = parts.join(' ').trim();
  return fullName ? `${employeeCode || ''} - ${fullName}`.trim() : (employeeCode || '—');
}

function getMonthYearLabel(date: Date): string {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

function getCalendarWeeks(year: number, month: number): (number | null)[][] {
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  const startDay = first.getDay();
  const daysInMonth = last.getDate();
  const leadingBlanks = startDay;
  const totalCells = leadingBlanks + daysInMonth;
  const rows = Math.ceil(totalCells / 7);
  const weeks: (number | null)[][] = [];
  let day = 1;
  for (let r = 0; r < rows; r++) {
    const week: (number | null)[] = [];
    for (let c = 0; c < 7; c++) {
      const i = r * 7 + c;
      if (i < leadingBlanks) week.push(null);
      else if (day <= daysInMonth) {
        week.push(day);
        day++;
      } else week.push(null);
    }
    weeks.push(week);
  }
  return weeks;
}

export default function ValidationProcessPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;
  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id;

  const [paygroups, setPaygroups] = useState<{ id: string; name: string }[]>([]);
  const [associates, setAssociates] = useState<{ id: string; name: string }[]>([]);
  const [paygroupFilter, setPaygroupFilter] = useState<string>('ALL');
  const [associateFilter, setAssociateFilter] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState<TabKey>('process');
  const [loadingPaygroups, setLoadingPaygroups] = useState(false);
  const [loadingAssociates, setLoadingAssociates] = useState(false);
  const [showPaygroupDropdown, setShowPaygroupDropdown] = useState(false);
  const [showAssociateDropdown, setShowAssociateDropdown] = useState(false);
  const paygroupDropdownRef = useRef<HTMLDivElement>(null);
  const associateDropdownRef = useRef<HTMLDivElement>(null);
  // Process tab filters and calendar
  const [processFilter, setProcessFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set());
  const [dailySummary, setDailySummary] = useState<Record<string, ValidationDaySummary>>({});
  const [loadingProcess, setLoadingProcess] = useState(false);
  const [processError, setProcessError] = useState<string | null>(null);
  const [selectedDateForModal, setSelectedDateForModal] = useState<string | null>(null);
  const hasUserTriggeredProcess = useRef(false);

  const [lateDeductions, setLateDeductions] = useState<LateDeductionResult | null>(null);
  const [loadingLateDeductions, setLoadingLateDeductions] = useState(false);
  const [lateDeductionError, setLateDeductionError] = useState<string | null>(null);

  const runProcess = useCallback(async () => {
    if (!organizationId) return;
    setLoadingProcess(true);
    setProcessError(null);
    try {
      const res = await attendanceService.runValidationProcess({
        organizationId,
        paygroupId: paygroupFilter === 'ALL' ? undefined : paygroupFilter,
        employeeId: associateFilter === 'ALL' ? undefined : associateFilter,
        fromDate,
        toDate,
      });
      setDailySummary(res.daily ?? {});
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to run validation process';
      setProcessError(message);
      setDailySummary({});
    } finally {
      setLoadingProcess(false);
    }
  }, [organizationId, paygroupFilter, associateFilter, fromDate, toDate]);

  const loadStoredSummary = useCallback(async () => {
    if (!organizationId) return;
    try {
      const res = await attendanceService.getValidationProcessCalendarSummary({
        organizationId,
        paygroupId: paygroupFilter === 'ALL' ? undefined : paygroupFilter,
        employeeId: associateFilter === 'ALL' ? undefined : associateFilter,
        fromDate,
        toDate,
      });
      setDailySummary(res.daily ?? {});
    } catch {
      setDailySummary({});
    }
  }, [organizationId, paygroupFilter, associateFilter, fromDate, toDate]);

  const fetchLateDeductions = useCallback(async () => {
    if (!organizationId) return;
    setLoadingLateDeductions(true);
    setLateDeductionError(null);
    try {
      const res = await attendanceService.getValidationLateDeductions({
        organizationId,
        paygroupId: paygroupFilter === 'ALL' ? undefined : paygroupFilter,
        employeeId: associateFilter === 'ALL' ? undefined : associateFilter,
        fromDate,
        toDate,
      });
      setLateDeductions(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch late deductions';
      setLateDeductionError(msg);
      setLateDeductions(null);
    } finally {
      setLoadingLateDeductions(false);
    }
  }, [organizationId, paygroupFilter, associateFilter, fromDate, toDate]);

  useEffect(() => {
    if (!hasUserTriggeredProcess.current) return;
    loadStoredSummary();
  }, [paygroupFilter, associateFilter, loadStoredSummary]);

  useEffect(() => {
    if (!organizationId) return;
    setLoadingPaygroups(true);
    paygroupService
      .getAll({ organizationId })
      .then((list) => setPaygroups(list.map((p) => ({ id: p.id, name: p.name }))))
      .finally(() => setLoadingPaygroups(false));
  }, [organizationId]);

  useEffect(() => {
    if (!organizationId) return;
    setLoadingAssociates(true);
    employeeService
      .getAll({
        organizationId,
        employeeStatus: 'ACTIVE',
        limit: 5000,
        page: 1,
        sortBy: 'firstName',
        sortOrder: 'asc',
      })
      .then((res) => {
        const list = (res.employees || []).map((e) => ({
          id: e.id,
          name: associateDisplayName(e.firstName, e.middleName, e.lastName, e.employeeCode),
        }));
        setAssociates(list);
      })
      .finally(() => setLoadingAssociates(false));
  }, [organizationId]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (paygroupDropdownRef.current && !paygroupDropdownRef.current.contains(e.target as Node)) {
        setShowPaygroupDropdown(false);
      }
      if (associateDropdownRef.current && !associateDropdownRef.current.contains(e.target as Node)) {
        setShowAssociateDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (!user) {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-gray-100 items-center justify-center p-8">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  const paygroupOptions = [{ id: 'ALL', name: 'All' }, ...paygroups];
  const associateOptions = [{ id: 'ALL', name: 'All' }, ...associates];

  const selectedPaygroupLabel = paygroupFilter === 'ALL' ? 'All' : paygroups.find((p) => p.id === paygroupFilter)?.name ?? 'All';
  const selectedAssociateLabel =
    associateFilter === 'ALL' ? 'All' : associates.find((a) => a.id === associateFilter)?.name ?? 'All';

  const calendarYear = calendarMonth.getFullYear();
  const calendarMonthNum = calendarMonth.getMonth() + 1;
  const calendarWeeks = getCalendarWeeks(calendarYear, calendarMonthNum);

  const goPrevMonth = () => {
    setCalendarMonth((d) => {
      const next = new Date(d);
      next.setMonth(next.getMonth() - 1);
      const first = new Date(next.getFullYear(), next.getMonth(), 1);
      const last = new Date(next.getFullYear(), next.getMonth() + 1, 0);
      setFromDate(first.toISOString().slice(0, 10));
      setToDate(last.toISOString().slice(0, 10));
      return next;
    });
  };
  const goNextMonth = () => {
    setCalendarMonth((d) => {
      const next = new Date(d);
      next.setMonth(next.getMonth() + 1);
      const first = new Date(next.getFullYear(), next.getMonth(), 1);
      const last = new Date(next.getFullYear(), next.getMonth() + 1, 0);
      setFromDate(first.toISOString().slice(0, 10));
      setToDate(last.toISOString().slice(0, 10));
      return next;
    });
  };
  const goToday = () => {
    const d = new Date();
    setCalendarMonth(d);
    const first = new Date(d.getFullYear(), d.getMonth(), 1);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    setFromDate(first.toISOString().slice(0, 10));
    setToDate(last.toISOString().slice(0, 10));
  };

  const handleProcessOrView = () => {
    hasUserTriggeredProcess.current = true;
    const from = new Date(fromDate + 'T12:00:00');
    setCalendarMonth(from);
    runProcess();
  };

  const toggleDay = (year: number, month: number, day: number) => {
    const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedDays((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader
        title="HR Activities"
        subtitle={organizationName ? `Organization: ${organizationName}` : undefined}
        onLogout={handleLogout}
      />

      <main className="flex-1 min-h-0 flex flex-col w-full px-4 sm:px-6 lg:px-8 py-6 bg-gray-50">
        <div className="flex-1 flex flex-col min-h-0 w-full">
          {/* Breadcrumbs - Employee module style */}
          <div className="mb-4 flex-shrink-0">
            <nav className="flex items-center text-sm text-gray-600" aria-label="Breadcrumb">
              <Link to="/hr-activities" className="text-gray-500 hover:text-gray-900">
                HR Activities
              </Link>
              <span className="mx-1 text-gray-400">/</span>
              <span className="font-semibold text-gray-900">Validation Process</span>
            </nav>
          </div>

          {/* Card - full width and height */}
          <div className="flex-1 flex flex-col min-h-0 bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex-shrink-0">
              <h2 className="text-2xl font-bold text-gray-900">Validation Process</h2>
              <p className="text-gray-600 mt-1">Filter by Pay Group and Associate, then view Process or Status</p>
            </div>

            {/* Filters row - Employee module UI (label above, dropdown below) */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
              <div className="flex flex-wrap items-end gap-6">
                <div className="flex flex-col min-w-[200px]">
                  <label className="text-sm font-medium text-gray-500 mb-1.5">Pay Group</label>
                  <div className="relative" ref={paygroupDropdownRef}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPaygroupDropdown((v) => !v);
                        setShowAssociateDropdown(false);
                      }}
                      className="h-10 w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 text-left flex items-center justify-between focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <span>{loadingPaygroups ? 'Loading...' : selectedPaygroupLabel}</span>
                      <svg className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {showPaygroupDropdown && (
                      <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg py-1 max-h-60 overflow-auto">
                        {paygroupOptions.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setPaygroupFilter(opt.id);
                              setShowPaygroupDropdown(false);
                            }}
                            className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 ${
                              paygroupFilter === opt.id ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-700'
                            }`}
                          >
                            {opt.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col min-w-[200px]">
                  <label className="text-sm font-medium text-gray-500 mb-1.5">Associate</label>
                  <div className="relative" ref={associateDropdownRef}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAssociateDropdown((v) => !v);
                        setShowPaygroupDropdown(false);
                      }}
                      className="h-10 w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 text-left flex items-center justify-between focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <span>{loadingAssociates ? 'Loading...' : selectedAssociateLabel}</span>
                      <svg className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {showAssociateDropdown && (
                      <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg py-1 max-h-60 overflow-auto">
                        {associateOptions.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setAssociateFilter(opt.id);
                              setShowAssociateDropdown(false);
                            }}
                            className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 ${
                              associateFilter === opt.id ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-700'
                            }`}
                          >
                            {opt.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {/* Process / Status tabs - right side, Employee module style (text + border for active) */}
                <div className="flex items-center gap-1 ml-auto">
                  <button
                    type="button"
                    onClick={() => setActiveTab('process')}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
                      activeTab === 'process'
                        ? 'bg-gray-100 text-gray-900 border border-gray-300'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    Process
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('status')}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
                      activeTab === 'status'
                        ? 'bg-gray-100 text-gray-900 border border-gray-300'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    Status
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('lateDeductions')}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
                      activeTab === 'lateDeductions'
                        ? 'bg-blue-100 text-blue-900 border border-blue-300'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    Late Deductions
                  </button>
                </div>
              </div>
            </div>

            {/* Content area - fills remaining space */}
            <div className="flex-1 min-h-0 overflow-auto p-6 flex flex-col">
              {activeTab === 'process' && (
                <>
                  {/* Process tab: extra filters */}
                  <div className="flex flex-wrap items-end gap-4 mb-4 flex-shrink-0">
                    <div className="flex flex-col min-w-[140px]">
                      <label className="text-sm font-medium text-gray-500 mb-1.5">Process</label>
                      <input
                        type="text"
                        value={processFilter}
                        onChange={(e) => setProcessFilter(e.target.value)}
                        placeholder="Process"
                        className="h-10 w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div className="flex flex-col min-w-[140px]">
                      <label className="text-sm font-medium text-gray-500 mb-1.5">Status</label>
                      <input
                        type="text"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        placeholder="Status"
                        className="h-10 w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div className="flex flex-col min-w-[140px]">
                      <label className="text-sm font-medium text-gray-500 mb-1.5">From Date</label>
                      <input
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="h-10 w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div className="flex flex-col min-w-[140px]">
                      <label className="text-sm font-medium text-gray-500 mb-1.5">To Date</label>
                      <input
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        className="h-10 w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {processError && (
                    <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                      {processError}
                    </div>
                  )}
                  {/* Action buttons - Employee module style */}
                  <div className="flex flex-wrap items-center gap-2 mb-4 flex-shrink-0">
                    <button
                      type="button"
                      onClick={handleProcessOrView}
                      disabled={loadingProcess || !organizationId}
                      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      {loadingProcess ? 'Processing...' : 'Process'}
                    </button>
                    <button
                      type="button"
                      onClick={handleProcessOrView}
                      disabled={loadingProcess || !organizationId}
                      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Refresh
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-gray-300 bg-white text-sm font-medium text-red-700 hover:bg-red-50"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                      Revert / Validation On Hold
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <span className="font-semibold">×</span> All
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V20l-4-4v-4.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                      </svg>
                      Filter
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Reset
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Export
                    </button>
                  </div>

                  {/* Calendar */}
                  <div className="flex-1 min-h-0 flex flex-col border border-gray-200 rounded-lg overflow-hidden bg-white">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50 flex-shrink-0">
                      <h3 className="text-lg font-semibold text-gray-900">{getMonthYearLabel(calendarMonth)}</h3>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={goToday}
                          className="h-9 px-3 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Today
                        </button>
                        <button
                          type="button"
                          onClick={goPrevMonth}
                          className="h-9 w-9 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 flex items-center justify-center"
                          aria-label="Previous month"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={goNextMonth}
                          className="h-9 w-9 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 flex items-center justify-center"
                          aria-label="Next month"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 min-h-0 overflow-auto p-4">
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr>
                            {WEEKDAYS.map((wd) => (
                              <th key={wd} className="border border-gray-200 bg-gray-50 px-2 py-2 text-left font-medium text-gray-700">
                                {wd}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {calendarWeeks.map((week, wi) => (
                            <tr key={wi}>
                              {week.map((day, di) => {
                                if (day === null) {
                                  return <td key={di} className="border border-gray-200 bg-gray-50/50 p-1 min-h-[80px]" />;
                                }
                                const dateKey = `${calendarYear}-${String(calendarMonthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                const checked = selectedDays.has(dateKey);
                                const dayStats = dailySummary[dateKey] ?? EMPTY_DAY;
                                const cellBg = getDayCellBgClass(dayStats);
                                return (
                                  <td
                                    key={di}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => setSelectedDateForModal(dateKey)}
                                    onKeyDown={(e) => e.key === 'Enter' && setSelectedDateForModal(dateKey)}
                                    className={`border border-gray-200 align-top p-1.5 min-w-[120px] cursor-pointer hover:ring-1 hover:ring-blue-300 ${cellBg}`}
                                  >
                                    <div className="flex items-start gap-1 mb-1">
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          toggleDay(calendarYear, calendarMonthNum, day);
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        className="rounded border-gray-300 text-gray-600 focus:ring-gray-500"
                                      />
                                      <span className="text-xs font-medium text-gray-500">{day}</span>
                                    </div>
                                    {dayStats.completed > 0 && (
                                      <div className="text-xs font-medium text-green-700 mb-1">Completed: {dayStats.completed}</div>
                                    )}
                                    {dayStats.approvalPending > 0 && (
                                      <div className="text-xs text-red-700">Approval Pending: {dayStats.approvalPending}</div>
                                    )}
                                    {dayStats.late > 0 && <div className="text-xs text-red-700">Late: {dayStats.late}</div>}
                                    {dayStats.earlyGoing > 0 && <div className="text-xs text-red-700">Early Going: {dayStats.earlyGoing}</div>}
                                    {dayStats.noOutPunch > 0 && <div className="text-xs text-red-700">No Out Punch: {dayStats.noOutPunch}</div>}
                                    {dayStats.shiftChange > 0 && <div className="text-xs text-red-700">Shift Change: {dayStats.shiftChange}</div>}
                                    {dayStats.absent > 0 && <div className="text-xs text-red-700">Absent: {dayStats.absent}</div>}
                                    {dayStats.shortfall > 0 && <div className="text-xs text-red-700">Shortfall: {dayStats.shortfall}</div>}
                                    {dayStats.overtime > 0 && <div className="text-xs text-gray-700">OverTime: {dayStats.overtime}</div>}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Validation Grouping modal - opens when a date is clicked */}
                  {selectedDateForModal && (
                    <div
                      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
                      aria-modal="true"
                      role="dialog"
                      onClick={() => setSelectedDateForModal(null)}
                    >
                      <div
                        className="bg-white rounded-lg shadow-xl border border-gray-200 w-full max-w-2xl max-h-[90vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-blue-600 rounded-t-lg">
                          <h3 className="text-lg font-semibold text-white">Validation Grouping</h3>
                          <button
                            type="button"
                            onClick={() => setSelectedDateForModal(null)}
                            className="p-1 rounded text-white hover:bg-white/20 focus:ring-2 focus:ring-white"
                            aria-label="Close"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        <div className="px-6 py-3 border-b border-gray-100 bg-gray-50 text-sm text-gray-600">
                          {(() => {
                            const [y, m, d] = selectedDateForModal.split('-').map(Number);
                            const dObj = new Date(y, m - 1, d);
                            const dateLabel = dObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
                            return <>Date: {dateLabel}</>;
                          })()}
                        </div>
                        <div className="flex items-center justify-between gap-4 px-6 py-3 border-b border-gray-200 bg-white">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">Show</span>
                            <select className="h-9 px-2 border border-gray-300 rounded text-sm text-gray-700 bg-white">
                              <option value={10}>10</option>
                              <option value={25}>25</option>
                              <option value={50}>50</option>
                            </select>
                            <span className="text-sm text-gray-500">entries</span>
                            <input
                              type="search"
                              placeholder="Search..."
                              className="h-9 px-3 border border-gray-300 rounded text-sm text-gray-700 w-40"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <button type="button" className="inline-flex items-center gap-1.5 h-9 px-3 rounded border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5M9 9V7m3 6v6m2-4v4m2-4v4H5a2 2 0 01-2-2v-4a2 2 0 012-2h2m-4 0V5a2 2 0 012-2h6a2 2 0 012 2v4" />
                              </svg>
                              Print
                            </button>
                            <button type="button" className="inline-flex items-center gap-1.5 h-9 px-3 rounded border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m4 3V4" />
                              </svg>
                              Save
                              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                            <button type="button" className="inline-flex items-center gap-1.5 h-9 px-3 rounded border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              Show / hide columns
                            </button>
                          </div>
                        </div>
                        <div className="flex-1 min-h-0 overflow-auto px-6 py-4">
                          <table className="w-full border-collapse text-sm">
                            <thead>
                              <tr>
                                <th className="border border-gray-200 bg-gray-50 px-4 py-2 text-left font-medium text-gray-700">Validation Grouping</th>
                                <th className="border border-gray-200 bg-gray-50 px-4 py-2 text-left font-medium text-gray-700">Count</th>
                                <th className="border border-gray-200 bg-gray-50 px-4 py-2 text-left font-medium text-gray-700">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {VALIDATION_GROUPING_ROWS.map(({ label, key }) => {
                                const count = (dailySummary[selectedDateForModal] ?? EMPTY_DAY)[key];
                                return (
                                  <tr key={key} className="border-b border-gray-200 hover:bg-gray-50">
                                    <td className="border border-gray-200 px-4 py-2 text-gray-900">{label}</td>
                                    <td className="border border-gray-200 px-4 py-2 text-gray-700">{count}</td>
                                    <td className="border border-gray-200 px-4 py-2">
                                      <button
                                        type="button"
                                        className="p-1.5 rounded text-gray-500 hover:bg-gray-100 focus:ring-2 focus:ring-blue-500"
                                        aria-label={`View ${label} list`}
                                        title="View list"
                                      >
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                        </svg>
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 bg-gray-50 rounded-b-lg">
                          <span className="text-sm text-gray-500">Showing 1 to {VALIDATION_GROUPING_ROWS.length} of {VALIDATION_GROUPING_ROWS.length} entries</span>
                          <button
                            type="button"
                            onClick={() => setSelectedDateForModal(null)}
                            className="inline-flex items-center gap-1.5 h-9 px-4 rounded border border-red-200 bg-red-50 text-red-700 text-sm font-medium hover:bg-red-100"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Close
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
              {activeTab === 'status' && (
                <div className="text-gray-600">
                  <p className="font-medium text-gray-900 mb-1">Status view</p>
                  <p className="text-sm">Pay Group: {selectedPaygroupLabel} · Associate: {selectedAssociateLabel}</p>
                  <p className="text-sm mt-2">Status content will be shown here.</p>
                </div>
              )}
              {activeTab === 'lateDeductions' && (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-end gap-4">
                    <div className="flex flex-col min-w-[140px]">
                      <label className="text-sm font-medium text-gray-500 mb-1.5">From Date</label>
                      <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                        className="h-10 w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                    <div className="flex flex-col min-w-[140px]">
                      <label className="text-sm font-medium text-gray-500 mb-1.5">To Date</label>
                      <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
                        className="h-10 w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                    <button type="button" onClick={fetchLateDeductions} disabled={loadingLateDeductions || !organizationId}
                      className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
                      {loadingLateDeductions ? 'Calculating...' : 'Calculate Late Deductions'}
                    </button>
                  </div>

                  {lateDeductionError && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{lateDeductionError}</div>
                  )}

                  {lateDeductions && (
                    <>
                      <div className="flex flex-wrap gap-4">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex flex-col">
                          <span className="text-xs text-blue-600 font-medium">Employees with Late</span>
                          <span className="text-2xl font-bold text-blue-900">{lateDeductions.totals.totalEmployees}</span>
                        </div>
                        <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 flex flex-col">
                          <span className="text-xs text-orange-600 font-medium">Total Late Count</span>
                          <span className="text-2xl font-bold text-orange-900">{lateDeductions.totals.totalLateCount}</span>
                        </div>
                        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex flex-col">
                          <span className="text-xs text-red-600 font-medium">Total Late Hours</span>
                          <span className="text-2xl font-bold text-red-900">{(lateDeductions.totals.totalLateMinutes / 60).toFixed(1)} hr</span>
                        </div>
                      </div>

                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-3 text-left font-medium text-gray-700">#</th>
                                <th className="px-4 py-3 text-left font-medium text-gray-700">Employee Code</th>
                                <th className="px-4 py-3 text-left font-medium text-gray-700">Employee Name</th>
                                <th className="px-4 py-3 text-right font-medium text-gray-700">Late Count</th>
                                <th className="px-4 py-3 text-right font-medium text-gray-700">Total Late Hours</th>
                                <th className="px-4 py-3 text-left font-medium text-gray-700">Tier / Action</th>
                                <th className="px-4 py-3 text-left font-medium text-gray-700">Deduction Type</th>
                                <th className="px-4 py-3 text-right font-medium text-gray-700">Deduction Days</th>
                                <th className="px-4 py-3 text-left font-medium text-gray-700">Note</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white">
                              {lateDeductions.employees.length === 0 ? (
                                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-500">No late records found for the selected period</td></tr>
                              ) : (
                                lateDeductions.employees.map((emp: LateDeductionEmployee, idx: number) => (
                                  <tr key={emp.employeeId} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 text-gray-500">{idx + 1}</td>
                                    <td className="px-4 py-3 text-gray-900 font-medium">{emp.employeeCode}</td>
                                    <td className="px-4 py-3 text-gray-900">{emp.employeeName}</td>
                                    <td className="px-4 py-3 text-right text-gray-700">{emp.lateCount}</td>
                                    <td className="px-4 py-3 text-right font-medium text-gray-900">{emp.totalLateHours} hr</td>
                                    <td className="px-4 py-3">
                                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                        {emp.actionName || '—'}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                                        emp.deductionType === 'Permission' ? 'bg-green-100 text-green-800' :
                                        emp.deductionType === 'Leave' ? 'bg-yellow-100 text-yellow-800' :
                                        emp.deductionType === 'LOP' ? 'bg-red-100 text-red-800' :
                                        'bg-gray-100 text-gray-800'
                                      }`}>
                                        {emp.deductionType || '—'}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{emp.deductionDays}</td>
                                    <td className="px-4 py-3 text-xs text-gray-500">
                                      {emp.permissionExhausted && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                                          Permission exhausted → fallback
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  )}

                  {!lateDeductions && !loadingLateDeductions && !lateDeductionError && (
                    <div className="text-center py-12 text-gray-500">
                      <p className="text-lg font-medium mb-1">Select date range and click "Calculate Late Deductions"</p>
                      <p className="text-sm">System will aggregate total late hours per employee and apply tier rules</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
