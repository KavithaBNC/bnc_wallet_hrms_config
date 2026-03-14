import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';
import { getModulePermissions } from '../config/configurator-module-mapping';
import configuratorDataService, {
  ConfigDepartment,
  ConfigSubDepartment,
  ConfigCostCentre,
} from '../services/configurator-data.service';

/* ─── Types ─────────────────────────────────────────────────────── */

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'department', label: 'Department' },
  { key: 'subDepartment', label: 'Sub Department' },
  { key: 'costCentre', label: 'Cost Centre' },
];

const PAGE_SIZE_OPTIONS = [10, 20, 50];

interface TableRow {
  id: string;
  rawId: number;
  name: string;
  code: string;
  type: 'Department' | 'Sub Department' | 'Cost Centre';
  status: string;
  costCentreId?: number;
  costCentreName?: string;
  departmentId?: number;
  departmentName?: string;
  costcenterId?: number;
  [key: string]: string | number | undefined;
}

type ModalType = 'addDept' | 'addSubDept' | 'addCC' | 'editDept' | 'editSubDept' | 'editCC' | null;

/* ─── Component ─────────────────────────────────────────────────── */

export default function DepartmentMastersPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const organizationName = (user as any)?.employee?.organization?.name;

  const modulePerms = getModulePermissions('/departments');
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
  const [tableData, setTableData] = useState<TableRow[]>([]);

  /* ── Modal state ── */
  const [modalType, setModalType] = useState<ModalType>(null);
  const [modalName, setModalName] = useState('');
  const [modalCostCentreId, setModalCostCentreId] = useState<number | ''>('');
  const [modalDepartmentId, setModalDepartmentId] = useState<number | ''>('');
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');
  const [editingRow, setEditingRow] = useState<TableRow | null>(null);

  /* ── Delete confirm state ── */
  const [deleteRow, setDeleteRow] = useState<TableRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

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

  /* ── Build table rows ── */

  const buildTableData = useCallback((tab: string, deptList: ConfigDepartment[], subDeptList: ConfigSubDepartment[], ccList: ConfigCostCentre[]) => {
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
    return rows;
  }, []);

  /* ── Load data ── */

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ccList, deptList, subDeptList] = await Promise.all([
        fetchCostCentres(), fetchDepartments(), fetchSubDepartments(),
      ]);
      setTableData(buildTableData(activeTab, deptList, subDeptList, ccList));
    } catch (err: unknown) {
      const message = err && typeof err === 'object' && 'response' in err
        ? (err as any).response?.data?.message : 'Failed to load data';
      setError(String(message || 'Failed to load data'));
      setTableData([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, fetchDepartments, fetchSubDepartments, fetchCostCentres, buildTableData]);

  useEffect(() => { loadData(); }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Refresh after mutation ── */
  const refreshAll = async () => {
    try {
      const [ccList, deptList, subDeptList] = await Promise.all([
        fetchCostCentres(), fetchDepartments(), fetchSubDepartments(),
      ]);
      setTableData(buildTableData(activeTab, deptList, subDeptList, ccList));
    } catch { /* loadData will catch */ }
  };

  /* ── Modal open helpers ── */

  const openAddDept = () => { setModalType('addDept'); setModalName(''); setModalCostCentreId(''); setModalError(''); };
  const openAddSubDept = () => { setModalType('addSubDept'); setModalName(''); setModalDepartmentId(''); setModalCostCentreId(''); setModalError(''); };
  const openAddCC = () => { setModalType('addCC'); setModalName(''); setModalError(''); };

  const openEdit = (row: TableRow) => {
    setEditingRow(row);
    setModalName(row.name === '—' ? '' : row.name);
    setModalError('');
    if (row.type === 'Department') {
      setModalType('editDept');
      setModalCostCentreId(row.costCentreId ?? '');
    } else if (row.type === 'Sub Department') {
      setModalType('editSubDept');
      setModalDepartmentId(row.departmentId ?? '');
      setModalCostCentreId(row.costcenterId ?? '');
    } else {
      setModalType('editCC');
    }
  };

  const closeModal = () => { setModalType(null); setEditingRow(null); setModalLoading(false); setModalError(''); };

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
        await configuratorDataService.editCostCentre(editingRow.rawId, modalName.trim());
        setToast({ msg: 'Cost Centre updated', type: 'success' });
      } else if (modalType === 'editDept' && editingRow) {
        await configuratorDataService.editDepartment(editingRow.rawId, modalName.trim(), Number(modalCostCentreId) || 0);
        setToast({ msg: 'Department updated', type: 'success' });
      } else if (modalType === 'editSubDept' && editingRow) {
        await configuratorDataService.editSubDepartment(editingRow.rawId, modalName.trim(), Number(modalDepartmentId) || 0, modalCostCentreId ? Number(modalCostCentreId) : undefined);
        setToast({ msg: 'Sub Department updated', type: 'success' });
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
        await configuratorDataService.deleteCostCentre(deleteRow.rawId);
      } else if (deleteRow.type === 'Department') {
        await configuratorDataService.deleteDepartment(deleteRow.rawId);
      } else {
        await configuratorDataService.deleteSubDepartment(deleteRow.rawId);
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
    : modalType === 'editSubDept' ? 'Edit Sub Department' : '';

  const modalColor = (modalType?.includes('CC') || modalType?.includes('costCentre')) ? 'emerald'
    : (modalType?.includes('SubDept') || modalType?.includes('subDepartment')) ? 'purple' : 'blue';

  /* ── Guard ── */

  const hasCompanyId = !!localStorage.getItem('configuratorCompanyId');
  if (!hasCompanyId) {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
        <AppHeader title="Department Masters" subtitle={organizationName ? `Organization: ${organizationName}` : undefined} onLogout={handleLogout} />
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
    'Cost Centre': 'bg-emerald-100 text-emerald-800',
  };

  /* ── Render ── */

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader title="Department Masters" subtitle={organizationName ? `Organization: ${organizationName}` : undefined} onLogout={handleLogout} />

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

          {/* ── Add Buttons ── */}
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
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add Cost Centre
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <SummaryCard label="Total Records" count={totalItems} color="#333333" icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />} />
            <SummaryCard label="Departments" count={deptCount} color="#3B82F6" icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />} />
            <SummaryCard label="Sub Departments" count={subDeptCount} color="#A855F7" icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />} />
            <SummaryCard label="Cost Centres" count={ccCount} color="#10B981" icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />} />
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
                              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${row.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{row.status}</span>
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
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium animate-slide-in ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}>
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
            <div className={`px-6 py-4 bg-gradient-to-r ${modalColor === 'blue' ? 'from-blue-500 to-blue-600' : modalColor === 'purple' ? 'from-purple-500 to-purple-600' : 'from-emerald-500 to-emerald-600'}`}>
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
            </div>
            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
              <button onClick={() => !modalLoading && closeModal()} disabled={modalLoading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">Cancel</button>
              <button onClick={handleModalSubmit} disabled={modalLoading || !modalName.trim()}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition ${modalColor === 'blue' ? 'bg-blue-600 hover:bg-blue-700' : modalColor === 'purple' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
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
                Are you sure you want to delete <span className="font-semibold">{deleteRow.type}</span>: <span className="font-semibold">"{deleteRow.name}"</span>?
              </p>
              <p className="text-xs text-gray-500 mt-2">This action cannot be undone.</p>
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
