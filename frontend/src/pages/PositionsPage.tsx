import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { usePositionStore } from '../store/positionStore';
import { useDepartmentStore } from '../store/departmentStore';
import { useAuthStore } from '../store/authStore';
import { Position } from '../services/position.service';
import Modal from '../components/common/Modal';
import PositionForm from '../components/positions/PositionForm';
import AppHeader from '../components/layout/AppHeader';
import { getModulePermissions } from '../config/configurator-module-mapping';

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
  const [sortBy, setSortBy] = useState<'title' | 'code' | 'createdAt'>('title');
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
      fetchDepartments(organizationId);
    }
  }, [organizationId, fetchDepartments]);

  useEffect(() => {
    if (!organizationId) return; // Don't fetch if organizationId is not available
    
    const params: any = {
      organizationId,
      page: currentPage,
      limit: 20,
      sortBy,
      sortOrder,
    };
    if (searchTerm) params.search = searchTerm;
    if (levelFilter !== 'ALL') params.level = levelFilter;
    if (typeFilter !== 'ALL') params.employmentType = typeFilter;
    if (departmentFilter !== 'ALL') params.departmentId = departmentFilter;

    fetchPositions(params);
  }, [organizationId, currentPage, searchTerm, levelFilter, typeFilter, departmentFilter, sortBy, sortOrder, fetchPositions]);

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
      sortBy,
      sortOrder,
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

  const handleExportExcel = () => {
    if (!positions || positions.length === 0) {
      alert('No positions to export.');
      return;
    }

    const headers = ['Position', 'Code', 'Department', 'Level', 'Type', 'Salary Range', 'Employees', 'Status'];

    const rows = positions.map((position) => [
      position.title,
      position.code || '',
      position.department?.name || '',
      position.level ? formatLevel(position.level) : '',
      position.employmentType ? formatType(position.employmentType) : '',
      position.salaryRangeMin && position.salaryRangeMax
        ? `${position.salaryRangeMin.toLocaleString()} - ${position.salaryRangeMax.toLocaleString()}`
        : '',
      String(position._count?.employees || 0),
      position.isActive ? 'Active' : 'Inactive',
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
    link.setAttribute('download', `positions_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    if (!positions || positions.length === 0) {
      alert('No positions to export.');
      return;
    }

    const rowsHtml = positions
      .map((position) => {
        const title = position.title;
        const code = position.code || '';
        const department = position.department?.name || '';
        const level = position.level ? formatLevel(position.level) : '';
        const type = position.employmentType ? formatType(position.employmentType) : '';
        const salary =
          position.salaryRangeMin && position.salaryRangeMax
            ? `${position.salaryRangeMin.toLocaleString()} - ${position.salaryRangeMax.toLocaleString()}`
            : '';
        const employees = String(position._count?.employees || 0);
        const status = position.isActive ? 'Active' : 'Inactive';

        return `<tr>
          <td>${title}</td>
          <td>${code}</td>
          <td>${department}</td>
          <td>${level}</td>
          <td>${type}</td>
          <td>${salary}</td>
          <td>${employees}</td>
          <td>${status}</td>
        </tr>`;
      })
      .join('');

    const html = `
      <html>
        <head>
          <title>Position Export</title>
          <style>
            body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 16px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; }
            th { background: #f3f4f6; text-align: left; }
          </style>
        </head>
        <body>
          <h2>Position List</h2>
          <table>
            <thead>
              <tr>
                <th>Position</th>
                <th>Code</th>
                <th>Department</th>
                <th>Level</th>
                <th>Type</th>
                <th>Salary Range</th>
                <th>Employees</th>
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

  const toggleSort = (field: 'title' | 'code' | 'createdAt') => {
    setSortBy((current) => {
      if (current === field) {
        setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
        return current;
      }
      setSortOrder('asc');
      return field;
    });
  };

  const getSortIcon = (field: 'title' | 'code' | 'createdAt') => {
    if (sortBy !== field) return '↕';
    return sortOrder === 'asc' ? '↑' : '↓';
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const modulePerms = getModulePermissions('/positions');
  const canAdd = modulePerms.can_add;
  const canEdit = modulePerms.can_edit;
  const canDelete = modulePerms.can_delete;

  // Client-side sorted positions (for reliable UI sort)
  const sortedPositions = [...positions].sort((a, b) => {
    let aVal: string | number = '';
    let bVal: string | number = '';

    if (sortBy === 'title') {
      aVal = a.title || '';
      bVal = b.title || '';
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
        {/* Header row: Title + Breadcrumb + Export + New Position */}
        <div className="flex flex-nowrap items-center justify-between gap-3 mb-6 min-w-0">
          <div className="flex items-center gap-4 flex-nowrap min-w-0">
            <h1 className="text-2xl font-bold text-blue-900 whitespace-nowrap">Positions</h1>
            <nav className="flex items-center gap-1.5 text-sm text-gray-500 whitespace-nowrap" aria-label="Breadcrumb">
              <Link to="/dashboard" className="hover:text-gray-700 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </Link>
              <span>/</span>
              <span className="text-gray-700 font-medium">Employee</span>
              <span>/</span>
              <span className="text-gray-700 font-medium">Positions</span>
            </nav>
          </div>
          <div className="flex items-center gap-3 shrink-0">
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
            {canAdd && (
              <button
                onClick={handleCreate}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
              >
                + New Position
              </button>
            )}
          </div>
        </div>

        {/* Filters Bar (below header) */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div>
              <label className="block text-xs text-gray-600 mb-1">Search</label>
              <input
                type="text"
                placeholder="Search positions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-9 px-3 py-1 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
              />
            </div>

            {/* Level Filter */}
            <div>
              <label className="block text-xs text-gray-600 mb-1">Level</label>
              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                className="w-full h-9 px-3 py-1 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
              >
                <option value="ALL" className="text-black">All Levels</option>
                <option value="C_LEVEL" className="text-black">C-Level</option>
                <option value="VP" className="text-black">VP</option>
                <option value="DIRECTOR" className="text-black">Director</option>
                <option value="MANAGER" className="text-black">Manager</option>
                <option value="LEAD" className="text-black">Lead</option>
                <option value="SENIOR" className="text-black">Senior</option>
                <option value="JUNIOR" className="text-black">Junior</option>
                <option value="ENTRY" className="text-black">Entry</option>
              </select>
            </div>

            {/* Type Filter */}
            <div>
              <label className="block text-xs text-gray-600 mb-1">Type</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full h-9 px-3 py-1 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
              >
                <option value="ALL" className="text-black">All Types</option>
                <option value="FULL_TIME" className="text-black">Full Time</option>
                <option value="PART_TIME" className="text-black">Part Time</option>
                <option value="CONTRACT" className="text-black">Contract</option>
                <option value="INTERN" className="text-black">Intern</option>
              </select>
            </div>

            {/* Department Filter */}
            <div>
              <label className="block text-xs text-gray-600 mb-1">Department</label>
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="w-full h-9 px-3 py-1 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
              >
                <option value="ALL" className="text-black">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id} className="text-black">
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>
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
              <thead className="bg-[#e5e7eb]">
                <tr>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer"
                    onClick={() => toggleSort('title')}
                  >
                    <span className="inline-flex items-center gap-1">
                      Position
                      <span className="text-gray-500 text-[10px]">{getSortIcon('title')}</span>
                    </span>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer"
                    onClick={() => toggleSort('code')}
                  >
                    <span className="inline-flex items-center gap-1">
                      Code
                      <span className="text-gray-500 text-[10px]">{getSortIcon('code')}</span>
                    </span>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Department
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Level
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Salary Range
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Employees
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
                {sortedPositions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                      No positions found. Create your first position!
                    </td>
                  </tr>
                ) : (
                  sortedPositions.map((position) => (
                    <tr key={position.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-left">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{position.title}</div>
                          {position.description && (
                            <div className="text-sm text-gray-500 line-clamp-1">{position.description}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-left">
                        {position.code || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-left">
                        {position.department?.name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-left">
                        {position.level ? (
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getLevelBadgeColor(position.level)}`}>
                            {formatLevel(position.level)}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-left">
                        {position.employmentType ? (
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getTypeBadgeColor(position.employmentType)}`}>
                            {formatType(position.employmentType)}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-left">
                        {position.salaryRangeMin && position.salaryRangeMax
                          ? `$${position.salaryRangeMin.toLocaleString()} - $${position.salaryRangeMax.toLocaleString()}`
                          : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-left">
                        {position._count?.employees || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-left">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          position.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {position.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-left">
                        <div className="flex items-center gap-3">
                          {canEdit && (
                            <button
                              onClick={() => handleEdit(position)}
                              className="text-blue-600 hover:text-blue-900"
                              title="Edit"
                            >
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleDelete(position.id)}
                              className="text-red-600 hover:text-red-900"
                              title="Delete"
                            >
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
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
