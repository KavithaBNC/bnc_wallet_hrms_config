import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import fnfSettlementService, { FnfSettlement } from '../services/fnfSettlement.service';

const statusConfig = {
  DRAFT:      { label: 'Draft',          color: 'bg-gray-100 text-gray-700' },
  CALCULATED: { label: 'Calculated',     color: 'bg-blue-100 text-blue-700' },
  APPROVED:   { label: 'HR Approved',    color: 'bg-orange-100 text-orange-700' },
  PAID:       { label: 'Completed',      color: 'bg-green-100 text-green-700' },
};

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const fmtDate = (d: string) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function FnfDashboardPage() {
  const navigate = useNavigate();

  const [stats, setStats] = useState({ pending: 0, hrApproved: 0, completed: 0, totalPaidAmount: 0 });
  const [recent, setRecent] = useState<FnfSettlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [s, r] = await Promise.all([
          fnfSettlementService.getStats(),
          fnfSettlementService.getAll({ organizationId: '', page: 1, limit: 10 }),
        ]);
        setStats(s);
        setRecent(r.items || []);
      } catch {
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const statCards = [
    {
      label: 'Pending / In Progress',
      value: stats.pending,
      icon: '⏳',
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      text: 'text-yellow-700',
    },
    {
      label: 'HR Approved',
      value: stats.hrApproved,
      icon: '✅',
      bg: 'bg-orange-50',
      border: 'border-orange-200',
      text: 'text-orange-700',
    },
    {
      label: 'Completed',
      value: stats.completed,
      icon: '🏁',
      bg: 'bg-green-50',
      border: 'border-green-200',
      text: 'text-green-700',
    },
    {
      label: 'Total Paid Out',
      value: fmt(stats.totalPaidAmount),
      icon: '💰',
      bg: 'bg-indigo-50',
      border: 'border-indigo-200',
      text: 'text-indigo-700',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">F&amp;F Settlement</h1>
          <p className="text-sm text-gray-500 mt-1">Full &amp; Final Settlement management for separated employees</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/payroll/fnf-settlement/history')}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
          >
            View History
          </button>
          <button
            onClick={() => navigate('/payroll/fnf-settlement/initiate')}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
          >
            + Initiate Settlement
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((c) => (
          <div key={c.label} className={`rounded-xl border ${c.border} ${c.bg} p-5`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">{c.icon}</span>
            </div>
            <p className={`text-2xl font-bold ${c.text}`}>{c.value}</p>
            <p className="text-sm text-gray-500 mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Recent Settlements */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800">Recent Settlements</h2>
          <button
            onClick={() => navigate('/payroll/fnf-settlement/history')}
            className="text-sm text-indigo-600 hover:underline"
          >
            View all →
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>
        ) : recent.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-gray-400 text-sm">No settlements found.</p>
            <button
              onClick={() => navigate('/payroll/fnf-settlement/initiate')}
              className="mt-3 text-sm text-indigo-600 hover:underline"
            >
              Initiate your first settlement →
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Employee', 'Department', 'Last Working Date', 'Net Settlement', 'Status', 'Action'].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recent.map((s) => {
                  const cfg = statusConfig[s.status] || statusConfig.DRAFT;
                  return (
                    <tr key={s.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">
                          {s.employee?.firstName} {s.employee?.lastName}
                        </div>
                        <div className="text-xs text-gray-400">{s.employee?.employeeCode}</div>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{s.employee?.department?.name || '—'}</td>
                      <td className="px-6 py-4 text-gray-600">{fmtDate(s.lastWorkingDate)}</td>
                      <td className="px-6 py-4 font-semibold text-gray-900">{fmt(Number(s.netSettlement))}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => navigate(`/payroll/fnf-settlement/${s.id}`)}
                          className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                        >
                          View →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
