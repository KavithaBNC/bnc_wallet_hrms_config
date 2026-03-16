import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';
import paygroupService from '../services/paygroup.service';
import departmentService from '../services/department.service';
import employeeService, { Employee } from '../services/employee.service';
import encashmentCarryForwardService from '../services/encashmentCarryForward.service';

interface Option {
  id: string;
  name: string;
}

function fullName(e: Employee): string {
  const parts = [e.firstName, e.middleName, e.lastName].filter(Boolean);
  return parts.join(' ').trim() || e.employeeCode || '';
}

export default function EncashmentCarryForwardFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const { user, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;
  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id;

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [displayName, setDisplayName] = useState('');
  const [selectedAssociate, setSelectedAssociate] = useState<Employee | null>(null);
  const [associateSearch, setAssociateSearch] = useState('');
  const [selectedPaygroups, setSelectedPaygroups] = useState<Option[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<Option[]>([]);
  const [remarks, setRemarks] = useState('');
  const [maxEncashmentDays, setMaxEncashmentDays] = useState(0);
  const [isEncashmentApplicable, setIsEncashmentApplicable] = useState(false);
  const [maxCarryForwardDays, setMaxCarryForwardDays] = useState(60);
  const [isCarryForwardApplicable, setIsCarryForwardApplicable] = useState(false);
  const [eventType, setEventType] = useState('Earned Leave');

  // Dropdowns
  const [paygroups, setPaygroups] = useState<Option[]>([]);
  const [departments, setDepartments] = useState<Option[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showAssociateDropdown, setShowAssociateDropdown] = useState(false);
  const [showPaygroupDropdown, setShowPaygroupDropdown] = useState(false);
  const [showDepartmentDropdown, setShowDepartmentDropdown] = useState(false);
  const associateDropdownRef = useRef<HTMLDivElement>(null);
  const paygroupDropdownRef = useRef<HTMLDivElement>(null);
  const departmentDropdownRef = useRef<HTMLDivElement>(null);

  // Fetch paygroups, departments, and employees
  useEffect(() => {
    if (!organizationId) return;
    Promise.all([
      paygroupService.getAll({ organizationId }),
      departmentService.getAll({ organizationId }),
      employeeService.getAll({ organizationId, page: 1, limit: 500, employeeStatus: 'ACTIVE' }),
    ]).then(([paygroupsData, departmentsData, empRes]) => {
      setPaygroups(paygroupsData.map((pg) => ({ id: pg.id, name: pg.name })));
      setDepartments((departmentsData.departments ?? []).map((dept: { id: string; name: string }) => ({ id: dept.id, name: dept.name })));
      setEmployees(empRes.employees || []);
    });
  }, [organizationId]);

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
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter employees based on search
  const filteredEmployees = associateSearch.trim()
    ? employees.filter(
        (e) =>
          (fullName(e).toLowerCase().includes(associateSearch.toLowerCase()) ||
            (e.employeeCode ?? '').toLowerCase().includes(associateSearch.toLowerCase()))
      )
    : employees; // Show all employees when search is empty

  const handleAssociateSelect = (emp: Employee) => {
    setSelectedAssociate(emp);
    setAssociateSearch(fullName(emp));
    setShowAssociateDropdown(false);
  };


  // Store loaded rule data
  const [loadedRule, setLoadedRule] = useState<any>(null);

  // Load data in edit mode
  useEffect(() => {
    if (!id || !organizationId) return;
    setLoading(true);
    setError(null);
    encashmentCarryForwardService
      .getById(id)
      .then((rule) => {
        setLoadedRule(rule);
        setDisplayName(rule.displayName);
        setRemarks(rule.remarks || '');
        setMaxEncashmentDays(rule.maxEncashmentDays);
        setIsEncashmentApplicable(rule.isEncashmentApplicable);
        setMaxCarryForwardDays(rule.maxCarryForwardDays);
        setIsCarryForwardApplicable(rule.isCarryForwardApplicable);
        setEventType(rule.eventType);
        
        // Set associate
        if (rule.associate) {
          const emp: Employee = {
            id: rule.associate.id,
            firstName: rule.associate.firstName,
            middleName: rule.associate.middleName || undefined,
            lastName: rule.associate.lastName,
            employeeCode: rule.associate.employeeCode,
          } as Employee;
          setSelectedAssociate(emp);
          setAssociateSearch(`${rule.associate.firstName} ${rule.associate.middleName || ''} ${rule.associate.lastName}`.trim());
        }
        
        setLoading(false);
      })
      .catch((err) => {
        const msg =
          err && typeof err === 'object' && 'response' in err
            ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
            : 'Failed to load';
        setError(String(msg || 'Failed to load'));
        setLoading(false);
      });
  }, [id, organizationId]);

  // Set paygroups and departments once they're loaded
  useEffect(() => {
    if (!loadedRule || paygroups.length === 0 || departments.length === 0) return;
    
    // Set paygroups
    if (loadedRule.paygroupIds && Array.isArray(loadedRule.paygroupIds) && loadedRule.paygroupIds.length > 0) {
      const pgOptions = paygroups.filter((pg) => loadedRule.paygroupIds.includes(pg.id));
      setSelectedPaygroups(pgOptions);
    }
    
    // Set departments
    if (loadedRule.departmentIds && Array.isArray(loadedRule.departmentIds) && loadedRule.departmentIds.length > 0) {
      const deptOptions = departments.filter((dept) => loadedRule.departmentIds.includes(dept.id));
      setSelectedDepartments(deptOptions);
    }
  }, [loadedRule, paygroups, departments]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleCancel = () => navigate('/event-configuration/encashment-carry-forward');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId) return;

    setError(null);
    setSaving(true);
    try {
      // Filter out '__ALL__' and get actual IDs
      const paygroupIds = selectedPaygroups.filter((pg) => pg.id !== '__ALL__').map((pg) => pg.id);
      const departmentIds = selectedDepartments.filter((dept) => dept.id !== '__ALL__').map((dept) => dept.id);
      
      const payload = {
        organizationId,
        displayName,
        associateId: selectedAssociate?.id,
        paygroupIds: paygroupIds.length > 0 ? paygroupIds : undefined,
        departmentIds: departmentIds.length > 0 ? departmentIds : undefined,
        remarks: remarks || undefined,
        maxEncashmentDays,
        isEncashmentApplicable,
        maxCarryForwardDays,
        isCarryForwardApplicable,
        eventType,
      };
      
      if (isEdit && id) {
        await encashmentCarryForwardService.update(id, payload);
      } else {
        await encashmentCarryForwardService.create(payload);
      }
      navigate('/event-configuration/encashment-carry-forward');
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

  // MultiSelectChips component
  const MultiSelectChips = ({
    selected,
    onRemove,
    onToggle,
    options,
    placeholder,
    showDropdown,
    onToggleDropdown,
    dropdownRef,
  }: {
    selected: Option[];
    onRemove: (item: Option) => void;
    onToggle: (item: Option) => void;
    options: Option[];
    placeholder: string;
    showDropdown: boolean;
    onToggleDropdown: () => void;
    dropdownRef: React.RefObject<HTMLDivElement>;
  }) => {
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
              key={item.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded-lg text-sm"
            >
              {item.name}
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
          {selected.length === 0 && (
            <span className="text-gray-400 text-sm flex-1">{placeholder}</span>
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
                  const isSelected = selected.some((s) => s.id === item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onToggle(item);
                        if (item.id === '__ALL__') {
                          onToggleDropdown();
                        }
                      }}
                      className={`w-full text-left px-4 py-2 text-sm cursor-pointer hover:bg-gray-100 ${
                        isSelected ? 'bg-blue-50' : ''
                      }`}
                    >
                      {item.name}
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

  // ToggleSwitch component
  const ToggleSwitch = ({
    value,
    onChange,
  }: {
    value: boolean;
    onChange: (value: boolean) => void;
  }) => (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-7 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
          value ? 'bg-green-500' : 'bg-red-500'
        }`}
        role="switch"
        aria-checked={value}
      >
        <span
          className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition ${
            value ? 'translate-x-7' : 'translate-x-0'
          }`}
        >
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="text-[8px] font-bold text-gray-600">III</span>
          </span>
        </span>
      </button>
      <span className={`text-sm font-semibold w-10 text-center ${value ? 'text-green-600' : 'text-red-600'}`}>
        {value ? 'YES' : 'NO'}
      </span>
    </div>
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader
        title="Event Configuration"
        subtitle={organizationName ? organizationName : undefined}
        onLogout={handleLogout}
      />

      <main className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-6 bg-gray-50">
        <div className="w-full max-w-[1600px] mx-auto">
          {/* Breadcrumbs */}
          <nav className="flex text-sm text-gray-600 mb-4" aria-label="Breadcrumb">
            <Link to="/dashboard" className="hover:text-gray-900">Home</Link>
            <span className="mx-2">/</span>
            <Link to="/event-configuration" className="hover:text-gray-900">Event Configuration</Link>
            <span className="mx-2">/</span>
            <Link to="/event-configuration/encashment-carry-forward" className="hover:text-gray-900">Encashment/Carry Forward</Link>
            <span className="mx-2">/</span>
            <span className="text-gray-900 font-medium">{isEdit ? 'Edit' : 'Add'}</span>
          </nav>

          {/* Form */}
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="bg-white px-6 py-4 border-b border-gray-200">
              <h1 className="text-lg font-semibold text-black">Encashment/Carry Forward</h1>
            </div>
            <div className="p-6 !bg-white">
              {loading ? (
                <div className="py-8 text-center text-gray-500">Loading...</div>
              ) : (
                <form onSubmit={handleSave} className="space-y-4">
                  <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
                    {/* Display Name - Input field */}
                    <div className="flex items-baseline gap-2">
                      <label className="w-36 shrink-0 text-sm font-medium text-gray-700 after:content-[':']">
                        Display Name
                      </label>
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="flex-1 rounded border border-gray-300 !bg-white px-3 py-2 text-sm text-black placeholder:text-black placeholder:opacity-80"
                        placeholder="Select Display Name"
                      />
                    </div>

                    {/* Associate - Searchable dropdown */}
                    <div className="flex items-baseline gap-2">
                      <label className="w-36 shrink-0 text-sm font-medium text-gray-700 after:content-[':']">
                        Associate
                      </label>
                      <div className="flex-1 relative" ref={associateDropdownRef}>
                        <input
                          type="text"
                          value={associateSearch}
                          onChange={(e) => {
                            setAssociateSearch(e.target.value);
                            setShowAssociateDropdown(true);
                            if (!e.target.value) {
                              setSelectedAssociate(null);
                            }
                          }}
                          onFocus={() => {
                            setShowAssociateDropdown(true);
                          }}
                          onClick={() => {
                            setShowAssociateDropdown(true);
                          }}
                          placeholder="Search and add associates..."
                          className="w-full rounded border border-gray-300 !bg-white px-3 py-2 text-sm text-black placeholder:text-black placeholder:opacity-80 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        {showAssociateDropdown && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setShowAssociateDropdown(false)} aria-hidden="true" />
                            {filteredEmployees.length > 0 ? (
                              <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                {filteredEmployees.map((emp) => (
                                  <button
                                    key={emp.id}
                                    type="button"
                                    onClick={() => handleAssociateSelect(emp)}
                                    className="w-full text-left px-3 py-2 text-sm text-gray-900 hover:bg-gray-100"
                                  >
                                    {fullName(emp)} [{emp.employeeCode ?? emp.id}]
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
                                <div className="px-3 py-2 text-sm text-gray-500">No matches</div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Paygroup */}
                    <div className="flex items-baseline gap-2">
                      <label className="w-36 shrink-0 text-sm font-medium text-gray-700 after:content-[':']">
                        Paygroup
                      </label>
                      <div className="flex-1">
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
                              const withoutAll = selectedPaygroups.filter((p) => p.id !== '__ALL__');
                              const exists = withoutAll.some((p) => p.id === pg.id);
                              if (exists) {
                                setSelectedPaygroups(withoutAll.filter((p) => p.id !== pg.id));
                              } else {
                                setSelectedPaygroups([...withoutAll, pg]);
                              }
                            }
                          }}
                          options={[{ id: '__ALL__', name: 'All' }, ...paygroups]}
                          placeholder="Paygroup"
                          showDropdown={showPaygroupDropdown}
                          onToggleDropdown={() => setShowPaygroupDropdown(!showPaygroupDropdown)}
                          dropdownRef={paygroupDropdownRef}
                        />
                      </div>
                    </div>

                    {/* Department */}
                    <div className="flex items-baseline gap-2">
                      <label className="w-36 shrink-0 text-sm font-medium text-gray-700 after:content-[':']">
                        Department
                      </label>
                      <div className="flex-1">
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
                              const withoutAll = selectedDepartments.filter((d) => d.id !== '__ALL__');
                              const exists = withoutAll.some((d) => d.id === dept.id);
                              if (exists) {
                                setSelectedDepartments(withoutAll.filter((d) => d.id !== dept.id));
                              } else {
                                setSelectedDepartments([...withoutAll, dept]);
                              }
                            }
                          }}
                          options={[{ id: '__ALL__', name: 'All' }, ...departments]}
                          placeholder="Department"
                          showDropdown={showDepartmentDropdown}
                          onToggleDropdown={() => setShowDepartmentDropdown(!showDepartmentDropdown)}
                          dropdownRef={departmentDropdownRef}
                        />
                      </div>
                    </div>

                    {/* Remarks */}
                    <div className="sm:col-span-2 flex items-start gap-2">
                      <label className="w-36 shrink-0 pt-2 text-sm font-medium text-gray-700 after:content-[':']">
                        Remarks
                      </label>
                      <textarea
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        rows={3}
                        className="flex-1 rounded border border-gray-300 !bg-white px-3 py-2 text-sm text-black placeholder:text-black placeholder:opacity-80 resize-y"
                        placeholder="Remarks"
                      />
                    </div>
                  </div>

                  {/* Event Rule Definition Section */}
                  <div className="mt-6 border-t border-gray-200 pt-6">
                    <h3 className="text-base font-semibold text-blue-600 underline mb-4">Event Rule Definition</h3>
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
                            <tr className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm text-gray-700">Is carry forward is applicable</td>
                              <td className="px-4 py-3">
                                <ToggleSwitch
                                  value={isCarryForwardApplicable}
                                  onChange={setIsCarryForwardApplicable}
                                />
                              </td>
                            </tr>
                            <tr className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm text-gray-700">Maximum no of day(s) allowed for encashment</td>
                              <td className="px-4 py-3">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={maxEncashmentDays === 0 ? '' : String(maxEncashmentDays)}
                                  onChange={(e) => {
                                    const inputValue = e.target.value.trim();
                                    // Allow empty input
                                    if (inputValue === '') {
                                      setMaxEncashmentDays(0);
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
                                      setMaxEncashmentDays(numValue);
                                    }
                                  }}
                                  onBlur={(e) => {
                                    // Ensure value is a valid number on blur
                                    const inputValue = e.target.value.trim();
                                    const numValue = inputValue === '' ? 0 : Number(inputValue) || 0;
                                    setMaxEncashmentDays(numValue);
                                  }}
                                  className="w-20 rounded border border-gray-300 !bg-white px-3 py-2 text-sm text-black placeholder:text-black placeholder:opacity-80"
                                  placeholder="0"
                                />
                              </td>
                            </tr>
                            <tr className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm text-gray-700">Is encashment is applicable</td>
                              <td className="px-4 py-3">
                                <ToggleSwitch
                                  value={isEncashmentApplicable}
                                  onChange={setIsEncashmentApplicable}
                                />
                              </td>
                            </tr>
                            <tr className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm text-gray-700">Maximum no of day(s) to be carry forward</td>
                              <td className="px-4 py-3">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={maxCarryForwardDays === 0 ? '' : String(maxCarryForwardDays)}
                                  onChange={(e) => {
                                    const inputValue = e.target.value.trim();
                                    // Allow empty input
                                    if (inputValue === '') {
                                      setMaxCarryForwardDays(0);
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
                                      setMaxCarryForwardDays(numValue);
                                    }
                                  }}
                                  onBlur={(e) => {
                                    // Ensure value is a valid number on blur
                                    const inputValue = e.target.value.trim();
                                    const numValue = inputValue === '' ? 0 : Number(inputValue) || 0;
                                    setMaxCarryForwardDays(numValue);
                                  }}
                                  className="w-20 rounded border border-gray-300 !bg-white px-3 py-2 text-sm text-black placeholder:text-black placeholder:opacity-80"
                                  placeholder="60"
                                />
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {error}
                    </div>
                  )}

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
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
