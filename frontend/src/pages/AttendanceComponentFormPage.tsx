import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';
import attendanceComponentService from '../services/attendanceComponent.service';

interface EventRule {
  id: string;
  name: string;
  enabled: boolean;
}

const EVENT_CATEGORIES = ['Leave', 'Onduty', 'Permission', 'Holiday', 'Present'] as const;
const EVENT_ENTRY_FORMS = ['Event Entry Form', 'Default'] as const;
const AUTO_CREDIT_ENGINES = ['Auto Credit Engine', 'Default'] as const;
const ENCASHMENT_OPTIONS = ['Default', 'None'] as const;

// Available event rules that can be selected
const AVAILABLE_EVENT_RULES: Omit<EventRule, 'enabled'>[] = [
  { id: 'datewise', name: 'DateWise Rule' },
  // Add more rules as needed
];

export default function AttendanceComponentFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const { user, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;
  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id;

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Basic fields
  const [shortName, setShortName] = useState('');
  const [eventName, setEventName] = useState('');
  const [description, setDescription] = useState('');
  const [eventCategory, setEventCategory] = useState<string>('');
  const [priority, setPriority] = useState('');

  // Toggle switches - all default to false (OFF) when adding new component
  const [authorized, setAuthorized] = useState(false);
  const [considerAsWorkHours, setConsiderAsWorkHours] = useState(false);
  const [hasBalance, setHasBalance] = useState(false);
  const [creditFromOverTime, setCreditFromOverTime] = useState(false);
  const [allowBalanceEntry, setAllowBalanceEntry] = useState(false);
  const [allowEventOpeningRule, setAllowEventOpeningRule] = useState(false);
  const [allowAutoCreditRule, setAllowAutoCreditRule] = useState(false);
  const [allowHourly, setAllowHourly] = useState(false);
  const [allowDatewise, setAllowDatewise] = useState(false);
  const [allowWeekOffSelection, setAllowWeekOffSelection] = useState(false);
  const [allowHolidaySelection, setAllowHolidaySelection] = useState(false);
  const [applicableForRegularization, setApplicableForRegularization] = useState(false);
  const [allowDifferentLeavePeriod, setAllowDifferentLeavePeriod] = useState(false);
  const [allowEventChange, setAllowEventChange] = useState(false);
  const [validationRemarksMandatory, setValidationRemarksMandatory] = useState(false);
  const [leaveDeductionWhileInFandF, setLeaveDeductionWhileInFandF] = useState(false);

  // Other fields
  const [cannotOverlapWith, setCannotOverlapWith] = useState<string[]>([]);
  const [eventEntryForm, setEventEntryForm] = useState<string>('');
  const [autoCreditEngine, setAutoCreditEngine] = useState<string>('');
  const [encashment, setEncashment] = useState<string>('Default');
  const [sendMailToOnEntry, setSendMailToOnEntry] = useState(false);
  const [sendSMSToOnEntry, setSendSMSToOnEntry] = useState(false);

  // Event Rules
  const [eventRules, setEventRules] = useState<EventRule[]>([]);

  // Multi-select for "Can't overlap with"
  const [showOverlapDropdown, setShowOverlapDropdown] = useState(false);
  const overlapDropdownRef = useRef<HTMLDivElement>(null);

  // Available components for "Can't overlap with" (would come from API)
  const availableComponents = [
    'Earned Leave',
    'Loss of Pay',
    'Sick Leave',
    'Casual Leave',
    'Maternity Leave',
    'Comp Off',
    'Paternity Leave',
  ];

  useEffect(() => {
    // Initialize event rules
    setEventRules(
      AVAILABLE_EVENT_RULES.map((rule) => ({
        ...rule,
        enabled: false,
      }))
    );
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (overlapDropdownRef.current && !overlapDropdownRef.current.contains(event.target as Node)) {
        setShowOverlapDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!id || !organizationId) return;
    setLoading(true);
    setError(null);
    attendanceComponentService
      .getById(id)
      .then((component) => {
        setShortName(component.shortName);
        setEventName(component.eventName);
        setDescription(component.description || '');
        setEventCategory(component.eventCategory);
        setPriority(component.priority != null ? String(component.priority) : '');
        setAuthorized(component.authorized);
        setConsiderAsWorkHours(component.considerAsWorkHours);
        setHasBalance(component.hasBalance);
        setCreditFromOverTime(component.creditFromOverTime);
        setAllowBalanceEntry(component.allowBalanceEntry);
        setAllowEventOpeningRule(component.allowEventOpeningRule);
        setAllowAutoCreditRule(component.allowAutoCreditRule);
        setAllowHourly(component.allowHourly);
        setAllowDatewise(component.allowDatewise);
        setAllowWeekOffSelection(component.allowWeekOffSelection);
        setAllowHolidaySelection(component.allowHolidaySelection);
        setApplicableForRegularization(component.applicableForRegularization);
        setAllowDifferentLeavePeriod(component.allowDifferentLeavePeriod);
        setAllowEventChange(component.allowEventChange);
        setValidationRemarksMandatory(component.validationRemarksMandatory);
        setLeaveDeductionWhileInFandF(component.leaveDeductionWhileInFandF);
        setCannotOverlapWith(component.cannotOverlapWith ? component.cannotOverlapWith.split(',').map(s => s.trim()) : []);
        setEventEntryForm(component.eventEntryForm || '');
        setAutoCreditEngine(component.autoCreditEngine || '');
        setEncashment(component.encashment || 'Default');
        setSendMailToOnEntry(component.sendMailToOnEntry);
        setSendSMSToOnEntry(component.sendSMSToOnEntry);
        // Event rules would be loaded separately if needed
        setEventRules(
          AVAILABLE_EVENT_RULES.map((rule) => ({
            ...rule,
            enabled: false, // This would come from API if event rules are stored
          }))
        );
      })
      .catch((err: unknown) => {
        const msg =
          err && typeof err === 'object' && 'response' in err
            ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
            : 'Failed to load component';
        setError(String(msg || 'Failed to load component'));
      })
      .finally(() => setLoading(false));
  }, [id, organizationId]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleCancel = () => navigate('/event-configuration/attendance-components');

  const toggleOverlapComponent = (component: string) => {
    setCannotOverlapWith((prev) =>
      prev.includes(component) ? prev.filter((c) => c !== component) : [...prev, component]
    );
  };

  const toggleEventRule = (ruleId: string) => {
    setEventRules((prev) =>
      prev.map((rule) => (rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule))
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId) return;
    if (!shortName.trim()) {
      setError('Short Name is required.');
      return;
    }
    if (!eventName.trim()) {
      setError('Event Name is required.');
      return;
    }
    if (!eventCategory) {
      setError('Event Category is required.');
      return;
    }

    setError(null);
    setSaving(true);
    try {
      const payload = {
        organizationId: organizationId!,
        shortName: shortName.trim(),
        eventName: eventName.trim(),
        description: description.trim() || undefined,
        eventCategory,
        authorized,
        considerAsWorkHours,
        hasBalance,
        creditFromOverTime,
        allowBalanceEntry,
        allowEventOpeningRule,
        allowAutoCreditRule,
        allowHourly,
        allowDatewise,
        allowWeekOffSelection,
        allowHolidaySelection,
        applicableForRegularization,
        allowDifferentLeavePeriod,
        allowEventChange,
        validationRemarksMandatory,
        leaveDeductionWhileInFandF,
        cannotOverlapWith: cannotOverlapWith.length > 0 ? cannotOverlapWith : undefined,
        priority: priority.trim() ? Number(priority) : undefined,
        eventEntryForm: eventEntryForm || undefined,
        autoCreditEngine: autoCreditEngine || undefined,
        encashment: encashment || undefined,
        sendMailToOnEntry,
        sendSMSToOnEntry,
      };

      if (isEdit && id) {
        await attendanceComponentService.update(id, payload);
      } else {
        await attendanceComponentService.create(payload);
      }
      navigate('/event-configuration/attendance-components');
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

  const ToggleSwitch = ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: boolean;
    onChange: (value: boolean) => void;
  }) => (
    <div className="flex items-center justify-between py-2">
      <label className="text-sm font-medium text-gray-700">{label}</label>
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
          />
        </button>
        <span className={`text-sm font-semibold w-10 text-center ${value ? 'text-green-600' : 'text-red-600'}`}>
          {value ? 'YES' : 'NO'}
        </span>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader
        title="Event Configuration"
        subtitle={organizationName ? `Organization: ${organizationName}` : undefined}
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
            <Link to="/event-configuration/attendance-components" className="hover:text-gray-900">Attendance Components</Link>
            <span className="mx-2">/</span>
            <span className="text-gray-900 font-medium">{isEdit ? 'Edit' : 'Add'}</span>
          </nav>

          {/* Form */}
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="bg-white px-6 py-4 border-b border-gray-200">
              <h1 className="text-lg font-semibold text-black">Attendance Components</h1>
            </div>
            <div className="p-6 !bg-white">
              {loading ? (
                <div className="py-8 text-center text-gray-500">Loading...</div>
              ) : (
                <form onSubmit={handleSave} className="space-y-6">
                  {/* Basic Fields - Grid layout like Employee form */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Short Name <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={shortName}
                        onChange={(e) => setShortName(e.target.value)}
                        placeholder="e.g. EL"
                        className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm sm:text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Event Name <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={eventName}
                        onChange={(e) => setEventName(e.target.value)}
                        placeholder="e.g. Earned Leave"
                        className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm sm:text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">Description</label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={3}
                        className="mt-1 block w-full bg-white text-black rounded-md border border-black shadow-sm sm:text-sm resize-y focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Description"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Event Category <span className="text-red-500">*</span></label>
                      <select
                        value={eventCategory}
                        onChange={(e) => setEventCategory(e.target.value)}
                        className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm sm:text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">-- Select --</option>
                        {EVENT_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Toggle Switches Section */}
                  <div className="border-t border-gray-200 pt-6">
                    <h2 className="text-base font-semibold text-gray-800 border-b-2 border-gray-300 pb-1 inline-block mb-4">
                      Configuration Options
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                      <ToggleSwitch label="Authorized" value={authorized} onChange={setAuthorized} />
                      <ToggleSwitch label="Consider as work hours" value={considerAsWorkHours} onChange={setConsiderAsWorkHours} />
                      <ToggleSwitch label="Has balance" value={hasBalance} onChange={setHasBalance} />
                      <ToggleSwitch label="Credit from Over Time" value={creditFromOverTime} onChange={setCreditFromOverTime} />
                      <ToggleSwitch label="Allow Balance Entry" value={allowBalanceEntry} onChange={setAllowBalanceEntry} />
                      <ToggleSwitch label="Allow Event Opening Rule" value={allowEventOpeningRule} onChange={setAllowEventOpeningRule} />
                      <ToggleSwitch label="Allow Auto Credit Rule" value={allowAutoCreditRule} onChange={setAllowAutoCreditRule} />
                      <ToggleSwitch label="Allow Hourly" value={allowHourly} onChange={setAllowHourly} />
                      <ToggleSwitch label="Allow Datewise" value={allowDatewise} onChange={setAllowDatewise} />
                      <ToggleSwitch label="Allow WeekOff Selection" value={allowWeekOffSelection} onChange={setAllowWeekOffSelection} />
                      <ToggleSwitch label="Allow Holiday Selection" value={allowHolidaySelection} onChange={setAllowHolidaySelection} />
                      <ToggleSwitch label="Applicable for Regularization" value={applicableForRegularization} onChange={setApplicableForRegularization} />
                      <ToggleSwitch label="Allow Different Leave Period" value={allowDifferentLeavePeriod} onChange={setAllowDifferentLeavePeriod} />
                      <ToggleSwitch label="Allow Event Change" value={allowEventChange} onChange={setAllowEventChange} />
                      <ToggleSwitch label="Validation Remarks Mandatory" value={validationRemarksMandatory} onChange={setValidationRemarksMandatory} />
                    </div>
                  </div>

                  {/* Additional Fields - Grid layout like Employee form */}
                  <div className="border-t border-gray-200 pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Priority</label>
                        <input
                          type="text"
                          value={priority}
                          onChange={(e) => setPriority(e.target.value)}
                          placeholder="Priority"
                          className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm sm:text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Event Entry Form</label>
                        <select
                          value={eventEntryForm}
                          onChange={(e) => setEventEntryForm(e.target.value)}
                          className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm sm:text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="">-- Select --</option>
                          {EVENT_ENTRY_FORMS.map((form) => (
                            <option key={form} value={form}>
                              {form}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Auto Credit Engine</label>
                        <select
                          value={autoCreditEngine}
                          onChange={(e) => setAutoCreditEngine(e.target.value)}
                          className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm sm:text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="">-- Select --</option>
                          {AUTO_CREDIT_ENGINES.map((engine) => (
                            <option key={engine} value={engine}>
                              {engine}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Encashment</label>
                        <div className="flex items-center gap-2">
                          <select
                            value={encashment}
                            onChange={(e) => setEncashment(e.target.value)}
                            className="mt-1 flex-1 block h-10 bg-white text-black rounded-md border border-black shadow-sm sm:text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            {ENCASHMENT_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                          {encashment && (
                            <button
                              type="button"
                              onClick={() => setEncashment('')}
                              className="mt-1 p-1 text-gray-500 hover:text-gray-700"
                              title="Clear"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700">Can't overlap with</label>
                      <div className="relative mt-1" ref={overlapDropdownRef}>
                        <div className="flex flex-wrap gap-2 min-h-[2.5rem] rounded-md border border-black shadow-sm px-3 py-2 bg-white">
                          {cannotOverlapWith.map((comp) => (
                            <span
                              key={comp}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-100 text-blue-800 text-sm"
                            >
                              {comp}
                              <button
                                type="button"
                                onClick={() => toggleOverlapComponent(comp)}
                                className="ml-1 text-blue-600 hover:text-blue-900"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                          <input
                            type="text"
                            onFocus={() => setShowOverlapDropdown(true)}
                            placeholder={cannotOverlapWith.length === 0 ? "Select components..." : ""}
                            className="min-w-[140px] flex-1 border-0 bg-white p-0 text-sm text-black placeholder:text-gray-400 focus:ring-0 focus:outline-none"
                          />
                        </div>
                        {showOverlapDropdown && (
                          <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                            {availableComponents
                              .filter((comp) => !cannotOverlapWith.includes(comp))
                              .map((comp) => (
                                <button
                                  key={comp}
                                  type="button"
                                  onClick={() => {
                                    toggleOverlapComponent(comp);
                                    setShowOverlapDropdown(false);
                                  }}
                                  className="w-full text-left px-3 py-2 text-sm text-gray-900 hover:bg-gray-100"
                                >
                                  {comp}
                                </button>
                              ))}
                            {availableComponents.filter((comp) => !cannotOverlapWith.includes(comp)).length === 0 && (
                              <div className="px-3 py-2 text-sm text-gray-500">All components selected</div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mt-4">
                      <ToggleSwitch
                        label="Leave Deduction while in FandF"
                        value={leaveDeductionWhileInFandF}
                        onChange={setLeaveDeductionWhileInFandF}
                      />
                    </div>
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700">Send</label>
                      <div className="flex items-center gap-6 mt-1">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={sendMailToOnEntry}
                            onChange={(e) => setSendMailToOnEntry(e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">Mail To On Entry</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={sendSMSToOnEntry}
                            onChange={(e) => setSendSMSToOnEntry(e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">SMS To On Entry</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Event Rules Section */}
                  <div className="border-t border-gray-200 pt-6">
                    <h2 className="text-base font-semibold text-gray-800 border-b-2 border-gray-300 pb-1 inline-block mb-4">
                      Event Rules
                    </h2>
                    <div className="space-y-3">
                      {eventRules.map((rule) => (
                        <div key={rule.id} className="flex items-center gap-3 p-3 border border-blue-200 rounded-lg bg-blue-50">
                          <button
                            type="button"
                            onClick={() => toggleEventRule(rule.id)}
                            className="flex-shrink-0"
                          >
                            <svg
                              className={`w-5 h-5 ${rule.enabled ? 'text-green-600' : 'text-gray-400'}`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                          </button>
                          <span className="text-sm font-medium text-gray-700 flex-1">{rule.name}</span>
                          <span className={`text-xs font-medium px-2 py-1 rounded ${rule.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                            {rule.enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                      ))}
                      {eventRules.length === 0 && (
                        <p className="text-sm text-gray-500 py-4">No event rules available</p>
                      )}
                    </div>
                  </div>

                  {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {error}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between border-t border-gray-200 pt-6">
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 transition disabled:opacity-50"
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
