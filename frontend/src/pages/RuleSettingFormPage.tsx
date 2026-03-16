import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';
import paygroupService from '../services/paygroup.service';
import departmentService from '../services/department.service';
import employeeService, { Employee } from '../services/employee.service';
import ruleSettingService from '../services/ruleSetting.service';
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
const tableInputClass = 'block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm';

function ToggleSwitch({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-8 w-14 shrink-0 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
          value ? 'bg-blue-600' : 'bg-red-500'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${
            value ? 'translate-x-6 mt-1 ml-1' : 'translate-x-1 mt-1'
          }`}
        />
      </button>
      <span className={`text-sm font-medium ${value ? 'text-blue-700' : 'text-red-700'}`}>
        {value ? 'YES' : 'NO'}
      </span>
    </div>
  );
}

export default function RuleSettingFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const isEdit = Boolean(id);
  const { user, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;
  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id;

  const stateEventType = (location.state as { eventType?: string })?.eventType;
  const [eventType, setEventType] = useState(stateEventType || '');
  const [eventId, setEventId] = useState<string | null>(null);
  const [attendanceComponents, setAttendanceComponents] = useState<AttendanceComponent[]>([]);
  const [showEventComponentDropdown, setShowEventComponentDropdown] = useState(false);
  const eventComponentDropdownRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [selectedAssociates, setSelectedAssociates] = useState<{ id: string; name: string }[]>([]);
  const [selectedPaygroups, setSelectedPaygroups] = useState<Option[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<Option[]>([]);
  const [remarks, setRemarks] = useState('');

  // Event Rule Definition - all start unselected; user selects when needed
  const [allowEventOnNoticePeriodDays, setAllowEventOnNoticePeriodDays] = useState(false);
  const [allowEventOnWeekoff, setAllowEventOnWeekoff] = useState(false);
  const [countWeekoffAsEvent, setCountWeekoffAsEvent] = useState(false);
  const [canEventClubWithWeekoff, setCanEventClubWithWeekoff] = useState(false);
  const [allowEventOnHoliday, setAllowEventOnHoliday] = useState(false);
  const [countHolidayAsEvent, setCountHolidayAsEvent] = useState(false);
  const [canEventClubWithHoliday, setCanEventClubWithHoliday] = useState(false);
  const [minEventAvailDays, setMinEventAvailDays] = useState('');
  const [maxEventAvailDaysInMonth, setMaxEventAvailDaysInMonth] = useState('');
  const [maxEventAvailDaysInQuarter, setMaxEventAvailDaysInQuarter] = useState('');
  const [maxEventAvailDaysInYear, setMaxEventAvailDaysInYear] = useState('');

  // Event availability rules
  const [maxEventAvailDays, setMaxEventAvailDays] = useState('');
  const [eventCannotClubWithOther, setEventCannotClubWithOther] = useState('');
  const [allowOnlyFullDayOnSaturday, setAllowOnlyFullDayOnSaturday] = useState(false);
  const [allowForPastDays, setAllowForPastDays] = useState('');
  const [occasionsInMonth, setOccasionsInMonth] = useState('');
  const [occasionsInQuarter, setOccasionsInQuarter] = useState('');
  const [occasionsInYear, setOccasionsInYear] = useState('');
  const [blockUntilHasBalance, setBlockUntilHasBalance] = useState('');
  const [occasionsInHalfYearly, setOccasionsInHalfYearly] = useState('');
  const [maxEventAvailDaysHalfYearly, setMaxEventAvailDaysHalfYearly] = useState('');
  const [occasionsInCareer, setOccasionsInCareer] = useState('');

  // Eligibility / Interval
  const [eligibilityCriteriaMonths, setEligibilityCriteriaMonths] = useState('');
  const [intervalBetweenEventsMonths, setIntervalBetweenEventsMonths] = useState('');
  const [allowFullDayOrFirstHalf, setAllowFullDayOrFirstHalf] = useState('');
  const [requestInAdvanceDays, setRequestInAdvanceDays] = useState('');
  const [allowEventForFutureDays, setAllowEventForFutureDays] = useState('');

  const [paygroups, setPaygroups] = useState<Option[]>([]);
  const [departments, setDepartments] = useState<Option[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showPaygroupDropdown, setShowPaygroupDropdown] = useState(false);
  const [showDepartmentDropdown, setShowDepartmentDropdown] = useState(false);
  const [showAssociateDropdown, setShowAssociateDropdown] = useState(false);
  const [loadedAssociateIds, setLoadedAssociateIds] = useState<string[]>([]);
  const paygroupDropdownRef = useRef<HTMLDivElement>(null);
  const departmentDropdownRef = useRef<HTMLDivElement>(null);
  const associateDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (stateEventType) setEventType(stateEventType);
  }, [stateEventType]);

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
      if (eventComponentDropdownRef.current && !eventComponentDropdownRef.current.contains(event.target as Node)) {
        setShowEventComponentDropdown(false);
      }
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


  useEffect(() => {
    if (!isEdit || !id || !organizationId) return;
    setLoading(true);
    setError(null);
    ruleSettingService
      .getById(id)
      .then((data) => {
        setEventType(data.eventType);
        setEventId(data.eventId || null);
        setDisplayName(data.displayName);
        if (data.associateIds && Array.isArray(data.associateIds) && data.associateIds.length > 0) {
          setLoadedAssociateIds(data.associateIds);
        } else if (data.associate) {
          setLoadedAssociateIds([data.associate]);
        } else {
          setLoadedAssociateIds([]);
        }
        setRemarks(data.remarks || '');
        if (data.paygroup) {
          setSelectedPaygroups([{ id: data.paygroup.id, name: data.paygroup.name }]);
        } else {
          setSelectedPaygroups([{ id: '__ALL__', name: 'All' }]);
        }
        if (data.department) {
          setSelectedDepartments([{ id: data.department.id, name: data.department.name }]);
        } else {
          setSelectedDepartments([{ id: '__ALL__', name: 'All' }]);
        }
        const rules = data.eventRuleDefinition;
        if (rules) {
          if (typeof rules.allowEventOnNoticePeriodDays === 'boolean') setAllowEventOnNoticePeriodDays(rules.allowEventOnNoticePeriodDays);
          if (typeof rules.allowEventOnWeekoff === 'boolean') setAllowEventOnWeekoff(rules.allowEventOnWeekoff);
          if (typeof rules.countWeekoffAsEvent === 'boolean') setCountWeekoffAsEvent(rules.countWeekoffAsEvent);
          if (typeof rules.canEventClubWithWeekoff === 'boolean') setCanEventClubWithWeekoff(rules.canEventClubWithWeekoff);
          if (typeof rules.allowEventOnHoliday === 'boolean') setAllowEventOnHoliday(rules.allowEventOnHoliday);
          if (typeof rules.countHolidayAsEvent === 'boolean') setCountHolidayAsEvent(rules.countHolidayAsEvent);
          if (typeof rules.canEventClubWithHoliday === 'boolean') setCanEventClubWithHoliday(rules.canEventClubWithHoliday);
          if (typeof rules.allowOnlyFullDayOnSaturday === 'boolean') setAllowOnlyFullDayOnSaturday(rules.allowOnlyFullDayOnSaturday);
          if (rules.minEventAvailDays != null) setMinEventAvailDays(String(rules.minEventAvailDays));
          if (rules.maxEventAvailDays != null) setMaxEventAvailDays(String(rules.maxEventAvailDays));
          if (rules.maxEventAvailDaysInMonth != null) setMaxEventAvailDaysInMonth(String(rules.maxEventAvailDaysInMonth));
          if (rules.maxEventAvailDaysInQuarter != null) setMaxEventAvailDaysInQuarter(String(rules.maxEventAvailDaysInQuarter));
          if (rules.maxEventAvailDaysInYear != null) setMaxEventAvailDaysInYear(String(rules.maxEventAvailDaysInYear));
          if (rules.eventCannotClubWithOther != null) setEventCannotClubWithOther(String(rules.eventCannotClubWithOther));
          if (rules.allowForPastDays != null) setAllowForPastDays(String(rules.allowForPastDays));
          if (rules.occasionsInMonth != null) setOccasionsInMonth(String(rules.occasionsInMonth));
          if (rules.occasionsInQuarter != null) setOccasionsInQuarter(String(rules.occasionsInQuarter));
          if (rules.occasionsInYear != null) setOccasionsInYear(String(rules.occasionsInYear));
          if (rules.blockUntilHasBalance != null) setBlockUntilHasBalance(String(rules.blockUntilHasBalance));
          if (rules.occasionsInHalfYearly != null) setOccasionsInHalfYearly(String(rules.occasionsInHalfYearly));
          if (rules.maxEventAvailDaysHalfYearly != null) setMaxEventAvailDaysHalfYearly(String(rules.maxEventAvailDaysHalfYearly));
          if (rules.occasionsInCareer != null) setOccasionsInCareer(String(rules.occasionsInCareer));
          if (rules.eligibilityCriteriaMonths != null) setEligibilityCriteriaMonths(String(rules.eligibilityCriteriaMonths));
          if (rules.intervalBetweenEventsMonths != null) setIntervalBetweenEventsMonths(String(rules.intervalBetweenEventsMonths));
          if (rules.allowFullDayOrFirstHalf != null) setAllowFullDayOrFirstHalf(String(rules.allowFullDayOrFirstHalf));
          if (rules.requestInAdvanceDays != null) setRequestInAdvanceDays(String(rules.requestInAdvanceDays));
          if (rules.allowEventForFutureDays != null) setAllowEventForFutureDays(String(rules.allowEventForFutureDays));
        }
        setLoading(false);
      })
      .catch((err) => {
        const msg =
          err && typeof err === 'object' && 'response' in err
            ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
            : 'Failed to load rule setting';
        setError(String(msg || 'Failed to load rule setting'));
        setLoading(false);
      });
  }, [id, organizationId, isEdit]);

  useEffect(() => {
    if (loadedAssociateIds.length === 0) {
      setSelectedAssociates([]);
      return;
    }
    if (employees.length === 0) return;
    const resolved = loadedAssociateIds
      .map((eid) => {
        const emp = employees.find((e) => e.id === eid || e.employeeCode === eid);
        return emp ? { id: emp.id, name: `${emp.employeeCode || ''} - ${fullName(emp)}`.trim() || emp.id } : null;
      })
      .filter((x): x is { id: string; name: string } => x != null);
    setSelectedAssociates(resolved);
  }, [loadedAssociateIds, employees]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleCancel = () => navigate('/event-configuration/rule-setting');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId) return;
    if (!eventType?.trim()) {
      setError('Please select an Attendance Component to set Event Type');
      return;
    }
    if (!displayName.trim()) {
      setError('Display Name is required');
      return;
    }

    setError(null);
    setSaving(true);
    try {
      const eventRuleDefinition = {
        allowEventOnNoticePeriodDays,
        allowEventOnWeekoff,
        countWeekoffAsEvent,
        canEventClubWithWeekoff,
        allowEventOnHoliday,
        countHolidayAsEvent,
        canEventClubWithHoliday,
        minEventAvailDays,
        maxEventAvailDays,
        maxEventAvailDaysInMonth,
        maxEventAvailDaysInQuarter,
        maxEventAvailDaysInYear,
        eventCannotClubWithOther,
        allowOnlyFullDayOnSaturday,
        allowForPastDays,
        occasionsInMonth,
        occasionsInQuarter,
        occasionsInYear,
        blockUntilHasBalance,
        occasionsInHalfYearly,
        maxEventAvailDaysHalfYearly,
        occasionsInCareer,
        eligibilityCriteriaMonths,
        intervalBetweenEventsMonths,
        allowFullDayOrFirstHalf,
        requestInAdvanceDays,
        allowEventForFutureDays,
      };
      const associateIds = selectedAssociates.some((a) => a.id === '__ALL__')
        ? null
        : selectedAssociates.length > 0
          ? selectedAssociates.map((a) => a.id).filter((id) => id !== '__ALL__')
          : null;
      const payload = {
        organizationId,
        eventId: eventId || undefined,
        eventType,
        displayName: displayName.trim(),
        associate: null,
        associateIds,
        paygroupId: selectedPaygroups[0]?.id === '__ALL__' || selectedPaygroups.length === 0 ? null : selectedPaygroups[0]?.id,
        departmentId: selectedDepartments[0]?.id === '__ALL__' || selectedDepartments.length === 0 ? null : selectedDepartments[0]?.id,
        priority: 0,
        remarks: remarks.trim() || undefined,
        eventRuleDefinition,
      };
      if (isEdit && id) {
        await ruleSettingService.update(id, payload);
      } else {
        await ruleSettingService.create(payload);
      }
      navigate('/event-configuration/rule-setting', { state: { eventType } });
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
          <span
            key={item.id}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-sm"
          >
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
                onClick={() => {
                  onToggle(item);
                  if (item.id === '__ALL__') onToggleDropdown();
                }}
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
          {/* Breadcrumbs */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
            <nav className="flex items-center gap-1.5 text-sm text-gray-500" aria-label="Breadcrumb">
              <Link to="/dashboard" className="text-gray-500 hover:text-gray-900">Home</Link>
              <span className="mx-1 text-gray-400">/</span>
              <Link to="/attendance" className="text-gray-500 hover:text-gray-900">Attendance</Link>
              <span className="mx-1 text-gray-400">/</span>
              <Link to="/event-configuration" className="text-gray-500 hover:text-gray-900">Event Configuration</Link>
              <span className="mx-1 text-gray-400">/</span>
              <Link to="/event-configuration/rule-setting" className="text-gray-500 hover:text-gray-900">Rules Setting</Link>
              <span className="mx-1 text-gray-400">/</span>
              <span className="text-gray-900 font-medium">{isEdit ? 'Edit' : 'Add'}</span>
            </nav>
          </div>

          {/* Page Title */}
          <h1 className="text-2xl font-bold text-gray-900 mb-6">{isEdit ? 'Edit Rule Setting' : 'Add Rule Setting'}</h1>

          {/* Full-body form card */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <form onSubmit={handleSave}>
              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 text-sm text-red-700 rounded-md">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Event (Attendance Component)</label>
                  <div className="relative" ref={eventComponentDropdownRef}>
                    <div
                      className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm cursor-pointer flex items-center pl-3 pr-10 sm:text-sm"
                      onClick={() => setShowEventComponentDropdown(!showEventComponentDropdown)}
                    >
                      {eventId
                        ? (() => {
                            const c = attendanceComponents.find((x) => x.id === eventId);
                            return c ? `${c.shortName} - ${c.eventName}` : 'Select...';
                          })()
                        : <span className="text-gray-500">Select Attendance Component (optional)</span>}
                    </div>
                    <svg className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    {showEventComponentDropdown && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowEventComponentDropdown(false)} aria-hidden="true" />
                        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                          <button
                            type="button"
                            onClick={() => {
                              setEventId(null);
                              setEventType('');
                              setDisplayName('');
                              setShowEventComponentDropdown(false);
                            }}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 text-gray-500"
                          >
                            (None)
                          </button>
                          {attendanceComponents.map((c) => (
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
                        </div>
                      </>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Links this rule to an Attendance Component (e.g. EL, CL). Event Type is auto-filled from selection.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Display Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. EL"
                    className={inputClass}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Associate</label>
                  <p className="text-xs text-gray-500 mb-1">Select one, multiple, or All. Rule applies to selected associates only.</p>
                  <ChipSelect
                    selected={selectedAssociates}
                    onRemove={(item) => {
                      if (item.id === '__ALL__') setSelectedAssociates([]);
                      else setSelectedAssociates(selectedAssociates.filter((a) => a.id !== item.id));
                    }}
                    onToggle={(item) => {
                      if (item.id === '__ALL__') {
                        setSelectedAssociates([{ id: '__ALL__', name: 'All' }]);
                      } else {
                        const withoutAll = selectedAssociates.filter((a) => a.id !== '__ALL__');
                        const exists = withoutAll.some((a) => a.id === item.id);
                        setSelectedAssociates(
                          exists ? withoutAll.filter((a) => a.id !== item.id) : [...withoutAll, item]
                        );
                      }
                    }}
                    options={[
                      { id: '__ALL__', name: 'All associates' },
                      ...employees.map((e) => ({
                        id: e.id,
                        name: `${e.employeeCode || e.id} - ${fullName(e)}`,
                      })),
                    ]}
                    placeholder="Select associate(s) or All"
                    showDropdown={showAssociateDropdown}
                    onToggleDropdown={() => setShowAssociateDropdown(!showAssociateDropdown)}
                    dropdownRef={associateDropdownRef}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Paygroup</label>
                  <ChipSelect
                    selected={selectedPaygroups}
                    onRemove={(pg) => pg.id === '__ALL__' ? setSelectedPaygroups([]) : setSelectedPaygroups(selectedPaygroups.filter((p) => p.id !== pg.id))}
                    onToggle={(pg) => {
                      if (pg.id === '__ALL__') setSelectedPaygroups([{ id: '__ALL__', name: 'All' }]);
                      else {
                        const withoutAll = selectedPaygroups.filter((p) => p.id !== '__ALL__');
                        const exists = withoutAll.some((p) => p.id === pg.id);
                        setSelectedPaygroups(exists ? withoutAll.filter((p) => p.id !== pg.id) : [...withoutAll, pg]);
                      }
                    }}
                    options={[{ id: '__ALL__', name: 'All' }, ...paygroups]}
                    placeholder="Select Paygroup"
                    showDropdown={showPaygroupDropdown}
                    onToggleDropdown={() => setShowPaygroupDropdown(!showPaygroupDropdown)}
                    dropdownRef={paygroupDropdownRef}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Department</label>
                  <ChipSelect
                    selected={selectedDepartments}
                    onRemove={(d) => d.id === '__ALL__' ? setSelectedDepartments([]) : setSelectedDepartments(selectedDepartments.filter((x) => x.id !== d.id))}
                    onToggle={(d) => {
                      if (d.id === '__ALL__') setSelectedDepartments([{ id: '__ALL__', name: 'All' }]);
                      else {
                        const withoutAll = selectedDepartments.filter((x) => x.id !== '__ALL__');
                        const exists = withoutAll.some((x) => x.id === d.id);
                        setSelectedDepartments(exists ? withoutAll.filter((x) => x.id !== d.id) : [...withoutAll, d]);
                      }
                    }}
                    options={[{ id: '__ALL__', name: 'All' }, ...departments]}
                    placeholder="Select Department"
                    showDropdown={showDepartmentDropdown}
                    onToggleDropdown={() => setShowDepartmentDropdown(!showDepartmentDropdown)}
                    dropdownRef={departmentDropdownRef}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Priority</label>
                  <input type="text" value="(Auto)" readOnly className={`${inputClass} bg-gray-100 text-gray-500`} />
                </div>
              </div>

              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700">Remarks</label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={4}
                  placeholder="Remarks"
                  className="mt-1 block w-full bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>

              {/* Event Rule Definition - single table with all rules */}
              <div className="mt-10">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Event Rule Definition
                </h3>
                <div className="border border-gray-200 rounded-md overflow-hidden shadow-sm">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 uppercase tracking-wider">Rule</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 uppercase tracking-wider">Value</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-700">Allow Event On Notice Period Days</td>
                        <td className="px-4 py-3">
                          <ToggleSwitch value={allowEventOnNoticePeriodDays} onChange={setAllowEventOnNoticePeriodDays} />
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-700">Allow event on weekoff</td>
                        <td className="px-4 py-3">
                          <ToggleSwitch value={allowEventOnWeekoff} onChange={setAllowEventOnWeekoff} />
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-700">Count weekoff as event</td>
                        <td className="px-4 py-3">
                          <ToggleSwitch value={countWeekoffAsEvent} onChange={setCountWeekoffAsEvent} />
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-700">Can event club with weekoff</td>
                        <td className="px-4 py-3">
                          <ToggleSwitch value={canEventClubWithWeekoff} onChange={setCanEventClubWithWeekoff} />
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-700">Allow event on holiday</td>
                        <td className="px-4 py-3">
                          <ToggleSwitch value={allowEventOnHoliday} onChange={setAllowEventOnHoliday} />
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-700">Count holiday as event</td>
                        <td className="px-4 py-3">
                          <ToggleSwitch value={countHolidayAsEvent} onChange={setCountHolidayAsEvent} />
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-700">Can event club with holiday</td>
                        <td className="px-4 py-3">
                          <ToggleSwitch value={canEventClubWithHoliday} onChange={setCanEventClubWithHoliday} />
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-700">Minimum event avail day(s)</td>
                        <td className="px-4 py-3">
                          <input type="text" value={minEventAvailDays} onChange={(e) => setMinEventAvailDays(e.target.value)} placeholder="Minimum event avail day(s)" className={tableInputClass} />
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-700">Maximum event avail day(s)</td>
                        <td className="px-4 py-3">
                          <input type="text" value={maxEventAvailDays} onChange={(e) => setMaxEventAvailDays(e.target.value)} placeholder="Maximum event avail day(s)" className={tableInputClass} />
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-700">Maximum event avail day(s) in a month</td>
                        <td className="px-4 py-3">
                          <input type="text" value={maxEventAvailDaysInMonth} onChange={(e) => setMaxEventAvailDaysInMonth(e.target.value)} placeholder="Maximum event avail day(s) in a month" className={tableInputClass} />
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-700">Maximum event avail day(s) in a quarter</td>
                        <td className="px-4 py-3">
                          <input type="text" value={maxEventAvailDaysInQuarter} onChange={(e) => setMaxEventAvailDaysInQuarter(e.target.value)} placeholder="Maximum event avail day(s) in a quarter" className={tableInputClass} />
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-700">Maximum event avail day(s) in a year</td>
                        <td className="px-4 py-3">
                          <input type="text" value={maxEventAvailDaysInYear} onChange={(e) => setMaxEventAvailDaysInYear(e.target.value)} placeholder="Maximum event avail day(s) in a year" className={tableInputClass} />
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-700">Event cannot club with other event types</td>
                        <td className="px-4 py-3">
                          <input type="text" value={eventCannotClubWithOther} onChange={(e) => setEventCannotClubWithOther(e.target.value)} placeholder="Event cannot club with other event types" className={tableInputClass} />
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-700">Allow only full day on saturday</td>
                        <td className="px-4 py-3">
                          <ToggleSwitch value={allowOnlyFullDayOnSaturday} onChange={setAllowOnlyFullDayOnSaturday} />
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-700">Allow for past day(s)</td>
                        <td className="px-4 py-3">
                          <input type="text" value={allowForPastDays} onChange={(e) => setAllowForPastDays(e.target.value)} placeholder="Allow for past day(s)" className={tableInputClass} />
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-700">Number of occasions to avail event in a month</td>
                        <td className="px-4 py-3">
                          <input type="text" value={occasionsInMonth} onChange={(e) => setOccasionsInMonth(e.target.value)} placeholder="Number of occasions to avail event in a month" className={tableInputClass} />
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-700">Number of occasions to avail event in a quater</td>
                        <td className="px-4 py-3">
                          <input type="text" value={occasionsInQuarter} onChange={(e) => setOccasionsInQuarter(e.target.value)} placeholder="Number of occasions to avail event in a quater" className={tableInputClass} />
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-700">Number of occasions to avail event in a year</td>
                        <td className="px-4 py-3">
                          <input type="text" value={occasionsInYear} onChange={(e) => setOccasionsInYear(e.target.value)} placeholder="Number of occasions to avail event in a year" className={tableInputClass} />
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-700">Block until has balance for this event type</td>
                        <td className="px-4 py-3">
                          <input type="text" value={blockUntilHasBalance} onChange={(e) => setBlockUntilHasBalance(e.target.value)} placeholder="Block until has balance for this event type" className={tableInputClass} />
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-700">Number of occasions to avail event in a half-yearly</td>
                        <td className="px-4 py-3">
                          <input type="text" value={occasionsInHalfYearly} onChange={(e) => setOccasionsInHalfYearly(e.target.value)} placeholder="Number of occasions to avail event in a half-yearly" className={tableInputClass} />
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-700">Maximum event avail day(s) in a half-yearly</td>
                        <td className="px-4 py-3">
                          <input type="text" value={maxEventAvailDaysHalfYearly} onChange={(e) => setMaxEventAvailDaysHalfYearly(e.target.value)} placeholder="Maximum event avail day(s) in a half-yearly" className={tableInputClass} />
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-700">How many occasion in a career be availed</td>
                        <td className="px-4 py-3">
                          <input type="text" value={occasionsInCareer} onChange={(e) => setOccasionsInCareer(e.target.value)} placeholder="How many occasion in a career be availed" className={tableInputClass} />
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-700">Eligibility Criteria (Months from DOJ)</td>
                        <td className="px-4 py-3">
                          <input type="text" value={eligibilityCriteriaMonths} onChange={(e) => setEligibilityCriteriaMonths(e.target.value)} placeholder="Eligibility Criteria (Months from DOJ)" className={tableInputClass} />
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-700">Interval Between Events (Months)</td>
                        <td className="px-4 py-3">
                          <input type="text" value={intervalBetweenEventsMonths} onChange={(e) => setIntervalBetweenEventsMonths(e.target.value)} placeholder="Interval Between Events (Months)" className={tableInputClass} />
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-700">Allow Full Day or First Half Day in Half Day Shift</td>
                        <td className="px-4 py-3">
                          <select value={allowFullDayOrFirstHalf} onChange={(e) => setAllowFullDayOrFirstHalf(e.target.value)} className={tableInputClass}>
                            <option value="">Select...</option>
                            <option value="Full Day">Full Day</option>
                            <option value="First Half Day">First Half Day</option>
                          </select>
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-700">Employee should request in advance before days</td>
                        <td className="px-4 py-3">
                          <input type="text" value={requestInAdvanceDays} onChange={(e) => setRequestInAdvanceDays(e.target.value)} placeholder="Employee should request in advance before days" className={tableInputClass} />
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-700">Allow event for future day(s)</td>
                        <td className="px-4 py-3">
                          <input type="text" value={allowEventForFutureDays} onChange={(e) => setAllowEventForFutureDays(e.target.value)} placeholder="Allow event for future day(s)" className={tableInputClass} />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-8 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md border border-black bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
                >
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
