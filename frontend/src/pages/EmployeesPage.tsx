import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useEmployeeStore } from '../store/employeeStore';
import { useAuthStore } from '../store/authStore';
import { usePositionStore } from '../store/positionStore';
import { Employee } from '../services/employee.service';
import employeeService from '../services/employee.service';
import api from '../services/api';
import * as XLSX from 'xlsx';
import Modal from '../components/common/Modal';
import { FaceCapture } from '../components/employees/FaceCapture';
import AppHeader from '../components/layout/AppHeader';
import { canEditEmployeeByPermission } from '../utils/rbac';
import { getModulePermissions } from '../config/configurator-module-mapping';
import { toDisplayEmail, toDisplayFullName, toDisplayName, toDisplayValue } from '../utils/display';
import permissionService from '../services/permission.service';
import organizationService, { type Organization } from '../services/organization.service';
import paygroupService from '../services/paygroup.service';
import entityService from '../services/entity.service';
import { useDepartmentStore } from '../store/departmentStore';
import configuratorDataService, { ConfigCostCentre, ConfigDepartment, ConfigSubDepartment } from '../services/configurator-data.service';

function getAvatarColor(name: string): string {
  const colors = ['bg-blue-500', 'bg-blue-500', 'bg-orange-500', 'bg-purple-500', 'bg-blue-500', 'bg-indigo-500'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

type EmployeeImportFailure = {
  row: number;
  message: string;
  email?: string;
  associateCode?: string;
};

export default function EmployeesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const { user, loadUser, logout } = useAuthStore();
  const { employees, pagination, loading, error, fetchEmployees, deleteEmployee } = useEmployeeStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ACTIVE');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [costCentreFilter, setCostCentreFilter] = useState<string>('ALL');
  const [subDepartmentFilter, setSubDepartmentFilter] = useState<string>('ALL');
  // Configurator dropdown data
  const [configCostCentres, setConfigCostCentres] = useState<ConfigCostCentre[]>([]);
  const [configDepartments, setConfigDepartments] = useState<ConfigDepartment[]>([]);
  const [configSubDepartments, setConfigSubDepartments] = useState<ConfigSubDepartment[]>([]);
  const [_configUserRoles, setConfigUserRoles] = useState<{ role_id: number; name: string }[]>([]);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<'employeeCode' | 'firstName'>('firstName');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const { positions: _positions, fetchPositions } = usePositionStore();
  const { departments: _departments, fetchDepartments } = useDepartmentStore();
  const [_orgEntities, setOrgEntities] = useState<{ id: string; name: string; code?: string | null }[]>([]);
  const [_orgPaygroups, setOrgPaygroups] = useState<{ id: string; name: string; code?: string | null }[]>([]);
  const [loadingEmployee, setLoadingEmployee] = useState(false);
  // View modal state for Configurator users (fallback when no HRMS record)
  const [viewingUser, setViewingUser] = useState<any | null>(null);
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
  const [updateFaceModal, setUpdateFaceModal] = useState<Employee | null>(null);
  const [updateFaceEncoding, setUpdateFaceEncoding] = useState<number[] | null>(null);
  const [updateFaceError, setUpdateFaceError] = useState('');
  const [updateFaceSaving, setUpdateFaceSaving] = useState(false);
  const [viewType, setViewType] = useState<'list' | 'grid'>('list');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importingEmployees, setImportingEmployees] = useState(false);
  const [importResult, setImportResult] = useState<{ total: number; success: number; updated: number; skipped: number; failed?: number; failures: EmployeeImportFailure[]; managersSet?: number; configuratorResults?: { total: number; created: number; updated: number; failed: number }; configuratorSyncStatus?: 'success' | 'failed' | 'skipped'; configuratorSyncMessage?: string } | null>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [userPermissions, setUserPermissions] = useState<{ resource: string; action: string }[]>([]);
  // Super Admin: list of all orgs and selected org for Employee Directory
  const [superAdminOrganizations, setSuperAdminOrganizations] = useState<Organization[]>([]);
  const superAdminOrganizationsRef = useRef<Organization[]>([]);
  const [superAdminSelectedOrgId, setSuperAdminSelectedOrgId] = useState<string | 'ALL'>('ALL');
  const [_loadingOrgs, setLoadingOrgs] = useState(false);
  // View Credentials page filters
  const [credOrgFilter, setCredOrgFilter] = useState<string>('ALL');
  const [credDesignationFilter, setCredDesignationFilter] = useState<string>('ALL');
  const [credStatusFilter, setCredStatusFilter] = useState<string>('ALL');
  const [credSearchTerm, setCredSearchTerm] = useState('');
  const [statsActiveCount, setStatsActiveCount] = useState<number | null>(null);
  const [statsInactiveCount, setStatsInactiveCount] = useState<number | null>(null);

  // Fetch current user's permissions (for permission-based edit/view per tab)
  useEffect(() => {
    if (!user) {
      setUserPermissions([]);
      return;
    }
    permissionService.getUserPermissions().then((list) => {
      setUserPermissions(list.map((p) => ({ resource: p.resource, action: p.action })));
    }).catch(() => setUserPermissions([]));
  }, [user?.id]);

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

  // Get organizationId from logged-in user (check both possible shapes, fallback to user-level organizationId)
  const organizationId =
    user?.employee?.organizationId ||
    user?.employee?.organization?.id ||
    (user as any)?.organizationId;

  // Super Admin: can view all orgs or pick one; others use their linked org
  const orgPerms = getModulePermissions('/organizations');
  const isSuperAdmin = orgPerms.can_edit;
  const effectiveOrganizationId = isSuperAdmin
    ? (superAdminSelectedOrgId === 'ALL' ? undefined : superAdminSelectedOrgId)
    : organizationId;
  const effectiveOrganizationName = isSuperAdmin
    ? (superAdminSelectedOrgId === 'ALL' ? 'All organizations' : superAdminOrganizations.find((o) => o.id === superAdminSelectedOrgId)?.name ?? '—')
    : user?.employee?.organization?.name;

  // Try to load user data if organizationId is missing (only once, best-effort)
  useEffect(() => {
    if (!organizationId && user && !loadingUser && !loadUserAttempted) {
      setLoadingUser(true);
      setLoadUserAttempted(true);

      const timeoutId = setTimeout(() => {
        setLoadingUser(false);
      }, 10000);

      loadUser()
        .catch(() => {})
        .finally(() => {
          clearTimeout(timeoutId);
          setLoadingUser(false);
        });
    }
  }, [organizationId, user, loadUser]);

  // Module permissions from /api/v1/user-role-modules/project API response
  const modulePerms = getModulePermissions('/employees');
  const canCreate = modulePerms.can_add;
  const canUpdateByRole = modulePerms.can_edit;
  const canUpdateByPermission = canEditEmployeeByPermission(userPermissions);
  const canUpdate = canUpdateByRole || canUpdateByPermission;
  const canDelete = modulePerms.can_delete;
  const canManageCredentials = modulePerms.can_view;

  // View Credentials: filtered list by Organization, Designation, Status, Search
  const filteredCredentials = useMemo(() => {
    if (!credentials.length) return [];
    let list = credentials;
    const orgName = (c: any) => (c.organizationName ?? '') as string;
    const search = credSearchTerm.trim().toLowerCase();
    if (search) {
      list = list.filter(
        (c) =>
          (c.name ?? '').toLowerCase().includes(search) ||
          (c.email ?? '').toLowerCase().includes(search) ||
          (c.employeeCode ?? '').toLowerCase().includes(search)
      );
    }
    if (credOrgFilter !== 'ALL') {
      list = list.filter((c) => orgName(c) === credOrgFilter);
    }
    if (credDesignationFilter !== 'ALL') {
      list = list.filter((c) => (c.position ?? '') === credDesignationFilter);
    }
    if (credStatusFilter !== 'ALL') {
      list = list.filter((c) => (c.employeeStatus ?? '') === credStatusFilter);
    }
    return list;
  }, [credentials, credOrgFilter, credDesignationFilter, credStatusFilter, credSearchTerm]);

  // Super Admin: fetch all organizations on mount, auto-select user's own org
  useEffect(() => {
    if (!isSuperAdmin) return;
    setLoadingOrgs(true);
    organizationService.getAll(1, 100).then((res) => {
      const orgs = res.organizations ?? [];
      setSuperAdminOrganizations(orgs);
      superAdminOrganizationsRef.current = orgs;
      // Auto-select the user's own organization so Add Employee is immediately available
      const userOrgId = organizationId; // from user.employee.organizationId or .organization.id
      if (userOrgId && orgs.some((o) => o.id === userOrgId)) {
        setSuperAdminSelectedOrgId(userOrgId);
      } else if (orgs.length > 0) {
        setSuperAdminSelectedOrgId(orgs[0].id);
      }
    }).catch(() => { setSuperAdminOrganizations([]); superAdminOrganizationsRef.current = []; }).finally(() => setLoadingOrgs(false));
  }, [isSuperAdmin, organizationId]);

  useEffect(() => {
    if (effectiveOrganizationId) {
      fetchPositions({ organizationId: effectiveOrganizationId });
      fetchDepartments(effectiveOrganizationId);
      entityService.getByOrganization(effectiveOrganizationId).then(setOrgEntities).catch(() => setOrgEntities([]));
      paygroupService.getAll({ organizationId: effectiveOrganizationId }).then((list) => setOrgPaygroups(list || [])).catch(() => setOrgPaygroups([]));
    } else {
      setOrgEntities([]);
      setOrgPaygroups([]);
    }
  }, [effectiveOrganizationId, fetchPositions, fetchDepartments]);

  // Debounce search term to avoid firing API on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch Configurator dropdown data (cost centres, departments, sub-departments) on mount
  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      configuratorDataService.getCostCentres(),
      configuratorDataService.getDepartments(),
      configuratorDataService.getSubDepartments(),
      configuratorDataService.getUserRoles(),
    ]).then(([ccResult, deptResult, subDeptResult, rolesResult]) => {
      if (cancelled) return;
      setConfigCostCentres(ccResult.status === 'fulfilled' ? ccResult.value : []);
      setConfigDepartments(deptResult.status === 'fulfilled' ? deptResult.value : []);
      setConfigSubDepartments(subDeptResult.status === 'fulfilled' ? subDeptResult.value : []);
      setConfigUserRoles(
        rolesResult.status === 'fulfilled'
          ? rolesResult.value.map((r) => ({ role_id: r.role_id, name: r.name }))
          : []
      );
    });
    return () => { cancelled = true; };
  }, []);

  // Fetch employee list from Configurator API: POST /api/v1/users/list
  // Uses company_id + project_id from localStorage (set at login).
  // Server-side filters: cost_centre_id, department_id, sub_department_id
  // Client-side filters: search, employeeStatus (is_active)
  useEffect(() => {
    if (location.pathname !== '/employees') return;
    const params: any = {
      page: currentPage,
      limit: pageSize,
    };
    if (debouncedSearchTerm) params.search = debouncedSearchTerm;
    params.employeeStatus = statusFilter;
    // Configurator API filters (numeric IDs)
    if (costCentreFilter !== 'ALL') params.costCentreId = costCentreFilter;
    if (departmentFilter !== 'ALL') params.departmentId = departmentFilter;
    if (subDepartmentFilter !== 'ALL') params.subDepartmentId = subDepartmentFilter;
    if (user?.email) params.excludeEmail = user.email;
    fetchEmployees(params);
  }, [location.pathname, currentPage, pageSize, debouncedSearchTerm, statusFilter, costCentreFilter, departmentFilter, subDepartmentFilter, fetchEmployees, user?.email]);

  // When viewing ALL status, fetch active count for accurate dashboard stats
  useEffect(() => {
    if (statusFilter !== 'ALL' || !effectiveOrganizationId || location.pathname !== '/employees') {
      setStatsActiveCount(null);
      return;
    }
    let cancelled = false;
    employeeService
      .getAll({ organizationId: effectiveOrganizationId, employeeStatus: 'ACTIVE', page: 1, limit: 1 })
      .then((r) => {
        if (!cancelled) setStatsActiveCount(r.pagination?.total ?? 0);
      })
      .catch(() => { if (!cancelled) setStatsActiveCount(null); });
    return () => { cancelled = true; };
  }, [statusFilter, effectiveOrganizationId, location.pathname]);

  // Fetch inactive user count from Configurator API on mount
  useEffect(() => {
    if (location.pathname !== '/employees') return;
    let cancelled = false;
    configuratorDataService.listInactiveUsers()
      .then((list) => { if (!cancelled) setStatsInactiveCount(list.length); })
      .catch(() => { if (!cancelled) setStatsInactiveCount(null); });
    return () => { cancelled = true; };
  }, [location.pathname]);

  // Open employee edit/rejoin form when navigated with editEmployeeId or rejoinEmployeeId
  useEffect(() => {
    const state = location.state as { editEmployeeId?: string; rejoinEmployeeId?: string } | null;
    const editId = state?.editEmployeeId;
    const rejoinId = state?.rejoinEmployeeId ?? searchParams.get('rejoin');
    const id = editId ?? rejoinId;
    if (location.pathname !== '/employees' || !id) return;
    let cancelled = false;
    setLoadingEmployee(true);
    employeeService
      .getById(id)
      .then((full) => {
        if (!cancelled) {
          const targetPath = rejoinId ? `/employees/edit/${id}` : `/employees/edit/${id}`;
          navigate(targetPath, {
            replace: true,
            state: {
              employee: full,
              mode: 'edit' as const,
              rejoinMode: !!rejoinId,
            },
          });
        }
      })
      .catch(() => {
        if (!cancelled) alert(rejoinId ? 'Failed to load employee for rejoin' : 'Failed to load employee details');
        navigate(location.pathname, { replace: true, state: {} });
      })
      .finally(() => {
        if (!cancelled) setLoadingEmployee(false);
      });
    return () => { cancelled = true; };
  }, [location.pathname, location.search, location.state, navigate]);

  const fetchCredentials = useCallback(async () => {
    try {
      setLoadingCredentials(true);
      // Super Admin: pass selected org when viewing credentials; others use backend default
      const orgId = isSuperAdmin && effectiveOrganizationId ? effectiveOrganizationId : undefined;
      const data = await employeeService.getCredentials(orgId);
      setCredentials(data);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      console.error('Failed to fetch credentials:', error);
      alert(error.response?.data?.message || 'Failed to fetch employee credentials');
    } finally {
      setLoadingCredentials(false);
    }
  }, [isSuperAdmin, effectiveOrganizationId]);

  useEffect(() => {
    if (showCredentials && canManageCredentials && credentials.length === 0 && !loadingCredentials) {
      fetchCredentials();
    }
  }, [showCredentials, canManageCredentials, credentials.length, loadingCredentials, fetchCredentials]);

  const handleDelete = async (id: string | number) => {
    if (window.confirm('Are you sure you want to delete this employee? This action will deactivate the employee record.')) {
      try {
        await deleteEmployee(id);
        alert('Employee deleted successfully');
        // Re-fetch the list
        const params: any = { page: currentPage, limit: pageSize, employeeStatus: statusFilter };
        if (searchTerm) params.search = searchTerm;
        if (costCentreFilter !== 'ALL') params.costCentreId = costCentreFilter;
        if (departmentFilter !== 'ALL') params.departmentId = departmentFilter;
        if (subDepartmentFilter !== 'ALL') params.subDepartmentId = subDepartmentFilter;
        fetchEmployees(params);
      } catch (error: any) {
        alert(error.message || 'Failed to delete employee');
      }
    }
  };

  // ─── View: find HRMS employee by Configurator user_id, then open full EmployeeForm in view mode ───
  const handleViewUser = async (user: any) => {
    try {
      setLoadingEmployee(true);
      const configUserId = user.user_id || user.id;

      // Try to find HRMS employee by configuratorUserId (bypasses RBAC list filter)
      let hrmsEmployee = null;
      if (configUserId && typeof configUserId === 'number') {
        hrmsEmployee = await employeeService.getByConfiguratorUserId(configUserId);
      }
      if (!hrmsEmployee && user.email) {
        hrmsEmployee = await employeeService.getByEmail(user.email);
      }

      if (!hrmsEmployee) {
        const details = await configuratorDataService.getConfiguratorUser(configUserId);
        setViewingUser({ ...user, ...details });
        return;
      }

      const configFields = buildConfigFields(user);
      const emp = hrmsEmployee as any;
      if (!emp.configuratorUserId) emp.configuratorUserId = configFields.configuratorUserId;
      if (!emp.costCentreConfiguratorId && configFields.costCentreConfiguratorId) emp.costCentreConfiguratorId = configFields.costCentreConfiguratorId;
      if (!emp.departmentConfiguratorId && configFields.departmentConfiguratorId) emp.departmentConfiguratorId = configFields.departmentConfiguratorId;
      if (!emp.subDepartmentConfiguratorId && configFields.subDepartmentConfiguratorId) emp.subDepartmentConfiguratorId = configFields.subDepartmentConfiguratorId;
      if (!emp.configuratorRoleId && configFields.configuratorRoleId) emp.configuratorRoleId = configFields.configuratorRoleId;

      navigate(`/employees/view/${hrmsEmployee.id}`, {
        state: {
          employee: hrmsEmployee,
          mode: 'view' as const,
        },
      });
    } catch (err: any) {
      console.error('Failed to load user details', err);
      setViewingUser(user);
    } finally {
      setLoadingEmployee(false);
    }
  };

  // ─── Edit: find HRMS employee by email, then open full EmployeeForm ───
  /** Build Configurator fields from the /api/v1/users/list row */
  const buildConfigFields = (user: any) => ({
    configuratorUserId: user.user_id || user.id,
    costCentreConfiguratorId: user.cost_centre?.id ?? user.cost_centre_id ?? null,
    departmentConfiguratorId: user.department?.id ?? user.department_id ?? null,
    subDepartmentConfiguratorId: user.sub_department?.id ?? user.sub_department_id ?? null,
    configuratorRoleId: user.role_id ?? user.project_role?.id ?? null,
    // Keep names for display fallback
    costCentre: user.cost_centre ? { id: '', name: user.cost_centre.name, code: user.cost_centre.code } : undefined,
    department: user.department ? { id: '', name: user.department.name, code: user.department.code } : undefined,
    sub_department: user.sub_department ? { id: 0, name: user.sub_department.name } : undefined,
  });

  const handleEditUser = async (user: any) => {
    try {
      setLoadingEmployee(true);
      const configFields = buildConfigFields(user);

      // Try configuratorUserId first (bypasses RBAC), then email fallback
      let hrmsEmployee = null;
      const configUserId = user.user_id || user.id;
      if (configUserId && typeof configUserId === 'number') {
        hrmsEmployee = await employeeService.getByConfiguratorUserId(configUserId);
      }
      if (!hrmsEmployee && user.email) {
        hrmsEmployee = await employeeService.getByEmail(user.email);
      }

      if (!hrmsEmployee) {
        // No HRMS record — open edit form prefilled with Configurator data (will create on save)
        const _fallbackFullName = user.full_name || user.name || user.fullname || '';
        const fallback: any = {
          firstName: user.first_name || _fallbackFullName.split(' ')[0] || '',
          lastName: user.last_name || _fallbackFullName.split(' ').slice(1).join(' ') || '',
          email: user.email,
          phone: user.phone || '',
          employeeCode: user.code || user.employee_code || '',
          ...configFields,
        };
        navigate('/employees/edit/new', {
          state: {
            employee: fallback,
            organizationId: effectiveOrganizationId || '',
            mode: 'edit' as const,
          },
        });
        return;
      }
      // Use data from getByConfiguratorUserId/getByEmail (already full).
      // Merge Configurator fields that may be missing in HRMS record.
      const emp = hrmsEmployee as any;
      if (!emp.configuratorUserId) emp.configuratorUserId = configFields.configuratorUserId;
      if (!emp.costCentreConfiguratorId && configFields.costCentreConfiguratorId) emp.costCentreConfiguratorId = configFields.costCentreConfiguratorId;
      if (!emp.departmentConfiguratorId && configFields.departmentConfiguratorId) emp.departmentConfiguratorId = configFields.departmentConfiguratorId;
      if (!emp.subDepartmentConfiguratorId && configFields.subDepartmentConfiguratorId) emp.subDepartmentConfiguratorId = configFields.subDepartmentConfiguratorId;
      if (!emp.configuratorRoleId && configFields.configuratorRoleId) emp.configuratorRoleId = configFields.configuratorRoleId;
      if (!emp.costCentre && configFields.costCentre) emp.costCentre = configFields.costCentre;
      if (!emp.department && configFields.department) emp.department = configFields.department;
      if (!emp.sub_department && !emp.subDepartment && configFields.sub_department) {
        emp.sub_department = configFields.sub_department;
        emp.subDepartment = configFields.sub_department.name;
      }

      navigate(`/employees/edit/${emp.id}`, {
        state: {
          employee: emp,
          mode: 'edit' as const,
        },
      });
    } catch (err: any) {
      console.error('Failed to load employee for edit', err);
      // Fallback — open edit form prefilled with Configurator data (will create on save)
      const configFields = buildConfigFields(user);
      const _catchFullName = user.full_name || user.name || user.fullname || '';
      const fallback: any = {
        firstName: user.first_name || _catchFullName.split(' ')[0] || '',
        lastName: user.last_name || _catchFullName.split(' ').slice(1).join(' ') || '',
        email: user.email,
        phone: user.phone || '',
        employeeCode: user.code || user.employee_code || '',
        ...configFields,
      };
      navigate('/employees/edit/new', {
        state: {
          employee: fallback,
          organizationId: effectiveOrganizationId || '',
          mode: 'edit' as const,
        },
      });
    } finally {
      setLoadingEmployee(false);
    }
  };



  const handleCreate = async () => {
    let resolvedOrgId: string | undefined = effectiveOrganizationId;

    if (isSuperAdmin && !resolvedOrgId) {
      let orgs: Organization[] =
        superAdminOrganizationsRef.current.length > 0
          ? superAdminOrganizationsRef.current
          : superAdminOrganizations.length > 0
          ? superAdminOrganizations
          : [];

      if (orgs.length === 0) {
        try {
          const res = await organizationService.getAll(1, 100);
          orgs = res.organizations ?? [];
          setSuperAdminOrganizations(orgs);
          superAdminOrganizationsRef.current = orgs;
        } catch {
          orgs = [];
        }
      }

      if (orgs.length > 0) {
        const latestUser = useAuthStore.getState().user;
        const userOrgId =
          latestUser?.employee?.organizationId ||
          latestUser?.employee?.organization?.id ||
          (latestUser as any)?.organizationId ||
          organizationId;
        const ownOrg = userOrgId ? orgs.find((o) => o.id === userOrgId) : undefined;
        resolvedOrgId = (ownOrg ?? orgs[0]).id;
        setSuperAdminSelectedOrgId(resolvedOrgId);
      }
    } else if (!resolvedOrgId && !isSuperAdmin) {
      try {
        await loadUser();
        const refreshedUser = useAuthStore.getState().user;
        resolvedOrgId =
          refreshedUser?.employee?.organizationId ||
          refreshedUser?.employee?.organization?.id ||
          (refreshedUser as any)?.organizationId;
      } catch {
        // ignore
      }
    }

    if (!resolvedOrgId) {
      alert('Could not determine organization. Please select an organization from the dropdown and try again.');
      return;
    }

    navigate('/employees/create', {
      state: {
        organizationId: resolvedOrgId,
      },
    });
  };

  const handleUpdateFaceClose = () => {
    setUpdateFaceModal(null);
    setUpdateFaceEncoding(null);
    setUpdateFaceError('');
  };

  const handleUpdateFaceSave = async () => {
    if (!updateFaceModal || !updateFaceEncoding || updateFaceEncoding.length !== 128) return;
    setUpdateFaceSaving(true);
    setUpdateFaceError('');
    try {
      await employeeService.update(updateFaceModal.id, { faceEncoding: updateFaceEncoding });
      alert(`Face updated for ${updateFaceModal.firstName} ${updateFaceModal.lastName}.`);
      handleUpdateFaceClose();
      const params: any = { page: currentPage, limit: pageSize, employeeStatus: statusFilter };
      if (searchTerm) params.search = searchTerm;
      if (costCentreFilter !== 'ALL') params.costCentreId = costCentreFilter;
      if (departmentFilter !== 'ALL') params.departmentId = departmentFilter;
      if (subDepartmentFilter !== 'ALL') params.subDepartmentId = subDepartmentFilter;
      fetchEmployees(params);
    } catch (err: any) {
      setUpdateFaceError(err.response?.data?.message || err.message || 'Failed to update face');
    } finally {
      setUpdateFaceSaving(false);
    }
  };

  const handleRemoveFace = async () => {
    if (!updateFaceModal || !confirm(`Remove saved face for ${updateFaceModal.firstName} ${updateFaceModal.lastName}? You can capture again after this.`)) return;
    setUpdateFaceSaving(true);
    setUpdateFaceError('');
    try {
      await employeeService.update(updateFaceModal.id, { faceEncoding: null });
      setUpdateFaceModal((prev) => (prev ? { ...prev, faceEncoding: undefined } : null));
      setUpdateFaceEncoding(null);
      setUpdateFaceError('');
      alert('Face removed. You can capture again now.');
      const params: any = { page: currentPage, limit: pageSize, employeeStatus: statusFilter };
      if (searchTerm) params.search = searchTerm;
      if (costCentreFilter !== 'ALL') params.costCentreId = costCentreFilter;
      if (departmentFilter !== 'ALL') params.departmentId = departmentFilter;
      if (subDepartmentFilter !== 'ALL') params.subDepartmentId = subDepartmentFilter;
      fetchEmployees(params);
    } catch (err: any) {
      setUpdateFaceError(err.response?.data?.message || err.message || 'Failed to remove face');
    } finally {
      setUpdateFaceSaving(false);
    }
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

  const handleExportExcel = () => {
    setShowExportMenu(false);
    if (!employees || employees.length === 0) {
      alert('No employees to export.');
      return;
    }
    const headers = ['EMP ID', 'Name', 'Email', 'Phone', 'Role', 'Cost Centre', 'Department', 'Sub Department'];
    const rows = employees.map((emp: any) => [
      emp.code || emp.user_id || '',
      emp.full_name || '',
      emp.email || '',
      emp.phone || '',
      emp.project_role?.name || '',
      emp.cost_centre?.name || '',
      emp.department?.name || '',
      emp.sub_department?.name || '',
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
        (emp: any) =>
          `<tr>
            <td>${emp.code || emp.user_id || ''}</td>
            <td>${emp.full_name || ''}</td>
            <td>${emp.email || ''}</td>
            <td>${emp.phone || ''}</td>
            <td>${emp.project_role?.name || ''}</td>
            <td>${emp.cost_centre?.name || ''}</td>
            <td>${emp.department?.name || ''}</td>
            <td>${emp.sub_department?.name || ''}</td>
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
                <th>Role</th>
                <th>Cost Centre</th>
                <th>Department</th>
                <th>Sub Department</th>
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

  const handleImportEmployees = async () => {
    if (!importFile) {
      alert('Please choose an Excel file first.');
      return;
    }
    if (!effectiveOrganizationId) {
      alert('Please select an organization before importing employees.');
      return;
    }

    setImportingEmployees(true);
    setImportResult(null);
    try {
      // Use bulk import API — send Excel file directly to backend
      const result = await employeeService.bulkImport(importFile, effectiveOrganizationId, {
        createSalaryRecords: true,
        skipConfiguratorSync: false,
      });

      setImportResult({
        total: result.total,
        success: result.success,
        updated: result.updated,
        skipped: result.skipped,
        failed: result.failed,
        managersSet: result.managersSet,
        failures: result.failures.map((f) => ({
          row: f.row,
          email: f.email,
          associateCode: f.associateCode,
          message: f.message,
        })),
        configuratorResults: result.configuratorResults,
        configuratorSyncStatus: result.configuratorSyncStatus,
        configuratorSyncMessage: result.configuratorSyncMessage,
      });

      const params: any = { page: currentPage, limit: pageSize, employeeStatus: statusFilter };
      if (searchTerm) params.search = searchTerm;
      if (costCentreFilter !== 'ALL') params.costCentreId = costCentreFilter;
      if (departmentFilter !== 'ALL') params.departmentId = departmentFilter;
      if (subDepartmentFilter !== 'ALL') params.subDepartmentId = subDepartmentFilter;
      await fetchEmployees(params);

    } catch (err: any) {
      console.error('[EmployeesPage] Import error:', err?.response?.status, err?.response?.data, err?.message);
      const msg = err?.response?.data?.message || err?.message || 'Import failed';
      const statusCode = err?.response?.status;
      const isNetwork = !err?.response && (err?.code === 'ECONNREFUSED' || err?.message?.includes('Network'));
      if (isNetwork) {
        alert('Cannot connect to server. Please ensure the backend is running (npm run dev from project root).');
      } else {
        // Show validation/server errors in the import result area
        const lines = msg.split('\n').filter((l: string) => l.trim());
        // If it's a server error (500), show the actual error message
        if (statusCode >= 500) {
          lines.unshift(`Server Error (${statusCode}): ${msg}`);
        }
        setImportResult({
          total: 0,
          success: 0,
          updated: 0,
          skipped: 0,
          failed: lines.length,
          failures: lines.map((line: string, idx: number) => {
            const rowMatch = line.match(/^Row\s+(\d+):/);
            return {
              row: rowMatch ? parseInt(rowMatch[1], 10) : idx + 1,
              message: line,
            };
          }),
        });
      }
    } finally {
      setImportingEmployees(false);
    }
  };

  const handleDownloadImportTemplate = async () => {
    // Try downloading from Configurator API first; fall back to client-side template
    try {
      const blob = await employeeService.downloadImportTemplate();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `employee_import_template_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      return;
    } catch {
      // Configurator template not available — generate locally
    }

    const COLUMNS = [
      'S.No', 'Paygroup', 'Associate Code', 'Associate Name', 'Gender', 'Department', 'Designation', 'Father Name', 'Blood Group',
      'Date of Birth', 'Date of Joining', 'Cost Centre', 'Pan Card Number', 'Bank Name', 'Account No', 'Bank IFSC Code',
      'Permanent E-Mail Id', 'Official E-Mail Id', 'Permanent Address', 'Permanent City', 'Permanent State', 'Permanent Pincode', 'Permanent Phone',
      'Current Address', 'Current City', 'Current State', 'Current Pincode', 'Current Phone',
      'Place of Tax Deduction', 'PF Number', 'ESI Number', 'Location', 'ESI Location', 'Ptax Location', 'Marital Status',
      'Reporting Manager', 'Associate Notice Period Days', 'LWF Location', 'Permanent District', 'Current District', 'Permanent mobile',
      'UAN Number', 'Adhaar Number', 'Tax Regime', 'Sub Department', 'Alternate Saturday Off', 'Compoff Applicable', 'Fixed Gross', 'Vehicle Allowances',
    ];
    const templateRows = [
      { 'S.No': 1, 'Paygroup': 'Monthly', 'Associate Code': 'BNC1001', 'Associate Name': 'Murali Krishna', 'Gender': 'M', 'Department': 'HR', 'Designation': 'Manager', 'Father Name': 'XYZ', 'Blood Group': 'O+', 'Date of Birth': '1/1/1990', 'Date of Joining': '1/1/2024', 'Cost Centre': 'CC001', 'Pan Card Number': 'ABCDE1234F', 'Bank Name': 'HDFC Bank', 'Account No': '1234567890123456', 'Bank IFSC Code': 'HDFC0001234', 'Permanent E-Mail Id': 'murali.krishna@example.com', 'Official E-Mail Id': 'murali@bncmotors.com', 'Permanent Address': 'NO 123, 1st Street, ABC Nagar', 'Permanent City': 'Chennai', 'Permanent State': 'Tamil Nadu', 'Permanent Pincode': '600001', 'Permanent Phone': '9876543210', 'Current Address': 'NO 123, 1st Street, ABC Nagar', 'Current City': 'Chennai', 'Current State': 'Tamil Nadu', 'Current Pincode': '600001', 'Current Phone': '9876543210', 'Place of Tax Deduction': 'METRO', 'PF Number': 'TN/CHN/1234567', 'ESI Number': '31-12345-67-890', 'Location': 'Chennai', 'ESI Location': 'Chennai', 'Ptax Location': 'Chennai', 'Marital Status': 'Single', 'Reporting Manager': '', 'Associate Notice Period Days': '30', 'LWF Location': 'Chennai', 'Permanent District': 'Chennai', 'Current District': 'Chennai', 'Permanent mobile': '9876543210', 'UAN Number': '101234567890', 'Adhaar Number': '123456789012', 'Tax Regime': 'New', 'Sub Department': 'Recruitment', 'Alternate Saturday Off': 'Yes', 'Compoff Applicable': 'Yes', 'Fixed Gross': '50000', 'Vehicle Allowances': '5000' },
      { 'S.No': 2, 'Paygroup': 'Monthly', 'Associate Code': 'BNC1002', 'Associate Name': 'Kaviya Shree', 'Gender': 'F', 'Department': 'Finance & Accounts', 'Designation': 'Executive', 'Father Name': 'ABC', 'Blood Group': 'A+', 'Date of Birth': '15/5/1992', 'Date of Joining': '1/2/2024', 'Cost Centre': 'CC002', 'Pan Card Number': 'FGHIJ5678K', 'Bank Name': 'ICICI Bank', 'Account No': '9876543210987654', 'Bank IFSC Code': 'ICIC0000987', 'Permanent E-Mail Id': 'kaviya.shree@example.com', 'Official E-Mail Id': 'kaviya@bncmotors.com', 'Permanent Address': 'NO 456, 2nd Street, XYZ Nagar', 'Permanent City': 'Chennai', 'Permanent State': 'Tamil Nadu', 'Permanent Pincode': '600002', 'Permanent Phone': '9123456780', 'Current Address': 'NO 456, 2nd Street, XYZ Nagar', 'Current City': 'Chennai', 'Current State': 'Tamil Nadu', 'Current Pincode': '600002', 'Current Phone': '9123456780', 'Place of Tax Deduction': 'METRO', 'PF Number': 'TN/CHN/7654321', 'ESI Number': '31-98765-43-210', 'Location': 'Chennai', 'ESI Location': 'Chennai', 'Ptax Location': 'Chennai', 'Marital Status': 'Married', 'Reporting Manager': 'Murali Krishna', 'Associate Notice Period Days': '30', 'LWF Location': 'Chennai', 'Permanent District': 'Chennai', 'Current District': 'Chennai', 'Permanent mobile': '9123456780', 'UAN Number': '101987654321', 'Adhaar Number': '987654321098', 'Tax Regime': 'Old', 'Sub Department': 'Accounts', 'Alternate Saturday Off': 'No', 'Compoff Applicable': 'Yes', 'Fixed Gross': '45000', 'Vehicle Allowances': '0' },
    ];
    const orderedRows = templateRows.map((row: Record<string, unknown>) => {
      const ordered: Record<string, string | number> = {};
      COLUMNS.forEach((col) => { ordered[col] = (row[col] as string | number) ?? ''; });
      return ordered;
    });
    const worksheet = XLSX.utils.json_to_sheet(orderedRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Employees');
    XLSX.writeFile(workbook, `employee_import_template_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Show loading spinner while user data is being fetched (best-effort, non-blocking)
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
        subtitle={effectiveOrganizationName || undefined}
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
            {canManageCredentials && (
              <button
                onClick={() => { setShowCredentials(!showCredentials); if (!showCredentials) fetchCredentials(); }}
                className="h-9 px-4 py-2 rounded-lg bg-white text-black font-medium text-sm border border-gray-300 hover:bg-gray-50 transition"
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
            {canCreate && (
              <button
                onClick={() => navigate('/employees/import')}
                disabled={isSuperAdmin && superAdminSelectedOrgId === 'ALL'}
                title={isSuperAdmin && superAdminSelectedOrgId === 'ALL' ? 'Select an organization to import employees' : undefined}
                className="h-9 px-4 py-2 rounded-lg bg-white text-gray-700 font-medium text-sm border border-gray-300 hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Import Excel
              </button>
            )}
          </div>
        </div>

      {/* Employee Credentials View */}
      {showCredentials && canManageCredentials && (
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900">Employee Credentials</h2>
            <p className="text-gray-600 mt-1">View and manage employee login credentials</p>
          </div>

          {/* Credentials filters */}
          {!loadingCredentials && (
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-500 mb-1.5">Organization</label>
                  <select
                    value={credOrgFilter}
                    onChange={(e) => setCredOrgFilter(e.target.value)}
                    className="h-10 w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="ALL">All Organizations</option>
                    {[
                      ...new Set(
                        credentials.map((c: any) => c.organizationName).filter(Boolean)
                      ),
                    ].sort().map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-500 mb-1.5">Designation</label>
                  <select
                    value={credDesignationFilter}
                    onChange={(e) => setCredDesignationFilter(e.target.value)}
                    className="h-10 w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="ALL">All Designations</option>
                    {[
                      ...new Set(
                        credentials.map((c: any) => c.position).filter(Boolean)
                      ),
                    ].sort().map((title) => (
                      <option key={title} value={title}>{title}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-500 mb-1.5">Select Status</label>
                  <select
                    value={credStatusFilter}
                    onChange={(e) => setCredStatusFilter(e.target.value)}
                    className="h-10 w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                  <label className="text-sm font-medium text-gray-500 mb-1.5">Search</label>
                  <input
                    type="text"
                    placeholder="Search by name, email, EMP ID..."
                    value={credSearchTerm}
                    onChange={(e) => setCredSearchTerm(e.target.value)}
                    className="h-10 w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {loadingCredentials ? (
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-600">Loading credentials...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 table-fixed">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="w-[14%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Employee
                    </th>
                    <th className="w-[16%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    {isSuperAdmin && (
                      <th className="w-[12%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Organization
                      </th>
                    )}
                    <th className="w-[10%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="w-[12%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Department
                    </th>
                    <th className="w-[10%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="w-[14%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Password
                    </th>
                    <th className="w-[12%] px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredCredentials.length === 0 ? (
                    <tr>
                      <td colSpan={isSuperAdmin ? 8 : 7} className="px-4 py-8 text-center text-gray-500">
                        {credentials.length === 0 ? 'No employees found' : 'No credentials match the selected filters'}
                      </td>
                    </tr>
                  ) : (
                    filteredCredentials.map((cred) => {
                      const hasNewPassword = showNewPassword && resetPasswordModal?.employeeId === cred.id;
                      return (
                        <tr key={cred.id} className="hover:bg-gray-50">
                          <td className="w-[14%] px-4 py-4 whitespace-nowrap text-sm text-gray-900 min-w-0">
                            <div className="flex items-center min-w-0">
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-gray-900 truncate">{toDisplayFullName(cred.name)}</div>
                                <div className="text-sm text-gray-500 truncate">{cred.employeeCode}</div>
                              </div>
                            </div>
                          </td>
                          <td className="w-[16%] px-4 py-4 whitespace-nowrap text-sm text-gray-900 min-w-0 truncate">
                            {toDisplayEmail(cred.email)}
                          </td>
                          {isSuperAdmin && (
                            <td className="w-[12%] px-4 py-4 whitespace-nowrap text-sm text-gray-700 min-w-0 truncate">
                              {toDisplayValue((cred as { organizationName?: string }).organizationName)}
                            </td>
                          )}
                          <td className="w-[10%] px-4 py-4 whitespace-nowrap min-w-0">
                            <div className="flex items-center space-x-2">
                              <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 truncate max-w-full">
                                {cred.role}
                              </span>
                              {modulePerms.can_edit && (
                                <button
                                  onClick={() => {
                                    setRoleChangeModal({
                                      employeeId: cred.id,
                                      email: cred.email,
                                      name: cred.name,
                                      currentRole: cred.role,
                                    });
                                  }}
                                  className="text-blue-600 hover:text-blue-900 text-xs flex-shrink-0"
                                  title="Change role"
                                >
                                  ✏️
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="w-[12%] px-4 py-4 whitespace-nowrap text-sm text-gray-500 min-w-0 truncate">
                            {cred.department}
                          </td>
                          <td className="w-[10%] px-4 py-4 whitespace-nowrap min-w-0">
                            <span
                              className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                cred.employeeStatus === 'ACTIVE'
                                  ? 'bg-blue-100 text-blue-800'
                                  : cred.employeeStatus === 'ON_LEAVE'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {cred.employeeStatus}
                            </span>
                          </td>
                          <td className="w-[14%] px-4 py-4 whitespace-nowrap min-w-0">
                            {hasNewPassword ? (
                              <div className="flex items-center space-x-2 min-w-0">
                                <div className="flex-1 min-w-0 bg-blue-50 border border-blue-200 rounded px-2 py-1">
                                  <p className="text-xs font-mono font-bold text-blue-800 truncate">{showNewPassword}</p>
                                </div>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(showNewPassword || '');
                                    alert('Password copied!');
                                  }}
                                  className="text-blue-600 hover:text-blue-700 text-xs flex-shrink-0"
                                  title="Copy password"
                                >
                                  📋
                                </button>
                              </div>
                            ) : (
                              <span className="text-sm text-gray-500">••••••••</span>
                            )}
                          </td>
                          <td className="w-[12%] px-4 py-4 whitespace-nowrap text-right text-sm font-medium min-w-0">
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
                <strong>Employee:</strong> {toDisplayFullName(resetPasswordModal.name)}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Email:</strong> {toDisplayEmail(resetPasswordModal.email)}
              </p>
            </div>

            {showNewPassword ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-sm font-medium text-blue-800 mb-2">Password Reset Successfully!</p>
                <div className="flex items-center justify-between bg-white border border-blue-300 rounded px-3 py-2">
                  <p className="text-sm font-mono text-gray-900 font-bold">{showNewPassword}</p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(showNewPassword);
                      alert('Password copied to clipboard!');
                    }}
                    className="ml-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-xs text-blue-700 mt-2">
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
                <strong>Employee:</strong> {toDisplayFullName(roleChangeModal.name)}
              </p>
              <p className="text-sm text-gray-600 mb-2">
                <strong>Email:</strong> {toDisplayEmail(roleChangeModal.email)}
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

      {/* Update Face Modal */}
      {updateFaceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Update face</h2>
            <p className="text-sm text-gray-600 mb-4">
              {toDisplayName(updateFaceModal.firstName)} {toDisplayName(updateFaceModal.lastName)} ({updateFaceModal.employeeCode})
            </p>
            <FaceCapture
              existingEncoding={(updateFaceModal as { faceEncoding?: number[] }).faceEncoding?.length === 128 ? (updateFaceModal as { faceEncoding: number[] }).faceEncoding : null}
              onEncodingCaptured={(encoding) => {
                setUpdateFaceEncoding(encoding);
                setUpdateFaceError('');
              }}
              onError={setUpdateFaceError}
              disabled={false}
            />
            {updateFaceError && (
              <p className="mt-2 text-sm text-red-600">{updateFaceError}</p>
            )}
            <div className="flex flex-wrap justify-end gap-3 mt-6">
              {(updateFaceModal as { faceEncoding?: number[] })?.faceEncoding?.length === 128 && (
                <button
                  type="button"
                  onClick={handleRemoveFace}
                  disabled={updateFaceSaving}
                  className="px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 disabled:opacity-50"
                >
                  {updateFaceSaving ? 'Please wait...' : 'Remove face'}
                </button>
              )}
              <button
                type="button"
                onClick={handleUpdateFaceClose}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdateFaceSave}
                disabled={!updateFaceEncoding || updateFaceEncoding.length !== 128 || updateFaceSaving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updateFaceSaving ? 'Saving...' : 'Save face'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters Bar - equal-width boxes, labels above, match reference */}
      {!showCredentials && (
        <div className="flex flex-wrap gap-4 mb-6">
          {isSuperAdmin && (
            <div className="flex flex-col w-52">
              <label className="text-sm font-medium text-gray-500 mb-1.5">Organization</label>
              <select
                value={superAdminSelectedOrgId}
                onChange={(e) => { setSuperAdminSelectedOrgId(e.target.value as string | 'ALL'); setCurrentPage(1); }}
                className="h-10 w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="ALL">All organizations</option>
                {superAdminOrganizations.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex flex-col w-52">
            <label className="text-sm font-medium text-gray-500 mb-1.5">Select Status</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="h-10 w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="ALL">All Status</option>
            </select>
          </div>
          <div className="flex flex-col w-52">
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
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
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
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#2196F3] flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500">Active</div>
                <div className="text-2xl font-bold text-gray-900">
                  {statusFilter === 'ACTIVE' ? pagination.total : statusFilter === 'ALL' ? (statsActiveCount ?? '—') : employees.filter((e: any) => e.is_active === true).length}
                </div>
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
                <div className="text-2xl font-bold text-gray-900">
                  {statsInactiveCount != null ? statsInactiveCount : '—'}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Error Message */}
      {!showCredentials && error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          <p className="font-semibold">Unable to load employee list. Please try again.</p>
          <p className="text-sm mt-1">{error}</p>
          <button
            onClick={() => {
              const params: any = { page: currentPage, limit: pageSize, employeeStatus: statusFilter };
              if (searchTerm) params.search = searchTerm;
              if (costCentreFilter !== 'ALL') params.costCentreId = costCentreFilter;
              if (departmentFilter !== 'ALL') params.departmentId = departmentFilter;
              if (subDepartmentFilter !== 'ALL') params.subDepartmentId = subDepartmentFilter;
              fetchEmployees(params);
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost Centre</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sub Dept</th>
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
                  <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-20 animate-pulse" /></td>
                  <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-24 animate-pulse" /></td>
                  <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-20 animate-pulse" /></td>
                  <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-20 animate-pulse" /></td>
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
                    {searchTerm || statusFilter !== 'ACTIVE' || departmentFilter !== 'ALL' || costCentreFilter !== 'ALL' || subDepartmentFilter !== 'ALL'
                      ? 'No employees found matching your filters'
                      : 'No employees yet. Create your first employee!'}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {employees.map((emp: any) => {
                      const displayName = emp.full_name || '';
                      const initials = displayName.split(' ').map((w: string) => w[0] || '').join('').slice(0, 2).toUpperCase();
                      return (
                      <div key={emp.user_id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition">
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`flex-shrink-0 h-12 w-12 rounded-full flex items-center justify-center text-white font-medium text-sm ${getAvatarColor(displayName || String(emp.user_id))}`}>
                            {initials || '?'}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-gray-900 truncate">{displayName}</div>
                            <div className="text-xs text-gray-500 truncate">{toDisplayValue(emp.project_role?.name)}</div>
                            <div className="text-xs text-gray-400 font-mono">{emp.code || emp.user_id}</div>
                          </div>
                        </div>
                        <div className="text-xs text-gray-600 space-y-1 mb-3">
                          <div className="truncate">{toDisplayEmail(emp.email)}</div>
                          {emp.department?.name && <div>Dept: {emp.department.name}</div>}
                          {emp.sub_department?.name && <div>Sub Dept: {emp.sub_department.name}</div>}
                          {emp.cost_centre?.name && <div>Cost Centre: {emp.cost_centre.name}</div>}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <button type="button" onClick={() => handleViewUser(emp)} disabled={loadingEmployee} title="View" className="p-1.5 rounded text-blue-600 hover:bg-blue-50 disabled:opacity-50">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          </button>
                          {canUpdate && (
                            <button type="button" onClick={() => handleEditUser(emp)} disabled={loadingEmployee} title="Edit" className="p-1.5 rounded text-indigo-600 hover:bg-indigo-50 disabled:opacity-50">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                          )}
                          {canDelete && (
                            <button type="button" onClick={() => handleDelete(String(emp.user_id))} title="Delete" className="p-1.5 rounded text-red-600 hover:bg-red-50">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          )}
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>
              {pagination.total > 0 && (
                <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between flex-wrap gap-2">
                  <p className="text-sm text-gray-700">
                    Showing <span className="font-medium">{(currentPage - 1) * pagination.limit + 1}</span> to <span className="font-medium">{Math.min(currentPage * pagination.limit, pagination.total)}</span> of <span className="font-medium">{pagination.total}</span> results
                  </p>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1.5 border border-gray-300 rounded-lg bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                      Previous
                    </button>
                    <span className="px-3 py-1.5 text-sm text-gray-600">Page {currentPage} of {Math.max(1, pagination.totalPages)}</span>
                    <button type="button" onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))} disabled={currentPage === pagination.totalPages || pagination.totalPages === 0} className="px-3 py-1.5 border border-gray-300 rounded-lg bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
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
          <table className="min-w-full divide-y divide-gray-200 table-fixed">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-[10%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button
                    type="button"
                    onClick={() => handleSort('employeeCode')}
                    className="inline-flex items-center hover:text-gray-700 focus:outline-none"
                  >
                    EMP ID
                    <SortIcon column="employeeCode" />
                  </button>
                </th>
                <th className="w-[16%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button
                    type="button"
                    onClick={() => handleSort('firstName')}
                    className="inline-flex items-center hover:text-gray-700 focus:outline-none"
                  >
                    NAME
                    <SortIcon column="firstName" />
                  </button>
                </th>
                <th className="w-[13%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="w-[9%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                <th className="w-[10%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Password</th>
                <th className="w-[9%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                <th className="w-[9%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost Centre</th>
                <th className="w-[9%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                <th className="w-[9%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sub Dept</th>
                <th className="w-[9%] px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                    {searchTerm || statusFilter !== 'ACTIVE' || departmentFilter !== 'ALL' || costCentreFilter !== 'ALL' || subDepartmentFilter !== 'ALL'
                      ? 'No employees found matching your filters'
                      : 'No employees yet. Create your first employee!'}
                  </td>
                </tr>
              ) : (
                employees.map((emp: any) => {
                  const displayName = emp.full_name || '';
                  const initials = displayName.split(' ').map((w: string) => w[0] || '').join('').slice(0, 2).toUpperCase();
                  return (
                  <tr key={emp.user_id} className="hover:bg-gray-50">
                    <td className="w-[10%] px-4 py-4 whitespace-nowrap text-sm font-mono text-gray-900 text-left truncate min-w-0">
                      {emp.code || emp.user_id}
                    </td>
                    <td className="w-[16%] px-4 py-4 whitespace-nowrap text-left min-w-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center text-white font-medium text-sm ${getAvatarColor(displayName || String(emp.user_id))}`}>
                          {initials || '?'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {displayName}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="w-[13%] px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-left truncate min-w-0">{toDisplayEmail(emp.email)}</td>
                    <td className="w-[9%] px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-left truncate min-w-0">{toDisplayValue(emp.phone)}</td>
                    <td className="w-[10%] px-4 py-4 whitespace-nowrap text-sm font-mono text-gray-900 text-left truncate min-w-0">{toDisplayValue(emp.password)}</td>
                    <td className="w-[9%] px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-left truncate min-w-0">{toDisplayValue(emp.project_role?.name)}</td>
                    <td className="w-[9%] px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-left truncate min-w-0">{toDisplayValue(emp.cost_centre?.name)}</td>
                    <td className="w-[9%] px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-left truncate min-w-0">{toDisplayValue(emp.department?.name)}</td>
                    <td className="w-[9%] px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-left truncate min-w-0">{toDisplayValue(emp.sub_department?.name)}</td>
                    <td className="w-[10%] px-4 py-4 whitespace-nowrap text-right text-sm font-medium min-w-0">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleViewUser(emp)}
                          disabled={loadingEmployee}
                          title="View"
                          className="p-2 rounded text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        </button>
                        {canUpdate && (
                          <button
                            type="button"
                            onClick={() => handleEditUser(emp)}
                            disabled={loadingEmployee}
                            title="Edit"
                            className="p-2 rounded text-indigo-600 hover:bg-indigo-50 disabled:opacity-50"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => handleDelete(String(emp.user_id))}
                            title="Delete"
                            className="p-2 rounded text-red-600 hover:bg-red-50"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
          </div>

          {/* Pagination - show when there is data */}
          {pagination.total > 0 && (
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 flex-wrap gap-2">
              <p className="text-sm text-gray-700">
                Showing <span className="font-medium">{(currentPage - 1) * pagination.limit + 1}</span> to{' '}
                <span className="font-medium">{Math.min(currentPage * pagination.limit, pagination.total)}</span> of{' '}
                <span className="font-medium">{pagination.total}</span> results
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-lg bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="px-3 py-1.5 text-sm text-gray-600">Page {currentPage} of {Math.max(1, pagination.totalPages)}</span>
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={currentPage === pagination.totalPages || pagination.totalPages === 0}
                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-lg bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
          )}
        </>
      )}

        </div>
      {/* Employee Import Modal */}
      <Modal
        isOpen={showImportModal}
        onClose={() => {
          if (importingEmployees) return;
          setShowImportModal(false);
          setImportFile(null);
          setImportResult(null);
        }}
        title="Import Employees (Excel)"
        size="lg"
      >
        <div className="space-y-4">
          <div className="text-sm text-gray-600">
            All columns optional. Use data if present; leave empty when no data. Associate Code must be unique.
          </div>
          <div>
            <button
              type="button"
              onClick={handleDownloadImportTemplate}
              disabled={importingEmployees}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Download Sample Template
            </button>
          </div>
          <div>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-gray-700 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border file:border-gray-300 file:bg-gray-50 file:text-gray-700 hover:file:bg-gray-100"
              disabled={importingEmployees}
            />
            {importFile && (
              <p className="mt-2 text-xs text-gray-500">
                Selected: {importFile.name}
              </p>
            )}
          </div>

          {importResult && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
              <p>Total rows processed: <strong>{importResult.total}</strong></p>
              <p>Created successfully: <strong className="text-blue-700">{importResult.success}</strong></p>
              {importResult.updated != null && importResult.updated > 0 && (
                <p>Updated (existing by code): <strong className="text-blue-700">{importResult.updated}</strong></p>
              )}
              <p>Skipped (already exists): <strong className="text-amber-700">{importResult.skipped}</strong></p>
              <p>Failed: <strong className="text-red-700">{importResult.failures.length}</strong></p>
              {importResult.managersSet != null && importResult.managersSet > 0 && (
                <p>Reporting managers set: <strong className="text-blue-700">{importResult.managersSet}</strong></p>
              )}
              {importResult.failures.length > 0 && (
                <div className="mt-2 max-h-48 overflow-auto rounded border border-red-100 bg-white p-2">
                  {importResult.failures.map((f, idx) => (
                    <div key={`${f.row}-${idx}`} className="text-xs text-red-700">
                      Row {f.row}
                      {f.associateCode ? ` [Associate: ${f.associateCode}]` : ''}
                      {f.email ? ` (${f.email})` : ''}: {f.message}
                    </div>
                  ))}
                </div>
              )}
              {/* Configurator sync status */}
              {importResult.configuratorSyncStatus && (
                <div className={`mt-2 rounded border p-2 text-xs ${
                  importResult.configuratorSyncStatus === 'success'
                    ? 'border-green-200 bg-green-50 text-green-800'
                    : importResult.configuratorSyncStatus === 'failed'
                    ? 'border-red-200 bg-red-50 text-red-800'
                    : 'border-amber-200 bg-amber-50 text-amber-800'
                }`}>
                  <strong>Configurator Sync:</strong> {importResult.configuratorSyncMessage || importResult.configuratorSyncStatus}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setShowImportModal(false);
                setImportFile(null);
                setImportResult(null);
              }}
              disabled={importingEmployees}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleImportEmployees}
              disabled={!importFile || importingEmployees}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
            >
              {importingEmployees ? 'Importing...' : 'Start Import'}
            </button>
          </div>
        </div>
      </Modal>
      {/* ═══ View Employee Modal ═══ */}
      {viewingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={() => setViewingUser(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="animate-gradient-bg relative overflow-hidden px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Employee Details</h2>
              <button onClick={() => setViewingUser(null)} className="text-white hover:text-blue-200 transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6">
              {/* Avatar + Name */}
              <div className="flex items-center gap-4 mb-6 pb-4 border-b border-gray-100">
                <div className={`flex-shrink-0 h-16 w-16 rounded-full flex items-center justify-center text-white font-bold text-xl ${getAvatarColor(viewingUser.full_name || '')}`}>
                  {(viewingUser.full_name || '').split(' ').map((w: string) => w[0] || '').join('').slice(0, 2).toUpperCase() || '?'}
                </div>
                <div>
                  <div className="text-xl font-semibold text-gray-900">{viewingUser.full_name || `${viewingUser.first_name || ''} ${viewingUser.last_name || ''}`}</div>
                  <div className="text-sm text-gray-500">{viewingUser.email}</div>
                  {viewingUser.code && <div className="text-xs text-gray-400 font-mono mt-0.5">Code: {viewingUser.code}</div>}
                </div>
              </div>
              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">Phone</div>
                  <div className="text-sm text-gray-900 mt-0.5">{viewingUser.phone || '—'}</div>
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">Status</div>
                  <div className="mt-0.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${viewingUser.is_active ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}`}>
                      {viewingUser.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">Role</div>
                  <div className="text-sm text-gray-900 mt-0.5">{viewingUser.project_role?.name || '—'}</div>
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">Cost Centre</div>
                  <div className="text-sm text-gray-900 mt-0.5">{viewingUser.cost_centre?.name || '—'}</div>
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">Department</div>
                  <div className="text-sm text-gray-900 mt-0.5">{viewingUser.department?.name || '—'}</div>
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">Sub Department</div>
                  <div className="text-sm text-gray-900 mt-0.5">{viewingUser.sub_department?.name || '—'}</div>
                </div>
              </div>
            </div>
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button onClick={() => setViewingUser(null)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Old Configurator-only edit modal removed — Edit now uses full EmployeeForm */}

      </main>
    </div>
  );
}
