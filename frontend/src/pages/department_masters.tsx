import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';
import { getModulePermissions } from '../config/configurator-module-mapping';
import configuratorDataService, {
  ConfigDepartment,
  ConfigSubDepartment,
  ConfigCostCentre,
} from '../services/configurator-data.service';
import positionService from '../services/position.service';
import entityService from '../services/entity.service';
import type { Position } from '../services/position.service';
import type { Entity } from '../services/entity.service';
import api from '../services/api';

/* ─── Types ─────────────────────────────────────────────────────── */

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'department', label: 'Department' },
  { key: 'subDepartment', label: 'Sub Department' },
  { key: 'costCentre', label: 'Cost Centre' },
  { key: 'designation', label: 'Designation' },
  { key: 'entity', label: 'Entity' },
];

const PAGE_SIZE_OPTIONS = [10, 20, 50];

interface TableRow {
  id: string;
  rawId: number | string;
  name: string;
  code: string;
  type: 'Department' | 'Sub Department' | 'Cost Centre' | 'Designation' | 'Entity';
  status: string;
  costCentreId?: number;
  costCentreName?: string;
  departmentId?: number;
  departmentName?: string;
  costcenterId?: number;
  [key: string]: string | number | undefined;
}

type ModalType = 'addDept' | 'addSubDept' | 'addCC' | 'editDept' | 'editSubDept' | 'editCC' | 'addDesig' | 'editDesig' | 'addEntity' | 'editEntity' | null;

type BulkUploadType = 'costCentre' | 'department' | 'subDepartment' | 'designation' | 'entity';

interface BulkUploadResult {
  total: number;
  created: number;
  skipped: number;
  failed: number;
  failures: { row: number; name: string; message: string }[];
}

const BULK_UPLOAD_CONFIG: Record<BulkUploadType, { label: string; color: string; gradient: string; downloadUrl: string; uploadUrl: string }> = {
  costCentre: {
    label: 'Cost Centre',
    color: 'emerald',
    gradient: 'from-emerald-500 to-teal-600',
    downloadUrl: '/cost-centres/download-excel',
    uploadUrl: '/cost-centres/upload-excel',
  },
  department: {
    label: 'Department',
    color: 'blue',
    gradient: 'from-blue-500 to-indigo-600',
    downloadUrl: '/departments/download-excel',
    uploadUrl: '/departments/upload-excel',
  },
  subDepartment: {
    label: 'Sub Department',
    color: 'purple',
    gradient: 'from-purple-500 to-violet-600',
    downloadUrl: '/sub-departments/download-excel',
    uploadUrl: '/sub-departments/upload-excel',
  },
  designation: {
    label: 'Designation',
    color: 'amber',
    gradient: 'from-amber-500 to-yellow-600',
    downloadUrl: '/positions/download-excel',
    uploadUrl: '/positions/upload-excel',
  },
  entity: {
    label: 'Entity',
    color: 'teal',
    gradient: 'from-teal-500 to-cyan-600',
    downloadUrl: '/entities/download-excel',
    uploadUrl: '/entities/upload-excel',
  },
};

/* ─── Component ─────────────────────────────────────────────────── */

export default function DepartmentMastersPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const organizationName = (user as any)?.employee?.organization?.name;
  const organizationId =
    (user as any)?.employee?.organizationId ||
    (user as any)?.employee?.organization?.id ||
    (user as any)?.organizationId;

  const permsA = getModulePermissions('/department-masters');
  const permsB = getModulePermissions('/departments');
  const modulePerms = permsA.can_view ? permsA : permsB;
  const canAdd = modulePerms.can_add;
  const canEdit = modulePerms.can_edit;
  const canDelete = modulePerms.can_delete;

  /* ── Core state ── */
  const [activeTab, setActiveTab] = useState('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  /* ── Raw API data ── */
  const [departments, setDepartments] = useState<ConfigDepartment[]>([]);
  const [subDepartments, setSubDepartments] = useState<ConfigSubDepartment[]>([]);
  const [costCentres, setCostCentres] = useState<ConfigCostCentre[]>([]);
  const [designations, setDesignations] = useState<Position[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [tableData, setTableData] = useState<TableRow[]>([]);

  /* ── Modal state ── */
  const [modalType, setModalType] = useState<ModalType>(null);
  const [modalName, setModalName] = useState('');
  const [modalCode, setModalCode] = useState('');
  const [modalCostCentreId, setModalCostCentreId] = useState<number | ''>('');
  const [modalDepartmentId, setModalDepartmentId] = useState<number | ''>('');
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');
  const [editingRow, setEditingRow] = useState<TableRow | null>(null);

  /* ── Delete confirm state ── */
  const [deleteRow, setDeleteRow] = useState<TableRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  /* ── Bulk Upload state ── */
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [bulkUploadType, setBulkUploadType] = useState<BulkUploadType>('costCentre');
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkUploadResult | null>(null);
  const [bulkError, setBulkError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── Toast ── */
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleLogout = async () => { await logout(); navigate('/login'); };

  /* ── Fetch helpers ── */

  const fetchDepartments = useCallback(async () => {
    const list = await configuratorDataService.getDepartments();
    setDepartments(list);
    return list;
  }, []);

  const fetchSubDepartments = useCallback(async () => {
    const list = await configuratorDataService.getSubDepartments();
    setSubDepartments(list);
    return list;
  }, []);

  const fetchCostCentres = useCallback(async () => {
    const list = await configuratorDataService.getCostCentres();
    setCostCentres(list);
    return list;
  }, []);

  const fetchDesignations = useCallback(async () => {
    if (!organizationId) return [];
    const result = await positionService.getAll({ organizationId, isActive: true, limit: 1000 });
    const list = result.positions;
    setDesignations(list);
    return list;
  }, [organizationId]);

  const fetchEntities = useCallback(async () => {
    if (!organizationId) return [];
    const list = await entityService.getByOrganization(organizationId);
    setEntities(list);
    return list;
  }, [organizationId]);

  /* ── Build table rows ── */

  const buildTableData = useCallback((tab: string, deptList: ConfigDepartment[], subDeptList: ConfigSubDepartment[], ccList: ConfigCostCentre[], desigList: Position[], entityList: Entity[]) => {
    let rows: TableRow[] = [];

    if (tab === 'all' || tab === 'costCentre') {
      rows = rows.concat(ccList.map((c) => ({
        id: `cc-${c.id}`, rawId: c.id, name: c.name || '—', code: c.code || '—',
        type: 'Cost Centre' as const, status: c.is_active !== false ? 'Active' : 'Inactive',
      })));
    }
    if (tab === 'all' || tab === 'department') {
      rows = rows.concat(deptList.map((d) => ({
        id: `dept-${d.id}`, rawId: d.id, name: d.name || '—', code: d.code || '—',
        type: 'Department' as const, status: d.is_active !== false ? 'Active' : 'Inactive',
        costCentreId: d.cost_centre_id,
        costCentreName: ccList.find((c) => c.id === d.cost_centre_id)?.name || '—',
      })));
    }
    if (tab === 'all' || tab === 'subDepartment') {
      rows = rows.concat(subDeptList.map((s) => ({
        id: `sub-${s.id}`, rawId: s.id, name: s.name || '—', code: s.code || '—',
        type: 'Sub Department' as const, status: s.is_active !== false ? 'Active' : 'Inactive',
        departmentId: s.department_id, costcenterId: s.costcenter_id,
        departmentName: deptList.find((d) => d.id === s.department_id)?.name || '—',
      })));
    }
    if (tab === 'all' || tab === 'designation') {
      rows = rows.concat(desigList.map((p) => ({
        id: `desig-${p.id}`, rawId: p.id, name: p.title || '—', code: p.code || '—',
        type: 'Designation' as const, status: p.isActive ? 'Active' : 'Inactive',
      })));
    }
    if (tab === 'all' || tab === 'entity') {
      rows = rows.concat(entityList.map((e) => ({
        id: `ent-${e.id}`, rawId: e.id, name: e.name || '—', code: e.code || '—',
        type: 'Entity' as const, status: (e as any).isActive !== false ? 'Active' : 'Inactive',
      })));
    }
    return rows;
  }, []);

  /* ── Load data ── */

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ccList, deptList, subDeptList, desigList, entityList] = await Promise.all([
        fetchCostCentres(), fetchDepartments(), fetchSubDepartments(), fetchDesignations(), fetchEntities(),
      ]);
      setTableData(buildTableData(activeTab, deptList, subDeptList, ccList, desigList, entityList));
    } catch (err: unknown) {
      const message = err && typeof err === 'object' && 'response' in err
        ? (err as any).response?.data?.message : 'Failed to load data';
      setError(String(message || 'Failed to load data'));
      setTableData([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, fetchDepartments, fetchSubDepartments, fetchCostCentres, fetchDesignations, fetchEntities, buildTableData]);

  useEffect(() => { loadData(); }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Refresh after mutation ── */
  const refreshAll = async () => {
    try {
      const [ccList, deptList, subDeptList, desigList, entityList] = await Promise.all([
        fetchCostCentres(), fetchDepartments(), fetchSubDepartments(), fetchDesignations(), fetchEntities(),
      ]);
      setTableData(buildTableData(activeTab, deptList, subDeptList, ccList, desigList, entityList));
    } catch { /* loadData will catch */ }
  };

  /* ── Modal open helpers ── */

  const openAddDept = () => { setModalType('addDept'); setModalName(''); setModalCode(''); setModalCostCentreId(''); setModalError(''); };
  const openAddSubDept = () => { setModalType('addSubDept'); setModalName(''); setModalCode(''); setModalDepartmentId(''); setModalCostCentreId(''); setModalError(''); };
  const openAddCC = () => { setModalType('addCC'); setModalName(''); setModalCode(''); setModalError(''); };
  const openAddDesig = () => { setModalType('addDesig'); setModalName(''); setModalCode(''); setModalError(''); };
  const openAddEntity = () => { setModalType('addEntity'); setModalName(''); setModalCode(''); setModalError(''); };

  const openEdit = (row: TableRow) => {
    setEditingRow(row);
    setModalName(row.name === '—' ? '' : row.name);
    setModalCode(row.code === '—' ? '' : row.code);
    setModalError('');
    if (row.type === 'Department') {
      setModalType('editDept');
      setModalCostCentreId(row.costCentreId ?? '');
    } else if (row.type === 'Sub Department') {
      setModalType('editSubDept');
      setModalDepartmentId(row.departmentId ?? '');
      setModalCostCentreId(row.costcenterId ?? '');
    } else if (row.type === 'Designation') {
      setModalType('editDesig');
    } else if (row.type === 'Entity') {
      setModalType('editEntity');
    } else {
      setModalType('editCC');
    }
  };

  const closeModal = () => { setModalType(null); setEditingRow(null); setModalLoading(false); setModalError(''); setModalCode(''); };

  /* ── Modal submit ── */

  const handleModalSubmit = async () => {
    if (!modalName.trim()) { setModalError('Name is required'); return; }
    setModalLoading(true);
    setModalError('');
    try {
      if (modalType === 'addCC') {
        await configuratorDataService.createCostCentre(modalName.trim());
        setToast({ msg: 'Cost Centre created', type: 'success' });
      } else if (modalType === 'addDept') {
        if (!modalCostCentreId) { setModalError('Select a Cost Centre'); setModalLoading(false); return; }
        await configuratorDataService.createDepartment(modalName.trim(), Number(modalCostCentreId));
        setToast({ msg: 'Department created', type: 'success' });
      } else if (modalType === 'addSubDept') {
        if (!modalDepartmentId) { setModalError('Select a Department'); setModalLoading(false); return; }
        await configuratorDataService.createSubDepartment(modalName.trim(), Number(modalDepartmentId), modalCostCentreId ? Number(modalCostCentreId) : undefined);
        setToast({ msg: 'Sub Department created', type: 'success' });
      } else if (modalType === 'editCC' && editingRow) {
        await configuratorDataService.editCostCentre(editingRow.rawId as number, modalName.trim());
        setToast({ msg: 'Cost Centre updated', type: 'success' });
      } else if (modalType === 'editDept' && editingRow) {
        await configuratorDataService.editDepartment(editingRow.rawId as number, modalName.trim(), Number(modalCostCentreId) || 0);
        setToast({ msg: 'Department updated', type: 'success' });
      } else if (modalType === 'editSubDept' && editingRow) {
        await configuratorDataService.editSubDepartment(editingRow.rawId as number, modalName.trim(), Number(modalDepartmentId) || 0, modalCostCentreId ? Number(modalCostCentreId) : undefined);
        setToast({ msg: 'Sub Department updated', type: 'success' });
      } else if (modalType === 'addDesig') {
        await positionService.create({ organizationId, title: modalName.trim(), code: modalCode.trim() || undefined });
        setToast({ msg: 'Designation created', type: 'success' });
      } else if (modalType === 'editDesig' && editingRow) {
        await positionService.update(String(editingRow.rawId), { title: modalName.trim(), code: modalCode.trim() || undefined });
        setToast({ msg: 'Designation updated', type: 'success' });
      } else if (modalType === 'addEntity') {
        await entityService.create({ organizationId, name: modalName.trim(), code: modalCode.trim() || null });
        setToast({ msg: 'Entity created', type: 'success' });
      } else if (modalType === 'editEntity' && editingRow) {
        await entityService.update(String(editingRow.rawId), { name: modalName.trim(), code: modalCode.trim() || null });
        setToast({ msg: 'Entity updated', type: 'success' });
      }
      closeModal();
      await refreshAll();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const msg = Array.isArray(detail) ? detail.map((d: any) => d.msg).join('; ')
        : typeof detail === 'string' ? detail
        : err?.response?.data?.message || err?.message || 'Operation failed';
      setModalError(msg);
    } finally {
      setModalLoading(false);
    }
  };

  /* ── Delete ── */

  const handleDelete = async () => {
    if (!deleteRow) return;
    setDeleteLoading(true);
    try {
      if (deleteRow.type === 'Cost Centre') {
        await configuratorDataService.deleteCostCentre(deleteRow.rawId as number);
      } else if (deleteRow.type === 'Department') {
        await configuratorDataService.deleteDepartment(deleteRow.rawId as number);
      } else if (deleteRow.type === 'Sub Department') {
        await configuratorDataService.deleteSubDepartment(deleteRow.rawId as number);
      } else if (deleteRow.type === 'Designation') {
        await positionService.update(String(deleteRow.rawId), { isActive: false });
      } else if (deleteRow.type === 'Entity') {
        await entityService.delete(String(deleteRow.rawId));
      }
      setToast({ msg: `${deleteRow.type} deleted`, type: 'success' });
      setDeleteRow(null);
      await refreshAll();
    } catch (err: any) {
      console.error('[DepartmentMasters.handleDelete] FAILED:', {
        type: deleteRow.type,
        rawId: deleteRow.rawId,
        status: err?.response?.status,
        statusText: err?.response?.statusText,
        responseData: err?.response?.data,
        message: err?.message,
      });
      const detail = err?.response?.data?.detail;
      const msg = Array.isArray(detail) ? detail.map((d: any) => d.msg || d.message || JSON.stringify(d)).join('; ')
        : typeof detail === 'string' ? detail
        : err?.response?.data?.message || err?.response?.statusText || err?.message || 'Delete failed';
      setToast({ msg: typeof msg === 'string' ? msg : 'Delete failed', type: 'error' });
      setDeleteRow(null);
    } finally {
      setDeleteLoading(false);
    }
  };

  /* ── Bulk Upload helpers ── */

  const openBulkUpload = () => {
    setBulkUploadOpen(true);
    setBulkUploadType('costCentre');
    setBulkFile(null);
    setBulkResult(null);
    setBulkError('');
  };

  const closeBulkUpload = () => {
    if (bulkUploading) return;
    setBulkUploadOpen(false);
    setBulkFile(null);
    setBulkResult(null);
    setBulkError('');
  };

  const handleBulkDownload = async () => {
    if (!organizationId) { setBulkError('Organization not found. Please login again.'); return; }
    setBulkDownloading(true);
    setBulkError('');
    try {
      const cfg = BULK_UPLOAD_CONFIG[bulkUploadType];
      const configToken = localStorage.getItem('configuratorAccessToken') || '';
      const res = await api.get(`${cfg.downloadUrl}?organizationId=${organizationId}`, {
        responseType: 'blob',
        headers: { ...(configToken ? { 'X-Configurator-Token': configToken } : {}) },
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cfg.label.replace(/\s+/g, '_').toLowerCase()}_template_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setBulkError(err?.response?.data?.message || err?.message || 'Download failed');
    } finally {
      setBulkDownloading(false);
    }
  };

  const handleBulkUpload = async () => {
    if (!bulkFile) { setBulkError('Please select an Excel file first.'); return; }
    if (!organizationId) { setBulkError('Organization not found. Please login again.'); return; }
    setBulkUploading(true);
    setBulkError('');
    setBulkResult(null);
    try {
      const cfg = BULK_UPLOAD_CONFIG[bulkUploadType];
      const formData = new FormData();
      formData.append('file', bulkFile);
      formData.append('organizationId', organizationId);
      const configToken = localStorage.getItem('configuratorAccessToken') || '';
      const res = await api.post(cfg.uploadUrl, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          ...(configToken ? { 'X-Configurator-Token': configToken } : {}),
        },
        timeout: 120000,
      });
      setBulkResult(res.data.data);
      if (res.data.data?.created > 0) {
        setToast({ msg: `${res.data.data.created} ${cfg.label}(s) created successfully`, type: 'success' });
        await refreshAll();
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Upload failed';
      setBulkError(msg);
    } finally {
      setBulkUploading(false);
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && /\.(xlsx|xls|csv)$/i.test(file.name)) {
      setBulkFile(file);
      setBulkError('');
      setBulkResult(null);
    } else {
      setBulkError('Only Excel (.xlsx, .xls) files are allowed');
    }
  };

  /* ── Search / Pagination ── */

  const filteredData = searchTerm.trim()
    ? tableData.filter((r) =>
        r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.type.toLowerCase().includes(searchTerm.toLowerCase()))
    : tableData;

  const totalItems = filteredData.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const paginatedData = filteredData.slice(startIdx, startIdx + pageSize);
  const startEntry = totalItems === 0 ? 0 : startIdx + 1;
  const endEntry = Math.min(startIdx + pageSize, totalItems);

  /* ── Summary counts ── */

  const deptCount = departments.length;
  const subDeptCount = subDepartments.length;
  const ccCount = costCentres.length;
  const desigCount = designations.length;
  const entityCount = entities.length;

  /* ── Columns ── */

  const getColumns = () => {
    const base: { key: string; label: string; width?: string }[] = [
      { key: 'sno', label: 'S.No', width: '60px' },
      { key: 'name', label: 'Name' },
      { key: 'code', label: 'Code' },
    ];
    if (activeTab === 'all') base.push({ key: 'type', label: 'Type' });
    if (activeTab === 'all' || activeTab === 'department') base.push({ key: 'costCentreName', label: 'Cost Centre' });
    if (activeTab === 'all' || activeTab === 'subDepartment') base.push({ key: 'departmentName', label: 'Department' });
    base.push({ key: 'status', label: 'Status' });
    base.push({ key: 'actions', label: 'Actions', width: '120px' });
    return base;
  };
  const columns = getColumns();

  /* ── Modal title ── */

  const modalTitle = modalType === 'addCC' ? 'Add Cost Centre'
    : modalType === 'addDept' ? 'Add Department'
    : modalType === 'addSubDept' ? 'Add Sub Department'
    : modalType === 'editCC' ? 'Edit Cost Centre'
    : modalType === 'editDept' ? 'Edit Department'
    : modalType === 'editSubDept' ? 'Edit Sub Department'
    : modalType === 'addDesig' ? 'Add Designation'
    : modalType === 'editDesig' ? 'Edit Designation'
    : modalType === 'addEntity' ? 'Add Entity'
    : modalType === 'editEntity' ? 'Edit Entity' : '';

  const modalColor = (modalType?.includes('CC') || modalType?.includes('costCentre')) ? 'emerald'
    : (modalType?.includes('SubDept') || modalType?.includes('subDepartment')) ? 'purple'
    : (modalType?.includes('Desig')) ? 'amber'
    : (modalType?.includes('Entity')) ? 'teal' : 'blue';

  /* ── Guard ── */

  const hasCompanyId = !!localStorage.getItem('configuratorCompanyId');
  if (!hasCompanyId) {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
        <AppHeader title="Department Masters" subtitle={organizationName ? organizationName : undefined} onLogout={handleLogout} />
        <main className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-6 bg-gray-50">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-700 text-sm">
            No Configurator company found. Please ensure your account is linked to an organization with a Configurator company.
          </div>
        </main>
      </div>
    );
  }

  /* ── Type color helper ── */

  const typeColors: Record<string, string> = {
    'Department': 'bg-blue-100 text-blue-800',
    'Sub Department': 'bg-purple-100 text-purple-800',
    'Cost Centre': 'bg-blue-100 text-blue-800',
    'Designation': 'bg-amber-100 text-amber-800',
    'Entity': 'bg-teal-100 text-teal-800',
  };

  const bulkCfg = BULK_UPLOAD_CONFIG[bulkUploadType];

  /* ── Render ── */

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader title="Department Masters" subtitle={organizationName ? organizationName : undefined} onLogout={handleLogout} />

      <main className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-6 bg-gray-50">
        <div className="w-full max-w-[1600px] mx-auto">

          {/* Breadcrumbs */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
            <nav className="flex items-center gap-1.5 text-sm text-gray-500">
              <span className="font-semibold text-gray-900">Masters</span>
              <span className="mx-1 text-gray-400">/</span>
              <span className="text-gray-500">Department Masters</span>
            </nav>
          </div>

          {/* ── Add Buttons + Bulk Upload ── */}
          {canAdd && (
          <div className="flex flex-wrap gap-3 mb-6">
            <button type="button" onClick={openAddDept}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add Department
            </button>
            <button type="button" onClick={openAddSubDept}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 shadow-sm transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add Sub Department
            </button>
            <button type="button" onClick={openAddCC}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add Cost Centre
            </button>
            <button type="button" onClick={openAddDesig}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 shadow-sm transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add Designation
            </button>
            <button type="button" onClick={openAddEntity}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 shadow-sm transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add Entity
            </button>
            <button type="button" onClick={openBulkUpload}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-sm transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
              Bulk Upload
            </button>
          </div>
          )}

          {/* ── Tab Filters ── */}
          <div className="flex flex-wrap gap-2 mb-6">
            {TABS.map((tab) => (
              <button key={tab.key} type="button"
                onClick={() => { setActiveTab(tab.key); setPage(1); setSearchTerm(''); }}
                className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === tab.key ? 'bg-orange-500 text-white shadow-sm' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'}`}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Search ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-500 mb-1.5">Search</label>
              <input type="text" placeholder="Search by name, code..." value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                className="h-10 w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-700 placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-orange-500" />
            </div>
          </div>

          {/* ── Summary Cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <SummaryCard label="Total Records" count={totalItems} color="#333333" icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />} />
            <SummaryCard label="Departments" count={deptCount} color="#3B82F6" icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />} />
            <SummaryCard label="Sub Departments" count={subDeptCount} color="#A855F7" icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />} />
            <SummaryCard label="Cost Centres" count={ccCount} color="#10B981" icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />} />
            <SummaryCard label="Designations" count={desigCount} color="#D97706" icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />} />
            <SummaryCard label="Entities" count={entityCount} color="#0D9488" icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />} />
          </div>

          {/* ── Error ── */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              <p className="font-semibold">Error loading data</p>
              <p className="text-sm mt-1">{error}</p>
              <button onClick={loadData} className="mt-2 text-sm underline hover:no-underline">Try again</button>
            </div>
          )}

          {/* ── Table ── */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>Row Per Page</span>
                <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                  className="h-9 px-3 py-1 bg-white border border-gray-300 rounded text-gray-700 focus:ring-2 focus:ring-orange-500 focus:border-orange-500">
                  {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n} Entries</option>)}
                </select>
              </div>
              <div className="text-sm text-gray-500">
                Viewing: <span className="font-medium capitalize">{activeTab === 'all' ? 'All Records' : TABS.find((t) => t.key === activeTab)?.label}</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {columns.map((col) => (
                      <th key={col.key} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={col.width ? { width: col.width } : undefined}>
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-gray-500">
                      <span className="inline-flex items-center gap-2">
                        <svg className="animate-spin w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                        Loading...
                      </span>
                    </td></tr>
                  ) : paginatedData.length === 0 ? (
                    <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-gray-500">No records found.</td></tr>
                  ) : (
                    paginatedData.map((row, idx) => (
                      <tr key={row.id} className="hover:bg-gray-50">
                        {columns.map((col) => {
                          if (col.key === 'sno') return <td key={col.key} className="px-4 py-3 text-sm text-gray-600">{startIdx + idx + 1}</td>;
                          if (col.key === 'status') return (
                            <td key={col.key} className="px-4 py-3">
                              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${row.status === 'Active' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}`}>{row.status}</span>
                            </td>
                          );
                          if (col.key === 'type') return (
                            <td key={col.key} className="px-4 py-3">
                              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${typeColors[row.type] || ''}`}>{row.type}</span>
                            </td>
                          );
                          if (col.key === 'actions') return (
                            <td key={col.key} className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                {canEdit && (
                                  <button type="button" onClick={() => openEdit(row)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition" title="Edit">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                  </button>
                                )}
                                {canDelete && (
                                  <button type="button" onClick={() => setDeleteRow(row)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition" title="Delete">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                  </button>
                                )}
                              </div>
                            </td>
                          );
                          return <td key={col.key} className="px-4 py-3 text-sm text-gray-900">{row[col.key] != null ? String(row[col.key]) : '—'}</td>;
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {totalItems > 0 && (
              <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between flex-wrap gap-2">
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{startEntry}</span> to <span className="font-medium">{endEntry}</span> of <span className="font-medium">{totalItems}</span> results
                </p>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">Previous</button>
                  <span className="px-3 py-1.5 text-sm text-gray-600">Page {safePage} of {totalPages}</span>
                  <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">Next</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── Toast ── */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium animate-slide-in ${toast.type === 'success' ? 'bg-blue-500' : 'bg-red-500'}`}>
          {toast.msg}
          <button onClick={() => setToast(null)} className="ml-2 opacity-70 hover:opacity-100">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {/* ── Add/Edit Modal ── */}
      {modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !modalLoading && closeModal()} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            {/* Header */}
            <div className={`px-6 py-4 bg-gradient-to-r ${modalColor === 'amber' ? 'from-amber-500 to-amber-600' : modalColor === 'teal' ? 'from-teal-500 to-teal-600' : modalColor === 'blue' ? 'from-blue-500 to-blue-600' : modalColor === 'purple' ? 'from-purple-500 to-purple-600' : 'from-blue-500 to-blue-600'}`}>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">{modalTitle}</h3>
                <button onClick={() => !modalLoading && closeModal()} className="text-white/80 hover:text-white">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            {/* Body */}
            <div className="p-6 space-y-4">
              {modalError && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{modalError}</div>}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
                <input type="text" value={modalName} onChange={(e) => { setModalName(e.target.value); setModalError(''); }} autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && !modalLoading && handleModalSubmit()}
                  placeholder="Enter name" className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>

              {/* Cost Centre dropdown for Department */}
              {(modalType === 'addDept' || modalType === 'editDept') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cost Centre <span className="text-red-500">*</span></label>
                  <select value={modalCostCentreId} onChange={(e) => setModalCostCentreId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    <option value="">-- Select Cost Centre --</option>
                    {costCentres.map((cc) => <option key={cc.id} value={cc.id}>{cc.name}</option>)}
                  </select>
                </div>
              )}

              {/* Department dropdown for Sub Department */}
              {(modalType === 'addSubDept' || modalType === 'editSubDept') && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Department <span className="text-red-500">*</span></label>
                    <select value={modalDepartmentId} onChange={(e) => setModalDepartmentId(e.target.value ? Number(e.target.value) : '')}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent">
                      <option value="">-- Select Department --</option>
                      {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cost Centre <span className="text-gray-400">(optional)</span></label>
                    <select value={modalCostCentreId} onChange={(e) => setModalCostCentreId(e.target.value ? Number(e.target.value) : '')}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent">
                      <option value="">-- Select Cost Centre --</option>
                      {costCentres.map((cc) => <option key={cc.id} value={cc.id}>{cc.name}</option>)}
                    </select>
                  </div>
                </>
              )}

              {/* Code field for Designation and Entity */}
              {(modalType === 'addDesig' || modalType === 'editDesig' || modalType === 'addEntity' || modalType === 'editEntity') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Code <span className="text-gray-400">(optional)</span></label>
                  <input type="text" value={modalCode} onChange={(e) => setModalCode(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !modalLoading && handleModalSubmit()}
                    placeholder="Enter code" className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
              )}
            </div>
            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
              <button onClick={() => !modalLoading && closeModal()} disabled={modalLoading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">Cancel</button>
              <button onClick={handleModalSubmit} disabled={modalLoading || !modalName.trim()}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition ${modalColor === 'amber' ? 'bg-amber-600 hover:bg-amber-700' : modalColor === 'teal' ? 'bg-teal-600 hover:bg-teal-700' : modalColor === 'blue' ? 'bg-blue-600 hover:bg-blue-700' : modalColor === 'purple' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {modalLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    Saving...
                  </span>
                ) : modalType?.startsWith('edit') ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deleteRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !deleteLoading && setDeleteRow(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-red-500 to-red-600">
              <h3 className="text-lg font-semibold text-white">Confirm Delete</h3>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-700">
                Are you sure you want to {deleteRow.type === 'Designation' || deleteRow.type === 'Entity' ? 'deactivate' : 'delete'} <span className="font-semibold">{deleteRow.type}</span>: <span className="font-semibold">"{deleteRow.name}"</span>?
              </p>
              <p className="text-xs text-gray-500 mt-2">{deleteRow.type === 'Designation' || deleteRow.type === 'Entity' ? 'This will mark the record as inactive.' : 'This action cannot be undone.'}</p>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
              <button onClick={() => setDeleteRow(null)} disabled={deleteLoading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">Cancel</button>
              <button onClick={handleDelete} disabled={deleteLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 transition">
                {deleteLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    Deleting...
                  </span>
                ) : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Upload Modal ── */}
      {bulkUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeBulkUpload} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
            {/* Header */}
            <div className={`px-6 py-5 bg-gradient-to-r ${bulkCfg.gradient}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">Bulk Upload</h3>
                  <p className="text-white/80 text-sm mt-0.5">Import data from Excel file</p>
                </div>
                <button onClick={closeBulkUpload} className="text-white/80 hover:text-white p-1">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Type Selector */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Select Type</label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {(['costCentre', 'department', 'subDepartment', 'designation', 'entity'] as BulkUploadType[]).map((t) => {
                    const cfg = BULK_UPLOAD_CONFIG[t];
                    const isActive = bulkUploadType === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => { setBulkUploadType(t); setBulkFile(null); setBulkResult(null); setBulkError(''); }}
                        className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all border-2 ${
                          isActive
                            ? 'border-orange-400 bg-orange-50 text-orange-700 shadow-sm'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 1: Download Template */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold">1</div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-gray-800">Download Sample Excel</h4>
                    <p className="text-xs text-gray-500 mt-0.5 mb-2">Download the template, fill in your data, then upload it below.</p>
                    <button
                      type="button"
                      onClick={handleBulkDownload}
                      disabled={bulkDownloading}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition shadow-sm"
                    >
                      {bulkDownloading ? (
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      )}
                      Download Template
                    </button>
                  </div>
                </div>
              </div>

              {/* Step 2: Upload File */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-sm font-bold">2</div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-gray-800">Upload Filled Excel</h4>
                    <p className="text-xs text-gray-500 mt-0.5 mb-3">Drag & drop or click to select your filled Excel file.</p>

                    {/* Drag & Drop Area */}
                    <div
                      className={`relative border-2 border-dashed rounded-xl p-5 text-center transition-all cursor-pointer ${
                        dragOver ? 'border-orange-400 bg-orange-50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-100'
                      }`}
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={handleFileDrop}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.xls"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) { setBulkFile(file); setBulkError(''); setBulkResult(null); }
                          e.target.value = '';
                        }}
                      />
                      {bulkFile ? (
                        <div className="flex items-center justify-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-medium text-gray-800">{bulkFile.name}</p>
                            <p className="text-xs text-gray-500">{(bulkFile.size / 1024).toFixed(1)} KB</p>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setBulkFile(null); setBulkResult(null); }}
                            className="ml-2 p-1 text-gray-400 hover:text-red-500 transition"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      ) : (
                        <>
                          <svg className="w-8 h-8 mx-auto text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                          <p className="text-sm text-gray-500">Drop your Excel file here or <span className="text-orange-600 font-medium">browse</span></p>
                          <p className="text-xs text-gray-400 mt-1">Supports .xlsx, .xls</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Error */}
              {bulkError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm flex items-start gap-2">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  {bulkError}
                </div>
              )}

              {/* Results */}
              {bulkResult && (
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-800">Upload Results</h4>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="grid grid-cols-4 gap-3">
                      <div className="text-center p-2 rounded-lg bg-gray-50">
                        <div className="text-lg font-bold text-gray-800">{bulkResult.total}</div>
                        <div className="text-xs text-gray-500">Total</div>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-green-50">
                        <div className="text-lg font-bold text-green-600">{bulkResult.created}</div>
                        <div className="text-xs text-green-600">Created</div>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-amber-50">
                        <div className="text-lg font-bold text-amber-600">{bulkResult.skipped}</div>
                        <div className="text-xs text-amber-600">Skipped</div>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-red-50">
                        <div className="text-lg font-bold text-red-600">{bulkResult.failed}</div>
                        <div className="text-xs text-red-600">Failed</div>
                      </div>
                    </div>
                    {bulkResult.failures.length > 0 && (
                      <div className="max-h-36 overflow-auto rounded-lg border border-gray-200 bg-white">
                        <table className="min-w-full text-xs">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left font-medium text-gray-500">Row</th>
                              <th className="px-3 py-2 text-left font-medium text-gray-500">Name</th>
                              <th className="px-3 py-2 text-left font-medium text-gray-500">Issue</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {bulkResult.failures.map((f, idx) => (
                              <tr key={idx}>
                                <td className="px-3 py-1.5 text-gray-600">{f.row}</td>
                                <td className="px-3 py-1.5 text-gray-800 font-medium">{f.name || '—'}</td>
                                <td className="px-3 py-1.5 text-red-600">{f.message}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={closeBulkUpload} disabled={bulkUploading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                {bulkResult ? 'Close' : 'Cancel'}
              </button>
              {!bulkResult && (
                <button onClick={handleBulkUpload} disabled={bulkUploading || !bulkFile}
                  className="px-5 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-sm">
                  {bulkUploading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      Uploading...
                    </span>
                  ) : 'Upload & Import'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Summary Card sub-component ── */

function SummaryCard({ label, count, color, icon }: { label: string; count: number; color: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex items-center gap-4">
      <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: color }}>
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">{icon}</svg>
      </div>
      <div>
        <div className="text-sm font-medium text-gray-500">{label}</div>
        <div className="text-2xl font-bold text-gray-900">{count}</div>
      </div>
    </div>
  );
}
