import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { esopService, EsopDashboardStats } from '../services/esop.service';

export default function EsopDashboardPage() {
  const { user } = useAuthStore();
  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id || '';

  const [stats, setStats] = useState<EsopDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [processResult, setProcessResult] = useState<{ processed: number; totalSharesVested: number } | null>(null);

  useEffect(() => {
    if (!organizationId) return;
    setLoading(true);
    esopService.getDashboard(organizationId)
      .then(setStats)
      .catch(() => setError('Failed to load dashboard data'))
      .finally(() => setLoading(false));
  }, [organizationId]);

  const handleProcessVesting = async () => {
    if (!organizationId) return;
    setProcessing(true);
    try {
      const result = await esopService.processVesting(organizationId);
      setProcessResult(result);
      const updated = await esopService.getDashboard(organizationId);
      setStats(updated);
    } catch {
      setError('Failed to process vesting');
    } finally {
      setProcessing(false);
    }
  };

  const fmt = (n: number) => n?.toLocaleString('en-IN') ?? '0';

  if (loading) return <div className="p-8 text-gray-500">Loading ESOP dashboard...</div>;
  if (error) return <div className="p-8 text-red-500">{error}</div>;
  if (!stats) return null;

  const utilization = stats.totalPoolShares > 0
    ? Math.round((stats.totalAllocatedShares / stats.totalPoolShares) * 100)
    : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ESOP Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Overview of Employee Stock Option Plans</p>
        </div>
        <button
          onClick={handleProcessVesting}
          disabled={processing}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
        >
          {processing ? 'Processing...' : 'Process Vesting'}
        </button>
      </div>

      {processResult && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800">
          Vesting processed: <strong>{processResult.processed}</strong> schedule(s), <strong>{fmt(processResult.totalSharesVested)}</strong> shares vested.
          <button className="ml-3 text-green-600 underline" onClick={() => setProcessResult(null)}>Dismiss</button>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Pool Shares', value: fmt(stats.totalPoolShares), color: 'blue' },
          { label: 'Allocated Shares', value: fmt(stats.totalAllocatedShares), color: 'indigo' },
          { label: 'Available Shares', value: fmt(stats.totalAvailableShares), color: 'green' },
          { label: 'Active Grants', value: fmt(stats.totalActiveGrants), color: 'purple' },
          { label: 'Total Vested', value: fmt(stats.totalVestedShares), color: 'yellow' },
          { label: 'Total Exercised', value: fmt(stats.totalExercisedShares), color: 'orange' },
          { label: 'Pending Exercises', value: fmt(stats.pendingExerciseRequests), color: 'red' },
          { label: 'Pending Vesting', value: fmt(stats.pendingVestingSchedules), color: 'gray' },
        ].map((card) => (
          <div key={card.label} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-500 uppercase tracking-wide">{card.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Pool Utilization */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-800 mb-3">Pool Utilization</h2>
        <div className="flex items-center gap-4">
          <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
            <div
              className="h-4 bg-indigo-500 rounded-full transition-all"
              style={{ width: `${utilization}%` }}
            />
          </div>
          <span className="text-sm font-semibold text-gray-700 w-12 text-right">{utilization}%</span>
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>Allocated: {fmt(stats.totalAllocatedShares)}</span>
          <span>Available: {fmt(stats.totalAvailableShares)}</span>
        </div>
      </div>

      {/* Quick Navigation */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'ESOP Pools', href: '/esop/pools', desc: 'Manage share pools' },
          { label: 'Vesting Plans', href: '/esop/vesting-plans', desc: 'Define vesting rules' },
          { label: 'ESOP Grants', href: '/esop/grants', desc: 'Issue grants to employees' },
          { label: 'Vesting Schedule', href: '/esop/vesting-schedules', desc: 'Track vesting progress' },
          { label: 'Exercise Requests', href: '/esop/exercise-requests', desc: 'Manage exercise requests' },
          { label: 'ESOP Ledger', href: '/esop/ledger', desc: 'Full transaction history' },
          { label: 'My Holdings', href: '/esop/my-holdings', desc: 'Employee self-service' },
        ].map((nav) => (
          <a key={nav.label} href={nav.href}
            className="bg-white border border-gray-200 rounded-lg p-3 hover:border-indigo-400 hover:shadow-sm transition-all">
            <p className="text-sm font-semibold text-gray-800">{nav.label}</p>
            <p className="text-xs text-gray-500 mt-0.5">{nav.desc}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
