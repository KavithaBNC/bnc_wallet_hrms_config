import { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { fetchSalaryInfo, type SalaryInfo } from '../../services/dashboard.service';

const SalaryPayroll = () => {
  const { user } = useAuthStore();
  const [salary, setSalary] = useState<SalaryInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const empId = user?.employee?.id;
      if (empId) {
        const data = await fetchSalaryInfo(empId);
        setSalary(data);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 border border-gray-100 p-6 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-6" />
        <div className="h-24 bg-gray-200 rounded-xl mb-4" />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-gray-200 rounded" />)}
        </div>
      </div>
    );
  }

  const data = salary || {
    currentSalary: 0, bonus: 0, incentives: 0,
    lastPaidDate: 'N/A', ytdEarnings: 0, recentPayslips: [],
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 border border-gray-100 p-6 transition-all duration-300 hover:shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Salary & Payroll</h3>
          <p className="text-xs text-gray-500">Current month overview</p>
        </div>
        <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>

      {/* Salary display */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-400 rounded-xl p-5 mb-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-16 h-16 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        <p className="text-blue-100 text-xs font-medium mb-1">Current Salary</p>
        <p className="text-3xl font-bold text-white mb-2">{formatCurrency(data.currentSalary)}</p>
        <div className="flex items-center gap-4 text-blue-100 text-xs">
          <span>Bonus: {formatCurrency(data.bonus)}</span>
          <span>Incentives: {formatCurrency(data.incentives)}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-[10px] text-gray-400 font-medium uppercase">Last Paid</p>
          <p className="text-sm font-semibold text-gray-800">{data.lastPaidDate}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-[10px] text-gray-400 font-medium uppercase">YTD Earnings</p>
          <p className="text-sm font-semibold text-gray-800">{formatCurrency(data.ytdEarnings)}</p>
        </div>
      </div>

      {/* Recent payslips */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Recent Payslips</h4>
        <div className="space-y-2">
          {data.recentPayslips.map((slip) => (
            <div key={slip.id} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-50 transition-colors group">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">{slip.month}</p>
                  <p className="text-[10px] text-gray-400">{formatShortDate(slip.date)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-700">{formatCurrency(slip.amount)}</span>
                <button className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-500 hover:text-blue-700">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

function formatCurrency(amount: number): string {
  if (amount === 0) return '---';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatShortDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export default SalaryPayroll;
