import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';
import BackNavigation from '../components/common/BackNavigation';
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

interface EventRule {
  key: string;
  label: string;
  type: 'toggle' | 'number';
  value: boolean | number;
}

// Event Rule Definitions
const EVENT_RULES: Omit<EventRule, 'value'>[] = [
  { key: 'allowBeforeEntryDate', label: 'Allow before entry date', type: 'toggle' },
  { key: 'combineMultipleDaysExcessTimeToCompOff', label: 'Combine multiple day(s) excess time to comp off', type: 'toggle' },
  { key: 'considerExtraHours', label: 'Consider extra hour(s)', type: 'toggle' },
  { key: 'considerExtraHoursAsCompOff', label: 'Consider extra hour(s) as comp off', type: 'toggle' },
  { key: 'expiryDaysForHoliday', label: 'Expiry days for holiday', type: 'number' },
  { key: 'expiryDaysForWeekOff', label: 'Expiry days for week off', type: 'number' },
  { key: 'expiryDaysForWorkDay', label: 'Expiry Days for work day', type: 'number' },
  { key: 'fullDayRequirementInHoliday', label: 'Full day requirement in holiday', type: 'number' },
  { key: 'fullDayRequirementInWeekOff', label: 'Full day requirement in week off', type: 'number' },
  { key: 'fullDayRequirementInWorkDay', label: 'Full day requirement in work day', type: 'number' },
  { key: 'halfDayRequirementInHoliday', label: 'Half day requirement in holiday', type: 'number' },
  { key: 'halfDayRequirementInWeekOff', label: 'Half day requirement in week off', type: 'number' },
  { key: 'halfDayRequirementInWorkDay', label: 'Half day requirement in work day', type: 'number' },
];

// Default values for event rules (used when editing; add page starts with empty/unselected)
const DEFAULT_RULE_VALUES: Record<string, boolean | number> = {
  allowBeforeEntryDate: false,
  combineMultipleDaysExcessTimeToCompOff: false,
  considerExtraHours: false,
  considerExtraHoursAsCompOff: false,
  expiryDaysForHoliday: 0,
  expiryDaysForWeekOff: 0,
  expiryDaysForWorkDay: 0,
  fullDayRequirementInHoliday: 0,
  fullDayRequirementInWeekOff: 0,
  fullDayRequirementInWorkDay: 0,
  halfDayRequirementInHoliday: 0,
  halfDayRequirementInWeekOff: 0,
  halfDayRequirementInWorkDay: 0,
};

export default function ExcessTimeConversionFormPage() {
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
  const [selectedPaygroups, setSelectedPaygroups] = useState<Option[]>([]);
  const [showPaygroupDropdown, setShowPaygroupDropdown] = useState(false);
  const [selectedDepartments, setSelectedDepartments] = useState<Option[]>([]);
  const [showDepartmentDropdown, setShowDepartmentDropdown] = useState(false);
  const [compoffApplicable, setCompoffApplicable] = useState<Option[]>([]);
  const [showCompoffDropdown, setShowCompoffDropdown] = useState(false);
  const [priority, setPriority] = useState('');
  const [remarks, setRemarks] = useState('');
  const [eventRules, setEventRules] = useState<Map<string, boolean | number>>(new Map());

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [paygroups, setPaygroups] = useState<Option[]>([]);
  const [departments, setDepartments] = useState<Option[]>([]);
  const [defaultShiftId, setDefaultShiftId] = useState<string | null>(null);

  // Refs for dropdowns
  const associateDropdownRef = useRef<HTMLDivElement>(null);
  const paygroupDropdownRef = useRef<HTMLDivElement>(null);
  const departmentDropdownRef = useRef<HTMLDivElement>(null);
  const compoffDropdownRef = useRef<HTMLDivElement>(null);

  // Initialize event rules with default values
  useEffect(() => {
    const initialRules = new Map<string, boolean | number>();
    EVENT_RULES.forEach((rule) => {
      initialRules.set(rule.key, DEFAULT_RULE_VALUES[rule.key] ?? (rule.type === 'toggle' ? false : 0));
    });
    setEventRules(initialRules);
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (associateDropdownRef.current && !associateDropdownRef.current.contains(event.target as Node)) {
        setShowAssociateDropdown(false);
      }
      if (paygroupDropdownRef.current && !paygroupDropdownRef.current.contains(event.target as Node)) {
        setShowPaygroupDropdown(false);
      }
      if (departmentDropdownRef.current && !departmentDropdownRef.current.contains(event.target as Node)) {
        setShowDepartmentDropdown(false);
      }
      if (compoffDropdownRef.current && !compoffDropdownRef.current.contains(event.target as Node)) {
        setShowCompoffDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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

  useEffect(() => {
    if (!id || !organizationId) return;
    setLoading(true);
    setError(null);
    shiftAssignmentRuleService
      .getById(id)
      .then((rule) => {
        setDisplayName(rule.displayName || '');
        setPriority(rule.priority != null ? String(rule.priority) : '');
        
        // Extract event rule data from remarks
        const rawRemarks = rule.remarks || '';
        const eventMarker = '__EVENT_RULE_DATA__';
        const markerIdx = rawRemarks.indexOf(eventMarker);
        
        if (markerIdx >= 0) {
          const jsonStr = rawRemarks.slice(markerIdx + eventMarker.length);
          try {
            const parsed = JSON.parse(jsonStr) as Record<string, boolean | number>;
            const rulesMap = new Map<string, boolean | number>();
            EVENT_RULES.forEach((ruleDef) => {
              rulesMap.set(ruleDef.key, parsed[ruleDef.key] ?? DEFAULT_RULE_VALUES[ruleDef.key] ?? (ruleDef.type === 'toggle' ? false : 0));
            });
            setEventRules(rulesMap);
          } catch {
            // ignore parse error, use defaults
          }
          setRemarks(rawRemarks.slice(0, markerIdx).trim());
        } else {
          setRemarks(rawRemarks);
        }
        
        // Extract compoff applicable from remarks or default to Yes
        const compoffMatch = rawRemarks.match(/compoff[:\s]+(yes|no|true|false)/i);
        if (compoffMatch) {
          const value = compoffMatch[1].toLowerCase();
          setCompoffApplicable([{ id: value === 'yes' || value === 'true' ? 'YES' : 'NO', name: value === 'yes' || value === 'true' ? 'Yes' : 'No' }]);
        } else {
          setCompoffApplicable([{ id: 'YES', name: 'Yes' }]);
        }
        
        if (rule.paygroup) {
          setSelectedPaygroups([{ id: rule.paygroup.id, name: rule.paygroup.name }]);
        } else {
          setSelectedPaygroups([{ id: '__ALL__', name: 'All' }]);
        }
        
        if (rule.department) {
          setSelectedDepartments([{ id: rule.department.id, name: rule.department.name }]);
        } else {
          setSelectedDepartments([{ id: '__ALL__', name: 'All' }]);
        }
        
        if (rule.employeeIds && Array.isArray(rule.employeeIds)) {
          const empIds = rule.employeeIds as string[];
          employeeService.getAll({ organizationId, page: 1, limit: 500, employeeStatus: 'ACTIVE' })
            .then((res) => {
              const allEmps = res.employees || [];
              const selected = allEmps.filter((e) => empIds.includes(e.id));
              setSelectedEmployees(selected);
            })
            .catch(() => {});
        }
      })
      .catch((err: unknown) => {
        const msg =
          err && typeof err === 'object' && 'response' in err
            ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
            : 'Failed to load rule';
        setError(String(msg || 'Failed to load rule'));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id, organizationId]);

  const filteredEmployees = employees.filter((e) => {
    const name = fullName(e).toLowerCase();
    const code = e.employeeCode?.toLowerCase() || '';
    const search = associateSearch.toLowerCase();
    return name.includes(search) || code.includes(search);
  });

  const handleUpdateRule = (key: string, value: boolean | number) => {
    setEventRules(new Map(eventRules).set(key, value));
  };

  const handleSave = async () => {
    if (!organizationId) {
      setError('Organization ID is required');
      return;
    }

    if (!displayName.trim()) {
      setError('Display Name is required');
      return;
    }

    if (selectedPaygroups.length === 0) {
      setError('Paygroup is required');
      return;
    }

    if (selectedDepartments.length === 0) {
      setError('Department is required');
      return;
    }

    if (compoffApplicable.length === 0) {
      setError('Compoff Applicable is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const paygroupId = selectedPaygroups[0]?.id === '__ALL__' ? undefined : selectedPaygroups[0]?.id;
      const departmentId = selectedDepartments[0]?.id === '__ALL__' ? undefined : selectedDepartments[0]?.id;
      
      // Store event rule data in remarks as JSON
      const ruleData: Record<string, boolean | number> = {};
      eventRules.forEach((value, key) => {
        ruleData[key] = value;
      });
      
      const compoffValue = compoffApplicable[0]?.id === 'YES' ? 'Yes' : 'No';
      const remarksWithData = [
        remarks.trim(),
        `Compoff Applicable: ${compoffValue}`,
        `__EVENT_RULE_DATA__${JSON.stringify(ruleData)}`,
      ].filter(Boolean).join('\n');
      
      // Note: ShiftAssignmentRule requires shiftId, so we use a default shift
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
        effectiveDate: new Date().toISOString().slice(0, 10), // Use current date as effective date
        priority: priority.trim() ? Number(priority) : undefined,
        remarks: remarksWithData || undefined,
        employeeIds: selectedEmployees.map((emp) => emp.id),
      };

      if (isEdit && id) {
        await shiftAssignmentRuleService.update(id, payload);
      } else {
        await shiftAssignmentRuleService.create(payload);
      }
      navigate('/attendance-policy/excess-time-conversion');
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

  const handleCancel = () => navigate('/attendance-policy/excess-time-conversion');

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const MultiSelectChips = ({
    selected,
    onRemove,
    onToggle,
    options,
    placeholder,
    showDropdown,
    onToggleDropdown,
    searchValue,
    onSearchChange,
    dropdownRef,
    isEmployeeField = false,
  }: {
    selected: Option[] | Employee[];
    onRemove: (item: Option | Employee) => void;
    onToggle: (item: Option | Employee) => void;
    options: Option[] | Employee[];
    placeholder: string;
    showDropdown: boolean;
    onToggleDropdown: () => void;
    searchValue: string;
    onSearchChange: (value: string) => void;
    dropdownRef: React.RefObject<HTMLDivElement>;
    isEmployeeField?: boolean;
  }) => {
    const isEmployee = (item: Option | Employee): item is Employee => 'employeeCode' in item;

    return (
      <div className="relative w-full" ref={dropdownRef}>
        <div
          className="min-h-[2.5rem] px-3 py-1.5 pr-8 border border-gray-300 rounded-lg bg-white flex flex-wrap items-center gap-1.5 cursor-pointer relative focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500"
          onClick={(e) => {
            e.stopPropagation();
            onToggleDropdown();
          }}
        >
          {selected.map((item) => (
            <span
              key={isEmployee(item) ? item.id : item.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded-lg text-sm"
            >
              {isEmployee(item) ? fullName(item) : item.name}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(item);
                }}
                className="hover:text-blue-600"
              >
                ×
              </button>
            </span>
          ))}
          {isEmployeeField ? (
            <input
              type="text"
              value={searchValue}
              onChange={(e) => {
                onSearchChange(e.target.value);
                if (!showDropdown) onToggleDropdown();
              }}
              onClick={(e) => {
                e.stopPropagation();
                onToggleDropdown();
              }}
              onFocus={() => onToggleDropdown()}
              className="flex-1 min-w-[120px] outline-none text-sm"
              placeholder={selected.length === 0 ? placeholder : ''}
            />
          ) : (
            selected.length === 0 && (
              <span className="text-gray-400 text-sm flex-1">{placeholder}</span>
            )
          )}
          {/* Dropdown arrow indicator */}
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        {showDropdown && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
              {options.length === 0 ? (
                <div className="px-4 py-2 text-sm text-gray-500">No options found</div>
              ) : (
                options.map((item) => {
                  const isSelected = selected.some((s) => 
                    isEmployee(item) && isEmployee(s) 
                      ? s.id === item.id 
                      : !isEmployee(item) && !isEmployee(s) 
                      ? s.id === item.id 
                      : false
                  );
                  return (
                    <button
                      key={isEmployee(item) ? item.id : item.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onToggle(item);
                        if (!isEmployee(item) && item.id === '__ALL__') {
                          onToggleDropdown();
                        }
                      }}
                      className={`w-full text-left px-4 py-2 text-sm cursor-pointer hover:bg-gray-100 ${
                        isSelected ? 'bg-blue-50' : ''
                      }`}
                    >
                      {isEmployee(item) ? fullName(item) : item.name}
                    </button>
                  );
                })
              )}
            </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
        <BackNavigation to="/attendance-policy/excess-time-conversion" label="Excess Time Conversion" />
        <AppHeader
          title="Attendance Policy"
          subtitle={organizationName ? organizationName : undefined}
          onLogout={handleLogout}
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-500">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <BackNavigation to="/attendance-policy/excess-time-conversion" label="Excess Time Conversion" />
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
              <Link to="/attendance-policy/excess-time-conversion" className="text-gray-500 hover:text-gray-900">Excess Time Conversion</Link>
              <span className="mx-1 text-gray-400">/</span>
              <span className="text-gray-500">{isEdit ? 'Edit' : 'Add'}</span>
            </nav>
          </div>

          <div className="bg-white rounded-lg shadow mb-6">
            {/* Header Section - Employee module style */}
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">{isEdit ? 'Edit Excess Time Conversion Rule' : 'Add Excess Time Conversion Rule'}</h2>
              <p className="text-gray-600 mt-1">{isEdit ? 'Update the excess time conversion rule details' : 'Create a new excess time conversion rule'}</p>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="p-6">
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
                    placeholder="Display Name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Priority</label>
                  <input
                    type="text"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="block w-full h-10 bg-white text-gray-900 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="(Auto)"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Paygroup <span className="text-red-500">*</span></label>
                  <MultiSelectChips
                    selected={selectedPaygroups}
                    onRemove={(pg) => {
                      if (pg.id === '__ALL__') return;
                      setSelectedPaygroups(selectedPaygroups.filter((p) => p.id !== pg.id));
                    }}
                    onToggle={(pg) => {
                      if (pg.id === '__ALL__') {
                        setSelectedPaygroups([{ id: '__ALL__', name: 'All' }]);
                      } else {
                        setSelectedPaygroups([pg as Option]);
                      }
                      setShowPaygroupDropdown(false);
                    }}
                    options={[{ id: '__ALL__', name: 'All' }, ...paygroups]}
                    placeholder="Paygroup"
                    showDropdown={showPaygroupDropdown}
                    onToggleDropdown={() => setShowPaygroupDropdown(!showPaygroupDropdown)}
                    searchValue=""
                    onSearchChange={() => {}}
                    dropdownRef={paygroupDropdownRef}
                  />
                  <p className="mt-1.5 text-xs text-gray-500">Select &quot;All&quot; to apply this rule to all paygroups in the organization.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Department <span className="text-red-500">*</span></label>
                  <MultiSelectChips
                    selected={selectedDepartments}
                    onRemove={(dept) => {
                      if (dept.id === '__ALL__') return;
                      setSelectedDepartments(selectedDepartments.filter((d) => d.id !== dept.id));
                    }}
                    onToggle={(dept) => {
                      if (dept.id === '__ALL__') {
                        setSelectedDepartments([{ id: '__ALL__', name: 'All' }]);
                      } else {
                        setSelectedDepartments([dept as Option]);
                      }
                      setShowDepartmentDropdown(false);
                    }}
                    options={[{ id: '__ALL__', name: 'All' }, ...departments]}
                    placeholder="Department"
                    showDropdown={showDepartmentDropdown}
                    onToggleDropdown={() => setShowDepartmentDropdown(!showDepartmentDropdown)}
                    searchValue=""
                    onSearchChange={() => {}}
                    dropdownRef={departmentDropdownRef}
                  />
                  <p className="mt-1.5 text-xs text-gray-500">Select &quot;All&quot; to apply this rule to all departments in the organization.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Compoff Applicable <span className="text-red-500">*</span></label>
                  <MultiSelectChips
                    selected={compoffApplicable}
                    onRemove={() => {
                      // Don't allow removing if it's required
                    }}
                    onToggle={(opt) => {
                      setCompoffApplicable([opt as Option]);
                      setShowCompoffDropdown(false);
                    }}
                    options={[{ id: 'YES', name: 'Yes' }, { id: 'NO', name: 'No' }]}
                    placeholder="Compoff Applicable"
                    showDropdown={showCompoffDropdown}
                    onToggleDropdown={() => setShowCompoffDropdown(!showCompoffDropdown)}
                    searchValue=""
                    onSearchChange={() => {}}
                    dropdownRef={compoffDropdownRef}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Associate</label>
                  <MultiSelectChips
                    selected={selectedEmployees}
                    onRemove={(emp) => setSelectedEmployees(selectedEmployees.filter((e) => e.id !== emp.id))}
                    onToggle={(emp) => {
                      const exists = selectedEmployees.some((e) => e.id === emp.id);
                      if (exists) {
                        setSelectedEmployees(selectedEmployees.filter((e) => e.id !== emp.id));
                      } else {
                        setSelectedEmployees([...selectedEmployees, emp as Employee]);
                      }
                    }}
                    options={filteredEmployees}
                    placeholder="Associate"
                    showDropdown={showAssociateDropdown}
                    onToggleDropdown={() => setShowAssociateDropdown(!showAssociateDropdown)}
                    searchValue={associateSearch}
                    onSearchChange={setAssociateSearch}
                    dropdownRef={associateDropdownRef}
                    isEmployeeField={true}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Remarks</label>
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    rows={3}
                    className="block w-full bg-white text-gray-900 rounded-lg border border-gray-300 px-4 py-2 text-sm resize-y focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Remarks"
                  />
                </div>
              </div>

              {/* Event Rule Definition Section */}
              <div className="mt-6 border-t border-gray-200 pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Event Rule Definition</h3>
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Rule</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Value</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {EVENT_RULES.map((ruleDef) => {
                          const currentValue = eventRules.get(ruleDef.key) ?? DEFAULT_RULE_VALUES[ruleDef.key] ?? (ruleDef.type === 'toggle' ? false : 0);
                          return (
                            <tr key={ruleDef.key} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm text-gray-700">{ruleDef.label}</td>
                              <td className="px-4 py-3">
                                {ruleDef.type === 'toggle' ? (
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        handleUpdateRule(ruleDef.key, !currentValue);
                                      }}
                                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                        currentValue ? 'bg-blue-500' : 'bg-gray-300'
                                      }`}
                                    >
                                      <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                          currentValue ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                      />
                                    </button>
                                    <span
                                      className={`text-sm font-medium px-3 py-1 rounded-lg ${
                                        currentValue
                                          ? 'bg-blue-100 text-blue-700'
                                          : 'bg-gray-100 text-gray-500'
                                      }`}
                                    >
                                      {currentValue ? 'YES' : 'NO'}
                                    </span>
                                  </div>
                                ) : (
                                  <input
                                    type="number"
                                    value={typeof currentValue === 'number' && currentValue !== 0 ? currentValue : ''}
                                    onChange={(e) => handleUpdateRule(ruleDef.key, e.target.value === '' ? 0 : Number(e.target.value))}
                                    placeholder="0"
                                    className="h-9 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-32"
                                  />
                                )}
                              </td>
                            </tr>
                          );
                        })}
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
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
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
