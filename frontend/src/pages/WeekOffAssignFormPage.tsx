import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';
import shiftAssignmentRuleService from '../services/shiftAssignmentRule.service';
import employeeService, { Employee } from '../services/employee.service';
import paygroupService from '../services/paygroup.service';
import departmentService from '../services/department.service';
import shiftService from '../services/shift.service';

function fullName(e: Employee): string {
  const parts = [e.firstName, e.middleName, e.lastName].filter(Boolean);
  return parts.join(' ').trim() || e.employeeCode || '';
}

interface Option {
  id: string;
  name: string;
}

// Alternate Saturday Off options
const ALTERNATE_SATURDAY_OPTIONS: Option[] = [
  { id: '__ALL__', name: 'All' },
  { id: '1ST_3RD', name: '1ST AND 3RD SATURDAY OFF' },
  { id: '2ND_4TH', name: '2ND AND 4TH SATURDAY OFF' },
];

// Week days
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

// Week off details structure: weekIndex (0-5) -> day -> boolean
type WeekOffDetails = boolean[][];

export default function WeekOffAssignFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const { user, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;
  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id;

  const [_loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [selectedEmployees, setSelectedEmployees] = useState<Employee[]>([]);
  const [associateSearch, setAssociateSearch] = useState('');
  const [showAssociateDropdown, setShowAssociateDropdown] = useState(false);
  const [selectedPaygroups, setSelectedPaygroups] = useState<Option[]>([]);
  const [showPaygroupDropdown, setShowPaygroupDropdown] = useState(false);
  const [selectedDepartments, setSelectedDepartments] = useState<Option[]>([]);
  const [showDepartmentDropdown, setShowDepartmentDropdown] = useState(false);
  const [selectedAlternateSaturday, setSelectedAlternateSaturday] = useState<Option[]>([]);
  const [showAlternateSaturdayDropdown, setShowAlternateSaturdayDropdown] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [priority, setPriority] = useState('');
  const [remarks, setRemarks] = useState('');
  const [weekOffDetails, setWeekOffDetails] = useState<WeekOffDetails>(() => {
    // Initialize: 6 weeks x 7 days, all false except Sunday (all weeks)
    const details: WeekOffDetails = [];
    for (let week = 0; week < 6; week++) {
      const weekDays: boolean[] = [];
      for (let day = 0; day < 7; day++) {
        weekDays.push(day === 0); // Sunday = true, others = false
      }
      details.push(weekDays);
    }
    return details;
  });

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [paygroups, setPaygroups] = useState<Option[]>([]);
  const [departments, setDepartments] = useState<Option[]>([]);
  const [defaultShiftId, setDefaultShiftId] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId) return;
    Promise.all([
      employeeService.getAll({ organizationId, page: 1, limit: 500, employeeStatus: 'ACTIVE' }),
      paygroupService.getAll({ organizationId }),
      departmentService.getAll({ organizationId, limit: 500 }),
      shiftService.getAll({ organizationId, limit: 1 }),
    ]).then(([empRes, pgList, deptRes, shiftRes]) => {
      setEmployees(empRes.employees || []);
      setPaygroups((pgList || []).map((p) => ({ id: p.id, name: p.name })));
      setDepartments((deptRes?.departments || []).map((d) => ({ id: d.id, name: d.name })));
      // Get first shift as default (required for ShiftAssignmentRule model)
      if (shiftRes?.shifts && shiftRes.shifts.length > 0) {
        setDefaultShiftId(shiftRes.shifts[0].id);
      }
    }).catch(() => {});
  }, [organizationId]);

  // Auto-update Saturday based on Alternate Saturday Off selection
  useEffect(() => {
    if (selectedAlternateSaturday.length === 0) return;
    
    const alternateSaturdayId = selectedAlternateSaturday[0]?.id;
    if (!alternateSaturdayId || alternateSaturdayId === '__ALL__') {
      // If "All" or nothing selected, reset all Saturdays to false
      setWeekOffDetails((prev) => {
        const updated = prev.map((week) => [...week]);
        for (let week = 0; week < 6; week++) {
          updated[week][6] = false; // Saturday = index 6
        }
        return updated;
      });
      return;
    }

    // Update Saturdays based on selection; clear Sunday for all weeks so only selected Saturdays are week off
    setWeekOffDetails((prev) => {
      const updated = prev.map((week) => [...week]);
      // Clear Sunday (day 0) for all weeks so "1st/3rd Saturday" doesn't show every Sunday as Week Off
      for (let week = 0; week < 6; week++) {
        updated[week][0] = false;
      }
      if (alternateSaturdayId === '1ST_3RD') {
        // Week 1 (index 0) and Week 3 (index 2) = YES — only 1st and 3rd Saturday off
        updated[0][6] = true; // Week 1 Saturday
        updated[2][6] = true; // Week 3 Saturday
        updated[1][6] = false; // Week 2 Saturday
        updated[3][6] = false; // Week 4 Saturday
        updated[4][6] = false; // Week 5 Saturday
        updated[5][6] = false; // Week 6 Saturday
      } else if (alternateSaturdayId === '2ND_4TH') {
        // Week 2 (index 1) and Week 4 (index 3) = YES — only 2nd and 4th Saturday off
        updated[0][6] = false; // Week 1 Saturday
        updated[1][6] = true;  // Week 2 Saturday
        updated[2][6] = false; // Week 3 Saturday
        updated[3][6] = true;  // Week 4 Saturday
        updated[4][6] = false; // Week 5 Saturday
        updated[5][6] = false; // Week 6 Saturday
      }
      return updated;
    });
  }, [selectedAlternateSaturday]);

  useEffect(() => {
    if (!id || !organizationId) return;
    setLoading(true);
    setError(null);
    shiftAssignmentRuleService
      .getById(id)
      .then((rule) => {
        setDisplayName(rule.displayName);
        setEffectiveDate(rule.effectiveDate?.slice(0, 10) || new Date().toISOString().slice(0, 10));
        setPriority(rule.priority != null ? String(rule.priority) : '');
        // Extract week off data from remarks
        const rawRemarks = rule.remarks || '';
        const weekOffMarker = '__WEEK_OFF_DATA__';
        const markerIdx = rawRemarks.indexOf(weekOffMarker);
        
        if (markerIdx >= 0) {
          const jsonStr = rawRemarks.slice(markerIdx + weekOffMarker.length);
          try {
            const parsed = JSON.parse(jsonStr) as { alternateSaturdayOff?: string; weekOffDetails?: WeekOffDetails };
            if (parsed.weekOffDetails) {
              setWeekOffDetails(parsed.weekOffDetails);
            }
            // Set alternate Saturday off from parsed data
            if (parsed.alternateSaturdayOff) {
              const altSat = ALTERNATE_SATURDAY_OPTIONS.find(
                (opt) => opt.name === parsed.alternateSaturdayOff
              );
              if (altSat) {
                setSelectedAlternateSaturday([altSat]);
              }
            }
          } catch {
            // ignore parse error
          }
          setRemarks(rawRemarks.slice(0, markerIdx).trim());
        } else {
          setRemarks(rawRemarks);
          // Extract Alternate Saturday Off from display name as fallback
          const displayNameLower = rule.displayName.toLowerCase();
          if (displayNameLower.includes('2nd') && displayNameLower.includes('4th')) {
            setSelectedAlternateSaturday([{ id: '2ND_4TH', name: '2ND AND 4TH SATURDAY OFF' }]);
          } else if (displayNameLower.includes('1st') && displayNameLower.includes('3rd')) {
            setSelectedAlternateSaturday([{ id: '1ST_3RD', name: '1ST AND 3RD SATURDAY OFF' }]);
          } else {
            setSelectedAlternateSaturday([{ id: '__ALL__', name: 'All' }]);
          }
        }
        
        if (rule.paygroup) {
          setSelectedPaygroups([{ id: rule.paygroup.id, name: rule.paygroup.name }]);
        } else {
          setSelectedPaygroups([]); // Optional: no paygroup selected
        }
        
        if (rule.department) {
          setSelectedDepartments([{ id: rule.department.id, name: rule.department.name }]);
        } else {
          setSelectedDepartments([]); // Optional: no department selected
        }
        
        if (rule.shift) {
          setDefaultShiftId(rule.shift.id);
        }
        
        const ids = Array.isArray(rule.employeeIds) ? rule.employeeIds : [];
        if (ids.length > 0) {
          employeeService.getAll({ organizationId, page: 1, limit: 500, employeeStatus: 'ACTIVE' }).then((r) => {
            const list = r.employees || [];
            setEmployees((prev) => (prev.length ? prev : list));
            setSelectedEmployees(list.filter((e) => ids.includes(e.id)));
          });
        } else {
          setSelectedEmployees([]);
        }
      })
      .catch((err: unknown) => {
        setError(err && typeof err === 'object' && 'response' in err ? (err as { response?: { data?: { message?: string } } }).response?.data?.message as string : 'Failed to load rule');
      })
      .finally(() => setLoading(false));
  }, [id, organizationId]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleCancel = () => navigate('/attendance-policy/week-of-assign');

  const addEmployee = (emp: Employee) => {
    if (selectedEmployees.some((e) => e.id === emp.id)) return;
    setSelectedEmployees((prev) => [...prev, emp]);
    setAssociateSearch('');
    setShowAssociateDropdown(false);
  };

  const removeEmployee = (empId: string) => {
    setSelectedEmployees((prev) => prev.filter((e) => e.id !== empId));
  };

  const togglePaygroup = (opt: Option) => {
    setSelectedPaygroups((prev) => {
      const exists = prev.some((p) => p.id === opt.id);
      if (exists) return prev.filter((p) => p.id !== opt.id);
      // If selecting "All", clear others; if selecting specific, remove "All"
      if (opt.id === '__ALL__') return [opt];
      return prev.filter((p) => p.id !== '__ALL__').concat(opt);
    });
    setShowPaygroupDropdown(false);
  };

  const removePaygroup = (id: string) => {
    setSelectedPaygroups((prev) => prev.filter((p) => p.id !== id));
  };

  const toggleDepartment = (opt: Option) => {
    setSelectedDepartments((prev) => {
      const exists = prev.some((d) => d.id === opt.id);
      if (exists) return prev.filter((d) => d.id !== opt.id);
      if (opt.id === '__ALL__') return [opt];
      return prev.filter((d) => d.id !== '__ALL__').concat(opt);
    });
    setShowDepartmentDropdown(false);
  };

  const removeDepartment = (id: string) => {
    setSelectedDepartments((prev) => prev.filter((d) => d.id !== id));
  };

  const toggleAlternateSaturday = (opt: Option) => {
    setSelectedAlternateSaturday((prev) => {
      const exists = prev.some((a) => a.id === opt.id);
      if (exists) return prev.filter((a) => a.id !== opt.id);
      // Only allow one selection for Alternate Saturday Off
      return [opt];
    });
    setShowAlternateSaturdayDropdown(false);
  };

  const removeAlternateSaturday = (id: string) => {
    setSelectedAlternateSaturday((prev) => prev.filter((a) => a.id !== id));
  };

  const toggleWeekOffDay = (weekIndex: number, dayIndex: number) => {
    setWeekOffDetails((prev) => {
      const updated = prev.map((week) => [...week]);
      updated[weekIndex][dayIndex] = !updated[weekIndex][dayIndex];
      return updated;
    });
  };

  const filteredEmployees = employees.filter(
    (e) =>
      !selectedEmployees.some((s) => s.id === e.id) &&
      (fullName(e).toLowerCase().includes(associateSearch.toLowerCase()) ||
        (e.employeeCode ?? '').toLowerCase().includes(associateSearch.toLowerCase()))
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId) return;
    if (!displayName.trim()) {
      setError('Display Name is required.');
      return;
    }
    const hasEmployee = selectedEmployees.length > 0;
    const hasPaygroup = selectedPaygroups.length > 0;
    const hasDepartment = selectedDepartments.length > 0;
    if (!hasEmployee && !hasPaygroup && !hasDepartment) {
      setError('Select at least one: Associate, Pay Group, or Department.');
      return;
    }
    if (selectedAlternateSaturday.length === 0) {
      setError('Alternate Saturday Off is required.');
      return;
    }
    if (!effectiveDate) {
      setError('Effective Date is required.');
      return;
    }

    setError(null);
    setSaving(true);
    try {
      const paygroupId = selectedPaygroups.length > 0 && selectedPaygroups[0]?.id !== '__ALL__' ? selectedPaygroups[0]?.id : undefined;
      const departmentId = selectedDepartments.length > 0 && selectedDepartments[0]?.id !== '__ALL__' ? selectedDepartments[0]?.id : undefined;
      
      // Store week off details in remarks as JSON
      const weekOffData = {
        alternateSaturdayOff: selectedAlternateSaturday[0]?.name || 'All',
        weekOffDetails,
      };
      const remarksWithData = remarks.trim()
        ? `${remarks.trim()}\n__WEEK_OFF_DATA__${JSON.stringify(weekOffData)}`
        : `__WEEK_OFF_DATA__${JSON.stringify(weekOffData)}`;
      
      // Note: ShiftAssignmentRule requires shiftId, so we use a default shift
      // In future, consider creating a separate WeekOffAssignmentRule model
      if (!defaultShiftId) {
        setError('No shift found. Please create a shift first.');
        setSaving(false);
        return;
      }
      
      const payload = {
        organizationId,
        displayName: displayName.trim(),
        shiftId: defaultShiftId,
        paygroupId: paygroupId || undefined,
        departmentId: departmentId || undefined,
        effectiveDate,
        priority: priority.trim() ? Number(priority) : undefined,
        remarks: remarksWithData || undefined,
        employeeIds: selectedEmployees.map((emp) => emp.id),
      };
      
      if (isEdit && id) {
        await shiftAssignmentRuleService.update(id, payload);
      } else {
        await shiftAssignmentRuleService.create(payload);
      }
      navigate('/attendance-policy/week-of-assign');
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : 'Failed to save';
      setError(String(msg || 'Failed to save'));
    } finally {
      setSaving(false);
    }
  };

  const MultiSelectChips = ({
    selected,
    onRemove,
    onToggle,
    options,
    showDropdown,
    setShowDropdown,
    placeholder,
  }: {
    selected: Option[];
    onRemove: (id: string) => void;
    onToggle: (opt: Option) => void;
    options: Option[];
    showDropdown: boolean;
    setShowDropdown: (v: boolean) => void;
    placeholder: string;
  }) => (
    <div className="relative min-w-0">
      <div
        onClick={() => setShowDropdown(!showDropdown)}
        className="min-h-[2.5rem] flex flex-wrap gap-2 rounded-lg border border-gray-300 px-3 py-2 bg-white cursor-text focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500"
      >
        {selected.map((opt) => (
          <span
            key={opt.id}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-100 text-blue-800 text-sm"
          >
            {opt.name}
            <button type="button" onClick={(e) => { e.stopPropagation(); onRemove(opt.id); }} className="ml-0.5 text-blue-600 hover:text-blue-900">
              ×
            </button>
          </span>
        ))}
        {selected.length === 0 && <span className="text-gray-400 text-sm">{placeholder}</span>}
      </div>
      {showDropdown && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)} aria-hidden="true" />
          <div className="absolute left-0 right-0 mt-1 py-2 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto">
            {options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onToggle(opt)}
                className="w-full text-left px-3 py-2 text-sm text-gray-900 hover:bg-gray-100"
              >
                {opt.name}
              </button>
            ))}
            {options.length === 0 && <div className="px-3 py-2 text-sm text-gray-500">No options</div>}
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader
        title="Attendance Policy"
        subtitle={organizationName ? `Organization: ${organizationName}` : undefined}
        onLogout={handleLogout}
      />

      <main className="flex-1 min-h-0 overflow-auto w-full bg-gray-100">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 bg-gray-50">
          {/* Breadcrumbs - Employee module style */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
            <nav className="flex items-center gap-1.5 text-sm text-gray-500" aria-label="Breadcrumb">
              <span className="font-semibold text-gray-900">Attendance Policy</span>
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <Link to="/attendance-policy" className="text-gray-500 hover:text-gray-900">Attendance Policy</Link>
              <span className="mx-1 text-gray-400">/</span>
              <Link to="/attendance-policy/week-of-assign" className="text-gray-500 hover:text-gray-900">Week off Assign</Link>
              <span className="mx-1 text-gray-400">/</span>
              <span className="text-gray-500">{isEdit ? 'Edit' : 'Add'}</span>
            </nav>
          </div>

          <div className="bg-white rounded-lg shadow mb-6">
            {/* Header Section - Employee module style */}
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">{isEdit ? 'Edit Week off Assign Rule' : 'Add Week off Assign Rule'}</h2>
              <p className="text-gray-600 mt-1">{isEdit ? 'Update the week off assignment rule details' : 'Create a new week off assignment rule'}</p>
            </div>

            <form onSubmit={handleSave} className="p-6">
              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Form Fields - Grid layout like Employee form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Display Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="block w-full h-10 bg-white text-gray-900 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g. Week Off"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Effective Date <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <input
                      type="date"
                      value={effectiveDate}
                      onChange={(e) => setEffectiveDate(e.target.value)}
                      className="block w-full h-10 bg-white text-gray-900 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
                    />
                    <svg className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Paygroup</label>
                  <MultiSelectChips
                    selected={selectedPaygroups}
                    onRemove={removePaygroup}
                    onToggle={togglePaygroup}
                    options={[{ id: '__ALL__', name: 'All' }, ...paygroups].filter((o) => !selectedPaygroups.some((x) => x.id === o.id))}
                    showDropdown={showPaygroupDropdown}
                    setShowDropdown={setShowPaygroupDropdown}
                    placeholder="Select paygroups (optional)..."
                  />
                  <p className="mt-1.5 text-xs text-gray-500">Optional. Select &quot;All&quot; or specific paygroups to apply this rule to those employees.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Department</label>
                  <MultiSelectChips
                    selected={selectedDepartments}
                    onRemove={removeDepartment}
                    onToggle={toggleDepartment}
                    options={[{ id: '__ALL__', name: 'All' }, ...departments].filter((o) => !selectedDepartments.some((x) => x.id === o.id))}
                    showDropdown={showDepartmentDropdown}
                    setShowDropdown={setShowDepartmentDropdown}
                    placeholder="Select departments (optional)..."
                  />
                  <p className="mt-1.5 text-xs text-gray-500">Optional. Select &quot;All&quot; or specific departments to apply this rule to those employees.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Alternate Saturday Off <span className="text-red-500">*</span></label>
                  <MultiSelectChips
                    selected={selectedAlternateSaturday}
                    onRemove={removeAlternateSaturday}
                    onToggle={toggleAlternateSaturday}
                    options={ALTERNATE_SATURDAY_OPTIONS.filter((o) => !selectedAlternateSaturday.some((x) => x.id === o.id))}
                    showDropdown={showAlternateSaturdayDropdown}
                    setShowDropdown={setShowAlternateSaturdayDropdown}
                    placeholder="Select alternate Saturday off..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Priority</label>
                  <input
                    type="text"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    placeholder="(Auto)"
                    className="block w-full h-10 bg-white text-gray-900 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Associate</label>
                  <div className="relative">
                    <div className="flex flex-wrap gap-2 min-h-[2.5rem] rounded-lg border border-gray-300 px-3 py-2 bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
                      {selectedEmployees.map((emp) => (
                        <span
                          key={emp.id}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 text-gray-800 text-sm"
                        >
                          {fullName(emp)} [{emp.employeeCode ?? emp.id.slice(0, 4)}]
                          <button
                            type="button"
                            onClick={() => removeEmployee(emp.id)}
                            className="ml-1 text-gray-600 hover:text-gray-900"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      <input
                        type="text"
                        value={associateSearch}
                        onChange={(e) => {
                          setAssociateSearch(e.target.value);
                          setShowAssociateDropdown(true);
                        }}
                        onFocus={() => setShowAssociateDropdown(true)}
                        placeholder="Search and add associates..."
                        className="min-w-[140px] flex-1 border-0 bg-white p-0 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-0 focus:outline-none"
                      />
                    </div>
                    {showAssociateDropdown && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowAssociateDropdown(false)} aria-hidden="true" />
                        <div className="absolute z-20 mt-1 border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto bg-white w-full">
                          {filteredEmployees.slice(0, 20).map((emp) => (
                            <button
                              key={emp.id}
                              type="button"
                              onClick={() => addEmployee(emp)}
                              className="w-full text-left px-3 py-2 text-sm text-gray-900 hover:bg-gray-100"
                            >
                              {fullName(emp)} [{emp.employeeCode ?? ''}]
                            </button>
                          ))}
                          {filteredEmployees.length === 0 && (
                            <div className="px-3 py-2 text-sm text-gray-500">No matches</div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Remarks</label>
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Remarks"
                    rows={3}
                    className="block w-full bg-white text-gray-900 rounded-lg border border-gray-300 px-4 py-2 text-sm resize-y focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* WeekOff Details Section */}
              <div className="mt-6 border-t border-gray-200 pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">WeekOff Details</h3>
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Weeks / Days</th>
                          {DAYS.map((day) => (
                            <th key={day} className="px-4 py-3 text-center text-sm font-medium text-gray-500">
                              {day}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {weekOffDetails.map((weekDays, weekIndex) => (
                          <tr key={weekIndex}>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900 bg-gray-50">
                              Week {weekIndex + 1}
                            </td>
                            {weekDays.map((isOff, dayIndex) => (
                              <td key={dayIndex} className="px-4 py-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => toggleWeekOffDay(weekIndex, dayIndex)}
                                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                                    isOff
                                      ? 'bg-green-500 text-white hover:bg-green-600'
                                      : 'bg-red-500 text-white hover:bg-red-600'
                                  }`}
                                >
                                  {isOff ? 'YES' : 'NO'}
                                </button>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 transition"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition disabled:opacity-50"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
