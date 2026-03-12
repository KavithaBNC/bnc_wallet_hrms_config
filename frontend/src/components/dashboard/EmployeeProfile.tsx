import { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { fetchProfile, type ProfileData } from '../../services/dashboard.service';

const EmployeeProfile = () => {
  const { user } = useAuthStore();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const empId = user?.employee?.id;
      if (empId) {
        const data = await fetchProfile(empId);
        setProfile(data);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 border border-gray-100 p-6 animate-pulse">
        <div className="h-24 bg-gray-200 rounded-xl mb-4" />
        <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
        <div className="h-4 bg-gray-200 rounded w-1/3" />
      </div>
    );
  }

  const initials = profile
    ? `${profile.firstName[0] || ''}${profile.lastName[0] || ''}`.toUpperCase()
    : 'EU';

  const infoItems = [
    { label: 'Department', value: profile?.department || 'N/A', icon: departmentIcon },
    { label: 'Manager', value: profile?.manager || 'N/A', icon: managerIcon },
    { label: 'Joined', value: profile?.joiningDate ? formatDate(profile.joiningDate) : 'N/A', icon: calendarIcon },
    { label: 'Email', value: profile?.email || 'N/A', icon: emailIcon },
    { label: 'Phone', value: profile?.phone || 'N/A', icon: phoneIcon },
    { label: 'Location', value: profile?.location || 'N/A', icon: locationIcon },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 border border-gray-100 overflow-hidden transition-all duration-300 hover:shadow-xl">
      {/* Header with gradient */}
      <div className="relative bg-gradient-to-r from-blue-600 to-blue-400 px-6 pt-6 pb-12">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-2 right-6 w-20 h-20 rounded-full border-2 border-white/30" />
          <div className="absolute bottom-0 left-10 w-16 h-16 rounded-full border-2 border-white/20" />
        </div>
        <div className="flex items-center justify-between relative z-10">
          <div>
            <p className="text-blue-100 text-xs font-medium">Employee Profile</p>
          </div>
          <span className="bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full backdrop-blur-sm">
            {profile?.employeeCode || 'N/A'}
          </span>
        </div>
      </div>

      {/* Avatar overlapping header */}
      <div className="relative px-6 -mt-8">
        <div className="flex items-end gap-4">
          <div className="relative">
            {profile?.profilePictureUrl ? (
              <img
                src={profile.profilePictureUrl}
                alt={`${profile.firstName} ${profile.lastName}`}
                className="w-16 h-16 rounded-xl object-cover border-4 border-white shadow-md"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center border-4 border-white shadow-md">
                <span className="text-white text-lg font-bold">{initials}</span>
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white" />
          </div>
          <div className="pb-1">
            <h3 className="text-lg font-bold text-gray-900">
              {profile?.firstName} {profile?.lastName}
            </h3>
            <p className="text-sm text-gray-500">{profile?.position || 'N/A'}</p>
          </div>
        </div>
      </div>

      {/* Info grid */}
      <div className="p-6 pt-4">
        <div className="grid grid-cols-2 gap-3">
          {infoItems.map((item, i) => (
            <div
              key={i}
              className="flex items-center gap-2 p-2.5 rounded-lg bg-gray-50 hover:bg-blue-50 transition-colors duration-200"
            >
              <div className="text-gray-400 flex-shrink-0">{item.icon}</div>
              <div className="min-w-0">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">{item.label}</p>
                <p className="text-xs font-semibold text-gray-700 truncate">{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

// Inline SVG icons (matching template style)
const departmentIcon = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
  </svg>
);
const managerIcon = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
  </svg>
);
const calendarIcon = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
  </svg>
);
const emailIcon = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
  </svg>
);
const phoneIcon = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
  </svg>
);
const locationIcon = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 0115 0z" />
  </svg>
);

export default EmployeeProfile;
