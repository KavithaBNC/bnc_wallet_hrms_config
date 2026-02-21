import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';

/**
 * HR Activities > Post to Payroll – filter by Month & Associate, then Delete / Post / Export.
 * This is a different page from Others Configuration > Post to Payroll (mapping config).
 */
export default function PostToPayrollHRActivitiesPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;

  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [associate, setAssociate] = useState('');
  const [showAll, setShowAll] = useState(true);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleDelete = () => {
    // TODO: API – delete selected / filtered payroll post data
    alert('Delete – backend integration pending.');
  };

  const handlePost = () => {
    // TODO: API – post to payroll for selected month/associate
    alert('Post – backend integration pending.');
  };

  const handleExport = () => {
    // TODO: API – export filtered data
    alert('Export – backend integration pending.');
  };

  if (!user) {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-gray-100 items-center justify-center p-8">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader
        title="HR Activities"
        subtitle={organizationName ? `Organization: ${organizationName}` : undefined}
        onLogout={handleLogout}
      />

      <main className="flex-1 min-h-0 overflow-auto w-full bg-gray-100">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6 bg-gray-50">
          {/* Breadcrumbs - HR Activities */}
          <div className="mb-6">
            <nav className="flex items-center text-sm text-gray-600" aria-label="Breadcrumb">
              <Link to="/hr-activities/validation-process" className="text-gray-500 hover:text-gray-900">
                HR Activities
              </Link>
              <span className="mx-1 text-gray-400">/</span>
              <span className="font-semibold text-gray-900">Post to Payroll</span>
            </nav>
          </div>

          <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
            {/* Title bar - project theme (no blue) */}
            <div className="px-6 py-4 border-b border-gray-200 bg-white">
              <h1 className="text-2xl font-bold text-gray-900">Post to Payroll</h1>
            </div>

            {/* Filters section - image layout, project theme */}
            <div className="px-6 py-5 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-900 pb-2 mb-4 border-b-2 border-gray-300">
                Filters
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Month</label>
                  <div className="relative">
                    <input
                      type="month"
                      value={month}
                      onChange={(e) => setMonth(e.target.value)}
                      className="w-full h-10 pl-4 pr-10 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Associate</label>
                  <input
                    type="text"
                    value={associate}
                    onChange={(e) => setAssociate(e.target.value)}
                    placeholder="Associate"
                    className="w-full h-10 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white placeholder-gray-400 focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">Show All</span>
                <span className="text-sm text-gray-500">:</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={showAll}
                  onClick={() => setShowAll((v) => !v)}
                  className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 ${
                    showAll ? 'bg-orange-500' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition ${
                      showAll ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
                <span className="text-sm font-medium text-gray-700">{showAll ? 'YES' : 'NO'}</span>
              </div>
            </div>

            {/* Main content area - empty white like image */}
            <div className="min-h-[320px] bg-white" />

            {/* Footer actions - project theme (gray/orange, no blue/green) */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={handleDelete}
                className="h-9 px-4 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 hover:text-red-700 hover:border-red-300 transition inline-flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </button>
              <button
                type="button"
                onClick={handlePost}
                className="h-9 px-4 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition inline-flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
                Post
              </button>
              <button
                type="button"
                onClick={handleExport}
                className="h-9 px-4 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 transition inline-flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
