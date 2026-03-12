import { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { fetchHolidays, type HolidayItem } from '../../services/dashboard.service';

const HOLIDAY_COLORS = [
  'bg-blue-100 text-blue-600',
  'bg-green-100 text-green-600',
  'bg-purple-100 text-purple-600',
  'bg-amber-100 text-amber-600',
  'bg-red-100 text-red-600',
  'bg-pink-100 text-pink-600',
  'bg-teal-100 text-teal-600',
];

const HolidaysWidget = () => {
  const { user } = useAuthStore();
  const [holidays, setHolidays] = useState<HolidayItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const load = async () => {
      const orgId = user?.employee?.organizationId || user?.employee?.organization?.id;
      if (orgId) {
        const data = await fetchHolidays(orgId);
        setHolidays(data);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 border border-gray-100 p-6 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-6" />
        <div className="h-20 bg-gray-200 rounded-xl mb-4" />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-gray-200 rounded" />)}
        </div>
      </div>
    );
  }

  // Find next upcoming holiday
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcomingHolidays = holidays
    .filter((h) => new Date(h.date) >= today)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const nextHoliday = upcomingHolidays[0];
  const daysUntilNext = nextHoliday
    ? Math.ceil((new Date(nextHoliday.date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const displayHolidays = showAll ? upcomingHolidays : upcomingHolidays.slice(0, 4);

  const publicCount = holidays.filter((h) => h.type === 'Public Holiday').length;
  const festivalCount = holidays.filter((h) => h.type === 'Festival').length;
  const optionalCount = holidays.filter((h) => h.type === 'Optional').length;

  return (
    <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 border border-gray-100 p-6 transition-all duration-300 hover:shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Holidays</h3>
          <p className="text-xs text-gray-500">Upcoming holidays</p>
        </div>
        <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
      </div>

      {/* Next holiday countdown */}
      {nextHoliday && (
        <div className="bg-gradient-to-r from-blue-600 to-blue-400 rounded-xl p-4 mb-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <p className="text-blue-100 text-xs font-medium">Next Holiday</p>
          <p className="text-white font-bold text-lg mt-1">{nextHoliday.name}</p>
          <div className="flex items-center justify-between mt-2">
            <p className="text-blue-100 text-xs">
              {formatFullDate(nextHoliday.date)} &middot; {nextHoliday.day}
            </p>
            <div className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1">
              <span className="text-white text-lg font-bold">{daysUntilNext}</span>
              <span className="text-blue-100 text-[10px] ml-1">days</span>
            </div>
          </div>
        </div>
      )}

      {/* Holiday list */}
      <div className="space-y-2 mb-4">
        {displayHolidays.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No upcoming holidays</p>
        ) : (
          displayHolidays.map((holiday, i) => (
            <div key={holiday.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${HOLIDAY_COLORS[i % HOLIDAY_COLORS.length]}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{holiday.name}</p>
                <p className="text-[10px] text-gray-400">{formatFullDate(holiday.date)} &middot; {holiday.day}</p>
              </div>
              <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${holiday.type === 'Festival' ? 'bg-amber-100 text-amber-700' : holiday.type === 'Optional' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                {holiday.type}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Show all toggle */}
      {upcomingHolidays.length > 4 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full text-center text-xs text-blue-600 hover:text-blue-700 font-medium py-1"
        >
          {showAll ? 'Show less' : `View all ${upcomingHolidays.length} holidays`}
        </button>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-100 mt-3">
        <div className="text-center">
          <p className="text-lg font-bold text-blue-600">{holidays.length}</p>
          <p className="text-[10px] text-gray-500">Total</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-green-600">{publicCount}</p>
          <p className="text-[10px] text-gray-500">Public</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-amber-600">{festivalCount + optionalCount}</p>
          <p className="text-[10px] text-gray-500">Festival</p>
        </div>
      </div>
    </div>
  );
};

function formatFullDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export default HolidaysWidget;
