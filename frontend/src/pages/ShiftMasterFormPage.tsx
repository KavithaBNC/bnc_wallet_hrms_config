import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';
import shiftService from '../services/shift.service';

const FLEXI_TYPE_OPTIONS = [
  { value: '', label: '-- Select --' },
  { value: 'NONE', label: 'None' },
  { value: 'SHIFT_START', label: 'Shift Start' },
  { value: 'SHIFT_END', label: 'Shift End' },
  { value: 'FULL_FLEXI', label: 'Full Flexi' },
];

export default function ShiftMasterFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const { user, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;
  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id || (user as any)?.organizationId;

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [fromTime, setFromTime] = useState('08:30');
  const [toTime, setToTime] = useState('17:30');
  const [firstHalfEnd, setFirstHalfEnd] = useState('13:00');
  const [secondHalfStart, setSecondHalfStart] = useState('13:01');
  const [punchInTime, setPunchInTime] = useState('06:30');
  const [punchOutTime, setPunchOutTime] = useState('23:59');
  const [active, setActive] = useState(true);
  const [flexiType, setFlexiType] = useState('FULL_FLEXI');

  useEffect(() => {
    if (!id || !organizationId) return;
    setLoading(true);
    setError(null);
    shiftService
      .getById(id)
      .then((shift) => {
        setCode(shift.code ?? '');
        setName(shift.name);
        setFromTime(shift.startTime || '08:30');
        setToTime(shift.endTime || '17:30');
        setFirstHalfEnd(shift.firstHalfEnd ?? '13:00');
        setSecondHalfStart(shift.secondHalfStart ?? '13:01');
        setPunchInTime(shift.punchInTime ?? '06:30');
        setPunchOutTime(shift.punchOutTime ?? '23:59');
        setActive(shift.isActive ?? true);
        setFlexiType(shift.flexiType ?? (shift.isFlexible ? 'FULL_FLEXI' : 'NONE'));
      })
      .catch((err: unknown) => {
        const msg =
          err && typeof err === 'object' && 'response' in err
            ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
            : 'Failed to load shift';
        setError(String(msg || 'Failed to load shift'));
      })
      .finally(() => setLoading(false));
  }, [id, organizationId]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleClose = () => {
    navigate('/time-attendance/shift-master');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId) return;
    if (!code.trim()) {
      setError('Short Name is required.');
      return;
    }
    if (!name.trim()) {
      setError('Shift Name is required.');
      return;
    }
    if (!fromTime || !toTime) {
      setError('From Time and To Time are required.');
      return;
    }
    if (!punchInTime || !punchOutTime) {
      setError('PunchIn Time and PunchOut Time are required.');
      return;
    }
    if (!flexiType) {
      setError('Flexi Type is required.');
      return;
    }

    setError(null);
    setSaving(true);
    try {
      if (isEdit && id) {
        await shiftService.update(id, {
          code: code.trim(),
          name: name.trim(),
          startTime: fromTime,
          endTime: toTime,
          firstHalfEnd: firstHalfEnd || undefined,
          secondHalfStart: secondHalfStart || undefined,
          punchInTime,
          punchOutTime,
          flexiType: flexiType || undefined,
          isActive: active,
        });
      } else {
        await shiftService.create({
          organizationId,
          code: code.trim(),
          name: name.trim(),
          startTime: fromTime,
          endTime: toTime,
          firstHalfEnd: firstHalfEnd || undefined,
          secondHalfStart: secondHalfStart || undefined,
          punchInTime,
          punchOutTime,
          flexiType: flexiType || undefined,
          isActive: active,
        });
      }
      navigate('/time-attendance/shift-master');
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : 'Failed to save shift';
      setError(String(msg || 'Failed to save shift'));
    } finally {
      setSaving(false);
    }
  };

  const formContent = (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
        <div className="flex items-baseline gap-2">
          <label className="w-40 shrink-0 text-sm font-medium text-gray-700 after:content-[':']">
            Short Name <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. GS"
            className="flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-sm text-black placeholder:text-black placeholder:opacity-80 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>
        <div className="flex items-baseline gap-2">
          <label className="w-40 shrink-0 text-sm font-medium text-gray-700 after:content-[':']">
            Shift Name <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. General Shift"
            className="flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-sm text-black placeholder:text-black placeholder:opacity-80 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>
        <div className="flex items-baseline gap-2">
          <label className="w-40 shrink-0 text-sm font-medium text-gray-700 after:content-[':']">
            From Time <span className="text-red-600">*</span>
          </label>
          <input
            type="time"
            value={fromTime}
            onChange={(e) => setFromTime(e.target.value)}
            className="flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-sm text-black placeholder:text-black placeholder:opacity-80 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>
        <div className="flex items-baseline gap-2">
          <label className="w-40 shrink-0 text-sm font-medium text-gray-700 after:content-[':']">
            To Time <span className="text-red-600">*</span>
          </label>
          <input
            type="time"
            value={toTime}
            onChange={(e) => setToTime(e.target.value)}
            className="flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-sm text-black placeholder:text-black placeholder:opacity-80 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>
        <div className="flex items-baseline gap-2">
          <label className="w-40 shrink-0 text-sm font-medium text-gray-700 after:content-[':']">
            First Half End
          </label>
          <input
            type="time"
            value={firstHalfEnd}
            onChange={(e) => setFirstHalfEnd(e.target.value)}
            className="flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-sm text-black placeholder:text-black placeholder:opacity-80 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>
        <div className="flex items-baseline gap-2">
          <label className="w-40 shrink-0 text-sm font-medium text-gray-700 after:content-[':']">
            Second Half Start
          </label>
          <input
            type="time"
            value={secondHalfStart}
            onChange={(e) => setSecondHalfStart(e.target.value)}
            className="flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-sm text-black placeholder:text-black placeholder:opacity-80 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>
        <div className="flex items-baseline gap-2">
          <label className="w-40 shrink-0 text-sm font-medium text-gray-700 after:content-[':']">
            PunchIn Time <span className="text-red-600">*</span>
          </label>
          <input
            type="time"
            value={punchInTime}
            onChange={(e) => setPunchInTime(e.target.value)}
            className="flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-sm text-black placeholder:text-black placeholder:opacity-80 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>
        <div className="flex items-baseline gap-2">
          <label className="w-40 shrink-0 text-sm font-medium text-gray-700 after:content-[':']">
            PunchOut Time <span className="text-red-600">*</span>
          </label>
          <input
            type="time"
            value={punchOutTime}
            onChange={(e) => setPunchOutTime(e.target.value)}
            className="flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-sm text-black placeholder:text-black placeholder:opacity-80 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>
        <div className="flex items-baseline gap-2">
          <label className="w-40 shrink-0 text-sm font-medium text-gray-700 after:content-[':']">
            Active
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActive(true)}
              className={`rounded px-3 py-1.5 text-sm font-medium transition ${
                active ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
            >
              YES
            </button>
            <button
              type="button"
              onClick={() => setActive(false)}
              className={`rounded px-3 py-1.5 text-sm font-medium transition ${
                !active ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
            >
              NO
            </button>
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <label className="w-40 shrink-0 text-sm font-medium text-gray-700 after:content-[':']">
            Flexi Type <span className="text-red-600">*</span>
          </label>
          <select
            value={flexiType}
            onChange={(e) => setFlexiType(e.target.value)}
            className="flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-sm text-black placeholder:text-black placeholder:opacity-80 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          >
            {FLEXI_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value || 'empty'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-gray-200 pt-6">
        <button
          type="button"
          onClick={handleClose}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Close
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-600 transition disabled:opacity-50"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
          </svg>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader
        title="Time attendance"
        subtitle={organizationName ? `Organization: ${organizationName}` : undefined}
        onLogout={handleLogout}
      />

      <main className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        <nav className="flex text-sm text-gray-600 mb-4" aria-label="Breadcrumb">
          <Link to="/dashboard" className="hover:text-gray-900">
            Home
          </Link>
          <span className="mx-2">/</span>
          <Link to="/time-attendance" className="hover:text-gray-900">
            Time attendance
          </Link>
          <span className="mx-2">/</span>
          <Link to="/time-attendance/shift-master" className="hover:text-gray-900">
            Shift Master
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-900 font-medium">Master</span>
        </nav>

        <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="bg-gray-700 px-6 py-4">
            <h1 className="text-lg font-semibold text-white">Master</h1>
          </div>
          <div className="p-6">
            {loading ? (
              <div className="py-8 text-center text-gray-500">Loading...</div>
            ) : (
              formContent
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
