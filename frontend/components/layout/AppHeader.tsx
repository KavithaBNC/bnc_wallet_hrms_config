import { Link } from 'react-router-dom';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  notificationCount?: number;
  onLogout: () => void;
}

export default function AppHeader({
  title,
  subtitle,
  notificationCount = 0,
  onLogout,
}: AppHeaderProps) {
  return (
    <header className="flex-shrink-0 bg-white shadow-md">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
        {/* Left: Title & Subtitle */}
        <div className="flex-shrink-0">
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {subtitle && (
            <p className="text-sm text-gray-600 mt-0.5">{subtitle}</p>
          )}
        </div>
        {/* Right: Profile, Logout */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <Link
            to="/profile"
            className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition font-medium"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            My Profile
          </Link>
          <button
            onClick={onLogout}
            className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition shadow-sm"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
