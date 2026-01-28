import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import employeeService from '../services/employee.service';
import organizationService from '../services/organization.service';
import { payrollCycleService } from '../services/payroll.service';
import api from '../services/api';
import AppHeader from '../components/layout/AppHeader';
import MonthlyAttendanceChart from '../components/dashboard/MonthlyAttendanceChart';
import DepartmentEmployeesChart from '../components/dashboard/DepartmentEmployeesChart';
import LeaveRequestsChart from '../components/dashboard/LeaveRequestsChart';
import PayrollDistributionChart from '../components/dashboard/PayrollDistributionChart';

interface DashboardStats {
  totalEmployees: number;
  attendancePercentage: number;
  payrollTotal: number;
  performance: number;
  leaveRequests: number;
}

const DashboardPage = () => {
  const navigate = useNavigate();
  const { logout, user } = useAuthStore();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const userRole = user?.role?.toUpperCase();
  const canManagePermissions = userRole === 'ORG_ADMIN' || userRole === 'HR_MANAGER';
  const isEmployee = userRole === 'EMPLOYEE';
  const organizationName = user?.employee?.organization?.name;
  
  const userOrganizationId = user?.employee?.organizationId || user?.employee?.organization?.id;
  const [organizationId, setOrganizationId] = useState<string | undefined>(userOrganizationId);

  const [stats, setStats] = useState<DashboardStats>({
    totalEmployees: 0,
    attendancePercentage: 0,
    payrollTotal: 0,
    performance: 8.9, // Default performance score
    leaveRequests: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchDashboardStats = useCallback(async () => {
    let resolvedOrgId = organizationId;

    // SUPER_ADMIN may not have employee/organization; use first organization for stats
    if (!resolvedOrgId && isSuperAdmin) {
      try {
        const orgsResponse = await organizationService.getAll(1, 1);
        const firstOrg = orgsResponse?.organizations?.[0];
        if (firstOrg?.id) {
          resolvedOrgId = firstOrg.id;
          setOrganizationId(resolvedOrgId);
        }
      } catch (e) {
        console.warn('Could not resolve organization for SUPER_ADMIN:', e);
      }
    }

    if (!resolvedOrgId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const today = new Date().toISOString().split('T')[0];

      const [employeeStats, leaveRequestsData, attendanceData, payrollData] = await Promise.allSettled([
        employeeService.getStatistics(resolvedOrgId),
        api.get('/leaves/requests', {
          params: { status: 'PENDING', organizationId: resolvedOrgId, page: '1', limit: '1' },
        }),
        api.get('/attendance/records', {
          params: {
            startDate: today,
            endDate: today,
            organizationId: resolvedOrgId,
            page: '1',
            limit: '1000',
          },
        }),
        payrollCycleService.getAll({ organizationId: resolvedOrgId, page: '1', limit: '1' }),
      ]);

      const newStats: DashboardStats = {
        totalEmployees: 0,
        attendancePercentage: 0,
        payrollTotal: 0,
        performance: 8.9,
        leaveRequests: 0,
      };

      // Process employee stats – handle both direct object and nested response
      if (employeeStats.status === 'fulfilled' && employeeStats.value != null) {
        const raw = employeeStats.value as any;
        newStats.totalEmployees =
          Number(raw?.totalEmployees) ??
          Number(raw?.data?.totalEmployees) ??
          0;
      }

      // Fallback: get employee count from list pagination if stats failed or returned 0
      if (newStats.totalEmployees === 0) {
        try {
          const list = await employeeService.getAll({
            organizationId: resolvedOrgId,
            page: 1,
            limit: 1,
          });
          const total = (list as any)?.pagination?.total;
          if (typeof total === 'number') newStats.totalEmployees = total;
        } catch (_) {
          /* ignore */
        }
      }

      // Process leave requests
      if (leaveRequestsData.status === 'fulfilled') {
        const response = leaveRequestsData.value.data;
        const pagination = response?.data?.pagination || response?.pagination;
        newStats.leaveRequests = Number(pagination?.total) ?? 0;
      }

      // Process attendance percentage
      if (attendanceData.status === 'fulfilled' && newStats.totalEmployees > 0) {
        const response = attendanceData.value.data;
        const records = response?.data?.data ?? response?.data ?? [];
        const presentCount = Array.isArray(records)
          ? records.filter((r: any) => r.status === 'PRESENT').length
          : 0;
        newStats.attendancePercentage = Math.round(
          (presentCount / newStats.totalEmployees) * 100
        );
      }

      // Process payroll total
      if (payrollData.status === 'fulfilled') {
        const response = payrollData.value.data;
        const cycles = response?.data ?? [];
        if (Array.isArray(cycles) && cycles.length > 0 && cycles[0].totalNet != null) {
          newStats.payrollTotal = Number(cycles[0].totalNet);
        }
      }

      setStats(newStats);
    } catch (error) {
      console.error('Failed to fetch dashboard statistics:', error);
    } finally {
      setLoading(false);
    }
  }, [organizationId, isSuperAdmin]);

  useEffect(() => {
    if (userOrganizationId) setOrganizationId(userOrganizationId);
  }, [userOrganizationId]);

  useEffect(() => {
    if (organizationId || isSuperAdmin) {
      fetchDashboardStats();
    } else {
      setLoading(false);
    }
  }, [organizationId, isSuperAdmin, fetchDashboardStats]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Format payroll amount in Indian Rupees
  const formatPayroll = (amount: number): string => {
    if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(1)}L`;
    }
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50">
      <AppHeader
        title="HRMS Dashboard"
        subtitle={organizationName ? `Organization: ${organizationName}` : undefined}
        notificationCount={!isEmployee ? stats.leaveRequests : 0}
        onLogout={handleLogout}
      />

      {/* Main Content - scrollable, fills remaining height */}
      <main className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Stat Cards - Glassmorphism Design */}
        {!isEmployee && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Employees Card */}
            <div className="bg-white/70 backdrop-blur-lg rounded-2xl shadow-lg p-6 border border-white/20 hover:shadow-xl transition-all duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium mb-1">Employees</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {loading ? '...' : stats.totalEmployees.toLocaleString()}
                  </p>
                </div>
                <div className="bg-blue-500/20 rounded-xl p-3">
                  <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Attendance Card */}
            <div className="bg-white/70 backdrop-blur-lg rounded-2xl shadow-lg p-6 border border-white/20 hover:shadow-xl transition-all duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium mb-1">Attendance</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {loading ? '...' : `${stats.attendancePercentage}%`}
                  </p>
                </div>
                <div className="bg-green-500/20 rounded-xl p-3">
                  <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Payroll Card */}
            <div className="bg-white/70 backdrop-blur-lg rounded-2xl shadow-lg p-6 border border-white/20 hover:shadow-xl transition-all duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium mb-1">Payroll</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {loading ? '...' : formatPayroll(stats.payrollTotal)}
                  </p>
                </div>
                <div className="bg-yellow-500/20 rounded-xl p-3">
                  <svg className="w-8 h-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Performance Card */}
            <div className="bg-white/70 backdrop-blur-lg rounded-2xl shadow-lg p-6 border border-white/20 hover:shadow-xl transition-all duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium mb-1">Performance</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {loading ? '...' : stats.performance.toFixed(1)}
                  </p>
                </div>
                <div className="bg-purple-500/20 rounded-xl p-3">
                  <svg className="w-8 h-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Chart Blocks - Glassmorphism Design */}
        {!isEmployee && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Monthly Attendance Overview */}
            <div className="bg-white/70 backdrop-blur-lg rounded-2xl shadow-lg p-6 border border-white/20 hover:shadow-xl transition-all duration-300">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Monthly Attendance Overview</h3>
              <div className="h-64 flex items-center justify-center">
                <MonthlyAttendanceChart organizationId={organizationId || ''} />
              </div>
            </div>

            {/* Department-wise Employees */}
            <div className="bg-white/70 backdrop-blur-lg rounded-2xl shadow-lg p-6 border border-white/20 hover:shadow-xl transition-all duration-300">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Department-wise Employees</h3>
              <div className="h-64 flex items-center justify-center">
                <DepartmentEmployeesChart organizationId={organizationId || ''} />
              </div>
            </div>

            {/* Leave Requests */}
            <div className="bg-white/70 backdrop-blur-lg rounded-2xl shadow-lg p-6 border border-white/20 hover:shadow-xl transition-all duration-300">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Leave Requests</h3>
              <div className="h-64 flex items-center justify-center">
                <LeaveRequestsChart organizationId={organizationId || ''} />
              </div>
            </div>

            {/* Payroll Distribution */}
            <div className="bg-white/70 backdrop-blur-lg rounded-2xl shadow-lg p-6 border border-white/20 hover:shadow-xl transition-all duration-300">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Payroll Distribution</h3>
              <div className="h-64 flex items-center justify-center">
                <PayrollDistributionChart organizationId={organizationId || ''} />
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
                className="bg-white/70 backdrop-blur-lg rounded-xl shadow hover:shadow-md transition p-4 flex items-center border border-white/20"
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
                className="rounded-xl shadow-md hover:shadow-lg transition-all duration-200 p-4 flex items-center border border-slate-200/80"
                style={{ backgroundColor: '#f8fafc' }}
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
                className="rounded-xl shadow-md hover:shadow-lg transition-all duration-200 p-4 flex items-center border border-slate-200/80"
                style={{ backgroundColor: '#f8fafc' }}
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
                className="rounded-xl shadow-md hover:shadow-lg transition-all duration-200 p-4 flex items-center border border-slate-200/80"
                style={{ backgroundColor: '#f8fafc' }}
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
            const isPermissionsModule = module.name === 'Permissions';
            const shouldShow = module.enabled && module.route;
            const isDisabled = isPermissionsModule && !canManagePermissions;
            
            if (isDisabled) {
              return (
                <div
                  key={`permissions-disabled-${index}`}
                  className="bg-white/70 backdrop-blur-lg rounded-xl shadow p-6 opacity-60 cursor-not-allowed border border-white/20"
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
                className="bg-white/70 backdrop-blur-lg rounded-xl shadow hover:shadow-lg transition p-6 cursor-pointer border border-white/20"
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
                className="bg-white/70 backdrop-blur-lg rounded-xl shadow p-6 opacity-60 cursor-not-allowed border border-white/20"
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
    enabled: canManagePermissions,
  },
  {
    name: 'Employee Salaries',
    icon: '💵',
    description: 'Assign and view employee salaries',
    status: 'Phase 4',
    route: '/employee-salaries',
    enabled: canManagePermissions,
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
      enabled: true,
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
