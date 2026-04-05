import { useEffect, useState, useRef } from 'react';
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

interface EventRule {
  key: string;
  label: string;
  type: 'number';
  value: number;
}

// Event Rule Definitions for OT Usage Rule
const EVENT_RULES: Omit<EventRule, 'value'>[] = [
  { key: 'maxOvertimeMinutesInDay', label: 'Maximum over-time minutes in a day', type: 'number' },
];

// Default values for event rules
const DEFAULT_RULE_VALUES: Record<string, number> = {
  maxOvertimeMinutesInDay: 99999,
};

export default function OTUsageRuleFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const { user, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;
  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id || (user as any)?.organizationId;

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
  const [priority, setPriority] = useState('');
  const [remarks, setRemarks] = useState('');
  const [eventRules, setEventRules] = useState<Map<string, number>>(new Map());

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [paygroups, setPaygroups] = useState<Option[]>([]);
  const [departments, setDepartments] = useState<Option[]>([]);
  const [defaultShiftId, setDefaultShiftId] = useState<string | null>(null);

  // Refs for dropdowns
  const associateDropdownRef = useRef<HTMLDivElement>(null);
  const paygroupDropdownRef = useRef<HTMLDivElement>(null);
  const departmentDropdownRef = useRef<HTMLDivElement>(null);

  // Initialize event rules with default values
  useEffect(() => {
    const initialRules = new Map<string, number>();
    EVENT_RULES.forEach((rule) => {
      initialRules.set(rule.key, DEFAULT_RULE_VALUES[rule.key] ?? 0);
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
        const eventMarker = '__OT_USAGE_RULE_DATA__';
        const markerIdx = rawRemarks.indexOf(eventMarker);
        
        if (markerIdx >= 0) {
          const jsonStr = rawRemarks.slice(markerIdx + eventMarker.length);
          try {
            const parsed = JSON.parse(jsonStr) as Record<string, number>;
            const rulesMap = new Map<string, number>();
            EVENT_RULES.forEach((ruleDef) => {
              rulesMap.set(ruleDef.key, parsed[ruleDef.key] ?? DEFAULT_RULE_VALUES[ruleDef.key] ?? 0);
            });
            setEventRules(rulesMap);
          } catch {
            // ignore parse error, use defaults
          }
          setRemarks(rawRemarks.slice(0, markerIdx).trim());
        } else {
          setRemarks(rawRemarks);
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

  const handleUpdateRule = (key: string, value: number) => {
    setEventRules(new Map(eventRules.set(key, value)));
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


    setSaving(true);
    setError(null);

    try {
      const paygroupId = selectedPaygroups[0]?.id === '__ALL__' ? undefined : selectedPaygroups[0]?.id;
      const departmentId = selectedDepartments[0]?.id === '__ALL__' ? undefined : selectedDepartments[0]?.id;
      
      // Store event rule data in remarks as JSON
      const ruleData: Record<string, number> = {};
      eventRules.forEach((value, key) => {
        ruleData[key] = value;
      });
      
      const remarksWithData = [
        remarks.trim(),
        `__OT_USAGE_RULE_DATA__${JSON.stringify(ruleData)}`,
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
      navigate('/attendance-policy/ot-usage-rule');
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

  const handleCancel = () => navigate('/attendance-policy/ot-usage-rule');

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
          <>
            <div className="fixed inset-0 z-10" onClick={() => onToggleDropdown()} aria-hidden="true" />
            <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
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
                      onClick={() => {
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
          </>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
        <AppHeader
          title="Attendance Policy"
          subtitle={organizationName ? `Organization: ${organizationName}` : undefined}
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
              <Link to="/attendance-policy/ot-usage-rule" className="text-gray-500 hover:text-gray-900">OT Usage Rule</Link>
              <span className="mx-1 text-gray-400">/</span>
              <span className="text-gray-500">{isEdit ? 'Edit' : 'Add'}</span>
            </nav>
          </div>

          <div className="bg-white rounded-lg shadow mb-6">
            {/* Header Section - Employee module style */}
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">{isEdit ? 'Edit OT Usage Rule' : 'Add OT Usage Rule'}</h2>
              <p className="text-gray-600 mt-1">{isEdit ? 'Update the OT usage rule details' : 'Create a new OT usage rule'}</p>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Paygroup</label>
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
                        // Remove "__ALL__" if it exists when selecting a specific item
                        const withoutAll = selectedPaygroups.filter((p) => p.id !== '__ALL__');
                        const exists = withoutAll.some((p) => p.id === pg.id);
                        if (exists) {
                          setSelectedPaygroups(withoutAll.filter((p) => p.id !== pg.id));
                        } else {
                          setSelectedPaygroups([...withoutAll, pg as Option]);
                        }
                      }
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
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Department</label>
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
                        // Remove "__ALL__" if it exists when selecting a specific item
                        const withoutAll = selectedDepartments.filter((d) => d.id !== '__ALL__');
                        const exists = withoutAll.some((d) => d.id === dept.id);
                        if (exists) {
                          setSelectedDepartments(withoutAll.filter((d) => d.id !== dept.id));
                        } else {
                          setSelectedDepartments([...withoutAll, dept as Option]);
                        }
                      }
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
                          const currentValue = eventRules.get(ruleDef.key) ?? DEFAULT_RULE_VALUES[ruleDef.key] ?? 0;
                          return (
                            <tr key={ruleDef.key} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm text-gray-700">{ruleDef.label}</td>
                              <td className="px-4 py-3">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={currentValue === 0 ? '' : String(currentValue)}
                                  onChange={(e) => {
                                    const inputValue = e.target.value.trim();
                                    // Allow empty input
                                    if (inputValue === '') {
                                      handleUpdateRule(ruleDef.key, 0);
                                      return;
                                    }
                                    // Only allow digits
                                    if (!/^\d+$/.test(inputValue)) {
                                      return;
                                    }
                                    // Remove leading zeros and convert to number
                                    const cleanedValue = inputValue.replace(/^0+/, '') || '0';
                                    const numValue = Number(cleanedValue);
                                    if (!isNaN(numValue)) {
                                      handleUpdateRule(ruleDef.key, numValue);
                                    }
                                  }}
                                  onBlur={(e) => {
                                    // Ensure value is a valid number on blur
                                    const inputValue = e.target.value.trim();
                                    const numValue = inputValue === '' ? 0 : Number(inputValue) || 0;
                                    handleUpdateRule(ruleDef.key, numValue);
                                  }}
                                  className="h-9 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-32"
                                />
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
