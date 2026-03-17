import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { esopService, EsopGrant, EsopExerciseRequest } from '../services/esop.service';

const GRANT_STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-600',
  COMPLETED: 'bg-gray-100 text-gray-600',
};

const SCHED_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  VESTED: 'bg-green-100 text-green-700',
  LAPSED: 'bg-gray-100 text-gray-500',
};

const EXERCISE_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-blue-100 text-blue-700',
  REJECTED: 'bg-red-100 text-red-600',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
};

const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN');
const fmtCurrency = (v: string | number) =>
  `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

export default function EsopMyHoldingsPage() {
  const { user } = useAuthStore();
  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id || '';
  const employeeId = user?.employee?.id || '';

  const [grants, setGrants] = useState<EsopGrant[]>([]);
  const [exerciseRequests, setExerciseRequests] = useState<EsopExerciseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGrant, setExpandedGrant] = useState<string | null>(null);

  // Aggregate stats
  const totalGranted = grants.reduce((s, g) => s + g.totalShares, 0);
  const totalVested = grants.reduce((s, g) => s + g.vestedShares, 0);
  const totalExercised = grants.reduce((s, g) => s + g.exercisedShares, 0);
  const activeGrants = grants.filter(g => g.status === 'ACTIVE').length;

  useEffect(() => {
    if (!organizationId || !employeeId) return;
    const load = async () => {
      setLoading(true);
      try {
        const [grantsRes, exerciseRes] = await Promise.all([
          esopService.getAllGrants({ organizationId, employeeId, limit: 100 }),
          esopService.getAllExerciseRequests({ organizationId, employeeId, limit: 50 }),
        ]);
        // Load full grant details for vesting schedules
        const fullGrants = await Promise.all(
          grantsRes.items.map(g => esopService.getGrantById(g.id))
        );
        setGrants(fullGrants);
        setExerciseRequests(exerciseRes.items);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [organizationId, employeeId]);

  if (loading) {
    return <div className="p-6 text-gray-400 text-sm">Loading your holdings...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">My ESOP Holdings</h1>
        <p className="text-gray-500 text-sm">Your employee stock options — granted, vested, and exercised</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Active Grants</p>
          <p className="text-2xl font-bold text-indigo-600">{activeGrants}</p>
          <p className="text-xs text-gray-400 mt-1">{grants.length} total grants</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Total Granted</p>
          <p className="text-2xl font-bold text-gray-900">{totalGranted.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">shares</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Vested Shares</p>
          <p className="text-2xl font-bold text-green-600">{totalVested.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">
            {totalGranted > 0 ? `${Math.round((totalVested / totalGranted) * 100)}% of total` : '—'}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Exercised Shares</p>
          <p className="text-2xl font-bold text-blue-600">{totalExercised.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">
            {totalVested > 0 ? `${Math.round((totalExercised / totalVested) * 100)}% of vested` : '—'}
          </p>
        </div>
      </div>

      {/* Grants List */}
      <div>
        <h2 className="text-base font-semibold text-gray-800 mb-3">My Grants</h2>
        {grants.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400">
            No ESOP grants have been issued to you yet.
          </div>
        ) : (
          <div className="space-y-3">
            {grants.map(g => {
              const isExpanded = expandedGrant === g.id;
              const grantValue = g.totalShares * Number(g.grantPrice);
              const vestedValue = g.vestedShares * Number(g.grantPrice);
              const vestProgress = g.totalShares > 0 ? Math.round((g.vestedShares / g.totalShares) * 100) : 0;

              return (
                <div key={g.id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                  <div
                    className="p-4 cursor-pointer hover:bg-gray-50"
                    onClick={() => setExpandedGrant(isExpanded ? null : g.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${GRANT_STATUS_COLORS[g.status]}`}>
                            {g.status}
                          </span>
                          <span className="text-sm text-gray-600">
                            Grant Date: <strong>{fmtDate(g.grantDate)}</strong>
                          </span>
                          {g.pool && (
                            <span className="text-xs text-gray-400">Pool: {g.pool.poolName}</span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500 text-xs">Total Shares</span>
                            <p className="font-bold text-gray-900">{g.totalShares.toLocaleString()}</p>
                            <p className="text-xs text-gray-400">{fmtCurrency(grantValue)}</p>
                          </div>
                          <div>
                            <span className="text-gray-500 text-xs">Vested</span>
                            <p className="font-bold text-green-600">{g.vestedShares.toLocaleString()}</p>
                            <p className="text-xs text-gray-400">{fmtCurrency(vestedValue)}</p>
                          </div>
                          <div>
                            <span className="text-gray-500 text-xs">Exercised</span>
                            <p className="font-bold text-blue-600">{g.exercisedShares.toLocaleString()}</p>
                          </div>
                          <div>
                            <span className="text-gray-500 text-xs">Grant Price</span>
                            <p className="font-bold text-gray-700">{fmtCurrency(g.grantPrice)}</p>
                          </div>
                        </div>
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                            <span>Vesting Progress</span>
                            <span>{vestProgress}% ({g.vestedShares.toLocaleString()} / {g.totalShares.toLocaleString()})</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-1.5">
                            <div
                              className="bg-green-500 h-1.5 rounded-full transition-all"
                              style={{ width: `${vestProgress}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      <span className="text-gray-400 ml-4 text-lg">{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {/* Expanded: Vesting Schedule */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 px-4 pb-4">
                      <h4 className="text-xs font-semibold text-gray-600 uppercase mt-3 mb-2">Vesting Schedule</h4>
                      {(g.vestingSchedules ?? []).length === 0 ? (
                        <p className="text-xs text-gray-400">No vesting schedule available.</p>
                      ) : (
                        <table className="w-full text-xs">
                          <thead className="text-gray-500 bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left">Tranche</th>
                              <th className="px-3 py-2 text-left">Vesting Date</th>
                              <th className="px-3 py-2 text-right">Shares</th>
                              <th className="px-3 py-2 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {(g.vestingSchedules ?? []).map(vs => (
                              <tr key={vs.id} className={vs.status === 'VESTED' ? 'bg-green-50/40' : ''}>
                                <td className="px-3 py-2 text-gray-700">{vs.trancheNumber}</td>
                                <td className="px-3 py-2 text-gray-600">
                                  {fmtDate(vs.vestingDate)}
                                  {vs.status === 'PENDING' && new Date(vs.vestingDate) <= new Date() && (
                                    <span className="ml-1 text-orange-500">(due)</span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-right font-medium">{vs.scheduledShares.toLocaleString()}</td>
                                <td className="px-3 py-2 text-center">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SCHED_STATUS_COLORS[vs.status]}`}>
                                    {vs.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Exercise Requests */}
      <div>
        <h2 className="text-base font-semibold text-gray-800 mb-3">My Exercise Requests</h2>
        {exerciseRequests.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-6 text-center text-gray-400 text-sm">
            No exercise requests submitted yet.
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 text-left">Request Date</th>
                  <th className="px-4 py-3 text-right">Shares</th>
                  <th className="px-4 py-3 text-right">Exercise Price</th>
                  <th className="px-4 py-3 text-right">Total Value</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-left">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {exerciseRequests.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600">{fmtDate(r.requestDate)}</td>
                    <td className="px-4 py-3 text-right font-medium">{r.sharesRequested.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">{fmtCurrency(r.exercisePrice)}</td>
                    <td className="px-4 py-3 text-right text-indigo-600 font-medium">{fmtCurrency(r.totalExerciseValue)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${EXERCISE_STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-600'}`}>
                        {r.status}
                      </span>
                      {r.rejectionReason && (
                        <p className="text-xs text-red-500 mt-0.5">{r.rejectionReason}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{r.remarks || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
