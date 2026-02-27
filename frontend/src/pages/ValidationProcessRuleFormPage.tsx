import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';
import employeeService, { type Employee } from '../services/employee.service';
import shiftService from '../services/shift.service';
import paygroupService from '../services/paygroup.service';
import departmentService from '../services/department.service';
import attendanceComponentService from '../services/attendanceComponent.service';
import validationProcessRuleService from '../services/validationProcessRule.service';

function fullName(e: Employee): string {
  const parts = [e.firstName, e.middleName, e.lastName].filter(Boolean);
  return parts.join(' ').trim() || e.employeeCode || '';
}

interface Option {
  id: string;
  name: string;
}

const VALIDATION_PERIODICITY_OPTIONS = ['Daily', 'Weekly', 'Monthly'] as const;
const DEDUCT_PRIORITY_OPTIONS = ['Action0', 'Action1', 'Action2'] as const;

interface ValidationProcessRuleFormState {
  displayName: string;
  effectiveDate: string;
  priority: string;
  remarks: string;
  autoCorrect: boolean;
  correctAfterDays: string;
  primaryAction: boolean;
  hasLimit: boolean;
}

interface ValidationRuleLimitRow {
  id: string;
  periodicity: (typeof VALIDATION_PERIODICITY_OPTIONS)[number];
  maxMinutes: string;
  count: string;
  applyAfterEveryCount: boolean;
  deductPriority: string;
}

const initialFormState = (): ValidationProcessRuleFormState => {
  const d = new Date();
  const today = d.toISOString().slice(0, 10);
  return {
    displayName: '',
    effectiveDate: today,
    priority: '',
    remarks: '',
    autoCorrect: false,
    correctAfterDays: '',
    primaryAction: false,
    hasLimit: false,
  };
};

const Toggle = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) => (
  <div className="flex items-center justify-between gap-4">
    <span className="text-sm text-gray-700">{label}</span>
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium border transition ${
        value
          ? 'bg-green-100 text-green-800 border-green-300'
          : 'bg-red-100 text-red-800 border-red-300'
      }`}
    >
      <span
        className={`inline-flex h-4 w-7 items-center rounded-full bg-white shadow-inner mr-1 ${
          value ? 'justify-end' : 'justify-start'
        }`}
      >
        <span
          className={`h-3 w-3 rounded-full ${
            value ? 'bg-green-500' : 'bg-red-500'
          }`}
        />
      </span>
      {value ? 'YES' : 'NO'}
    </button>
  </div>
);

/** Pill-style toggle for Action block - displays value in colored oval (red/green) */
const PillToggle = ({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { id: string; label: string; isGreen?: boolean }[];
  onChange: (next: string) => void;
}) => {
  const idx = options.findIndex((o) => o.id === value);
  const current = idx >= 0 ? options[idx] : options[0];
  const nextOpt = options[(idx + 1) % options.length];
  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label className="block text-xs font-medium text-gray-600">{label}</label>
      ) : null}
      <button
        type="button"
        onClick={() => onChange(nextOpt.id)}
        className={`inline-flex items-center justify-center rounded-full px-3 py-1.5 text-xs font-medium w-fit transition ${
          current.isGreen ? 'bg-green-100 text-green-800 border border-green-300' : 'bg-red-100 text-red-800 border border-red-300'
        }`}
      >
        {current.label}
      </button>
    </div>
  );
};

/** Select with clear (x) and chevron - for Correction Method, Event Type */
const SelectWithChevron = ({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { id: string; name: string }[];
  onChange: (next: string) => void;
}) => (
  <div className="flex flex-col gap-1.5">
    <label className="block text-xs font-medium text-gray-600">{label}</label>
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 pr-8 pl-3 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
      <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </span>
    </div>
  </div>
);

const CONDITION_OPTIONS = [{ id: 'ALL', label: 'ALL', isGreen: false }, { id: 'Selected', label: 'Selected', isGreen: true }];
const AUTO_APPLY_OPTIONS = [{ id: 'NO', label: 'NO', isGreen: false }, { id: 'YES', label: 'YES', isGreen: true }];
const DAY_TYPE_OPTIONS = [{ id: 'Auto', label: 'Auto', isGreen: true }, { id: 'Manual', label: 'Manual', isGreen: false }];
const DAYS_OPTIONS = [{ id: 'Auto', label: 'Auto', isGreen: true }, { id: 'Manual', label: 'Manual', isGreen: false }];
const CORRECTION_METHOD_OPTIONS = [
  { id: 'Apply Event', name: 'Apply Event' },
  { id: 'Permission', name: 'Permission' },
  { id: 'No Correction', name: 'No Correction' },
  { id: 'Auto', name: 'Auto' },
  { id: 'Leave', name: 'Leave' },
  { id: 'LOP', name: 'LOP' },
  { id: 'CompOff', name: 'CompOff' },
];

interface ActionBlockData {
  id: string;
  name: string;
  collapsed: boolean;
  condition: string;
  correctionMethod: string;
  eventType: string;
  autoApply: string;
  dayType: string;
  days: string;
  daysValue: string;
  minMinutes: string;
  maxMinutes: string;
}

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
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(opt.id);
            }}
            className="ml-0.5 text-blue-600 hover:text-blue-900"
          >
            ×
          </button>
        </span>
      ))}
      {selected.length === 0 && (
        <span className="text-gray-400 text-sm">{placeholder}</span>
      )}
    </div>
    {showDropdown && (
      <>
        <div
          className="fixed inset-0 z-10"
          onClick={() => setShowDropdown(false)}
          aria-hidden="true"
        />
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
          {options.length === 0 && (
            <div className="px-3 py-2 text-sm text-gray-500">No options</div>
          )}
        </div>
      </>
    )}
  </div>
);

export default function ValidationProcessRuleFormPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const isHrActivities = location.pathname.startsWith('/hr-activities');
  const basePath = isHrActivities ? '/hr-activities/validation-process' : '/others-configuration/validation-process-rule';
  const parentLabel = isHrActivities ? 'HR Activities' : 'Others Configuration';
  const listLabel = isHrActivities ? 'Validation Process' : 'Validation Process Rule';
  const { user, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;
  const organizationId =
    user?.employee?.organizationId || user?.employee?.organization?.id;

  const [form, setForm] = useState<ValidationProcessRuleFormState>(
    initialFormState,
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Option[]>([]);
  const [paygroups, setPaygroups] = useState<Option[]>([]);
  const [departments, setDepartments] = useState<Option[]>([]);
  const [eventComponents, setEventComponents] = useState<Option[]>([]);

  const [selectedEmployees, setSelectedEmployees] = useState<Employee[]>([]);
  const [associateSearch, setAssociateSearch] = useState('');
  const [showAssociateDropdown, setShowAssociateDropdown] = useState(false);

  const [selectedShifts, setSelectedShifts] = useState<Option[]>([]);
  const [showShiftDropdown, setShowShiftDropdown] = useState(false);

  const [selectedPaygroups, setSelectedPaygroups] = useState<Option[]>([]);
  const [showPaygroupDropdown, setShowPaygroupDropdown] = useState(false);

  const [selectedDepartments, setSelectedDepartments] = useState<Option[]>([]);
  const [showDepartmentDropdown, setShowDepartmentDropdown] = useState(false);

  const [ruleLimits, setRuleLimits] = useState<ValidationRuleLimitRow[]>([
    {
      id: 'limit-1',
      periodicity: 'Monthly',
      maxMinutes: '',
      count: '',
      applyAfterEveryCount: false,
      deductPriority: '',
    },
  ]);

  const [actionBlocks, setActionBlocks] = useState<ActionBlockData[]>([
    {
      id: 'action-1',
      name: 'Action0',
      collapsed: false,
      condition: 'ALL',
      correctionMethod: 'Apply Event',
      eventType: '',
      autoApply: 'NO',
      dayType: 'Auto',
      days: 'Auto',
      daysValue: '0.5',
      minMinutes: '',
      maxMinutes: '',
    },
  ]);

  useEffect(() => {
    if (!organizationId) return;
    setLoading(true);

    Promise.all([
      employeeService.getAll({ organizationId, page: 1, limit: 500, employeeStatus: 'ACTIVE' }),
      shiftService.getAll({ organizationId, limit: 100 }),
      paygroupService.getAll({ organizationId }),
      departmentService.getAll({ organizationId, limit: 500 }),
      attendanceComponentService.getAll({ organizationId, limit: 500 }),
    ] as [
      Promise<import('../services/employee.service').EmployeeListResponse>,
      Promise<import('../services/shift.service').ShiftListResponse>,
      Promise<import('../services/paygroup.service').Paygroup[]>,
      Promise<import('../services/department.service').DepartmentListResponse>,
      Promise<import('../services/attendanceComponent.service').AttendanceComponentListResponse>
    ])
      .then(async ([empRes, shiftRes, pgList, deptRes, compRes]) => {
        const shiftList = (shiftRes.shifts || []).map((s) => ({ id: s.id, name: s.name }));
        const paygroupList = pgList.map((p) => ({ id: p.id, name: p.name }));
        const deptArr = deptRes.departments || [];
        const departmentList = deptArr.map((d) => ({ id: d.id, name: d.name }));

        setEmployees(empRes.employees || []);
        setShifts(shiftList);
        setPaygroups(paygroupList);
        setDepartments(departmentList);
        const components = compRes.components ?? [];
        setEventComponents(components.map((c) => ({ id: c.id, name: c.eventName })));

        if (id) {
          try {
            const rule = await validationProcessRuleService.getById(id);
            setForm({
              displayName: rule.displayName,
              effectiveDate: rule.effectiveDate.slice(0, 10),
              priority: rule.priority != null ? String(rule.priority) : '',
              remarks: rule.remarks ?? '',
              autoCorrect: rule.autoCorrect,
              correctAfterDays: rule.correctAfterDays != null ? String(rule.correctAfterDays) : '',
              primaryAction: rule.primaryAction,
              hasLimit: rule.hasLimit,
            });
            const empIds = (rule.employeeIds ?? []) as string[];
            const shiftIds = (rule.shiftIds ?? []) as string[];
            const pgIds = (rule.paygroupIds ?? []) as string[];
            const deptIds = (rule.departmentIds ?? []) as string[];
            setSelectedEmployees(empRes.employees.filter((e) => empIds.includes(e.id)));
            setSelectedShifts(shiftList.filter((s) => shiftIds.includes(s.id)));
            setSelectedPaygroups(paygroupList.filter((p) => pgIds.includes(p.id)));
            setSelectedDepartments(departmentList.filter((d) => deptIds.includes(d.id)));
            setRuleLimits(
              (rule.limits ?? []).length > 0
                ? (rule.limits ?? []).map((l) => ({
                    id: l.id,
                    periodicity: l.periodicity as (typeof VALIDATION_PERIODICITY_OPTIONS)[number],
                    maxMinutes: l.maxMinutes != null ? String(l.maxMinutes) : '',
                    count: l.count != null ? String(l.count) : '',
                    applyAfterEveryCount: l.applyAfterEveryCount,
                    deductPriority: l.deductPriority ?? '',
                  }))
                : [
                    {
                      id: 'limit-1',
                      periodicity: 'Monthly',
                      maxMinutes: '',
                      count: '',
                      applyAfterEveryCount: false,
                      deductPriority: '',
                    },
                  ]
            );
            setActionBlocks(
              (rule.actions ?? []).length > 0
                ? (rule.actions ?? []).map((a) => ({
                    id: a.id,
                    name: a.name,
                    collapsed: false,
                    condition: a.condition,
                    correctionMethod: a.correctionMethod,
                    eventType: a.attendanceComponentId ?? '',
                    autoApply: a.autoApply,
                    dayType: a.dayType,
                    days: a.days,
                    daysValue: a.daysValue != null ? String(a.daysValue) : '0.5',
                    minMinutes: a.minMinutes != null ? String(a.minMinutes) : '',
                    maxMinutes: a.maxMinutes != null ? String(a.maxMinutes) : '',
                  }))
                : [
                    {
                      id: 'action-1',
                      name: 'Action0',
                      collapsed: false,
                      condition: 'ALL',
                      correctionMethod: 'Apply Event',
                      eventType: '',
                      autoApply: 'NO',
                      dayType: 'Auto',
                      days: 'Auto',
                      daysValue: '0.5',
                      minMinutes: '',
                      maxMinutes: '',
                    },
                  ]
            );
          } catch {
            setError('Failed to load rule');
          }
        }
      })
      .catch(() => setError('Failed to load data.'))
      .finally(() => setLoading(false));
  }, [organizationId, id]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleCancel = () => navigate(basePath);

  const updateForm = <K extends keyof ValidationProcessRuleFormState>(
    key: K,
    value: ValidationProcessRuleFormState[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const addEmployee = (emp: Employee) => {
    if (selectedEmployees.some((e) => e.id === emp.id)) return;
    setSelectedEmployees((prev) => [...prev, emp]);
    setAssociateSearch('');
    setShowAssociateDropdown(false);
  };

  const removeEmployee = (empId: string) => {
    setSelectedEmployees((prev) => prev.filter((e) => e.id !== empId));
  };

  const filteredEmployees = employees.filter(
    (e) =>
      !selectedEmployees.some((s) => s.id === e.id) &&
      (fullName(e).toLowerCase().includes(associateSearch.toLowerCase()) ||
        (e.employeeCode ?? '')
          .toLowerCase()
          .includes(associateSearch.toLowerCase())),
  );

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

  const addRuleLimitRow = () => {
    setRuleLimits((prev) => [
      ...prev,
      {
        id: `limit-${prev.length + 1}`,
        periodicity: 'Monthly',
        maxMinutes: '',
        count: '',
        applyAfterEveryCount: false,
        deductPriority: '',
      },
    ]);
  };

  const updateRuleLimitRow = <K extends keyof ValidationRuleLimitRow>(
    id: string,
    key: K,
    value: ValidationRuleLimitRow[K],
  ) => {
    setRuleLimits((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [key]: value } : row)),
    );
  };

  const removeRuleLimitRow = (id: string) => {
    setRuleLimits((prev) => prev.filter((row) => row.id !== id));
  };

  const addActionBlock = () => {
    const defaultEventId = eventComponents[0]?.id ?? '';
    setActionBlocks((prev) => [
      ...prev,
      {
        id: `action-${Date.now()}`,
        name: `Action${prev.length}`,
        collapsed: false,
        condition: 'ALL',
        correctionMethod: 'Apply Event',
        eventType: defaultEventId,
        autoApply: 'NO',
        dayType: 'Auto',
        days: 'Auto',
        daysValue: '0.5',
        minMinutes: '',
        maxMinutes: '',
      },
    ]);
  };

  const removeActionBlock = (id: string) => {
    setActionBlocks((prev) => prev.filter((a) => a.id !== id));
  };

  const updateActionBlock = <K extends keyof ActionBlockData>(
    id: string,
    key: K,
    value: ActionBlockData[K],
  ) => {
    setActionBlocks((prev) =>
      prev.map((a) => (a.id === id ? { ...a, [key]: value } : a)),
    );
  };

  const toggleActionCollapsed = (id: string) => {
    setActionBlocks((prev) =>
      prev.map((a) => (a.id === id ? { ...a, collapsed: !a.collapsed } : a)),
    );
  };

  const moveActionBlock = (id: string, direction: 'up' | 'down') => {
    setActionBlocks((prev) => {
      const idx = prev.findIndex((a) => a.id === id);
      if (idx < 0) return prev;
      if (direction === 'up' && idx === 0) return prev;
      if (direction === 'down' && idx === prev.length - 1) return prev;
      const arr = [...prev];
      const swap = direction === 'up' ? idx - 1 : idx + 1;
      [arr[idx], arr[swap]] = [arr[swap], arr[idx]];
      return arr;
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId) return;
    if (!form.displayName.trim()) {
      setError('Display Name is required.');
      return;
    }
    if (!form.effectiveDate) {
      setError('Effective Date is required.');
      return;
    }
    if (selectedPaygroups.length === 0) {
      setError('Paygroup is required.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const payload = {
        organizationId,
        displayName: form.displayName.trim(),
        validationGrouping: 'Late',
        effectiveDate: form.effectiveDate,
        priority: form.priority ? Number(form.priority) : undefined,
        remarks: form.remarks || undefined,
        autoCorrect: form.autoCorrect,
        correctAfterDays: form.correctAfterDays || undefined,
        primaryAction: form.primaryAction,
        hasLimit: form.hasLimit,
        employeeIds: selectedEmployees.length > 0 ? selectedEmployees.map((e) => e.id) : undefined,
        shiftIds: selectedShifts.length > 0 ? selectedShifts.map((s) => s.id) : undefined,
        paygroupIds: selectedPaygroups.map((p) => p.id),
        departmentIds: selectedDepartments.length > 0 ? selectedDepartments.map((d) => d.id) : undefined,
        limits: ruleLimits.map((r) => ({
          periodicity: r.periodicity,
          maxMinutes: r.maxMinutes || undefined,
          count: r.count || undefined,
          applyAfterEveryCount: r.applyAfterEveryCount,
          deductPriority: r.deductPriority || undefined,
        })),
        actions: actionBlocks.map((a) => ({
          name: a.name,
          condition: a.condition,
          correctionMethod: a.correctionMethod,
          attendanceComponentId: a.eventType || undefined,
          autoApply: a.autoApply,
          dayType: a.dayType,
          days: a.days,
          daysValue: a.days === 'Manual' && a.daysValue ? a.daysValue : undefined,
          minMinutes: a.minMinutes ? Number(a.minMinutes) : undefined,
          maxMinutes: a.maxMinutes ? Number(a.maxMinutes) : undefined,
        })),
      };
      if (isEdit && id) {
        await validationProcessRuleService.update(id, payload);
      } else {
        await validationProcessRuleService.create(payload as Parameters<typeof validationProcessRuleService.create>[0]);
      }
      navigate(basePath);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save validation process rule.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader
        title={parentLabel}
        subtitle={
          organizationName ? `Organization: ${organizationName}` : undefined
        }
        onLogout={handleLogout}
      />

      <main className="flex-1 min-h-0 overflow-auto w-full bg-gray-100">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 bg-gray-50">
          {/* Breadcrumbs - Employee module style */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
            <nav
              className="flex items-center gap-1.5 text-sm text-gray-500"
              aria-label="Breadcrumb"
            >
              <span className="font-semibold text-gray-900">
                {parentLabel}
              </span>
              <span className="mx-1 text-gray-400">/</span>
              <Link
                to={basePath}
                className="text-gray-500 hover:text-gray-900"
              >
                {listLabel}
              </Link>
              <span className="mx-1 text-gray-400">/</span>
              <span className="text-gray-500">{isEdit ? 'Edit' : 'Add'}</span>
            </nav>
          </div>

          <div className="bg-white rounded-lg shadow mb-6">
            {/* Header Section - Employee module style */}
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">
                {isEdit ? 'Edit' : 'Add'} Validation Process Rule
              </h2>
              <p className="text-gray-600 mt-1">
                {isEdit ? 'Update' : 'Create'} a validation process rule for attendance.
              </p>
            </div>

            <div className="p-6">
              {loading ? (
                <div className="p-8 text-center text-gray-500">Loading...</div>
              ) : (
                <form onSubmit={handleSave} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Display Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={form.displayName}
                        onChange={(e) =>
                          updateForm('displayName', e.target.value)
                        }
                        placeholder="e.g. Worker"
                        className="block w-full h-10 bg-white text-gray-900 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Effective Date <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="date"
                          value={form.effectiveDate}
                          onChange={(e) =>
                            updateForm('effectiveDate', e.target.value)
                          }
                          className="block w-full h-10 bg-white text-gray-900 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
                        />
                        <svg
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Shift
                      </label>
                      <MultiSelectChips
                        selected={selectedShifts}
                        onRemove={removeShift}
                        onToggle={toggleShift}
                        options={shifts.filter(
                          (s) => !selectedShifts.some((x) => x.id === s.id),
                        )}
                        showDropdown={showShiftDropdown}
                        setShowDropdown={setShowShiftDropdown}
                        placeholder="All shifts"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Priority
                      </label>
                      <input
                        type="text"
                        value={form.priority}
                        onChange={(e) =>
                          updateForm('priority', e.target.value)
                        }
                        placeholder="(Auto)"
                        className="block w-full h-10 bg-white text-gray-900 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Paygroup <span className="text-red-500">*</span>
                      </label>
                      <MultiSelectChips
                        selected={selectedPaygroups}
                        onRemove={removePaygroup}
                        onToggle={togglePaygroup}
                        options={paygroups.filter(
                          (o) => !selectedPaygroups.some((x) => x.id === o.id),
                        )}
                        showDropdown={showPaygroupDropdown}
                        setShowDropdown={setShowPaygroupDropdown}
                        placeholder="Select paygroups..."
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Department
                      </label>
                      <MultiSelectChips
                        selected={selectedDepartments}
                        onRemove={removeDepartment}
                        onToggle={toggleDepartment}
                        options={departments.filter(
                          (o) =>
                            !selectedDepartments.some((x) => x.id === o.id),
                        )}
                        showDropdown={showDepartmentDropdown}
                        setShowDropdown={setShowDepartmentDropdown}
                        placeholder="All departments"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Associate
                      </label>
                      <div className="relative">
                        <div className="flex flex-wrap gap-2 min-h-[2.5rem] rounded-lg border border-gray-300 px-3 py-2 bg-white">
                          {selectedEmployees.map((emp) => (
                            <span
                              key={emp.id}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 text-gray-800 text-sm"
                            >
                              {fullName(emp)}
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
                            placeholder="Search associates..."
                            className="min-w-[120px] flex-1 border-0 p-0 text-sm text-gray-900 bg-transparent focus:ring-0 focus:outline-none"
                          />
                        </div>
                        {showAssociateDropdown && (
                          <>
                            <div
                              className="fixed inset-0 z-10"
                              onClick={() => setShowAssociateDropdown(false)}
                              aria-hidden="true"
                            />
                            <div className="absolute z-20 mt-1 py-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto w-full">
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
                                <div className="px-3 py-2 text-sm text-gray-500">
                                  No matches
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Remarks
                      </label>
                      <textarea
                        value={form.remarks}
                        onChange={(e) => updateForm('remarks', e.target.value)}
                        placeholder="Remarks"
                        rows={3}
                        className="block w-full bg-white text-gray-900 rounded-lg border border-gray-300 px-4 py-2 text-sm resize-y focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Additional options section */}
                  <div className="mt-6 border-t border-gray-200 pt-6 space-y-6">
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Validation Options
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Toggle
                          label="Auto Correct"
                          value={form.autoCorrect}
                          onChange={(v) => updateForm('autoCorrect', v)}
                        />
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            Correct After days
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={form.correctAfterDays}
                            onChange={(e) =>
                              updateForm('correctAfterDays', e.target.value)
                            }
                            className="block w-full h-10 bg-white text-gray-900 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <Toggle
                          label="Primary Action"
                          value={form.primaryAction}
                          onChange={(v) => updateForm('primaryAction', v)}
                        />
                        <Toggle
                          label="Has Limit"
                          value={form.hasLimit}
                          onChange={(v) => updateForm('hasLimit', v)}
                        />
                      </div>
                    </div>

                    {/* Placeholder sections under Has Limit – Reminder Action, Rule Limits, Action */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Reminder Action
                      </h3>
                      <p className="text-sm text-gray-500">
                        Configure reminder actions (e.g. reminders after N days /
                        counts). This section is a UI placeholder; backend wiring
                        will be added later.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Validation Rule Limits
                      </h3>
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
                          <span className="text-sm font-medium text-gray-700">
                            Limits per periodicity
                          </span>
                          <button
                            type="button"
                            className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                            onClick={addRuleLimitRow}
                          >
                            +
                            <span className="ml-1">Add</span>
                          </button>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200 text-xs">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-3 py-2 text-left font-medium text-gray-500">
                                  Periodicity
                                </th>
                                <th className="px-3 py-2 text-left font-medium text-gray-500">
                                  Max Minutes
                                </th>
                                <th className="px-3 py-2 text-left font-medium text-gray-500">
                                  No Of Count
                                </th>
                                <th className="px-3 py-2 text-left font-medium text-gray-500">
                                  Apply After Every Count
                                </th>
                                <th className="px-3 py-2 text-left font-medium text-gray-500">
                                  Deduct As Per Priority
                                </th>
                                <th className="px-3 py-2 text-right font-medium text-gray-500">
                                  {/* actions */}
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white">
                              {ruleLimits.map((row) => (
                                <tr key={row.id}>
                                  <td className="px-3 py-2">
                                    <select
                                      className="w-full h-8 border border-gray-300 rounded-md text-xs px-2"
                                      value={row.periodicity}
                                      onChange={(e) =>
                                        updateRuleLimitRow(
                                          row.id,
                                          'periodicity',
                                          e.target
                                            .value as (typeof VALIDATION_PERIODICITY_OPTIONS)[number],
                                        )
                                      }
                                    >
                                      {VALIDATION_PERIODICITY_OPTIONS.map((opt) => (
                                        <option key={opt} value={opt}>
                                          {opt}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                  <td className="px-3 py-2">
                                    <input
                                      type="number"
                                      className="w-full h-8 border border-gray-300 rounded-md text-xs px-2"
                                      placeholder="15"
                                      value={row.maxMinutes}
                                      onChange={(e) =>
                                        updateRuleLimitRow(
                                          row.id,
                                          'maxMinutes',
                                          e.target.value,
                                        )
                                      }
                                    />
                                  </td>
                                  <td className="px-3 py-2">
                                    <input
                                      type="number"
                                      className="w-full h-8 border border-gray-300 rounded-md text-xs px-2"
                                      placeholder="3"
                                      value={row.count}
                                      onChange={(e) =>
                                        updateRuleLimitRow(
                                          row.id,
                                          'count',
                                          e.target.value,
                                        )
                                      }
                                    />
                                  </td>
                                  <td className="px-3 py-2">
                                    <input
                                      type="checkbox"
                                      className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                                      checked={row.applyAfterEveryCount}
                                      onChange={(e) =>
                                        updateRuleLimitRow(
                                          row.id,
                                          'applyAfterEveryCount',
                                          e.target.checked,
                                        )
                                      }
                                    />
                                  </td>
                                  <td className="px-3 py-2">
                                    <select
                                      className="w-full h-8 border border-gray-300 rounded-md text-xs px-2"
                                      value={row.deductPriority}
                                      onChange={(e) =>
                                        updateRuleLimitRow(
                                          row.id,
                                          'deductPriority',
                                          e.target.value,
                                        )
                                      }
                                    >
                                      <option value="">Select</option>
                                      {DEDUCT_PRIORITY_OPTIONS.map((opt) => (
                                        <option key={opt} value={opt}>
                                          {opt}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    <button
                                      type="button"
                                      className="inline-flex items-center px-2 py-1 text-xs text-red-600 hover:text-red-800"
                                      onClick={() => removeRuleLimitRow(row.id)}
                                    >
                                      Delete
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Action
                      </h3>
                      <div className="space-y-3">
                        {actionBlocks.map((action, idx) => (
                          <div
                            key={action.id}
                            className="border border-gray-200 rounded-lg overflow-hidden bg-white"
                          >
                            {/* Blue header bar */}
                            <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-600 text-white">
                              <button
                                type="button"
                                onClick={() => toggleActionCollapsed(action.id)}
                                className="p-0.5 hover:bg-blue-500 rounded transition"
                                aria-label={action.collapsed ? 'Expand' : 'Collapse'}
                              >
                                <svg
                                  className={`w-5 h-5 transition-transform ${action.collapsed ? '' : 'rotate-180'}`}
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                              <input
                                type="text"
                                value={action.name}
                                onChange={(e) => updateActionBlock(action.id, 'name', e.target.value)}
                                className="h-8 px-3 rounded-md text-sm text-gray-900 bg-white border-0 flex-1 max-w-[180px] focus:ring-2 focus:ring-blue-400"
                              />
                              <button
                                type="button"
                                onClick={() => removeActionBlock(action.id)}
                                className="p-1 hover:bg-blue-500 rounded transition text-white"
                                title="Delete"
                              >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1H4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                              {idx === 0 ? (
                                <button
                                  type="button"
                                  onClick={addActionBlock}
                                  className="ml-auto p-1 hover:bg-blue-500 rounded transition text-white"
                                  title="Add action"
                                >
                                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                  </svg>
                                </button>
                              ) : null}
                            </div>

                            {!action.collapsed && (
                              <div className="p-4 relative">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  {/* Row 0: Minute Range for tiered actions */}
                                  <div className="flex flex-col gap-1.5">
                                    <label className="block text-xs font-medium text-gray-600">Min Minutes</label>
                                    <input
                                      type="number"
                                      min={0}
                                      value={action.minMinutes}
                                      onChange={(e) => updateActionBlock(action.id, 'minMinutes', e.target.value)}
                                      placeholder="0"
                                      className="h-9 w-full px-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                  </div>
                                  <div className="flex flex-col gap-1.5">
                                    <label className="block text-xs font-medium text-gray-600">Max Minutes</label>
                                    <input
                                      type="number"
                                      min={0}
                                      value={action.maxMinutes}
                                      onChange={(e) => updateActionBlock(action.id, 'maxMinutes', e.target.value)}
                                      placeholder="No limit"
                                      className="h-9 w-full px-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                  </div>
                                  <div className="flex items-end pb-1">
                                    <span className="text-xs text-gray-400">
                                      {action.minMinutes || action.maxMinutes
                                        ? `${action.minMinutes || '0'} – ${action.maxMinutes || '∞'} min late → this action`
                                        : 'Leave empty for all durations'}
                                    </span>
                                  </div>

                                  {/* Row 1: Condition, Correction Method, Auto Apply */}
                                  <PillToggle
                                    label="Condition"
                                    value={action.condition}
                                    options={CONDITION_OPTIONS}
                                    onChange={(v) => updateActionBlock(action.id, 'condition', v)}
                                  />
                                  <SelectWithChevron
                                    label="Correction Method"
                                    value={action.correctionMethod}
                                    options={CORRECTION_METHOD_OPTIONS}
                                    onChange={(v) => updateActionBlock(action.id, 'correctionMethod', v)}
                                  />
                                  <PillToggle
                                    label="Auto Apply"
                                    value={action.autoApply}
                                    options={AUTO_APPLY_OPTIONS}
                                    onChange={(v) => updateActionBlock(action.id, 'autoApply', v)}
                                  />
                                  {/* Row 2: Event Type, Day Type, Days */}
                                  <SelectWithChevron
                                    label="Event Type"
                                    value={action.eventType}
                                    options={[
                                      { id: '', name: 'Select event' },
                                      ...eventComponents,
                                    ]}
                                    onChange={(v) => updateActionBlock(action.id, 'eventType', v)}
                                  />
                                  <PillToggle
                                    label="Day Type"
                                    value={action.dayType}
                                    options={DAY_TYPE_OPTIONS}
                                    onChange={(v) => updateActionBlock(action.id, 'dayType', v)}
                                  />
                                  <div className="flex flex-col gap-1.5">
                                    <label className="block text-xs font-medium text-gray-600">Days</label>
                                    {action.days === 'Auto' ? (
                                      <PillToggle
                                        label=""
                                        value="Auto"
                                        options={DAYS_OPTIONS}
                                        onChange={() => updateActionBlock(action.id, 'days', 'Manual')}
                                      />
                                    ) : (
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <input
                                          type="text"
                                          value={action.daysValue}
                                          onChange={(e) => updateActionBlock(action.id, 'daysValue', e.target.value)}
                                          className="h-9 w-20 px-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                          placeholder="0.5"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => updateActionBlock(action.id, 'days', 'Auto')}
                                          className="text-xs font-medium rounded-full px-2 py-1 bg-green-100 text-green-800 border border-green-300 hover:bg-green-200"
                                        >
                                          Auto
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Right side: up, down, trash */}
                                <div className="absolute right-4 top-4 flex flex-col gap-1">
                                  <button
                                    type="button"
                                    onClick={() => moveActionBlock(action.id, 'up')}
                                    disabled={idx === 0}
                                    className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                                    title="Move up"
                                  >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => moveActionBlock(action.id, 'down')}
                                    disabled={idx === actionBlocks.length - 1}
                                    className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                                    title="Move down"
                                  >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeActionBlock(action.id)}
                                    className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                                    title="Delete"
                                  >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1H4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {error && (
                    <div className="mt-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
                      {error}
                    </div>
                  )}

                  <div className="mt-6 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
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

