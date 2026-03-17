import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';

export default function AttendancePolicyPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-50">
      <AppHeader
        title="Attendance Policy"
        subtitle={organizationName ? `Organization: ${organizationName}` : undefined}
        onLogout={handleLogout}
      />

      <main className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        <nav className="flex text-sm text-gray-600 mb-4" aria-label="Breadcrumb">
          <Link to="/dashboard" className="hover:text-gray-900">Home</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-900 font-medium">Attendance Policy</span>
        </nav>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h1 className="text-xl font-semibold text-gray-900 mb-4">Attendance Policy</h1>
          <p className="text-gray-600">
            Configure and manage your organization&apos;s attendance policies, rules, and guidelines here.
          </p>
          <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-500">
              This module is ready for you to add attendance policy features such as late arrival rules,
              grace periods, overtime policies, and other attendance-related configurations.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
