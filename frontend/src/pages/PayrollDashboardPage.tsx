import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/layout/AppHeader';
import { useAuthStore } from '../store/authStore';
import { payrollCycleService, payslipService, PayrollCycle } from '../services/payroll.service';

const fmt = (v: number) =>
  '₹' + Number(v).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const fmtL = (v: number) => {
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(2)} Cr`;
  if (v >= 100000) return `₹${(v / 100000).toFixed(2)} L`;
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

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const PayrollDashboardPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;
  const organizationId = user?.employee?.organizationId;

  const isHRManager = user?.role === 'HR_MANAGER';
  const isOrgAdmin = user?.role === 'ORG_ADMIN';
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const canManagePayroll = isHRManager || isOrgAdmin || isSuperAdmin;

  const [cycles, setCycles] = useState<PayrollCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalPayslips, setTotalPayslips] = useState(0);

  useEffect(() => {
    if (organizationId) fetchData();
  }, [organizationId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [cycleRes, slipRes] = await Promise.all([
        payrollCycleService.getAll({ organizationId, page: '1', limit: '12' }),
        payslipService.getAll({ organizationId, page: '1', limit: '1' }),
      ]);
      setCycles(cycleRes.data || []);
      setTotalPayslips(slipRes.pagination?.total || 0);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  // Compute stats
  const latestCycle = cycles[0] || null;
  const processedCycles = cycles.filter(c => ['PROCESSED', 'FINALIZED', 'PAID'].includes(c.status));
  const pendingCycles = cycles.filter(c => ['DRAFT', 'PROCESSING'].includes(c.status));
  const totalNetThisMonth = latestCycle?.totalNet ? Number(latestCycle.totalNet) : 0;
  const totalGrossThisMonth = latestCycle?.totalGross ? Number(latestCycle.totalGross) : 0;
  const totalDeductionsThisMonth = latestCycle?.totalDeductions ? Number(latestCycle.totalDeductions) : 0;
  const totalEmployeesThisMonth = latestCycle?.totalEmployees || 0;

  // Build trend data from last 6 cycles
  const trendCycles = [...cycles].slice(0, 6).reverse();
  const maxNet = Math.max(...trendCycles.map(c => Number(c.totalNet || 0)), 1);

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader
        title="Payroll Dashboard"
        subtitle={organizationName ? `Organization: ${organizationName}` : undefined}
        onLogout={handleLogout}
      />

      <div className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        {/* Page heading */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Payroll Overview</h2>
            <p className="text-sm text-gray-500 mt-1">Monthly payroll summary and key metrics</p>
          </div>
          {canManagePayroll && (
            <button
              onClick={() => navigate('/payroll/run')}
              className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
            >
              ▶ Run Payroll
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="text-center py-16">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            <p className="mt-3 text-gray-500 text-sm">Loading dashboard...</p>
          </div>
        ) : (
          <>
            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
              {/* Employees This Month */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-gray-500">Employees This Month</p>
                  <span className="bg-blue-100 text-blue-600 rounded-lg p-2 text-lg">👥</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{totalEmployeesThisMonth}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {latestCycle ? `${new Date(latestCycle.periodStart).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })} cycle` : 'No cycle yet'}
                </p>
              </div>

              {/* Processed Cycles */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-gray-500">Processed Cycles</p>
                  <span className="bg-green-100 text-green-600 rounded-lg p-2 text-lg">✅</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{processedCycles.length}</p>
                <p className="text-xs text-gray-400 mt-1">{pendingCycles.length} pending action</p>
              </div>

              {/* Gross Pay */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-gray-500">Gross Pay (Latest)</p>
                  <span className="bg-purple-100 text-purple-600 rounded-lg p-2 text-lg">💼</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{fmtL(totalGrossThisMonth)}</p>
                <p className="text-xs text-gray-400 mt-1">Deductions: {fmtL(totalDeductionsThisMonth)}</p>
              </div>

              {/* Net Pay */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-gray-500">Net Pay (Latest)</p>
                  <span className="bg-orange-100 text-orange-600 rounded-lg p-2 text-lg">💰</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{fmtL(totalNetThisMonth)}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {latestCycle ? (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(latestCycle.status)}`}>
                      {latestCycle.status}
                    </span>
                  ) : 'No data'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
              {/* Trend Chart */}
              <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Net Pay Trend (Last 6 Months)</h3>
                {trendCycles.length === 0 ? (
                  <div className="flex items-center justify-center h-36 text-gray-400 text-sm">
                    No payroll data available
                  </div>
                ) : (
                  <div className="flex items-end gap-3 h-36">
                    {trendCycles.map((c) => {
                      const net = Number(c.totalNet || 0);
                      const heightPct = maxNet > 0 ? Math.max((net / maxNet) * 100, 4) : 4;
                      const periodDate = new Date(c.periodStart);
                      return (
                        <div key={c.id} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-xs text-gray-500 font-medium">{fmtL(net)}</span>
                          <div
                            className="w-full bg-blue-500 rounded-t-md transition-all duration-500"
                            style={{ height: `${heightPct}%` }}
                            title={`${c.name}: ${fmt(net)}`}
                          />
                          <span className="text-xs text-gray-400">
                            {MONTH_NAMES[periodDate.getMonth()]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Quick Actions</h3>
                <div className="space-y-2">
                  {canManagePayroll && (
                    <button
                      onClick={() => navigate('/payroll/run')}
                      className="w-full flex items-center gap-3 px-4 py-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-sm font-medium transition"
                    >
                      <span>▶</span> Run Payroll
                    </button>
                  )}
                  <button
                    onClick={() => navigate('/payroll/history')}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg text-sm font-medium transition"
                  >
                    <span>📋</span> Payroll History
                  </button>
                  {user?.employee?.id && (
                    <button
                      onClick={() => navigate(`/payroll/employee/${user.employee!.id}`)}
                      className="w-full flex items-center gap-3 px-4 py-3 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-sm font-medium transition"
                    >
                      <span>👤</span> My Payslips
                    </button>
                  )}
                  <button
                    onClick={() => navigate('/payroll')}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg text-sm font-medium transition"
                  >
                    <span>📅</span> Payroll Cycles
                  </button>
                  <button
                    onClick={() => navigate('/salary-structures')}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg text-sm font-medium transition"
                  >
                    <span>🏗</span> Salary Structures
                  </button>
                  <button
                    onClick={() => navigate('/payroll/fnf-settlement')}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg text-sm font-medium transition"
                  >
                    <span>🤝</span> F&amp;F Settlement
                  </button>
                  <button
                    onClick={() => navigate('/payroll/loans')}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg text-sm font-medium transition"
                  >
                    <span>🏦</span> Loans &amp; Advances
                  </button>
                </div>
              </div>
            </div>

            {/* Recent Payroll Cycles */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">Recent Payroll Cycles</h3>
                <button
                  onClick={() => navigate('/payroll/history')}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  View All →
                </button>
              </div>
              {cycles.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">
                  No payroll cycles found.{canManagePayroll && ' Click "Run Payroll" to get started.'}
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
                        <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Net Pay</th>
                        <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {cycles.slice(0, 8).map((cycle) => (
                        <tr key={cycle.id} className="hover:bg-gray-50 transition">
                          <td className="px-5 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {cycle.name}
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(cycle.periodStart).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                            {' – '}
                            {new Date(cycle.periodEnd).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusColor(cycle.status)}`}>
                              {getStatusIcon(cycle.status)} {cycle.status}
                            </span>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-700 text-right">
                            {cycle.totalEmployees ?? '-'}
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-700 text-right">
                            {cycle.totalGross ? fmtL(Number(cycle.totalGross)) : '-'}
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 text-right">
                            {cycle.totalNet ? fmtL(Number(cycle.totalNet)) : '-'}
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap text-center">
                            {canManagePayroll && cycle.status === 'DRAFT' && (
                              <button
                                onClick={() => navigate('/payroll/run')}
                                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                              >
                                ▶ Process
                              </button>
                            )}
                            {canManagePayroll && cycle.status === 'PROCESSED' && (
                              <button
                                onClick={() => navigate('/payroll/run')}
                                className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                              >
                                🔒 Finalize
                              </button>
                            )}
                            {['FINALIZED', 'PAID'].includes(cycle.status) && (
                              <button
                                onClick={() => navigate('/payroll/history')}
                                className="text-xs text-gray-600 hover:text-gray-800 font-medium"
                              >
                                View →
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Total Payslips counter */}
            <div className="mt-4 text-center text-xs text-gray-400">
              {totalPayslips.toLocaleString()} payslips generated across all cycles
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PayrollDashboardPage;
