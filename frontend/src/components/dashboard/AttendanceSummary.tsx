import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useAuthStore } from '../../store/authStore';
import { fetchAttendanceStats, type AttendanceStats } from '../../services/dashboard.service';

const STATUS_COLORS: Record<string, string> = {
  present: '#10B981',
  late: '#F59E0B',
  absent: '#EF4444',
  'half-day': '#14B8A6',
};

const AttendanceSummary = () => {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const orgId = user?.employee?.organizationId || user?.employee?.organization?.id;
      const empId = user?.employee?.id;
      if (orgId) {
        const data = await fetchAttendanceStats(orgId, empId);
        setStats(data);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 border border-gray-100 p-6 animate-pulse h-full">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-6" />
        <div className="h-40 bg-gray-200 rounded mb-4" />
        <div className="grid grid-cols-4 gap-2">
          {[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-gray-200 rounded" />)}
        </div>
      </div>
    );
  }

  const data = stats || {
    workingDays: 0, present: 0, absent: 0, late: 0,
    todayStatus: 'Not Marked' as const,
    weeklyData: [],
  };

  const statusBadgeColor = {
    Present: 'bg-blue-100 text-blue-700',
    Late: 'bg-amber-100 text-amber-700',
    Absent: 'bg-red-100 text-red-700',
    'Not Marked': 'bg-gray-100 text-gray-600',
  };

  const statItems = [
    { label: 'Working Days', value: data.workingDays, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Present', value: data.present, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Absent', value: data.absent, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Late', value: data.late, color: 'text-amber-600', bg: 'bg-amber-50' },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 border border-gray-100 p-6 transition-all duration-300 hover:shadow-xl h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Attendance</h3>
          <p className="text-xs text-gray-500">This month's summary</p>
        </div>
        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${statusBadgeColor[data.todayStatus]}`}>
          {data.todayStatus}
        </span>
      </div>

      {/* Chart */}
      <div className="h-40 mb-5 flex-1 min-h-[10rem]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.weeklyData} barCategoryGap="20%">
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} domain={[0, 10]} />
            <Tooltip
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', fontSize: 12 }}
              formatter={(value: number) => [`${value} hrs`, 'Hours']}
            />
            <Bar dataKey="hours" radius={[6, 6, 0, 0]}>
              {data.weeklyData.map((entry, index) => (
                <Cell key={index} fill={STATUS_COLORS[entry.status?.toLowerCase()] || '#D1D5DB'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-2">
        {statItems.map((item, i) => (
          <div key={i} className={`${item.bg} rounded-lg p-2.5 text-center`}>
            <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
            <p className="text-[10px] text-gray-500 font-medium">{item.label}</p>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-100">
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[10px] text-gray-500 capitalize">{status}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AttendanceSummary;
