import { useState, useEffect, useCallback } from 'react';
import configuratorDataService, {
  ConfigCostCentre,
  ConfigDepartment,
  ConfigSubDepartment,
} from '../services/configurator-data.service';

/* ──────────────── Types ──────────────── */
interface ModalState {
  type: 'costCentre' | 'department' | 'subDepartment' | null;
  name: string;
  loading: boolean;
  error: string;
}

/* ──────────────── Inline SVG Icons ──────────────── */
const PlusIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);
const ChevronDownIcon = () => (
  <svg className="w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);
const BuildingIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);
const CloseIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);
const CheckIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

/* ──────────────── Toast ──────────────── */
const Toast = ({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) => {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className={`fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium animate-slide-in ${
      type === 'success' ? 'bg-emerald-500' : 'bg-red-500'
    }`}>
      {type === 'success' ? <CheckIcon /> : <CloseIcon />}
      {message}
      <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100">
        <CloseIcon />
      </button>
    </div>
  );
};

/* ──────────────── Main Page Component ──────────────── */
const CostCentreDepartmentPage = () => {
  // Dropdown data
  const [costCentres, setCostCentres] = useState<ConfigCostCentre[]>([]);
  const [departments, setDepartments] = useState<ConfigDepartment[]>([]);
  const [subDepartments, setSubDepartments] = useState<ConfigSubDepartment[]>([]);

  // Selected values (store numeric Configurator IDs as strings)
  const [selectedCostCentre, setSelectedCostCentre] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedSubDepartment, setSelectedSubDepartment] = useState('');

  // Loading states
  const [loadingCC, setLoadingCC] = useState(false);
  const [loadingDept, setLoadingDept] = useState(false);
  const [loadingSubDept, setLoadingSubDept] = useState(false);

  // Modal
  const [modal, setModal] = useState<ModalState>({ type: null, name: '', loading: false, error: '' });

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  /* ── Fetch Cost Centres from Configurator API ── */
  const fetchCostCentres = useCallback(async () => {
    setLoadingCC(true);
    try {
      const list = await configuratorDataService.getCostCentres();
      setCostCentres(list);
    } catch (err) {
      console.error('Failed to load cost centres:', err);
      setToast({ message: 'Failed to load cost centres', type: 'error' });
    } finally {
      setLoadingCC(false);
    }
  }, []);

  /* ── Fetch Departments from Configurator API ── */
  const fetchDepartments = useCallback(async () => {
    setLoadingDept(true);
    try {
      const list = await configuratorDataService.getDepartments();
      // Filter by selected cost centre if applicable
      const ccId = selectedCostCentre ? parseInt(selectedCostCentre, 10) : null;
      const filtered = ccId != null
        ? list.filter(d => d.cost_centre_id === ccId)
        : list;
      setDepartments(filtered);
    } catch (err) {
      console.error('Failed to load departments:', err);
      setToast({ message: 'Failed to load departments', type: 'error' });
    } finally {
      setLoadingDept(false);
    }
  }, [selectedCostCentre]);

  /* ── Fetch Sub-Departments from Configurator API ── */
  const fetchSubDepartments = useCallback(async () => {
    setLoadingSubDept(true);
    try {
      const list = await configuratorDataService.getSubDepartments();
      // Filter by selected department if applicable
      const deptId = selectedDepartment ? parseInt(selectedDepartment, 10) : null;
      const filtered = deptId != null
        ? list.filter(s => s.department_id === deptId)
        : list;
      setSubDepartments(filtered);
    } catch (err) {
      console.error('Failed to load sub-departments:', err);
      setToast({ message: 'Failed to load sub-departments', type: 'error' });
    } finally {
      setLoadingSubDept(false);
    }
  }, [selectedDepartment]);

  /* ── Initial load: cost centres ── */
  useEffect(() => {
    fetchCostCentres();
  }, [fetchCostCentres]);

  /* ── Cascade: cost centre → departments ── */
  useEffect(() => {
    if (selectedCostCentre) {
      fetchDepartments();
    } else {
      setDepartments([]);
    }
    setSelectedDepartment('');
    setSelectedSubDepartment('');
    setSubDepartments([]);
  }, [selectedCostCentre]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Cascade: department → sub-departments ── */
  useEffect(() => {
    if (selectedDepartment) {
      fetchSubDepartments();
    } else {
      setSubDepartments([]);
    }
    setSelectedSubDepartment('');
  }, [selectedDepartment]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Handle Add (modal submit) ── */
  const handleAdd = async () => {
    if (!modal.name.trim()) {
      setModal(m => ({ ...m, error: 'Name is required' }));
      return;
    }
    setModal(m => ({ ...m, loading: true, error: '' }));
    try {
      if (modal.type === 'costCentre') {
        // POST { name, company_id }
        await configuratorDataService.createCostCentre(modal.name.trim());
        setToast({ message: 'Cost Centre created successfully', type: 'success' });
        await fetchCostCentres();
      } else if (modal.type === 'department') {
        // POST { name, company_id, cost_centre_id }
        const ccId = selectedCostCentre ? parseInt(selectedCostCentre, 10) : NaN;
        if (!ccId || Number.isNaN(ccId)) {
          setToast({ message: 'Please select a cost centre first', type: 'error' });
          return;
        }
        await configuratorDataService.createDepartment(modal.name.trim(), ccId);
        setToast({ message: 'Department created successfully', type: 'success' });
        if (selectedCostCentre) await fetchDepartments();
      } else if (modal.type === 'subDepartment') {
        // POST { name, company_id, department_id, costcenter_id }
        const deptId = selectedDepartment ? parseInt(selectedDepartment, 10) : NaN;
        const ccId = selectedCostCentre ? parseInt(selectedCostCentre, 10) : NaN;
        if (!deptId || Number.isNaN(deptId)) {
          setToast({ message: 'Please select a department first', type: 'error' });
          return;
        }
        await configuratorDataService.createSubDepartment(
          modal.name.trim(),
          deptId,
          Number.isNaN(ccId) ? undefined : ccId,
        );
        setToast({ message: 'Sub-Department created successfully', type: 'success' });
        if (selectedDepartment) await fetchSubDepartments();
      }
      setModal({ type: null, name: '', loading: false, error: '' });
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      let msg: string;
      if (Array.isArray(detail)) {
        msg = detail.map((d: any) => `${d.loc?.join('.')}: ${d.msg}`).join('; ');
      } else if (typeof detail === 'string') {
        msg = detail;
      } else {
        msg = err.response?.data?.message || err.message || 'Failed to create';
      }
      setModal(m => ({ ...m, loading: false, error: msg }));
    }
  };

  const openModal = (type: ModalState['type']) => {
    setModal({ type, name: '', loading: false, error: '' });
  };

  const modalTitle = modal.type === 'costCentre'
    ? 'Add Cost Centre'
    : modal.type === 'department'
    ? 'Add Department'
    : 'Add Sub-Department';

  const hasCompanyId = !!localStorage.getItem('configuratorCompanyId');
  if (!hasCompanyId) {
    return (
      <div className="p-6">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-700 text-sm">
          No Configurator company found. Please ensure your account is linked to an organization with a Configurator company.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <BuildingIcon />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Cost Centre & Department Setup</h1>
        </div>
        <p className="text-gray-500 text-sm ml-12">
          Configure the organizational hierarchy: Cost Centre → Department → Sub-Department
        </p>
      </div>

      {/* Cascading Dropdowns Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="space-y-6">
          {/* ── Cost Centre Dropdown ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-gray-700">Cost Centre</label>
              <button
                onClick={() => openModal('costCentre')}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
              >
                <PlusIcon /> Add New
              </button>
            </div>
            <div className="relative">
              <select
                value={selectedCostCentre}
                onChange={e => setSelectedCostCentre(e.target.value)}
                disabled={loadingCC}
                className="w-full appearance-none bg-gray-50 border border-gray-300 rounded-lg px-4 py-2.5 pr-10 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 transition-colors"
              >
                <option value="">{loadingCC ? 'Loading...' : '-- Select Cost Centre --'}</option>
                {costCentres.map(cc => (
                  <option key={cc.id} value={String(cc.id)}>
                    {cc.name}{cc.code ? ` (${cc.code})` : ''}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-3 flex items-center">
                <ChevronDownIcon />
              </div>
            </div>
            {costCentres.length > 0 && (
              <p className="mt-1 text-xs text-gray-400">{costCentres.length} cost centre{costCentres.length !== 1 ? 's' : ''} available</p>
            )}
          </div>

          {/* Arrow Connector */}
          <div className="flex justify-center">
            <svg className={`w-5 h-5 ${selectedCostCentre ? 'text-gray-300' : 'text-gray-200'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>

          {/* ── Department Dropdown ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={`text-sm font-semibold ${selectedCostCentre ? 'text-gray-700' : 'text-gray-400'}`}>Department</label>
              <button
                onClick={() => selectedCostCentre && openModal('department')}
                disabled={!selectedCostCentre}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <PlusIcon /> Add New
              </button>
            </div>
            <div className="relative">
              <select
                value={selectedDepartment}
                onChange={e => setSelectedDepartment(e.target.value)}
                disabled={!selectedCostCentre || loadingDept}
                className={`w-full appearance-none bg-gray-50 border border-gray-300 rounded-lg px-4 py-2.5 pr-10 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors ${
                  !selectedCostCentre ? 'opacity-50 cursor-not-allowed' : 'disabled:opacity-50'
                }`}
              >
                <option value="">{!selectedCostCentre ? 'Select cost centre first' : loadingDept ? 'Loading...' : '-- Select Department --'}</option>
                {departments.map(d => (
                  <option key={d.id} value={String(d.id)}>{d.name}</option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-3 flex items-center">
                <ChevronDownIcon />
              </div>
            </div>
            {selectedCostCentre && departments.length > 0 && (
              <p className="mt-1 text-xs text-gray-400">{departments.length} department{departments.length !== 1 ? 's' : ''} available</p>
            )}
            {selectedCostCentre && !loadingDept && departments.length === 0 && (
              <p className="mt-1 text-xs text-amber-500">No departments found for this cost centre. Add one using the (+) button.</p>
            )}
          </div>

          {/* Arrow Connector */}
          <div className="flex justify-center">
            <svg className={`w-5 h-5 ${selectedDepartment ? 'text-gray-300' : 'text-gray-200'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>

          {/* ── Sub-Department Dropdown ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={`text-sm font-semibold ${selectedDepartment ? 'text-gray-700' : 'text-gray-400'}`}>Sub-Department</label>
              <button
                onClick={() => selectedDepartment && openModal('subDepartment')}
                disabled={!selectedDepartment}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <PlusIcon /> Add New
              </button>
            </div>
            <div className="relative">
              <select
                value={selectedSubDepartment}
                onChange={e => setSelectedSubDepartment(e.target.value)}
                disabled={!selectedDepartment || loadingSubDept}
                className={`w-full appearance-none bg-gray-50 border border-gray-300 rounded-lg px-4 py-2.5 pr-10 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors ${
                  !selectedDepartment ? 'opacity-50 cursor-not-allowed' : 'disabled:opacity-50'
                }`}
              >
                <option value="">{!selectedDepartment ? 'Select department first' : loadingSubDept ? 'Loading...' : '-- Select Sub-Department --'}</option>
                {subDepartments.map(sd => (
                  <option key={sd.id} value={String(sd.id)}>{sd.name}</option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-3 flex items-center">
                <ChevronDownIcon />
              </div>
            </div>
            {selectedDepartment && subDepartments.length > 0 && (
              <p className="mt-1 text-xs text-gray-400">{subDepartments.length} sub-department{subDepartments.length !== 1 ? 's' : ''} available</p>
            )}
            {selectedDepartment && !loadingSubDept && subDepartments.length === 0 && (
              <p className="mt-1 text-xs text-amber-500">No sub-departments found for this department. Add one using the (+) button.</p>
            )}
          </div>
        </div>

        {/* Summary */}
        {selectedCostCentre && (
          <div className="mt-8 pt-6 border-t border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Current Selection</h3>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                {costCentres.find(c => String(c.id) === selectedCostCentre)?.name || selectedCostCentre}
              </span>
              {selectedDepartment && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {departments.find(d => String(d.id) === selectedDepartment)?.name || selectedDepartment}
                </span>
              )}
              {selectedSubDepartment && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-50 text-purple-700 text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                  {subDepartments.find(s => String(s.id) === selectedSubDepartment)?.name || selectedSubDepartment}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Add Modal ── */}
      {modal.type && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !modal.loading && setModal({ type: null, name: '', loading: false, error: '' })} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            {/* Modal Header */}
            <div className={`px-6 py-4 ${
              modal.type === 'costCentre' ? 'bg-gradient-to-r from-indigo-500 to-indigo-600' :
              modal.type === 'department' ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' :
              'bg-gradient-to-r from-purple-500 to-purple-600'
            }`}>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">{modalTitle}</h3>
                <button
                  onClick={() => !modal.loading && setModal({ type: null, name: '', loading: false, error: '' })}
                  className="text-white/80 hover:text-white transition-colors"
                >
                  <CloseIcon />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {modal.error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
                  {modal.error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={modal.name}
                  onChange={e => setModal(m => ({ ...m, name: e.target.value, error: '' }))}
                  placeholder={`Enter ${modal.type === 'costCentre' ? 'cost centre' : modal.type === 'department' ? 'department' : 'sub-department'} name`}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && !modal.loading && handleAdd()}
                />
              </div>

              {modal.type === 'department' && selectedCostCentre && (
                <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500">
                  Will be linked to cost centre: <span className="font-medium text-gray-700">{costCentres.find(c => String(c.id) === selectedCostCentre)?.name}</span>
                </div>
              )}

              {modal.type === 'subDepartment' && selectedDepartment && (
                <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500">
                  Will be linked to department: <span className="font-medium text-gray-700">{departments.find(d => String(d.id) === selectedDepartment)?.name}</span>
                  {selectedCostCentre && (
                    <> and cost centre: <span className="font-medium text-gray-700">{costCentres.find(c => String(c.id) === selectedCostCentre)?.name}</span></>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setModal({ type: null, name: '', loading: false, error: '' })}
                disabled={modal.loading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={modal.loading || !modal.name.trim()}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-colors ${
                  modal.type === 'costCentre' ? 'bg-indigo-600 hover:bg-indigo-700' :
                  modal.type === 'department' ? 'bg-emerald-600 hover:bg-emerald-700' :
                  'bg-purple-600 hover:bg-purple-700'
                }`}
              >
                {modal.loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Creating...
                  </span>
                ) : (
                  'Create'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CostCentreDepartmentPage;
