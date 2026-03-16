import { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { fetchLeaveData, type LeaveBalance, type LeaveRequest } from '../../services/dashboard.service';

const LEAVE_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  'Sick Leave': { bg: 'bg-red-50', text: 'text-red-600', bar: 'bg-red-500' },
  'Casual Leave': { bg: 'bg-blue-50', text: 'text-blue-600', bar: 'bg-blue-500' },
  'Earned Leave': { bg: 'bg-green-50', text: 'text-green-600', bar: 'bg-green-500' },
};

const DEFAULT_COLOR = { bg: 'bg-purple-50', text: 'text-purple-600', bar: 'bg-purple-500' };

const STATUS_BADGE: Record<string, string> = {
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  PENDING: 'bg-amber-100 text-amber-700',
};

const LeaveDetails = () => {
  const { user } = useAuthStore();
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const orgId = user?.employee?.organizationId || user?.employee?.organization?.id;
      const empId = user?.employee?.id;
      if (orgId) {
        const data = await fetchLeaveData(orgId, empId);
        setBalances(data.balances);
        setRequests(data.requests);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 border border-gray-100 p-6 animate-pulse h-full">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-6" />
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-gray-200 rounded-lg" />)}
        </div>
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-gray-200 rounded" />)}
        </div>
      </div>
    );
  }

  const totalRemaining = balances.reduce((sum, b) => sum + b.remaining, 0);

  return (
    <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 border border-gray-100 p-6 transition-all duration-300 hover:shadow-xl h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Leave Balance</h3>
          <p className="text-xs text-gray-500">Current leave status</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-blue-600">{totalRemaining}</p>
          <p className="text-[10px] text-gray-500">Days Remaining</p>
        </div>
      </div>

      {/* Leave type cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {balances.slice(0, 3).map((leave, i) => {
          const colors = LEAVE_COLORS[leave.type] || DEFAULT_COLOR;
          const usedPercent = leave.total > 0 ? (leave.used / leave.total) * 100 : 0;

          return (
            <div key={i} className={`${colors.bg} rounded-xl p-3`}>
              <p className={`text-[10px] font-semibold ${colors.text} uppercase tracking-wider mb-1`}>
                {leave.type}
              </p>
              <p className="text-lg font-bold text-gray-900">
                {leave.remaining}<span className="text-xs text-gray-400 font-normal">/{leave.total}</span>
              </p>
              <div className="w-full bg-gray-200/50 rounded-full h-1.5 mt-2">
                <div
                  className={`${colors.bar} h-1.5 rounded-full transition-all duration-500`}
                  style={{ width: `${usedPercent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent requests */}
      <div className="flex-1 flex flex-col">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Recent Requests</h4>
        <div className="space-y-2.5 flex-1 overflow-y-auto">
          {requests.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-3">No recent requests</p>
          ) : (
            requests.map((req) => (
              <div key={req.id} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-1 h-8 rounded-full ${STATUS_BADGE[req.status]?.includes('green') ? 'bg-green-500' : STATUS_BADGE[req.status]?.includes('red') ? 'bg-red-500' : 'bg-amber-500'}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{req.type}</p>
                    <p className="text-[10px] text-gray-400">
                      {formatShortDate(req.startDate)} - {formatShortDate(req.endDate)}
                    </p>
                  </div>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[req.status] || 'bg-gray-100 text-gray-600'}`}>
                  {req.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

function formatShortDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  } catch {
    return dateStr;
  }
}

export default LeaveDetails;
