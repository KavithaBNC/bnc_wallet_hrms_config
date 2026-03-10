import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';
import {
  employeeSalaryService,
  salaryStructureService,
  EmployeeSalary,
  SalaryStructure,
} from '../services/payroll.service';
import employeeService, { Employee } from '../services/employee.service';

type Tab = 'breakdown' | 'edit' | 'history';

const EmployeeSalaryDetailPage = () => {
  const { employeeId } = useParams<{ employeeId: string }>();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;
  const organizationId = user?.employee?.organizationId;

  const isHRManager = user?.role === 'HR_MANAGER';
  const isOrgAdmin = user?.role === 'ORG_ADMIN';
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const canManage = isHRManager || isOrgAdmin || isSuperAdmin;

  const [tab, setTab] = useState<Tab>('breakdown');
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [currentSalary, setCurrentSalary] = useState<EmployeeSalary | null>(null);
  const [salaryHistory, setSalaryHistory] = useState<EmployeeSalary[]>([]);
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState({
    basicSalary: '',
    grossSalary: '',
    netSalary: '',
    ctc: '',
    revisionReason: '',
    effectiveDate: '',
    currency: 'INR',
    paymentFrequency: 'MONTHLY' as 'MONTHLY' | 'BI_WEEKLY' | 'WEEKLY',
    salaryStructureId: '',
  });

  useEffect(() => {
    if (employeeId) loadAll();
  }, [employeeId]);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [emp, structRes] = await Promise.all([
        employeeService.getById(employeeId!),
        salaryStructureService.getAll({ organizationId, limit: '50' }),
      ]);
      setEmployee(emp);
      setStructures(structRes.data || []);

      const [current, history] = await Promise.all([
        employeeSalaryService.getCurrentSalary(employeeId!).catch(() => null),
        employeeSalaryService.getSalaryHistory(employeeId!).catch(() => []),
      ]);
      setCurrentSalary(current);
      setSalaryHistory(history);

      if (current) {
        setEditForm({
          basicSalary: String(current.basicSalary),
          grossSalary: String(current.grossSalary),
          netSalary: String(current.netSalary),
          ctc: current.ctc ? String(current.ctc) : '',
          revisionReason: '',
          effectiveDate: new Date().toISOString().split('T')[0],
          currency: current.currency,
          paymentFrequency: current.paymentFrequency,
          salaryStructureId: current.salaryStructureId || '',
        });
      }
    } catch (err: any) {
      if (err.response?.status === 400 && err.response?.data?.message?.includes('locked')) {
        setIsLocked(true);
      }
      setError(err.response?.data?.message || 'Failed to load salary data');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) { alert('Cannot modify salary while payroll is locked.'); return; }
    setSubmitting(true);
    setSaveSuccess(false);
    try {
      await employeeSalaryService.createSalaryEnhanced({
        employeeId: employeeId!,
        salaryStructureId: editForm.salaryStructureId || undefined,
        effectiveDate: editForm.effectiveDate,
        basicSalary: parseFloat(editForm.basicSalary),
        grossSalary: parseFloat(editForm.grossSalary),
        netSalary: parseFloat(editForm.netSalary),
        ctc: editForm.ctc ? parseFloat(editForm.ctc) : undefined,
        revisionReason: editForm.revisionReason || undefined,
        currency: editForm.currency,
        paymentFrequency: editForm.paymentFrequency,
        isActive: true,
      });
      setSaveSuccess(true);
      await loadAll();
      setTab('breakdown');
    } catch (err: any) {
      if (err.response?.data?.message?.includes('locked')) setIsLocked(true);
      alert(err.response?.data?.message || 'Failed to save salary revision');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => { await logout(); navigate('/login'); };
  const fmt = (v: number | undefined) => v != null ? `₹${Number(v).toLocaleString('en-IN')}` : '—';
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  if (loading) {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
        <AppHeader title="Employee Salary Details" subtitle={organizationName} onLogout={handleLogout} />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
            <p className="mt-3 text-gray-500">Loading salary details...</p>
          </div>
        </main>
      </div>
    );
  }

  const ctcBreakdown = currentSalary?.ctcBreakdown as Record<string, number> | null;
  const components = currentSalary?.components as Record<string, number> | null;

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader title="Employee Salary Details" subtitle={organizationName} onLogout={handleLogout} />
      <main className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Back button */}
        <button
          onClick={() => navigate('/employee-salaries')}
          className="mb-4 flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Employee Salaries
        </button>

        {/* Payroll lock banner */}
        {isLocked && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
            <svg className="w-5 h-5 text-amber-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <p className="text-sm text-amber-800 font-medium">Payroll is currently locked. Salary modifications are not allowed until the payroll is rolled back.</p>
          </div>
        )}

        {error && !isLocked && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">{error}</div>
        )}

        {/* Employee card */}
        {employee && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xl">
                {(employee.firstName?.[0] || '').toUpperCase()}
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900">{employee.firstName} {employee.lastName}</h2>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                  <span className="text-sm text-gray-500">Code: <strong>{employee.employeeCode}</strong></span>
                  {employee.department && <span className="text-sm text-gray-500">Dept: <strong>{employee.department.name}</strong></span>}
                  {employee.position && <span className="text-sm text-gray-500">Role: <strong>{employee.position.title}</strong></span>}
                </div>
              </div>
              {currentSalary && (
                <div className="text-right hidden sm:block">
                  <p className="text-xs text-gray-400">Current Net Salary</p>
                  <p className="text-2xl font-bold text-blue-700">{fmt(currentSalary.netSalary)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Effective {fmtDate(currentSalary.effectiveDate)}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab navigation */}
        <div className="flex gap-1 mb-6 bg-white rounded-xl shadow-sm border border-gray-100 p-1 w-fit">
          {([
            { key: 'breakdown', label: 'Salary Breakdown', icon: '📊' },
            { key: 'edit', label: 'Edit / Revise', icon: '✏️' },
            { key: 'history', label: 'Revision History', icon: '📋' },
          ] as { key: Tab; label: string; icon: string }[]).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition ${
                tab === t.key ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ── TAB: BREAKDOWN ── */}
        {tab === 'breakdown' && (
          <div className="space-y-5">
            {!currentSalary ? (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-400">
                <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="font-medium">No salary assigned</p>
                {canManage && (
                  <button onClick={() => setTab('edit')} className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
                    Assign Now
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Summary cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: 'Basic Salary', value: fmt(currentSalary.basicSalary), color: 'gray' },
                    { label: 'Gross Salary', value: fmt(currentSalary.grossSalary), color: 'green' },
                    { label: 'Net Salary', value: fmt(currentSalary.netSalary), color: 'blue' },
                    { label: 'CTC', value: fmt(currentSalary.ctc), color: 'purple' },
                  ].map((card) => (
                    <div key={card.label} className={`bg-white rounded-xl shadow-sm border border-gray-100 p-5`}>
                      <p className="text-xs text-gray-500">{card.label}</p>
                      <p className={`text-xl font-bold mt-1 text-${card.color}-700`}>{card.value}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* Salary components */}
                  {components && Object.keys(components).length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                      <div className="px-6 py-4 border-b border-gray-100">
                        <h3 className="font-semibold text-gray-900">Salary Components</h3>
                      </div>
                      <div className="divide-y divide-gray-50">
                        {Object.entries(components).map(([key, value]) => (
                          <div key={key} className="flex items-center justify-between px-6 py-3">
                            <span className="text-sm text-gray-700 font-medium uppercase">{key.replace(/_/g, ' ')}</span>
                            <span className="text-sm font-bold text-gray-900">{fmt(value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* CTC Breakdown */}
                  {ctcBreakdown && Object.keys(ctcBreakdown).length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                      <div className="px-6 py-4 border-b border-gray-100">
                        <h3 className="font-semibold text-gray-900">CTC Breakdown</h3>
                      </div>
                      <div className="divide-y divide-gray-50">
                        {Object.entries(ctcBreakdown).map(([key, value]) => (
                          <div key={key} className={`flex items-center justify-between px-6 py-3 ${key === 'totalCTC' ? 'bg-blue-50 font-bold' : ''}`}>
                            <span className="text-sm text-gray-700 capitalize">{key.replace(/([A-Z])/g, ' $1').toLowerCase()}</span>
                            <span className={`text-sm font-bold ${key === 'totalCTC' ? 'text-blue-700' : 'text-gray-900'}`}>{fmt(value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Metadata */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Salary Details</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                    {[
                      { label: 'Effective From', value: fmtDate(currentSalary.effectiveDate) },
                      { label: 'Currency', value: currentSalary.currency },
                      { label: 'Payment Frequency', value: currentSalary.paymentFrequency.replace('_', '-') },
                      { label: 'Revision Reason', value: currentSalary.revisionReason || '—' },
                      { label: 'Status', value: currentSalary.isActive ? 'Active' : 'Inactive' },
                      { label: 'Salary Structure', value: structures.find((s) => s.id === currentSalary.salaryStructureId)?.name || '—' },
                    ].map((item) => (
                      <div key={item.label}>
                        <p className="text-gray-400 text-xs">{item.label}</p>
                        <p className="font-medium text-gray-800 mt-0.5">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── TAB: EDIT ── */}
        {tab === 'edit' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            {isLocked ? (
              <div className="text-center py-8 text-amber-700">
                <svg className="w-12 h-12 mx-auto mb-3 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <p className="font-semibold text-lg">Salary is Locked</p>
                <p className="text-sm mt-1 text-gray-500">Rollback the active payroll cycle to enable editing.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h3 className="font-semibold text-gray-900 text-lg">Revise Salary</h3>
                    <p className="text-sm text-gray-500 mt-0.5">Creating a new salary record will end the current one and start a revision history.</p>
                  </div>
                  {saveSuccess && (
                    <span className="text-sm text-green-700 bg-green-50 px-3 py-1 rounded-full font-medium">Saved successfully</span>
                  )}
                </div>
                <form onSubmit={handleSaveEdit} className="space-y-5">
                  {/* Salary structure */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Salary Structure (optional)</label>
                    <select
                      value={editForm.salaryStructureId}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, salaryStructureId: e.target.value }))}
                      className="w-full h-10 px-4 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Keep current / None</option>
                      {structures.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Salary amounts */}
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { key: 'basicSalary', label: 'Basic Salary (₹)', req: true },
                      { key: 'grossSalary', label: 'Gross Salary (₹)', req: true },
                      { key: 'netSalary', label: 'Net Salary (₹)', req: true },
                      { key: 'ctc', label: 'CTC (₹)', req: false },
                    ].map(({ key, label, req }) => (
                      <div key={key}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{label} {req && <span className="text-red-500">*</span>}</label>
                        <input
                          type="number"
                          value={(editForm as any)[key]}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, [key]: e.target.value }))}
                          min="0"
                          step="0.01"
                          required={req}
                          className="w-full h-10 px-4 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    ))}
                  </div>

                  {/* Effective date */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Effective Date <span className="text-red-500">*</span></label>
                      <input
                        type="date"
                        value={editForm.effectiveDate}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, effectiveDate: e.target.value }))}
                        required
                        className="w-full h-10 px-4 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Payment Frequency</label>
                      <select
                        value={editForm.paymentFrequency}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, paymentFrequency: e.target.value as any }))}
                        className="w-full h-10 px-4 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="MONTHLY">Monthly</option>
                        <option value="BI_WEEKLY">Bi-Weekly</option>
                        <option value="WEEKLY">Weekly</option>
                      </select>
                    </div>
                  </div>

                  {/* Revision reason */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Revision Reason <span className="text-gray-400">(recommended)</span></label>
                    <input
                      type="text"
                      value={editForm.revisionReason}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, revisionReason: e.target.value }))}
                      placeholder="e.g. Annual appraisal, Promotion, Market correction..."
                      className="w-full h-10 px-4 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-400 mt-1">This will be saved in the revision audit history</p>
                  </div>

                  <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                    <button type="button" onClick={() => setTab('breakdown')} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm">Cancel</button>
                    <button type="submit" disabled={submitting} className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50">
                      {submitting ? 'Saving...' : 'Save Revision'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        )}

        {/* ── TAB: HISTORY ── */}
        {tab === 'history' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Salary Revision History</h3>
              <span className="text-xs text-gray-400">{salaryHistory.length} records</span>
            </div>
            {salaryHistory.length === 0 ? (
              <div className="p-12 text-center text-gray-400">No salary history found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Effective Date', 'End Date', 'Basic', 'Gross', 'Net', 'CTC', 'Reason / Remarks', 'Status'].map((h) => (
                        <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {salaryHistory.map((sal, idx) => (
                      <tr key={sal.id} className={sal.isActive ? 'bg-blue-50' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-5 py-4 text-sm font-medium text-gray-900">{fmtDate(sal.effectiveDate)}</td>
                        <td className="px-5 py-4 text-sm text-gray-500">{sal.endDate ? fmtDate(sal.endDate) : '—'}</td>
                        <td className="px-5 py-4 text-sm text-gray-900">{fmt(sal.basicSalary)}</td>
                        <td className="px-5 py-4 text-sm font-medium text-green-700">{fmt(sal.grossSalary)}</td>
                        <td className="px-5 py-4 text-sm font-bold text-blue-700">{fmt(sal.netSalary)}</td>
                        <td className="px-5 py-4 text-sm text-gray-700">{fmt(sal.ctc)}</td>
                        <td className="px-5 py-4 text-sm text-gray-500 max-w-xs">
                          <span className="truncate block" title={sal.revisionReason || ''}>{sal.revisionReason || '—'}</span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${sal.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {sal.isActive ? 'Current' : 'Historical'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Timeline view (compact) */}
            {salaryHistory.length > 1 && (
              <div className="px-6 py-5 border-t border-gray-100">
                <h4 className="text-sm font-semibold text-gray-700 mb-4">Salary Progression</h4>
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>
                  <div className="space-y-4">
                    {salaryHistory.map((sal) => (
                      <div key={sal.id} className="relative flex items-start gap-4 pl-10">
                        <div className={`absolute left-2.5 w-3 h-3 rounded-full border-2 mt-1 ${sal.isActive ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-300'}`}></div>
                        <div className={`flex-1 p-3 rounded-lg border text-sm ${sal.isActive ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100'}`}>
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-gray-900">{fmt(sal.netSalary)} <span className="text-xs text-gray-400 font-normal">net</span></span>
                            <span className="text-xs text-gray-400">{fmtDate(sal.effectiveDate)}</span>
                          </div>
                          {sal.revisionReason && <p className="text-xs text-gray-500 mt-1">{sal.revisionReason}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default EmployeeSalaryDetailPage;
