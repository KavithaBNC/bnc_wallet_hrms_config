import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';
import shiftService from '../services/shift.service';
import rightsAllocationService from '../services/rightsAllocation.service';
import attendanceComponentService, { type AttendanceComponent } from '../services/attendanceComponent.service';

export default function RightsAllocationFormPage() {
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
  const [shortName, setShortName] = useState('');
  const [longName, setLongName] = useState('');
  const [remarks, setRemarks] = useState('');
  const [shiftId, setShiftId] = useState<string>('');
  const [maxExcessTimeRequestDays, setMaxExcessTimeRequestDays] = useState(120);
  const [monthlyRegularizationCount, setMonthlyRegularizationCount] = useState<number | ''>('');

  // Dropdowns
  const [shifts, setShifts] = useState<Array<{ id: string; name: string }>>([]);

  // Attendance Events table data - sourced from Attendance Components
  interface AttendanceEvent {
    id: string;
    name: string;
    applicable: boolean;
    view: boolean;
    add: boolean;
    cancel: boolean;
    delete: boolean;
    allowWeekOffSelection: boolean;
    allowHolidaySelection: boolean;
    maxDays: number | '';
    maxMinutes: number | '';
    allowHourly: boolean;  // from AttendanceComponent - show Min input
    allowDatewise: boolean; // from AttendanceComponent - show Day input
  }

  // Excess Time table data - sourced from Attendance Components (creditFromOverTime=true)
  interface ExcessTimeEvent {
    id: string;
    name: string;
    applicable: boolean;
    add: boolean;
    maxDays: number | '';
    maxMinutes: number | '';
    allowHourly: boolean;
    allowDatewise: boolean;
  }

  // Request Type table data
  interface RequestTypeEvent {
    id: string;
    name: string;
    applicable: boolean;
    view: boolean;
    add: boolean;
    cancel: boolean;
    delete: boolean;
  }

  // Regularization Elements table data
  interface RegularizationElement {
    id: string;
    name: string;
    applicable: boolean;
    view: boolean;
    add: boolean;
    cancel: boolean;
    delete: boolean;
  }

  const [attendanceComponents, setAttendanceComponents] = useState<AttendanceComponent[]>([]);
  const [attendanceEvents, setAttendanceEvents] = useState<AttendanceEvent[]>([]);
  const [savedAttendanceEvents, setSavedAttendanceEvents] = useState<AttendanceEvent[] | null>(null);

  const buildDefaultEvent = (c: AttendanceComponent): AttendanceEvent => ({
    id: c.id,
    name: c.eventName,
    applicable: false,
    view: false,
    add: false,
    cancel: false,
    delete: false,
    allowWeekOffSelection: false,
    allowHolidaySelection: false,
    maxDays: '',
    maxMinutes: '',
    allowHourly: c.allowHourly,
    allowDatewise: c.allowDatewise,
  });

  const mergeComponentsWithSaved = (components: AttendanceComponent[], saved: AttendanceEvent[]): AttendanceEvent[] => {
    const savedById = new Map(saved.map((e) => [e.id, e]));
    const savedByName = new Map(saved.map((e) => [e.name?.toLowerCase().trim(), e]));
    return components.map((c) => {
      const existing = savedById.get(c.id) ?? savedByName.get(c.eventName?.toLowerCase().trim());
      if (existing) {
        return {
          ...existing,
          id: c.id,
          name: c.eventName,
          allowHourly: c.allowHourly,
          allowDatewise: c.allowDatewise,
        };
      }
      return buildDefaultEvent(c);
    });
  };

  const buildDefaultExcessEvent = (c: AttendanceComponent): ExcessTimeEvent => ({
    id: c.id,
    name: `Excess time to ${c.eventName}`,
    applicable: false,
    add: false,
    maxDays: '',
    maxMinutes: '',
    allowHourly: c.allowHourly,
    allowDatewise: c.allowDatewise,
  });

  const mergeExcessComponentsWithSaved = (
    components: AttendanceComponent[],
    saved: ExcessTimeEvent[]
  ): ExcessTimeEvent[] => {
    const savedById = new Map(saved.map((e) => [e.id, e]));
    const savedByName = new Map(
      saved.map((e) => [e.name?.toLowerCase().replace(/^excess time to\s*/i, '').trim(), e])
    );
    return components.map((c) => {
      const existing =
        savedById.get(c.id) ?? savedByName.get(c.eventName?.toLowerCase().trim());
      if (existing) {
        return {
          ...existing,
          id: c.id,
          name: `Excess time to ${c.eventName}`,
          allowHourly: c.allowHourly,
          allowDatewise: c.allowDatewise,
        };
      }
      return buildDefaultExcessEvent(c);
    });
  };

  const [excessTimeEvents, setExcessTimeEvents] = useState<ExcessTimeEvent[]>([]);
  const [savedExcessTimeEvents, setSavedExcessTimeEvents] = useState<ExcessTimeEvent[] | null>(null);

  // Request Type events
  const [requestTypeEvents, setRequestTypeEvents] = useState<RequestTypeEvent[]>([]);

  // Regularization Elements
  const [regularizationElements, setRegularizationElements] = useState<RegularizationElement[]>([
    { id: 're1', name: 'Absent', applicable: false, view: false, add: false, cancel: false, delete: false },
    { id: 're2', name: 'Dual Record', applicable: false, view: false, add: false, cancel: false, delete: false },
    { id: 're3', name: 'Early Going', applicable: false, view: false, add: false, cancel: false, delete: false },
    { id: 're4', name: 'Excess Break', applicable: false, view: false, add: false, cancel: false, delete: false },
    { id: 're5', name: 'Late', applicable: false, view: false, add: false, cancel: false, delete: false },
    { id: 're6', name: 'No Out Punch', applicable: false, view: false, add: false, cancel: false, delete: false },
    { id: 're7', name: 'OverTime', applicable: false, view: false, add: false, cancel: false, delete: false },
    { id: 're8', name: 'Shortfall', applicable: false, view: false, add: false, cancel: false, delete: false },
  ]);

  // Column header select all handlers
  const handleSelectAll = (column: keyof AttendanceEvent, value: boolean) => {
    setAttendanceEvents((prev) =>
      prev.map((event) => ({
        ...event,
        [column]: value,
      }))
    );
  };

  const handleSelectAllAllow = (value: boolean) => {
    setAttendanceEvents((prev) =>
      prev.map((event) => ({
        ...event,
        allowWeekOffSelection: value,
        allowHolidaySelection: value,
      }))
    );
  };

  // Update individual event field
  const updateEventField = (eventId: string, field: keyof AttendanceEvent, value: boolean | number | '') => {
    setAttendanceEvents((prev) =>
      prev.map((event) => (event.id === eventId ? { ...event, [field]: value } : event))
    );
  };

  // Update excess time event field
  const updateExcessTimeField = (eventId: string, field: keyof ExcessTimeEvent, value: boolean | number | '') => {
    setExcessTimeEvents((prev) =>
      prev.map((event) => (event.id === eventId ? { ...event, [field]: value } : event))
    );
  };

  // Select all handlers for excess time table
  const handleExcessTimeSelectAll = (column: 'applicable' | 'add', value: boolean) => {
    setExcessTimeEvents((prev) =>
      prev.map((event) => ({
        ...event,
        [column]: value,
      }))
    );
  };

  // Update request type event field
  const updateRequestTypeField = (eventId: string, field: keyof RequestTypeEvent, value: boolean) => {
    setRequestTypeEvents((prev) =>
      prev.map((event) => (event.id === eventId ? { ...event, [field]: value } : event))
    );
  };

  // Select all handlers for request type table
  const handleRequestTypeSelectAll = (column: keyof RequestTypeEvent, value: boolean) => {
    setRequestTypeEvents((prev) =>
      prev.map((event) => ({
        ...event,
        [column]: value,
      }))
    );
  };

  // Update regularization element field
  const updateRegularizationElementField = (elementId: string, field: keyof RegularizationElement, value: boolean) => {
    setRegularizationElements((prev) =>
      prev.map((element) => (element.id === elementId ? { ...element, [field]: value } : element))
    );
  };

  // Select all handlers for regularization elements table
  const handleRegularizationSelectAll = (column: keyof RegularizationElement, value: boolean) => {
    setRegularizationElements((prev) =>
      prev.map((element) => ({
        ...element,
        [column]: value,
      }))
    );
  };

  // Fetch shifts and attendance components
  useEffect(() => {
    if (!organizationId) return;
    shiftService
      .getAll({ organizationId })
      .then((shiftsData) => {
        setShifts(shiftsData.shifts.map((s) => ({ id: s.id, name: s.name })));
      })
      .catch(() => {});
    attendanceComponentService
      .getAll({ organizationId, page: 1, limit: 500 })
      .then((res) => setAttendanceComponents(res.components || []))
      .catch(() => setAttendanceComponents([]));
  }, [organizationId]);

  // Build attendance events from components (dynamic list - only show components that exist)
  useEffect(() => {
    if (attendanceComponents.length === 0) return;
    if (isEdit && savedAttendanceEvents === null) return;
    const built =
      isEdit && savedAttendanceEvents
        ? mergeComponentsWithSaved(attendanceComponents, savedAttendanceEvents)
        : attendanceComponents.map(buildDefaultEvent);
    setAttendanceEvents(built);
  }, [attendanceComponents, savedAttendanceEvents, isEdit]);

  // Build excess time events from components (creditFromOverTime=true only)
  useEffect(() => {
    const excessComps = attendanceComponents.filter((c) => c.creditFromOverTime);
    if (excessComps.length === 0) return;
    if (isEdit && savedExcessTimeEvents === null) return;
    const built =
      isEdit && savedExcessTimeEvents
        ? mergeExcessComponentsWithSaved(excessComps, savedExcessTimeEvents)
        : excessComps.map(buildDefaultExcessEvent);
    setExcessTimeEvents(built);
  }, [attendanceComponents, savedExcessTimeEvents, isEdit]);

  // Load data in edit mode
  useEffect(() => {
    if (!isEdit || !id || !organizationId) return;
    setLoading(true);
    setError(null);
    rightsAllocationService
      .getById(id)
      .then((rule) => {
        setShortName(rule.shortName);
        setLongName(rule.longName);
        setRemarks(rule.remarks || '');
        setShiftId(rule.shiftId || '');
        setMaxExcessTimeRequestDays(rule.maxExcessTimeRequestDays);
        setMonthlyRegularizationCount(rule.monthlyRegularizationCount || '');
        // Load table data - attendanceEvents merged with components in useEffect (filters deleted components)
        if (rule.attendanceEvents && Array.isArray(rule.attendanceEvents)) {
          const raw = rule.attendanceEvents as AttendanceEvent[];
          setSavedAttendanceEvents(raw.map((e) => ({ ...e, allowHourly: e.allowHourly ?? false, allowDatewise: e.allowDatewise ?? false })));
        } else {
          setSavedAttendanceEvents([]);
        }
        if (rule.excessTimeEvents && Array.isArray(rule.excessTimeEvents)) {
          const raw = rule.excessTimeEvents as ExcessTimeEvent[];
          setSavedExcessTimeEvents(
            raw.map((e) => ({
              ...e,
              allowHourly: e.allowHourly ?? false,
              allowDatewise: e.allowDatewise ?? false,
            }))
          );
        } else {
          setSavedExcessTimeEvents([]);
        }
        if (rule.requestTypeEvents && Array.isArray(rule.requestTypeEvents)) {
          setRequestTypeEvents(rule.requestTypeEvents as RequestTypeEvent[]);
        }
        if (rule.regularizationElements && Array.isArray(rule.regularizationElements)) {
          setRegularizationElements(rule.regularizationElements as RegularizationElement[]);
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
  }, [id, organizationId, isEdit]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleCancel = () => navigate('/event-configuration/rights-allocation');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId) return;

    setError(null);
    setSaving(true);
    try {
      const payload = {
        organizationId,
        shortName,
        longName,
        remarks: remarks || undefined,
        shiftId: shiftId || undefined,
        maxExcessTimeRequestDays,
        monthlyRegularizationCount: monthlyRegularizationCount || undefined,
        attendanceEvents,
        excessTimeEvents,
        requestTypeEvents,
        regularizationElements,
      };
      if (isEdit && id) {
        await rightsAllocationService.update(id, payload);
      } else {
        await rightsAllocationService.create(payload);
      }
      navigate('/event-configuration/rights-allocation');
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
            <Link to="/event-configuration/rights-allocation" className="hover:text-gray-900">Rights Allocation</Link>
            <span className="mx-2">/</span>
            <span className="text-gray-900 font-medium">{isEdit ? 'Edit' : 'Add'}</span>
          </nav>

          {/* Form */}
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="bg-white px-6 py-4 border-b border-gray-200">
              <h1 className="text-lg font-semibold text-black">Rights Allocation</h1>
            </div>
            <div className="p-6 !bg-white">
              {loading ? (
                <div className="py-8 text-center text-gray-500">Loading...</div>
              ) : (
                <form onSubmit={handleSave} className="space-y-4">
                  <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
                    {/* Short Name */}
                    <div className="flex items-baseline gap-2">
                      <label className="w-36 shrink-0 text-sm font-medium text-gray-700 after:content-[':']">
                        Short Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={shortName}
                        onChange={(e) => setShortName(e.target.value)}
                        required
                        className="flex-1 rounded border border-gray-300 !bg-white px-3 py-2 text-sm text-black placeholder:text-black placeholder:opacity-80"
                        placeholder="Employee Rights"
                      />
                    </div>

                    {/* Long Name */}
                    <div className="flex items-baseline gap-2">
                      <label className="w-36 shrink-0 text-sm font-medium text-gray-700 after:content-[':']">
                        Long Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={longName}
                        onChange={(e) => setLongName(e.target.value)}
                        required
                        className="flex-1 rounded border border-gray-300 !bg-white px-3 py-2 text-sm text-black placeholder:text-black placeholder:opacity-80"
                        placeholder="Employee Rights"
                      />
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

                    {/* Shift */}
                    <div className="flex items-baseline gap-2">
                      <label className="w-36 shrink-0 text-sm font-medium text-gray-700 after:content-[':']">
                        Shift
                      </label>
                      <select
                        value={shiftId}
                        onChange={(e) => setShiftId(e.target.value)}
                        className="flex-1 rounded border border-gray-300 !bg-white px-3 py-2 text-sm text-black"
                      >
                        <option value="">Select Shift</option>
                        {shifts.map((shift) => (
                          <option key={shift.id} value={shift.id}>
                            {shift.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Maximum Excess Time Request : Days */}
                    <div className="flex items-baseline gap-2">
                      <label className="w-36 shrink-0 text-sm font-medium text-gray-700 after:content-[':']">
                        Maximum Excess Time Request : Days
                      </label>
                      <input
                        type="number"
                        value={maxExcessTimeRequestDays}
                        onChange={(e) => setMaxExcessTimeRequestDays(Number(e.target.value) || 0)}
                        min="0"
                        className="flex-1 rounded border border-gray-300 !bg-white px-3 py-2 text-sm text-black placeholder:text-black placeholder:opacity-80"
                        placeholder="120"
                      />
                    </div>

                    {/* Monthly Regularization Count */}
                    <div className="flex items-baseline gap-2">
                      <label className="w-36 shrink-0 text-sm font-medium text-gray-700 after:content-[':']">
                        Monthly Regularization Count
                      </label>
                      <input
                        type="number"
                        value={monthlyRegularizationCount}
                        onChange={(e) => setMonthlyRegularizationCount(e.target.value === '' ? '' : Number(e.target.value))}
                        min="0"
                        className="flex-1 rounded border border-gray-300 !bg-white px-3 py-2 text-sm text-black placeholder:text-black placeholder:opacity-80"
                        placeholder="Monthly Regularization Count"
                      />
                    </div>
                  </div>

                  {/* Attendance Events Table - dynamic from Attendance Components */}
                  <div className="mt-6 border-t border-gray-200 pt-6">
                    <h3 className="text-base font-semibold text-gray-900 mb-4">Attendance Events</h3>
                    <p className="text-sm text-gray-500 mb-2">Events are loaded from Attendance Components. Add or remove events in the Attendance Components page.</p>
                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-blue-600">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                                Events
                              </th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                                <label className="flex items-center justify-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={attendanceEvents.length > 0 && attendanceEvents.every((e) => e.applicable)}
                                    onChange={(e) => handleSelectAll('applicable', e.target.checked)}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="ml-2">Applicable</span>
                                </label>
                              </th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                                <label className="flex items-center justify-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={attendanceEvents.length > 0 && attendanceEvents.every((e) => e.view)}
                                    onChange={(e) => handleSelectAll('view', e.target.checked)}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="ml-2">View</span>
                                </label>
                              </th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                                <label className="flex items-center justify-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={attendanceEvents.length > 0 && attendanceEvents.every((e) => e.add)}
                                    onChange={(e) => handleSelectAll('add', e.target.checked)}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="ml-2">Add</span>
                                </label>
                              </th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                                <label className="flex items-center justify-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={attendanceEvents.length > 0 && attendanceEvents.every((e) => e.cancel)}
                                    onChange={(e) => handleSelectAll('cancel', e.target.checked)}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="ml-2">Cancel</span>
                                </label>
                              </th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                                <label className="flex items-center justify-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={attendanceEvents.length > 0 && attendanceEvents.every((e) => e.delete)}
                                    onChange={(e) => handleSelectAll('delete', e.target.checked)}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="ml-2">Delete</span>
                                </label>
                              </th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                                <label className="flex items-center justify-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={attendanceEvents.length > 0 && attendanceEvents.every((e) => e.allowWeekOffSelection && e.allowHolidaySelection)}
                                    onChange={(e) => handleSelectAllAllow(e.target.checked)}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="ml-2">Allow</span>
                                </label>
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                                Allow Max
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {attendanceEvents.length === 0 ? (
                              <tr>
                                <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                                  No attendance components found. Create events in the Attendance Components page first.
                                </td>
                              </tr>
                            ) : (
                            attendanceEvents.map((event) => (
                              <tr key={event.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                  {event.name}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-center">
                                  <input
                                    type="checkbox"
                                    checked={event.applicable}
                                    onChange={(e) => updateEventField(event.id, 'applicable', e.target.checked)}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-center">
                                  <input
                                    type="checkbox"
                                    checked={event.view}
                                    onChange={(e) => updateEventField(event.id, 'view', e.target.checked)}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-center">
                                  <input
                                    type="checkbox"
                                    checked={event.add}
                                    onChange={(e) => updateEventField(event.id, 'add', e.target.checked)}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-center">
                                  <input
                                    type="checkbox"
                                    checked={event.cancel}
                                    onChange={(e) => updateEventField(event.id, 'cancel', e.target.checked)}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-center">
                                  <input
                                    type="checkbox"
                                    checked={event.delete}
                                    onChange={(e) => updateEventField(event.id, 'delete', e.target.checked)}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className="flex flex-col gap-2">
                                    <label className="flex items-center gap-2 text-sm text-gray-700">
                                      <input
                                        type="checkbox"
                                        checked={event.allowWeekOffSelection}
                                        onChange={(e) => updateEventField(event.id, 'allowWeekOffSelection', e.target.checked)}
                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                      />
                                      <span>Allow WeekOff Selection</span>
                                    </label>
                                    <label className="flex items-center gap-2 text-sm text-gray-700">
                                      <input
                                        type="checkbox"
                                        checked={event.allowHolidaySelection}
                                        onChange={(e) => updateEventField(event.id, 'allowHolidaySelection', e.target.checked)}
                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                      />
                                      <span>Allow Holiday Selection</span>
                                    </label>
                                  </div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className="flex items-center gap-2">
                                    {event.allowHourly && event.allowDatewise ? (
                                      <>
                                        <span className="text-sm text-gray-700">Min</span>
                                        <input
                                          type="number"
                                          value={event.maxMinutes}
                                          onChange={(e) => updateEventField(event.id, 'maxMinutes', e.target.value === '' ? '' : Number(e.target.value))}
                                          min="0"
                                          className="w-20 rounded border border-gray-300 !bg-white px-2 py-1 text-sm text-black"
                                          placeholder="Max Mi"
                                        />
                                        <span className="text-sm text-gray-700">Day</span>
                                        <input
                                          type="number"
                                          value={event.maxDays}
                                          onChange={(e) => updateEventField(event.id, 'maxDays', e.target.value === '' ? '' : Number(e.target.value))}
                                          min="0"
                                          className="w-20 rounded border border-gray-300 !bg-white px-2 py-1 text-sm text-black"
                                          placeholder="Max Da"
                                        />
                                      </>
                                    ) : event.allowHourly ? (
                                      <>
                                        <span className="text-sm text-gray-700">Min</span>
                                        <input
                                          type="number"
                                          value={event.maxMinutes}
                                          onChange={(e) => updateEventField(event.id, 'maxMinutes', e.target.value === '' ? '' : Number(e.target.value))}
                                          min="0"
                                          className="w-20 rounded border border-gray-300 !bg-white px-2 py-1 text-sm text-black"
                                          placeholder="Max Mi"
                                        />
                                      </>
                                    ) : (
                                      <>
                                        <span className="text-sm text-gray-700">Day</span>
                                        <input
                                          type="number"
                                          value={event.maxDays}
                                          onChange={(e) => updateEventField(event.id, 'maxDays', e.target.value === '' ? '' : Number(e.target.value))}
                                          min="0"
                                          className="w-24 rounded border border-gray-300 !bg-white px-2 py-1 text-sm text-black"
                                          placeholder="Max Days"
                                        />
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Excess Time Section - dynamic from Attendance Components (creditFromOverTime=true) */}
                  <div className="mt-6 border-t border-gray-200 pt-6">
                    <h3 className="text-base font-semibold text-blue-600 underline mb-4">Excess Time</h3>
                    <p className="text-sm text-gray-500 mb-2">Events with &quot;Credit from Over Time&quot; enabled in Attendance Components.</p>
                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-blue-600">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                                Events
                              </th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                                <label className="flex items-center justify-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={excessTimeEvents.length > 0 && excessTimeEvents.every((e) => e.applicable)}
                                    onChange={(e) => handleExcessTimeSelectAll('applicable', e.target.checked)}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="ml-2">Applicable</span>
                                </label>
                              </th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                                <label className="flex items-center justify-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={excessTimeEvents.length > 0 && excessTimeEvents.every((e) => e.add)}
                                    onChange={(e) => handleExcessTimeSelectAll('add', e.target.checked)}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="ml-2">Add</span>
                                </label>
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                                Allow Max
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {excessTimeEvents.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                                  No excess time events. Enable &quot;Credit from Over Time&quot; on components in Attendance Components page.
                                </td>
                              </tr>
                            ) : (
                            excessTimeEvents.map((event) => (
                              <tr key={event.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                  {event.name}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-center">
                                  <input
                                    type="checkbox"
                                    checked={event.applicable}
                                    onChange={(e) => updateExcessTimeField(event.id, 'applicable', e.target.checked)}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-center">
                                  <input
                                    type="checkbox"
                                    checked={event.add}
                                    onChange={(e) => updateExcessTimeField(event.id, 'add', e.target.checked)}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className="flex items-center gap-2">
                                    {event.allowDatewise && !event.allowHourly ? (
                                      <>
                                        <span className="text-sm text-gray-700">Day</span>
                                        <input
                                          type="number"
                                          value={event.maxDays}
                                          onChange={(e) => updateExcessTimeField(event.id, 'maxDays', e.target.value === '' ? '' : Number(e.target.value))}
                                          min="0"
                                          className="w-24 rounded border border-gray-300 !bg-white px-2 py-1 text-sm text-black"
                                          placeholder="Max Days"
                                        />
                                      </>
                                    ) : event.allowHourly ? (
                                      <>
                                        <span className="text-sm text-gray-700">Min</span>
                                        <input
                                          type="number"
                                          value={event.maxMinutes}
                                          onChange={(e) => updateExcessTimeField(event.id, 'maxMinutes', e.target.value === '' ? '' : Number(e.target.value))}
                                          min="0"
                                          className="w-24 rounded border border-gray-300 !bg-white px-2 py-1 text-sm text-black"
                                          placeholder="Max Mi"
                                        />
                                        {event.allowDatewise && (
                                          <>
                                            <span className="text-sm text-gray-700">Day</span>
                                            <input
                                              type="number"
                                              value={event.maxDays}
                                              onChange={(e) => updateExcessTimeField(event.id, 'maxDays', e.target.value === '' ? '' : Number(e.target.value))}
                                              min="0"
                                              className="w-24 rounded border border-gray-300 !bg-white px-2 py-1 text-sm text-black"
                                              placeholder="Max Da"
                                            />
                                          </>
                                        )}
                                      </>
                                    ) : (
                                      <>
                                        <span className="text-sm text-gray-700">Day</span>
                                        <input
                                          type="number"
                                          value={event.maxDays}
                                          onChange={(e) => updateExcessTimeField(event.id, 'maxDays', e.target.value === '' ? '' : Number(e.target.value))}
                                          min="0"
                                          className="w-24 rounded border border-gray-300 !bg-white px-2 py-1 text-sm text-black"
                                          placeholder="Max Days"
                                        />
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Request Type Section */}
                  <div className="mt-6 border-t border-gray-200 pt-6">
                    <h3 className="text-base font-semibold text-blue-600 underline mb-4">Request Type</h3>
                    
                    {/* Request Type Table */}
                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-blue-600">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                                Events
                              </th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                                <label className="flex items-center justify-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={requestTypeEvents.length > 0 && requestTypeEvents.every((e) => e.applicable)}
                                    onChange={(e) => handleRequestTypeSelectAll('applicable', e.target.checked)}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="ml-2">Applicable</span>
                                </label>
                              </th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                                <label className="flex items-center justify-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={requestTypeEvents.length > 0 && requestTypeEvents.every((e) => e.view)}
                                    onChange={(e) => handleRequestTypeSelectAll('view', e.target.checked)}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="ml-2">View</span>
                                </label>
                              </th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                                <label className="flex items-center justify-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={requestTypeEvents.length > 0 && requestTypeEvents.every((e) => e.add)}
                                    onChange={(e) => handleRequestTypeSelectAll('add', e.target.checked)}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="ml-2">Add</span>
                                </label>
                              </th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                                <label className="flex items-center justify-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={requestTypeEvents.length > 0 && requestTypeEvents.every((e) => e.cancel)}
                                    onChange={(e) => handleRequestTypeSelectAll('cancel', e.target.checked)}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="ml-2">Cancel</span>
                                </label>
                              </th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                                <label className="flex items-center justify-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={requestTypeEvents.length > 0 && requestTypeEvents.every((e) => e.delete)}
                                    onChange={(e) => handleRequestTypeSelectAll('delete', e.target.checked)}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="ml-2">Delete</span>
                                </label>
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {requestTypeEvents.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                                  No data available in table
                                </td>
                              </tr>
                            ) : (
                              requestTypeEvents.map((event) => (
                                <tr key={event.id} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {event.name}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-center">
                                    <input
                                      type="checkbox"
                                      checked={event.applicable}
                                      onChange={(e) => updateRequestTypeField(event.id, 'applicable', e.target.checked)}
                                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-center">
                                    <input
                                      type="checkbox"
                                      checked={event.view}
                                      onChange={(e) => updateRequestTypeField(event.id, 'view', e.target.checked)}
                                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-center">
                                    <input
                                      type="checkbox"
                                      checked={event.add}
                                      onChange={(e) => updateRequestTypeField(event.id, 'add', e.target.checked)}
                                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-center">
                                    <input
                                      type="checkbox"
                                      checked={event.cancel}
                                      onChange={(e) => updateRequestTypeField(event.id, 'cancel', e.target.checked)}
                                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-center">
                                    <input
                                      type="checkbox"
                                      checked={event.delete}
                                      onChange={(e) => updateRequestTypeField(event.id, 'delete', e.target.checked)}
                                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Regularization Elements Section */}
                  <div className="mt-6 border-t border-gray-200 pt-6">
                    <h3 className="text-base font-semibold text-blue-600 underline mb-4">Regularization Elements</h3>
                    
                    {/* Regularization Elements Table */}
                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-blue-600">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                                Grouping
                              </th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                                <label className="flex items-center justify-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={regularizationElements.every((e) => e.applicable)}
                                    onChange={(e) => handleRegularizationSelectAll('applicable', e.target.checked)}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="ml-2">Applicable</span>
                                </label>
                              </th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                                <label className="flex items-center justify-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={regularizationElements.every((e) => e.view)}
                                    onChange={(e) => handleRegularizationSelectAll('view', e.target.checked)}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="ml-2">View</span>
                                </label>
                              </th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                                <label className="flex items-center justify-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={regularizationElements.every((e) => e.add)}
                                    onChange={(e) => handleRegularizationSelectAll('add', e.target.checked)}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="ml-2">Add</span>
                                </label>
                              </th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                                <label className="flex items-center justify-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={regularizationElements.every((e) => e.cancel)}
                                    onChange={(e) => handleRegularizationSelectAll('cancel', e.target.checked)}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="ml-2">Cancel</span>
                                </label>
                              </th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                                <label className="flex items-center justify-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={regularizationElements.every((e) => e.delete)}
                                    onChange={(e) => handleRegularizationSelectAll('delete', e.target.checked)}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="ml-2">Delete</span>
                                </label>
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {regularizationElements.map((element) => (
                              <tr key={element.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                  {element.name}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-center">
                                  <input
                                    type="checkbox"
                                    checked={element.applicable}
                                    onChange={(e) => updateRegularizationElementField(element.id, 'applicable', e.target.checked)}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-center">
                                  <input
                                    type="checkbox"
                                    checked={element.view}
                                    onChange={(e) => updateRegularizationElementField(element.id, 'view', e.target.checked)}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-center">
                                  <input
                                    type="checkbox"
                                    checked={element.add}
                                    onChange={(e) => updateRegularizationElementField(element.id, 'add', e.target.checked)}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-center">
                                  <input
                                    type="checkbox"
                                    checked={element.cancel}
                                    onChange={(e) => updateRegularizationElementField(element.id, 'cancel', e.target.checked)}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-center">
                                  <input
                                    type="checkbox"
                                    checked={element.delete}
                                    onChange={(e) => updateRegularizationElementField(element.id, 'delete', e.target.checked)}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                </td>
                              </tr>
                            ))}
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
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
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
