import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';
import attendanceLockService, {
  MonthlyAttendanceLock,
  type BuildMonthResult,
} from '../services/attendanceLock.service';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function AttendanceLockPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id || (user as any)?.organizationId;
  const organizationName = user?.employee?.organization?.name;

  const currentDate = new Date();
  const [year, setYear] = useState(currentDate.getFullYear());
  const [month, setMonth] = useState(currentDate.getMonth() + 1);
  const [lock, setLock] = useState<MonthlyAttendanceLock | null>(null);
  const [summaryCount, setSummaryCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [locking, setLocking] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [showUnlockRemarks, setShowUnlockRemarks] = useState(false);
  const [unlockRemarks, setUnlockRemarks] = useState('');
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
      const [lockResult, summariesResult] = await Promise.all([
        attendanceLockService.getMonthLock(organizationId, year, month),
        attendanceLockService.getSummariesForMonth(organizationId, year, month),
      ]);
      setLock(lockResult);
      setSummaryCount(summariesResult.total);
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : 'Failed to load lock status';
      setError(String(msg));
      setLock(null);
      setSummaryCount(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLockStatus();
  }, [organizationId, year, month]);

  const handleBuildMonth = async () => {
    if (!organizationId) return;
    setBuilding(true);
    setError(null);
    try {
      const result = await attendanceLockService.buildMonth(organizationId, year, month) as BuildMonthResult;
      setSummaryCount(result.successCount);
      fetchLockStatus();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } }; message?: string };
      const msg =
        ax?.response?.data?.message ||
        ax?.message ||
        'Failed to build summaries';
      setError(String(msg));
    } finally {
      setBuilding(false);
    }
  };

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

  const handleUnlockMonth = async (withRemarks = false) => {
    if (!organizationId) return;
    const remarksToSend = withRemarks ? unlockRemarks : undefined;
    if (withRemarks && !remarksToSend?.trim()) {
      setError('Please provide remarks for unlock');
      return;
    }
    if (!window.confirm(`Are you sure you want to unlock ${MONTHS[month - 1]} ${year}? This will allow attendance changes for this month.`)) {
      return;
    }
    setUnlocking(true);
    setError(null);
    try {
      await attendanceLockService.unlockMonth(organizationId, year, month, remarksToSend?.trim() || undefined);
      setLock(null);
      setShowUnlockRemarks(false);
      setUnlockRemarks('');
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : 'Failed to unlock month';
      setError(String(msg));
    } finally {
      setUnlocking(false);
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
        title="Others Configuration"
        subtitle={organizationName ? `Organization: ${organizationName}` : undefined}
        onLogout={handleLogout}
      />

      <main className="flex-1 min-h-0 overflow-auto w-full bg-gray-100">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 bg-gray-50">
          {/* Breadcrumbs - same style as Validation Process Rule */}
          <div className="mb-6">
            <nav className="flex items-center text-sm text-gray-600" aria-label="Breadcrumb">
              <Link to="/others-configuration" className="text-gray-500 hover:text-gray-900">
                Others Configuration
              </Link>
              <span className="mx-1 text-gray-400">/</span>
              <span className="font-semibold text-gray-900">Attendance Lock</span>
            </nav>
          </div>

          <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
            {/* Page title - same style as Validation Process Rule */}
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Attendance Lock</h2>
              <p className="text-gray-600 mt-1">
                Step 1: Build summaries from attendance calendar. Step 2: Lock the month for payroll. Unlock if corrections are needed.
              </p>
            </div>

            {/* Filters - same style as Validation Process Rule */}
            {organizationId && (
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="flex flex-col">
                    <label className="text-sm font-medium text-gray-500 mb-1.5">Year</label>
                    <select
                      value={year}
                      onChange={(e) => setYear(Number(e.target.value))}
                      className="h-10 w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 2 + i).map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col">
                    <label className="text-sm font-medium text-gray-500 mb-1.5">Month</label>
                    <select
                      value={month}
                      onChange={(e) => setMonth(Number(e.target.value))}
                      className="h-10 w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {MONTHS.map((m, i) => (
                        <option key={i} value={i + 1}>{m}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="px-6 py-4 bg-red-50 border-b border-red-200">
                <p className="font-semibold text-red-800">Error</p>
                <p className="text-sm mt-1 text-red-700">{error}</p>
              </div>
            )}

            <div className="p-6 space-y-6">
              {!organizationId && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 text-sm">
                  No organization assigned. Please contact your administrator.
                </div>
              )}

              {organizationId && (
                <>
                  {summaryCount !== null && (
                    <p className="text-sm text-gray-600 mb-4">
                      Summaries for {MONTHS[month - 1]} {year}: <strong>{summaryCount}</strong> employee(s)
                      {lock && ' (locked)'}
                    </p>
                  )}

                  {loading ? (
                    <p className="text-gray-500 text-sm">Loading lock status…</p>
                  ) : lock ? (
                    <div className="space-y-4">
                      <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                        <p className="font-medium text-green-800">This month is locked</p>
                        <p className="text-sm text-green-700 mt-1">
                          Locked at {formatDateTime(lock.lockedAt)}
                          {lock.remarks && (
                            <span className="block mt-2">Remarks: {lock.remarks}</span>
                          )}
                        </p>
                      </div>
                      {showUnlockRemarks ? (
                        <div className="space-y-3">
                          <div className="flex flex-col">
                            <label className="text-sm font-medium text-gray-500 mb-1.5">Unlock Remarks (required)</label>
                            <input
                              type="text"
                              value={unlockRemarks}
                              onChange={(e) => setUnlockRemarks(e.target.value)}
                              placeholder="e.g. Correction needed before payroll"
                              className="h-10 w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              onClick={() => handleUnlockMonth(true)}
                              disabled={unlocking || !unlockRemarks.trim()}
                              className="h-9 px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {unlocking ? 'Unlocking…' : 'Unlock with Remarks'}
                            </button>
                            <button
                              onClick={() => { setShowUnlockRemarks(false); setUnlockRemarks(''); setError(null); }}
                              disabled={unlocking}
                              className="h-9 px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 transition disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => handleUnlockMonth(false)}
                            disabled={unlocking}
                            className="h-9 px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {unlocking ? 'Unlocking…' : 'Unlock'}
                          </button>
                          <button
                            onClick={() => setShowUnlockRemarks(true)}
                            disabled={unlocking}
                            className="h-9 px-4 py-2 rounded-lg border border-amber-600 text-amber-700 bg-white text-sm font-medium hover:bg-amber-50 transition flex items-center gap-1.5 disabled:opacity-50"
                          >
                            Unlock with Remarks
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-3 flex-wrap">
                          <button
                            onClick={handleBuildMonth}
                            disabled={building || !!lock}
                            className="h-9 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                            title={lock ? 'Month is locked. Unlock first to build.' : 'Build MonthlyAttendanceSummary from attendance calendar'}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            {building ? 'Building…' : 'Build'}
                          </button>
                          <span className="text-sm text-gray-500">
                            Creates summaries from attendance records. Required before Lock.
                          </span>
                        </div>
                        <div className="border-t border-gray-200 pt-4">
                          <label className="text-sm font-medium text-gray-500 mb-1.5 block">Remarks (optional)</label>
                          <input
                            type="text"
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                            placeholder="e.g. Month finalized for payroll"
                            className="h-10 w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 max-w-md"
                          />
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={handleLockMonth}
                            disabled={locking || (summaryCount !== null && summaryCount === 0)}
                            className="h-9 px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                            title={summaryCount === 0 ? 'Build first to create summaries' : undefined}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            {locking ? 'Locking…' : `Lock ${MONTHS[month - 1]} ${year}`}
                          </button>
                        </div>
                      </div>
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
