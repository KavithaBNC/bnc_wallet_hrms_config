import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { esopService, EsopLedgerEntry, EsopLedgerType } from '../services/esop.service';

const TYPE_COLORS: Record<EsopLedgerType, string> = {
  POOL_CREATED: 'bg-blue-100 text-blue-700',
  POOL_UPDATED: 'bg-blue-50 text-blue-600',
  PLAN_CREATED: 'bg-purple-100 text-purple-700',
  GRANT_ISSUED: 'bg-indigo-100 text-indigo-700',
  GRANT_CANCELLED: 'bg-red-100 text-red-600',
  SHARES_VESTED: 'bg-green-100 text-green-700',
  EXERCISE_REQUESTED: 'bg-yellow-100 text-yellow-700',
  EXERCISE_APPROVED: 'bg-teal-100 text-teal-700',
  EXERCISE_REJECTED: 'bg-red-50 text-red-500',
  EXERCISE_COMPLETED: 'bg-emerald-100 text-emerald-700',
};

const TYPE_LABELS: Record<EsopLedgerType, string> = {
  POOL_CREATED: 'Pool Created',
  POOL_UPDATED: 'Pool Updated',
  PLAN_CREATED: 'Plan Created',
  GRANT_ISSUED: 'Grant Issued',
  GRANT_CANCELLED: 'Grant Cancelled',
  SHARES_VESTED: 'Shares Vested',
  EXERCISE_REQUESTED: 'Exercise Requested',
  EXERCISE_APPROVED: 'Exercise Approved',
  EXERCISE_REJECTED: 'Exercise Rejected',
  EXERCISE_COMPLETED: 'Exercise Completed',
};

const LEDGER_TYPES: EsopLedgerType[] = [
  'POOL_CREATED', 'POOL_UPDATED', 'PLAN_CREATED',
  'GRANT_ISSUED', 'GRANT_CANCELLED', 'SHARES_VESTED',
  'EXERCISE_REQUESTED', 'EXERCISE_APPROVED', 'EXERCISE_REJECTED', 'EXERCISE_COMPLETED',
];

const fmtDateTime = (d: string) =>
  new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const fmtCurrency = (v: string | number | null) =>
  v ? `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—';

export default function EsopLedgerPage() {
  const { user } = useAuthStore();
  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id || '';

  const [entries, setEntries] = useState<EsopLedgerEntry[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  const [typeFilter, setTypeFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const fetchLedger = async (page = 1) => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const res = await esopService.getLedger({
        organizationId,
        page,
        limit: 25,
        transactionType: typeFilter || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      });
      setEntries(res.items);
      setPagination(res.pagination);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLedger(1);
  }, [organizationId]);

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">ESOP Ledger</h1>
        <p className="text-gray-500 text-sm">Complete audit trail of all ESOP transactions</p>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="">All Transaction Types</option>
          {LEDGER_TYPES.map(t => (
            <option key={t} value={t}>{TYPE_LABELS[t]}</option>
          ))}
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
        <button onClick={() => fetchLedger(1)}
          className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">
          Apply Filters
        </button>
        <button onClick={() => { setTypeFilter(''); setFromDate(''); setToDate(''); setTimeout(() => fetchLedger(1), 0); }}
          className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700">
          Clear
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left">Date & Time</th>
              <th className="px-4 py-3 text-left">Transaction</th>
              <th className="px-4 py-3 text-left">Employee / Description</th>
              <th className="px-4 py-3 text-right">Shares</th>
              <th className="px-4 py-3 text-right">Price</th>
              <th className="px-4 py-3 text-right">Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-400">Loading...</td></tr>
            ) : entries.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-400">No ledger entries found.</td></tr>
            ) : entries.map(entry => (
              <tr key={entry.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                  {fmtDateTime(entry.transactionDate)}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${TYPE_COLORS[entry.transactionType] || 'bg-gray-100 text-gray-600'}`}>
                    {TYPE_LABELS[entry.transactionType]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {entry.grant?.employee && (
                    <p className="font-medium text-gray-900 text-xs">
                      {entry.grant.employee.firstName} {entry.grant.employee.lastName}
                      <span className="text-gray-400 ml-1">({entry.grant.employee.employeeCode})</span>
                    </p>
                  )}
                  {entry.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{entry.description}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-medium">
                  {entry.sharesCount != null ? entry.sharesCount.toLocaleString() : '—'}
                </td>
                <td className="px-4 py-3 text-right text-gray-600">
                  {fmtCurrency(entry.sharePrice)}
                </td>
                <td className="px-4 py-3 text-right text-indigo-600 font-medium">
                  {fmtCurrency(entry.transactionValue)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
          <span>Showing {entries.length} of {pagination.total} entries</span>
          <div className="flex gap-2">
            <button disabled={pagination.page <= 1} onClick={() => fetchLedger(pagination.page - 1)}
              className="px-3 py-1 border rounded disabled:opacity-40">Previous</button>
            <span className="px-3 py-1 text-gray-500">{pagination.page} / {pagination.totalPages}</span>
            <button disabled={pagination.page >= pagination.totalPages} onClick={() => fetchLedger(pagination.page + 1)}
              className="px-3 py-1 border rounded disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
