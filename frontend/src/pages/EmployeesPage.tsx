import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useEmployeeStore } from '../store/employeeStore';
import { useAuthStore } from '../store/authStore';
import { Employee } from '../services/employee.service';
import employeeService from '../services/employee.service';
import positionService from '../services/position.service';
import api from '../services/api';
import Modal from '../components/common/Modal';
import EmployeeForm from '../components/employees/EmployeeForm';
import PaygroupSelectionModal from '../components/employees/PaygroupSelectionModal';
import AppHeader from '../components/layout/AppHeader';
import { canCreateEmployee, canUpdateEmployee, canDeleteEmployee } from '../utils/rbac';

export default function EmployeesPage() {
  const navigate = useNavigate();
  const { user, loadUser, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;
  const { employees, pagination, loading, error, fetchEmployees, deleteEmployee } = useEmployeeStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [departmentFilter, _setDepartmentFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [showPaygroupModal, setShowPaygroupModal] = useState(false);
  const [selectedPaygroupId, setSelectedPaygroupId] = useState<string | null>(null);
  const [selectedPaygroupName, setSelectedPaygroupName] = useState<string | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [loadingUser, setLoadingUser] = useState(false);
  const [loadUserAttempted, setLoadUserAttempted] = useState(false);
  const [showCredentials, setShowCredentials] = useState(false);
  const [credentials, setCredentials] = useState<any[]>([]);
  const [loadingCredentials, setLoadingCredentials] = useState(false);
  const [resettingPassword, setResettingPassword] = useState<string | null>(null);
  const [resetPasswordModal, setResetPasswordModal] = useState<{ employeeId: string; email: string; name: string } | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState<string | null>(null);
  const [changingRole, setChangingRole] = useState<string | null>(null);
  const [roleChangeModal, setRoleChangeModal] = useState<{ employeeId: string; email: string; name: string; currentRole: string } | null>(null);
  const [employeeStats, setEmployeeStats] = useState({ total: 0, active: 0, inactive: 0, newJoiners: 0 });
  const [sortBy, setSortBy] = useState<string>('LAST_7_DAYS');
  const [designationFilter, setDesignationFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [sortByField, setSortByField] = useState<'employeeCode' | 'firstName' | 'lastName' | 'dateOfJoining' | 'createdAt'>('dateOfJoining');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [pageSize, setPageSize] = useState(20);
  const [positions, setPositions] = useState<Array<{ id: string; title: string }>>([]);
  const [loadingPositions, setLoadingPositions] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Get organizationId from logged-in user (check both possible shapes)
  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id;

  // Try to load user data if organizationId is missing (only once)
  useEffect(() => {
    if (!organizationId && user && !loadingUser && !loadUserAttempted) {
      setLoadingUser(true);
      setLoadUserAttempted(true);
      
      // Add timeout to prevent infinite loading
      const timeoutId = setTimeout(() => {
        setLoadingUser(false);
        console.error('Load user timeout - taking too long');
      }, 10000); // 10 second timeout

      loadUser()
        .catch((error) => {
          console.error('Failed to load user:', error);
        })
        .finally(() => {
          clearTimeout(timeoutId);
          setLoadingUser(false);
        });
    }
  }, [organizationId, user, loadUser]);

  // RBAC permissions (optimized - computed once)
  const canCreate = canCreateEmployee(user?.role);
  const canUpdate = canUpdateEmployee(user?.role);
  const canDelete = canDeleteEmployee(user?.role);
  const canManageCredentials = user?.role === 'ORG_ADMIN' || user?.role === 'HR_MANAGER';

  // Fetch employee statistics
  useEffect(() => {
    if (!organizationId) return;
    const fetchStats = async () => {
      try {
        const stats = await employeeService.getStatistics(organizationId);
        const byStatus = stats.employeesByStatus || [];

        // Calculate active and inactive counts from employeesByStatus
        const activeCount =
          byStatus.reduce((sum: number, s: any) => {
            return s.employeeStatus === 'ACTIVE' ? sum + (s._count || 0) : sum;
          }, 0) || 0;

        const inactiveCount =
          byStatus.reduce((sum: number, s: any) => {
            return s.employeeStatus !== 'ACTIVE' ? sum + (s._count || 0) : sum;
          }, 0) || 0;

        const totalFromStatus =
          byStatus.reduce((sum: number, s: any) => sum + (s._count || 0), 0) || 0;

        setEmployeeStats({
          total: stats.totalEmployees || totalFromStatus,
          active: stats.activeEmployees || activeCount,
          inactive: inactiveCount,
          newJoiners: stats.recentHires || 0,
        });
      } catch (error) {
        console.error('Failed to fetch employee statistics:', error);
      }
    };
    fetchStats();
  }, [organizationId]);

  // Load positions for designation dropdown
  useEffect(() => {
    if (!organizationId) return;
    const loadPositions = async () => {
      setLoadingPositions(true);
      try {
        const res = await positionService.getAll({ organizationId, page: 1, limit: 500 });
        setPositions(res.positions || []);
      } catch (e) {
        console.error('Failed to load positions:', e);
      } finally {
        setLoadingPositions(false);
      }
    };
    loadPositions();
  }, [organizationId]);

  // Defer department fetch until form is opened (EmployeeForm fetches on mount when modal opens)
  useEffect(() => {
    if (!organizationId) return;
    const params: any = {
      organizationId,
      page: currentPage,
      limit: pageSize,
      listView: true,
      sortBy: sortByField,
      sortOrder,
    };
    if (searchTerm) params.search = searchTerm;
    if (statusFilter !== 'ALL') params.employeeStatus = statusFilter;
    if (departmentFilter !== 'ALL') params.departmentId = departmentFilter;
    if (designationFilter !== 'ALL') params.positionId = designationFilter;
    fetchEmployees(params);
  }, [organizationId, currentPage, pageSize, searchTerm, statusFilter, departmentFilter, designationFilter, sortByField, sortOrder, fetchEmployees]);

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this employee? This will also deactivate their user account.')) {
      try {
        await deleteEmployee(id);
        alert('Employee deleted successfully');
      } catch (error: any) {
        alert(error.message || 'Failed to delete employee');
      }
    }
  };

  const handleCreate = () => {
    setEditingEmployee(null);
    setSelectedPaygroupId(null);
    setSelectedPaygroupName(null);
    setShowPaygroupModal(true);
  };

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setShowForm(true);
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingEmployee(null);
    const params: any = {
      organizationId,
      page: currentPage,
      limit: pageSize,
      listView: true,
      sortBy: sortByField,
      sortOrder,
    };
    if (searchTerm) params.search = searchTerm;
    if (statusFilter !== 'ALL') params.employeeStatus = statusFilter;
    if (departmentFilter !== 'ALL') params.departmentId = departmentFilter;
    if (designationFilter !== 'ALL') params.positionId = designationFilter;
    fetchEmployees(params);
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingEmployee(null);
    setSelectedPaygroupId(null);
    setSelectedPaygroupName(null);
  };

  const handlePaygroupSubmit = (paygroupId: string, paygroupName: string) => {
    setSelectedPaygroupId(paygroupId);
    setSelectedPaygroupName(paygroupName);
    setShowPaygroupModal(false);
    setShowForm(true);
  };

  // Export current employees list as CSV (Excel-compatible)
  const handleExportExcel = () => {
    if (!employees || employees.length === 0) {
      alert('No employees to export.');
      return;
    }

    const headers = ['Emp ID', 'Name', 'Email', 'Phone', 'Designation', 'Joining Date', 'Status'];

    const formatDate = (dateString?: string | null) => {
      if (!dateString) return '';
      const date = new Date(dateString);
      if (Number.isNaN(date.getTime())) return '';
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    };

    const rows = employees.map((emp) => [
      emp.employeeCode || '',
      `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
      emp.email || '',
      emp.phone || '',
      emp.position?.title || '',
      formatDate((emp as any).dateOfJoining),
      (emp as any).employeeStatus || '',
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
    link.setAttribute('download', `employees_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Basic PDF export: open a printable view and let browser "Save as PDF"
  const handleExportPdf = () => {
    if (!employees || employees.length === 0) {
      alert('No employees to export.');
      return;
    }

    const formatDate = (dateString?: string | null) => {
      if (!dateString) return '';
      const date = new Date(dateString);
      if (Number.isNaN(date.getTime())) return '';
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    };

    const rowsHtml = employees
      .map((emp) => {
        const code = emp.employeeCode || '';
        const name = `${emp.firstName || ''} ${emp.lastName || ''}`.trim();
        const email = emp.email || '';
        const phone = emp.phone || '';
        const designation = emp.position?.title || '';
        const joiningDate = formatDate((emp as any).dateOfJoining);
        const status = (emp as any).employeeStatus || '';

        return `<tr>
          <td>${code}</td>
          <td>${name}</td>
          <td>${email}</td>
          <td>${phone}</td>
          <td>${designation}</td>
          <td>${joiningDate}</td>
          <td>${status}</td>
        </tr>`;
      })
      .join('');

    const html = `
      <html>
        <head>
          <title>Employee Export</title>
          <style>
            body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 16px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; }
            th { background: #f3f4f6; text-align: left; }
          </style>
        </head>
        <body>
          <h2>Employee List</h2>
          <table>
            <thead>
              <tr>
                <th>Emp ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Designation</th>
                <th>Joining Date</th>
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

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800';
      case 'ON_LEAVE':
        return 'bg-yellow-100 text-yellow-800';
      case 'SUSPENDED':
        return 'bg-orange-100 text-orange-800';
      case 'TERMINATED':
      case 'RESIGNED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Generate avatar color based on employee name
  const getAvatarColor = (name: string): { borderColor: string; gradientFrom: string; gradientTo: string } => {
    const colors = [
      { borderColor: '#a855f7', gradientFrom: '#a855f7', gradientTo: '#9333ea' }, // purple
      { borderColor: '#60a5fa', gradientFrom: '#60a5fa', gradientTo: '#3b82f6' }, // blue
      { borderColor: '#f97316', gradientFrom: '#f97316', gradientTo: '#ea580c' }, // orange
      { borderColor: '#16a34a', gradientFrom: '#16a34a', gradientTo: '#15803d' }, // green
      { borderColor: '#ef4444', gradientFrom: '#ef4444', gradientTo: '#dc2626' }, // red
      { borderColor: '#ec4899', gradientFrom: '#ec4899', gradientTo: '#db2777' }, // pink
      { borderColor: '#6366f1', gradientFrom: '#6366f1', gradientTo: '#4f46e5' }, // indigo
      { borderColor: '#14b8a6', gradientFrom: '#14b8a6', gradientTo: '#0d9488' }, // teal
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  // Handle employee card click - navigate to employee details
  const handleEmployeeClick = (employee: Employee) => {
    handleEdit(employee);
  };

  // Show error if no organizationId (after trying to load user data)
  if (!organizationId && !loadingUser) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg">
          <p className="font-semibold">Unable to load organization data</p>
          <p className="text-sm mt-1">Please ensure you are logged in with an employee account that has an associated organization.</p>
          {canManageCredentials && (
            <p className="text-sm mt-2 font-medium">Note: If you are an Organization Admin, please contact HRMS Administrator to ensure your employee profile is properly set up.</p>
          )}
          <button
            onClick={() => {
              setLoadUserAttempted(false);
              setLoadingUser(true);
              loadUser()
                .catch((error) => {
                  console.error('Failed to load user:', error);
                  alert('Failed to load user data: ' + (error.response?.data?.message || error.message));
                })
                .finally(() => {
                  setLoadingUser(false);
                });
            }}
            className="mt-3 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition text-sm"
          >
            Retry Loading User Data
          </button>
        </div>
      </div>
    );
  }

  if (loadingUser) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading user data...</p>
        </div>
      </div>
    );
  }

  const isOrgAdmin = user?.role === 'ORG_ADMIN';

  // Fetch credentials when ORG_ADMIN or HR_MANAGER opens credentials view
  useEffect(() => {
    if (showCredentials && canManageCredentials && credentials.length === 0 && !loadingCredentials) {
      fetchCredentials();
    }
  }, [showCredentials, canManageCredentials]);

  const fetchCredentials = async () => {
    try {
      setLoadingCredentials(true);
      const data = await employeeService.getCredentials();
      setCredentials(data);
    } catch (error: any) {
      console.error('Failed to fetch credentials:', error);
      alert(error.response?.data?.message || 'Failed to fetch employee credentials');
    } finally {
      setLoadingCredentials(false);
    }
  };

  const handleChangeRole = async (employeeId: string, newRole: string) => {
    if (!roleChangeModal) return;

    try {
      setChangingRole(employeeId);
      
      // The employeeId from credentials is the employee record ID
      // Update employee with role
      await employeeService.update(employeeId, { role: newRole as any });

      alert(`Role updated successfully to ${newRole}`);
      setRoleChangeModal(null);
      
      // Refresh credentials to show updated role
      await fetchCredentials();
    } catch (error: any) {
      console.error('Failed to change role:', error);
      alert(error.response?.data?.message || 'Failed to change role');
    } finally {
      setChangingRole(null);
    }
  };

  const handleResetPassword = async () => {
    if (!resetPasswordModal || !newPassword || newPassword.length < 8) {
      alert('Password must be at least 8 characters');
      return;
    }

    try {
      setResettingPassword(resetPasswordModal.employeeId);
      const response = await api.post(`/auth/admin/reset-password/${resetPasswordModal.employeeId}`, {
        newPassword,
      });
      
      setShowNewPassword(newPassword);
      setNewPassword('');
      // Refresh credentials after reset to show new password in table
      await fetchCredentials();
      // Keep password visible for 30 seconds, then clear
      setTimeout(() => {
        setShowNewPassword(null);
        setResetPasswordModal(null);
      }, 30000);
    } catch (error: any) {
      console.error('Failed to reset password:', error);
      alert(error.response?.data?.message || 'Failed to reset password');
    } finally {
      setResettingPassword(null);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader
        title="Employee Directory"
        subtitle={organizationName ? `Organization: ${organizationName}` : undefined}
        onLogout={handleLogout}
      />

      {/* Main Content */}
      <main className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Single row: Title, Breadcrumb (with home icon), List/Grid toggle, Export, View Credentials, Add Employee */}
        <div className="flex flex-nowrap items-center justify-between gap-3 mb-6 min-w-0">
          <div className="flex items-center gap-4 flex-nowrap min-w-0">
            <h1 className="text-2xl font-bold text-blue-900 whitespace-nowrap">Employee</h1>
            <nav className="flex items-center gap-1.5 text-sm text-gray-500 whitespace-nowrap" aria-label="Breadcrumb">
              <Link to="/dashboard" className="hover:text-gray-700 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </Link>
              <span>/</span>
              <Link to="/dashboard" className="hover:text-gray-700">Employee</Link>
              <span>/</span>
              <span className="text-gray-700 font-medium">
                {showCredentials ? 'Employee Credentials' : 'Employee List'}
              </span>
            </nav>
          </div>
          <div className="flex items-center gap-2 flex-nowrap shrink-0">
            {/* Layout Toggle - List (orange when selected) */}
            <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 ${viewMode === 'list' ? 'bg-orange-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                title="List View"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 ${viewMode === 'grid' ? 'bg-orange-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                title="Grid View"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
            </div>
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
            {isOrgAdmin && (
              <button
                onClick={() => {
                  setShowCredentials(!showCredentials);
                  if (!showCredentials) fetchCredentials();
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-black hover:bg-gray-50 font-medium"
              >
                {showCredentials ? 'View Employees' : 'View Credentials'}
              </button>
            )}
            {canCreate && (
              <button
                onClick={handleCreate}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition font-medium flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Add Employee</span>
              </button>
            )}
          </div>
        </div>

      {/* Employee Credentials View (ORG_ADMIN only) */}
      {showCredentials && isOrgAdmin && (
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900">Employee Credentials</h2>
            <p className="text-gray-600 mt-1">View and manage employee login credentials</p>
          </div>

          {loadingCredentials ? (
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-600">Loading credentials...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Employee
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Department
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Password
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {credentials.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                        No employees found
                      </td>
                    </tr>
                  ) : (
                    credentials.map((cred) => {
                      const hasNewPassword = showNewPassword && resetPasswordModal?.employeeId === cred.id;
                      return (
                        <tr key={cred.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div>
                                <div className="text-sm font-medium text-gray-900">{cred.name}</div>
                                <div className="text-sm text-gray-500">{cred.employeeCode}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{cred.email}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                {cred.role}
                              </span>
                              {(user?.role === 'ORG_ADMIN' || user?.role === 'HR_MANAGER') && (
                                <button
                                  onClick={() => {
                                    setRoleChangeModal({
                                      employeeId: cred.id,
                                      email: cred.email,
                                      name: cred.name,
                                      currentRole: cred.role,
                                    });
                                  }}
                                  className="text-blue-600 hover:text-blue-900 text-xs"
                                  title="Change role"
                                >
                                  ✏️
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {cred.department}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                cred.employeeStatus === 'ACTIVE'
                                  ? 'bg-green-100 text-green-800'
                                  : cred.employeeStatus === 'ON_LEAVE'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {cred.employeeStatus}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {hasNewPassword ? (
                              <div className="flex items-center space-x-2">
                                <div className="flex-1 bg-green-50 border border-green-200 rounded px-2 py-1">
                                  <p className="text-xs font-mono font-bold text-green-800">{showNewPassword}</p>
                                </div>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(showNewPassword || '');
                                    alert('Password copied!');
                                  }}
                                  className="text-green-600 hover:text-green-700 text-xs"
                                  title="Copy password"
                                >
                                  📋
                                </button>
                              </div>
                            ) : (
                              <span className="text-sm text-gray-500">••••••••</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={() => {
                                setResetPasswordModal({
                                  employeeId: cred.id,
                                  email: cred.email,
                                  name: cred.name,
                                });
                                setNewPassword('');
                                setShowNewPassword(null);
                              }}
                              disabled={resettingPassword === cred.id}
                              className="text-blue-600 hover:text-blue-900 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {resettingPassword === cred.id ? 'Resetting...' : 'Reset Password'}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Reset Password Modal */}
      {resetPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Reset Password</h2>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                <strong>Employee:</strong> {resetPasswordModal.name}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Email:</strong> {resetPasswordModal.email}
              </p>
            </div>

            {showNewPassword ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <p className="text-sm font-medium text-green-800 mb-2">Password Reset Successfully!</p>
                <div className="flex items-center justify-between bg-white border border-green-300 rounded px-3 py-2">
                  <p className="text-sm font-mono text-gray-900 font-bold">{showNewPassword}</p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(showNewPassword);
                      alert('Password copied to clipboard!');
                    }}
                    className="ml-2 text-green-600 hover:text-green-700 text-sm font-medium"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-xs text-green-700 mt-2">
                  Please share this password with the employee. They should change it after first login.
                </p>
              </div>
            ) : (
              <div className="mb-4">
                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  id="newPassword"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min 8 characters)"
                  className="w-full h-10 px-4 py-2 bg-white text-black border border-black rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Password must be at least 8 characters
                </p>
              </div>
            )}

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setResetPasswordModal(null);
                  setNewPassword('');
                  setShowNewPassword(null);
                }}
                className="px-4 py-2 border border-black rounded-lg text-gray-700 hover:bg-gray-50 transition"
              >
                {showNewPassword ? 'Close' : 'Cancel'}
              </button>
              {!showNewPassword && (
                <button
                  onClick={handleResetPassword}
                  disabled={!newPassword || newPassword.length < 8 || resettingPassword === resetPasswordModal.employeeId}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resettingPassword === resetPasswordModal.employeeId ? 'Resetting...' : 'Reset Password'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Change Role Modal */}
      {roleChangeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Change User Role</h2>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                <strong>Employee:</strong> {roleChangeModal.name}
              </p>
              <p className="text-sm text-gray-600 mb-2">
                <strong>Email:</strong> {roleChangeModal.email}
              </p>
              <p className="text-sm text-gray-600 mb-4">
                <strong>Current Role:</strong> <span className="font-semibold">{roleChangeModal.currentRole}</span>
              </p>
            </div>

            <div className="mb-4">
              <label htmlFor="newRole" className="block text-sm font-medium text-gray-700 mb-2">
                Select New Role
              </label>
              <select
                id="newRole"
                defaultValue={roleChangeModal.currentRole}
                className="w-full h-10 px-4 py-2 bg-white text-black border border-black rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="EMPLOYEE">EMPLOYEE</option>
                <option value="MANAGER">MANAGER</option>
                <option value="HR_MANAGER">HR_MANAGER</option>
                <option value="ORG_ADMIN">ORG_ADMIN</option>
                <option value="SUPER_ADMIN">SUPER_ADMIN</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Note: Changing role will affect user permissions immediately
              </p>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setRoleChangeModal(null)}
                className="px-4 py-2 border border-black rounded-lg text-gray-700 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const select = document.getElementById('newRole') as HTMLSelectElement;
                  const newRole = select.value;
                  if (newRole === roleChangeModal.currentRole) {
                    alert('Please select a different role');
                    return;
                  }
                  if (confirm(`Change role from ${roleChangeModal.currentRole} to ${newRole}?`)) {
                    handleChangeRole(roleChangeModal.employeeId, newRole);
                  }
                }}
                disabled={changingRole === roleChangeModal.employeeId}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {changingRole === roleChangeModal.employeeId ? 'Changing...' : 'Change Role'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      {!showCredentials && (
        <div className="mb-6">
          {/* Filters Row */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Designation Filter */}
              <div>
                <label className="block text-xs text-gray-600 mb-1">Designation</label>
                <select
                  value={designationFilter}
                  onChange={(e) => setDesignationFilter(e.target.value)}
                  disabled={loadingPositions}
                  className="w-full h-9 px-3 py-1 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                >
                  <option value="ALL" className="text-black">All Designations</option>
                  {positions.map((p) => (
                    <option key={p.id} value={p.id} className="text-black">{p.title}</option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-xs text-gray-600 mb-1">Select Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full h-9 px-3 py-1 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                >
                  <option value="ALL" className="text-black">All Status</option>
                  <option value="ACTIVE" className="text-black">Active</option>
                  <option value="ON_LEAVE" className="text-black">On Leave</option>
                  <option value="SUSPENDED" className="text-black">Suspended</option>
                  <option value="TERMINATED" className="text-black">Terminated</option>
                  <option value="RESIGNED" className="text-black">Resigned</option>
                </select>
              </div>

              {/* Sort By */}
              <div>
                <label className="block text-xs text-gray-600 mb-1">Sort By</label>
                <select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value);
                    if (e.target.value === 'NAME_ASC') {
                      setSortByField('firstName');
                      setSortOrder('asc');
                    } else if (e.target.value === 'NAME_DESC') {
                      setSortByField('firstName');
                      setSortOrder('desc');
                    } else if (e.target.value === 'JOINING_DATE') {
                      setSortByField('dateOfJoining');
                      setSortOrder('desc');
                    } else {
                      setSortByField('dateOfJoining');
                      setSortOrder('desc');
                    }
                  }}
                  className="w-full h-9 px-3 py-1 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                >
                  <option value="LAST_7_DAYS" className="text-black">Last 7 Days</option>
                  <option value="LAST_30_DAYS" className="text-black">Last 30 Days</option>
                  <option value="NAME_ASC" className="text-black">Name (A-Z)</option>
                  <option value="NAME_DESC" className="text-black">Name (Z-A)</option>
                  <option value="JOINING_DATE" className="text-black">Joining Date</option>
                </select>
              </div>

              {/* Search */}
              <div>
                <label className="block text-xs text-gray-600 mb-1">Search</label>
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-9 px-3 py-1 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Statistics Cards */}
      {!showCredentials && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {/* Total Employee Card - Light grey background, icon near count */}
          <div className="rounded-xl shadow-md p-6 flex items-center gap-4" style={{ backgroundColor: '#f1f5f9' }}>
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gray-600 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm text-gray-600 mb-0.5">Total Employee</p>
              <p className="text-3xl font-bold text-blue-900">
                {pagination && typeof pagination.total === 'number' && pagination.total > 0
                  ? pagination.total
                  : employeeStats.total}
              </p>
            </div>
          </div>

          {/* Active Card - White background, icon near count */}
          <div className="bg-white rounded-xl shadow-md p-6 flex items-center gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-green-500 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm text-gray-600 mb-0.5">Active</p>
              <p className="text-3xl font-bold text-blue-900">{employeeStats.active}</p>
            </div>
          </div>

          {/* InActive Card - White background, icon near count */}
          <div className="bg-white rounded-xl shadow-md p-6 flex items-center gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-500 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm text-gray-600 mb-0.5">InActive</p>
              <p className="text-3xl font-bold text-blue-900">{employeeStats.inactive}</p>
            </div>
          </div>

          {/* New Joiners Card - White background, icon near count */}
          <div className="bg-white rounded-xl shadow-md p-6 flex items-center gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm text-gray-600 mb-0.5">New Joiners</p>
              <p className="text-3xl font-bold text-blue-900">{employeeStats.newJoiners}</p>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {!showCredentials && error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          <p className="font-semibold">Error loading employees</p>
          <p className="text-sm mt-1">{error}</p>
          <button
            onClick={() => {
              if (organizationId) {
                const params: any = { organizationId, page: currentPage, limit: pageSize, listView: true, sortBy: sortByField, sortOrder };
                if (searchTerm) params.search = searchTerm;
                if (statusFilter !== 'ALL') params.employeeStatus = statusFilter;
                if (departmentFilter !== 'ALL') params.departmentId = departmentFilter;
                if (designationFilter !== 'ALL') params.positionId = designationFilter;
                fetchEmployees(params);
              }
            }}
            className="mt-2 text-sm underline hover:no-underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Loading State - skeleton table for faster perceived load */}
      {!showCredentials && loading && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                <tr key={i}>
                  <td className="px-6 py-4"><div className="flex items-center gap-3"><div className="h-10 w-10 bg-gray-200 rounded-full animate-pulse" /><div className="h-4 bg-gray-200 rounded w-28 animate-pulse" /></div></td>
                  <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-16 animate-pulse" /></td>
                  <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-24 animate-pulse" /></td>
                  <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-20 animate-pulse" /></td>
                  <td className="px-6 py-4"><div className="h-5 bg-gray-200 rounded-full w-14 animate-pulse" /></td>
                  <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-20 animate-pulse" /></td>
                  <td className="px-6 py-4 text-right"><div className="h-4 bg-gray-200 rounded w-16 ml-auto animate-pulse" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Employee Grid/List View */}
      {!showCredentials && !loading && !error && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* Pagination Control - Row Per Page */}
          <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>Row Per Page</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                className="px-2 py-1 border border-gray-300 rounded text-sm bg-white text-black"
              >
                <option value={10} className="text-black">10 Entries</option>
                <option value={20} className="text-black">20 Entries</option>
                <option value={50} className="text-black">50 Entries</option>
                <option value={100} className="text-black">100 Entries</option>
              </select>
            </div>
          </div>

          {/* Grid View */}
          {viewMode === 'grid' ? (
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {employees.length === 0 ? (
                  <div className="col-span-full text-center py-12 text-gray-500">
                    {searchTerm || statusFilter !== 'ALL' || departmentFilter !== 'ALL'
                      ? 'No employees found matching your filters'
                      : 'No employees yet. Create your first employee!'}
                  </div>
                ) : (
                  employees.map((emp) => {
                    const avatarColor = getAvatarColor(emp.firstName + emp.lastName);
                    return (
                      <div
                        key={emp.id}
                        onClick={() => handleEmployeeClick(emp)}
                        className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer border border-gray-200 p-6 relative"
                      >
                        {/* Vertical Ellipsis Menu */}
                        <div className="absolute top-4 right-4">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(emp);
                            }}
                            className="p-1 text-gray-400 hover:text-gray-600"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                            </svg>
                          </button>
                        </div>

                        {/* Profile Image with Avatar Fallback */}
                        <div className="flex justify-center mb-4">
                          {emp.profilePictureUrl ? (
                            <div
                              className="h-24 w-24 rounded-full border-4 overflow-hidden"
                              style={{ borderColor: avatarColor.borderColor }}
                            >
                              <img
                                className="h-full w-full object-cover"
                                src={emp.profilePictureUrl}
                                alt={`${emp.firstName} ${emp.lastName}`}
                                onError={(e) => {
                                  // Fallback to avatar if image fails to load
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  const parent = target.parentElement;
                                  if (parent) {
                                    parent.innerHTML = `
                                      <div class="h-full w-full rounded-full flex items-center justify-center text-white text-2xl font-bold" style="background: linear-gradient(to bottom right, ${avatarColor.gradientFrom}, ${avatarColor.gradientTo});">
                                        ${emp.firstName[0]}${emp.lastName[0]}
                                      </div>
                                    `;
                                  }
                                }}
                              />
                            </div>
                          ) : (
                            <div
                              className="h-24 w-24 rounded-full border-4 flex items-center justify-center text-white text-2xl font-bold"
                              style={{
                                borderColor: avatarColor.borderColor,
                                background: `linear-gradient(to bottom right, ${avatarColor.gradientFrom}, ${avatarColor.gradientTo})`,
                              }}
                            >
                              {emp.firstName[0]}{emp.lastName[0]}
                            </div>
                          )}
                        </div>

                        {/* Employee Name */}
                        <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
                          {emp.firstName} {emp.lastName}
                        </h3>

                        {/* Designation Tag */}
                        <div className="flex justify-center mb-4">
                          <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                            emp.position?.title ? 'bg-pink-100 text-pink-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {emp.position?.title || 'No Designation'}
                          </span>
                        </div>

                        {/* Status Badge */}
                        <div className="flex justify-center mb-4">
                          <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeColor(emp.employeeStatus)}`}>
                            {emp.employeeStatus === 'ACTIVE' ? 'Active' : emp.employeeStatus.replace('_', ' ')}
                          </span>
                        </div>

                        {/* Employee Code */}
                        <div className="text-center text-sm text-gray-500">
                          {emp.employeeCode}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            /* List View - Table */
            <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => { setSortByField('employeeCode'); setSortOrder(sortByField === 'employeeCode' ? (sortOrder === 'asc' ? 'desc' : 'asc') : 'asc'); }}
                >
                  <div className="flex items-center gap-1">
                    Emp ID
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => { setSortByField('firstName'); setSortOrder(sortByField === 'firstName' ? (sortOrder === 'asc' ? 'desc' : 'asc') : 'asc'); }}
                >
                  <div className="flex items-center gap-1">
                    Name
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Designation</th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => { setSortByField('dateOfJoining'); setSortOrder(sortByField === 'dateOfJoining' ? (sortOrder === 'asc' ? 'desc' : 'asc') : 'desc'); }}
                >
                  <div className="flex items-center gap-1">
                    Joining Date
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                    {searchTerm || statusFilter !== 'ALL' || departmentFilter !== 'ALL'
                      ? 'No employees found matching your filters'
                      : 'No employees yet. Create your first employee!'}
                  </td>
                </tr>
              ) : (
                employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">{emp.employeeCode}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          {emp.profilePictureUrl ? (
                            <img
                              className="h-10 w-10 rounded-full"
                              src={emp.profilePictureUrl}
                              alt={`${emp.firstName} ${emp.lastName}`}
                              onError={(e) => {
                                // Fallback to avatar if image fails to load
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const parent = target.parentElement;
                                if (parent) {
                                  const avatarColor = getAvatarColor(emp.firstName + emp.lastName);
                                  parent.innerHTML = `
                                    <div class="h-10 w-10 rounded-full border-2 flex items-center justify-center text-white font-medium text-sm" style="border-color: ${avatarColor.borderColor}; background: linear-gradient(to bottom right, ${avatarColor.gradientFrom}, ${avatarColor.gradientTo});">
                                      ${emp.firstName[0]}${emp.lastName[0]}
                                    </div>
                                  `;
                                }
                              }}
                            />
                          ) : (
                            (() => {
                              const avatarColor = getAvatarColor(emp.firstName + emp.lastName);
                              return (
                                <div
                                  className="h-10 w-10 rounded-full border-2 flex items-center justify-center text-white font-medium text-sm"
                                  style={{
                                    borderColor: avatarColor.borderColor,
                                    background: `linear-gradient(to bottom right, ${avatarColor.gradientFrom}, ${avatarColor.gradientTo})`,
                                  }}
                                >
                                  {emp.firstName[0]}{emp.lastName[0]}
                                </div>
                              );
                            })()
                          )}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {emp.firstName} {emp.lastName}
                          </div>
                          <div className="text-xs text-gray-500">{emp.position?.title || 'N/A'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">{emp.email}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">{emp.phone || '-'}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">{emp.position?.title || '-'}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(emp.dateOfJoining).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeColor(emp.employeeStatus)}`}>
                        {emp.employeeStatus === 'ACTIVE' ? 'Active' : emp.employeeStatus.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-3">
                        {canUpdate && (
                          <button
                            onClick={() => handleEdit(emp)}
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
                            onClick={() => handleDelete(emp.id)}
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
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-4 py-2 border border-black text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={currentPage === pagination.totalPages}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-black text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing <span className="font-medium">{(currentPage - 1) * pagination.limit + 1}</span> to{' '}
                    <span className="font-medium">
                      {Math.min(currentPage * pagination.limit, pagination.total)}
                    </span> of{' '}
                    <span className="font-medium">{pagination.total}</span> results
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-black bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <span className="relative inline-flex items-center px-4 py-2 border border-black bg-white text-sm font-medium text-gray-700">
                      Page {currentPage} of {pagination.totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}
                      disabled={currentPage === pagination.totalPages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-black bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Paygroup Selection Modal (Create flow only) */}
      {organizationId && (
        <PaygroupSelectionModal
          isOpen={showPaygroupModal}
          onClose={() => setShowPaygroupModal(false)}
          organizationId={organizationId}
          onSubmit={handlePaygroupSubmit}
        />
      )}

      {/* Employee Form Modal */}
      <Modal
        isOpen={showForm}
        onClose={handleFormCancel}
        title={editingEmployee ? 'Edit Employee' : 'Create Employee'}
        size="2xl"
      >
        {organizationId && (
          <EmployeeForm
            employee={editingEmployee}
            organizationId={organizationId}
            initialPaygroupId={selectedPaygroupId ?? undefined}
            initialPaygroupName={selectedPaygroupName ?? undefined}
            onSuccess={handleFormSuccess}
            onCancel={handleFormCancel}
          />
        )}
      </Modal>
      </main>
    </div>
  );
}
