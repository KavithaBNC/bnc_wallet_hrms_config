import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';
import approvalWorkflowService from '../services/approvalWorkflow.service';

interface AttendanceEventRow {
  id: string;
  name: string;
  toApprove: boolean;
  cancelApproval: boolean;
  deleteApproval: boolean;
  maxDays: number | '';
  maxMinutes: number | '';
  reminder: string;
}

interface ExcessTimeRow {
  id: string;
  name: string;
  toApprove: boolean;
  cancelApproval: boolean;
  maxDays: number | '';
  maxMinutes: number | '';
}

interface ValidationGroupRow {
  id: string;
  name: string;
  toApprove: boolean;
  cancelApproval: boolean;
  deleteApproval: boolean;
  reminder: string;
}

const ATTENDANCE_EVENTS: Omit<AttendanceEventRow, 'toApprove' | 'cancelApproval' | 'deleteApproval' | 'maxDays' | 'maxMinutes' | 'reminder'>[] = [
  { id: '1', name: 'BEREAVEMENT LEAVE' },
  { id: '2', name: 'Casual Leave' },
  { id: '3', name: 'Comp Off' },
  { id: '4', name: 'Earned Leave' },
  { id: '5', name: 'Forgot Punch' },
  { id: '6', name: 'Loss of Pay' },
  { id: '7', name: 'Marriage leave' },
  { id: '8', name: 'Maternity Leave' },
  { id: '9', name: 'On Duty' },
  { id: '10', name: 'Paternity Leave' },
  { id: '11', name: 'Permission' },
  { id: '12', name: 'Present' },
  { id: '13', name: 'Restricted Holiday' },
  { id: '14', name: 'Sick Leave' },
  { id: '15', name: 'Work from Home' },
];

const EXCESS_TIME_EVENTS: Omit<ExcessTimeRow, 'toApprove' | 'cancelApproval' | 'maxDays' | 'maxMinutes'>[] = [
  { id: 'et1', name: 'Comp Off' },
  { id: 'et2', name: 'Permission' },
  { id: 'et3', name: 'Over-time' },
];

const VALIDATION_GROUP_EVENTS: Omit<ValidationGroupRow, 'toApprove' | 'cancelApproval' | 'deleteApproval' | 'reminder'>[] = [
  { id: 'vg1', name: 'Absent' },
  { id: 'vg2', name: 'Dual Record' },
  { id: 'vg3', name: 'Early Going' },
  { id: 'vg4', name: 'Excess Break' },
  { id: 'vg5', name: 'Late' },
  { id: 'vg6', name: 'No Out Punch' },
  { id: 'vg7', name: 'OverTime' },
  { id: 'vg8', name: 'Shortfall' },
];

const REMINDER_OPTIONS = ['ActionName', 'Email', 'SMS', 'Push'];

const WORKFLOW_TYPES = ['Employee', 'Manager', 'HR', 'Org Admin', 'Super Admin'];

export default function ApprovalWorkflowFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const { user, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;
  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id;

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [workflowType, setWorkflowType] = useState('');
  const [shortName, setShortName] = useState('');
  const [longName, setLongName] = useState('');
  const [remarks, setRemarks] = useState('');

  const [attendanceEvents, setAttendanceEvents] = useState<AttendanceEventRow[]>(() =>
    ATTENDANCE_EVENTS.map((e) => ({
      ...e,
      toApprove: false,
      cancelApproval: false,
      deleteApproval: false,
      maxDays: '' as number | '',
      maxMinutes: '' as number | '',
      reminder: 'ActionName',
    }))
  );

  const [excessTimeEvents, setExcessTimeEvents] = useState<ExcessTimeRow[]>(() =>
    EXCESS_TIME_EVENTS.map((e) => ({
      ...e,
      toApprove: false,
      cancelApproval: false,
      maxDays: '' as number | '',
      maxMinutes: '' as number | '',
    }))
  );

  const [requestTypeEvents] = useState<{ id: string; name: string; toApprove: boolean; cancelApproval: boolean; deleteApproval: boolean }[]>([]);

  const [validationGroupEvents, setValidationGroupEvents] = useState<ValidationGroupRow[]>(() =>
    VALIDATION_GROUP_EVENTS.map((e) => ({
      ...e,
      toApprove: false,
      cancelApproval: false,
      deleteApproval: false,
      reminder: 'ActionName',
    }))
  );

  useEffect(() => {
    if (isEdit && id && organizationId) {
      setLoading(true);
      approvalWorkflowService
        .getById(id)
        .then((item) => {
          setWorkflowType(item.workflowType);
          setShortName(item.shortName);
          setLongName(item.longName);
          setRemarks(item.remarks || '');
          if (item.attendanceEvents && Array.isArray(item.attendanceEvents)) {
            setAttendanceEvents((prev) =>
              prev.map((p) => {
                const found = (item.attendanceEvents as any[]).find((a: any) => a.id === p.id);
                return found
                  ? {
                      ...p,
                      toApprove: found.toApprove ?? false,
                      cancelApproval: found.cancelApproval ?? false,
                      deleteApproval: found.deleteApproval ?? false,
                      maxDays: found.maxDays ?? '',
                      maxMinutes: found.maxMinutes ?? '',
                      reminder: found.reminder ?? 'ActionName',
                    }
                  : p;
              })
            );
          }
          if (item.excessTimeEvents && Array.isArray(item.excessTimeEvents)) {
            setExcessTimeEvents((prev) =>
              prev.map((p) => {
                const found = (item.excessTimeEvents as any[]).find((e: any) => e.id === p.id);
                return found
                  ? {
                      ...p,
                      toApprove: found.toApprove ?? false,
                      cancelApproval: found.cancelApproval ?? false,
                      maxDays: found.maxDays ?? '',
                      maxMinutes: found.maxMinutes ?? '',
                    }
                  : p;
              })
            );
          }
          if (item.validationGroupEvents && Array.isArray(item.validationGroupEvents)) {
            setValidationGroupEvents((prev) =>
              prev.map((p) => {
                const found = (item.validationGroupEvents as any[]).find((v: any) => v.id === p.id);
                return found
                  ? {
                      ...p,
                      toApprove: found.toApprove ?? false,
                      cancelApproval: found.cancelApproval ?? false,
                      deleteApproval: found.deleteApproval ?? false,
                      reminder: found.reminder ?? 'ActionName',
                    }
                  : p;
              })
            );
          }
        })
        .catch(() => setError('Failed to load'))
        .finally(() => setLoading(false));
    }
  }, [id, isEdit, organizationId]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleCancel = () => navigate('/event-configuration/approval-workflow');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId) {
      setError('Organization not found');
      return;
    }
    if (!workflowType) {
      setError('Workflow Type is required');
      return;
    }
    if (!shortName.trim()) {
      setError('Short Name is required');
      return;
    }
    if (!longName.trim()) {
      setError('Long Name is required');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const payload = {
        organizationId,
        workflowType,
        shortName: shortName.trim(),
        longName: longName.trim(),
        remarks: remarks.trim() || undefined,
        attendanceEvents,
        excessTimeEvents,
        requestTypeEvents,
        validationGroupEvents,
      };
      if (isEdit && id) {
        await approvalWorkflowService.update(id, payload);
      } else {
        await approvalWorkflowService.create(payload);
      }
      navigate('/event-configuration/approval-workflow');
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

  const updateAttendanceEvent = (eventId: string, field: keyof AttendanceEventRow, value: boolean | number | string | '') => {
    setAttendanceEvents((prev) =>
      prev.map((e) => (e.id === eventId ? { ...e, [field]: value } : e))
    );
  };

  const handleAttendanceSelectAll = (column: 'toApprove' | 'cancelApproval' | 'deleteApproval', value: boolean) => {
    setAttendanceEvents((prev) => prev.map((e) => ({ ...e, [column]: value })));
  };

  const updateExcessTimeEvent = (eventId: string, field: keyof ExcessTimeRow, value: boolean | number | '') => {
    setExcessTimeEvents((prev) =>
      prev.map((e) => (e.id === eventId ? { ...e, [field]: value } : e))
    );
  };

  const handleExcessTimeSelectAll = (column: 'toApprove' | 'cancelApproval', value: boolean) => {
    setExcessTimeEvents((prev) => prev.map((e) => ({ ...e, [column]: value })));
  };

  const updateValidationGroupEvent = (eventId: string, field: keyof ValidationGroupRow, value: boolean | string) => {
    setValidationGroupEvents((prev) =>
      prev.map((e) => (e.id === eventId ? { ...e, [field]: value } : e))
    );
  };

  const handleValidationGroupSelectAll = (column: 'toApprove' | 'cancelApproval' | 'deleteApproval', value: boolean) => {
    setValidationGroupEvents((prev) => prev.map((e) => ({ ...e, [column]: value })));
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
            <Link to="/event-configuration/approval-workflow" className="hover:text-gray-900">Approval Workflow</Link>
            <span className="mx-2">/</span>
            <span className="text-gray-900 font-medium">{isEdit ? 'Edit' : 'Add'}</span>
          </nav>

          {/* Form - same as Employee add (white card, gray header) */}
          <form onSubmit={handleSave} className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="bg-white px-6 py-4 border-b border-gray-200">
              <h1 className="text-lg font-semibold text-black">Approval Workflow</h1>
            </div>
            <div className="p-6">
              {loading ? (
                <div className="py-8 text-center text-gray-500">Loading...</div>
              ) : (
                <>
                  {error && (
                    <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                      {error}
                    </div>
                  )}

                  {/* Workflow Details - same layout as Employee add (grid, label above) */}
                  <div className="mb-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Workflow Type <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={workflowType}
                          onChange={(e) => setWorkflowType(e.target.value)}
                          required
                          className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        >
                          <option value="">Select workflow type</option>
                          {WORKFLOW_TYPES.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Short Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={shortName}
                          onChange={(e) => setShortName(e.target.value)}
                          required
                          className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                          placeholder="Employee Approval"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Long Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={longName}
                          onChange={(e) => setLongName(e.target.value)}
                          required
                          className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                          placeholder="Employee Approval"
                        />
                      </div>
                    </div>
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700">Remarks</label>
                      <textarea
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        rows={3}
                        className="mt-1 block w-full bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm resize-y px-3 py-2"
                        placeholder="Remarks"
                      />
                    </div>
                  </div>

                  {/* Attendance Events */}
                  <div className="mb-8">
                    <h3 className="text-base font-semibold text-gray-900 mb-4">Attendance Events</h3>
                        <div className="overflow-x-auto rounded-lg border border-gray-200">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Events</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                                  <label className="flex items-center justify-center cursor-pointer">
                                    <input type="checkbox" checked={attendanceEvents.every((e) => e.toApprove)} onChange={(e) => handleAttendanceSelectAll('toApprove', e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                    <span className="ml-2">To Approve</span>
                                  </label>
                                </th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                                  <label className="flex items-center justify-center cursor-pointer">
                                    <input type="checkbox" checked={attendanceEvents.every((e) => e.cancelApproval)} onChange={(e) => handleAttendanceSelectAll('cancelApproval', e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                    <span className="ml-2">Cancel Approval</span>
                                  </label>
                                </th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                                  <label className="flex items-center justify-center cursor-pointer">
                                    <input type="checkbox" checked={attendanceEvents.every((e) => e.deleteApproval)} onChange={(e) => handleAttendanceSelectAll('deleteApproval', e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                    <span className="ml-2">Delete Approval</span>
                                  </label>
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Allow Max</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Reminder</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {attendanceEvents.map((event) => (
                                <tr key={event.id} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{event.name}</td>
                                  <td className="px-4 py-3 text-center">
                                    <input type="checkbox" checked={event.toApprove} onChange={(e) => updateAttendanceEvent(event.id, 'toApprove', e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <input type="checkbox" checked={event.cancelApproval} onChange={(e) => updateAttendanceEvent(event.id, 'cancelApproval', e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <input type="checkbox" checked={event.deleteApproval} onChange={(e) => updateAttendanceEvent(event.id, 'deleteApproval', e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                  </td>
                                  <td className="px-4 py-3">
                                    {event.name === 'Permission' ? (
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm text-gray-600">Min</span>
                                        <input type="number" value={event.maxMinutes} onChange={(e) => updateAttendanceEvent(event.id, 'maxMinutes', e.target.value === '' ? '' : Number(e.target.value))} min="0" className="w-24 rounded-md border border-black bg-white px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Max Minutes" />
                                      </div>
                                    ) : event.name === 'Forgot Punch' || event.name === 'On Duty' || event.name === 'Present' || event.name === 'Work from Home' ? (
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm text-gray-600">Min</span>
                                        <input type="number" value={event.maxMinutes} onChange={(e) => updateAttendanceEvent(event.id, 'maxMinutes', e.target.value === '' ? '' : Number(e.target.value))} min="0" className="w-20 rounded-md border border-black bg-white px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Max Min" />
                                        <span className="text-sm text-gray-600">Day</span>
                                        <input type="number" value={event.maxDays} onChange={(e) => updateAttendanceEvent(event.id, 'maxDays', e.target.value === '' ? '' : Number(e.target.value))} min="0" className="w-20 rounded-md border border-black bg-white px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Max Day" />
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm text-gray-600">Day</span>
                                        <input type="number" value={event.maxDays} onChange={(e) => updateAttendanceEvent(event.id, 'maxDays', e.target.value === '' ? '' : Number(e.target.value))} min="0" className="w-24 rounded-md border border-black bg-white px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Max Days" />
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-4 py-3">
                                    <select value={event.reminder} onChange={(e) => updateAttendanceEvent(event.id, 'reminder', e.target.value)} className="rounded-md border border-black bg-white px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                                      {REMINDER_OPTIONS.map((opt) => (
                                        <option key={opt} value={opt}>{opt}</option>
                                      ))}
                                    </select>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                  </div>

                  {/* Excess Time */}
                  <div className="mb-8">
                    <h3 className="text-base font-semibold text-gray-900 mb-4">Excess Time</h3>
                        <div className="overflow-x-auto rounded-lg border border-gray-200">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Events</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                                  <label className="flex items-center justify-center cursor-pointer">
                                    <input type="checkbox" checked={excessTimeEvents.every((e) => e.toApprove)} onChange={(e) => handleExcessTimeSelectAll('toApprove', e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                    <span className="ml-2">To Approve</span>
                                  </label>
                                </th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                                  <label className="flex items-center justify-center cursor-pointer">
                                    <input type="checkbox" checked={excessTimeEvents.every((e) => e.cancelApproval)} onChange={(e) => handleExcessTimeSelectAll('cancelApproval', e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                    <span className="ml-2">Cancel Approval</span>
                                  </label>
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Allow Max</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {excessTimeEvents.map((event) => (
                                <tr key={event.id} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{event.name}</td>
                                  <td className="px-4 py-3 text-center">
                                    <input type="checkbox" checked={event.toApprove} onChange={(e) => updateExcessTimeEvent(event.id, 'toApprove', e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <input type="checkbox" checked={event.cancelApproval} onChange={(e) => updateExcessTimeEvent(event.id, 'cancelApproval', e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                  </td>
                                  <td className="px-4 py-3">
                                    {event.name === 'Comp Off' ? (
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm text-gray-600">Day</span>
                                        <input type="number" value={event.maxDays} onChange={(e) => updateExcessTimeEvent(event.id, 'maxDays', e.target.value === '' ? '' : Number(e.target.value))} min="0" className="w-24 rounded-md border border-black bg-white px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Max Days" />
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm text-gray-600">Min</span>
                                        <input type="number" value={event.maxMinutes} onChange={(e) => updateExcessTimeEvent(event.id, 'maxMinutes', e.target.value === '' ? '' : Number(e.target.value))} min="0" className="w-24 rounded-md border border-black bg-white px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Max Minutes" />
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                  </div>

                  {/* Request Type */}
                  <div className="mb-8">
                    <h3 className="text-base font-semibold text-gray-900 mb-4">Request Type</h3>
                        <div className="overflow-x-auto rounded-lg border border-gray-200">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Events</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">To Approve</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">Cancel Approval</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">Delete Approval</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              <tr>
                                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                                  No data available in table
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                  </div>

                  {/* Validation Group */}
                  <div className="mb-8">
                    <h3 className="text-base font-semibold text-gray-900 mb-4">Validation Group</h3>
                        <div className="overflow-x-auto rounded-lg border border-gray-200">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Events</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                                  <label className="flex items-center justify-center cursor-pointer">
                                    <input type="checkbox" checked={validationGroupEvents.every((e) => e.toApprove)} onChange={(e) => handleValidationGroupSelectAll('toApprove', e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                    <span className="ml-2">To Approve</span>
                                  </label>
                                </th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                                  <label className="flex items-center justify-center cursor-pointer">
                                    <input type="checkbox" checked={validationGroupEvents.every((e) => e.cancelApproval)} onChange={(e) => handleValidationGroupSelectAll('cancelApproval', e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                    <span className="ml-2">Cancel Approval</span>
                                  </label>
                                </th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                                  <label className="flex items-center justify-center cursor-pointer">
                                    <input type="checkbox" checked={validationGroupEvents.every((e) => e.deleteApproval)} onChange={(e) => handleValidationGroupSelectAll('deleteApproval', e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                    <span className="ml-2">Delete Approval</span>
                                  </label>
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Reminder</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {validationGroupEvents.map((event) => (
                                <tr key={event.id} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{event.name}</td>
                                  <td className="px-4 py-3 text-center">
                                    <input type="checkbox" checked={event.toApprove} onChange={(e) => updateValidationGroupEvent(event.id, 'toApprove', e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <input type="checkbox" checked={event.cancelApproval} onChange={(e) => updateValidationGroupEvent(event.id, 'cancelApproval', e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <input type="checkbox" checked={event.deleteApproval} onChange={(e) => updateValidationGroupEvent(event.id, 'deleteApproval', e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                  </td>
                                  <td className="px-4 py-3">
                                    <select value={event.reminder} onChange={(e) => updateValidationGroupEvent(event.id, 'reminder', e.target.value)} className="rounded-md border border-black bg-white px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                                      {REMINDER_OPTIONS.map((opt) => (
                                        <option key={opt} value={opt}>{opt}</option>
                                      ))}
                                    </select>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                  </div>
                  </>
                )}
            </div>

            {/* Footer - Cancel (X icon) + Save (green, save icon) */}
            <div className="flex justify-end gap-3 pt-4 pb-4 border-t border-gray-200 px-6">
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
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
