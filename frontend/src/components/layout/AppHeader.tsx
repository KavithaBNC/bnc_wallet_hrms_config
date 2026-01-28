import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

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
  const { user } = useAuthStore();
  const userName = user?.firstName || user?.employee?.firstName || 'Admin';
  const userRole = user?.role || 'Admin';
  
  // Get user initials for avatar
  const getInitials = () => {
    const firstName = user?.firstName || user?.employee?.firstName || 'A';
    const lastName = user?.lastName || user?.employee?.lastName || '';
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  return (
    <header className="flex-shrink-0 bg-white/80 backdrop-blur-lg shadow-md border-b border-gray-200">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
        {/* Left: Title & Subtitle */}
        <div className="flex-shrink-0">
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {subtitle && (
            <p className="text-sm text-gray-600 mt-0.5">{subtitle}</p>
          )}
        </div>
        {/* Right: Welcome message with profile, Logout */}
        <div className="flex items-center gap-4 flex-shrink-0">
          {/* Welcome message */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-700">Welcome, {userName}</p>
              <p className="text-xs text-gray-500 capitalize">{userRole.replace('_', ' ')}</p>
            </div>
            {/* Profile Picture */}
            <Link
              to="/profile"
              className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold hover:ring-2 hover:ring-blue-300 transition-all cursor-pointer shadow-md"
              title="View Profile"
            >
              {getInitials()}
            </Link>
          </div>
          
          {/* Logout Button */}
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
