import { useState } from 'react';
import { getMockAnniversaries, type AnniversaryPerson } from '../../services/dashboard.service';

const WorkAnniversaryReminders = () => {
  const [anniversaries] = useState<AnniversaryPerson[]>(() => getMockAnniversaries());

  return (
    <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 border border-gray-100 p-6 transition-all duration-300 hover:shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0016.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.003 6.003 0 01-3.77 1.522m0 0a6.003 6.003 0 01-3.77-1.522" />
            </svg>
          </div>
          <h3 className="text-sm font-bold text-gray-900">Work Anniversaries</h3>
        </div>
        <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-2 py-1 rounded-full">Placeholder</span>
      </div>

      {/* Anniversary list */}
      <div className="space-y-2.5">
        {anniversaries.map((person) => (
          <div key={person.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-amber-50/50 transition-colors">
            {person.profilePictureUrl ? (
              <img src={person.profilePictureUrl} alt={person.name} className="w-9 h-9 rounded-full object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">
                  {person.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{person.name}</p>
              <p className="text-[10px] text-gray-400">{person.department} &middot; {person.years} year{person.years !== 1 ? 's' : ''}</p>
            </div>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${person.date === 'Today' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
              {person.date}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WorkAnniversaryReminders;
