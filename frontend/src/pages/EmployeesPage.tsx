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
import EmployeeForm from '../components/employees/EmployeeForm';
import PaygroupSelectionModal from '../components/employees/PaygroupSelectionModal';
import { FaceCapture } from '../components/employees/FaceCapture';
import AppHeader from '../components/layout/AppHeader';
import { canCreateEmployee, canUpdateEmployee, canDeleteEmployee, getEditableTabsFromPermissions, canEditEmployeeByPermission, type EmployeeFormTabKey } from '../utils/rbac';
import { toDisplayEmail, toDisplayFullName, toDisplayName, toDisplayValue } from '../utils/display';
import permissionService from '../services/permission.service';
import organizationService, { type Organization } from '../services/organization.service';
import positionService from '../services/position.service';
import departmentService from '../services/department.service';
import paygroupService from '../services/paygroup.service';
import costCentreService from '../services/costCentre.service';
import entityService from '../services/entity.service';
import { useDepartmentStore } from '../store/departmentStore';
import { employeeSalaryService } from '../services/payroll.service';

function getAvatarColor(name: string): string {
  const colors = ['bg-green-500', 'bg-blue-500', 'bg-orange-500', 'bg-purple-500', 'bg-teal-500', 'bg-indigo-500'];
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

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function toDateOnly(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Excel serial date (days since 1899-12-30 in most files)
    const utcMillis = Math.round((value - 25569) * 86400 * 1000);
    const asDate = new Date(utcMillis);
    if (!Number.isNaN(asDate.getTime())) {
      return asDate.toISOString().slice(0, 10);
    }
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const isoDate = /^\d{4}-\d{2}-\d{2}$/;
    if (isoDate.test(trimmed)) return trimmed;
    const dmy = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/;
    const match = trimmed.match(dmy);
    if (match) {
      const dd = match[1].padStart(2, '0');
      const mm = match[2].padStart(2, '0');
      const yyyy = match[3];
      return `${yyyy}-${mm}-${dd}`;
    }
    const mdyMatch = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
    if (mdyMatch) {
      const a = parseInt(mdyMatch[1], 10);
      const b = parseInt(mdyMatch[2], 10);
      const y = mdyMatch[3];
      let dd: string; let mm: string;
      if (a > 12) { dd = mdyMatch[1].padStart(2, '0'); mm = mdyMatch[2].padStart(2, '0'); }
      else if (b > 12) { mm = mdyMatch[1].padStart(2, '0'); dd = mdyMatch[2].padStart(2, '0'); }
      else { dd = mdyMatch[1].padStart(2, '0'); mm = mdyMatch[2].padStart(2, '0'); }
      const parsed = new Date(`${y}-${mm}-${dd}`);
      if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
    }
    let parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
    const monthNames = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    const monthMatch = trimmed.match(/^(\d{1,2})[-./\s]?([a-z]{3,})[-./\s]?(\d{2,4})$/i);
    if (monthMatch) {
      const d = monthMatch[1].padStart(2, '0');
      const mIdx = monthNames.findIndex((m) => monthMatch[2].toLowerCase().startsWith(m));
      if (mIdx >= 0) {
        const m = String(mIdx + 1).padStart(2, '0');
        const y = monthMatch[3].length === 2 ? '20' + monthMatch[3] : monthMatch[3];
        return `${y}-${m}-${d}`;
      }
    }
  }
  return null;
}

function getCellValue(row: Record<string, unknown>, keys: string[]): unknown {
  const normalizedEntries = Object.entries(row).map(([k, v]) => [normalizeHeader(k), v] as const);
  for (const key of keys.map((k) => normalizeHeader(k))) {
    const found = normalizedEntries.find(([k]) => k === key);
    if (found && found[1] !== '' && found[1] != null) return found[1];
  }
  return '';
}

/** Get email with fallback: try explicit keys, then any column with email/mail in header and valid email value */
function getEmailWithFallback(row: Record<string, unknown>): string {
  const official = String(getCellValue(row, ['Official/Permanent E-Mail Id', 'Official E-Mail Id', 'officialEmail', 'Permanent E-Mail Id', 'permanentEmail', 'email', 'Email', 'E-Mail'])).trim();
  if (official && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(official)) return official;
  const normalizedEntries = Object.entries(row).map(([k, v]) => [normalizeHeader(k), v] as const);
  const emailLike = normalizedEntries.find(([norm, val]) => {
    if (!val || typeof val !== 'string') return false;
    const str = String(val).trim();
    return (norm.includes('email') || norm.includes('mail')) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
  });
  return emailLike ? String(emailLike[1]).trim() : '';
}

/** Get Associate/Employee name with fallback: try explicit keys, then fuzzy match on column headers */
function getAssociateNameWithFallback(row: Record<string, unknown>): string {
  const explicit = getCellValue(row, [
    'Associate Name', 'associateName', 'associate_name', 'Name', 'Employee Name', 'Full Name', 'Emp Name',
    'EMP NAME', 'EMP.NAME', 'Associate', 'Employee', 'Staff Name', 'Candidate Name', 'NAME',
  ]);
  if (explicit !== '' && explicit != null) return String(explicit).trim();
  const normalizedEntries = Object.entries(row).map(([k, v]) => [normalizeHeader(k), v] as const);
  const nameLike = normalizedEntries.find(([norm, val]) => {
    if (val === '' || val == null) return false;
    const str = String(val).trim();
    if (str.length < 2) return false;
    return norm.includes('associatename') || norm === 'associate' || norm === 'employeename' || norm === 'empname' || norm === 'fullname' || norm === 'name';
  });
  return nameLike ? String(nameLike[1]).trim() : '';
}

/** Get Reporting Manager with fallback: try explicit keys, then any column with manager/report in header */
function getReportingManagerWithFallback(row: Record<string, unknown>): string {
  const explicit = getCellValue(row, ['Reporting Manager', 'reportingManager', 'reporting_manager', 'Manager', 'Report To', 'Reporting To', 'REPORTING MANAGER', 'Manager Name', 'Manager Code']);
  if (explicit !== '' && explicit != null) return String(explicit).trim();
  const normalizedEntries = Object.entries(row).map(([k, v]) => [normalizeHeader(k), v] as const);
  const managerLike = normalizedEntries.find(([norm, val]) => {
    if (!val || (typeof val === 'string' && !val.trim())) return false;
    return norm.includes('manager') || norm.includes('report');
  });
  return managerLike ? String(managerLike[1]).trim() : '';
}

/** Get ESI Number with fallback: try explicit keys, then any column matching esi+number/no pattern */
function getEsiNumber(row: Record<string, unknown>): string {
  const explicit = getCellValue(row, [
    'esiNumber', 'esi_number', 'ESIC', 'ESIC No', 'ESI Number', 'ESIC NO', 'ESIC Number', 'ESI NO', 'ESI No',
    'ESI No.', 'ESI NUMBER', 'ESI NUM', 'EMPLOYEE STATE INSURANCE NO', 'ESI',
  ]);
  if (explicit !== '' && explicit != null) return String(explicit).trim();
  const normalizedEntries = Object.entries(row).map(([k, v]) => [normalizeHeader(k), v] as const);
  const esiNumLike = normalizedEntries.find(([norm]) =>
    norm.includes('esi') && (norm.includes('number') || norm.includes('no') || norm === 'esic') &&
    !norm.includes('location') && !norm.includes('dispensary')
  );
  if (esiNumLike && esiNumLike[1] !== '' && esiNumLike[1] != null) return String(esiNumLike[1]).trim();
  return '';
}

export default function EmployeesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const { user, loadUser, logout } = useAuthStore();
  const { employees, pagination, loading, error, fetchEmployees, deleteEmployee } = useEmployeeStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ACTIVE');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [entityFilter, setEntityFilter] = useState<string>('ALL');
  const [paygroupFilter, setPaygroupFilter] = useState<string>('ALL');
  const [positionFilter, setPositionFilter] = useState<string>('ALL');
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<'employeeCode' | 'firstName'>('firstName');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const { positions, fetchPositions } = usePositionStore();
  const { departments, fetchDepartments } = useDepartmentStore();
  const [orgEntities, setOrgEntities] = useState<{ id: string; name: string; code?: string | null }[]>([]);
  const [orgPaygroups, setOrgPaygroups] = useState<{ id: string; name: string; code?: string | null }[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showPaygroupModal, setShowPaygroupModal] = useState(false);
  const [selectedPaygroupId, setSelectedPaygroupId] = useState<string | null>(null);
  const [selectedPaygroupName, setSelectedPaygroupName] = useState<string | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [viewMode, setViewMode] = useState(false);
  const [rejoinMode, setRejoinMode] = useState(false);
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
  const [updateFaceModal, setUpdateFaceModal] = useState<Employee | null>(null);
  const [updateFaceEncoding, setUpdateFaceEncoding] = useState<number[] | null>(null);
  const [updateFaceError, setUpdateFaceError] = useState('');
  const [updateFaceSaving, setUpdateFaceSaving] = useState(false);
  const [viewType, setViewType] = useState<'list' | 'grid'>('list');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importingEmployees, setImportingEmployees] = useState(false);
  const [importResult, setImportResult] = useState<{ total: number; success: number; updated: number; skipped: number; failures: EmployeeImportFailure[]; managersSet?: number } | null>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [userPermissions, setUserPermissions] = useState<{ resource: string; action: string }[]>([]);
  // Super Admin: list of all orgs and selected org for Employee Directory
  const [superAdminOrganizations, setSuperAdminOrganizations] = useState<Organization[]>([]);
  const [superAdminSelectedOrgId, setSuperAdminSelectedOrgId] = useState<string | 'ALL'>('ALL');
  const [_loadingOrgs, setLoadingOrgs] = useState(false);
  // View Credentials page filters
  const [credOrgFilter, setCredOrgFilter] = useState<string>('ALL');
  const [credDesignationFilter, setCredDesignationFilter] = useState<string>('ALL');
  const [credStatusFilter, setCredStatusFilter] = useState<string>('ALL');
  const [credSearchTerm, setCredSearchTerm] = useState('');
  const [statsActiveCount, setStatsActiveCount] = useState<number | null>(null);

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

  // Get organizationId from logged-in user (check both possible shapes)
  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id;

  // Super Admin: can view all orgs or pick one; others use their linked org
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const effectiveOrganizationId = isSuperAdmin
    ? (superAdminSelectedOrgId === 'ALL' ? undefined : superAdminSelectedOrgId)
    : organizationId;
  const effectiveOrganizationName = isSuperAdmin
    ? (superAdminSelectedOrgId === 'ALL' ? 'All organizations' : superAdminOrganizations.find((o) => o.id === superAdminSelectedOrgId)?.name ?? '—')
    : user?.employee?.organization?.name;

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

  // RBAC permissions: role-based and permission-tab based
  const canCreate = canCreateEmployee(user?.role);
  const canUpdateByRole = canUpdateEmployee(user?.role);
  const canUpdateByPermission = canEditEmployeeByPermission(userPermissions);
  const canUpdate = canUpdateByRole || canUpdateByPermission;
  const canDelete = canDeleteEmployee(user?.role);
  const canManageCredentials = user?.role === 'SUPER_ADMIN' || user?.role === 'ORG_ADMIN' || user?.role === 'HR_MANAGER';

  /** Editable tabs from Permissions tab: undefined = all tabs, else only those tabs user can edit */
  const editableTabsFromPermissions = getEditableTabsFromPermissions(userPermissions);

  /**
   * Edit button visibility:
   * - SUPER_ADMIN, ORG_ADMIN, HR_MANAGER: can edit all employees.
   * - MANAGER: can edit only their own profile; team members are view-only (no Edit).
   * - EMPLOYEE: can edit own row only when they have tab-level update permissions.
   */
  const canEditRow = (emp: Employee) => {
    const role = user?.role != null ? String(user.role).toUpperCase() : '';
    const myEmployeeId = user?.employee?.id != null ? String(user.employee.id) : '';
    const rowEmployeeId = emp?.id != null ? String(emp.id) : '';
    if (role === 'MANAGER') {
      return myEmployeeId !== '' && myEmployeeId === rowEmployeeId; // Manager: Edit only own row; team members view-only
    }
    if (role === 'EMPLOYEE') {
      return myEmployeeId !== '' && myEmployeeId === rowEmployeeId && (canUpdateByPermission || (editableTabsFromPermissions && editableTabsFromPermissions.length > 0));
    }
    if (canUpdate) return true; // SUPER_ADMIN, ORG_ADMIN, HR_MANAGER can edit all
    return false;
  };

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

  // Super Admin: fetch all organizations on mount
  useEffect(() => {
    if (!isSuperAdmin) return;
    setLoadingOrgs(true);
    organizationService.getAll(1, 100).then((res) => {
      setSuperAdminOrganizations(res.organizations ?? []);
    }).catch(() => setSuperAdminOrganizations([])).finally(() => setLoadingOrgs(false));
  }, [isSuperAdmin]);

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

  // Refetch list when navigating to this page (e.g. after approval) so approved details show
  useEffect(() => {
    if (location.pathname !== '/employees') return;
    // Super Admin with "All" can have no organizationId; backend returns all employees
    if (!isSuperAdmin && !organizationId) return;
    const params: any = {
      page: currentPage,
      limit: pageSize,
      listView: true,
    };
    if (effectiveOrganizationId) params.organizationId = effectiveOrganizationId;
    if (searchTerm) params.search = searchTerm;
    params.employeeStatus = statusFilter;
    if (departmentFilter !== 'ALL') params.departmentId = departmentFilter;
    if (entityFilter !== 'ALL') params.entityId = entityFilter;
    if (paygroupFilter !== 'ALL') params.paygroupId = paygroupFilter;
    if (positionFilter !== 'ALL') params.positionId = positionFilter;
    params.sortBy = sortBy;
    params.sortOrder = sortOrder;
    fetchEmployees(params);
  }, [isSuperAdmin, organizationId, effectiveOrganizationId, location.pathname, currentPage, pageSize, searchTerm, statusFilter, departmentFilter, entityFilter, paygroupFilter, positionFilter, sortBy, sortOrder, fetchEmployees]);

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

  // Open employee edit form when navigated with editEmployeeId or rejoinEmployeeId (from Employee Rejoin list)
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
          setEditingEmployee(full);
          setViewMode(false);
          setRejoinMode(!!rejoinId);
          setShowForm(true);
        }
        navigate('/employees', { replace: true, state: {} });
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

  const handleUpdateFaceOpen = (emp: Employee) => {
    setUpdateFaceModal(emp);
    setUpdateFaceEncoding(null);
    setUpdateFaceError('');
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
      const params: any = { page: currentPage, limit: pageSize, listView: true, sortBy, sortOrder };
      if (effectiveOrganizationId) params.organizationId = effectiveOrganizationId;
      if (searchTerm) params.search = searchTerm;
      params.employeeStatus = statusFilter;
      if (departmentFilter !== 'ALL') params.departmentId = departmentFilter;
      if (entityFilter !== 'ALL') params.entityId = entityFilter;
      if (paygroupFilter !== 'ALL') params.paygroupId = paygroupFilter;
      if (positionFilter !== 'ALL') params.positionId = positionFilter;
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
      const params: any = { page: currentPage, limit: pageSize, listView: true, sortBy, sortOrder };
      if (effectiveOrganizationId) params.organizationId = effectiveOrganizationId;
      if (searchTerm) params.search = searchTerm;
      params.employeeStatus = statusFilter;
      if (departmentFilter !== 'ALL') params.departmentId = departmentFilter;
      if (entityFilter !== 'ALL') params.entityId = entityFilter;
      if (paygroupFilter !== 'ALL') params.paygroupId = paygroupFilter;
      if (positionFilter !== 'ALL') params.positionId = positionFilter;
      fetchEmployees(params);
    } catch (err: any) {
      setUpdateFaceError(err.response?.data?.message || err.message || 'Failed to remove face');
    } finally {
      setUpdateFaceSaving(false);
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
    setRejoinMode(false);
    const params: any = {
      organizationId,
      page: currentPage,
      limit: pageSize,
      listView: true,
      sortBy,
      sortOrder,
    };
    if (searchTerm) params.search = searchTerm;
    params.employeeStatus = statusFilter;
    if (departmentFilter !== 'ALL') params.departmentId = departmentFilter;
    if (entityFilter !== 'ALL') params.entityId = entityFilter;
    if (paygroupFilter !== 'ALL') params.paygroupId = paygroupFilter;
    if (positionFilter !== 'ALL') params.positionId = positionFilter;
    fetchEmployees(params);
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingEmployee(null);
    setViewMode(false);
    setRejoinMode(false);
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

  const handleExportExcel = () => {
    setShowExportMenu(false);
    if (!employees || employees.length === 0) {
      alert('No employees to export.');
      return;
    }
    const headers = ['EMP ID', 'Name', 'Email', 'Designation', 'Status'];
    const rows = employees.map((emp) => [
      emp.employeeCode,
      `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
      emp.email || '',
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

  const mapGender = (val: string): string | undefined => {
    const v = String(val).trim().toUpperCase();
    if (v === 'M' || v === 'MALE') return 'MALE';
    if (v === 'F' || v === 'FEMALE') return 'FEMALE';
    if (v === 'OTHER') return 'OTHER';
    return undefined;
  };

  const mapMaritalStatus = (val: string): string | undefined => {
    const v = String(val).trim().toUpperCase();
    if (v === 'S' || v === 'SINGLE') return 'SINGLE';
    if (v === 'M' || v === 'MARRIED') return 'MARRIED';
    if (v === 'DIVORCED') return 'DIVORCED';
    if (v === 'WIDOWED') return 'WIDOWED';
    return undefined;
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
      const [
        { positions: orgPositions },
        { departments: orgDepartments },
        orgPaygroups,
        { employees: orgEmployees },
        orgCostCentres,
        orgEntitiesImport,
      ] = await Promise.all([
        positionService.getAll({ organizationId: effectiveOrganizationId, limit: 500 }),
        departmentService.getAll({ organizationId: effectiveOrganizationId, limit: 500 }),
        paygroupService.getAll({ organizationId: effectiveOrganizationId }),
        employeeService.getAll({ organizationId: effectiveOrganizationId, employeeStatus: 'ALL', limit: 5000 }),
        costCentreService.getByOrganization(effectiveOrganizationId),
        entityService.getByOrganization(effectiveOrganizationId),
      ]);
      const orgEntitiesList = orgEntitiesImport || [];
      const buffer = await importFile.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
      const firstSheet = workbook.SheetNames[0];
      if (!firstSheet) {
        alert('No sheets found in the selected file.');
        return;
      }

      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[firstSheet], {
        defval: '',
      });
      if (!rows.length) {
        alert('Selected file has no data rows.');
        return;
      }

      const failures: EmployeeImportFailure[] = [];
      let success = 0;
      let updated = 0;
      let skipped = 0;
      let total = 0;
      /** Employees created in this batch: for same-batch Reporting Manager lookup */
      const createdInBatch: Array<{ id: string; employeeCode: string; firstName: string; lastName: string }> = [];
      /** Rows where Reporting Manager was specified but manager not found yet (appears later in Excel) - fix in second pass */
      const pendingReportingManager: Array<{ employeeId: string; reportingManagerName: string }> = [];

      const resolveReportingManagerId = (nameOrCode: string): string | null => {
        if (!nameOrCode?.trim()) return null;
        const raw = nameOrCode.trim();
        const codeFromBrackets = raw.match(/\[([^\]]+)\]/)?.[1]?.trim().toLowerCase();
        const codeFromParens = raw.match(/\(([^)]+)\)/)?.[1]?.trim().toLowerCase();
        const namePart = raw.replace(/\s*\[.*?\]\s*/g, '').replace(/\s*\(.*?\)\s*/g, '').trim().toLowerCase();
        const searchRaw = namePart || raw.toLowerCase();
        const search = searchRaw.replace(/\s+/g, ' ').trim();
        const looksLikeCode = /^[a-zA-Z]*\d+[a-z0-9]*$/i.test(raw) && raw.length <= 20;
        const possibleCodes = [codeFromBrackets, codeFromParens, looksLikeCode ? raw.toLowerCase() : null].filter(Boolean);
        const normalizeForMatch = (s: string) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
        const nameMatches = (full: string, alt: string) =>
          full === search || alt === search || full.includes(search) || search.includes(full) || alt.includes(search) || search.includes(alt);
        const byCodeInBatch = createdInBatch.find((e) => {
          const code = e.employeeCode?.toLowerCase()?.trim();
          return code && (code === search || code === codeFromBrackets || code === codeFromParens || possibleCodes.some((c) => c && code === c));
        });
        if (byCodeInBatch) return byCodeInBatch.id;
        const byCodeInOrg = orgEmployees?.find((e) => {
          const code = (e as { employeeCode?: string }).employeeCode?.toLowerCase()?.trim();
          return code && (code === search || code === codeFromBrackets || code === codeFromParens || possibleCodes.some((c) => c && code === c));
        })?.id;
        if (byCodeInOrg) return byCodeInOrg;
        const byNameInOrg = orgEmployees?.find((e) => {
          const full = normalizeForMatch(`${e.firstName || ''} ${e.lastName || ''}`);
          const alt = normalizeForMatch(`${e.lastName || ''} ${e.firstName || ''}`);
          return nameMatches(full, alt);
        })?.id;
        if (byNameInOrg) return byNameInOrg;
        const byNameInBatch = createdInBatch.find((e) => {
          const full = normalizeForMatch(`${e.firstName || ''} ${e.lastName || ''}`);
          const alt = normalizeForMatch(`${e.lastName || ''} ${e.firstName || ''}`);
          return nameMatches(full, alt);
        });
        return byNameInBatch?.id ?? null;
      };

      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];
        const associateName = getAssociateNameWithFallback(row);
        const firstNameCol = String(getCellValue(row, ['firstName', 'first_name', 'firstname', 'First Name', 'EMP.F.NAME'])).trim();
        const lastNameCol = String(getCellValue(row, ['lastName', 'last_name', 'lastname', 'Last Name', 'EMP.L.NAME'])).trim();
        let firstName = firstNameCol;
        let lastName = lastNameCol;
        if (associateName && !firstNameCol && !lastNameCol) {
          const parts = associateName.split(/\s+/).filter(Boolean);
          firstName = parts[0] || associateName;
          lastName = parts.length > 1 ? parts.slice(1).join(' ') : associateName;
        }
        const middleName = String(getCellValue(row, ['middleName', 'middle_name', 'EMP.M.NAME'])).trim();
        const officialEmail = String(getCellValue(row, ['Official/Permanent E-Mail Id', 'Official E-Mail Id', 'officialEmail', 'official_email', 'Official Email', 'email', 'E-Mail', 'Email'])).trim();
        const permanentEmail = String(getCellValue(row, ['Official/Permanent E-Mail Id', 'Permanent E-Mail Id', 'permanentEmail', 'permanent_email', 'Permanent Email'])).trim();
        const emailCol = String(getCellValue(row, ['Official/Permanent E-Mail Id', 'email', 'emailId', 'mail', 'Email ID', 'EMAIL ID', 'Email', 'E-Mail Id', 'E-Mail', 'Mail', 'Official E-Mail', 'Mail Id', 'Email Address'])).trim();
        let email = emailCol || officialEmail || permanentEmail || getEmailWithFallback(row);
        if (!email) {
          const emailLike = Object.values(row).find((v) => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim()));
          if (emailLike) email = String(emailLike).trim();
        }
        if ((!firstName || !lastName) && email && /^[^\s@]+@[^\s@]+/.test(email)) {
          const localPart = email.split('@')[0] || '';
          const nameParts = localPart.replace(/[._]/g, ' ').split(/\s+/).filter(Boolean);
          if (!firstName && nameParts.length) firstName = nameParts[0];
          if (!lastName && nameParts.length) lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : nameParts[0] || localPart;
        }
        const fatherName = String(getCellValue(row, ['fatherName', 'father_name', 'Father Name', 'FATHER NAME'])).trim();
        if (!lastName && fatherName) lastName = fatherName;
        const personalEmailRaw = String(getCellValue(row, ['personalEmail', 'personal_email', 'Permanent E-Mail Id'])).trim()
          || (permanentEmail && permanentEmail !== email ? permanentEmail : '');
        const personalEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personalEmailRaw) ? personalEmailRaw : '';
        const dateOfJoining = toDateOnly(getCellValue(row, ['dateOfJoining', 'date_of_joining', 'joiningDate', 'doj', 'Date of Joining', 'DOJ', 'Joining Date', 'Appointment Date', 'Date of Appointment', 'DOJ (Date of Joining)']));
        const employeeCode = String(getCellValue(row, ['Associate Code', 'employeeCode', 'employee_code', 'empCode', 'empcode', 'empId', 'emp id', 'Emp ID', 'EMP.CODE'])).trim();
        const phone = String(getCellValue(row, ['phone', 'mobile', 'mobileNumber', 'mobile_number', 'phone_number', 'Mobile No', 'Permanent mobile', 'Permanent Phone', 'Current Phone', 'EMRG.CONTACT NO.'])).trim();
        const designation = String(getCellValue(row, ['designation', 'Designation', 'position'])).trim();
        const department = String(getCellValue(row, ['department', 'departmentName', 'dept', 'Department', 'DEPARTMENT'])).trim();
        const paygroupName = String(getCellValue(row, ['Paygroup', 'paygroup', 'payGroup', 'PAY GROUP'])).trim();
        const gender = mapGender(String(getCellValue(row, ['gender', 'Gender', 'GENDER'])));
        const maritalStatus = mapMaritalStatus(String(getCellValue(row, ['maritalStatus', 'marital_status', 'Marital Status', 'MARITIAL STATUS'])));
        const dateOfLeaving = toDateOnly(getCellValue(row, ['dateOfLeaving', 'date_of_leaving', 'dol', 'RELIEVING DATE']));
        const permanentAddress = String(getCellValue(row, ['permanentAddress', 'permanent_address', 'Permanent Address', 'Address - Permanent', 'PARMANENT ADDRESS'])).trim();
        const presentAddress = String(getCellValue(row, ['presentAddress', 'present_address', 'Current Address', 'Address - Current', 'COMMUNICATON ADDRESS'])).trim();
        const city = String(getCellValue(row, ['city', 'City', 'Permanent City', 'City - Permanent'])).trim();
        const cityCurrent = String(getCellValue(row, ['cityCurrent', 'City - Current', 'Current City'])).trim();
        const state = String(getCellValue(row, ['state', 'State', 'Permanent State', 'State - Permanent'])).trim();
        const stateCurrent = String(getCellValue(row, ['stateCurrent', 'State - Current', 'Current State'])).trim();
        const pincode = String(getCellValue(row, ['pincode', 'postalCode', 'postal_code', 'Permanent Pincode', 'Pincode - Permanent'])).trim();
        const pincodeCurrent = String(getCellValue(row, ['pincodeCurrent', 'Pincode - Current', 'Current Pincode'])).trim();
        const countryPermanent = String(getCellValue(row, ['countryPermanent', 'Country - Permanent'])).trim();
        const countryCurrent = String(getCellValue(row, ['countryCurrent', 'Country - Current'])).trim();
        const panNumber = String(getCellValue(row, ['panNumber', 'pan_number', 'PAN', 'Pan No', 'Pan No.', 'Pan Card Number', 'PANCARD NO'])).trim();
        const aadhaarNumber = String(getCellValue(row, ['aadhaarNumber', 'aadhar_number', 'aadhar', 'Aadhar', 'Aadhar No', 'Adhaar Number', 'Aadhar Number', 'AADHAR NO'])).trim();
        const uanNumber = String(getCellValue(row, ['uanNumber', 'uan_number', 'UAN', 'UAN No', 'UAN Number', 'UAN NO'])).trim();
        const pfNumber = String(getCellValue(row, ['pfNumber', 'pf_number', 'EPF', 'epfNumber', 'PF No', 'PF Number', 'PF NO'])).trim();
        const esiNumber = getEsiNumber(row);
        const bankName = String(getCellValue(row, ['bankName', 'bank_name', 'Bank Name', 'BANK NAME'])).trim();
        const accountNumber = String(getCellValue(row, ['accountNumber', 'account_number', 'accountNo', 'Account No', 'Bank Account No', 'Bank A/c No.', 'ACCOUNT NO'])).trim();
        const ifscCode = String(getCellValue(row, ['ifscCode', 'ifsc_code', 'IFSC', 'Bank IFSC Code', 'IFSC CODE'])).trim();
        const age = String(getCellValue(row, ['age', 'Age'])).trim();
        const passportNumber = String(getCellValue(row, ['passportNumber', 'passport_number', 'PASSPORT NO'])).trim();
        const drivingLicenseNumber = String(getCellValue(row, ['drivingLicenseNumber', 'driving_license', 'DRIVING LICENCE NO'])).trim();
        const bloodGroup = String(getCellValue(row, ['bloodGroup', 'blood_group', 'Blood Group', 'BLOOD GROUP'])).trim();
        const experienceYears = String(getCellValue(row, ['experienceYears', 'experience', 'Experience', 'Exp - Total', 'Exp - Relevant', 'PREVIOUS EXPERIENCE'])).trim();
        const dateOfBirth = toDateOnly(getCellValue(row, ['dateOfBirth', 'date_of_birth', 'dob', 'Date of Birth', 'DOB']));
        const subDepartment = String(getCellValue(row, ['subDepartment', 'sub_department', 'Sub Department', 'SubDepartment', 'SUB.DEPARTMENT'])).trim();
        const qualification = String(getCellValue(row, ['qualification', 'Qualification', 'QUALIFICATION'])).trim();
        const course = String(getCellValue(row, ['course', 'Course'])).trim();
        const university = String(getCellValue(row, ['university', 'University', 'INSTITUTE'])).trim();
        const passoutYear = String(getCellValue(row, ['passoutYear', 'passout_year', 'Passout Year', 'YEAR OF PASSING'])).trim();
        const emergencyContactName = String(getCellValue(row, ['emergencyContactName', 'emergency_contact_name', 'Emergency Contact Name', 'EMRG.CONTACT NAME'])).trim();
        const emergencyContactNo = String(getCellValue(row, ['emergencyContactNo', 'emergency_contact_no', 'Emergency Contact No', 'EMRG.CONTACT NO.'])).trim();
        const relationship = String(getCellValue(row, ['relationship', 'Relationship', 'RELATION'])).trim();
        const placeOfTaxRaw = String(getCellValue(row, ['Place of Tax Deduction', 'placeOfTaxDeduction', 'place_of_tax_deduction'])).trim().toUpperCase();
        const placeOfTax = placeOfTaxRaw === 'M' ? 'METRO' : placeOfTaxRaw === 'N' ? 'NON_METRO' : placeOfTaxRaw;
        const workLocation = String(getCellValue(row, ['Location', 'location', 'workLocation'])).trim();
        const reportingManagerName = getReportingManagerWithFallback(row);
        const costCentreCol = String(getCellValue(row, ['Cost Centre', 'costCentre', 'cost_centre', 'cost_center'])).trim();
        const fixedGross = String(getCellValue(row, ['Fixed Gross', 'fixedGross', 'fixed_gross'])).trim();
        const vehicleAllowances = String(getCellValue(row, ['Vehicle Allowances', 'vehicleAllowances', 'vehicle_allowances'])).trim();

        const esiLocation = String(getCellValue(row, ['ESI Location', 'esiLocation', 'esi_location'])).trim();
        const ptaxLocation = String(getCellValue(row, ['Ptax Location', 'ptaxLocation', 'ptax_location'])).trim();
        const associateNoticePeriodDays = String(getCellValue(row, ['Associate Notice Period Days', 'associateNoticePeriodDays', 'notice_period_days'])).trim();
        const lwfLocation = String(getCellValue(row, ['LWF Location', 'lwfLocation', 'lwf_location'])).trim();
        const taxRegimeRaw = String(getCellValue(row, ['Tax Regime', 'taxRegime', 'tax_regime'])).trim();
        const taxRegime = taxRegimeRaw ? (taxRegimeRaw.toUpperCase() === 'N' || taxRegimeRaw.toUpperCase() === 'NEW' ? 'NEW' : taxRegimeRaw.toUpperCase() === 'O' || taxRegimeRaw.toUpperCase() === 'OLD' ? 'OLD' : taxRegimeRaw) : undefined;
        const alternateSaturdayOff = String(getCellValue(row, ['Alternate Saturday Off', 'alternateSaturdayOff', 'alternate_saturday_off'])).trim();
        const compoffApplicable = String(getCellValue(row, ['Compoff Applicable', 'compoffApplicable', 'compoff_applicable'])).trim();

        // Skip fully empty rows
        if (!firstName && !lastName && !email && !dateOfJoining && !employeeCode) {
          continue;
        }

        total += 1;

        // Use Excel data when present; use placeholders only when backend requires values (not displayed in UI)
        const finalFirstName = (firstName || lastName || associateName || employeeCode || `Emp${index + 1}`).trim();
        const finalLastName = (lastName || firstName || '').trim();
        const safeFirstName = finalFirstName.length >= 2 ? finalFirstName : (finalFirstName + ' ').slice(0, 2);
        const finalEmail = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
          ? email.trim()
          : `${(employeeCode || `imported${index + 2}`).replace(/[^a-zA-Z0-9]/g, '')}@imported.placeholder`;
        const finalDateOfJoining = dateOfJoining || new Date().toISOString().slice(0, 10);

        const positionId = designation
          ? orgPositions?.find((p) => p.title?.toLowerCase() === designation.toLowerCase())?.id ?? null
          : null;
        const departmentId = department
          ? orgDepartments?.find((d) => d.name?.toLowerCase() === department.toLowerCase())?.id ?? null
          : null;
        const entityCol = String(getCellValue(row, ['entity', 'Entity', 'ENTITY', 'entityName'])).trim();
        const entityId = entityCol
          ? orgEntitiesList.find((e) => e.name?.toLowerCase() === entityCol.toLowerCase() || e.code?.toLowerCase() === entityCol.toLowerCase())?.id ?? null
          : null;
        const paygroupId = paygroupName
          ? orgPaygroups?.find((p) => p.name?.toLowerCase() === paygroupName.toLowerCase())?.id ?? null
          : null;
        const reportingManagerId = null;
        const costCentreId = costCentreCol
          ? orgCostCentres?.find(
              (c) =>
                c.name?.toLowerCase() === costCentreCol.toLowerCase() ||
                (c.code && c.code.toLowerCase() === costCentreCol.toLowerCase())
            )?.id ?? null
          : null;
        const placeOfTaxDeduction = placeOfTax === 'METRO' || placeOfTax === 'NON_METRO' ? placeOfTax : undefined;

        const permanentDistrict = String(getCellValue(row, ['Permanent District', 'permanentDistrict', 'permanent_district'])).trim();
        const presentDistrict = String(getCellValue(row, ['Current District', 'presentDistrict', 'currentDistrict', 'current_district'])).trim();
        const presentPhone = String(getCellValue(row, ['Current Phone', 'presentPhone', 'present_phone'])).trim();

        const address =
          permanentAddress || presentAddress || city || cityCurrent || state || stateCurrent || pincode || pincodeCurrent || countryPermanent || countryCurrent || permanentDistrict || presentDistrict || presentPhone
            ? {
                ...(permanentAddress ? { street: permanentAddress, permanentAddress } : {}),
                ...(presentAddress ? { presentAddress } : {}),
                ...(city ? { city } : {}),
                ...(state ? { state } : {}),
                ...(pincode ? { postalCode: pincode } : {}),
                ...(countryPermanent ? { country: countryPermanent } : {}),
                ...(cityCurrent ? { presentCity: cityCurrent } : {}),
                ...(stateCurrent ? { presentState: stateCurrent } : {}),
                ...(pincodeCurrent ? { presentPincode: pincodeCurrent } : {}),
                ...(permanentDistrict ? { permanentDistrict } : {}),
                ...(presentDistrict ? { presentDistrict } : {}),
                ...(presentPhone ? { presentPhoneNumber: presentPhone } : {}),
              }
            : undefined;

        const taxInformation =
          panNumber || aadhaarNumber || uanNumber || pfNumber || esiNumber || esiLocation || ptaxLocation || taxRegime
            ? {
                ...(panNumber ? { panNumber } : {}),
                ...(aadhaarNumber ? { aadhaarNumber } : {}),
                ...(uanNumber ? { uanNumber } : {}),
                ...(pfNumber ? { pfNumber } : {}),
                ...(esiNumber ? { esiNumber } : {}),
                ...(esiLocation ? { esiLocation } : {}),
                ...(ptaxLocation ? { ptaxLocation } : {}),
                ...(taxRegime ? { taxRegime } : {}),
              }
            : undefined;

        const bankDetails =
          bankName || accountNumber || ifscCode
            ? {
                ...(bankName ? { bankName } : {}),
                ...(accountNumber ? { accountNumber } : {}),
                ...(ifscCode ? { ifscCode } : {}),
              }
            : undefined;

        const profileExtensions =
          fatherName || age || passportNumber || drivingLicenseNumber || bloodGroup || experienceYears ||
          subDepartment || qualification || course || university || passoutYear ||
          associateNoticePeriodDays || lwfLocation || alternateSaturdayOff || compoffApplicable
            ? {
                ...(fatherName ? { fatherName } : {}),
                ...(age ? { age } : {}),
                ...(passportNumber ? { passportNumber } : {}),
                ...(drivingLicenseNumber ? { drivingLicenseNumber } : {}),
                ...(bloodGroup ? { bloodGroup } : {}),
                ...(experienceYears ? { experienceYears } : {}),
                ...(subDepartment ? { subDepartment } : {}),
                ...(qualification ? { qualification } : {}),
                ...(course ? { course } : {}),
                ...(university ? { university } : {}),
                ...(passoutYear ? { passoutYear } : {}),
                ...(associateNoticePeriodDays ? { associateNoticePeriodDays } : {}),
                ...(lwfLocation ? { lwfLocation } : {}),
                ...(alternateSaturdayOff ? { alternateSaturdayOff } : {}),
                ...(compoffApplicable ? { compoffApplicable } : {}),
              }
            : undefined;

        const fixedGrossNum = parseFloat(String(fixedGross).replace(/,/g, '')) || 0;
        const vehicleAllowancesNum = parseFloat(String(vehicleAllowances).replace(/,/g, '')) || 0;
        const hasSalary = fixedGrossNum > 0 || vehicleAllowancesNum > 0;

        const emergencyContacts =
          emergencyContactName || emergencyContactNo || relationship
            ? [{ name: emergencyContactName || '', phone: emergencyContactNo || '', relationship: relationship || '' }]
            : undefined;

        const employmentTypeVal = String(getCellValue(row, ['employmentType', 'Emp Type', 'empType'])).trim().toUpperCase();
        const employmentType = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'].includes(employmentTypeVal) ? employmentTypeVal : undefined;

        const existingByEmail = orgEmployees?.some((e) => e.email?.toLowerCase() === finalEmail.toLowerCase());
        const existingEmpByCode = employeeCode && orgEmployees?.find((e) => (e as { employeeCode?: string }).employeeCode?.toLowerCase() === employeeCode.toLowerCase());

        if (existingEmpByCode) {
          const empId = existingEmpByCode.id;
          const updatePayload: Record<string, unknown> = {};
          if (positionId) updatePayload.positionId = positionId;
          if (departmentId) updatePayload.departmentId = departmentId;
          if (entityId) updatePayload.entityId = entityId;
          if (paygroupId) updatePayload.paygroupId = paygroupId;
          if (costCentreId) updatePayload.costCentreId = costCentreId;
          if (workLocation) updatePayload.workLocation = workLocation;
          if (placeOfTaxDeduction) updatePayload.placeOfTaxDeduction = placeOfTaxDeduction;
          if (reportingManagerName) pendingReportingManager.push({ employeeId: empId, reportingManagerName });
          if (profileExtensions && Object.keys(profileExtensions).length > 0) {
            const existingExt = (existingEmpByCode as { profileExtensions?: Record<string, unknown> }).profileExtensions as Record<string, unknown> | null | undefined;
            const merged = { ...(existingExt || {}), ...profileExtensions };
            updatePayload.profileExtensions = merged;
          }
          try {
            if (Object.keys(updatePayload).length > 0) {
              await employeeService.update(empId, updatePayload);
            }
            updated += 1;
          } catch (err: any) {
            console.warn('Failed to update existing employee', empId, err?.response?.data?.message || err?.message);
            failures.push({ row: index + 2, email, associateCode: employeeCode || undefined, message: err?.response?.data?.message || 'Failed to update existing employee' });
          }
          continue;
        }

        if (existingByEmail) {
          skipped += 1;
          continue;
        }

        try {
          const createResult = await employeeService.create({
            organizationId: effectiveOrganizationId,
            firstName: safeFirstName,
            lastName: finalLastName,
            email: finalEmail,
            dateOfJoining: finalDateOfJoining,
            ...(employeeCode ? { employeeCode } : {}),
            ...(middleName ? { middleName } : {}),
            ...(phone ? { phone } : {}),
            ...(officialEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(officialEmail) ? { officialEmail } : {}),
            ...(personalEmail ? { personalEmail } : {}),
            ...(dateOfBirth ? { dateOfBirth } : {}),
            ...(gender ? { gender: gender as 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY' } : {}),
            ...(maritalStatus ? { maritalStatus: maritalStatus as 'SINGLE' | 'MARRIED' | 'DIVORCED' | 'WIDOWED' } : {}),
            ...(employmentType ? { employmentType: employmentType as 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN' } : {}),
            ...(dateOfLeaving ? { dateOfLeaving } : {}),
            ...(positionId ? { positionId } : {}),
            ...(departmentId ? { departmentId } : {}),
            ...(entityId ? { entityId } : {}),
            ...(paygroupId ? { paygroupId } : {}),
            ...(reportingManagerId ? { reportingManagerId } : {}),
            ...(costCentreId ? { costCentreId } : {}),
            ...(workLocation ? { workLocation } : {}),
            ...(placeOfTaxDeduction ? { placeOfTaxDeduction } : {}),
            ...(address && Object.keys(address).length > 0 ? { address } : {}),
            ...(taxInformation && Object.keys(taxInformation).length > 0 ? { taxInformation } : {}),
            ...(bankDetails && Object.keys(bankDetails).length > 0 ? { bankDetails } : {}),
            ...(profileExtensions && Object.keys(profileExtensions).length > 0 ? { profileExtensions } : {}),
            ...(emergencyContacts ? { emergencyContacts } : {}),
          });
          success += 1;
          if (createResult?.employee?.id && (employeeCode || firstName || lastName)) {
            createdInBatch.push({
              id: createResult.employee.id,
              employeeCode: employeeCode || createResult.employee.employeeCode || '',
              firstName: safeFirstName,
              lastName: finalLastName,
            });
            if (reportingManagerName) {
              pendingReportingManager.push({ employeeId: createResult.employee.id, reportingManagerName });
            }
          }
          if (hasSalary && createResult?.employee?.id && finalDateOfJoining) {
            const gross = fixedGrossNum + vehicleAllowancesNum;
            try {
              await employeeSalaryService.createSalary({
                employeeId: createResult.employee.id,
                effectiveDate: finalDateOfJoining,
                basicSalary: Math.round(gross * 0.4),
                grossSalary: gross,
                netSalary: Math.round(gross * 0.75),
                paymentFrequency: 'MONTHLY',
                currency: 'INR',
                components: { 'Fixed Gross': fixedGrossNum, 'Vehicle Allowances': vehicleAllowancesNum },
              });
            } catch (salErr: any) {
              console.warn('Salary create failed for import row', index + 2, salErr?.response?.data?.message || salErr?.message);
            }
          }
        } catch (err: any) {
          const errMsg = String(err?.response?.data?.message || err?.message || '');
          const isDuplicate = /already exists|duplicate/i.test(errMsg);
          if (isDuplicate) {
            skipped += 1;
            continue;
          }
          let msg = errMsg || 'Failed to create employee';
          const errData = err?.response?.data;
          if (errData?.errors && Array.isArray(errData.errors)) {
            const details = errData.errors.map((e: { field?: string; message?: string }) => `${e.field || '?'}: ${e.message || ''}`).join('; ');
            if (details) msg = `Validation: ${details}`;
          }
          failures.push({
            row: index + 2,
            email,
            associateCode: employeeCode || undefined,
            message: msg,
          });
        }
      }

      // Second pass: set Reporting Manager (all managers now exist - either from batch or org)
      let managersSet = 0;
      for (const { employeeId, reportingManagerName } of pendingReportingManager) {
        const managerId = resolveReportingManagerId(reportingManagerName);
        if (managerId) {
          try {
            await employeeService.update(employeeId, { reportingManagerId: managerId });
            managersSet += 1;
          } catch (err: any) {
            console.warn('Failed to set reporting manager for', employeeId, err?.response?.data?.message || err?.message);
          }
        }
      }

      setImportResult({ total, success, updated, skipped, failures, managersSet });

      const params: any = {
        page: currentPage,
        limit: pageSize,
        listView: true,
        sortBy,
        sortOrder,
      };
      if (effectiveOrganizationId) params.organizationId = effectiveOrganizationId;
      if (searchTerm) params.search = searchTerm;
      params.employeeStatus = statusFilter;
      if (departmentFilter !== 'ALL') params.departmentId = departmentFilter;
      if (entityFilter !== 'ALL') params.entityId = entityFilter;
      if (paygroupFilter !== 'ALL') params.paygroupId = paygroupFilter;
      if (positionFilter !== 'ALL') params.positionId = positionFilter;
      await fetchEmployees(params);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Import failed';
      const isNetwork = !err?.response && (err?.code === 'ECONNREFUSED' || err?.message?.includes('Network'));
      alert(isNetwork ? 'Cannot connect to server. Please ensure the backend is running (npm run dev from project root).' : msg);
    } finally {
      setImportingEmployees(false);
    }
  };

  const handleDownloadImportTemplate = () => {
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

  // Show error if no organizationId (after trying to load user data). Super Admin can use "All" so skip.
  if (!organizationId && !loadingUser && !isSuperAdmin) {
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
        subtitle={effectiveOrganizationName ? `Organization: ${effectiveOrganizationName}` : undefined}
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
                disabled={isSuperAdmin && superAdminSelectedOrgId === 'ALL'}
                title={isSuperAdmin && superAdminSelectedOrgId === 'ALL' ? 'Select an organization to add employees' : undefined}
                className="h-9 px-4 py-2 rounded-lg bg-orange-500 text-white font-medium text-sm hover:bg-orange-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                + Add Employee
              </button>
            )}
            {(user?.role === 'SUPER_ADMIN' || user?.role === 'ORG_ADMIN' || user?.role === 'HR_MANAGER') && (
              <button
                onClick={() => {
                  setShowImportModal(true);
                  setImportResult(null);
                }}
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
                                  ? 'bg-green-100 text-green-800'
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
                                <div className="flex-1 min-w-0 bg-green-50 border border-green-200 rounded px-2 py-1">
                                  <p className="text-xs font-mono font-bold text-green-800 truncate">{showNewPassword}</p>
                                </div>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(showNewPassword || '');
                                    alert('Password copied!');
                                  }}
                                  className="text-green-600 hover:text-green-700 text-xs flex-shrink-0"
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
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updateFaceSaving ? 'Saving...' : 'Save face'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters Bar - equal-width boxes, labels above, match reference */}
      {!showCredentials && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4 mb-6">
          {isSuperAdmin && (
            <div className="flex flex-col">
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
          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-500 mb-1.5">Department</label>
            <select
              value={departmentFilter}
              onChange={(e) => { setDepartmentFilter(e.target.value); setCurrentPage(1); }}
              className="h-10 w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="ALL">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-500 mb-1.5">Entity</label>
            <select
              value={entityFilter}
              onChange={(e) => { setEntityFilter(e.target.value); setCurrentPage(1); }}
              className="h-10 w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="ALL">All Entities</option>
              {orgEntities.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>
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
            <label className="text-sm font-medium text-gray-500 mb-1.5">Paygroup</label>
            <select
              value={paygroupFilter}
              onChange={(e) => { setPaygroupFilter(e.target.value); setCurrentPage(1); }}
              className="h-10 w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="ALL">All Paygroups</option>
              {orgPaygroups.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
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
              <option value="ACTIVE">Active</option>
              <option value="SEPARATED">Separated Employees</option>
              <option value="ALL">All Status</option>
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
                <div className="text-2xl font-bold text-gray-900">
                  {statusFilter === 'ACTIVE' ? pagination.total : statusFilter === 'ALL' ? (statsActiveCount ?? '—') : employees.filter(e => e.employeeStatus === 'ACTIVE').length}
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
                  {statusFilter === 'ACTIVE' ? 0 : statusFilter === 'ALL' ? (statsActiveCount != null ? pagination.total - statsActiveCount : '—') : pagination.total}
                </div>
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
              const params: any = { page: currentPage, limit: pageSize, listView: true, sortBy, sortOrder };
              if (effectiveOrganizationId) params.organizationId = effectiveOrganizationId;
              if (searchTerm) params.search = searchTerm;
              params.employeeStatus = statusFilter;
              if (departmentFilter !== 'ALL') params.departmentId = departmentFilter;
              if (entityFilter !== 'ALL') params.entityId = entityFilter;
              if (paygroupFilter !== 'ALL') params.paygroupId = paygroupFilter;
              if (positionFilter !== 'ALL') params.positionId = positionFilter;
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paygroup</th>
                {user?.role === 'SUPER_ADMIN' && (
                  <>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Organization</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entity</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                  </>
                )}
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                <tr key={i}>
                  <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-16 animate-pulse" /></td>
                  <td className="px-6 py-4"><div className="flex items-center gap-3"><div className="h-10 w-10 bg-gray-200 rounded-full animate-pulse" /><div className="h-4 bg-gray-200 rounded w-28 animate-pulse" /></div></td>
                  <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-40 animate-pulse" /></td>
                  <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-20 animate-pulse" /></td>
                  {user?.role === 'SUPER_ADMIN' && (
                    <>
                      <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-24 animate-pulse" /></td>
                      <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-20 animate-pulse" /></td>
                      <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-20 animate-pulse" /></td>
                    </>
                  )}
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
                    {searchTerm || statusFilter !== 'ACTIVE' || departmentFilter !== 'ALL' || entityFilter !== 'ALL' || paygroupFilter !== 'ALL' || positionFilter !== 'ALL'
                      ? 'No employees found matching your filters'
                      : 'No employees yet. Create your first employee!'}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {employees.map((emp) => (
                      <div key={emp.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition">
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`flex-shrink-0 h-12 w-12 rounded-full flex items-center justify-center text-white font-medium text-sm ${getAvatarColor((toDisplayName(emp.firstName) + ' ' + toDisplayName(emp.lastName)).trim() || emp.employeeCode || ' ')}`}>
                            {toDisplayName(emp.firstName)?.[0] || ''}{toDisplayName(emp.lastName)?.[0] || ''}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-gray-900 truncate">{toDisplayName(emp.firstName)} {toDisplayName(emp.lastName)}</div>
                            <div className="text-xs text-gray-500 truncate">{toDisplayValue(emp.position?.title)}</div>
                            <div className="text-xs text-gray-400 font-mono">{emp.employeeCode}</div>
                          </div>
                        </div>
                        <div className="text-xs text-gray-600 space-y-1 mb-3">
                          <div className="truncate">{toDisplayEmail(emp.email)}</div>
                          {toDisplayValue(emp.department?.name) && <div>Dept: {toDisplayValue(emp.department?.name)}</div>}
                          {toDisplayValue((emp as any)?.profileExtensions?.subDepartment) && <div>Sub Dept: {toDisplayValue((emp as any)?.profileExtensions?.subDepartment)}</div>}
                          {toDisplayValue(emp.entity?.name) && <div>Entity: {toDisplayValue(emp.entity?.name)}</div>}
                          {emp.reportingManager && <div>Manager: {toDisplayName(emp.reportingManager.firstName)} {toDisplayName(emp.reportingManager.lastName)}</div>}
                          {user?.role === 'SUPER_ADMIN' && emp.organization?.name && <div>Org: {emp.organization.name}</div>}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <button type="button" onClick={() => handleView(emp)} disabled={loadingEmployee} title="View" className="p-1.5 rounded text-blue-600 hover:bg-blue-50 disabled:opacity-50">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          </button>
                          {canEditRow(emp) && (
                            <>
                              <button type="button" onClick={() => handleEdit(emp)} disabled={loadingEmployee} title="Edit" className="p-1.5 rounded text-indigo-600 hover:bg-indigo-50 disabled:opacity-50">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                              </button>
                              <button type="button" onClick={() => handleUpdateFaceOpen(emp)} title="Update face" className="p-1.5 rounded text-teal-600 hover:bg-teal-50 disabled:opacity-50">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                              </button>
                            </>
                          )}
                          {canDelete && (
                            <button type="button" onClick={() => handleDelete(emp.id)} title="Delete" className="p-1.5 rounded text-red-600 hover:bg-red-50">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
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
                <th className={`${user?.role === 'SUPER_ADMIN' ? 'w-[10%]' : 'w-[10%]'} px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider`}>
                  <button
                    type="button"
                    onClick={() => handleSort('employeeCode')}
                    className="inline-flex items-center hover:text-gray-700 focus:outline-none"
                  >
                    EMP ID
                    <SortIcon column="employeeCode" />
                  </button>
                </th>
                <th className={`${user?.role === 'SUPER_ADMIN' ? 'w-[14%]' : 'w-[24%]'} px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider`}>
                  <button
                    type="button"
                    onClick={() => handleSort('firstName')}
                    className="inline-flex items-center hover:text-gray-700 focus:outline-none"
                  >
                    NAME
                    <SortIcon column="firstName" />
                  </button>
                </th>
                <th className="w-[14%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="w-[10%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Designation</th>
                <th className="w-[10%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                <th className="w-[10%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sub Dept</th>
                <th className="w-[10%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entity</th>
                <th className="w-[10%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reporting Manager</th>
                <th className="w-[10%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paygroup</th>
                {user?.role === 'SUPER_ADMIN' && (
                  <th className="w-[10%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Organization</th>
                )}
                <th className="w-[12%] px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={user?.role === 'SUPER_ADMIN' ? 11 : 10} className="px-4 py-8 text-center text-gray-500">
                    {searchTerm || statusFilter !== 'ACTIVE' || departmentFilter !== 'ALL' || entityFilter !== 'ALL' || paygroupFilter !== 'ALL' || positionFilter !== 'ALL'
                      ? 'No employees found matching your filters'
                      : 'No employees yet. Create your first employee!'}
                  </td>
                </tr>
              ) : (
                employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-gray-50">
                    <td className="w-[10%] px-4 py-4 whitespace-nowrap text-sm font-mono text-gray-900 text-left truncate min-w-0">
                      {emp.employeeCode}
                    </td>
                    <td className="w-[14%] px-4 py-4 whitespace-nowrap text-left min-w-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center text-white font-medium text-sm ${getAvatarColor((toDisplayName(emp.firstName) + ' ' + toDisplayName(emp.lastName)).trim() || emp.employeeCode || ' ')}`}>
                          {toDisplayName(emp.firstName)?.[0] || ''}{toDisplayName(emp.lastName)?.[0] || ''}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {toDisplayName(emp.firstName)} {toDisplayName(emp.lastName)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="w-[14%] px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-left truncate min-w-0">{toDisplayEmail(emp.email)}</td>
                    <td className="w-[10%] px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-left truncate min-w-0">{toDisplayValue(emp.position?.title)}</td>
                    <td className="w-[10%] px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-left truncate min-w-0">{toDisplayValue(emp.department?.name)}</td>
                    <td className="w-[10%] px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-left truncate min-w-0">{toDisplayValue((emp as any)?.profileExtensions?.subDepartment)}</td>
                    <td className="w-[10%] px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-left truncate min-w-0">{toDisplayValue(emp.entity?.name)}</td>
                    <td className="w-[10%] px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-left truncate min-w-0">
                      {emp.reportingManager ? `${toDisplayName(emp.reportingManager.firstName)} ${toDisplayName(emp.reportingManager.lastName)}` : ''}
                    </td>
                    <td className="w-[10%] px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-left truncate min-w-0">{toDisplayValue(emp.paygroup?.name)}</td>
                    {user?.role === 'SUPER_ADMIN' && (
                      <td className="w-[10%] px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-left truncate min-w-0">{toDisplayValue(emp.organization?.name)}</td>
                    )}
                    <td className="w-[12%] px-4 py-4 whitespace-nowrap text-right text-sm font-medium min-w-0">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleView(emp)}
                          disabled={loadingEmployee}
                          title="View"
                          className="p-2 rounded text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        </button>
                        {canEditRow(emp) && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleEdit(emp)}
                              disabled={loadingEmployee}
                              title="Edit"
                              className="p-2 rounded text-indigo-600 hover:bg-indigo-50 disabled:opacity-50"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateFaceOpen(emp)}
                              title="Update face"
                              className="p-2 rounded text-teal-600 hover:bg-teal-50 disabled:opacity-50"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                            </button>
                          </>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => handleDelete(emp.id)}
                            title="Delete"
                            className="p-2 rounded text-red-600 hover:bg-red-50"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
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
      {/* Paygroup Selection Modal (Create flow only) */}
      {effectiveOrganizationId && (
        <PaygroupSelectionModal
          isOpen={showPaygroupModal}
          onClose={() => setShowPaygroupModal(false)}
          organizationId={effectiveOrganizationId}
          onSubmit={handlePaygroupSubmit}
        />
      )}

      {/* Employee Form Modal - full width for large form */}
      <Modal
        isOpen={showForm}
        onClose={handleFormCancel}
        title={rejoinMode ? 'Employee Rejoin' : editingEmployee ? (viewMode ? 'View Employee' : 'Edit Employee') : 'Create Employee'}
        size="full"
      >
        {(effectiveOrganizationId || editingEmployee?.organizationId) && (
          <EmployeeForm
            key={editingEmployee?.id ?? 'create'}
            employee={editingEmployee}
            organizationId={effectiveOrganizationId ?? editingEmployee?.organizationId ?? ''}
            initialPaygroupId={selectedPaygroupId ?? undefined}
            initialPaygroupName={selectedPaygroupName ?? undefined}
            onSuccess={handleFormSuccess}
            onCancel={handleFormCancel}
            mode={editingEmployee && viewMode ? 'view' : 'edit'}
            rejoinMode={rejoinMode}
            editableTabs={
              rejoinMode ? undefined : editingEmployee && !viewMode
                ? canUpdateByRole
                  ? undefined
                  : (editableTabsFromPermissions ?? ((user?.role === 'EMPLOYEE' || user?.role === 'MANAGER') && user?.employee?.id === editingEmployee.id ? (['personal', 'academic', 'previousEmployment', 'family'] as EmployeeFormTabKey[]) : undefined))
                : undefined
            }
          />
        )}
      </Modal>

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
              <p>Created successfully: <strong className="text-green-700">{importResult.success}</strong></p>
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
      </main>
    </div>
  );
}
