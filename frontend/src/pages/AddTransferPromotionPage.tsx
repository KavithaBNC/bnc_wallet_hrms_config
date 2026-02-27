import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';
import paygroupService from '../services/paygroup.service';
import employeeService from '../services/employee.service';
import transferPromotionService from '../services/transfer-promotion.service';
import { employeeSalaryService } from '../services/payroll.service';
import type { Paygroup } from '../services/paygroup.service';
import type { Employee } from '../services/employee.service';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

interface IncrementRow {
  component: string;
  currentValue: number;
  incrementValue: number;
}

export default function AddTransferPromotionPage() {
  const navigate = useNavigate();
  const { id: recordId } = useParams<{ id: string }>();
  const { user, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;
  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id;
  const isEdit = Boolean(recordId);

  const [paygroups, setPaygroups] = useState<Paygroup[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingPaygroups, setLoadingPaygroups] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [loadingRecord, setLoadingRecord] = useState(isEdit);

  const [paygroupId, setPaygroupId] = useState('');
  const [associateId, setAssociateId] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('2026-01-01');
  const [incrementEnabled, setIncrementEnabled] = useState(true);
  const [incrementSectionOpen, setIncrementSectionOpen] = useState(true);
  const [incrementFrom, setIncrementFrom] = useState('');
  const [afterLOP, setAfterLOP] = useState('');
  const [beforeLOP, setBeforeLOP] = useState('');
  const [incrementRows, setIncrementRows] = useState<IncrementRow[]>([
    { component: 'Fixed Gross', currentValue: 0, incrementValue: 0 },
  ]);
  const [salaryLoading, setSalaryLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const effectiveDateInputRef = useRef<HTMLInputElement>(null);
  const incrementFromInputRef = useRef<HTMLInputElement>(null);

  // Paygroup dropdown from paygroup master only (no hardcoding)
  useEffect(() => {
    if (!organizationId) return;
    setLoadingPaygroups(true);
    paygroupService.getAll({ organizationId }).then((list) => {
      setPaygroups(list);
      if (list.length > 0 && !isEdit) setPaygroupId(list[0].id);
    }).finally(() => setLoadingPaygroups(false));
  }, [organizationId, isEdit]);

  // Associate dropdown: load employees by selected paygroup only
  useEffect(() => {
    if (!organizationId) {
      setEmployees([]);
      if (!isEdit) setAssociateId('');
      return;
    }
    if (!paygroupId) {
      setEmployees([]);
      if (!isEdit) setAssociateId('');
      return;
    }
    setLoadingEmployees(true);
    if (!isEdit) setAssociateId('');
    employeeService.getAll({
      organizationId,
      paygroupId,
      page: 1,
      limit: 500,
      employeeStatus: 'ACTIVE',
    }).then((res) => {
      setEmployees(res.employees || []);
      if (res.employees?.length && !isEdit) setAssociateId(res.employees[0].id);
    }).catch(() => setEmployees([])).finally(() => setLoadingEmployees(false));
  }, [organizationId, paygroupId, isEdit]);

  // Load existing record when editing
  useEffect(() => {
    if (!recordId || !organizationId) {
      if (recordId && !organizationId) setLoadingRecord(false);
      return;
    }
    setLoadingRecord(true);
    transferPromotionService
      .getById(recordId)
      .then((record) => {
        setPaygroupId(record.paygroupId || '');
        setAssociateId(record.employeeId);
        setEffectiveDate(record.effectiveDate || '2026-01-01');
        setIncrementEnabled(record.isIncrement);
        setIncrementFrom(record.incrementFrom || '');
        setAfterLOP(String(record.afterLOP ?? ''));
        setBeforeLOP(String(record.beforeLOP ?? ''));
        const components = record.incrementComponents?.length
          ? record.incrementComponents.map((c) => ({
              component: c.component,
              currentValue: Number(c.currentValue),
              incrementValue: Number(c.incrementValue),
            }))
          : [{ component: 'Fixed Gross', currentValue: 0, incrementValue: 0 }];
        setIncrementRows(components);
      })
      .catch(() => setSaveError('Failed to load record'))
      .finally(() => setLoadingRecord(false));
  }, [recordId, organizationId]);

  // Load employee salary details (earnings total / gross) when associate changes — same source as View Employee > Salary Details
  useEffect(() => {
    if (!associateId) {
      setIncrementRows((prev) =>
        prev.map((r) => (r.component === 'Fixed Gross' ? { ...r, currentValue: 0 } : r))
      );
      return;
    }
    setSalaryLoading(true);
    employeeSalaryService
      .getCurrentSalary(associateId)
      .then((salary) => {
        const gross = Number(salary?.grossSalary ?? 0);
        setIncrementRows((prev) =>
          prev.map((r) => (r.component === 'Fixed Gross' ? { ...r, currentValue: gross } : r))
        );
      })
      .catch(() => {
        setIncrementRows((prev) =>
          prev.map((r) => (r.component === 'Fixed Gross' ? { ...r, currentValue: 0 } : r))
        );
      })
      .finally(() => setSalaryLoading(false));
  }, [associateId]);

  const appliedFrom = effectiveDate
    ? (() => {
        const [y, m] = effectiveDate.split('-').map(Number);
        return `${MONTHS[m - 1]} ${y}`;
      })()
    : '';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleCancel = () => {
    navigate('/transaction/transfer-promotions');
  };

  const handleSave = async () => {
    if (!organizationId) {
      setSaveError('Organization is required.');
      return;
    }
    if (!associateId) {
      setSaveError('Associate is required.');
      return;
    }
    if (!effectiveDate) {
      setSaveError('Effective date is required.');
      return;
    }
    setSaveError(null);
    setSaving(true);
    try {
      const paygroupIdValue = paygroupId || null;
      if (isEdit && recordId) {
        await transferPromotionService.update(recordId, {
          paygroupId: paygroupIdValue,
          effectiveDate,
          appliedFrom,
          isIncrement: incrementEnabled,
          incrementFrom: incrementFrom || null,
          afterLOP: parseFloat(afterLOP) || 0,
          beforeLOP: parseFloat(beforeLOP) || 0,
          incrementComponents: incrementEnabled ? incrementRows : null,
        });
      } else {
        await transferPromotionService.create({
          organizationId,
          employeeId: associateId,
          paygroupId: paygroupIdValue,
          effectiveDate,
          appliedFrom,
          isIncrement: incrementEnabled,
          incrementFrom: incrementFrom || null,
          afterLOP: parseFloat(afterLOP) || 0,
          beforeLOP: parseFloat(beforeLOP) || 0,
          incrementComponents: incrementEnabled ? incrementRows : null,
        });
      }
      navigate('/transaction/transfer-promotions');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string }; status?: number }; message?: string };
      const message =
        e.response?.data?.message || e.message || 'Failed to save. Please try again.';
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  };

  const setIncrementValue = (index: number, value: number) => {
    setIncrementRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], incrementValue: value };
      return next;
    });
  };

  const totalCurrent = incrementRows.reduce((s, r) => s + r.currentValue, 0);
  const totalIncrement = incrementRows.reduce((s, r) => s + r.incrementValue, 0);

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader
        title="Transaction"
        subtitle={organizationName ? `Organization: ${organizationName}` : undefined}
        onLogout={handleLogout}
      />

      <main className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        <div className="px-4 py-3 mb-0">
          <h1 className="text-lg font-semibold text-gray-900">{isEdit ? 'Edit Increment' : 'Increment'}</h1>
        </div>

        {/* Form card */}
        <div className="bg-white rounded-b-lg shadow border border-t-0 border-gray-200 p-6">
          {loadingRecord ? (
            <div className="py-12 text-center text-gray-500">Loading record...</div>
          ) : (
          <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left column */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Paygroup</label>
                <select
                  value={paygroupId}
                  onChange={(e) => setPaygroupId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 bg-white"
                  disabled={loadingPaygroups}
                >
                  <option value="">Select paygroup</option>
                  {paygroups.map((pg) => (
                    <option key={pg.id} value={pg.id}>{pg.name}</option>
                  ))}
                </select>
                {!organizationId && (
                  <p className="text-amber-600 text-xs mt-1">Loads when organization is available.</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Associate <span className="text-red-500">*</span>
                </label>
                <select
                  value={associateId}
                  onChange={(e) => setAssociateId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 bg-white"
                  disabled={loadingEmployees || isEdit}
                >
                  <option value="">Select associate</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {[emp.firstName, emp.middleName, emp.lastName].filter(Boolean).join(' ')} {emp.employeeCode || ''}
                    </option>
                  ))}
                </select>
                {!loadingEmployees && paygroupId && employees.length === 0 && (
                  <p className="text-amber-600 text-xs mt-1">No associates in this paygroup.</p>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Applied From</label>
                <input
                  type="text"
                  value={appliedFrom}
                  readOnly
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-gray-600 bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Increment</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIncrementEnabled(true)}
                    className={`px-4 py-2 rounded-lg font-medium text-sm ${
                      incrementEnabled ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    YES
                  </button>
                  <button
                    type="button"
                    onClick={() => setIncrementEnabled(false)}
                    className={`px-4 py-2 rounded-lg font-medium text-sm ${
                      !incrementEnabled ? 'bg-gray-600 text-white' : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    NO
                  </button>
                  {incrementEnabled && (
                    <span className="text-green-600">
                      <svg className="w-5 h-5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Right column - Increment section */}
            <div className="space-y-4">
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setIncrementSectionOpen(!incrementSectionOpen)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 text-left font-medium text-gray-900"
                >
                  <span>Increment</span>
                  <span className="text-sm text-gray-500 font-normal">
                    {incrementSectionOpen ? 'Show less —' : 'Show more'}
                  </span>
                </button>
                {incrementSectionOpen && (
                  <div className="p-4 space-y-4 border-t border-gray-200">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Increment From</label>
                      <div
                        className="relative cursor-pointer"
                        role="button"
                        tabIndex={0}
                        onClick={() => incrementFromInputRef.current?.showPicker?.()}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') incrementFromInputRef.current?.showPicker?.(); }}
                      >
                        <input
                          ref={incrementFromInputRef}
                          type="date"
                          value={incrementFrom}
                          onChange={(e) => setIncrementFrom(e.target.value)}
                          placeholder="Increment From"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-gray-900 bg-white placeholder-gray-400 cursor-pointer"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">After LOP</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="0"
                          value={afterLOP}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === '' || /^\d*\.?\d*$/.test(v)) setAfterLOP(v);
                          }}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Before LOP</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="0"
                          value={beforeLOP}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === '' || /^\d*\.?\d*$/.test(v)) setBeforeLOP(v);
                          }}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 bg-white"
                        />
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full border border-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Component</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Current Value</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Increment Value</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {incrementRows.map((row, index) => (
                            <tr key={row.component}>
                              <td className="px-4 py-2 text-sm text-gray-900">{row.component}</td>
                              <td className="px-4 py-2 text-sm text-gray-900 text-right font-medium">
                                {salaryLoading && row.component === 'Fixed Gross'
                                  ? 'Loading…'
                                  : row.component === 'Fixed Gross'
                                    ? row.currentValue > 0
                                      ? `₹ ${formatCurrency(row.currentValue)}`
                                      : '— No salary assigned'
                                    : formatCurrency(row.currentValue)}
                              </td>
                              <td className="px-4 py-2 text-right">
                                <input
                                  type="number"
                                  value={row.incrementValue || ''}
                                  onChange={(e) => setIncrementValue(index, Number(e.target.value) || 0)}
                                  className="w-full max-w-[120px] ml-auto border-b-2 border-green-500 rounded px-2 py-1 text-right text-gray-900 bg-white"
                                />
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-gray-50 font-medium">
                            <td className="px-4 py-2 text-sm text-gray-900">Total</td>
                            <td className="px-4 py-2 text-sm text-gray-900 text-right">₹ {formatCurrency(totalCurrent)}</td>
                            <td className="px-4 py-2 text-sm text-gray-900 text-right">{totalIncrement}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {saveError && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {saveError}
            </div>
          )}

          {/* Footer actions */}
          <div className="mt-8 pt-6 border-t border-gray-200 flex items-center justify-between">
            <button
              type="button"
              onClick={handleCancel}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg font-medium hover:bg-red-50 transition disabled:opacity-50"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
            >
              {saving ? (
                <>
                  <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  Save
                </>
              )}
            </button>
          </div>
          </>
          )}
        </div>
      </main>
    </div>
  );
}
