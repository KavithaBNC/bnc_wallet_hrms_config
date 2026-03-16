import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';
import {
  getAssignedModules,
  getModulePermissions,
  CONFIGURATOR_CODE_TO_CARD,
} from '../config/configurator-module-mapping';

// Dashboard widgets
import EmployeeProfile from '../components/dashboard/EmployeeProfile';
import AttendanceSummary from '../components/dashboard/AttendanceSummary';
import LeaveDetails from '../components/dashboard/LeaveDetails';
import SalaryPayroll from '../components/dashboard/SalaryPayroll';
import TasksWorkStatus from '../components/dashboard/TasksWorkStatus';
import NotificationsWidget from '../components/dashboard/NotificationsWidget';
import PerformanceWidget from '../components/dashboard/PerformanceWidget';
import HolidaysWidget from '../components/dashboard/HolidaysWidget';
import DocumentsWidget from '../components/dashboard/DocumentsWidget';
import BirthdayReminders from '../components/dashboard/BirthdayReminders';
import WorkAnniversaryReminders from '../components/dashboard/WorkAnniversaryReminders';
import MotivationQuote from '../components/dashboard/MotivationQuote';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function formatCurrentDate(): string {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const DashboardPage = () => {
  const navigate = useNavigate();
  const { logout, user } = useAuthStore();
  // Module permissions from /api/v1/user-role-modules/project API response
  const permPerms = getModulePermissions('/permissions');
  const leavePerms = getModulePermissions('/leave');
  const employeePerms = getModulePermissions('/employees');
  const canManagePermissions = permPerms.can_view;
  const canViewLeaveApprovals = leavePerms.can_edit;
  const isEmployee = !employeePerms.can_view && !employeePerms.can_add;
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const organizationName = user?.employee?.organization?.name;

  const firstName = user?.employee?.firstName || user?.email?.split('@')[0] || 'User';
  const [currentTime, setCurrentTime] = useState(new Date());

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-[#F8F9FA]">
      <AppHeader
        title="Dashboard"
        subtitle={organizationName ? organizationName : undefined}
        notificationCount={0}
        onLogout={handleLogout}
      />

      <main className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 py-6">
        {/* Welcome section with motivation quote in center */}
        <div className="flex items-center justify-between mb-6 gap-4 animate-fadeInUp">
          <div className="flex-shrink-0">
            <h1 className="text-2xl font-bold text-gray-900">
              {getGreeting()}, {firstName}!
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Here's what's happening today
            </p>
          </div>
          <div className="flex-1 hidden md:block max-w-xl mx-auto">
            <MotivationQuote />
          </div>
          <div className="text-right flex-shrink-0 hidden sm:block">
            <p className="text-sm font-medium text-gray-700">
              {currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="text-xs text-gray-400">{formatCurrentDate()}</p>
          </div>
        </div>
        {/* Motivation Quote - mobile only (below greeting) */}
        <div className="mb-6 md:hidden animate-fadeInUp animate-delay-1">
          <MotivationQuote />
        </div>

        {/* Main dashboard grid - 3 columns on xl, 2 on md, 1 on mobile */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-6">
          {/* Row 1: Profile, Attendance, Leaves */}
          <div className="animate-fadeInUp animate-delay-1"><EmployeeProfile /></div>
          <div className="animate-fadeInUp animate-delay-2"><AttendanceSummary /></div>
          <div className="animate-fadeInUp animate-delay-3"><LeaveDetails /></div>

          {/* Row 2: Payroll, Tasks, Notifications */}
          <div className="animate-fadeInUp animate-delay-4"><SalaryPayroll /></div>
          <div className="animate-fadeInUp animate-delay-5"><TasksWorkStatus /></div>
          <div className="animate-fadeInUp animate-delay-6"><NotificationsWidget /></div>

          {/* Row 3: Performance, Holidays, Documents */}
          <div className="animate-fadeInUp animate-delay-7"><PerformanceWidget /></div>
          <div className="animate-fadeInUp animate-delay-8"><HolidaysWidget /></div>
          <div className="animate-fadeInUp animate-delay-9"><DocumentsWidget /></div>
        </div>

        {/* Additional widgets - 2-column layout for birthdays/anniversaries */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="animate-fadeInUp animate-delay-10"><BirthdayReminders /></div>
          <div className="animate-fadeInUp animate-delay-11"><WorkAnniversaryReminders /></div>
        </div>

        {/* Quick Access - Organization Management (SUPER_ADMIN only) */}
        {isSuperAdmin && (
          <div className="mb-6 animate-fadeInUp animate-delay-12">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Organization Management</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link
                to="/organizations"
                className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-200 p-4 flex items-center border border-gray-100"
              >
                <div className="flex-shrink-0 bg-teal-100 rounded-lg p-3">
                  <svg className="w-6 h-6 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-sm font-semibold text-gray-900">Organizations</h3>
                  <p className="text-xs text-gray-500">Manage organizations</p>
                </div>
              </Link>
            </div>
          </div>
        )}

        {/* Quick Access - shown based on module permissions */}
        {employeePerms.can_view && (
          <div className="mb-6 animate-fadeInUp animate-delay-12">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Quick Access</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {employeePerms.can_view && <QuickLink to="/employees" icon={employeesIcon} color="bg-teal-100 text-teal-600" title="Employees" subtitle="Manage employee records" />}
              {getModulePermissions('/departments').can_view && <QuickLink to="/departments" icon={departmentsIcon} color="bg-emerald-100 text-emerald-600" title="Departments" subtitle="Organize departments" />}
              {canViewLeaveApprovals && (
                <QuickLink to="/leave/approvals" icon={leaveIcon} color="bg-amber-100 text-amber-600" title="Leave Approvals" subtitle="Review leave requests" />
              )}
            </div>
          </div>
        )}

        {/* Assigned Modules Grid */}
        <AssignedModulesGrid canManagePermissions={canManagePermissions} isEmployee={isEmployee} />
      </main>
    </div>
  );
};

// Quick access link component
function QuickLink({ to, icon, color, title, subtitle }: { to: string; icon: JSX.Element; color: string; title: string; subtitle: string }) {
  return (
    <Link to={to} className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-200 p-4 flex items-center border border-gray-100">
      <div className={`flex-shrink-0 rounded-lg p-3 ${color}`}>{icon}</div>
      <div className="ml-4">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <p className="text-xs text-gray-500">{subtitle}</p>
      </div>
    </Link>
  );
}

const employeesIcon = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
  </svg>
);
const departmentsIcon = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
  </svg>
);
const positionsIcon = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0" />
  </svg>
);
const leaveIcon = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
  </svg>
);

/** Assigned modules from Config DB (project_modules) filtered by role_module_permissions */
function AssignedModulesGrid({
  canManagePermissions,
  isEmployee,
}: {
  canManagePermissions: boolean;
  isEmployee: boolean;
}) {
  const assignedModules = useMemo(() => {
    const raw = getAssignedModules();
    return raw
      .filter((m) => {
        const code = (m.code || '').toUpperCase().trim();
        const card = CONFIGURATOR_CODE_TO_CARD[code];
        if (!card?.path) return false;
        // Use API module permissions: only show if can_view is true
        const modPerms = getModulePermissions(card.path);
        if (!modPerms.can_view) return false;
        return true;
      })
      .map((m) => {
        const code = (m.code || '').toUpperCase().trim();
        const card = CONFIGURATOR_CODE_TO_CARD[code] || {
          path: '/dashboard',
          icon: '📋',
          description: m.description || m.name,
        };
        return {
          ...m,
          route: card.path,
          icon: card.icon,
          description: card.description,
        };
      });
  }, [canManagePermissions, isEmployee]);

  if (assignedModules.length === 0) return null;

  return (
    <div className="mb-6 animate-fadeInUp animate-delay-12">
      <h2 className="text-lg font-semibold text-gray-900 mb-3">Modules</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {assignedModules.map((module, index) => {
          const isDisabled = false; // Filtering already done by can_view check above

          if (isDisabled) {
            return (
              <div
                key={`permissions-disabled-${module.id}-${index}`}
                className="bg-white rounded-xl shadow-md p-5 opacity-60 cursor-not-allowed border border-gray-100"
                title="You don't have permission to access this module"
              >
                <div className="flex items-center mb-3">
                  <span className="text-3xl mr-3">{module.icon}</span>
                  <h3 className="text-sm font-semibold text-gray-900">{module.name}</h3>
                </div>
                <p className="text-xs text-gray-500">{module.description}</p>
              </div>
            );
          }

          return (
            <Link
              key={`module-${module.id}-${index}`}
              to={module.route}
              className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-200 p-5 border border-gray-100"
            >
              <div className="flex items-center mb-3">
                <span className="text-3xl mr-3">{module.icon}</span>
                <h3 className="text-sm font-semibold text-gray-900">{module.name}</h3>
              </div>
              <p className="text-xs text-gray-500">{module.description}</p>
              <span className="inline-block mt-3 px-2.5 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-medium rounded-full">
                Assigned
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default DashboardPage;
