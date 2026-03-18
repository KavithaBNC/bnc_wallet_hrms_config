import { useEffect, useState, useRef, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';
import employeeService, { Employee } from '../services/employee.service';
import shiftService, { Shift } from '../services/shift.service';
import departmentService, { Department } from '../services/department.service';
import { attendanceService } from '../services/attendance.service';
import { format, eachDayOfInterval, parseISO, startOfMonth, endOfMonth } from 'date-fns';

function fullName(e: Employee): string {
  const parts = [e.firstName, e.middleName, e.lastName].filter(Boolean);
  return parts.join(' ').trim() || e.employeeCode || '';
}

interface ShiftAssignment {
  employeeId: string;
  date: string;
  shiftName: string;
  isWeekOff: boolean;
}

export default function AssociateShiftGridPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;
  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id;

  // Support both single associateId (legacy) and multiple associateIds (comma-separated)
  const associateIdParam = searchParams.get('associateId');
  const associateIdsParam = searchParams.get('associateIds');
  const monthParam = searchParams.get('month'); // Optional: YYYY-MM format
  
  // Parse multiple associate IDs from comma-separated string
  const selectedAssociateIds = associateIdsParam 
    ? associateIdsParam.split(',').filter(id => id.trim() !== '')
    : associateIdParam 
      ? [associateIdParam] 
      : [];

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [shiftAssignments, setShiftAssignments] = useState<Map<string, ShiftAssignment>>(new Map());
  const [initialAssignments, setInitialAssignments] = useState<Map<string, ShiftAssignment>>(new Map()); // Track initial state
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [saving, setSaving] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (monthParam) {
      return parseISO(`${monthParam}-01`);
    }
    return new Date();
  });
  const [fillFromDate, setFillFromDate] = useState('');
  const [fillShiftName, setFillShiftName] = useState('');

  // Generate date range for current month
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const dateRange = eachDayOfInterval({
    start: monthStart,
    end: monthEnd,
  });

  // Fetch shifts from Shift Master separately - this only updates dropdown options
  useEffect(() => {
    if (!organizationId) {
      console.warn('Cannot fetch shifts: organizationId is missing');
      return;
    }
    
    console.log('Fetching shifts from Shift Master for organizationId:', organizationId);
    
    shiftService
      .getAll({
        organizationId,
        limit: 1000,
        // Don't filter by isActive - fetch all shifts, then filter active ones on frontend
      })
      .then((res) => {
        // shiftService.getAll returns ShiftListResponse: { shifts: Shift[], pagination: {...} }
        const allShifts = res?.shifts || [];
        
        // Filter for active shifts only on the frontend
        const shiftList = allShifts.filter(shift => shift.isActive === true);
        
        console.log('✅ Fetched shifts from Shift Master');
        console.log('   - Full response:', res);
        console.log('   - Total shifts (all):', allShifts.length);
        console.log('   - Active shifts:', shiftList.length);
        console.log('   - Shift names:', shiftList.map(s => s.name));
        console.log('   - Shift details:', shiftList);
        
        if (shiftList.length === 0) {
          console.error('❌ No active shifts found in Shift Master!');
          console.error('   - Total shifts in database:', allShifts.length);
          console.error('   - Please ensure shifts are marked as Active in Shift Master page.');
          console.error('   - Response received:', res);
        } else {
          console.log('✅ Successfully loaded', shiftList.length, 'active shifts from Shift Master');
        }
        
        setShifts(shiftList);
      })
      .catch((error) => {
        console.error('Error fetching shifts from Shift Master:', error);
        console.error('Error details:', error.response || error.message);
        setShifts([]);
      });
  }, [organizationId]);

  // Fetch departments for filter (e.g. Software department)
  useEffect(() => {
    if (!organizationId) return;
    departmentService.getAll({ organizationId, limit: 500 })
      .then((res) => setDepartments(res?.departments || []))
      .catch(() => setDepartments([]));
  }, [organizationId]);

  // Fetch employees and pre-fill grid from attendance records API (same as calendar: overrides + rules)
  useEffect(() => {
    if (!organizationId) {
      console.warn('Organization ID is missing');
      setLoading(false);
      return;
    }

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const monthStartStr = format(monthStart, 'yyyy-MM-dd');
    const monthEndStr = format(monthEnd, 'yyyy-MM-dd');
    let currentDateRange: Date[] = [];
    try {
      currentDateRange = eachDayOfInterval({ start: monthStart, end: monthEnd });
    } catch {
      const today = new Date();
      currentDateRange = eachDayOfInterval({ start: startOfMonth(today), end: endOfMonth(today) });
    }

    setLoading(true);

    employeeService
      .getAll({
        organizationId,
        ...(selectedDepartmentId ? { departmentId: selectedDepartmentId } : {}),
        page: 1,
        limit: 1000,
        employeeStatus: 'ACTIVE',
      })
      .then(async (res) => {
        let filtered = res.employees || [];
        if (selectedAssociateIds.length > 0) {
          filtered = filtered.filter((emp) => selectedAssociateIds.includes(emp.id));
        }

        setEmployees(filtered);

        const defaultShift = shifts?.length ? shifts[0].name : 'General Shift';
        const newAssignments = new Map<string, ShiftAssignment>();

        // Pre-fill from attendance records API (merged: DB overrides + rule-based, same as calendar)
        if (filtered.length > 0) {
          const recordPromises = filtered.map((emp) =>
            attendanceService.getRecords({
              employeeId: emp.id,
              startDate: monthStartStr,
              endDate: monthEndStr,
              organizationId,
            })
          );
          const recordArrays = await Promise.all(recordPromises);

          recordArrays.forEach((records, idx) => {
            const emp = filtered[idx];
            records.forEach((r) => {
              const dateStr = typeof r.date === 'string' ? r.date.slice(0, 10) : format(new Date(r.date), 'yyyy-MM-dd');
              const key = `${emp.id}-${dateStr}`;
              const shiftName = r.shift?.name ?? defaultShift;
              newAssignments.set(key, {
                employeeId: emp.id,
                date: dateStr,
                shiftName: shiftName === 'Week Off' || shiftName === 'Weekoff' ? 'W' : shiftName,
                isWeekOff: shiftName === 'W' || shiftName === 'Week Off' || shiftName === 'Weekoff',
              });
            });
          });
        }

        // Fill any missing days with default (weekdays = first shift, weekends = W)
        filtered.forEach((emp) => {
          currentDateRange.forEach((date) => {
            const dateStr = format(date, 'yyyy-MM-dd');
            const key = `${emp.id}-${dateStr}`;
            if (!newAssignments.has(key)) {
              const dayOfWeek = date.getDay();
              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
              newAssignments.set(key, {
                employeeId: emp.id,
                date: dateStr,
                shiftName: isWeekend ? 'W' : defaultShift,
                isWeekOff: isWeekend,
              });
            }
          });
        });

        setShiftAssignments(new Map(newAssignments));
        setInitialAssignments(new Map(newAssignments));
        setPage(1);
      })
      .catch((error) => {
        console.error('Error fetching employees:', error);
        setEmployees([]);
      })
      .finally(() => setLoading(false));
  }, [organizationId, currentMonth, selectedAssociateIds.join(','), shifts.length, selectedDepartmentId]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleClose = () => {
    navigate('/time-attendance/associate-shift-change');
  };

  const handleSave = async () => {
    if (!organizationId) {
      alert('Organization ID is missing');
      return;
    }

    // Only save assignments that have been changed from initial state
    const changedAssignments: Array<{ employeeId: string; date: string; shiftName: string }> = [];
    
    shiftAssignments.forEach((assignment, key) => {
      const initialAssignment = initialAssignments.get(key);
      
      // Include if:
      // 1. Assignment doesn't exist in initial state (new)
      // 2. Shift name has changed from initial state
      if (!initialAssignment || initialAssignment.shiftName !== assignment.shiftName) {
        changedAssignments.push({
          employeeId: assignment.employeeId,
          date: assignment.date,
          shiftName: assignment.shiftName,
        });
      }
    });

    if (changedAssignments.length === 0) {
      alert('No changes to save.');
      return;
    }

    setSaving(true);
    try {
      console.log('Saving changed shift assignments:', changedAssignments);
      console.log(`Total assignments: ${shiftAssignments.size}, Changed: ${changedAssignments.length}`);

      const result = await attendanceService.bulkUpdateShiftAssignments(
        organizationId,
        changedAssignments
      );

      console.log('Shift assignments saved:', result);

      // Show detailed error messages
      const errorResults = result.results.filter(r => r.status === 'error');
      const successCount = result.summary.successful;
      const errorCount = result.summary.errors;
      const skippedCount = result.summary.skipped;

      if (errorCount > 0) {
        const errorMessages = errorResults.map(r => 
          `${r.date}: ${r.message || 'Unknown error'}`
        ).join('\n');
        alert(`Shift assignments saved with ${errorCount} error(s):\n\n${errorMessages}\n\nPlease check the console for details.`);
      } else {
        const message = `Shift assignments saved successfully!\n${successCount} assignment(s) updated.${skippedCount > 0 ? `\n${skippedCount} week off(s) skipped.` : ''}`;
        alert(message);
        
        // Update initial assignments to reflect saved state
        setInitialAssignments(new Map(shiftAssignments));
        // Navigate to Attendance calendar so assignments show in calendar view for each employee
        navigate('/attendance', { state: { refreshFromShiftGrid: true } });
      }
    } catch (error: any) {
      console.error('Error saving shift assignments:', error);
      const errorMessage = error?.response?.data?.message || 'Failed to save shift assignments';
      alert(`Failed to save shift assignments: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const updateShiftAssignment = (employeeId: string, date: string, shiftName: string) => {
    const key = `${employeeId}-${date}`;
    setShiftAssignments((prev) => {
      const newMap = new Map(prev);
      newMap.set(key, {
        employeeId,
        date,
        shiftName,
        isWeekOff: shiftName === 'W',
      });
      return newMap;
    });
  };

  /** Set one shift for all visible employees from a date to end of month (e.g. "General Shift from 20th onwards"). Batched in one state update so Save detects changes. */
  const handleFillFromDate = () => {
    if (!fillFromDate || !fillShiftName) {
      alert('Please select a start date and a shift.');
      return;
    }
    const fromStr = fillFromDate.slice(0, 10);
    setShiftAssignments((prev) => {
      const newMap = new Map(prev);
      employees.forEach((emp) => {
        dateRange.forEach((date) => {
          const dateStr = format(date, 'yyyy-MM-dd');
          if (dateStr >= fromStr) {
            const key = `${emp.id}-${dateStr}`;
            newMap.set(key, {
              employeeId: emp.id,
              date: dateStr,
              shiftName: fillShiftName,
              isWeekOff: fillShiftName === 'W',
            });
          }
        });
      });
      return newMap;
    });
    setFillFromDate('');
    setFillShiftName('');
  };

  const filteredEmployees = employees.filter((emp) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    const name = fullName(emp).toLowerCase();
    const code = emp.employeeCode.toLowerCase();
    return name.includes(searchLower) || code.includes(searchLower);
  });

  const paginatedEmployees = filteredEmployees.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.ceil(filteredEmployees.length / pageSize);

  // Excel-like fill handle: drag to copy shift value to multiple cells (rectangular range)
  const fillDragRef = useRef<{
    sourceShiftName: string;
    lastRow: number;
    lastCol: number;
  } | null>(null);

  const handleFillMouseDown = useCallback((
    e: React.MouseEvent,
    _empId: string,
    _dateStr: string,
    shiftName: string,
    rowIndex: number,
    colIndex: number
  ) => {
    e.preventDefault();
    e.stopPropagation();
    fillDragRef.current = {
      sourceShiftName: shiftName,
      lastRow: rowIndex,
      lastCol: colIndex,
    };

    const fillRectangle = (r0: number, c0: number, r1: number, c1: number) => {
      const rMin = Math.min(r0, r1);
      const rMax = Math.max(r0, r1);
      const cMin = Math.min(c0, c1);
      const cMax = Math.max(c0, c1);
      setShiftAssignments((prev) => {
        const newMap = new Map(prev);
        for (let r = rMin; r <= rMax; r++) {
          for (let c = cMin; c <= cMax; c++) {
            const emp = paginatedEmployees[r];
            const date = dateRange[c];
            if (emp && date) {
              const key = `${emp.id}-${format(date, 'yyyy-MM-dd')}`;
              newMap.set(key, {
                employeeId: emp.id,
                date: format(date, 'yyyy-MM-dd'),
                shiftName: fillDragRef.current!.sourceShiftName,
                isWeekOff: fillDragRef.current!.sourceShiftName === 'W',
              });
            }
          }
        }
        return newMap;
      });
    };

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!fillDragRef.current) return;
      const el = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
      const cell = el?.closest('td[data-fill-cell]');
      if (cell) {
        const targetRow = cell.getAttribute('data-row');
        const targetCol = cell.getAttribute('data-col');
        if (targetRow !== null && targetCol !== null) {
          const r = parseInt(targetRow, 10);
          const c = parseInt(targetCol, 10);
          if (r !== fillDragRef.current.lastRow || c !== fillDragRef.current.lastCol) {
            fillRectangle(rowIndex, colIndex, r, c);
            fillDragRef.current.lastRow = r;
            fillDragRef.current.lastCol = c;
          }
        }
      }
    };

    const onMouseUp = () => {
      fillDragRef.current = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'crosshair';
    document.body.style.userSelect = 'none';
  }, [dateRange, paginatedEmployees]);

  const getShiftAssignment = (employeeId: string, date: Date): ShiftAssignment | null => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const key = `${employeeId}-${dateStr}`;
    return shiftAssignments.get(key) || null;
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader
        title="Time attendance"
        subtitle={organizationName ? organizationName : undefined}
        onLogout={handleLogout}
      />

      <main className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-6 bg-gray-50">
        <div className="w-full max-w-[1600px] mx-auto">
          {/* Breadcrumbs - Employee module style */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
            <nav className="flex items-center gap-1.5 text-sm text-gray-500" aria-label="Breadcrumb">
              <span className="font-semibold text-gray-900">Time attendance</span>
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <Link to="/time-attendance/associate-shift-change" className="text-gray-500 hover:text-gray-900">Associate Shift Change</Link>
              <span className="mx-1 text-gray-400">/</span>
              <span className="text-gray-500">Associate Shift</span>
            </nav>
          </div>

          <div className="bg-white rounded-lg shadow mb-6">
            {/* Header Section - Employee module style */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Associate Shift</h2>
                  <p className="text-gray-600 mt-1">Manage shift assignments for associates</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const prevMonth = new Date(currentMonth);
                      prevMonth.setMonth(prevMonth.getMonth() - 1);
                      setCurrentMonth(prevMonth);
                    }}
                    className="h-9 px-3 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition flex items-center gap-1"
                    aria-label="Previous month"
                  >
                    ← Previous Month
                  </button>
                  <div className="h-9 px-4 bg-gray-50 border border-gray-300 rounded-lg text-sm font-medium text-gray-900 flex items-center">
                    {format(currentMonth, 'MMMM yyyy')}
                  </div>
                  <button
                    onClick={() => {
                      const nextMonth = new Date(currentMonth);
                      nextMonth.setMonth(nextMonth.getMonth() + 1);
                      setCurrentMonth(nextMonth);
                    }}
                    className="h-9 px-3 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition flex items-center gap-1"
                    aria-label="Next month"
                  >
                    Next Month →
                  </button>
                </div>
              </div>
            </div>

            {/* Controls Section - Employee module style */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-500">W - Week Off</span>
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">W</span>
                  </div>
                  <div className="flex flex-col">
                    <label className="text-sm font-medium text-gray-500 mb-1.5">Department</label>
                    <select
                      value={selectedDepartmentId}
                      onChange={(e) => {
                        setSelectedDepartmentId(e.target.value);
                        setPage(1);
                      }}
                      className="h-10 min-w-[180px] px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">All departments</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col">
                    <label className="text-sm font-medium text-gray-500 mb-1.5">Search</label>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setPage(1);
                      }}
                      placeholder="Search by name or code..."
                      className="h-10 w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-gray-600">Fill from date:</span>
                  <input
                    type="date"
                    value={fillFromDate}
                    onChange={(e) => setFillFromDate(e.target.value)}
                    className="h-9 px-3 border border-gray-300 rounded-lg text-sm"
                  />
                  <select
                    value={fillShiftName}
                    onChange={(e) => setFillShiftName(e.target.value)}
                    className="h-9 px-3 border border-gray-300 rounded-lg text-sm min-w-[160px]"
                  >
                    <option value="">Select shift</option>
                    {shifts.map((s) => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                    <option value="W">W (Week Off)</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleFillFromDate}
                    className="h-9 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
                  >
                    Apply from date to EOM
                  </button>
                  <button
                    onClick={handlePrint}
                    className="h-9 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                  >
                    Print
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="h-9 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </div>

            {/* Table Section */}
            <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 400px)' }}>
              {loading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                  <p className="mt-4 text-gray-600 ml-4">Loading shifts...</p>
                </div>
              ) : (
                <div className="relative">
                  <table className="min-w-full divide-y divide-gray-200 border-collapse">
                    <thead className="bg-gray-50 sticky top-0 z-20">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-300 sticky left-0 bg-gray-50 z-30 shadow-sm">
                          Associate Code
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-300 sticky left-[140px] bg-gray-50 z-30 shadow-sm">
                          Associate Name
                        </th>
                        {dateRange.map((date) => (
                          <th
                            key={format(date, 'yyyy-MM-dd')}
                            className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-300 min-w-[140px] bg-gray-50"
                          >
                            <div className="font-semibold">{format(date, 'dd/MM/yyyy')}</div>
                            <div className="text-gray-600 font-normal mt-1">({format(date, 'EEE')})</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedEmployees.length === 0 ? (
                      <tr>
                        <td colSpan={dateRange.length + 2} className="px-4 py-8 text-center text-gray-500">
                          No associates found.
                        </td>
                      </tr>
                    ) : (
                      paginatedEmployees.map((emp, rowIndex) => (
                        <tr key={emp.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 border-r border-gray-300 sticky left-0 bg-white z-20 shadow-sm">
                            {emp.employeeCode}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 border-r border-gray-300 sticky left-[140px] bg-white z-20 shadow-sm">
                            {fullName(emp)}
                          </td>
                          {dateRange.map((date, colIndex) => {
                            const assignment = getShiftAssignment(emp.id, date);
                            // Use first shift from Shift Master as default, or 'W' if no shifts available
                            const defaultShift = shifts && shifts.length > 0 ? shifts[0].name : 'W';
                            const shiftName = assignment?.shiftName || defaultShift;
                            const isWeekOff = assignment?.isWeekOff || false;
                            const dateStr = format(date, 'yyyy-MM-dd');

                            return (
                              <td
                                key={dateStr}
                                data-fill-cell
                                data-emp-id={emp.id}
                                data-date={dateStr}
                                data-row={rowIndex}
                                data-col={colIndex}
                                className="px-2 py-2 text-center border-r border-gray-300 bg-white relative"
                              >
                                <select
                                  value={isWeekOff ? 'W' : shiftName}
                                  onChange={(e) => {
                                    const newValue = e.target.value;
                                    if (newValue === 'W') {
                                      updateShiftAssignment(emp.id, dateStr, 'W');
                                    } else {
                                      updateShiftAssignment(emp.id, dateStr, newValue);
                                    }
                                  }}
                                  className={`w-full px-2 py-1.5 pr-6 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                                    isWeekOff ? 'bg-blue-100 text-blue-800 font-medium' : 'bg-white text-gray-900'
                                  }`}
                                >
                                  {/* Week Off option - always first */}
                                  <option value="W">W</option>
                                  {/* Shift Master options - dynamically loaded from Shift Master */}
                                  {shifts.map((shift) => (
                                    <option key={shift.id} value={shift.name}>
                                      {shift.name}
                                    </option>
                                  ))}
                                </select>
                                {/* Excel-like fill handle - drag to copy value to adjacent cells */}
                                <div
                                  role="button"
                                  tabIndex={0}
                                  title="Drag to fill cells with this value (like Excel)"
                                  aria-label="Drag to fill cells with this value"
                                  onMouseDown={(e) => handleFillMouseDown(e, emp.id, dateStr, isWeekOff ? 'W' : shiftName, rowIndex, colIndex)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') e.preventDefault();
                                  }}
                                  className="absolute bottom-1 right-1 w-2.5 h-2.5 bg-blue-600 rounded-sm cursor-crosshair opacity-70 hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

            {/* Footer Section - Employee module style */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <button
                    onClick={handleClose}
                    className="h-9 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Close
                  </button>
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-900">Show</label>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setPage(1);
                      }}
                      className="h-9 px-2 py-1 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 font-medium min-w-[4rem] focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      aria-label="Entries per page"
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                    <label className="text-sm font-medium text-gray-900">entries</label>
                  </div>
                  <div className="text-sm font-medium text-gray-900">
                    Showing {paginatedEmployees.length > 0 ? (page - 1) * pageSize + 1 : 0} to{' '}
                    {Math.min(page * pageSize, filteredEmployees.length)} of {filteredEmployees.length} entries
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="h-9 px-3 py-1 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition"
                    aria-label="Previous page"
                  >
                    Previous
                  </button>
                  <span className="h-9 px-3 py-1 bg-blue-600 text-white rounded-lg text-sm font-medium flex items-center">{page}</span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="h-9 px-3 py-1 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition"
                    aria-label="Next page"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
