import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';
import { attendanceService } from '../services/attendance.service';
import employeeService, { type Employee } from '../services/employee.service';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';
import shiftService, { Shift } from '../services/shift.service';
import { startOfMonth, endOfMonth, eachDayOfInterval, format, isToday, getDay, addMonths } from 'date-fns';

interface AttendanceRecord {
  id: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
  workHours: number | null;
  overtimeHours: number | null;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeCode: string;
  };
  shift?: {
    id: string;
    name: string;
    startTime: string;
    endTime: string;
  } | null;
}

interface AttendancePunch {
  id: string;
  employeeId: string;
  punchTime: string;
  status: string;
  punchSource?: string;
}

/** Convert decimal hours to 'HH:mm' (e.g. 0.2h → '00:12', 2.5h → '02:30'). */
function formatWorkHoursAsHHMM(decimalHours: number): string {
  const totalMinutes = Math.round(decimalHours * 60);
  const h = Math.floor(Math.abs(totalMinutes) / 60);
  const m = Math.abs(totalMinutes) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Build In/Out session pairs from sorted punches; each pair is [inTime, outTime | null]. */
function buildSessionPairs(punches: AttendancePunch[]): Array<{ in: string; out: string | null }> {
  const pairs: Array<{ in: string; out: string | null }> = [];
  for (let i = 0; i < punches.length; i++) {
    const p = punches[i];
    if ((p.status?.toUpperCase() || '') === 'IN') {
      const nextOut = punches.slice(i + 1).find((x) => (x.status?.toUpperCase() || '') === 'OUT');
      pairs.push({
        in: p.punchTime,
        out: nextOut ? nextOut.punchTime : null,
      });
    }
  }
  return pairs;
}

// Calendar View Component
interface AttendanceCalendarViewProps {
  records: AttendanceRecord[];
  punches: AttendancePunch[];
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
  employeeId?: string;
  organizationId?: string;
}

const AttendanceCalendarView = ({ records, punches, currentMonth, onMonthChange, employeeId, organizationId }: AttendanceCalendarViewProps) => {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  // Get first day of month to calculate offset
  const firstDayOfWeek = getDay(monthStart);
  const daysOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1; // Monday = 0
  
  // State for shift assignments
  const [shiftAssignments, setShiftAssignments] = useState<Map<string, string>>(new Map()); // date -> shiftName
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loadingShifts, setLoadingShifts] = useState(false);
  
  // Fetch shifts from Shift Master
  useEffect(() => {
    if (!organizationId) return;
    
    shiftService.getAll({
      organizationId,
      limit: 1000,
    }).then((res) => {
      setShifts(res?.shifts || []);
    }).catch(() => {
      setShifts([]);
    });
  }, [organizationId]);
  
  // Fetch or determine shift assignments for each day
  useEffect(() => {
    if (!employeeId || !organizationId) return;
    
    setLoadingShifts(true);
    
    // Create shift assignments map - default to "General Shift" for all dates
    // Override with explicitly assigned shifts from attendance records
    const assignments = new Map<string, string>();
    const defaultShift = 'General Shift';
    
    console.log('📅 Calendar: Determining shift assignments for employee:', employeeId);
    console.log('📅 Calendar: Total records received:', records.length);
    console.log('📅 Calendar: Records with shifts:', records.filter(r => r.shift?.name).map(r => ({
      date: format(new Date(r.date), 'yyyy-MM-dd'),
      shift: r.shift?.name,
      employeeId: r.employee.id
    })));
    
    daysInMonth.forEach((date) => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      
      // Check if there's an attendance record with shift for this date (from saved shift assignments)
      // IMPORTANT: Check all records, not just ones with check-in/check-out
      const dayRecord = records.find(r => {
        const recordDate = format(new Date(r.date), 'yyyy-MM-dd');
        const matchesDate = recordDate === dateStr;
        const matchesEmployee = r.employee.id === employeeId;
        return matchesDate && matchesEmployee;
      });
      
      if (dayRecord) {
        console.log(`📅 Calendar: Found record for ${dateStr}:`, {
          hasShift: !!dayRecord.shift,
          shiftName: dayRecord.shift?.name,
          employeeId: dayRecord.employee.id,
          matchesTargetEmployee: dayRecord.employee.id === employeeId
        });
      }
      
      if (dayRecord?.shift?.name) {
        // Use shift from attendance record (this reflects saved shift assignments from Associate Shift Grid)
        // This overrides the default "General Shift" for this specific date
        console.log(`✅ Calendar: Using saved shift "${dayRecord.shift.name}" for ${dateStr}`);
        assignments.set(dateStr, dayRecord.shift.name);
      } else if (isWeekend) {
        // Weekend - show as Weekoff
        assignments.set(dateStr, 'Weekoff');
      } else {
        // Default to "General Shift" for all weekdays without explicit assignment
        assignments.set(dateStr, defaultShift);
      }
    });
    
    console.log('📅 Calendar: Final shift assignments:', Array.from(assignments.entries()));
    setShiftAssignments(assignments);
    setLoadingShifts(false);
  }, [daysInMonth, records, employeeId, shifts, organizationId]);
  
  // Create a map of date strings to records for quick lookup.
  // Use checkIn's local date so punches show on the correct calendar day (fixes timezone "yesterday" bug).
  const recordsByDate = new Map<string, AttendanceRecord[]>();
  records.forEach(record => {
    const d = record.checkIn ? new Date(record.checkIn) : new Date(record.date);
    const dateStr = format(new Date(d.getFullYear(), d.getMonth(), d.getDate()), 'yyyy-MM-dd');
    if (!recordsByDate.has(dateStr)) {
      recordsByDate.set(dateStr, []);
    }
    recordsByDate.get(dateStr)!.push(record);
  });

  // Group punches by (dateStr, employeeId) so we can show every IN/OUT per day
  const punchesByDateEmployee = new Map<string, AttendancePunch[]>();
  punches.forEach(p => {
    const d = new Date(p.punchTime);
    const dateStr = format(new Date(d.getFullYear(), d.getMonth(), d.getDate()), 'yyyy-MM-dd');
    const key = `${dateStr}:${p.employeeId}`;
    if (!punchesByDateEmployee.has(key)) punchesByDateEmployee.set(key, []);
    punchesByDateEmployee.get(key)!.push(p);
  });
  punchesByDateEmployee.forEach((arr) => arr.sort((a, b) => new Date(a.punchTime).getTime() - new Date(b.punchTime).getTime()));

  const navigateMonth = (direction: 'prev' | 'next') => {
    try {
      // Use date-fns addMonths to handle edge cases (e.g., Jan 31 -> Feb 28/29)
      const newDate = direction === 'prev' 
        ? addMonths(currentMonth, -1)
        : addMonths(currentMonth, 1);
      onMonthChange(newDate);
    } catch (error) {
      console.error('Error navigating month:', error);
      // Fallback: manually set month with proper handling
      const newDate = new Date(currentMonth);
      const currentDay = newDate.getDate();
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      // Ensure the date is valid (handle cases like Jan 31 -> Feb)
      if (newDate.getDate() !== currentDay) {
        // Date was adjusted, set to first day of month
        newDate.setDate(1);
      }
      onMonthChange(newDate);
    }
  };

  const goToToday = () => {
    onMonthChange(new Date());
  };

  const isWeekend = (date: Date) => {
    const day = getDay(date);
    return day === 0 || day === 6; // Sunday or Saturday
  };

  return (
    <div className="p-6">
      {/* Calendar Header */}
      <div className="flex justify-between items-center mb-6">
        <button
          onClick={() => navigateMonth('prev')}
          className="px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
        >
          ← Previous
        </button>
        <div className="flex items-center space-x-4">
          <h3 className="text-xl font-semibold text-gray-900">
            {format(currentMonth, 'MMMM yyyy')}
          </h3>
          <button
            onClick={goToToday}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
          >
            Today
          </button>
        </div>
        <button
          onClick={() => navigateMonth('next')}
          className="px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
        >
          Next →
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-3">
        {/* Day Headers */}
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
          <div key={day} className="text-center text-sm font-semibold text-gray-700 py-2">
            {day}
          </div>
        ))}

        {/* Empty cells for days before month start */}
        {Array.from({ length: daysOffset }).map((_, idx) => (
          <div key={`empty-${idx}`} className="h-32 bg-gray-50 rounded-lg"></div>
        ))}

        {/* Calendar Days */}
        {daysInMonth.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const dayRecords = recordsByDate.get(dateStr) || [];
          const isCurrentDay = isToday(day);
          const isWeekendDay = isWeekend(day);
          const dayNumber = format(day, 'd');
          const shiftName = shiftAssignments.get(dateStr) || 'General Shift'; // Default to "General Shift"

          return (
            <div
              key={dateStr}
              className={`min-h-32 bg-white border rounded-lg p-3 shadow-sm hover:shadow-md transition ${
                isCurrentDay
                  ? 'border-blue-400 ring-2 ring-blue-200'
                  : 'border-gray-200'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <span className={`text-sm font-semibold ${
                  isCurrentDay ? 'text-blue-700' : 'text-gray-900'
                }`}>
                  {dayNumber}
                </span>
                {isWeekendDay && (
                  <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">
                    Weekend
                  </span>
                )}
              </div>
              
              <div className="space-y-1.5">
                {/* Display shift name badge - always shown (default is "General Shift") */}
                {shiftName && (
                  <div className={`inline-block px-2 py-1 rounded text-xs font-semibold mb-1 ${
                    shiftName === 'Weekoff' || shiftName === 'W'
                      ? 'bg-gray-700 text-white'
                      : 'bg-blue-600 text-white'
                  }`}>
                    {shiftName === 'W' ? 'Weekoff' : shiftName}
                  </div>
                )}
                
                {dayRecords.length > 0 ? (
                  dayRecords.map((record) => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const dayPunches = punchesByDateEmployee.get(`${dateStr}:${record.employee.id}`) || [];
                    const sessions = buildSessionPairs(dayPunches);
                    const firstIn = record.checkIn || (dayPunches.find((p) => (p.status?.toUpperCase() || '') === 'IN')?.punchTime);
                    const lastOut = record.checkOut || (dayPunches.filter((p) => (p.status?.toUpperCase() || '') === 'OUT').pop()?.punchTime);
                    const lastPunchOfDay = dayPunches.length > 0 ? dayPunches[dayPunches.length - 1] : null;
                    const isCurrentlyIn = firstIn && !lastOut && lastPunchOfDay && (lastPunchOfDay.status?.toUpperCase() || '') === 'IN';
                    const lastInTime = dayPunches.filter((p) => (p.status?.toUpperCase() || '') === 'IN').pop()?.punchTime;
                    const formatTime = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

                    return (
                      <div
                        key={record.id}
                        className="text-xs space-y-1"
                      >
                        <div className="font-medium text-gray-900 truncate">
                          {record.employee.firstName} {record.employee.lastName}
                        </div>
                        {/* First In and Last Out (or Currently In if still clocked in) */}
                        <div className="flex flex-wrap gap-x-2 gap-y-0.5 font-semibold">
                          {firstIn && (
                            <span className="text-blue-700">First In: {formatTime(typeof firstIn === 'string' ? firstIn : (firstIn as Date).toISOString())}</span>
                          )}
                          {lastOut ? (
                            <span className="text-red-700">Last Out: {formatTime(typeof lastOut === 'string' ? lastOut : (lastOut as Date).toISOString())}</span>
                          ) : isCurrentlyIn && lastInTime ? (
                            <span className="text-amber-700">Currently In (since {formatTime(lastInTime)})</span>
                          ) : firstIn && (
                            <span className="text-amber-700">Still Working</span>
                          )}
                        </div>
                        {/* Every In/Out pair (sessions) so user sees where time was spent */}
                        {sessions.length > 0 && (
                          <div className="text-gray-600 space-y-0.5 border-l-2 border-gray-200 pl-1.5">
                            {sessions.map((pair, idx) => (
                              <div key={idx} className="leading-tight">
                                In: {formatTime(pair.in)} | {pair.out ? `Out: ${formatTime(pair.out)}` : 'Out: —'}
                              </div>
                            ))}
                          </div>
                        )}
                        {record.status && (
                          <div className={`text-xs font-medium ${
                            record.status === 'PRESENT'
                              ? 'text-green-700'
                              : record.status === 'ABSENT'
                              ? 'text-red-700'
                              : record.status === 'LEAVE'
                              ? 'text-purple-700'
                              : 'text-yellow-700'
                          }`}>
                            {record.status}
                          </div>
                        )}
                        {/* Total Net Work Time in HH:mm right below PRESENT */}
                        {record.workHours !== null && record.workHours !== undefined && (
                          <div className="text-gray-800 font-medium">
                            Total Net Work Time: {formatWorkHoursAsHHMM(Number(record.workHours))}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-xs text-gray-400 text-center py-2">No records</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-8 flex items-center justify-start space-x-6 text-sm">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
          <span className="text-gray-600">Today</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          <span className="text-gray-600">Present</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
          <span className="text-gray-600">Absent</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
          <span className="text-gray-600">Leave</span>
        </div>
      </div>
    </div>
  );
};

const AttendancePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loadUser, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [myRecords, setMyRecords] = useState<AttendanceRecord[]>([]);
  const [punches, setPunches] = useState<AttendancePunch[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMyRecords, setLoadingMyRecords] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkedIn, setCheckedIn] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [loadingUser, setLoadingUser] = useState(false);
  const [componentError, setComponentError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'team' | 'my'>('team'); // For managers to toggle view
  const [displayMode, setDisplayMode] = useState<'table' | 'calendar'>('calendar'); // Table or Calendar view
  const [currentMonth, setCurrentMonth] = useState(new Date()); // Current month for calendar
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncFromDate, setSyncFromDate] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [syncToDate, setSyncToDate] = useState(() => format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ synced: number; created: number; updated: number; skipped: number; errors: { employeeCode: string; date: string; message: string }[] } | null>(null);

  // Manual punch (for testing): any date, multiple In/Out per day
  const [manualPunchDate, setManualPunchDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [manualPunchTime, setManualPunchTime] = useState(() => format(new Date(), 'HH:mm'));
  const [manualPunchEmployeeId, setManualPunchEmployeeId] = useState<string | null>(null); // null = self
  const [manualPunchSubmitting, setManualPunchSubmitting] = useState(false);
  const [manualPunchMessage, setManualPunchMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [manualPunchEmployeeList, setManualPunchEmployeeList] = useState<Employee[]>([]);
  
  // Check if user is a manager
  const isManager = user?.role === 'MANAGER';
  const isHRManager = user?.role === 'HR_MANAGER';
  const isOrgAdmin = user?.role === 'ORG_ADMIN';
  const canViewTeamAttendance = isManager || isHRManager || isOrgAdmin;
  const canSyncBiometric = isHRManager || isOrgAdmin || user?.role === 'SUPER_ADMIN';
  const canManualPunch = isHRManager || isOrgAdmin || user?.role === 'SUPER_ADMIN';
  // HR-only: calendar view requires selecting one employee (no "all employees" by default)
  const isHRForCalendar = isHRManager || isOrgAdmin;

  // HR-only: single-employee selection for calendar/table (searchable dropdown)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [employeeList, setEmployeeList] = useState<Employee[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employeeDropdownOpen, setEmployeeDropdownOpen] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const employeeDropdownRef = useRef<HTMLDivElement>(null);

  // Load user data if not available
  useEffect(() => {
    if (!user && !loadingUser) {
      setLoadingUser(true);
      loadUser()
        .catch((err) => {
          console.error('Failed to load user:', err);
          setComponentError('Failed to load user data. Please refresh the page.');
        })
        .finally(() => {
          setLoadingUser(false);
        });
    }
  }, [user, loadUser, loadingUser]);

  useEffect(() => {
    if (user) {
      (async () => {
        try {
          await Promise.allSettled([
            fetchRecords(),
            fetchMyRecords(),
            fetchPunches(),
            checkTodayStatus(),
          ]);
        } catch (err: any) {
          console.error('Error in useEffect:', err);
          setComponentError(err.message || 'Failed to initialize attendance page');
        }
      })();
    }
  }, [user, currentMonth, viewMode]);

  // Also check status when records are fetched
  useEffect(() => {
    if (user?.employee?.id && (records.length > 0 || myRecords.length > 0)) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];
      const recordsToCheck = canViewTeamAttendance && myRecords.length > 0 ? myRecords : records;
      const todayRecord = recordsToCheck.find((r: AttendanceRecord) => {
        try {
          const recordDate = new Date(r.date).toISOString().split('T')[0];
          return recordDate === todayStr && r.employee?.id === user.employee?.id;
        } catch (e) {
          return false;
        }
      });
      if (todayRecord?.checkIn && !todayRecord?.checkOut) {
        setCheckedIn(true);
      } else if (todayRecord?.checkOut) {
        setCheckedIn(false);
      }
    }
  }, [records, myRecords, user, canViewTeamAttendance]);

  // Refetch attendance and punches when calendar month or (for HR) selected employee changes
  useEffect(() => {
    if (user) {
      fetchRecords();
      fetchMyRecords();
      fetchPunches();
    }
  }, [currentMonth, selectedEmployeeId]);

  // Refetch when tab/window gains focus so device punches (or web check-in/out) are reflected without manual refresh
  useEffect(() => {
    const onFocus = () => {
      if (user) {
        checkTodayStatus();
        fetchRecords();
        fetchMyRecords();
        fetchPunches();
      }
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [user]);

  // Refetch when returning from Face Attendance punch so calendar shows the new punch
  useEffect(() => {
    const state = location.state as { refreshFromFacePunch?: boolean } | null;
    if (state?.refreshFromFacePunch && user) {
      // Await refetch so calendar shows the new punch before we clear state
      const refetch = async () => {
        await Promise.all([fetchRecords(), fetchMyRecords(), fetchPunches(), checkTodayStatus()]);
        navigate('/attendance', { replace: true, state: {} });
      };
      refetch();
    }
  }, [location.state, user]);

  // HR-only: fetch employees for searchable dropdown when in team view
  useEffect(() => {
    if (!isHRForCalendar || viewMode !== 'team') return;
    let cancelled = false;
    setLoadingEmployees(true);
    employeeService.getAll({ limit: 500, employeeStatus: 'ACTIVE' })
      .then((data) => {
        if (!cancelled) setEmployeeList(data.employees || []);
      })
      .catch(() => {
        if (!cancelled) setEmployeeList([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingEmployees(false);
      });
    return () => { cancelled = true; };
  }, [isHRForCalendar, viewMode]);

  // Close HR employee dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (employeeDropdownRef.current && !employeeDropdownRef.current.contains(e.target as Node)) {
        setEmployeeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // When HR switches to "My Records", clear selected employee
  useEffect(() => {
    if (viewMode === 'my') setSelectedEmployeeId(null);
  }, [viewMode]);

  // Fetch employees for manual punch dropdown (HR/Admin only)
  useEffect(() => {
    if (!canManualPunch) return;
    let cancelled = false;
    employeeService.getAll({ limit: 500, employeeStatus: 'ACTIVE' })
      .then((data) => { if (!cancelled) setManualPunchEmployeeList(data.employees || []); })
      .catch(() => { if (!cancelled) setManualPunchEmployeeList([]); });
    return () => { cancelled = true; };
  }, [canManualPunch]);

  const fetchRecords = async () => {
    try {
      const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id;
      if (!organizationId) {
        console.warn('Organization ID not available, skipping fetchRecords');
        setRecords([]);
        return;
      }
      if (isHRForCalendar && viewMode === 'team' && !selectedEmployeeId) {
        setRecords([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);
      const params: Record<string, unknown> = {
        page: 1,
        limit: 1000,
        startDate: format(monthStart, 'yyyy-MM-dd'),
        endDate: format(monthEnd, 'yyyy-MM-dd'),
        organizationId,
      };
      if (viewMode === 'my' || !canViewTeamAttendance) {
        if (user?.employee?.id) params.employeeId = user.employee.id;
      } else if (isHRForCalendar && viewMode === 'team' && selectedEmployeeId) {
        params.employeeId = selectedEmployeeId;
      }
      const response = await api.get('/attendance/records', {
        params,
      });
      if (response.data?.data?.records) {
        setRecords(response.data.data.records);
      } else {
        setRecords([]);
      }
    } catch (err: any) {
      const status = err.response?.status;
      const errorMsg = err.response?.data?.message || err.message || 'Failed to fetch attendance records';
      
      // 404 or "not found" errors are expected when there are no records for a month
      // Don't show these as errors, just set empty records
      if (status === 404 || errorMsg.toLowerCase().includes('not found')) {
        console.log('No records found for this month (expected)');
        setRecords([]);
        setError(null); // Clear any previous errors
      } else {
        setError(errorMsg);
        console.error('Error fetching records:', err);
      }
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch all IN/OUT punches for the month so calendar shows every punch (e.g. 4:31)
  const fetchPunches = async () => {
    const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
    let employeeId: string | undefined;
    if (!canViewTeamAttendance && user?.employee?.id) employeeId = user.employee.id; // EMPLOYEE: always own
    else if (viewMode === 'my' && user?.employee?.id) employeeId = user.employee.id;
    else if (isHRForCalendar && viewMode === 'team' && selectedEmployeeId) employeeId = selectedEmployeeId;
    else if (canViewTeamAttendance && viewMode === 'team' && !isHRForCalendar) return; // manager team: many employees, skip punches
    if (!employeeId) {
      setPunches([]);
      return;
    }
    try {
      const res = await api.get<{ data: { punches: AttendancePunch[] } }>('/attendance/punches', {
        params: { startDate: monthStart, endDate: monthEnd, employeeId },
      });
      setPunches(res.data?.data?.punches || []);
    } catch {
      setPunches([]);
    }
  };

  // Fetch manager's own attendance records (for calendar/table when "My Records" is selected)
  const fetchMyRecords = async () => {
    if (!canViewTeamAttendance || !user?.employee?.id) return;
    
    const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id;
    if (!organizationId) {
      console.warn('Organization ID not available, skipping fetchMyRecords');
      setMyRecords([]);
      return;
    }
    
    try {
      setLoadingMyRecords(true);
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);
      const response = await api.get('/attendance/records', {
        params: {
          page: 1,
          limit: 100,
          employeeId: user.employee.id,
          startDate: format(monthStart, 'yyyy-MM-dd'),
          endDate: format(monthEnd, 'yyyy-MM-dd'),
          organizationId,
        },
      });
      if (response.data?.data?.records) {
        setMyRecords(response.data.data.records);
      } else {
        setMyRecords([]);
      }
    } catch (err: any) {
      const status = err.response?.status;
      // 404 or "not found" errors are expected when there are no records
      if (status === 404 || err.response?.data?.message?.toLowerCase().includes('not found')) {
        console.log('No my records found for this month (expected)');
      } else {
        console.error('Error fetching my records:', err);
      }
      setMyRecords([]);
    } finally {
      setLoadingMyRecords(false);
    }
  };

  const checkTodayStatus = async () => {
    try {
      const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id;
      if (!organizationId || !user?.employee?.id) {
        return; // Skip if organization or employee ID not available
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];
      
      // Always fetch own records for status check
      const params: any = {
        page: 1,
        limit: 50,
        startDate: todayStr,
        endDate: todayStr,
        organizationId,
        employeeId: user.employee.id,
      };
      
      const response = await api.get('/attendance/records', { params });
      
      if (response.data?.data?.records) {
        const todayRecord = response.data.data.records.find(
          (r: AttendanceRecord) => {
            try {
              const d = r.checkIn ? new Date(r.checkIn) : new Date(r.date);
              const recordDate = format(new Date(d.getFullYear(), d.getMonth(), d.getDate()), 'yyyy-MM-dd');
              return recordDate === todayStr;
            } catch (e) {
              return false;
            }
          }
        );
        
        if (todayRecord?.checkIn && !todayRecord?.checkOut) {
          setCheckedIn(true);
        } else {
          setCheckedIn(false);
        }
      } else {
        setCheckedIn(false);
      }
    } catch (err) {
      // Ignore errors for status check - don't crash the component
      console.error('Error checking today status:', err);
      setCheckedIn(false);
    }
  };

  const handleCheckIn = async () => {
    try {
      setCheckingIn(true);
      setError(null);
      await api.post('/attendance/check-in', {
        notes: 'Checked in from web',
      });
      setCheckedIn(true);
      await Promise.all([fetchRecords(), fetchMyRecords(), checkTodayStatus()]);
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to check in';
      setError(errorMessage);
      
      // If error says "already checked in", update state to show check-out button
      if (errorMessage.toLowerCase().includes('already checked in')) {
        setCheckedIn(true);
        // Refresh status to get the actual record
        await checkTodayStatus();
      }
    } finally {
      setCheckingIn(false);
    }
  };

  const handleCheckOut = async () => {
    try {
      setCheckingOut(true);
      setError(null);
      const response = await api.post('/attendance/check-out', {
        notes: 'Checked out from web',
      });
      
      if (response.data.status === 'success') {
        setCheckedIn(false);
        // Refresh records and status so calendar reflects the punch
        await Promise.all([fetchRecords(), fetchMyRecords(), checkTodayStatus()]);
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to check out';
      setError(errorMessage);
      console.error('Check-out error:', err);
    } finally {
      setCheckingOut(false);
    }
  };

  const handleManualPunch = async () => {
    const employeeId = manualPunchEmployeeId || user?.employee?.id;
    if (!employeeId) {
      setManualPunchMessage({ type: 'error', text: 'Employee not found.' });
      return;
    }
    setManualPunchMessage(null);
    setManualPunchSubmitting(true);
    try {
      // Build punch timestamp in user's local time so 4:59 PM stays 4:59 PM (not interpreted as UTC)
      const timePart = manualPunchTime.length === 5 ? `${manualPunchTime}:00` : manualPunchTime;
      const punchAtLocal = new Date(`${manualPunchDate}T${timePart}`);
      const punchAtISO = punchAtLocal.toISOString();

      await api.post('/attendance/manual', {
        employeeId,
        date: manualPunchDate,
        time: manualPunchTime,
        punchAt: punchAtISO,
      });
      setManualPunchMessage({ type: 'success', text: 'Punch added (In/Out toggled for this date).' });
      await Promise.all([fetchRecords(), fetchMyRecords(), fetchPunches(), checkTodayStatus()]);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to add punch';
      setManualPunchMessage({ type: 'error', text: msg });
    } finally {
      setManualPunchSubmitting(false);
    }
  };

  // Show loading state while user is being loaded
  if (loadingUser || !user) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show error state if component error occurred
  if (componentError) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-800 mb-2">Error Loading Attendance Page</h2>
            <p className="text-red-700 mb-4">{componentError}</p>
            <button
              onClick={() => {
                setComponentError(null);
                window.location.reload();
              }}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
            >
              Reload Page
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleSyncBiometric = async () => {
    const orgId = user?.employee?.organizationId || user?.employee?.organization?.id;
    if (!orgId) {
      setError('Organization not found.');
      return;
    }
    try {
      setSyncing(true);
      setSyncResult(null);
      const result = await attendanceService.syncBiometric(orgId, syncFromDate, syncToDate);
      setSyncResult(result);
      await fetchRecords();
      if (viewMode === 'my') await fetchMyRecords();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Sync failed';
      setError(msg);
      setSyncResult(null);
    } finally {
      setSyncing(false);
    }
  };

  const openSyncModal = () => {
    setSyncFromDate(format(startOfMonth(currentMonth), 'yyyy-MM-dd'));
    setSyncToDate(format(endOfMonth(currentMonth), 'yyyy-MM-dd'));
    setSyncResult(null);
    setShowSyncModal(true);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader
        title="Attendance Management"
        subtitle={organizationName ? `Organization: ${organizationName}` : undefined}
        onLogout={handleLogout}
      />

      {/* Main Content */}
      <main className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Check-in/Check-out Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Today's Attendance</h2>
          <div className="flex flex-wrap items-center gap-4">
            {!checkedIn ? (
              <button
                onClick={handleCheckIn}
                disabled={checkingIn}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {checkingIn ? 'Checking In...' : 'Check In'}
              </button>
            ) : (
              <button
                onClick={handleCheckOut}
                disabled={checkingOut}
                className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {checkingOut ? 'Checking Out...' : 'Check Out'}
              </button>
            )}
            <div className="flex items-center text-gray-600">
              <span className="text-sm">
                Status: {checkedIn ? '✅ Checked In' : '⏰ Not Checked In'}
              </span>
            </div>
            <button
              onClick={() => navigate('/attendance/face')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Face Punch
            </button>
          </div>
        </div>

        {/* Manual punch (for testing): select any date, multiple In/Out per day */}
        {canManualPunch && (
          <div className="bg-white rounded-lg shadow p-6 mb-8 border border-amber-200">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Manual punch (for testing)</h2>
            <p className="text-sm text-gray-600 mb-4">
              Select a date (including previous dates) and time, then add a punch. Multiple In/Out in a single date are allowed — each click toggles In → Out → In for that date.
            </p>
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={manualPunchDate}
                  onChange={(e) => setManualPunchDate(e.target.value)}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                <input
                  type="time"
                  value={manualPunchTime}
                  onChange={(e) => setManualPunchTime(e.target.value)}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                />
              </div>
              {canManualPunch && manualPunchEmployeeList.length > 0 && (
                <div className="min-w-[200px]">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
                  <select
                    value={manualPunchEmployeeId || user?.employee?.id || ''}
                    onChange={(e) => setManualPunchEmployeeId(e.target.value === (user?.employee?.id || '') ? null : e.target.value || null)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                  >
                    <option value={user?.employee?.id || ''}>Myself</option>
                    {manualPunchEmployeeList.map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName} ({emp.employeeCode})</option>
                    ))}
                  </select>
                </div>
              )}
              <button
                onClick={handleManualPunch}
                disabled={manualPunchSubmitting}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-amber-500 text-white hover:bg-amber-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {manualPunchSubmitting ? 'Adding...' : 'Add punch (In/Out)'}
              </button>
            </div>
            {manualPunchMessage && (
              <p className={`mt-3 text-sm ${manualPunchMessage.type === 'success' ? 'text-green-700' : 'text-red-700'}`}>
                {manualPunchMessage.text}
              </p>
            )}
          </div>
        )}

        {/* Attendance Records */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">
                {canViewTeamAttendance 
                  ? (viewMode === 'team' 
                      ? (isHRForCalendar && selectedEmployeeId
                          ? (() => {
                              const emp = employeeList.find((e) => e.id === selectedEmployeeId);
                              return emp ? `Attendance: ${emp.firstName} ${emp.lastName}` : 'Attendance';
                            })()
                          : isManager ? 'Team Attendance' : 'All Employees Attendance')
                      : 'My Attendance Records')
                  : 'My Attendance Records'}
              </h2>
              <div className="flex items-center space-x-4">
                {canSyncBiometric && (
                  <button
                    onClick={openSyncModal}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-orange-500 text-white hover:bg-orange-600 transition"
                  >
                    Sync eSSL
                  </button>
                )}
                {/* View Toggle: Table or Calendar */}
                <div className="flex bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setDisplayMode('table')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                      displayMode === 'table'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    📋 Table
                  </button>
                  <button
                    onClick={() => setDisplayMode('calendar')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                      displayMode === 'calendar'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    📅 Calendar
                  </button>
                </div>
                {canViewTeamAttendance && (
                  <>
                    <div className="flex bg-gray-100 rounded-lg p-1">
                      <button
                        onClick={() => setViewMode('team')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                          viewMode === 'team'
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        {isManager ? '👥 Team' : '👥 All Employees'}
                      </button>
                      <button
                        onClick={() => setViewMode('my')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                          viewMode === 'my'
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        👤 My Records
                      </button>
                    </div>
                    {viewMode === 'team' && !isHRForCalendar && (
                      <span className="text-sm text-gray-600 bg-blue-50 px-3 py-1 rounded-full">
                        📊 Viewing your team members
                      </span>
                    )}
                {viewMode === 'team' && isHRForCalendar && (
                      <span className="text-sm text-gray-600 bg-amber-50 px-3 py-1 rounded-full">
                        Select one employee below to view attendance
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* HR-only: searchable employee dropdown (calendar shows only after selection) */}
          {isHRForCalendar && viewMode === 'team' && (
            <div className="px-6 pb-4 border-b border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">Employee</label>
              <div className="relative max-w-md" ref={employeeDropdownRef}>
                <input
                  type="text"
                  placeholder="Search by name or code..."
                  value={selectedEmployeeId
                    ? (() => {
                        const emp = employeeList.find((e) => e.id === selectedEmployeeId);
                        return emp ? `${emp.firstName} ${emp.lastName} (${emp.employeeCode})` : '';
                      })()
                    : employeeSearch}
                  readOnly={!!selectedEmployeeId}
                  onChange={(e) => {
                    if (selectedEmployeeId) return;
                    setEmployeeSearch(e.target.value);
                    setEmployeeDropdownOpen(true);
                  }}
                  onFocus={() => !selectedEmployeeId && setEmployeeDropdownOpen(true)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 pr-10 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (selectedEmployeeId) {
                      setSelectedEmployeeId(null);
                      setEmployeeSearch('');
                      setEmployeeDropdownOpen(true);
                    } else {
                      setEmployeeDropdownOpen(!employeeDropdownOpen);
                    }
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                  title={selectedEmployeeId ? 'Clear selection' : 'Open list'}
                >
                  {selectedEmployeeId ? '✕' : '▼'}
                </button>
                {employeeDropdownOpen && (
                  <ul className="absolute z-10 mt-1 w-full max-h-60 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg py-1">
                    {loadingEmployees ? (
                      <li className="px-3 py-2 text-sm text-gray-500">Loading...</li>
                    ) : (
                      (() => {
                        const q = employeeSearch.trim().toLowerCase();
                        const filtered = q
                          ? employeeList.filter(
                              (e) =>
                                e.firstName?.toLowerCase().includes(q) ||
                                e.lastName?.toLowerCase().includes(q) ||
                                e.employeeCode?.toLowerCase().includes(q)
                            )
                          : employeeList;
                        return filtered.length === 0 ? (
                          <li className="px-3 py-2 text-sm text-gray-500">No employees found</li>
                        ) : (
                          filtered.map((emp) => (
                            <li
                              key={emp.id}
                              onClick={() => {
                                setSelectedEmployeeId(emp.id);
                                setEmployeeSearch('');
                                setEmployeeDropdownOpen(false);
                              }}
                              className="px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 text-gray-900"
                            >
                              {emp.firstName} {emp.lastName} <span className="text-gray-500">({emp.employeeCode})</span>
                            </li>
                          ))
                        );
                      })()
                    )}
                  </ul>
                )}
              </div>
              {!selectedEmployeeId && (
                <p className="mt-2 text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
                  Select an employee from the dropdown above to view their attendance calendar.
                </p>
              )}
            </div>
          )}

          {isHRForCalendar && viewMode === 'team' && !selectedEmployeeId ? (
            <div className="p-12 text-center text-gray-600">
              <p className="text-lg font-medium">Select an employee above to view their attendance calendar.</p>
              <p className="text-sm mt-2">Use the searchable dropdown to find an employee by name or code.</p>
            </div>
          ) : loading || (viewMode === 'my' && loadingMyRecords) ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : displayMode === 'calendar' ? (
            <AttendanceCalendarView
              records={viewMode === 'my' && myRecords.length > 0 ? myRecords : records}
              punches={punches}
              currentMonth={currentMonth}
              onMonthChange={setCurrentMonth}
              employeeId={viewMode === 'my' || !canViewTeamAttendance ? user?.employee?.id : (selectedEmployeeId || user?.employee?.id)}
              organizationId={user?.employee?.organizationId || user?.employee?.organization?.id}
            />
          ) : (viewMode === 'my' ? myRecords : records).length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {viewMode === 'my' 
                ? 'No attendance records found for you' 
                : 'No attendance records found'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Employee
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Check In
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Check Out
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Work Hours
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Overtime
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(viewMode === 'my' ? myRecords : records).map((record) => (
                    <tr key={record.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(record.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.employee.firstName} {record.employee.lastName}
                        <br />
                        <span className="text-gray-500 text-xs">{record.employee.employeeCode}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.checkIn
                          ? new Date(record.checkIn).toLocaleTimeString()
                          : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.checkOut
                          ? new Date(record.checkOut).toLocaleTimeString()
                          : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            record.status === 'PRESENT'
                              ? 'bg-green-100 text-green-800'
                              : record.status === 'ABSENT'
                              ? 'bg-red-100 text-red-800'
                              : record.status === 'LEAVE'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {record.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.workHours ? `${Number(record.workHours).toFixed(2)} hrs` : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.overtimeHours ? `${Number(record.overtimeHours).toFixed(2)} hrs` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Sync eSSL Biometric Modal */}
        {showSyncModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowSyncModal(false)}>
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Sync eSSL Biometric</h3>
              <p className="text-sm text-gray-600 mb-4">
                Pull attendance from eSSL Cloud for the selected date range. Employee codes in eSSL must match HRMS employee codes.
              </p>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">From date</label>
                  <input
                    type="date"
                    value={syncFromDate}
                    onChange={(e) => setSyncFromDate(e.target.value)}
                    className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-black"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">To date</label>
                  <input
                    type="date"
                    value={syncToDate}
                    onChange={(e) => setSyncToDate(e.target.value)}
                    className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-black"
                  />
                </div>
              </div>
              {syncResult && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm">
                  <p className="font-medium text-gray-900">Synced: {syncResult.synced} (created: {syncResult.created}, updated: {syncResult.updated})</p>
                  {syncResult.skipped > 0 && <p className="text-gray-600">Skipped: {syncResult.skipped}</p>}
                  {syncResult.errors.length > 0 && (
                    <ul className="mt-2 text-amber-700 text-xs list-disc list-inside">
                      {syncResult.errors.slice(0, 5).map((e, i) => (
                        <li key={i}>{e.employeeCode} ({e.date}): {e.message}</li>
                      ))}
                      {syncResult.errors.length > 5 && <li>… and {syncResult.errors.length - 5} more</li>}
                    </ul>
                  )}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSyncModal(false)}
                  className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleSyncBiometric}
                  disabled={syncing}
                  className="px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 disabled:opacity-50"
                >
                  {syncing ? 'Syncing...' : 'Sync'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AttendancePage;
