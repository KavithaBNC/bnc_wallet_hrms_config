import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';
import BackNavigation from '../components/common/BackNavigation';
import shiftAssignmentRuleService from '../services/shiftAssignmentRule.service';
import employeeService, { Employee } from '../services/employee.service';
import shiftService from '../services/shift.service';
import paygroupService from '../services/paygroup.service';
import departmentService from '../services/department.service';

function fullName(e: Employee): string {
  const parts = [e.firstName, e.middleName, e.lastName].filter(Boolean);
  return parts.join(' ').trim() || e.employeeCode || '';
}

interface Option {
  id: string;
  name: string;
}

/** Normalize time string to HH:MM for time input (e.g. "4:00" -> "04:00") */
function toTimeInputFormat(val: string | undefined): string {
  if (!val) return '00:00';
  const parts = String(val).split(':');
  const h = parseInt(parts[0] || '0', 10);
  const m = parseInt(parts[1] || '0', 10);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Attendance policy rule definitions - Rule Name and Field Type (time, toggle, or number for minutes) */
const ATTENDANCE_POLICY_RULES = [
  { key: 'shiftStartGraceTime', label: 'Shift Start Grace Time (HH:MM)', type: 'time' as const, default: '00:00' },
  { key: 'shiftStartGraceMinutes', label: 'Shift Start Grace (minutes) — overrides above if set', type: 'number' as const, default: '' },
  { key: 'shiftEndGraceTime', label: 'Shift End Grace Time (HH:MM)', type: 'time' as const, default: '00:00' },
  { key: 'shiftEndGraceMinutes', label: 'Shift End Grace (minutes) — overrides above if set', type: 'number' as const, default: '' },
  { key: 'considerLateFromGraceTime', label: 'Consider Late from Grace Time', type: 'toggle' as const, default: true },
  { key: 'considerEarlyGoingFromGraceTime', label: 'Consider Early Going from Grace Time', type: 'toggle' as const, default: true },
  { key: 'minBreakHoursAsDeviation', label: 'Minimum Break Hours consider as Deviation', type: 'time' as const, default: '01:00' },
  { key: 'includingShiftBreak', label: 'Including Shift Break', type: 'toggle' as const, default: false },
  { key: 'considerLateAsShortfall', label: 'Consider Late as Shortfall', type: 'toggle' as const, default: false },
  { key: 'considerEarlyGoingAsShortfall', label: 'Consider Early Going as Shortfall', type: 'toggle' as const, default: false },
  { key: 'considerExcessBreakAsShortfall', label: 'Consider Excess Break as Shortfall', type: 'toggle' as const, default: false },
  { key: 'minShortfallHoursAsDeviation', label: 'Minimum Shortfall Hours consider as Deviation', type: 'time' as const, default: '00:00' },
  { key: 'earlyComingConsideredAsOT', label: 'Can Early Coming to Shift be Considered as OT', type: 'toggle' as const, default: false },
  { key: 'excessStayConsideredAsOT', label: 'Can Excess Stay be considered as Over Time', type: 'toggle' as const, default: true },
  { key: 'workingHoursInLeaveAsOT', label: 'Can Working Hours in Leave be considered as OT', type: 'toggle' as const, default: false },
  { key: 'minOTHoursPerDay', label: 'Minimum OT Hours allowed per day', type: 'time' as const, default: '04:00' },
  { key: 'maxOTHoursPerDay', label: 'Maximum OT Hours allowed per day', type: 'time' as const, default: '16:00' },
  { key: 'roundOffOption', label: 'Round Off Option', type: 'toggle' as const, default: false },
  { key: 'otStartsAfterShiftEnd', label: 'OT Calculation starts after the end of Shift Time', type: 'time' as const, default: '00:01' },
];

export default function LateAndOthersFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const { user, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;
  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id;

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [selectedEmployees, setSelectedEmployees] = useState<Employee[]>([]);
  const [associateSearch, setAssociateSearch] = useState('');
  const [showAssociateDropdown, setShowAssociateDropdown] = useState(false);
  const [selectedShifts, setSelectedShifts] = useState<Option[]>([]);
  const [showShiftDropdown, setShowShiftDropdown] = useState(false);
  const [selectedPaygroups, setSelectedPaygroups] = useState<Option[]>([]);
  const [showPaygroupDropdown, setShowPaygroupDropdown] = useState(false);
  const [selectedDepartments, setSelectedDepartments] = useState<Option[]>([]);
  const [showDepartmentDropdown, setShowDepartmentDropdown] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [priority, setPriority] = useState('');
  const [remarks, setRemarks] = useState('');

  const [ruleValues, setRuleValues] = useState<Record<string, string | boolean>>(() => {
    const init: Record<string, string | boolean> = {};
    ATTENDANCE_POLICY_RULES.forEach((r) => {
      init[r.key] = (r.type === 'time' || r.type === 'number' ? r.default : r.default) as string | boolean;
    });
    return init;
  });

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Option[]>([]);
  const [paygroups, setPaygroups] = useState<Option[]>([]);
  const [departments, setDepartments] = useState<Option[]>([]);

  useEffect(() => {
    if (!organizationId) return;
    Promise.all([
      employeeService.getAll({ organizationId, page: 1, limit: 500, employeeStatus: 'ACTIVE' }),
      shiftService.getAll({ organizationId, limit: 100 }),
      paygroupService.getAll({ organizationId }),
      departmentService.getAll({ organizationId, limit: 500 }),
    ]).then(([empRes, shiftRes, pgList, deptRes]) => {
      setEmployees(empRes.employees || []);
      setShifts((shiftRes.shifts || []).map((s) => ({ id: s.id, name: s.name })));
      setPaygroups((pgList || []).map((p) => ({ id: p.id, name: p.name })));
      setDepartments((deptRes?.departments || []).map((d) => ({ id: d.id, name: d.name })));
    }).catch(() => {});
  }, [organizationId]);

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
        const rawRemarks = rule.remarks ?? '';
        const policyMarker = '__POLICY_RULES__';
        const markerIdx = rawRemarks.indexOf(policyMarker);
        if (markerIdx >= 0) {
          const jsonStr = rawRemarks.slice(markerIdx + policyMarker.length);
          try {
            const parsed = JSON.parse(jsonStr) as Record<string, string | boolean>;
            const defaults: Record<string, string | boolean> = {};
            ATTENDANCE_POLICY_RULES.forEach((r) => {
              defaults[r.key] = (r.type === 'time' || r.type === 'number' ? r.default : r.default) as string | boolean;
            });
            setRuleValues({ ...defaults, ...parsed });
          } catch {
            // ignore parse error
          }
          setRemarks(rawRemarks.slice(0, markerIdx).trim());
        } else {
          setRemarks(rawRemarks);
        }
        if (rule.shift) {
          setSelectedShifts([{ id: rule.shift.id, name: rule.shift.name }]);
        }
        if (rule.paygroup) {
          setSelectedPaygroups([{ id: rule.paygroup.id, name: rule.paygroup.name }]);
        }
        if (rule.department) {
          setSelectedDepartments([{ id: rule.department.id, name: rule.department.name }]);
        } else {
          setSelectedDepartments([{ id: '__ALL__', name: 'All' }]);
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

  const handleCancel = () => navigate('/attendance-policy/late-and-others');

  const addEmployee = (emp: Employee) => {
    if (selectedEmployees.some((e) => e.id === emp.id)) return;
    setSelectedEmployees((prev) => [...prev, emp]);
    setAssociateSearch('');
    setShowAssociateDropdown(false);
  };

  const removeEmployee = (empId: string) => {
    setSelectedEmployees((prev) => prev.filter((e) => e.id !== empId));
  };

  const toggleShift = (opt: Option) => {
    setSelectedShifts((prev) => {
      const exists = prev.some((s) => s.id === opt.id);
      if (exists) return prev.filter((s) => s.id !== opt.id);
      return [...prev, opt];
    });
    setShowShiftDropdown(false);
  };

  const removeShift = (id: string) => {
    setSelectedShifts((prev) => prev.filter((s) => s.id !== id));
  };

  const togglePaygroup = (opt: Option) => {
    setSelectedPaygroups((prev) => {
      const exists = prev.some((p) => p.id === opt.id);
      if (exists) return prev.filter((p) => p.id !== opt.id);
      return [...prev, opt];
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
      return [...prev, opt];
    });
    setShowDepartmentDropdown(false);
  };

  const removeDepartment = (id: string) => {
    setSelectedDepartments((prev) => prev.filter((d) => d.id !== id));
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
    if (!effectiveDate) {
      setError('Effective Date is required.');
      return;
    }
    if (
      selectedShifts.length === 0 &&
      selectedPaygroups.length === 0 &&
      selectedDepartments.length === 0
    ) {
      setError('Select at least one: Shift, Paygroup, or Department.');
      return;
    }

    setError(null);
    setSaving(true);
    try {
      const paygroupId = selectedPaygroups[0]?.id === '__ALL__' ? undefined : selectedPaygroups[0]?.id;
      const departmentId = selectedDepartments[0]?.id === '__ALL__' ? undefined : selectedDepartments[0]?.id;
      const remarksWithRules = remarks.trim()
        ? `${remarks.trim()}\n__POLICY_RULES__${JSON.stringify(ruleValues)}`
        : `__POLICY_RULES__${JSON.stringify(ruleValues)}`;
      const payload = {
        organizationId,
        displayName: displayName.trim(),
        shiftId: selectedShifts[0]?.id ?? undefined,
        paygroupId: paygroupId || undefined,
        departmentId: departmentId || undefined,
        effectiveDate,
        priority: priority.trim() ? Number(priority) : undefined,
        remarks: remarksWithRules || undefined,
        employeeIds: selectedEmployees.map((emp) => emp.id),
      };
      if (isEdit && id) {
        await shiftAssignmentRuleService.update(id, payload);
      } else {
        await shiftAssignmentRuleService.create(payload);
      }
      navigate('/attendance-policy/late-and-others');
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
      <BackNavigation to="/attendance-policy/late-and-others" label="Late and Others" />
      <AppHeader
        title="Attendance Policy"
        subtitle={organizationName ? organizationName : undefined}
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
              <Link to="/attendance-policy/late-and-others" className="text-gray-500 hover:text-gray-900">Late & Others</Link>
              <span className="mx-1 text-gray-400">/</span>
              <span className="text-gray-500">{isEdit ? 'Edit' : 'Add'}</span>
            </nav>
          </div>

          <div className="bg-white rounded-lg shadow mb-6">
            {/* Header Section - Employee module style */}
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">{isEdit ? 'Edit Late & Others Rule' : 'Add Late & Others Rule'}</h2>
              <p className="text-gray-600 mt-1">{isEdit ? 'Update the late & others rule details' : 'Create a new late & others rule'}</p>
            </div>

            <div className="p-6">
              {loading ? (
                <div className="p-8 text-center text-gray-500">Loading...</div>
              ) : (
                <form onSubmit={handleSave} className="space-y-6">
                  {/* Form fields - Grid layout like Employee form */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Display Name <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="e.g. GS"
                        className="block w-full h-10 bg-white text-gray-900 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Shift</label>
                      <MultiSelectChips
                        selected={selectedShifts}
                        onRemove={removeShift}
                        onToggle={toggleShift}
                        options={shifts.filter((s) => !selectedShifts.some((x) => x.id === s.id))}
                        showDropdown={showShiftDropdown}
                        setShowDropdown={setShowShiftDropdown}
                        placeholder="Select shifts..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Priority</label>
                      <input
                        type="text"
                        value={priority}
                        onChange={(e) => setPriority(e.target.value)}
                        placeholder="e.g. 10000000"
                        className="block w-full h-10 bg-white text-gray-900 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Paygroup</label>
                      <MultiSelectChips
                        selected={selectedPaygroups}
                        onRemove={removePaygroup}
                        onToggle={togglePaygroup}
                        options={[{ id: '__ALL__', name: 'All' }, ...paygroups].filter((o) => !selectedPaygroups.some((x) => x.id === o.id))}
                        showDropdown={showPaygroupDropdown}
                        setShowDropdown={setShowPaygroupDropdown}
                        placeholder="Select paygroups..."
                      />
                      <p className="mt-1.5 text-xs text-gray-500">Select &quot;All&quot; to apply this rule to all paygroups in the organization.</p>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Department</label>
                      <MultiSelectChips
                        selected={selectedDepartments}
                        onRemove={removeDepartment}
                        onToggle={toggleDepartment}
                        options={[{ id: '__ALL__', name: 'All' }, ...departments].filter((o) => !selectedDepartments.some((x) => x.id === o.id))}
                        showDropdown={showDepartmentDropdown}
                        setShowDropdown={setShowDepartmentDropdown}
                        placeholder="Select departments..."
                      />
                      <p className="mt-1.5 text-xs text-gray-500">Select &quot;All&quot; to apply this rule to all departments in the organization.</p>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Associate</label>
                      <div className="relative">
                        <div className="flex flex-wrap gap-2 min-h-[2.5rem] rounded-lg border border-gray-300 px-3 py-2 bg-white">
                          {selectedEmployees.map((emp) => (
                            <span key={emp.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 text-gray-800 text-sm">
                              {fullName(emp)}
                              <button type="button" onClick={() => removeEmployee(emp.id)} className="ml-1 text-gray-600 hover:text-gray-900">×</button>
                            </span>
                          ))}
                          <input
                            type="text"
                            value={associateSearch}
                            onChange={(e) => { setAssociateSearch(e.target.value); setShowAssociateDropdown(true); }}
                            onFocus={() => setShowAssociateDropdown(true)}
                            placeholder="Search associates..."
                            className="min-w-[120px] flex-1 border-0 p-0 text-sm text-gray-900 bg-transparent focus:ring-0 focus:outline-none"
                          />
                        </div>
                        {showAssociateDropdown && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setShowAssociateDropdown(false)} aria-hidden="true" />
                            <div className="absolute z-20 mt-1 py-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto w-full">
                              {filteredEmployees.slice(0, 20).map((emp) => (
                                <button key={emp.id} type="button" onClick={() => addEmployee(emp)} className="w-full text-left px-3 py-2 text-sm text-gray-900 hover:bg-gray-100">
                                  {fullName(emp)} [{emp.employeeCode ?? ''}]
                                </button>
                              ))}
                              {filteredEmployees.length === 0 && <div className="px-3 py-2 text-sm text-gray-500">No matches</div>}
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

                  {/* Rule Details Table */}
                  <div className="mt-6 border-t border-gray-200 pt-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Rule Details</h3>
                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                      <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                        <div className="grid grid-cols-[1fr,200px] gap-4 text-sm font-medium text-gray-700">
                          <span>Rule Name</span>
                          <span className="text-right">Field Type</span>
                        </div>
                      </div>
                      <div className="divide-y divide-gray-200">
                        {ATTENDANCE_POLICY_RULES.map((rule) => (
                          <div key={rule.key} className="grid grid-cols-[1fr,200px] gap-4 items-center px-6 py-3 hover:bg-gray-50">
                            <span className="text-sm text-gray-700">{rule.label}</span>
                            <div className="flex justify-end">
                              {rule.type === 'time' ? (
                                <input
                                  type="time"
                                  value={toTimeInputFormat((ruleValues[rule.key] as string) ?? rule.default)}
                                  onChange={(e) => setRuleValues((prev) => ({ ...prev, [rule.key]: e.target.value }))}
                                  className="w-28 h-9 rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                                />
                              ) : rule.type === 'number' ? (
                                <input
                                  type="number"
                                  min={0}
                                  placeholder="e.g. 4"
                                  value={(ruleValues[rule.key] as string) ?? ''}
                                  onChange={(e) => setRuleValues((prev) => ({ ...prev, [rule.key]: e.target.value }))}
                                  className="w-28 h-9 rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                              ) : (
                                <select
                                  value={(ruleValues[rule.key] as boolean) ? 'YES' : 'NO'}
                                  onChange={(e) => setRuleValues((prev) => ({ ...prev, [rule.key]: e.target.value === 'YES' }))}
                                  className="h-9 rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                >
                                  <option value="YES">YES</option>
                                  <option value="NO">NO</option>
                                </select>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {error && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                      {error}
                    </div>
                  )}

                  {/* Action buttons */}
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
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                      </svg>
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
