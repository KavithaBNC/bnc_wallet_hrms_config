import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEmployeeStore } from '../store/employeeStore';
import { useAuthStore } from '../store/authStore';
import { Employee } from '../services/employee.service';
import employeeService from '../services/employee.service';
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

  // Defer department fetch until form is opened (EmployeeForm fetches on mount when modal opens)
  useEffect(() => {
    if (!organizationId) return;
    const params: any = {
      organizationId,
      page: currentPage,
      limit: 20,
      listView: true,
    };
    if (searchTerm) params.search = searchTerm;
    if (statusFilter !== 'ALL') params.employeeStatus = statusFilter;
    if (departmentFilter !== 'ALL') params.departmentId = departmentFilter;
    fetchEmployees(params);
  }, [organizationId, currentPage, searchTerm, statusFilter, departmentFilter, fetchEmployees]);

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
      limit: 20,
      listView: true,
    };
    if (searchTerm) params.search = searchTerm;
    if (statusFilter !== 'ALL') params.employeeStatus = statusFilter;
    if (departmentFilter !== 'ALL') params.departmentId = departmentFilter;
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

      {/* Main Content */}
      <main className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Title and Actions */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Manage and view all employees</h2>
          </div>
          {isOrgAdmin && (
            <button
              onClick={() => {
                setShowCredentials(!showCredentials);
                if (!showCredentials) {
                  fetchCredentials();
                }
              }}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium"
            >
              {showCredentials ? '📋 View Employees' : '🔐 View Credentials'}
            </button>
          )}
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

      {/* Filters Bar */}
      {!showCredentials && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <input
              type="text"
              placeholder="Search by name, email, or employee code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-10 px-4 py-2 bg-white text-black border border-black rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full h-10 px-4 py-2 bg-white text-black border border-black rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="ON_LEAVE">On Leave</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="TERMINATED">Terminated</option>
              <option value="RESIGNED">Resigned</option>
            </select>
          </div>

          {/* Create Button - RBAC Protected */}
          {canCreate && (
            <div>
              <button
                onClick={handleCreate}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
              >
                + New Employee
              </button>
            </div>
          )}
        </div>
        </div>
      )}

      {/* Statistics Cards */}
      {!showCredentials && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Total Employees</div>
            <div className="text-2xl font-bold text-gray-900">{pagination.total}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Active</div>
            <div className="text-2xl font-bold text-green-600">
              {employees.filter(e => e.employeeStatus === 'ACTIVE').length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">On Leave</div>
            <div className="text-2xl font-bold text-yellow-600">
              {employees.filter(e => e.employeeStatus === 'ON_LEAVE').length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Current Page</div>
            <div className="text-2xl font-bold text-gray-900">
              {pagination.page} / {pagination.totalPages}
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
                const params: any = { organizationId, page: currentPage, limit: 20, listView: true };
                if (searchTerm) params.search = searchTerm;
                if (statusFilter !== 'ALL') params.employeeStatus = statusFilter;
                if (departmentFilter !== 'ALL') params.departmentId = departmentFilter;
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

      {/* Employee Table */}
      {!showCredentials && !loading && !error && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Employee
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Code
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Department
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Position
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Joined
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    {searchTerm || statusFilter !== 'ALL' || departmentFilter !== 'ALL'
                      ? 'No employees found matching your filters'
                      : 'No employees yet. Create your first employee!'}
                  </td>
                </tr>
              ) : (
                employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium">
                            {emp.firstName[0]}{emp.lastName[0]}
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {emp.firstName} {emp.lastName}
                          </div>
                          <div className="text-sm text-gray-500">{emp.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-mono text-gray-900">{emp.employeeCode}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">
                        {emp.department?.name || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm">
                        <div className="text-gray-900">{emp.position?.title || '-'}</div>
                        {emp.position?.level && (
                          <div className="text-gray-500 text-xs">{emp.position.level}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeColor(emp.employeeStatus)}`}>
                        {emp.employeeStatus.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(emp.dateOfJoining).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleView(emp)}
                        disabled={loadingEmployee}
                        className="text-blue-600 hover:text-blue-900 mr-4 disabled:opacity-50"
                      >
                        View
                      </button>
                      {canUpdate && (
                        <button
                          onClick={() => handleEdit(emp)}
                          disabled={loadingEmployee}
                          className="text-indigo-600 hover:text-indigo-900 mr-4 disabled:opacity-50"
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
