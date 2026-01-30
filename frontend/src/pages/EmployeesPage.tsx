import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEmployeeStore } from '../store/employeeStore';
import { useAuthStore } from '../store/authStore';
import { usePositionStore } from '../store/positionStore';
import { Employee } from '../services/employee.service';
import employeeService from '../services/employee.service';
import api from '../services/api';
import Modal from '../components/common/Modal';
import EmployeeForm from '../components/employees/EmployeeForm';
import PaygroupSelectionModal from '../components/employees/PaygroupSelectionModal';
import AppHeader from '../components/layout/AppHeader';
import { canCreateEmployee, canUpdateEmployee, canDeleteEmployee } from '../utils/rbac';

function getAvatarColor(name: string): string {
  const colors = ['bg-green-500', 'bg-blue-500', 'bg-orange-500', 'bg-purple-500', 'bg-teal-500', 'bg-indigo-500'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default function EmployeesPage() {
  const navigate = useNavigate();
  const { user, loadUser, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;
  const { employees, pagination, loading, error, fetchEmployees, deleteEmployee } = useEmployeeStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [departmentFilter, _setDepartmentFilter] = useState<string>('ALL');
  const [positionFilter, setPositionFilter] = useState<string>('ALL');
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<'employeeCode' | 'firstName'>('firstName');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const { positions, fetchPositions } = usePositionStore();
  const [showForm, setShowForm] = useState(false);
  const [showPaygroupModal, setShowPaygroupModal] = useState(false);
  const [selectedPaygroupId, setSelectedPaygroupId] = useState<string | null>(null);
  const [selectedPaygroupName, setSelectedPaygroupName] = useState<string | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [viewMode, setViewMode] = useState(false);
  const [loadingEmployee, setLoadingEmployee] = useState(false);
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
  const [viewType, setViewType] = useState<'list' | 'grid'>('list');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Close export menu when clicking outside
  useEffect(() => {
    if (!showExportMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showExportMenu]);

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

  useEffect(() => {
    if (organizationId) fetchPositions({ organizationId });
  }, [organizationId, fetchPositions]);

  useEffect(() => {
    if (!organizationId) return;
    const params: any = {
      organizationId,
      page: currentPage,
      limit: pageSize,
      listView: true,
    };
    if (searchTerm) params.search = searchTerm;
    if (statusFilter !== 'ALL') params.employeeStatus = statusFilter;
    if (departmentFilter !== 'ALL') params.departmentId = departmentFilter;
    if (positionFilter !== 'ALL') params.positionId = positionFilter;
    params.sortBy = sortBy;
    params.sortOrder = sortOrder;
    fetchEmployees(params);
  }, [organizationId, currentPage, pageSize, searchTerm, statusFilter, departmentFilter, positionFilter, sortBy, sortOrder, fetchEmployees]);

  const fetchCredentials = useCallback(async () => {
    try {
      setLoadingCredentials(true);
      const data = await employeeService.getCredentials();
      setCredentials(data);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      console.error('Failed to fetch credentials:', error);
      alert(error.response?.data?.message || 'Failed to fetch employee credentials');
    } finally {
      setLoadingCredentials(false);
    }
  }, []);

  useEffect(() => {
    if (showCredentials && canManageCredentials && credentials.length === 0 && !loadingCredentials) {
      fetchCredentials();
    }
  }, [showCredentials, canManageCredentials, credentials.length, loadingCredentials, fetchCredentials]);

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

  const handleView = async (employee: Employee) => {
    setLoadingEmployee(true);
    try {
      const full = await employeeService.getById(employee.id);
      setEditingEmployee(full);
      setViewMode(true);
      setShowForm(true);
    } catch (err) {
      console.error('Failed to load employee', err);
      alert('Failed to load employee details');
    } finally {
      setLoadingEmployee(false);
    }
  };

  const handleEdit = async (employee: Employee) => {
    setLoadingEmployee(true);
    try {
      const full = await employeeService.getById(employee.id);
      setEditingEmployee(full);
      setViewMode(false);
      setShowForm(true);
    } catch (err) {
      console.error('Failed to load employee', err);
      alert('Failed to load employee details');
    } finally {
      setLoadingEmployee(false);
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingEmployee(null);
    const params: any = {
      organizationId,
      page: currentPage,
      limit: pageSize,
      listView: true,
      sortBy,
      sortOrder,
    };
    if (searchTerm) params.search = searchTerm;
    if (statusFilter !== 'ALL') params.employeeStatus = statusFilter;
    if (departmentFilter !== 'ALL') params.departmentId = departmentFilter;
    if (positionFilter !== 'ALL') params.positionId = positionFilter;
    fetchEmployees(params);
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingEmployee(null);
    setViewMode(false);
    setSelectedPaygroupId(null);
    setSelectedPaygroupName(null);
  };

  const handlePaygroupSubmit = (paygroupId: string, paygroupName: string) => {
    setSelectedPaygroupId(paygroupId);
    setSelectedPaygroupName(paygroupName);
    setShowPaygroupModal(false);
    setShowForm(true);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleSort = (column: 'employeeCode' | 'firstName') => {
    if (sortBy === column) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  };

  const SortIcon = ({ column }: { column: 'employeeCode' | 'firstName' }) => {
    if (sortBy !== column) {
      return (
        <span className="inline-flex flex-col ml-1 text-gray-400" aria-hidden>
          <svg className="w-3 h-3 -mb-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M5 12l5-5 5 5H5z" />
          </svg>
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path d="M15 8l-5 5-5-5h10z" />
          </svg>
        </span>
      );
    }
    return sortOrder === 'asc' ? (
      <svg className="w-4 h-4 ml-1 text-gray-600 inline-block" fill="currentColor" viewBox="0 0 20 20" aria-label="Sorted ascending">
        <path d="M5 12l5-5 5 5H5z" />
      </svg>
    ) : (
      <svg className="w-4 h-4 ml-1 text-gray-600 inline-block" fill="currentColor" viewBox="0 0 20 20" aria-label="Sorted descending">
        <path d="M15 8l-5 5-5-5h10z" />
      </svg>
    );
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

  const handleExportExcel = () => {
    setShowExportMenu(false);
    if (!employees || employees.length === 0) {
      alert('No employees to export.');
      return;
    }
    const headers = ['EMP ID', 'Name', 'Email', 'Phone', 'Designation', 'Status'];
    const rows = employees.map((emp) => [
      emp.employeeCode,
      `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
      emp.email || '',
      emp.phone || '',
      emp.position?.title || '',
      emp.employeeStatus || '',
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

  const handleExportPdf = () => {
    setShowExportMenu(false);
    if (!employees || employees.length === 0) {
      alert('No employees to export.');
      return;
    }
    const rowsHtml = employees
      .map(
        (emp) =>
          `<tr>
            <td>${emp.employeeCode}</td>
            <td>${(emp.firstName || '') + ' ' + (emp.lastName || '')}</td>
            <td>${emp.email || ''}</td>
            <td>${emp.phone || ''}</td>
            <td>${emp.position?.title || ''}</td>
            <td>${emp.employeeStatus || ''}</td>
          </tr>`
      )
      .join('');
    const html = `
      <!DOCTYPE html>
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
                <th>EMP ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Designation</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          <script>window.onload = function () { window.print(); };</script>
        </body>
      </html>
    `;
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
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

  const handleChangeRole = async (employeeId: string, newRole: string) => {
    if (!roleChangeModal) return;

    try {
      setChangingRole(employeeId);
      
      // The employeeId from credentials is the employee record ID
      // Update employee with role
      await employeeService.update(employeeId, { role: newRole } as Partial<Employee> & { role?: string });

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
      await api.post(`/auth/admin/reset-password/${resetPasswordModal.employeeId}`, {
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

      {/* Main Content - match reference: breadcrumbs, filters (with labels), cards, table */}
      <main className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-6 bg-gray-50">
        <div className="w-full max-w-[1600px] mx-auto">
        {/* Breadcrumbs - Employee (bold), home icon, / Employee / Employee List */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <nav className="flex items-center gap-1.5 text-sm text-gray-500" aria-label="Breadcrumb">
            <span className="font-semibold text-gray-900">Employee</span>
            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="text-gray-500">Employee</span>
            <span className="mx-1 text-gray-400">/</span>
            <span className="text-gray-500">Employee List</span>
          </nav>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setViewType('list')}
              className={`h-9 w-9 rounded-lg flex items-center justify-center ${viewType === 'list' ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-600'}`}
              title="List view"
              aria-label="List view"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
            </button>
            <button
              type="button"
              onClick={() => setViewType('grid')}
              className={`h-9 w-9 rounded-lg flex items-center justify-center ${viewType === 'grid' ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-600'}`}
              title="Grid view"
              aria-label="Grid view"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
            </button>
            <div className="relative" ref={exportMenuRef}>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowExportMenu((open) => !open); }}
                className="h-9 px-3 flex items-center gap-1 border border-gray-300 rounded-lg bg-gray-50 text-sm text-gray-700 hover:bg-gray-100 transition"
              >
                Export
                <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {showExportMenu && (
                <div className="absolute right-0 mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1">
                  <button
                    type="button"
                    onClick={handleExportPdf}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                    Export as PDF
                  </button>
                  <button
                    type="button"
                    onClick={handleExportExcel}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    Export as Excel
                  </button>
                </div>
              )}
            </div>
            {isOrgAdmin && (
              <button
                onClick={() => { setShowCredentials(!showCredentials); if (!showCredentials) fetchCredentials(); }}
                className="h-9 px-4 py-2 rounded-lg bg-gray-200 text-gray-700 font-medium text-sm hover:bg-gray-300 transition"
              >
                {showCredentials ? 'View Employees' : 'View Credentials'}
              </button>
            )}
            {canCreate && (
              <button
                onClick={handleCreate}
                className="h-9 px-4 py-2 rounded-lg bg-orange-500 text-white font-medium text-sm hover:bg-orange-600 transition"
              >
                + Add Employee
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

      {/* Filters Bar - equal-width boxes, labels above, match reference */}
      {!showCredentials && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-500 mb-1.5">Designation</label>
            <select
              value={positionFilter}
              onChange={(e) => { setPositionFilter(e.target.value); setCurrentPage(1); }}
              className="h-10 w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="ALL">All Designations</option>
              {positions.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-500 mb-1.5">Select Status</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="h-10 w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="ON_LEAVE">On Leave</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="TERMINATED">Terminated</option>
              <option value="RESIGNED">Resigned</option>
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-500 mb-1.5">Sort By</label>
            <select className="h-10 w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
              <option>Last 7 Days</option>
              <option>Last 30 Days</option>
              <option>Last 90 Days</option>
            </select>
          </div>
          <div className="flex flex-col">
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
      )}

      {/* Summary Cards - exact icon background colors: dark grey, green, red, blue; white icons */}
      {!showCredentials && (() => {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const newJoinersCount = employees.filter((e) => {
          const join = e.dateOfJoining ? new Date(e.dateOfJoining) : null;
          return join && join >= thirtyDaysAgo;
        }).length;
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex items-center gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#333333] flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500">Total Employee</div>
                <div className="text-2xl font-bold text-gray-900">{pagination.total}</div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex items-center gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#4CAF50] flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500">Active</div>
                <div className="text-2xl font-bold text-gray-900">{employees.filter(e => e.employeeStatus === 'ACTIVE').length}</div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex items-center gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#F44336] flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500">InActive</div>
                <div className="text-2xl font-bold text-gray-900">{pagination.total - employees.filter(e => e.employeeStatus === 'ACTIVE').length}</div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex items-center gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#2196F3] flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500">New Joiners</div>
                <div className="text-2xl font-bold text-gray-900">{newJoinersCount}</div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Error Message */}
      {!showCredentials && error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          <p className="font-semibold">Error loading employees</p>
          <p className="text-sm mt-1">{error}</p>
          <button
            onClick={() => {
              if (organizationId) {
                const params: any = { organizationId, page: currentPage, limit: pageSize, listView: true, sortBy, sortOrder };
                if (searchTerm) params.search = searchTerm;
                if (statusFilter !== 'ALL') params.employeeStatus = statusFilter;
                if (departmentFilter !== 'ALL') params.departmentId = departmentFilter;
                if (positionFilter !== 'ALL') params.positionId = positionFilter;
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
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="h-9 w-32 bg-gray-200 rounded animate-pulse" />
          </div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">EMP ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">NAME</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">EMAIL</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PHONE</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                <tr key={i}>
                  <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-16 animate-pulse" /></td>
                  <td className="px-6 py-4"><div className="flex items-center gap-3"><div className="h-10 w-10 bg-gray-200 rounded-full animate-pulse" /><div className="h-4 bg-gray-200 rounded w-28 animate-pulse" /></div></td>
                  <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-40 animate-pulse" /></td>
                  <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-24 animate-pulse" /></td>
                  <td className="px-6 py-4 text-right"><div className="h-4 bg-gray-200 rounded w-20 ml-auto animate-pulse" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Employee List (Table or Grid) */}
      {!showCredentials && !loading && !error && (
        <>
          {viewType === 'grid' ? (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
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
              <div className="p-4">
                {employees.length === 0 ? (
                  <div className="py-12 text-center text-gray-500">
                    {searchTerm || statusFilter !== 'ALL' || positionFilter !== 'ALL'
                      ? 'No employees found matching your filters'
                      : 'No employees yet. Create your first employee!'}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {employees.map((emp) => (
                      <div key={emp.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition">
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`flex-shrink-0 h-12 w-12 rounded-full flex items-center justify-center text-white font-medium text-sm ${getAvatarColor(emp.firstName + ' ' + emp.lastName)}`}>
                            {emp.firstName?.[0] || ''}{emp.lastName?.[0] || ''}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-gray-900 truncate">{emp.firstName} {emp.lastName}</div>
                            <div className="text-xs text-gray-500 truncate">{emp.position?.title || '—'}</div>
                            <div className="text-xs text-gray-400 font-mono">{emp.employeeCode}</div>
                          </div>
                        </div>
                        <div className="text-xs text-gray-600 space-y-1 mb-3">
                          <div className="truncate">{emp.email}</div>
                          {emp.phone && <div>{emp.phone}</div>}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => handleView(emp)} disabled={loadingEmployee} className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50">
                            View
                          </button>
                          {canUpdate && (
                            <button type="button" onClick={() => handleEdit(emp)} disabled={loadingEmployee} className="text-xs text-indigo-600 hover:text-indigo-800 disabled:opacity-50">
                              Edit
                            </button>
                          )}
                          {canDelete && (
                            <button type="button" onClick={() => handleDelete(emp.id)} className="text-xs text-red-600 hover:text-red-800">
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {pagination.totalPages > 1 && (
                <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between flex-wrap gap-2">
                  <p className="text-sm text-gray-700">
                    Showing <span className="font-medium">{(currentPage - 1) * pagination.limit + 1}</span> to <span className="font-medium">{Math.min(currentPage * pagination.limit, pagination.total)}</span> of <span className="font-medium">{pagination.total}</span> results
                  </p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1 border border-gray-300 rounded bg-white text-sm disabled:opacity-50">
                      Previous
                    </button>
                    <span className="px-3 py-1 text-sm text-gray-700">Page {currentPage} of {pagination.totalPages}</span>
                    <button type="button" onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))} disabled={currentPage === pagination.totalPages} className="px-3 py-1 border border-gray-300 rounded bg-white text-sm disabled:opacity-50">
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
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
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button
                    type="button"
                    onClick={() => handleSort('employeeCode')}
                    className="inline-flex items-center hover:text-gray-700 focus:outline-none"
                  >
                    EMP ID
                    <SortIcon column="employeeCode" />
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button
                    type="button"
                    onClick={() => handleSort('firstName')}
                    className="inline-flex items-center hover:text-gray-700 focus:outline-none"
                  >
                    NAME
                    <SortIcon column="firstName" />
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  EMAIL
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  PHONE
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    {searchTerm || statusFilter !== 'ALL' || departmentFilter !== 'ALL' || positionFilter !== 'ALL'
                      ? 'No employees found matching your filters'
                      : 'No employees yet. Create your first employee!'}
                  </td>
                </tr>
              ) : (
                employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-mono text-gray-900">{emp.employeeCode}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center text-white font-medium text-sm ${getAvatarColor(emp.firstName + ' ' + emp.lastName)}`}>
                          {emp.firstName?.[0] || ''}{emp.lastName?.[0] || ''}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {emp.firstName} {emp.lastName}
                          </div>
                          <div className="text-xs text-gray-500">
                            {emp.position?.title || '—'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {emp.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {emp.phone || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleView(emp)}
                        disabled={loadingEmployee}
                        className="text-blue-600 hover:text-blue-900 mr-3 disabled:opacity-50"
                      >
                        View
                      </button>
                      {canUpdate && (
                        <button
                          onClick={() => handleEdit(emp)}
                          disabled={loadingEmployee}
                          className="text-indigo-600 hover:text-indigo-900 mr-3 disabled:opacity-50"
                        >
                          Edit
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => handleDelete(emp.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>

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
        </>
      )}

        </div>
      {/* Paygroup Selection Modal (Create flow only) */}
      {organizationId && (
        <PaygroupSelectionModal
          isOpen={showPaygroupModal}
          onClose={() => setShowPaygroupModal(false)}
          organizationId={organizationId}
          onSubmit={handlePaygroupSubmit}
        />
      )}

      {/* Employee Form Modal - full width for large form */}
      <Modal
        isOpen={showForm}
        onClose={handleFormCancel}
        title={editingEmployee ? (viewMode ? 'View Employee' : 'Edit Employee') : 'Create Employee'}
        size="full"
      >
        {organizationId && (
          <EmployeeForm
            employee={editingEmployee}
            organizationId={organizationId}
            initialPaygroupId={selectedPaygroupId ?? undefined}
            initialPaygroupName={selectedPaygroupName ?? undefined}
            onSuccess={handleFormSuccess}
            onCancel={handleFormCancel}
            mode={editingEmployee && viewMode ? 'view' : 'edit'}
          />
        )}
      </Modal>
      </main>
    </div>
  );
}
