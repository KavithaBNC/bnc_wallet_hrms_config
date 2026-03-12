import { useState } from 'react';
import { getMockBirthdays, type BirthdayPerson } from '../../services/dashboard.service';

const BirthdayReminders = () => {
  const [birthdays] = useState<BirthdayPerson[]>(() => getMockBirthdays());

  return (
    <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 border border-gray-100 p-6 transition-all duration-300 hover:shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-pink-100 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-pink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.87c1.355 0 2.697.055 4.024.165C17.155 8.51 18 9.473 18 10.608v2.513m-3-4.87v-1.5m-6 1.5v-1.5m12 9.75l-1.5.75a3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0L3 16.5m15-3.38a48.474 48.474 0 00-6-.371c-2.032 0-4.034.126-6 .37" />
            </svg>
          </div>
          <h3 className="text-sm font-bold text-gray-900">Birthday Reminders</h3>
        </div>
        <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-2 py-1 rounded-full">Placeholder</span>
      </div>

      {/* Birthday list */}
      <div className="space-y-2.5">
        {birthdays.map((person) => (
          <div key={person.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-pink-50/50 transition-colors">
            {person.profilePictureUrl ? (
              <img src={person.profilePictureUrl} alt={person.name} className="w-9 h-9 rounded-full object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">
                  {person.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{person.name}</p>
              <p className="text-[10px] text-gray-400">{person.department}</p>
            </div>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${person.date === 'Today' ? 'bg-pink-100 text-pink-700' : 'bg-gray-100 text-gray-600'}`}>
              {person.date}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BirthdayReminders;
