import { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { getMockPerformance, type PerformanceData } from '../../services/dashboard.service';

const PerformanceWidget = () => {
  const [data] = useState<PerformanceData>(() => getMockPerformance());

  return (
    <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 border border-gray-100 p-6 transition-all duration-300 hover:shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Performance</h3>
          <p className="text-xs text-gray-500">Your KPIs & metrics</p>
        </div>
        <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-2 py-1 rounded-full">Placeholder</span>
      </div>

      {/* Metrics cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {/* Rating */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-3">
          <div className="flex items-center gap-1 mb-1">
            <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
            </svg>
            <span className="text-[10px] text-amber-600 font-medium">Rating</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{data.overallRating}</p>
          <p className="text-[10px] text-gray-400">out of 5.0</p>
        </div>

        {/* KPI Score */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-3">
          <div className="flex items-center gap-1 mb-1">
            <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
            <span className="text-[10px] text-blue-600 font-medium">KPI Score</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{data.kpiScore}%</p>
          <p className="text-[10px] text-gray-400">weighted avg</p>
        </div>

        {/* Next Review */}
        <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl p-3">
          <div className="flex items-center gap-1 mb-1">
            <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-[10px] text-purple-600 font-medium">Review</span>
          </div>
          <p className="text-sm font-bold text-gray-900">{formatReviewDate(data.nextReviewDate)}</p>
          <p className="text-[10px] text-gray-400">next review</p>
        </div>
      </div>

      {/* Trend chart */}
      <div className="mb-5">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Performance Trend</h4>
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.trendData}>
              <defs>
                <linearGradient id="perfGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} domain={[70, 100]} />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', fontSize: 12 }}
                formatter={(value: number) => [`${value}%`, 'Score']}
              />
              <Area type="monotone" dataKey="score" stroke="#3B82F6" strokeWidth={2} fill="url(#perfGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* KPI Breakdown */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">KPI Breakdown</h4>
        <div className="space-y-2.5">
          {data.kpis.map((kpi, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-xs text-gray-600 w-28 flex-shrink-0 truncate">{kpi.name}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${kpi.score >= kpi.target ? 'bg-green-500' : 'bg-amber-500'}`}
                  style={{ width: `${kpi.score}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-gray-700 w-10 text-right">{kpi.score}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

function formatReviewDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export default PerformanceWidget;
