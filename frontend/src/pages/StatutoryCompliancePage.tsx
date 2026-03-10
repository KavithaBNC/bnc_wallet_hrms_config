import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/layout/AppHeader';
import { useAuthStore } from '../store/authStore';

const MODULES = [
  {
    path: '/statutory/epf',
    icon: '🏦',
    title: 'EPF Processing',
    description: 'Employee Provident Fund contributions, ECR file generation, and EPFO compliance.',
    metrics: ['Employee 12% | Employer 12%', 'Wage ceiling ₹15,000', 'ECR download (EPFO format)'],
    color: 'blue',
  },
  {
    path: '/statutory/esic',
    icon: '🏥',
    title: 'ESIC Processing',
    description: 'Employee State Insurance contributions for eligible employees.',
    metrics: ['Employee 0.75% | Employer 3.25%', 'Gross threshold ₹21,000', 'ESIC return generation'],
    color: 'green',
  },
  {
    path: '/statutory/professional-tax',
    icon: '🏛',
    title: 'Professional Tax',
    description: 'State-wise professional tax configuration and monthly PT report.',
    metrics: ['7 states configured', 'Slab-based calculation', 'State-grouped PT report'],
    color: 'purple',
  },
  {
    path: '/statutory/tds',
    icon: '📊',
    title: 'TDS / Income Tax',
    description: 'Monthly TDS, annual working sheet, and Form 16 generation.',
    metrics: ['Old & New regime support', 'Sec 206AA enforcement', 'Form 16 (Part A + B)'],
    color: 'orange',
  },
];

const COLOR_MAP: Record<string, { card: string; btn: string; icon: string }> = {
  blue:   { card: 'border-blue-100 hover:border-blue-300',   btn: 'bg-blue-600 hover:bg-blue-700',   icon: 'bg-blue-100 text-blue-700' },
  green:  { card: 'border-green-100 hover:border-green-300', btn: 'bg-green-600 hover:bg-green-700', icon: 'bg-green-100 text-green-700' },
  purple: { card: 'border-purple-100 hover:border-purple-300', btn: 'bg-purple-600 hover:bg-purple-700', icon: 'bg-purple-100 text-purple-700' },
  orange: { card: 'border-orange-100 hover:border-orange-300', btn: 'bg-orange-500 hover:bg-orange-600', icon: 'bg-orange-100 text-orange-700' },
};

const StatutoryCompliancePage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <AppHeader
        title="Statutory Compliance"
        subtitle={`Organization: ${user?.employee?.organization?.name || 'N/A'}`}
        onLogout={handleLogout}
      />

      <main className="flex-1 p-6 max-w-6xl mx-auto w-full">
        {/* Page intro */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-900">Indian Statutory Compliance</h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage EPF, ESIC, Professional Tax, and TDS/Income Tax compliance for your organization.
            All calculations are based on current statutory rates for FY 2025-26.
          </p>
        </div>

        {/* 4 Module Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
          {MODULES.map((mod) => {
            const c = COLOR_MAP[mod.color];
            return (
              <div
                key={mod.path}
                className={`bg-white rounded-xl shadow-sm border-2 p-6 transition-all cursor-pointer ${c.card}`}
                onClick={() => navigate(mod.path)}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${c.icon}`}>
                    {mod.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-semibold text-gray-900">{mod.title}</h3>
                    <p className="text-sm text-gray-500 mt-1 mb-3">{mod.description}</p>
                    <ul className="space-y-1">
                      {mod.metrics.map((m) => (
                        <li key={m} className="flex items-center gap-2 text-xs text-gray-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0" />
                          {m}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="mt-5 flex justify-end">
                  <button
                    className={`px-4 py-2 text-white text-sm font-medium rounded-lg transition ${c.btn}`}
                    onClick={(e) => { e.stopPropagation(); navigate(mod.path); }}
                  >
                    Open →
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick Info */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-blue-800 mb-2">Current Statutory Rates (FY 2025-26)</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'EPF Employee', value: '12% of Basic' },
              { label: 'EPF Employer', value: '12% (EPS 8.33% + EPF 3.67%)' },
              { label: 'ESIC Employee', value: '0.75% of Gross' },
              { label: 'ESIC Employer', value: '3.25% of Gross' },
            ].map((r) => (
              <div key={r.label} className="bg-white rounded-lg p-3 border border-blue-100">
                <p className="text-xs text-gray-500">{r.label}</p>
                <p className="text-sm font-semibold text-gray-800 mt-0.5">{r.value}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-blue-600 mt-3">
            Rates are configurable via Professional Tax → PT Configuration and backend Statutory Rate Config.
          </p>
        </div>
      </main>
    </div>
  );
};

export default StatutoryCompliancePage;
