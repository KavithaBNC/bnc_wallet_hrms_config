import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { esopService, VestingSchedule } from '../services/esop.service';

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  VESTED: 'bg-green-100 text-green-700',
  LAPSED: 'bg-gray-100 text-gray-500',
};

const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN');

export default function VestingSchedulePage() {
  const { user } = useAuthStore();
  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id || '';
  const role = user?.role ?? '';
  const isAdmin = ['SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'].includes(role);

  const [schedules, setSchedules] = useState<VestingSchedule[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [processing, setProcessing] = useState(false);
  const [asOf, setAsOf] = useState(new Date().toISOString().split('T')[0]);
  const [processResult, setProcessResult] = useState<{ processed: number; totalSharesVested: number } | null>(null);

  const fetchSchedules = async (page = 1) => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const res = await esopService.getVestingSchedules({
        organizationId,
        page,
        limit: 20,
        status: statusFilter || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      });
      setSchedules(res.items);
      setPagination(res.pagination);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules(1);
  }, [organizationId]);

  const handleProcessVesting = async () => {
    if (!confirm(`Process all pending vesting up to ${asOf}? This action cannot be undone.`)) return;
    setProcessing(true);
    setProcessResult(null);
    try {
      const result = await esopService.processVesting(organizationId, asOf);
      setProcessResult(result);
      fetchSchedules(pagination.page);
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Failed to process vesting');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Vesting Schedules</h1>
          <p className="text-gray-500 text-sm">Track auto-generated vesting tranches for all grants</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Process up to:</label>
            <input type="date" value={asOf} onChange={e => setAsOf(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            <button onClick={handleProcessVesting} disabled={processing}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {processing ? 'Processing...' : 'Process Vesting'}
            </button>
          </div>
        )}
      </div>

      {processResult && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          Vesting processed: <strong>{processResult.processed}</strong> schedule(s) vested,{' '}
          <strong>{processResult.totalSharesVested.toLocaleString()}</strong> shares vested in total.
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-4">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="VESTED">Vested</option>
          <option value="LAPSED">Lapsed</option>
        </select>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">From:</label>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">To:</label>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <button onClick={() => fetchSchedules(1)}
          className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">
          Apply Filters
        </button>
        <button onClick={() => { setStatusFilter(''); setFromDate(''); setToDate(''); setTimeout(() => fetchSchedules(1), 0); }}
          className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700">
          Clear
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left">Employee</th>
              <th className="px-4 py-3 text-center">Tranche</th>
              <th className="px-4 py-3 text-left">Vesting Date</th>
              <th className="px-4 py-3 text-right">Scheduled Shares</th>
              <th className="px-4 py-3 text-right">Vested Shares</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-left">Processed At</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">Loading...</td></tr>
            ) : schedules.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">No vesting schedules found.</td></tr>
            ) : schedules.map(vs => (
              <tr key={vs.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">
                    {vs.grant?.employee?.firstName} {vs.grant?.employee?.lastName}
                  </p>
                  <p className="text-xs text-gray-400">{vs.grant?.employee?.employeeCode}</p>
                </td>
                <td className="px-4 py-3 text-center text-gray-600">{vs.trancheNumber}</td>
                <td className="px-4 py-3 text-gray-700">
                  {fmtDate(vs.vestingDate)}
                  {vs.status === 'PENDING' && new Date(vs.vestingDate) <= new Date() && (
                    <span className="ml-2 text-xs text-orange-500">(due)</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-medium">{vs.scheduledShares.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-indigo-600">
                  {vs.vestedShares > 0 ? vs.vestedShares.toLocaleString() : '—'}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[vs.status] || 'bg-gray-100 text-gray-600'}`}>
                    {vs.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {vs.processedAt ? fmtDate(vs.processedAt) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
          <span>Showing {schedules.length} of {pagination.total}</span>
          <div className="flex gap-2">
            <button disabled={pagination.page <= 1} onClick={() => fetchSchedules(pagination.page - 1)}
              className="px-3 py-1 border rounded disabled:opacity-40">Previous</button>
            <button disabled={pagination.page >= pagination.totalPages} onClick={() => fetchSchedules(pagination.page + 1)}
              className="px-3 py-1 border rounded disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
