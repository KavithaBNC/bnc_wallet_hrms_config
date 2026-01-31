import { useState, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import permissionService from '../../services/permission.service';
import { APP_MODULES } from '../../config/modules';
import type { AppModule } from '../../config/modules';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

/** Icons for sidebar – keyed by path. New menus added to APP_MODULES need an icon here. */
const ICONS_BY_PATH: Record<string, React.ReactNode> = {
  '/dashboard': (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  '/employees': (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  '/departments': (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  '/positions': (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2-2v8a2 2 0 002 2z" />
    </svg>
  ),
  '/attendance': (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  '/leave': (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  '/payroll': (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  '/payroll-master': (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  ),
  '/payroll/employee-separation': (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  ),
  '/payroll/employee-rejoin': (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
    </svg>
  ),
  '/salary-structures': (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  '/employee-salaries': (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  '/hr-audit-settings': (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  '/employee-master-approval': (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  '/organizations': (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  '/permissions': (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  ),
};

const bottomNavItems = [
  { to: '/profile', label: 'Settings', icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )},
];

const APPROVER_ROLES = ['SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'];

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [userPermissionKeys, setUserPermissionKeys] = useState<Set<string>>(new Set());

  const role = (user?.role != null ? String(user.role) : '').toUpperCase();
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const canSeeAllModules = isSuperAdmin; // Only Super Admin sees all; Org Admin / HR Manager use assigned permissions

  useEffect(() => {
    if (!user) {
      setUserPermissionKeys(new Set());
      return;
    }
    if (canSeeAllModules) {
      setUserPermissionKeys(new Set(['*']));
      return;
    }
    permissionService.getUserPermissions().then((perms) => {
      const keys = new Set(perms.map((p) => `${p.resource}.${p.action}`));
      setUserPermissionKeys(keys);
    }).catch(() => setUserPermissionKeys(new Set()));
  }, [user?.id, user?.role, canSeeAllModules]);

  const hasView = useMemo(() => {
    return (resource: string) => {
      if (canSeeAllModules) return true;
      return userPermissionKeys.has('*') || userPermissionKeys.has(`${resource}.read`);
    };
  }, [canSeeAllModules, userPermissionKeys]);

  // Super Admin always sees all menus from APP_MODULES (hasView returns true for all resources)
  const visibleNavItems = useMemo(() => {
    const items: AppModule[] = [];
    for (const mod of APP_MODULES) {
      if (mod.visibility === 'super_admin_only') {
        if (isSuperAdmin) items.push(mod);
      } else if (mod.visibility === 'module_permission_only') {
        if (isSuperAdmin || hasView('permissions')) items.push(mod);
      } else {
        if (hasView(mod.resource)) items.push(mod);
      }
    }
    return items;
  }, [isSuperAdmin, hasView]);

  // Payroll Master dropdown: open when current path is under its children (e.g. /payroll/employee-separation)
  const payrollMasterDropdownOpen = location.pathname.startsWith('/payroll/');
  const [payrollMasterExpanded, setPayrollMasterExpanded] = useState(payrollMasterDropdownOpen);
  useEffect(() => {
    if (payrollMasterDropdownOpen) setPayrollMasterExpanded(true);
  }, [payrollMasterDropdownOpen]);

  const topLevelNavItems = useMemo(() => visibleNavItems.filter((m) => !m.parentPath), [visibleNavItems]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Page access: redirect to dashboard if user has no view permission for current module
  const currentModule = APP_MODULES.find((m) => m.path === location.pathname);
  const allowed = !currentModule
    ? true
    : currentModule.visibility === 'super_admin_only'
      ? isSuperAdmin
      : currentModule.visibility === 'module_permission_only'
        ? isSuperAdmin || hasView('permissions')
        : hasView(currentModule.resource);

  useEffect(() => {
    if (currentModule && !allowed) {
      navigate('/dashboard', { replace: true });
    }
  }, [currentModule, allowed, navigate]);

  const content = currentModule && !allowed ? null : children;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-100">
      <aside className="w-64 flex-shrink-0 bg-white text-gray-900 flex flex-col overflow-hidden border-r border-gray-200 shadow-sm">
        <div className="p-6 flex items-center justify-center">
          <span className="text-2xl font-bold tracking-tight text-black">HRMS</span>
        </div>

        <nav className="flex-1 py-4 px-4 space-y-2 overflow-y-auto">
          {topLevelNavItems.map((mod) => {
            const isActive = location.pathname === mod.path;
            const icon = ICONS_BY_PATH[mod.path];
            const childItems = visibleNavItems.filter((m) => m.parentPath === mod.path);
            const isParentWithChildren = childItems.length > 0;
            const isPayrollMaster = mod.path === '/payroll-master';
            const expanded = isPayrollMaster ? payrollMasterExpanded : false;
            const setExpanded = isPayrollMaster ? setPayrollMasterExpanded : () => {};
            const dropdownOpen = isPayrollMaster ? payrollMasterDropdownOpen : false;

            if (isParentWithChildren) {
              return (
                <div key={mod.path} className="space-y-1">
                  <div
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${
                      isActive || dropdownOpen
                        ? 'bg-gray-100 text-black shadow-sm'
                        : 'text-gray-900 hover:bg-gray-100 hover:text-black'
                    }`}
                    onClick={() => setExpanded((e: boolean) => !e)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setExpanded((x: boolean) => !x);
                      }
                    }}
                  >
                    {icon ?? null}
                    <span className="flex-1">{mod.label}</span>
                    <svg
                      className={`w-5 h-5 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  {expanded && (
                    <div className="pl-4 space-y-1 border-l-2 border-gray-200 ml-4">
                      {childItems.map((child) => {
                        const childActive = location.pathname === child.path;
                        const childIcon = ICONS_BY_PATH[child.path];
                        return (
                          <Link
                            key={child.path}
                            to={child.path}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                              childActive
                                ? 'bg-gray-100 text-black'
                                : 'text-gray-700 hover:bg-gray-100 hover:text-black'
                            }`}
                          >
                            {childIcon ?? null}
                            <span>{child.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={mod.path}
                to={mod.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-gray-100 text-black shadow-sm'
                    : 'text-gray-900 hover:bg-gray-100 hover:text-black'
                }`}
              >
                {icon ?? null}
                <span>{mod.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-4 pb-6 space-y-2 border-t border-gray-200 pt-4 mt-auto">
          {bottomNavItems.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-gray-100 text-black shadow-sm'
                    : 'text-gray-900 hover:bg-gray-100 hover:text-black'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            );
          })}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 text-gray-900 hover:bg-gray-100 hover:text-black"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-auto">
        {content}
      </div>
    </div>
  );
}
