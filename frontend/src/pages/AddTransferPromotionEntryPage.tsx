import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';
import paygroupService from '../services/paygroup.service';
import employeeService from '../services/employee.service';
import positionService from '../services/position.service';
import departmentService from '../services/department.service';
import locationService from '../services/location.service';
import transferPromotionEntryService from '../services/transfer-promotion-entry.service';
import type { Paygroup } from '../services/paygroup.service';
import type { Employee } from '../services/employee.service';
import type { Position } from '../services/position.service';
import type { Department } from '../services/department.service';
import type { Location } from '../services/location.service';

const TRANSFER_COMPONENTS = [
  { value: 'Reporting Manager', label: 'Reporting Manager' },
  { value: 'Department', label: 'Department' },
  { value: 'Location', label: 'Location' },
];

interface TransferRow {
  id: string;
  component: string;
  currentValue: string;
  newValue: string;
}

function nextId() {
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function AddTransferPromotionEntryPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;
  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id;

  const [paygroups, setPaygroups] = useState<Paygroup[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [associateDetail, setAssociateDetail] = useState<Employee | null>(null);
  const [loadingPaygroups, setLoadingPaygroups] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [loadingPositions, setLoadingPositions] = useState(false);
  const [_loadingAssociateDetail, setLoadingAssociateDetail] = useState(false);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [loadingLocations, setLoadingLocations] = useState(false);

  const [paygroupId, setPaygroupId] = useState('');
  const [associateId, setAssociateId] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [promotionEnabled, setPromotionEnabled] = useState(true);
  const [promotionFromId, setPromotionFromId] = useState('');
  const [promotionToId, setPromotionToId] = useState('');
  const [transferRows, setTransferRows] = useState<TransferRow[]>([
    { id: nextId(), component: 'Reporting Manager', currentValue: '', newValue: '' },
  ]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [associateSearch, setAssociateSearch] = useState('');
  const [showAssociateDropdown, setShowAssociateDropdown] = useState(false);

  const effectiveDateInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!organizationId) return;
    setLoadingPaygroups(true);
    paygroupService.getAll({ organizationId }).then((list) => {
      setPaygroups(list);
      if (list.length > 0 && !paygroupId) setPaygroupId(list[0].id);
    }).finally(() => setLoadingPaygroups(false));
  }, [organizationId]);

  // Load associates by selected paygroup only (clear associate when paygroup changes)
  useEffect(() => {
    if (!organizationId) {
      setEmployees([]);
      setAssociateId('');
      return;
    }
    if (!paygroupId) {
      setEmployees([]);
      setAssociateId('');
      return;
    }
    setLoadingEmployees(true);
    setAssociateId('');
    setAssociateSearch('');
    employeeService
      .getAll({
        organizationId,
        paygroupId,
        page: 1,
        limit: 500,
        employeeStatus: 'ACTIVE',
      })
      .then((res) => {
        setEmployees(res.employees || []);
        if (res.employees?.length) setAssociateId(res.employees[0].id);
      })
      .catch(() => setEmployees([]))
      .finally(() => setLoadingEmployees(false));
  }, [organizationId, paygroupId]);

  useEffect(() => {
    if (!organizationId) return;
    setLoadingPositions(true);
    positionService.getAll({ organizationId, limit: 200 }).then((res) => {
      const list = res?.positions ?? [];
      setPositions(list);
      if (list.length > 0) {
        if (!promotionToId) setPromotionToId(list[0].id);
      }
    }).finally(() => setLoadingPositions(false));
  }, [organizationId]);

  // Prefill Promotion From with the selected associate's current designation
  useEffect(() => {
    if (!associateId || !employees.length) return;
    const emp = employees.find((e) => e.id === associateId);
    const currentPositionId = (emp as { positionId?: string | null; position?: { id: string } })?.positionId
      ?? (emp as { position?: { id: string } })?.position?.id;
    if (currentPositionId) {
      setPromotionFromId(currentPositionId);
    }
  }, [associateId, employees]);

  // Fetch full associate detail (reportingManager, department, location) for transfer current values
  useEffect(() => {
    if (!associateId) {
      setAssociateDetail(null);
      return;
    }
    setLoadingAssociateDetail(true);
    employeeService
      .getById(associateId)
      .then((emp) => setAssociateDetail(emp))
      .catch(() => setAssociateDetail(null))
      .finally(() => setLoadingAssociateDetail(false));
  }, [associateId]);

  // Load departments and locations for Transfer New Value dropdowns
  useEffect(() => {
    if (!organizationId) return;
    setLoadingDepartments(true);
    departmentService.getAll({ organizationId, isActive: true, limit: 500 }).then((res) => {
      setDepartments(res.departments ?? []);
    }).catch(() => setDepartments([])).finally(() => setLoadingDepartments(false));
  }, [organizationId]);
  useEffect(() => {
    if (!organizationId) return;
    setLoadingLocations(true);
    locationService.getByOrganization(organizationId).then((list) => setLocations(list)).catch(() => setLocations([])).finally(() => setLoadingLocations(false));
  }, [organizationId]);

  // Prefill Current Value for each transfer row based on component and associate detail
  useEffect(() => {
    if (!associateDetail) return;
    setTransferRows((prev) =>
      prev.map((row) => {
        let currentValue = '';
        if (row.component === 'Reporting Manager' && associateDetail.reportingManager) {
          currentValue = `${associateDetail.reportingManager.firstName} ${associateDetail.reportingManager.lastName}`.trim();
        } else if (row.component === 'Department' && associateDetail.department) {
          currentValue = associateDetail.department.name;
        } else if (row.component === 'Location' && associateDetail.location) {
          currentValue = associateDetail.location.name;
        }
        return { ...row, currentValue };
      })
    );
  }, [associateDetail]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const selectedEmployee = employees.find((e) => e.id === associateId);
  const associateDisplay = selectedEmployee
    ? `${selectedEmployee.firstName} ${selectedEmployee.middleName || ''} ${selectedEmployee.lastName}`.trim() + ' ' + (selectedEmployee.employeeCode || '')
    : '';

  const filteredEmployees = associateSearch.trim()
    ? employees.filter(
        (e) =>
          e.employeeCode?.toLowerCase().includes(associateSearch.toLowerCase()) ||
          `${e.firstName} ${e.lastName}`.toLowerCase().includes(associateSearch.toLowerCase())
      )
    : employees;

  const addTransferRow = () => {
    setTransferRows((prev) => [
      ...prev,
      { id: nextId(), component: 'Reporting Manager', currentValue: '', newValue: '' },
    ]);
  };

  const removeTransferRow = (id: string) => {
    setTransferRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  };

  const updateTransferRow = (id: string, field: keyof TransferRow, value: string) => {
    setTransferRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const getCurrentValueForComponent = (component: string): string => {
    if (!associateDetail) return '';
    if (component === 'Reporting Manager' && associateDetail.reportingManager) {
      return `${associateDetail.reportingManager.firstName} ${associateDetail.reportingManager.lastName}`.trim();
    }
    if (component === 'Department' && associateDetail.department) return associateDetail.department.name;
    if (component === 'Location' && associateDetail.location) return associateDetail.location.name;
    return '';
  };

  const handleTransferRowComponentChange = (rowId: string, newComponent: string) => {
    const currentValue = getCurrentValueForComponent(newComponent);
    setTransferRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, component: newComponent, currentValue, newValue: '' } : r))
    );
  };

  const handleSave = async () => {
    if (!organizationId) {
      setSaveError('Organization not found.');
      return;
    }
    if (!associateId || !effectiveDate.trim()) {
      setSaveError('Associate and Effective Date are required.');
      return;
    }
    setSaveError(null);
    setSaving(true);
    try {
      const transferComponents = transferRows.map((row) => ({
        component: row.component,
        currentValue: row.currentValue,
        newValue: row.newValue,
      }));
      await transferPromotionEntryService.create({
        organizationId,
        employeeId: associateId,
        paygroupId: paygroupId || null,
        effectiveDate: effectiveDate.trim(),
        remarks: remarks.trim() || null,
        promotionEnabled,
        promotionFromId: promotionEnabled ? promotionFromId || null : null,
        promotionToId: promotionEnabled ? promotionToId || null : null,
        transferComponents: transferComponents.length ? transferComponents : null,
      });
      navigate('/transaction/transfer-promotion-entry');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setSaveError(e.response?.data?.message || e.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader
        title="Transaction"
        subtitle={organizationName ? organizationName : undefined}
        onLogout={handleLogout}
      />

      <main className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-6 bg-gray-50">
        <div className="px-4 py-3 mb-0">
          <h1 className="text-lg font-semibold text-gray-900">Transfer And Promotion Entry</h1>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 p-6 space-y-6">
          {/* Top row: Paygroup, Associate, Effective Date, Remarks */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Paygroup</label>
              <select
                value={paygroupId}
                onChange={(e) => setPaygroupId(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 bg-white"
                disabled={loadingPaygroups}
              >
                {paygroups.map((pg) => (
                  <option key={pg.id} value={pg.id}>{pg.name}</option>
                ))}
                {!paygroups.length && <option value="">Select</option>}
              </select>
            </div>
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Associate <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={showAssociateDropdown ? associateSearch : associateDisplay}
                onChange={(e) => {
                  setAssociateSearch(e.target.value);
                  setShowAssociateDropdown(true);
                }}
                onFocus={() => setShowAssociateDropdown(true)}
                onBlur={() => setTimeout(() => setShowAssociateDropdown(false), 200)}
                placeholder="Associate Code or Name"
                className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 bg-white pr-8"
              />
              <span className="absolute right-2 top-9 text-gray-400 pointer-events-none">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </span>
              {showAssociateDropdown && (
                <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-y-auto">
                  {filteredEmployees.slice(0, 20).map((emp) => (
                    <li
                      key={emp.id}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setAssociateId(emp.id);
                        setAssociateSearch('');
                        setShowAssociateDropdown(false);
                      }}
                      className="px-3 py-2 cursor-pointer hover:bg-blue-50 text-sm text-gray-900"
                    >
                      {emp.employeeCode} – {emp.firstName} {emp.lastName}
                    </li>
                  ))}
                  {filteredEmployees.length === 0 && (
                    <li className="px-3 py-2 text-sm text-gray-500">
                      {!loadingEmployees && paygroupId && employees.length === 0
                        ? 'No associates in this paygroup.'
                        : 'No matches'}
                    </li>
                  )}
                </ul>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Effective Date <span className="text-red-500">*</span>
              </label>
              <div
                className="relative cursor-pointer"
                role="button"
                tabIndex={0}
                onClick={() => effectiveDateInputRef.current?.showPicker?.()}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') effectiveDateInputRef.current?.showPicker?.(); }}
              >
                <input
                  ref={effectiveDateInputRef}
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-gray-900 bg-white cursor-pointer"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Remarks"
                rows={2}
                className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 bg-white resize-none"
              />
            </div>
          </div>

          {/* Promotion toggle */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Promotion</span>
            <button
              type="button"
              role="switch"
              aria-checked={promotionEnabled}
              onClick={() => setPromotionEnabled(!promotionEnabled)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                promotionEnabled ? 'bg-blue-500' : 'bg-gray-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${
                  promotionEnabled ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="text-sm font-medium text-gray-600">{promotionEnabled ? 'YES' : 'NO'}</span>
          </div>

          {/* Promotion section */}
          {promotionEnabled && (
            <div className="border-t border-gray-200 pt-4">
              <h2 className="text-base font-semibold text-gray-800 border-b-2 border-gray-300 pb-1 inline-block mb-4">
                Promotion
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Promotion From</label>
                  <select
                    value={promotionFromId}
                    onChange={(e) => setPromotionFromId(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 bg-white"
                    disabled={loadingPositions}
                  >
                    {positions.map((p) => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                    {!positions.length && <option value="">Select</option>}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Promotion To</label>
                  <select
                    value={promotionToId}
                    onChange={(e) => setPromotionToId(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 bg-white"
                    disabled={loadingPositions}
                  >
                    <option value="">Promotion To</option>
                    {positions.map((p) => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Transfer section */}
          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-800 border-b-2 border-gray-300 pb-1 inline-block">
                Transfer
              </h2>
              <button
                type="button"
                onClick={addTransferRow}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 transition"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add
              </button>
            </div>
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100 text-gray-700">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase">Component</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase">Current Value</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase">New Value</th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transferRows.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-2">
                        <select
                          value={row.component}
                          onChange={(e) => handleTransferRowComponentChange(row.id, e.target.value)}
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-900 bg-white"
                        >
                          {TRANSFER_COMPONENTS.map((c) => (
                            <option key={c.value} value={c.value}>{c.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={row.currentValue}
                          readOnly
                          placeholder="Current value"
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-900 bg-gray-50"
                        />
                      </td>
                      <td className="px-4 py-2">
                        {row.component === 'Reporting Manager' && (
                          <select
                            value={row.newValue}
                            onChange={(e) => updateTransferRow(row.id, 'newValue', e.target.value)}
                            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-900 bg-white"
                          >
                            <option value="">Choose reporting manager</option>
                            {employees
                              .filter((e) => e.id !== associateId)
                              .map((emp) => (
                                <option key={emp.id} value={emp.id}>
                                  {emp.employeeCode} – {emp.firstName} {emp.lastName}
                                </option>
                              ))}
                          </select>
                        )}
                        {row.component === 'Department' && (
                          <select
                            value={row.newValue}
                            onChange={(e) => updateTransferRow(row.id, 'newValue', e.target.value)}
                            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-900 bg-white"
                            disabled={loadingDepartments}
                          >
                            <option value="">Choose department</option>
                            {departments.map((d) => (
                              <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                          </select>
                        )}
                        {row.component === 'Location' && (
                          <select
                            value={row.newValue}
                            onChange={(e) => updateTransferRow(row.id, 'newValue', e.target.value)}
                            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-900 bg-white"
                            disabled={loadingLocations}
                          >
                            <option value="">Choose location</option>
                            {locations.map((loc) => (
                              <option key={loc.id} value={loc.id}>{loc.name}</option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => removeTransferRow(row.id)}
                          disabled={transferRows.length <= 1}
                          className="text-red-600 hover:text-red-800 p-1 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Remove row"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {saveError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {saveError}
            </div>
          )}

          <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => navigate('/transaction/transfer-promotion-entry')}
              className="px-4 py-2 border border-gray-300 rounded font-medium text-gray-700 bg-white hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
