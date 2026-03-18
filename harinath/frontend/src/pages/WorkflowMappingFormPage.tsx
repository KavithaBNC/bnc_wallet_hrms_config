import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';
import paygroupService from '../services/paygroup.service';
import departmentService from '../services/department.service';
import employeeService, { Employee } from '../services/employee.service';
import rightsAllocationService from '../services/rightsAllocation.service';
import configService, { type ApprovalLevelOption } from '../services/config.service';
import workflowMappingService, { ApprovalLevel } from '../services/workflowMapping.service';

function fullName(e: Employee): string {
  const parts = [e.firstName, e.middleName, e.lastName].filter(Boolean);
  return parts.join(' ').trim() || e.employeeCode || '';
}

interface Option {
  id: string;
  name: string;
}

interface ApprovalLevelRow {
  id: string;
  level: number;
  levelName: string;
  associate: string;
  hierarchy: string;
  paygroup: string;
  department: string;
  approvalLevel: string;
}

export default function WorkflowMappingFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const { user, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;
  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id;

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInfoBanner, setShowInfoBanner] = useState(true);

  // Form fields
  const [displayName, setDisplayName] = useState('');
  const [selectedAssociates, setSelectedAssociates] = useState<Option[]>([]);
  const [selectedPaygroups, setSelectedPaygroups] = useState<Option[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<Option[]>([]);
  const [priority, setPriority] = useState('');
  const [remarks, setRemarks] = useState('');
  const [entryRightsTemplate, setEntryRightsTemplate] = useState('');

  // Approval Levels
  const [approvalLevels, setApprovalLevels] = useState<ApprovalLevelRow[]>([]);
  const [nextLevelId, setNextLevelId] = useState(1);

  // Dropdowns
  const [paygroups, setPaygroups] = useState<Option[]>([]);
  const [departments, setDepartments] = useState<Option[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [entryRightsTemplates, setEntryRightsTemplates] = useState<Option[]>([]);
  
  // Approval Level dropdown options (dynamic from backend, with workflowType for Leave)
  const [hierarchies, setHierarchies] = useState<Option[]>([]);
  const [approvalLevelOptions, setApprovalLevelOptions] = useState<ApprovalLevelOption[]>([]);

  // Dropdown states
  const [showPaygroupDropdown, setShowPaygroupDropdown] = useState(false);
  const [showDepartmentDropdown, setShowDepartmentDropdown] = useState(false);
  const [showAssociateDropdown, setShowAssociateDropdown] = useState(false);
  const [, setShowEntryRightsDropdown] = useState(false);

  // Refs for dropdowns
  const paygroupDropdownRef = useRef<HTMLDivElement>(null);
  const departmentDropdownRef = useRef<HTMLDivElement>(null);
  const associateDropdownRef = useRef<HTMLDivElement>(null);
  const entryRightsDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (paygroupDropdownRef.current && !paygroupDropdownRef.current.contains(event.target as Node)) {
        setShowPaygroupDropdown(false);
      }
      if (departmentDropdownRef.current && !departmentDropdownRef.current.contains(event.target as Node)) {
        setShowDepartmentDropdown(false);
      }
      if (associateDropdownRef.current && !associateDropdownRef.current.contains(event.target as Node)) {
        setShowAssociateDropdown(false);
      }
      if (entryRightsDropdownRef.current && !entryRightsDropdownRef.current.contains(event.target as Node)) {
        setShowEntryRightsDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Approval-level Associate options: employees only (EmployeeCode - Full Name)
  const approvalLevelAssociateOptions: Option[] = employees.map((e) => ({
    id: e.id,
    name: `${e.employeeCode || e.id} - ${fullName(e)}`,
  }));

  // Fetch dropdown options
  useEffect(() => {
    if (!organizationId) return;
    Promise.all([
      paygroupService.getAll({ organizationId }),
      departmentService.getAll({ organizationId, limit: 500 }),
      employeeService.getAll({ organizationId, page: 1, limit: 500, employeeStatus: 'ACTIVE' }),
      rightsAllocationService.getAll({ organizationId, page: 1, limit: 500 }),
      configService.getWorkflowApprovalOptions({ organizationId, forLeave: true }),
    ]).then(([pgList, deptRes, empRes, rightsRes, configOptions]) => {
      setPaygroups((pgList || []).map((p) => ({ id: p.id, name: p.name })));
      setDepartments((deptRes?.departments || []).map((d) => ({ id: d.id, name: d.name })));
      setEmployees(empRes?.employees || []);
      setEntryRightsTemplates(
        (rightsRes?.items || []).map((r) => ({
          id: r.id,
          name: r.shortName || r.longName || r.id,
        }))
      );
      setHierarchies(configOptions?.hierarchyTypes || []);
      setApprovalLevelOptions(configOptions?.approvalLevelTypes || []);
    }).catch(() => {});
  }, [organizationId]);

  // Associate options for ChipSelect: All + employees
  const associateOptions: Option[] = [
    { id: '__ALL__', name: 'All' },
    ...employees.map((e) => ({ id: e.id, name: `${e.employeeCode || e.id} - ${fullName(e)}` })),
  ];

  // Load data in edit mode
  useEffect(() => {
    if (!isEdit || !id || !organizationId) return;
    setLoading(true);
    setError(null);
    Promise.all([
      workflowMappingService.getById(id),
      rightsAllocationService.getAll({ organizationId, page: 1, limit: 500 }),
      employeeService.getAll({ organizationId, page: 1, limit: 500, employeeStatus: 'ACTIVE' }),
    ])
      .then(([data, rightsRes, empRes]) => {
        setDisplayName(data.displayName);
        const empList = empRes?.employees || [];
        if (data.associateIds && Array.isArray(data.associateIds) && data.associateIds.length > 0) {
          const ids = data.associateIds as string[];
          const selected = ids
            .map((empId) => empList.find((e) => e.id === empId))
            .filter(Boolean)
            .map((e) => ({ id: e!.id, name: `${e!.employeeCode || e!.id} - ${fullName(e!)}` }));
          setSelectedAssociates(selected);
        } else if (data.associate) {
          const emp = empList.find((e) => e.employeeCode === data.associate || e.id === data.associate);
          setSelectedAssociates(emp ? [{ id: emp.id, name: `${emp.employeeCode || emp.id} - ${fullName(emp)}` }] : []);
        } else {
          setSelectedAssociates([]);
        }
        const rightsList = rightsRes?.items || [];
        if (data.entryRightsTemplate) {
          const byId = rightsList.find((r) => r.id === data.entryRightsTemplate);
          const byName = rightsList.find(
            (r) =>
              r.shortName === data.entryRightsTemplate || r.longName === data.entryRightsTemplate
          );
          setEntryRightsTemplate(byId?.id ?? byName?.id ?? data.entryRightsTemplate);
        } else {
          setEntryRightsTemplate('');
        }
        paygroupService.getAll({ organizationId }).then((pgList) => {
          if (data.paygroupIds && Array.isArray(data.paygroupIds) && data.paygroupIds.length > 0) {
            const selected = data.paygroupIds
              .map((pgId) => pgList.find((p) => p.id === pgId))
              .filter(Boolean)
              .map((p) => ({ id: p!.id, name: p!.name }));
            setSelectedPaygroups(selected.length > 0 ? selected : []);
          } else if (data.paygroupId) {
            const pg = pgList.find((p) => p.id === data.paygroupId);
            if (pg) setSelectedPaygroups([{ id: pg.id, name: pg.name }]);
            else setSelectedPaygroups([]);
          } else {
            setSelectedPaygroups([]);
          }
        });
        departmentService.getAll({ organizationId, limit: 500 }).then((deptRes) => {
          const deptList = deptRes.departments || [];
          if (data.departmentIds && Array.isArray(data.departmentIds) && data.departmentIds.length > 0) {
            const selected = data.departmentIds
              .map((deptId) => deptList.find((d) => d.id === deptId))
              .filter(Boolean)
              .map((d) => ({ id: d!.id, name: d!.name }));
            setSelectedDepartments(selected.length > 0 ? selected : []);
          } else if (data.departmentId) {
            const dept = deptList.find((d) => d.id === data.departmentId);
            if (dept) setSelectedDepartments([{ id: dept.id, name: dept.name }]);
            else setSelectedDepartments([]);
          } else {
            setSelectedDepartments([]);
          }
        });
        setPriority(data.priority ? String(data.priority) : '');
        setRemarks(data.remarks || '');
        if (data.approvalLevels && Array.isArray(data.approvalLevels)) {
          const seen = new Set<string>();
          const levels = (data.approvalLevels as ApprovalLevel[]).map((lev, idx) => {
            let id = lev.id && typeof lev.id === 'string' ? lev.id : null;
            if (!id || seen.has(id)) {
              id = `level-${Date.now()}-${idx}`;
            }
            seen.add(id);
            return {
              ...lev,
              id,
              level: lev.level ?? idx + 1,
              levelName: lev.levelName ?? String(idx + 1),
            };
          });
          setApprovalLevels(levels);
          setNextLevelId((prev) => Math.max(prev, levels.length + 1));
        }
        setLoading(false);
      })
      .catch((err) => {
        const msg =
          err && typeof err === 'object' && 'response' in err
            ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
            : 'Failed to load workflow mapping';
        setError(String(msg || 'Failed to load workflow mapping'));
        setLoading(false);
      });
  }, [id, organizationId, isEdit]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleCancel = () => navigate('/event-configuration/workflow-mapping');

  // Approval Levels handlers
  const handleAddApprovalLevel = () => {
    const newLevel: ApprovalLevelRow = {
      id: `level-${nextLevelId}`,
      level: approvalLevels.length + 1,
      levelName: String(approvalLevels.length + 1),
      associate: '',
      hierarchy: '',
      paygroup: '',
      department: '',
      approvalLevel: '',
    };
    setApprovalLevels([...approvalLevels, newLevel]);
    setNextLevelId(nextLevelId + 1);
  };

  const handleRemoveApprovalLevel = (id: string) => {
    const updated = approvalLevels.filter((level) => level.id !== id);
    // Re-number levels
    const renumbered = updated.map((level, index) => ({
      ...level,
      level: index + 1,
      levelName: String(index + 1),
    }));
    setApprovalLevels(renumbered);
  };

  const handleUpdateApprovalLevel = (id: string, field: keyof ApprovalLevelRow, value: string) => {
    setApprovalLevels((prev) => {
      const next = prev.map((level) => {
        if (level.id !== id) return level;
        const updated = { ...level, [field]: value };
        if (field === 'hierarchy' && value) {
          const match =
            value === 'reporting_manager'
              ? approvalLevelOptions.find((o) => o.workflowType === 'Manager')
              : value === 'hr_manager'
                ? approvalLevelOptions.find((o) => o.workflowType === 'HR')
                : undefined;
          if (match) updated.approvalLevel = match.id;
        }
        return updated;
      });
      return next;
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId) return;

    if (!displayName.trim()) {
      setError('Display Name is required');
      return;
    }
    if (!entryRightsTemplate) {
      setError('Entry Rights Template is required');
      return;
    }

    setError(null);
    setSaving(true);
    try {
      const hasAllAssociate = selectedAssociates.some((a) => a.id === '__ALL__');
      const hasAllPaygroup = selectedPaygroups.some((p) => p.id === '__ALL__');
      const hasAllDept = selectedDepartments.some((d) => d.id === '__ALL__');
      const associateIds =
        hasAllAssociate || selectedAssociates.length === 0
          ? null
          : selectedAssociates.map((a) => a.id).filter((id) => id !== '__ALL__');
      const paygroupIds =
        hasAllPaygroup || selectedPaygroups.length === 0
          ? null
          : selectedPaygroups.map((p) => p.id).filter((id) => id !== '__ALL__');
      const departmentIds =
        hasAllDept || selectedDepartments.length === 0
          ? null
          : selectedDepartments.map((d) => d.id).filter((id) => id !== '__ALL__');
      const invalidLevel = approvalLevels.find(
        (l) => l.approvalLevel && !approvalLevelOptions.some((o) => o.id === l.approvalLevel || o.name === l.approvalLevel)
      );
      if (invalidLevel) {
        setError('Employee Approval is not allowed for Leave workflows. Please select Manager, HR, Org Admin, or Super Admin Approval for all levels.');
        setSaving(false);
        return;
      }

      const payload = {
        organizationId,
        displayName: displayName.trim(),
        associateIds,
        paygroupIds,
        departmentIds,
        priority: priority.trim() ? Number(priority) : undefined,
        remarks: remarks.trim() || undefined,
        entryRightsTemplate: entryRightsTemplate || undefined,
        approvalLevels: approvalLevels.length > 0 ? approvalLevels : undefined,
      };
      if (isEdit && id) {
        await workflowMappingService.update(id, payload);
      } else {
        await workflowMappingService.create(payload);
      }
      navigate('/event-configuration/workflow-mapping');
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

  if (loading) {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
        <AppHeader
          title="Event Configuration"
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
      <AppHeader
        title="Event Configuration"
        subtitle={organizationName ? organizationName : undefined}
        onLogout={handleLogout}
      />

      <main className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-6 bg-gray-50">
        <div className="w-full max-w-[1600px] mx-auto">
          {/* Breadcrumbs - matching image style */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
            <nav className="flex items-center gap-1.5 text-sm text-gray-500" aria-label="Breadcrumb">
              <Link to="/dashboard" className="text-gray-500 hover:text-gray-900">
                <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </Link>
              <Link to="/dashboard" className="text-gray-500 hover:text-gray-900">Home</Link>
              <span className="mx-1 text-gray-400">/</span>
              <Link to="/attendance" className="text-gray-500 hover:text-gray-900">Attendance</Link>
              <span className="mx-1 text-gray-400">/</span>
              <Link to="/event-configuration" className="text-gray-500 hover:text-gray-900">Event Configuration</Link>
              <span className="mx-1 text-gray-400">/</span>
              <Link to="/event-configuration/workflow-mapping" className="text-gray-500 hover:text-gray-900">Workflow Mapping</Link>
            </nav>
          </div>

          {/* Page Title */}
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Workflow Mapping</h1>

          {/* Info Banner */}
          {showInfoBanner && (
            <div className="relative bg-blue-50 border-t-2 border-b-2 border-blue-200 px-4 py-3 mb-6 rounded">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-700">
                  Any changes in the WorkFlow will be applied to new request only. Workflow for existing request will not be affected.
                </p>
                <button
                  type="button"
                  onClick={() => setShowInfoBanner(false)}
                  className="ml-4 text-gray-400 hover:text-gray-600"
                  aria-label="Close"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Form */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <form onSubmit={handleSave} className="space-y-0">
              {error && (
                <div className="p-4 bg-red-50 border-b border-red-200 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Form Fields - matching image style: label on left, input on right, separated by colon and horizontal line */}
              <div className="divide-y divide-gray-200">
                {/* Display Name */}
                <div className="flex items-center gap-4 px-6 py-4">
                  <label className="w-48 shrink-0 text-sm font-medium text-gray-700">
                    Display Name <span className="text-red-500">*</span>
                  </label>
                  <span className="text-gray-700">:</span>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="flex-1 border-0 border-b border-gray-300 bg-transparent px-0 py-1 text-sm text-gray-900 focus:ring-0 focus:border-blue-500 focus:outline-none"
                    placeholder="Employee"
                  />
                </div>

                {/* Associate */}
                <div className="flex items-center gap-4 px-6 py-4">
                  <label className="w-48 shrink-0 text-sm font-medium text-gray-700">
                    Associate
                  </label>
                  <span className="text-gray-700">:</span>
                  <div className="flex-1">
                    <MultiSelectChips
                      selected={selectedAssociates}
                      onRemove={(a) => {
                        if (a.id === '__ALL__') setSelectedAssociates([]);
                        else setSelectedAssociates(selectedAssociates.filter((x) => x.id !== a.id));
                      }}
                      onToggle={(a) => {
                        if (a.id === '__ALL__') {
                          setSelectedAssociates([{ id: '__ALL__', name: 'All' }]);
                        } else {
                          const withoutAll = selectedAssociates.filter((x) => x.id !== '__ALL__');
                          const exists = withoutAll.some((x) => x.id === a.id);
                          if (exists) {
                            setSelectedAssociates(withoutAll.filter((x) => x.id !== a.id));
                          } else {
                            setSelectedAssociates([...withoutAll, a]);
                          }
                        }
                      }}
                      options={associateOptions}
                      placeholder="Select Associate"
                      showDropdown={showAssociateDropdown}
                      onToggleDropdown={() => setShowAssociateDropdown(!showAssociateDropdown)}
                      dropdownRef={associateDropdownRef}
                    />
                  </div>
                </div>

                {/* Paygroup */}
                <div className="flex items-center gap-4 px-6 py-4">
                  <label className="w-48 shrink-0 text-sm font-medium text-gray-700">
                    Paygroup
                  </label>
                  <span className="text-gray-700">:</span>
                  <div className="flex-1">
                    <MultiSelectChips
                      selected={selectedPaygroups}
                      onRemove={(pg) => {
                        if (pg.id === '__ALL__') setSelectedPaygroups([]);
                        else setSelectedPaygroups(selectedPaygroups.filter((p) => p.id !== pg.id));
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
                      placeholder="Select Paygroup"
                      showDropdown={showPaygroupDropdown}
                      onToggleDropdown={() => setShowPaygroupDropdown(!showPaygroupDropdown)}
                      dropdownRef={paygroupDropdownRef}
                    />
                  </div>
                </div>

                {/* Department */}
                <div className="flex items-center gap-4 px-6 py-4">
                  <label className="w-48 shrink-0 text-sm font-medium text-gray-700">
                    Department
                  </label>
                  <span className="text-gray-700">:</span>
                  <div className="flex-1">
                    <MultiSelectChips
                      selected={selectedDepartments}
                      onRemove={(dept) => {
                        if (dept.id === '__ALL__') setSelectedDepartments([]);
                        else setSelectedDepartments(selectedDepartments.filter((d) => d.id !== dept.id));
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
                      placeholder="Select Department"
                      showDropdown={showDepartmentDropdown}
                      onToggleDropdown={() => setShowDepartmentDropdown(!showDepartmentDropdown)}
                      dropdownRef={departmentDropdownRef}
                    />
                  </div>
                </div>

                {/* Priority */}
                <div className="flex items-center gap-4 px-6 py-4">
                  <label className="w-48 shrink-0 text-sm font-medium text-gray-700">
                    Priority
                  </label>
                  <span className="text-gray-700">:</span>
                  <input
                    type="text"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="flex-1 border-0 border-b border-gray-300 bg-transparent px-0 py-1 text-sm text-gray-900 focus:ring-0 focus:border-blue-500 focus:outline-none"
                    placeholder="100000"
                  />
                </div>

                {/* Remarks */}
                <div className="flex items-start gap-4 px-6 py-4">
                  <label className="w-48 shrink-0 pt-2 text-sm font-medium text-gray-700">
                    Remarks
                  </label>
                  <span className="text-gray-700 pt-2">:</span>
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    rows={3}
                    className="flex-1 border-0 border-b border-gray-300 bg-transparent px-0 py-1 text-sm text-gray-900 resize-y focus:ring-0 focus:border-blue-500 focus:outline-none"
                    placeholder="Remarks"
                  />
                </div>

                {/* Entry Rights Template */}
                <div className="flex items-center gap-4 px-6 py-4">
                  <label className="w-48 shrink-0 text-sm font-medium text-gray-700">
                    Entry Rights Template <span className="text-red-500">*</span>
                  </label>
                  <span className="text-gray-700">:</span>
                  <div className="relative flex-1">
                    <select
                      value={entryRightsTemplate}
                      onChange={(e) => setEntryRightsTemplate(e.target.value)}
                      className="w-full border-0 border-b border-gray-300 bg-transparent px-0 py-1 pr-6 text-sm text-gray-900 focus:ring-0 focus:border-blue-500 focus:outline-none appearance-none"
                    >
                      <option value="">
                        {entryRightsTemplates.length === 0
                          ? 'No Rights Allocations found - create one first'
                          : 'Select Entry Rights Template'}
                      </option>
                      {entryRightsTemplates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-0 top-1/2 transform -translate-y-1/2 pointer-events-none">
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Approval Levels Section */}
              <div className="px-6 py-4 border-t border-gray-200">
                {approvalLevelOptions.length === 0 && (
                  <div className="mb-4 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                    No approval workflows found for Leave. Create Manager, HR, Org Admin, or Super Admin workflows in{' '}
                    <Link to="/event-configuration/approval-workflow" className="font-medium underline hover:text-amber-900">
                      Event Configuration → Approval Workflow
                    </Link>{' '}
                    first. (Employee Approval is not allowed for Leave.)
                  </div>
                )}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-blue-600 border-b-2 border-blue-600 pb-1">
                    Approval Levels
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddApprovalLevel}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-blue-300 bg-white text-blue-600 text-sm font-medium hover:bg-blue-50 transition"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add
                  </button>
                </div>

                {approvalLevels.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    No approval levels added. Click &quot;Add&quot; to create one.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-blue-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Level
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Level Name
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Associate
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Hierarchy
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Paygroup
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Department
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Approval Level
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {approvalLevels.map((level) => (
                          <tr key={level.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-medium">
                                {level.level}
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <input
                                type="text"
                                value={level.levelName}
                                onChange={(e) => handleUpdateApprovalLevel(level.id, 'levelName', e.target.value)}
                                className="w-full border-0 border-b border-gray-300 bg-transparent px-0 py-1 text-sm text-gray-900 focus:ring-0 focus:border-blue-500 focus:outline-none"
                              />
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <select
                                value={level.associate}
                                onChange={(e) => handleUpdateApprovalLevel(level.id, 'associate', e.target.value)}
                                className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              >
                                <option value="">Select Associate</option>
                                {approvalLevelAssociateOptions.map((assoc) => (
                                  <option key={assoc.id} value={assoc.id}>
                                    {assoc.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <select
                                value={hierarchies.find((h) => h.id === level.hierarchy || h.name === level.hierarchy)?.id ?? level.hierarchy ?? ''}
                                onChange={(e) => handleUpdateApprovalLevel(level.id, 'hierarchy', e.target.value)}
                                className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              >
                                <option value="">Select Hierarchy</option>
                                {hierarchies.map((h) => (
                                  <option key={h.id} value={h.id}>
                                    {h.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <select
                                value={level.paygroup}
                                onChange={(e) => handleUpdateApprovalLevel(level.id, 'paygroup', e.target.value)}
                                className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              >
                                <option value="">Attribute</option>
                                {paygroups.map((pg) => (
                                  <option key={pg.id} value={pg.id}>
                                    {pg.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <select
                                value={level.department}
                                onChange={(e) => handleUpdateApprovalLevel(level.id, 'department', e.target.value)}
                                className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              >
                                <option value="">Attribute</option>
                                {departments.map((dept) => (
                                  <option key={dept.id} value={dept.id}>
                                    {dept.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <select
                                value={approvalLevelOptions.find((o) => o.id === level.approvalLevel || o.name === level.approvalLevel)?.id ?? level.approvalLevel ?? ''}
                                onChange={(e) => handleUpdateApprovalLevel(level.id, 'approvalLevel', e.target.value)}
                                className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              >
                                <option value="">Select Approval Level</option>
                                {approvalLevelOptions.map((opt) => (
                                  <option key={opt.id} value={opt.id}>
                                    {opt.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveApprovalLevel(level.id)}
                                className="inline-flex items-center justify-center w-8 h-8 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition"
                                title="Delete"
                              >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
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
