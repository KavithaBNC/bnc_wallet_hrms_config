import { useNavigate } from 'react-router-dom';

const REPORTS = [
  {
    path: '/reports/payroll-register',
    title: 'Payroll Register',
    description: 'Employee-wise payroll summary — gross, deductions, net pay for selected month.',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    color: 'bg-indigo-50 text-indigo-600',
  },
  {
    path: '/reports/epf',
    title: 'EPF Report',
    description: 'Provident Fund contribution report — employee & employer PF/EPS for the period.',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    color: 'bg-blue-50 text-blue-600',
  },
  {
    path: '/reports/esic',
    title: 'ESIC Report',
    description: 'Employee State Insurance contribution report for eligible employees.',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
    color: 'bg-green-50 text-green-600',
  },
  {
    path: '/reports/professional-tax',
    title: 'Professional Tax Report',
    description: 'State-wise professional tax deduction report by employee.',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    color: 'bg-yellow-50 text-yellow-600',
  },
  {
    path: '/reports/tds-working',
    title: 'TDS Working Report',
    description: 'Detailed income tax calculation — taxable income, slabs, Sec 87A, and TDS per employee.',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M12 7h.01M9 7h.01M6 3h12l2 9H4L6 3z" />
      </svg>
    ),
    color: 'bg-orange-50 text-orange-600',
  },
  {
    path: '/reports/form16',
    title: 'Form 16 Data',
    description: 'Exportable data for Form 16 generation — annual income tax computation per employee.',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    color: 'bg-purple-50 text-purple-600',
  },
  {
    path: '/reports/fnf-settlement',
    title: 'F&F Settlement Report',
    description: 'List of completed Full & Final settlements with component-wise totals.',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
      </svg>
    ),
    color: 'bg-rose-50 text-rose-600',
  },
];

export default function ReportsDashboardPage() {
  const navigate = useNavigate();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-500 mt-1">
          Payroll, statutory, and settlement reports — export as CSV or print
        </p>
      </div>

      {/* Report cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {REPORTS.map((r) => (
          <button
            key={r.path}
            onClick={() => navigate(r.path)}
            className="bg-white rounded-xl border border-gray-200 p-5 text-left hover:shadow-md hover:border-indigo-200 transition-all group"
          >
            <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${r.color} mb-4`}>
              {r.icon}
            </div>
            <h2 className="text-base font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
              {r.title}
            </h2>
            <p className="text-sm text-gray-500 mt-1 leading-relaxed">{r.description}</p>
            <div className="mt-4 flex items-center text-indigo-600 text-sm font-medium">
              View Report
              <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
