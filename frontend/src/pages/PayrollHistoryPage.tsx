import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/layout/AppHeader';
import { useAuthStore } from '../store/authStore';
import { payrollCycleService, PayrollCycle } from '../services/payroll.service';

const fmt = (v: number | string | undefined | null) =>
  '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const fmtL = (v: number) => {
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(2)} Cr`;
  if (v >= 100000) return `₹${(v / 100000).toFixed(2)} L`;
  if (v === 0) return '₹0';
  return fmt(v);
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'DRAFT': return 'bg-gray-100 text-gray-700';
    case 'PROCESSING': return 'bg-yellow-100 text-yellow-700';
    case 'PROCESSED': return 'bg-blue-100 text-blue-700';
    case 'FINALIZED': return 'bg-purple-100 text-purple-700';
    case 'PAID': return 'bg-green-100 text-green-700';
    case 'CANCELLED': return 'bg-red-100 text-red-700';
    default: return 'bg-gray-100 text-gray-700';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'DRAFT': return '📝';
    case 'PROCESSING': return '⚙️';
    case 'PROCESSED': return '✅';
    case 'FINALIZED': return '🔒';
    case 'PAID': return '💰';
    case 'CANCELLED': return '❌';
    default: return '📋';
  }
};

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2, CURRENT_YEAR - 3].map(y => ({
  label: `FY ${y}-${(y + 1).toString().slice(-2)}`,
  value: y,
}));

const STATUS_OPTIONS = [
  { label: 'All', value: '' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Processed', value: 'PROCESSED' },
  { label: 'Finalized', value: 'FINALIZED' },
  { label: 'Paid', value: 'PAID' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

const PayrollHistoryPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;
  const organizationId = user?.employee?.organizationId;

  const isHRManager = user?.role === 'HR_MANAGER';
  const isOrgAdmin = user?.role === 'ORG_ADMIN';
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const canManagePayroll = isHRManager || isOrgAdmin || isSuperAdmin;

  // Filters
  const [filterYear, setFilterYear] = useState<number>(CURRENT_YEAR);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [searchText, setSearchText] = useState('');

  // Data
  const [cycles, setCycles] = useState<PayrollCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Rollback tracking
  const [rollingBack, setRollingBack] = useState<string | null>(null);

  useEffect(() => {
    if (organizationId) fetchCycles();
  }, [organizationId, filterYear, filterStatus]);

  const fetchCycles = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = { organizationId, page: '1', limit: '100' };
      if (filterStatus) params.status = filterStatus;
      const res = await payrollCycleService.getAll(params);
      // Filter by year client-side for simplicity
      const all = (res.data || []).filter(c => {
        const year = new Date(c.periodStart).getFullYear();
        return year === filterYear || year === filterYear + 1; // cover Apr-Mar FY
      });
      setCycles(all);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load payroll history');
    } finally {
      setLoading(false);
    }
  };

  const handleRollback = async (cycle: PayrollCycle) => {
    if (!confirm(`Rollback "${cycle.name}"? This will unlock the cycle for re-processing.`)) return;
    try {
      setRollingBack(cycle.id);
      await payrollCycleService.rollbackPayrollCycle(cycle.id);
      alert('Payroll cycle rolled back successfully!');
      fetchCycles();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to rollback');
    } finally {
      setRollingBack(null);
    }
  };

  const handleMarkPaid = async (cycle: PayrollCycle) => {
    if (!confirm(`Mark "${cycle.name}" as PAID? This updates all payslips to PAID status.`)) return;
    try {
      await payrollCycleService.markAsPaid(cycle.id);
      alert('Marked as PAID!');
      fetchCycles();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to mark as paid');
    }
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  // Filter cycles by search
  const filtered = cycles.filter(c =>
    !searchText || c.name.toLowerCase().includes(searchText.toLowerCase())
  );

  // YTD totals
  const ytdGross = filtered.reduce((s, c) => s + Number(c.totalGross || 0), 0);
  const ytdNet = filtered.reduce((s, c) => s + Number(c.totalNet || 0), 0);
  const ytdDeductions = filtered.reduce((s, c) => s + Number(c.totalDeductions || 0), 0);
  const ytdEmployees = Math.max(...filtered.map(c => c.totalEmployees || 0), 0);

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader
        title="Payroll History"
        subtitle={organizationName ? `Organization: ${organizationName}` : undefined}
        onLogout={handleLogout}
      />

      <div className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        {/* Heading */}
        <div className="mb-5 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Payroll History</h2>
            <p className="text-sm text-gray-500 mt-0.5">All payroll cycles — historical view</p>
          </div>
          {canManagePayroll && (
            <button
              onClick={() => navigate('/payroll/run')}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
            >
              ▶ Run Payroll
            </button>
          )}
        </div>

        {/* YTD Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
          {[
            { label: `Cycles (FY ${filterYear}-${(filterYear + 1).toString().slice(-2)})`, value: filtered.length.toString(), icon: '📅', color: 'text-blue-700 bg-blue-50' },
            { label: 'YTD Gross', value: fmtL(ytdGross), icon: '💼', color: 'text-purple-700 bg-purple-50' },
            { label: 'YTD Deductions', value: fmtL(ytdDeductions), icon: '➖', color: 'text-red-700 bg-red-50' },
            { label: 'YTD Net Pay', value: fmtL(ytdNet), icon: '💰', color: 'text-green-700 bg-green-50' },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className={`inline-flex items-center justify-center w-9 h-9 rounded-lg mb-2 text-lg ${card.color}`}>
                {card.icon}
              </div>
              <p className="text-xl font-bold text-gray-900">{card.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{card.label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-4">
          <div className="px-5 py-4 flex flex-wrap items-center gap-3">
            {/* Year filter */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-500">Financial Year:</label>
              <select
                value={filterYear}
                onChange={e => setFilterYear(Number(e.target.value))}
                className="h-8 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {YEAR_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Status filter */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-500">Status:</label>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="h-8 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div className="flex-1 min-w-48">
              <input
                type="text"
                placeholder="Search cycle name..."
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                className="w-full h-8 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <span className="text-xs text-gray-400">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Main Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="text-center py-16">
              <div className="inline-block animate-spin rounded-full h-7 w-7 border-b-2 border-blue-600" />
              <p className="mt-3 text-gray-500 text-sm">Loading payroll history...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-400 text-sm">No payroll cycles found for this period.</p>
              {canManagePayroll && (
                <button
                  onClick={() => navigate('/payroll/run')}
                  className="mt-3 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition"
                >
                  ▶ Run First Payroll
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cycle</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Employees</th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Gross</th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Deductions</th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Net Pay</th>
                    {canManagePayroll && (
                      <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {filtered.map((cycle) => (
                    <tr key={cycle.id} className="hover:bg-gray-50 transition">
                      <td className="px-5 py-4 whitespace-nowrap">
                        <p className="text-sm font-semibold text-gray-900">{cycle.name}</p>
                        {cycle.isLocked && (
                          <span className="text-xs text-purple-600">🔒 Locked</span>
                        )}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(cycle.periodStart).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        <span className="text-gray-300 mx-1">–</span>
                        {new Date(cycle.periodEnd).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusColor(cycle.status)}`}>
                          {getStatusIcon(cycle.status)} {cycle.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-700 text-right">
                        {cycle.totalEmployees ?? '—'}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-700 text-right">
                        {cycle.totalGross ? fmtL(Number(cycle.totalGross)) : '—'}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm text-red-600 text-right">
                        {cycle.totalDeductions ? fmtL(Number(cycle.totalDeductions)) : '—'}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm font-semibold text-green-700 text-right">
                        {cycle.totalNet ? fmtL(Number(cycle.totalNet)) : '—'}
                      </td>
                      {canManagePayroll && (
                        <td className="px-5 py-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2 flex-wrap">
                            {/* View Payslips */}
                            <button
                              onClick={() => navigate('/payroll')}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap"
                            >
                              📄 Payslips
                            </button>

                            {/* Process (DRAFT) */}
                            {cycle.status === 'DRAFT' && (
                              <button
                                onClick={() => navigate('/payroll/run')}
                                className="text-xs text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap"
                              >
                                ▶ Process
                              </button>
                            )}

                            {/* Finalize (PROCESSED) */}
                            {cycle.status === 'PROCESSED' && (
                              <button
                                onClick={() => navigate('/payroll/run')}
                                className="text-xs text-purple-600 hover:text-purple-800 font-medium whitespace-nowrap"
                              >
                                🔒 Finalize
                              </button>
                            )}

                            {/* Rollback (FINALIZED) */}
                            {cycle.status === 'FINALIZED' && (
                              <button
                                onClick={() => handleRollback(cycle)}
                                disabled={rollingBack === cycle.id}
                                className="text-xs text-orange-600 hover:text-orange-800 font-medium whitespace-nowrap disabled:opacity-50"
                              >
                                {rollingBack === cycle.id ? '...' : '↩ Rollback'}
                              </button>
                            )}

                            {/* Mark Paid (FINALIZED) */}
                            {cycle.status === 'FINALIZED' && (
                              <button
                                onClick={() => handleMarkPaid(cycle)}
                                className="text-xs text-green-600 hover:text-green-800 font-medium whitespace-nowrap"
                              >
                                ✅ Mark Paid
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>

                {/* YTD footer */}
                <tfoot>
                  <tr className="bg-gray-50 border-t-2 border-gray-200">
                    <td colSpan={3} className="px-5 py-3 text-sm font-semibold text-gray-700">
                      Total ({filtered.length} cycles)
                    </td>
                    <td className="px-5 py-3 text-sm font-bold text-gray-800 text-right">
                      {ytdEmployees > 0 ? ytdEmployees : '—'}
                    </td>
                    <td className="px-5 py-3 text-sm font-bold text-gray-800 text-right">
                      {ytdGross > 0 ? fmtL(ytdGross) : '—'}
                    </td>
                    <td className="px-5 py-3 text-sm font-bold text-red-700 text-right">
                      {ytdDeductions > 0 ? fmtL(ytdDeductions) : '—'}
                    </td>
                    <td className="px-5 py-3 text-sm font-bold text-green-700 text-right">
                      {ytdNet > 0 ? fmtL(ytdNet) : '—'}
                    </td>
                    {canManagePayroll && <td />}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Compliance Reports Quick Links */}
        {canManagePayroll && !loading && filtered.length > 0 && (
          <div className="mt-5 bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Compliance Reports</h3>
            <div className="flex flex-wrap gap-3">
              {[
                { label: '📋 Payroll Register', path: '/payroll' },
                { label: '📁 PF ECR', path: '/payroll' },
                { label: '🏦 Bank Advice', path: '/payroll' },
                { label: '📑 ESIC Statement', path: '/payroll' },
                { label: '📊 TDS Worksheet', path: '/payroll' },
                { label: '📄 Form 16', path: '/payroll' },
              ].map(item => (
                <button
                  key={item.label}
                  onClick={() => navigate(item.path)}
                  className="px-4 py-2 bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-100 transition"
                >
                  {item.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-400">
              Reports are available in the Payroll Cycles section under each finalized cycle.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PayrollHistoryPage;
