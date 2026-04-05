import { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';
import paygroupService from '../services/paygroup.service';
import departmentService from '../services/department.service';
import employeeService, { Employee } from '../services/employee.service';
import autoCreditSettingService from '../services/autoCreditSetting.service';
import attendanceComponentService, { type AttendanceComponent } from '../services/attendanceComponent.service';

function fullName(e: Employee): string {
  const parts = [e.firstName, e.middleName, e.lastName].filter(Boolean);
  return parts.join(' ').trim() || e.employeeCode || '';
}

interface Option {
  id: string;
  name: string;
}

const inputClass = 'mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm';

function getScrollParent(el: HTMLElement | null): HTMLElement | null {
  if (!el) return null;
  let parent = el.parentElement;
  while (parent) {
    const style = getComputedStyle(parent);
    const overflow = style.overflow + style.overflowY + style.overflowX;
    if (/(auto|scroll)/.test(overflow)) return parent;
    parent = parent.parentElement;
  }
  return document.documentElement;
}

function getAllScrollPositions(el: HTMLElement | null): { el: HTMLElement; top: number }[] {
  const result: { el: HTMLElement; top: number }[] = [];
  if (!el) return result;
  let current: HTMLElement | null = el;
  while (current && current !== document.body) {
    const style = getComputedStyle(current);
    const overflow = style.overflow + style.overflowY + style.overflowX;
    if (/(auto|scroll)/.test(overflow)) {
      result.push({ el: current, top: current.scrollTop });
    }
    current = current.parentElement;
  }
  return result;
}

function FormRow({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center py-4 border-b border-gray-200 last:border-b-0 gap-2 sm:gap-4">
      <label className="sm:w-48 flex-shrink-0 text-sm font-medium text-gray-700">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function ToggleSwitch({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const savedScrollRef = useRef<{ el: HTMLElement | null; top: number }>({ el: null, top: 0 });
  const shouldRestoreRef = useRef(false);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const scrollEl = getScrollParent(e.currentTarget);
    if (scrollEl) {
      savedScrollRef.current = { el: scrollEl, top: scrollEl.scrollTop };
      shouldRestoreRef.current = true;
    }
    onChange(!value);
  };

  useLayoutEffect(() => {
    if (shouldRestoreRef.current && savedScrollRef.current.el) {
      savedScrollRef.current.el.scrollTop = savedScrollRef.current.top;
      shouldRestoreRef.current = false;
    }
  }, [value]);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={handleClick}
        className={`relative inline-flex h-8 w-14 shrink-0 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
          value ? 'bg-green-600' : 'bg-red-500'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${
            value ? 'translate-x-6 mt-1 ml-1' : 'translate-x-1 mt-1'
          }`}
        />
      </button>
      <span className={`text-sm font-medium ${value ? 'text-green-700' : 'text-red-700'}`}>
        {value ? 'YES' : 'NO'}
      </span>
    </div>
  );
}

export default function AutoCreditSettingFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const { user, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;
  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id || (user as any)?.organizationId;

  const [eventType, setEventType] = useState('');
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Section 1 - Basic info - no auto-selection on add
  const [displayName, setDisplayName] = useState('');
  const [eventId, setEventId] = useState<string | null>(null);
  const [attendanceComponents, setAttendanceComponents] = useState<AttendanceComponent[]>([]);
  const [selectedAssociates, setSelectedAssociates] = useState<Option[]>([]);
  const [selectedPaygroups, setSelectedPaygroups] = useState<Option[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<Option[]>([]);
  const [effectiveDate, setEffectiveDate] = useState('');
  const [priority, setPriority] = useState<number | ''>('');
  const [remarks, setRemarks] = useState('');

  // Section 2 - Auto Credit Rule - no auto-selection on add
  const [periodicity, setPeriodicity] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [waitFor, setWaitFor] = useState<number | ''>('');
  const [waitForUnit, setWaitForUnit] = useState('');
  const [creditBasedOn, setCreditBasedOn] = useState<'Calendar Period' | 'Attendance Period' | ''>('');
  const [daysCalculation, setDaysCalculation] = useState<'Full Credit' | 'Prorata on date basis' | 'Prorata on month basis' | ''>('');
  const [joiningPeriodCredit, setJoiningPeriodCredit] = useState(false);

  // Section 3 - no auto-selection on add
  const [probationCredit, setProbationCredit] = useState(false);
  const [entitlementDays, setEntitlementDays] = useState<number | ''>('');
  const [roundOff, setRoundOff] = useState(false);
  const [roundOffNature, setRoundOffNature] = useState('');
  const [roundOffValue, setRoundOffValue] = useState<number | ''>('');
  const [carryForwardNextPeriod, setCarryForwardNextPeriod] = useState(false);
  const [expireInMonth, setExpireInMonth] = useState<number | ''>('');
  const [dayOfCreditPeriod, setDayOfCreditPeriod] = useState('');

  // Section 4
  const [creditBaseOnPreviousWorkDays, setCreditBaseOnPreviousWorkDays] = useState(false);
  const [effectiveTo, setEffectiveTo] = useState('');

  const [paygroups, setPaygroups] = useState<Option[]>([]);
  const [departments, setDepartments] = useState<Option[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadedAssociateIds, setLoadedAssociateIds] = useState<string[]>([]);
  const [loadedPaygroupIds, setLoadedPaygroupIds] = useState<string[]>([]);
  const [loadedDepartmentIds, setLoadedDepartmentIds] = useState<string[]>([]);
  const [showPaygroupDropdown, setShowPaygroupDropdown] = useState(false);
  const [showDepartmentDropdown, setShowDepartmentDropdown] = useState(false);
  const [showAssociateDropdown, setShowAssociateDropdown] = useState(false);
  const [showEventComponentDropdown, setShowEventComponentDropdown] = useState(false);
  const paygroupDropdownRef = useRef<HTMLDivElement>(null);
  const departmentDropdownRef = useRef<HTMLDivElement>(null);
  const associateDropdownRef = useRef<HTMLDivElement>(null);
  const eventComponentDropdownRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const savedScrollRef = useRef<{ el: HTMLElement; top: number }[]>([]);
  const shouldRestoreScrollRef = useRef(false);

  const saveScrollPosition = () => {
    const el = mainRef.current || document.querySelector('main') as HTMLElement | null;
    if (el) {
      savedScrollRef.current = getAllScrollPositions(el);
      shouldRestoreScrollRef.current = savedScrollRef.current.length > 0;
    }
  };

  useEffect(() => {
    if (shouldRestoreScrollRef.current && savedScrollRef.current.length > 0) {
      savedScrollRef.current.forEach(({ el, top }) => {
        el.scrollTop = top;
      });
      shouldRestoreScrollRef.current = false;
    }
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (paygroupDropdownRef.current && !paygroupDropdownRef.current.contains(event.target as Node)) setShowPaygroupDropdown(false);
      if (departmentDropdownRef.current && !departmentDropdownRef.current.contains(event.target as Node)) setShowDepartmentDropdown(false);
      if (associateDropdownRef.current && !associateDropdownRef.current.contains(event.target as Node)) setShowAssociateDropdown(false);
      if (eventComponentDropdownRef.current && !eventComponentDropdownRef.current.contains(event.target as Node)) setShowEventComponentDropdown(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!organizationId) return;
    Promise.all([
      paygroupService.getAll({ organizationId }),
      departmentService.getAll({ organizationId, limit: 500 }),
      employeeService.getAll({ organizationId, page: 1, limit: 2000, employeeStatus: 'ACTIVE' }),
      attendanceComponentService.getAll({ organizationId, page: 1, limit: 500 }),
    ]).then(([pgList, deptRes, empRes, compRes]) => {
      setPaygroups((pgList || []).map((p) => ({ id: p.id, name: p.name })));
      setDepartments((deptRes?.departments || []).map((d) => ({ id: d.id, name: d.name })));
      setEmployees(empRes?.employees || []);
      setAttendanceComponents(compRes?.components || []);
    }).catch(() => {});
  }, [organizationId]);

  const associateOptions: Option[] = [
    { id: '__ALL__', name: 'All' },
    ...employees.map((e) => ({ id: e.id, name: `${e.employeeCode || e.id} - ${fullName(e)}` })),
  ];

  useEffect(() => {
    if (!isEdit && employees.length > 0 && selectedAssociates.length === 0 && selectedPaygroups.length === 0 && selectedDepartments.length === 0) {
      setSelectedAssociates([{ id: '__ALL__', name: 'All' }]);
      setSelectedPaygroups([{ id: '__ALL__', name: 'All' }]);
      setSelectedDepartments([{ id: '__ALL__', name: 'All' }]);
    }
  }, [isEdit, employees.length, selectedAssociates.length, selectedPaygroups.length, selectedDepartments.length]);

  useEffect(() => {
    if (!isEdit || !id || !organizationId) return;
    setLoading(true);
    setError(null);
    autoCreditSettingService
      .getById(id)
      .then((data) => {
        setEventType(data.eventType);
        setDisplayName(data.displayName);
        setEffectiveDate(data.effectiveDate ? data.effectiveDate.split('T')[0] : '');
        setEffectiveTo(data.effectiveTo ? data.effectiveTo.split('T')[0] : '');
        setPriority(data.priority ?? 0);
        setRemarks(data.remarks || '');
        const aIds = (data as { associateIds?: string[] }).associateIds;
        if (Array.isArray(aIds) && aIds.length > 0) {
          setLoadedAssociateIds(aIds);
        } else if (data.associate) {
          setLoadedAssociateIds([data.associate]);
        } else {
          setLoadedAssociateIds([]);
        }
        const pgIds = (data as { paygroupIds?: string[] }).paygroupIds;
        if (Array.isArray(pgIds) && pgIds.length > 0) {
          setLoadedPaygroupIds(pgIds);
        } else if (data.paygroup) {
          setLoadedPaygroupIds([data.paygroup.id]);
        } else {
          setLoadedPaygroupIds([]);
        }
        const deptIds = (data as { departmentIds?: string[] }).departmentIds;
        if (Array.isArray(deptIds) && deptIds.length > 0) {
          setLoadedDepartmentIds(deptIds);
        } else if (data.department) {
          setLoadedDepartmentIds([data.department.id]);
        } else {
          setLoadedDepartmentIds([]);
        }
        const rule = data.autoCreditRule as Record<string, unknown> | null | undefined;
        if (rule) {
          if (rule.periodicity) setPeriodicity(String(rule.periodicity));
          if (rule.effectiveFrom) setEffectiveFrom(String(rule.effectiveFrom));
          if (rule.waitFor != null) setWaitFor(Number(rule.waitFor));
          if (rule.waitForUnit) setWaitForUnit(String(rule.waitForUnit));
          if (rule.creditBasedOn) setCreditBasedOn(rule.creditBasedOn as 'Calendar Period' | 'Attendance Period');
          if (rule.daysCalculation) setDaysCalculation(rule.daysCalculation as 'Full Credit' | 'Prorata on date basis' | 'Prorata on month basis');
          if (typeof rule.joiningPeriodCredit === 'boolean') setJoiningPeriodCredit(rule.joiningPeriodCredit);
          if (typeof rule.probationCredit === 'boolean') setProbationCredit(rule.probationCredit);
          if (rule.entitlementDays != null) setEntitlementDays(Number(rule.entitlementDays));
          if (typeof rule.roundOff === 'boolean') setRoundOff(rule.roundOff);
          if (rule.roundOffNature) setRoundOffNature(String(rule.roundOffNature));
          if (rule.roundOffValue != null) setRoundOffValue(Number(rule.roundOffValue));
          if (typeof rule.carryForwardNextPeriod === 'boolean') setCarryForwardNextPeriod(rule.carryForwardNextPeriod);
          if (rule.expireInMonth != null) setExpireInMonth(Number(rule.expireInMonth));
          if (rule.dayOfCreditPeriod) setDayOfCreditPeriod(String(rule.dayOfCreditPeriod));
          if (typeof rule.creditBaseOnPreviousWorkDays === 'boolean') setCreditBaseOnPreviousWorkDays(rule.creditBaseOnPreviousWorkDays);
        }
        setLoading(false);
      })
      .catch((err) => {
        const msg = err && typeof err === 'object' && 'response' in err ? (err as { response?: { data?: { message?: string } } }).response?.data?.message : 'Failed to load';
        setError(String(msg || 'Failed to load'));
        setLoading(false);
      });
  }, [id, organizationId, isEdit]);

  useEffect(() => {
    const comp = attendanceComponents.find((c) => c.eventName === eventType);
    if (comp) setEventId(comp.id);
  }, [attendanceComponents, eventType]);

  useEffect(() => {
    if (!isEdit) return;
    if (loadedAssociateIds.length === 0) {
      setSelectedAssociates([{ id: '__ALL__', name: 'All' }]);
      return;
    }
    if (employees.length === 0) return;
    const resolved = loadedAssociateIds
      .map((aid) => {
        const e = employees.find((emp) => emp.id === aid || emp.employeeCode === aid);
        return e ? { id: e.id, name: `${e.employeeCode || e.id} - ${fullName(e)}` } : null;
      })
      .filter((o): o is Option => o != null);
    if (resolved.length > 0) setSelectedAssociates(resolved);
  }, [isEdit, loadedAssociateIds, employees]);

  useEffect(() => {
    if (!isEdit) return;
    if (loadedPaygroupIds.length === 0) {
      setSelectedPaygroups([{ id: '__ALL__', name: 'All' }]);
      return;
    }
    if (paygroups.length === 0) return;
    const resolved = loadedPaygroupIds
      .map((pid) => paygroups.find((p) => p.id === pid))
      .filter((p): p is Option => p != null);
    if (resolved.length > 0) setSelectedPaygroups(resolved);
  }, [isEdit, loadedPaygroupIds, paygroups]);

  useEffect(() => {
    if (!isEdit) return;
    if (loadedDepartmentIds.length === 0) {
      setSelectedDepartments([{ id: '__ALL__', name: 'All' }]);
      return;
    }
    if (departments.length === 0) return;
    const resolved = loadedDepartmentIds
      .map((did) => departments.find((d) => d.id === did))
      .filter((d): d is Option => d != null);
    if (resolved.length > 0) setSelectedDepartments(resolved);
  }, [isEdit, loadedDepartmentIds, departments]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleCancel = () => navigate('/event-configuration/auto-credit-setting');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId) {
      setError('Organization not found. Please log in again.');
      return;
    }
    if (!eventType?.trim()) {
      setError('Event (Attendance Component) is required');
      return;
    }
    if (!displayName.trim()) {
      setError('Display Name is required');
      return;
    }
    if (!effectiveDate.trim()) {
      setError('Effective Date is required');
      return;
    }
    if (!periodicity.trim()) {
      setError('Periodicity is required');
      return;
    }
    if (!effectiveFrom.trim()) {
      setError('Effective From is required');
      return;
    }
    if (entitlementDays === '' || entitlementDays === null || entitlementDays === undefined) {
      setError('Entitlement Days is required');
      return;
    }

    setError(null);
    setSaving(true);
    try {
      const autoCreditRule = {
        periodicity: periodicity.trim(),
        effectiveFrom: effectiveFrom.trim(),
        waitFor: waitFor === '' ? 0 : Number(waitFor),
        waitForUnit: waitForUnit || 'Days',
        creditBasedOn: creditBasedOn || undefined,
        daysCalculation: daysCalculation || undefined,
        joiningPeriodCredit,
        probationCredit,
        entitlementDays: String(entitlementDays) === '' ? 0 : Number(entitlementDays),
        roundOff,
        roundOffNature: roundOffNature || undefined,
        roundOffValue: String(roundOffValue) === '' ? 0 : Number(roundOffValue),
        carryForwardNextPeriod,
        expireInMonth: String(expireInMonth) === '' ? 0 : Number(expireInMonth),
        dayOfCreditPeriod: dayOfCreditPeriod.trim() || undefined,
        creditBaseOnPreviousWorkDays,
      };
      const associateIdsArr =
        selectedAssociates.length === 0 || selectedAssociates.some((a) => a.id === '__ALL__')
          ? null
          : selectedAssociates.map((a) => a.id).filter((id) => id !== '__ALL__');
      const paygroupIdsArr =
        selectedPaygroups.length === 0 || selectedPaygroups.some((p) => p.id === '__ALL__')
          ? null
          : selectedPaygroups.map((p) => p.id).filter((id) => id !== '__ALL__');
      const departmentIdsArr =
        selectedDepartments.length === 0 || selectedDepartments.some((d) => d.id === '__ALL__')
          ? null
          : selectedDepartments.map((d) => d.id).filter((id) => id !== '__ALL__');

      const payload = {
        organizationId,
        eventType,
        displayName: displayName.trim(),
        associateIds: associateIdsArr,
        paygroupIds: paygroupIdsArr,
        departmentIds: departmentIdsArr,
        effectiveDate: effectiveDate.trim(),
        effectiveTo: effectiveTo.trim() || undefined,
        priority: priority === '' ? 0 : Number(priority),
        remarks: remarks.trim() || undefined,
        autoCreditRule,
      };
      if (isEdit && id) {
        await autoCreditSettingService.update(id, payload);
      } else {
        await autoCreditSettingService.create({
          organizationId,
          eventType,
          displayName: payload.displayName,
          associate: null,
          associateIds: payload.associateIds ?? null,
          paygroupId: null,
          paygroupIds: payload.paygroupIds ?? null,
          departmentId: null,
          departmentIds: payload.departmentIds ?? null,
          condition: null,
          effectiveDate: payload.effectiveDate!,
          effectiveTo: payload.effectiveTo,
          priority: payload.priority,
          remarks: payload.remarks,
          autoCreditRule: payload.autoCreditRule,
        });
      }
      navigate('/event-configuration/auto-credit-setting', { state: { eventType } });
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err ? (err as { response?: { data?: { message?: string } } }).response?.data?.message : 'Failed to save';
      setError(String(msg || 'Failed to save'));
    } finally {
      setSaving(false);
    }
  };

  const ChipSelect = ({
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
  }) => (
    <div className="relative w-full" ref={dropdownRef}>
      <div
        className="min-h-[2.5rem] mt-1 px-3 py-1.5 pr-8 border border-black rounded-md bg-white flex flex-wrap items-center gap-1.5 cursor-pointer shadow-sm focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500"
        onClick={() => onToggleDropdown()}
      >
        {selected.map((item) => (
          <span key={item.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-sm">
            {item.name}
            <button type="button" onClick={(e) => { e.stopPropagation(); onRemove(item); }} className="hover:text-blue-600">×</button>
          </span>
        ))}
        {selected.length === 0 && <span className="text-gray-400 text-sm flex-1">{placeholder}</span>}
        <svg className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      {showDropdown && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => onToggleDropdown()} aria-hidden="true" />
          <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
            {options.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => { onToggle(item); if (item.id === '__ALL__') onToggleDropdown(); }}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${selected.some((s) => s.id === item.id) ? 'bg-blue-50' : ''}`}
              >
                {item.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );

  const SelectField = ({
    value,
    onChange,
    options,
    placeholder,
  }: {
    value: string;
    onChange: (v: string) => void;
    options: string[];
    placeholder?: string;
  }) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((opt) => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  );

  if (loading) {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
        <AppHeader title="Event Configuration" subtitle={organizationName ? `Organization: ${organizationName}` : undefined} onLogout={handleLogout} />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-gray-500">Loading...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader
        title="Event Configuration"
        subtitle={organizationName ? `Organization: ${organizationName}` : undefined}
        onLogout={handleLogout}
      />

      <main ref={mainRef} className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-6 bg-gray-50" onMouseDown={saveScrollPosition} onFocusCapture={saveScrollPosition}>
        <div className="w-full max-w-[95vw] mx-auto">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
            <nav className="flex items-center gap-1.5 text-sm text-gray-500">
              <Link to="/event-configuration" className="text-gray-500 hover:text-gray-900">Event Configuration</Link>
              <span className="mx-1 text-gray-400">/</span>
              <Link to="/event-configuration/auto-credit-setting" className="text-gray-500 hover:text-gray-900">Auto Credit Setting</Link>
              <span className="mx-1 text-gray-400">/</span>
              <span className="text-gray-900 font-medium">{isEdit ? 'Edit' : 'Add'}</span>
            </nav>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            {/* Header - same as employee add modal */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h1 className="text-lg font-semibold text-gray-900">
                {isEdit ? 'Edit Auto Credit Setting' : 'Auto Credit Setting'}
              </h1>
              <button
                type="button"
                onClick={handleCancel}
                className="text-gray-400 hover:text-gray-500 focus:outline-none"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSave}>
              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 text-sm text-red-700 rounded-md">{error}</div>
              )}

              {/* All fields under Auto Credit Setting - no sub-modules */}
              <div className="divide-y divide-gray-200 p-6">
                <FormRow label="Event (Attendance Component)" required>
                  <div className="relative" ref={eventComponentDropdownRef}>
                    <div
                      className="block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm cursor-pointer flex items-center pl-3 pr-10 sm:text-sm focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500"
                      onClick={() => setShowEventComponentDropdown(!showEventComponentDropdown)}
                    >
                      {eventId
                        ? (() => {
                            const c = attendanceComponents.find((x) => x.id === eventId);
                            return c ? `${c.shortName} - ${c.eventName}` : eventType || 'Select...';
                          })()
                        : <span className="text-gray-500">Select Event (Attendance Component)</span>}
                    </div>
                    <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    {showEventComponentDropdown && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowEventComponentDropdown(false)} aria-hidden="true" />
                        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                          {attendanceComponents.filter((c) => c.allowAutoCreditRule).map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setEventId(c.id);
                                setEventType(c.eventName);
                                setDisplayName(c.shortName);
                                setShowEventComponentDropdown(false);
                              }}
                              className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${eventId === c.id ? 'bg-blue-50' : ''}`}
                            >
                              {c.shortName} - {c.eventName}
                            </button>
                          ))}
                          {attendanceComponents.filter((c) => c.allowAutoCreditRule).length === 0 && (
                            <div className="px-4 py-2 text-sm text-gray-500">No components with auto-credit allowed</div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </FormRow>
                <FormRow label="Display Name" required>
                  <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. EL" className={inputClass} />
                </FormRow>
                <FormRow label="Associate">
                  <ChipSelect
                    selected={selectedAssociates}
                    onRemove={(item) =>
                      item.id === '__ALL__'
                        ? setSelectedAssociates([])
                        : setSelectedAssociates(selectedAssociates.filter((a) => a.id !== item.id))
                    }
                    onToggle={(item) => {
                      if (item.id === '__ALL__') {
                        setSelectedAssociates([{ id: '__ALL__', name: 'All' }]);
                      } else {
                        const hasAll = selectedAssociates.some((a) => a.id === '__ALL__');
                        if (hasAll) setSelectedAssociates([{ id: item.id, name: item.name }]);
                        else {
                          const exists = selectedAssociates.some((a) => a.id === item.id);
                          if (exists) setSelectedAssociates(selectedAssociates.filter((a) => a.id !== item.id));
                          else setSelectedAssociates([...selectedAssociates, { id: item.id, name: item.name }]);
                        }
                      }
                    }}
                    options={associateOptions}
                    placeholder="Select Associate(s) or All"
                    showDropdown={showAssociateDropdown}
                    onToggleDropdown={() => setShowAssociateDropdown(!showAssociateDropdown)}
                    dropdownRef={associateDropdownRef}
                  />
                </FormRow>
                <FormRow label="Paygroup">
                  <ChipSelect
                    selected={selectedPaygroups}
                    onRemove={(pg) => pg.id === '__ALL__' ? setSelectedPaygroups([]) : setSelectedPaygroups(selectedPaygroups.filter((p) => p.id !== pg.id))}
                    onToggle={(pg) => {
                      if (pg.id === '__ALL__') {
                        setSelectedPaygroups([{ id: '__ALL__', name: 'All' }]);
                      } else {
                        const hasAll = selectedPaygroups.some((p) => p.id === '__ALL__');
                        if (hasAll) setSelectedPaygroups([{ id: pg.id, name: pg.name }]);
                        else {
                          const exists = selectedPaygroups.some((p) => p.id === pg.id);
                          if (exists) setSelectedPaygroups(selectedPaygroups.filter((p) => p.id !== pg.id));
                          else setSelectedPaygroups([...selectedPaygroups, { id: pg.id, name: pg.name }]);
                        }
                      }
                    }}
                    options={[{ id: '__ALL__', name: 'All' }, ...paygroups]}
                    placeholder="Select Paygroup"
                    showDropdown={showPaygroupDropdown}
                    onToggleDropdown={() => setShowPaygroupDropdown(!showPaygroupDropdown)}
                    dropdownRef={paygroupDropdownRef}
                  />
                </FormRow>
                <FormRow label="Department">
                  <ChipSelect
                    selected={selectedDepartments}
                    onRemove={(d) => d.id === '__ALL__' ? setSelectedDepartments([]) : setSelectedDepartments(selectedDepartments.filter((x) => x.id !== d.id))}
                    onToggle={(d) => {
                      if (d.id === '__ALL__') {
                        setSelectedDepartments([{ id: '__ALL__', name: 'All' }]);
                      } else {
                        const hasAll = selectedDepartments.some((x) => x.id === '__ALL__');
                        if (hasAll) setSelectedDepartments([{ id: d.id, name: d.name }]);
                        else {
                          const exists = selectedDepartments.some((x) => x.id === d.id);
                          if (exists) setSelectedDepartments(selectedDepartments.filter((x) => x.id !== d.id));
                          else setSelectedDepartments([...selectedDepartments, { id: d.id, name: d.name }]);
                        }
                      }
                    }}
                    options={[{ id: '__ALL__', name: 'All' }, ...departments]}
                    placeholder="Select Department"
                    showDropdown={showDepartmentDropdown}
                    onToggleDropdown={() => setShowDepartmentDropdown(!showDepartmentDropdown)}
                    dropdownRef={departmentDropdownRef}
                  />
                </FormRow>
                <FormRow label="Effective Date" required>
                  <input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} className={inputClass} />
                </FormRow>
                <FormRow label="Priority">
                  <input type="number" value={priority} onChange={(e) => setPriority(e.target.value === '' ? '' : Number(e.target.value))} placeholder="0" className={inputClass} />
                </FormRow>
                <FormRow label="Remarks">
                  <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={4} placeholder="Remarks"
                    className="block w-full bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
                </FormRow>
                <h3 className="text-lg font-semibold text-blue-600 border-b-2 border-blue-600 pb-1 inline-block mt-6 mb-2">Auto Credit Rule</h3>
                <FormRow label="Periodicity" required>
                  <SelectField value={periodicity} onChange={setPeriodicity} options={['Annually', 'Monthly', 'Quarterly', 'Half Yearly']} placeholder="Select Periodicity" />
                </FormRow>
                <FormRow label="Effective From" required>
                  <SelectField value={effectiveFrom} onChange={setEffectiveFrom} options={['Date of Joining', 'Calendar Year Start', 'Financial Year Start']} placeholder="Select Effective From" />
                </FormRow>
                <FormRow label="Wait for">
                  <div className="flex gap-2">
                    <input type="number" value={waitFor} onChange={(e) => setWaitFor(e.target.value === '' ? '' : Number(e.target.value))} placeholder="0" className={inputClass} />
                    <select value={waitForUnit} onChange={(e) => setWaitForUnit(e.target.value)} className={inputClass}>
                      <option value="">Select Unit</option>
                      <option value="Days">Days</option>
                      <option value="Weeks">Weeks</option>
                      <option value="Months">Months</option>
                    </select>
                  </div>
                </FormRow>
                <FormRow label="Credit Based On">
                  <div className="flex gap-6 py-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="creditBasedOn" checked={creditBasedOn === ''} onChange={() => setCreditBasedOn('')} className="text-blue-600" />
                      <span className="text-sm text-gray-500">Select</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="creditBasedOn" checked={creditBasedOn === 'Calendar Period'} onChange={() => setCreditBasedOn('Calendar Period')} className="text-blue-600" />
                      <span className="text-sm">Calendar Period</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="creditBasedOn" checked={creditBasedOn === 'Attendance Period'} onChange={() => setCreditBasedOn('Attendance Period')} className="text-blue-600" />
                      <span className="text-sm">Attendance Period</span>
                    </label>
                  </div>
                </FormRow>
                <FormRow label="Days Calculation">
                  <div className="flex flex-col gap-2 py-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="daysCalculation" checked={daysCalculation === ''} onChange={() => setDaysCalculation('')} className="text-blue-600" />
                      <span className="text-sm text-gray-500">Select</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="daysCalculation" checked={daysCalculation === 'Full Credit'} onChange={() => setDaysCalculation('Full Credit')} className="text-blue-600" />
                      <span className="text-sm">Full Credit</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="daysCalculation" checked={daysCalculation === 'Prorata on date basis'} onChange={() => setDaysCalculation('Prorata on date basis')} className="text-blue-600" />
                      <span className="text-sm">Prorata on date basis</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="daysCalculation" checked={daysCalculation === 'Prorata on month basis'} onChange={() => setDaysCalculation('Prorata on month basis')} className="text-blue-600" />
                      <span className="text-sm">Prorata on month basis</span>
                    </label>
                  </div>
                </FormRow>
                <FormRow label="Joining Period Credit">
                  <ToggleSwitch value={joiningPeriodCredit} onChange={setJoiningPeriodCredit} />
                </FormRow>
                <FormRow label="Probation Credit">
                  <ToggleSwitch value={probationCredit} onChange={setProbationCredit} />
                </FormRow>
                <FormRow label="Entitlement Days" required>
                  <input type="number" value={entitlementDays} onChange={(e) => setEntitlementDays(e.target.value === '' ? '' : Number(e.target.value))} placeholder="0" className={inputClass} />
                </FormRow>
                <FormRow label="Round Off">
                  <ToggleSwitch value={roundOff} onChange={setRoundOff} />
                </FormRow>
                <FormRow label="Round Off Nature">
                  <SelectField value={roundOffNature} onChange={setRoundOffNature} options={['Round', 'Round Up', 'Round Down']} placeholder="Select Round Off Nature" />
                </FormRow>
                <FormRow label="Round Off Value">
                  <input type="number" step="0.1" value={roundOffValue} onChange={(e) => setRoundOffValue(e.target.value === '' ? '' : Number(e.target.value))} placeholder="0" className={inputClass} />
                </FormRow>
                <FormRow label="Carry Forward Next Period">
                  <ToggleSwitch value={carryForwardNextPeriod} onChange={setCarryForwardNextPeriod} />
                </FormRow>
                <FormRow label="Expire In Month">
                  <input type="number" value={expireInMonth} onChange={(e) => setExpireInMonth(e.target.value === '' ? '' : Number(e.target.value))} placeholder="0" className={inputClass} />
                </FormRow>
                <FormRow label="Day of Credit Period">
                  <input type="text" value={dayOfCreditPeriod} onChange={(e) => setDayOfCreditPeriod(e.target.value)} placeholder="Day of Credit Period" className={inputClass} />
                </FormRow>
                <FormRow label="Credit Base on Previous Work Days">
                  <ToggleSwitch value={creditBaseOnPreviousWorkDays} onChange={setCreditBaseOnPreviousWorkDays} />
                </FormRow>
                <FormRow label="Effective To">
                  <div>
                    <input type="date" value={effectiveTo} onChange={(e) => setEffectiveTo(e.target.value)} placeholder="Effective To" className={inputClass} />
                    <p className="mt-1.5 text-sm text-green-600">Note: If you choose this field credit will not work after effective to field for the Associate</p>
                  </div>
                </FormRow>
              </div>

              <div className="flex items-center justify-end gap-4 px-6 py-6 border-t border-gray-200 bg-white">
                <button type="button" onClick={handleCancel} className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-gray-300 bg-white text-gray-600 text-sm font-medium shadow-sm hover:bg-gray-50">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-transparent bg-green-600 text-white text-sm font-medium shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
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
