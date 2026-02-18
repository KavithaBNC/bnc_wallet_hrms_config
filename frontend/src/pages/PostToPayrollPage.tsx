import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';

export default function PostToPayrollPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader
        title="Post to Payroll"
        subtitle={organizationName ? `Organization: ${organizationName}` : undefined}
        onLogout={handleLogout}
      />

      <main className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-6 bg-gray-50">
        <div className="w-full max-w-[800px] mx-auto">
          <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-5" aria-label="Breadcrumb">
            <Link to="/others-configuration" className="hover:text-gray-900">Others Configuration</Link>
            <span>/</span>
            <span className="font-semibold text-gray-900">Post to Payroll</span>
          </nav>

          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h1 className="text-lg font-semibold text-black">Post to Payroll</h1>
              <p className="text-sm text-gray-500 mt-1">
                Post attendance and related data to payroll for processing.
              </p>
            </div>
            <div className="p-6">
              <div className="text-center py-12">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">Post to Payroll</h3>
                <p className="mt-1 text-sm text-gray-500">Post attendance data to payroll. Configuration coming soon.</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
