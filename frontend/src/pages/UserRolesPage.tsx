import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';
import userRoleModuleService, { UserRole } from '../services/userRoleModule.service';

export default function UserRolesPage() {
  const navigate = useNavigate();
  const { logout } = useAuthStore();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchRoles();
  }, []);

  // Get logged-in user's role_id from stored projects
  const getLoggedInRoleId = (): number | null => {
    try {
      const raw = localStorage.getItem('projects');
      if (!raw) return null;
      const projects = JSON.parse(raw);
      const hrms = Array.isArray(projects)
        ? projects.find((p: any) => p.code === 'HRMS001' || p.name === 'HRMS') || projects[0]
        : null;
      return hrms?.role_id ?? null;
    } catch {
      return null;
    }
  };

  const fetchRoles = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await userRoleModuleService.getRoles();
      // Hide the logged-in user's own role from the list
      const loggedInRoleId = getLoggedInRoleId();
      const filtered = loggedInRoleId != null
        ? data.filter((r) => r.role_id !== loggedInRoleId)
        : data;
      setRoles(filtered);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to fetch roles');
    } finally {
      setLoading(false);
    }
  };

  const filteredRoles = roles.filter((role) =>
    role.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filteredRoles.length / pageSize));
  const paginatedRoles = filteredRoles.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const activeCount = roles.filter((r) => r.is_active !== false).length;
  const inactiveCount = roles.length - activeCount;

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader title="User Module" onLogout={handleLogout} />

      <main className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-6 bg-gray-50">
        <div className="w-full max-w-[1600px] mx-auto">

          {/* Breadcrumbs */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
            <nav className="flex items-center gap-1.5 text-sm text-gray-500" aria-label="Breadcrumb">
              <span className="font-semibold text-gray-900">User Module</span>
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span className="text-gray-500">User Module</span>
              <span className="mx-1 text-gray-400">/</span>
              <span className="text-gray-500">Role List</span>
            </nav>
          </div>

          {/* Filters Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="flex flex-col lg:col-span-2">
              <label className="text-sm font-medium text-gray-500 mb-1.5">Search</label>
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="h-10 w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-700 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex items-center gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#333333] flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500">Total Roles</div>
                <div className="text-2xl font-bold text-gray-900">{roles.length}</div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex items-center gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#2196F3] flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500">Active</div>
                <div className="text-2xl font-bold text-gray-900">{activeCount}</div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex items-center gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#F44336] flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500">Inactive</div>
                <div className="text-2xl font-bold text-gray-900">{inactiveCount}</div>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              <p className="font-semibold">Unable to load roles. Please try again.</p>
              <p className="text-sm mt-1">{error}</p>
              <button onClick={fetchRoles} className="mt-2 text-sm underline hover:no-underline">Retry</button>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-600 ml-3">Loading roles...</p>
            </div>
          )}

          {/* Table */}
          {!loading && !error && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              {/* Row Per Page */}
              <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>Row Per Page</span>
                  <select
                    value={pageSize}
                    onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                    className="h-9 px-3 py-1 bg-white border border-gray-300 rounded text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value={10}>10 Entries</option>
                    <option value={20}>20 Entries</option>
                    <option value={50}>50 Entries</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 table-fixed">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="w-[8%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                      <th className="w-[42%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role Name</th>
                      <th className="w-[25%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="w-[25%] px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedRoles.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-12 text-center text-gray-500 text-sm">
                          {searchTerm ? 'No roles match your search.' : 'No roles found.'}
                        </td>
                      </tr>
                    ) : (
                      paginatedRoles.map((role, index) => (
                        <tr key={role.role_id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{(currentPage - 1) * pageSize + index + 1}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{role.name}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              role.is_active !== false
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {role.is_active !== false ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-center">
                            <button
                              onClick={() => navigate(`/user-module/permissions/${role.role_id}`, { state: { roleName: role.name } })}
                              className="p-1.5 rounded text-blue-600 hover:bg-blue-50"
                              title="Module Permissions"
                            >
                              {/* Shield Icon */}
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {filteredRoles.length > 0 && (
                <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between flex-wrap gap-2">
                  <p className="text-sm text-gray-700">
                    Showing <span className="font-medium">{(currentPage - 1) * pageSize + 1}</span> to <span className="font-medium">{Math.min(currentPage * pageSize, filteredRoles.length)}</span> of <span className="font-medium">{filteredRoles.length}</span> results
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <span className="px-3 py-1.5 text-sm text-gray-600">Page {currentPage} of {totalPages}</span>
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
