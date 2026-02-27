import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';

export default function PayrollMasterPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const subModules = [
    {
      to: '/payroll/employee-separation',
      label: 'Employee Separation',
      description: 'Manage employee separations and offboarding.',
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
      ),
    },
    {
      to: '/payroll/employee-rejoin',
      label: 'Employee Rejoin',
      description: 'Manage employee rejoin after resignation or termination.',
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader
        title="Payroll Master"
        subtitle={organizationName ? `Organization: ${organizationName}` : undefined}
        onLogout={handleLogout}
      />

      <main className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900">Payroll and employee lifecycle.</h2>
          <p className="mt-1 text-sm text-gray-600">Manage separations and rejoin from here.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {subModules.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-start gap-4 p-6 bg-white rounded-lg shadow hover:shadow-md transition border border-gray-100"
            >
              <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                {item.icon}
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-gray-900">{item.label}</h3>
                <p className="mt-1 text-sm text-gray-600">{item.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
