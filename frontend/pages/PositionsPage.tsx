import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePositionStore } from '../store/positionStore';
import { useDepartmentStore } from '../store/departmentStore';
import { useAuthStore } from '../store/authStore';
import { Position } from '../services/position.service';
import Modal from '../components/common/Modal';
import PositionForm from '../components/positions/PositionForm';
import AppHeader from '../components/layout/AppHeader';

export default function PositionsPage() {
  const navigate = useNavigate();
  const { user, loadUser, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;
  const { positions, loading, error, pagination, fetchPositions, deletePosition } = usePositionStore();
  const { departments, fetchDepartments } = useDepartmentStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [loadingUser, setLoadingUser] = useState(false);

  // Get organizationId from logged-in user
  const organizationId = user?.employee?.organizationId;

  // Try to load user data if organizationId is missing
  useEffect(() => {
    if (!organizationId && user && !loadingUser) {
      setLoadingUser(true);
      loadUser()
        .catch((error) => {
          console.error('Failed to load user:', error);
        })
        .finally(() => {
          setLoadingUser(false);
        });
    }
  }, [organizationId, user, loadUser]);

  useEffect(() => {
    if (organizationId) {
      fetchDepartments(organizationId);
    }
  }, [organizationId, fetchDepartments]);

  useEffect(() => {
    if (!organizationId) return; // Don't fetch if organizationId is not available
    
    const params: any = {
      organizationId,
      page: currentPage,
      limit: 20,
    };
    if (searchTerm) params.search = searchTerm;
    if (levelFilter !== 'ALL') params.level = levelFilter;
    if (typeFilter !== 'ALL') params.employmentType = typeFilter;
    if (departmentFilter !== 'ALL') params.departmentId = departmentFilter;

    fetchPositions(params);
  }, [organizationId, currentPage, searchTerm, levelFilter, typeFilter, departmentFilter, fetchPositions]);

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this position?')) {
      try {
        await deletePosition(id);
        alert('Position deleted successfully');
      } catch (error: any) {
        alert(error.message || 'Failed to delete position');
      }
    }
  };

  const handleEdit = (position: Position) => {
    setEditingPosition(position);
    setShowForm(true);
  };

  const handleCreate = () => {
    setEditingPosition(null);
    setShowForm(true);
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingPosition(null);
    const params: any = {
      organizationId,
      page: currentPage,
      limit: 20,
    };
    if (searchTerm) params.search = searchTerm;
    if (levelFilter !== 'ALL') params.level = levelFilter;
    if (typeFilter !== 'ALL') params.employmentType = typeFilter;
    if (departmentFilter !== 'ALL') params.departmentId = departmentFilter;
    fetchPositions(params);
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingPosition(null);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getLevelBadgeColor = (level: string) => {
    const colors: Record<string, string> = {
      'C_LEVEL': 'bg-purple-100 text-purple-800',
      'VP': 'bg-indigo-100 text-indigo-800',
      'DIRECTOR': 'bg-blue-100 text-blue-800',
      'MANAGER': 'bg-cyan-100 text-cyan-800',
      'LEAD': 'bg-teal-100 text-teal-800',
      'SENIOR': 'bg-green-100 text-green-800',
      'JUNIOR': 'bg-yellow-100 text-yellow-800',
      'ENTRY': 'bg-orange-100 text-orange-800',
    };
    return colors[level] || 'bg-gray-100 text-gray-800';
  };

  const getTypeBadgeColor = (type: string) => {
    const colors: Record<string, string> = {
      'FULL_TIME': 'bg-green-100 text-green-800',
      'PART_TIME': 'bg-blue-100 text-blue-800',
      'CONTRACT': 'bg-yellow-100 text-yellow-800',
      'INTERN': 'bg-purple-100 text-purple-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const formatLevel = (level: string) => {
    return level.replace('_', ' ');
  };

  const formatType = (type: string) => {
    return type.replace('_', ' ');
  };

  // Show error if no organizationId (after trying to load user data)
  if (!organizationId && !loadingUser) {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
        <AppHeader title="Job Positions" onLogout={handleLogout} />
        <main className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg">
            <p className="font-semibold">Unable to load organization data</p>
            <p className="text-sm mt-1">Please ensure you are logged in with an employee account that has an associated organization.</p>
            {user?.role === 'ORG_ADMIN' && (
              <p className="text-sm mt-2 font-medium">Note: If you are an Organization Admin, please contact HRMS Administrator to ensure your employee profile is properly set up.</p>
            )}
          </div>
        </main>
      </div>
    );
  }

  if (loadingUser) {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
        <AppHeader title="Job Positions" onLogout={handleLogout} />
        <main className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading user data...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader
        title="Job Positions"
        subtitle={organizationName ? `Organization: ${organizationName}` : undefined}
        onLogout={handleLogout}
      />

      {/* Main Content */}
      <main className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Title */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900">Manage job positions across your organization</h2>
        </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Search */}
          <div className="lg:col-span-2">
            <input
              type="text"
              placeholder="Search positions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-10 px-4 py-2 bg-white text-black border border-black rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Level Filter */}
          <div>
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="w-full h-10 px-4 py-2 bg-white text-black border border-black rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="ALL">All Levels</option>
              <option value="C_LEVEL">C-Level</option>
              <option value="VP">VP</option>
              <option value="DIRECTOR">Director</option>
              <option value="MANAGER">Manager</option>
              <option value="LEAD">Lead</option>
              <option value="SENIOR">Senior</option>
              <option value="JUNIOR">Junior</option>
              <option value="ENTRY">Entry</option>
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full h-10 px-4 py-2 bg-white text-black border border-black rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="ALL">All Types</option>
              <option value="FULL_TIME">Full Time</option>
              <option value="PART_TIME">Part Time</option>
              <option value="CONTRACT">Contract</option>
              <option value="INTERN">Intern</option>
            </select>
          </div>

          {/* Department Filter */}
          <div>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full h-10 px-4 py-2 bg-white text-black border border-black rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="ALL">All Departments</option>
              {departments.map(dept => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Create Button */}
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleCreate}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
          >
            + New Position
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          <p className="font-semibold">Error loading positions</p>
          <p className="text-sm mt-1">{error}</p>
          <button
            onClick={() => {
              if (organizationId) {
                const params: any = { organizationId, page: currentPage, limit: 20 };
                if (searchTerm) params.search = searchTerm;
                if (levelFilter !== 'ALL') params.level = levelFilter;
                if (typeFilter !== 'ALL') params.employmentType = typeFilter;
                if (departmentFilter !== 'ALL') params.departmentId = departmentFilter;
                fetchPositions(params);
              }
            }}
            className="mt-2 text-sm underline hover:no-underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading positions...</p>
        </div>
      )}

      {/* Positions Table */}
      {!loading && !error && (
        <>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Position
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Department
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Level
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Salary Range
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employees
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {positions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                      No positions found. Create your first position!
                    </td>
                  </tr>
                ) : (
                  positions.map((position) => (
                    <tr key={position.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{position.title}</div>
                          {position.description && (
                            <div className="text-sm text-gray-500 line-clamp-1">{position.description}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {position.code || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {position.department?.name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {position.level ? (
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getLevelBadgeColor(position.level)}`}>
                            {formatLevel(position.level)}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {position.employmentType ? (
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getTypeBadgeColor(position.employmentType)}`}>
                            {formatType(position.employmentType)}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {position.salaryRangeMin && position.salaryRangeMax
                          ? `$${position.salaryRangeMin.toLocaleString()} - $${position.salaryRangeMax.toLocaleString()}`
                          : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {position._count?.employees || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          position.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {position.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleEdit(position)}
                          className="text-blue-600 hover:text-blue-900 mr-4"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(position.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total positions)
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 border border-black rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={currentPage === pagination.totalPages}
                  className="px-4 py-2 border border-black rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Position Form Modal */}
      <Modal
        isOpen={showForm}
        onClose={handleFormCancel}
        title={editingPosition ? 'Edit Position' : 'Create Position'}
        size="2xl"
      >
        {organizationId && (
          <PositionForm
            position={editingPosition}
            organizationId={organizationId}
            onSuccess={handleFormSuccess}
            onCancel={handleFormCancel}
          />
        )}
      </Modal>
      </main>
    </div>
  );
}
