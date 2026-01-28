import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDepartmentStore } from '../store/departmentStore';
import { useAuthStore } from '../store/authStore';
import { Department } from '../services/department.service';
import Modal from '../components/common/Modal';
import DepartmentForm from '../components/departments/DepartmentForm';
import AppHeader from '../components/layout/AppHeader';

export default function DepartmentsPage() {
  const navigate = useNavigate();
  const { user, loadUser, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;
  const { departments, loading, error, fetchDepartments, deleteDepartment } = useDepartmentStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [loadingUser, setLoadingUser] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'code' | 'createdAt'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Get organizationId from logged-in user (check both possible shapes)
  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id;

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
      fetchDepartments(organizationId, { listView: true, sortBy, sortOrder });
    }
  }, [organizationId, sortBy, sortOrder, fetchDepartments]);

  const filteredDepartments = departments.filter((dept) =>
    dept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dept.code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedDepartments = [...filteredDepartments].sort((a, b) => {
    let aVal: string | number = '';
    let bVal: string | number = '';

    if (sortBy === 'name') {
      aVal = a.name || '';
      bVal = b.name || '';
    } else if (sortBy === 'code') {
      aVal = a.code || '';
      bVal = b.code || '';
    } else {
      aVal = new Date(a.createdAt).getTime();
      bVal = new Date(b.createdAt).getTime();
    }

    let comparison = 0;
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      comparison = aVal - bVal;
    } else {
      comparison = String(aVal).localeCompare(String(bVal));
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this department?')) {
      try {
        await deleteDepartment(id);
        alert('Department deleted successfully');
      } catch (error: any) {
        alert(error.message || 'Failed to delete department');
      }
    }
  };

  const handleEdit = (dept: Department) => {
    setEditingDepartment(dept);
    setShowForm(true);
  };

  const handleCreate = () => {
    setEditingDepartment(null);
    setShowForm(true);
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingDepartment(null);
    if (organizationId) {
      fetchDepartments(organizationId, { listView: true, sortBy, sortOrder });
    }
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingDepartment(null);
  };

  const handleExportExcel = () => {
    if (!departments || departments.length === 0) {
      alert('No departments to export.');
      return;
    }

    const headers = ['Department Name', 'Dept Code', 'Manager', 'No of Employees', 'Status'];

    const rows = departments.map((dept) => [
      dept.name,
      dept.code || '',
      dept.manager ? `${dept.manager.firstName} ${dept.manager.lastName}` : '',
      String(dept._count?.employees || 0),
      dept.isActive ? 'Active' : 'Inactive',
    ]);

    const csvContent = [headers, ...rows]
      .map((row) =>
        row
          .map((value) => {
            const safe = String(value ?? '').replace(/"/g, '""');
            return `"${safe}"`;
          })
          .join(',')
      )
      .join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `departments_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    if (!departments || departments.length === 0) {
      alert('No departments to export.');
      return;
    }

    const rowsHtml = departments
      .map((dept) => {
        const name = dept.name;
        const code = dept.code || '';
        const manager = dept.manager ? `${dept.manager.firstName} ${dept.manager.lastName}` : '';
        const employees = String(dept._count?.employees || 0);
        const status = dept.isActive ? 'Active' : 'Inactive';

        return `<tr>
          <td>${name}</td>
          <td>${code}</td>
          <td>${manager}</td>
          <td>${employees}</td>
          <td>${status}</td>
        </tr>`;
      })
      .join('');

    const html = `
      <html>
        <head>
          <title>Department Export</title>
          <style>
            body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 16px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; }
            th { background: #f3f4f6; text-align: left; }
          </style>
        </head>
        <body>
          <h2>Department List</h2>
          <table>
            <thead>
              <tr>
                <th>Department Name</th>
                <th>Dept Code</th>
                <th>Manager</th>
                <th>No of Employees</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <script>
            window.onload = function () {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  const toggleSort = (field: 'name' | 'code' | 'createdAt') => {
    setSortBy((current) => {
      if (current === field) {
        setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
        return current;
      }
      setSortOrder('asc');
      return field;
    });
  };

  const getSortIcon = (field: 'name' | 'code' | 'createdAt') => {
    if (sortBy !== field) return '↕';
    return sortOrder === 'asc' ? '↑' : '↓';
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Show error if no organizationId (after trying to load user data)
  if (!organizationId && !loadingUser) {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
        <AppHeader title="Departments" onLogout={handleLogout} />
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

  // Show loading while fetching user data
  if (loadingUser) {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
        <AppHeader title="Departments" onLogout={handleLogout} />
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
        title="Departments"
        subtitle={organizationName ? `Organization: ${organizationName}` : undefined}
        onLogout={handleLogout}
      />

      {/* Main Content */}
      <main className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Header row: Title + Breadcrumb */}
        <div className="flex flex-nowrap items-center justify-between gap-3 mb-6 min-w-0">
          <div className="flex items-center gap-4 flex-nowrap min-w-0">
            <h1 className="text-2xl font-bold text-blue-900 whitespace-nowrap">Departments</h1>
            <nav className="flex items-center gap-1.5 text-sm text-gray-500 whitespace-nowrap" aria-label="Breadcrumb">
              <Link to="/dashboard" className="hover:text-gray-700 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </Link>
              <span>/</span>
              <span className="text-gray-700 font-medium">Employee</span>
              <span>/</span>
              <span className="text-gray-700 font-medium">Departments</span>
            </nav>
          </div>
        </div>

        {/* Actions Bar */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Search */}
            <div className="flex-1 max-w-md">
            <input
              type="text"
              placeholder="Search departments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-10 px-4 py-2 bg-white text-black border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

            {/* Export & Create Button */}
            <div className="flex items-center gap-3">
              <div className="relative">
              <button
                onClick={() => setShowExportMenu((open) => !open)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center gap-2 bg-white text-black"
              >
                <span>Export</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1">
                  <button
                    onClick={() => {
                      setShowExportMenu(false);
                      handleExportPdf();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
                  >
                    <span className="inline-flex w-4 h-4 items-center justify-center">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 2h9l5 5v13a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2z" />
                      </svg>
                    </span>
                    <span>Export as PDF</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowExportMenu(false);
                      handleExportExcel();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
                  >
                    <span className="inline-flex w-4 h-4 items-center justify-center">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h16v16H4z" />
                      </svg>
                    </span>
                    <span>Export as Excel</span>
                  </button>
                </div>
              )}
              </div>

              <button
                onClick={handleCreate}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
              >
                + New Department
              </button>
            </div>
          </div>
        </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          <p className="font-semibold">Error loading departments</p>
          <p className="text-sm mt-1">{error}</p>
          <button
            onClick={() => organizationId && fetchDepartments(organizationId, { listView: true, sortBy, sortOrder })}
            className="mt-2 text-sm underline hover:no-underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Loading State - skeleton table for faster perceived load */}
      {loading && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-[#e5e7eb]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Department Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Dept Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Parent Department</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Manager</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">No of Employees</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {[1, 2, 3, 4, 5].map((i) => (
                <tr key={i}>
                  <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-32 animate-pulse" /></td>
                  <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-16 animate-pulse" /></td>
                  <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-24 animate-pulse" /></td>
                  <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-24 animate-pulse" /></td>
                  <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-8 animate-pulse" /></td>
                  <td className="px-6 py-4"><div className="h-5 bg-gray-200 rounded-full w-14 animate-pulse" /></td>
                  <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-20 animate-pulse" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Content */}
      {!loading && !error && (
        <>
          <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-[#e5e7eb]">
                  <tr>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer"
                      onClick={() => toggleSort('name')}
                    >
                      <span className="inline-flex items-center gap-1">
                        Department Name
                        <span className="text-gray-500 text-[10px]">{getSortIcon('name')}</span>
                      </span>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer"
                      onClick={() => toggleSort('code')}
                    >
                      <span className="inline-flex items-center gap-1">
                        Dept Code
                        <span className="text-gray-500 text-[10px]">{getSortIcon('code')}</span>
                      </span>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Parent Department
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Manager
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      No of Employees
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedDepartments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                        {searchTerm ? 'No departments found matching your search' : 'No departments yet. Create your first department!'}
                      </td>
                    </tr>
                  ) : (
                    sortedDepartments.map((dept) => (
                      <tr key={dept.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-left">
                          {dept.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-left">
                          <span className="text-sm text-gray-900">{dept.code || '-'}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-left">
                          {dept.parentDepartment?.name || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-left">
                          {dept.manager ? (
                            <div className="text-sm">
                              <div className="text-gray-900">{dept.manager.firstName} {dept.manager.lastName}</div>
                              <div className="text-gray-500">{dept.manager.email}</div>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">Not assigned</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-left">
                          {dept._count?.employees || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-left">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            dept.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {dept.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-left">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => handleEdit(dept)}
                              className="text-blue-600 hover:text-blue-900"
                              title="Edit"
                            >
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDelete(dept.id)}
                              className="text-red-600 hover:text-red-900"
                              title="Delete"
                            >
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
        </>
      )}

      {/* Department Form Modal */}
      <Modal
        isOpen={showForm}
        onClose={handleFormCancel}
        title={editingDepartment ? 'Edit Department' : 'Create Department'}
        size="2xl"
      >
        <DepartmentForm
          department={editingDepartment}
          organizationId={organizationId}
          onSuccess={handleFormSuccess}
          onCancel={handleFormCancel}
        />
      </Modal>
      </main>
    </div>
  );
}
