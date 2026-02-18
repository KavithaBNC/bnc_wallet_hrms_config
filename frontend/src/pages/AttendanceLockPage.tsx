import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';
import attendanceLockService, { MonthlyAttendanceLock } from '../services/attendanceLock.service';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function AttendanceLockPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id;
  const organizationName = user?.employee?.organization?.name;

  const currentDate = new Date();
  const [year, setYear] = useState(currentDate.getFullYear());
  const [month, setMonth] = useState(currentDate.getMonth() + 1);
  const [lock, setLock] = useState<MonthlyAttendanceLock | null>(null);
  const [loading, setLoading] = useState(true);
  const [locking, setLocking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remarks, setRemarks] = useState('');

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const fetchLockStatus = async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await attendanceLockService.getMonthLock(organizationId, year, month);
      setLock(result);
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : 'Failed to load lock status';
      setError(String(msg));
      setLock(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLockStatus();
  }, [organizationId, year, month]);

  const handleLockMonth = async () => {
    if (!organizationId) return;
    setLocking(true);
    setError(null);
    try {
      const result = await attendanceLockService.lockMonth(
        organizationId,
        year,
        month,
        remarks || undefined
      );
      setLock(result);
      setRemarks('');
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : 'Failed to lock month';
      setError(String(msg));
    } finally {
      setLocking(false);
    }
  };

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader
        title="Attendance Lock"
        subtitle={organizationName ? `Organization: ${organizationName}` : undefined}
        onLogout={handleLogout}
      />

      <main className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-6 bg-gray-50">
        <div className="w-full max-w-[800px] mx-auto">
          <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-5" aria-label="Breadcrumb">
            <Link to="/others-configuration" className="hover:text-gray-900">Others Configuration</Link>
            <span>/</span>
            <span className="font-semibold text-gray-900">Attendance Lock</span>
          </nav>

          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h1 className="text-lg font-semibold text-black">Monthly Attendance Lock</h1>
              <p className="text-sm text-gray-500 mt-1">
                Lock attendance for a month to prevent further changes. Once locked, the month cannot be unlocked.
              </p>
            </div>
            <div className="p-6 space-y-6">
              {!organizationId && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 text-sm">
                  No organization assigned. Please contact your administrator.
                </div>
              )}

              {organizationId && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                      <select
                        value={year}
                        onChange={(e) => setYear(Number(e.target.value))}
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        {Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 2 + i).map((y) => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
                      <select
                        value={month}
                        onChange={(e) => setMonth(Number(e.target.value))}
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        {MONTHS.map((m, i) => (
                          <option key={i} value={i + 1}>{m}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {error && (
                    <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
                      {error}
                    </div>
                  )}

                  {loading ? (
                    <p className="text-gray-500 text-sm">Loading lock status…</p>
                  ) : lock ? (
                    <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                      <p className="font-medium text-green-800">This month is locked</p>
                      <p className="text-sm text-green-700 mt-1">
                        Locked at {formatDateTime(lock.lockedAt)}
                        {lock.remarks && (
                          <span className="block mt-2">Remarks: {lock.remarks}</span>
                        )}
                      </p>
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Remarks (optional)</label>
                        <input
                          type="text"
                          value={remarks}
                          onChange={(e) => setRemarks(e.target.value)}
                          placeholder="e.g. Month finalized for payroll"
                          className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <button
                        onClick={handleLockMonth}
                        disabled={locking}
                        className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {locking ? 'Locking…' : `Lock ${MONTHS[month - 1]} ${year}`}
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
