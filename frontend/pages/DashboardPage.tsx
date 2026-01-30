import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import employeeService from '../services/employee.service';
import api from '../services/api';
import AppHeader from '../components/layout/AppHeader';

interface DashboardStats {
  totalEmployees: number;
  presentToday: number;
  leaveRequests: number;
  openPositions: number;
}

const DashboardPage = () => {
  const navigate = useNavigate();
  const { logout, user } = useAuthStore();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  // Case-insensitive role check for permissions
  const userRole = user?.role?.toUpperCase();
  const canManagePermissions = userRole === 'ORG_ADMIN' || userRole === 'HR_MANAGER';
  const isEmployee = userRole === 'EMPLOYEE';
  const organizationName = user?.employee?.organization?.name;
  
  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id;
  
  const [stats, setStats] = useState<DashboardStats>({
    totalEmployees: 0,
    presentToday: 0,
    leaveRequests: 0,
    openPositions: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchDashboardStats = useCallback(async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      const today = new Date().toISOString().split('T')[0];
      
      // Fetch all stats in parallel
      const [employeeStats, leaveRequestsData, attendanceData, positionStats] = await Promise.allSettled([
        // Employee statistics
        employeeService.getStatistics(organizationId),
        
        // Leave requests (pending count)
        api.get('/leaves/requests', {
          params: {
            status: 'PENDING',
            organizationId,
            page: '1',
            limit: '1',
          },
        }),
        
        // Today's attendance (present count)
        api.get('/attendance/records', {
          params: {
            startDate: today,
            endDate: today,
            status: 'PRESENT',
            organizationId,
            page: '1',
            limit: '1000', // Get all for today
          },
        }),
        
        // Position statistics
        api.get(`/positions/statistics/${organizationId}`),
      ]);

      const newStats: DashboardStats = {
        totalEmployees: 0,
        presentToday: 0,
        leaveRequests: 0,
        openPositions: 0,
      };

      // Process employee stats
      if (employeeStats.status === 'fulfilled' && employeeStats.value) {
        newStats.totalEmployees = employeeStats.value.totalEmployees || 0;
      }

      // Process leave requests
      if (leaveRequestsData.status === 'fulfilled') {
        const response = leaveRequestsData.value.data;
        const pagination = response.data?.pagination || response.pagination;
        newStats.leaveRequests = pagination?.total || 0;
      }

      // Process attendance (count present today)
      if (attendanceData.status === 'fulfilled') {
        const response = attendanceData.value.data;
        const pagination = response.data?.pagination || response.pagination;
        // Use pagination total if available, otherwise count records
        newStats.presentToday = pagination?.total || 0;
      }

      // Process position stats
      if (positionStats.status === 'fulfilled' && positionStats.value) {
        const response = positionStats.value.data;
        const statistics = response.data?.statistics || response.statistics;
        newStats.openPositions = statistics?.vacantPositions || 0;
      }

      setStats(newStats);
    } catch (error) {
      console.error('Failed to fetch dashboard statistics:', error);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    if (organizationId) {
      fetchDashboardStats();
    } else {
      setLoading(false);
    }
  }, [organizationId, fetchDashboardStats]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader
        title="HRMS Dashboard"
        subtitle={organizationName ? `Organization: ${organizationName}` : undefined}
        notificationCount={!isEmployee ? stats.leaveRequests : 0}
        onLogout={handleLogout}
      />

      {/* Main Content - scrollable, fills remaining height */}
      <main className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Stat Cards - hidden for EMPLOYEE role */}
        {!isEmployee && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Stat Cards */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-blue-500 rounded-md p-3">
                <span className="text-white text-2xl">👥</span>
              </div>
              <div className="ml-5">
                <p className="text-gray-500 text-sm">Total Employees</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {loading ? '...' : stats.totalEmployees.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-green-500 rounded-md p-3">
                <span className="text-white text-2xl">✓</span>
              </div>
              <div className="ml-5">
                <p className="text-gray-500 text-sm">Present Today</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {loading ? '...' : stats.presentToday.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-yellow-500 rounded-md p-3">
                <span className="text-white text-2xl">📝</span>
              </div>
              <div className="ml-5">
                <p className="text-gray-500 text-sm">Leave Requests</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {loading ? '...' : stats.leaveRequests.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-purple-500 rounded-md p-3">
                <span className="text-white text-2xl">💼</span>
              </div>
              <div className="ml-5">
                <p className="text-gray-500 text-sm">Open Positions</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {loading ? '...' : stats.openPositions.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Quick Access - Organization Management (SUPER_ADMIN only) */}
        {isSuperAdmin && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Organization Management</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Link
                to="/organizations"
                className="bg-white rounded-lg shadow hover:shadow-md transition p-4 flex items-center"
              >
                <div className="flex-shrink-0 bg-indigo-500 rounded-md p-3">
                  <span className="text-white text-xl">🏢</span>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-gray-900">Organizations</h3>
                  <p className="text-gray-600 text-sm">Manage organizations and create admins</p>
                </div>
              </Link>
            </div>
          </div>
        )}

        {/* Quick Access - Employee Management - hidden for EMPLOYEE role */}
        {!isEmployee && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Employee Management</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              to="/employees"
              className="bg-white rounded-lg shadow hover:shadow-md transition p-4 flex items-center"
            >
              <div className="flex-shrink-0 bg-blue-500 rounded-md p-3">
                <span className="text-white text-xl">👥</span>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900">Employees</h3>
                <p className="text-gray-600 text-sm">Manage employee records</p>
              </div>
            </Link>

            <Link
              to="/departments"
              className="bg-white rounded-lg shadow hover:shadow-md transition p-4 flex items-center"
            >
              <div className="flex-shrink-0 bg-green-500 rounded-md p-3">
                <span className="text-white text-xl">🏢</span>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900">Departments</h3>
                <p className="text-gray-600 text-sm">Organize departments</p>
              </div>
            </Link>

            <Link
              to="/positions"
              className="bg-white rounded-lg shadow hover:shadow-md transition p-4 flex items-center"
            >
              <div className="flex-shrink-0 bg-purple-500 rounded-md p-3">
                <span className="text-white text-xl">💼</span>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900">Positions</h3>
                <p className="text-gray-600 text-sm">Manage job positions</p>
              </div>
            </Link>
          </div>
        </div>
        )}

        {/* Modules Grid - for EMPLOYEE role only show Attendance and Leave Management */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {getModules(canManagePermissions)
            .filter((m) => !isEmployee || ['Attendance', 'Leave Management'].includes(m.name))
            .map((module, index) => {
            // Always show Permissions module, but make it disabled if user can't manage
            const isPermissionsModule = module.name === 'Permissions';
            const shouldShow = module.enabled && module.route;
            const isDisabled = isPermissionsModule && !canManagePermissions;
            
            
            if (isDisabled) {
              // Show Permissions module as disabled if user doesn't have permission
              return (
                <div
                  key={`permissions-disabled-${index}`}
                  className="bg-white rounded-lg shadow p-6 opacity-60 cursor-not-allowed"
                  title="You don't have permission to access this module"
                >
                  <div className="flex items-center mb-4">
                    <span className="text-4xl mr-4">{module.icon}</span>
                    <h3 className="text-xl font-semibold text-gray-900">
                      {module.name}
                    </h3>
                  </div>
                  <p className="text-gray-600 text-sm">{module.description}</p>
                  <div className="mt-4">
                    <span className="inline-block px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                      {module.status}
                    </span>
                  </div>
                </div>
              );
            }
            
            return shouldShow ? (
              <Link
                key={`module-${module.name}-${index}`}
                to={module.route}
                className="bg-white rounded-lg shadow hover:shadow-lg transition p-6 cursor-pointer"
              >
                <div className="flex items-center mb-4">
                  <span className="text-4xl mr-4">{module.icon}</span>
                  <h3 className="text-xl font-semibold text-gray-900">
                    {module.name}
                  </h3>
                </div>
                <p className="text-gray-600 text-sm">{module.description}</p>
                <div className="mt-4">
                  <span className="inline-block px-3 py-1 bg-blue-100 text-blue-600 text-xs rounded-full font-medium">
                    {module.status}
                  </span>
                </div>
              </Link>
            ) : (
              <div
                key={`module-disabled-${module.name}-${index}`}
                className="bg-white rounded-lg shadow p-6 opacity-60 cursor-not-allowed"
              >
                <div className="flex items-center mb-4">
                  <span className="text-4xl mr-4">{module.icon}</span>
                  <h3 className="text-xl font-semibold text-gray-900">
                    {module.name}
                  </h3>
                </div>
                <p className="text-gray-600 text-sm">{module.description}</p>
                <div className="mt-4">
                  <span className="inline-block px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                    {module.status}
                  </span>
                </div>
              </div>
            );
          })}
          
          {/* Force render Permissions module if it's missing */}
          {(() => {
            const allModules = getModules(canManagePermissions);
            const hasPermissions = allModules.some(m => m.name === 'Permissions');
            const permissionsModule = allModules.find(m => m.name === 'Permissions');
            
            if (!hasPermissions || !permissionsModule) {
              console.error('❌ Permissions module not found in modules array!');
              return null;
            }
            
            // Check if it was already rendered
            const shouldRender = permissionsModule.enabled && permissionsModule.route && canManagePermissions;
            
            if (shouldRender) {
              return (
                <Link
                  key="permissions-forced"
                  to="/permissions"
                  className="bg-white rounded-lg shadow hover:shadow-lg transition p-6 cursor-pointer border-2 border-blue-500"
                  style={{ order: 999 }}
                >
                  <div className="flex items-center mb-4">
                    <span className="text-4xl mr-4">🔐</span>
                    <h3 className="text-xl font-semibold text-gray-900">
                      Permissions
                    </h3>
                    <span className="ml-2 text-xs bg-red-100 text-red-600 px-2 py-1 rounded">FORCED RENDER</span>
                  </div>
                  <p className="text-gray-600 text-sm">Manage role permissions and access control</p>
                  <div className="mt-4">
                    <span className="inline-block px-3 py-1 bg-blue-100 text-blue-600 text-xs rounded-full font-medium">
                      Available
                    </span>
                  </div>
                </Link>
              );
            }
            
            return null;
          })()}
        </div>
      </main>
    </div>
  );
};

// Modules configuration - will be filtered by user role
const getModules = (canManagePermissions: boolean) => {
  const modules = [
    {
      name: 'Employee Management',
      icon: '👥',
      description: 'Manage employee profiles, departments, and hierarchy',
      status: 'Phase 2',
      route: '/employees',
      enabled: true,
    },
    {
      name: 'Attendance',
      icon: '📅',
      description: 'Track attendance and check-in/out',
      status: 'Phase 3',
      route: '/attendance',
      enabled: true,
    },
    {
      name: 'Leave Management',
      icon: '🏖️',
      description: 'Manage leave requests and policies',
      status: 'Phase 3',
      route: '/leave',
      enabled: true,
    },
  {
    name: 'Payroll',
    icon: '💰',
    description: 'Process payroll and manage salary structures',
    status: 'Phase 4',
    route: '/payroll',
    enabled: true,
  },
  {
    name: 'Salary Structures',
    icon: '📊',
    description: 'Manage salary structures and components',
    status: 'Phase 4',
    route: '/salary-structures',
    enabled: canManagePermissions, // Only ORG_ADMIN and HR_MANAGER
  },
  {
    name: 'Employee Salaries',
    icon: '💵',
    description: 'Assign and view employee salaries',
    status: 'Phase 4',
    route: '/employee-salaries',
    enabled: canManagePermissions, // Only ORG_ADMIN and HR_MANAGER
  },
  {
    name: 'Recruitment (ATS)',
    icon: '🎯',
    description: 'AI-powered applicant tracking and hiring',
    status: 'Phase 5',
    route: null,
    enabled: false,
  },
  {
    name: 'AI Chatbot',
    icon: '🤖',
    description: 'Employee self-service chatbot',
    status: 'Phase 6',
    route: null,
    enabled: false,
  },
  {
    name: 'Performance',
    icon: '📊',
    description: 'Performance reviews and goal tracking',
    status: 'Phase 7',
    route: null,
    enabled: false,
  },
  {
    name: 'Documents',
    icon: '📄',
    description: 'Document management and digital signatures',
    status: 'Phase 8',
    route: null,
    enabled: false,
  },
  {
    name: 'Reports & Analytics',
    icon: '📈',
    description: 'Generate reports and view analytics',
    status: 'Phase 9',
    route: null,
    enabled: false,
  },
    {
      name: 'Permissions',
      icon: '🔐',
      description: 'Manage role permissions and access control',
      status: 'Available',
      route: '/permissions',
      enabled: true, // Always enabled so it shows, but access is controlled by canManagePermissions
    },
    {
      name: 'Settings',
      icon: '⚙️',
      description: 'System configuration and preferences',
      status: 'Available',
      route: null,
      enabled: false,
    },
  ];
  
  return modules;
};

export default DashboardPage;
