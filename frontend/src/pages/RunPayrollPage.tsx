import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/layout/AppHeader';
import { useAuthStore } from '../store/authStore';
import { payrollCycleService, PayrollCycle } from '../services/payroll.service';

type Step = 1 | 2 | 3;

interface PreCheck {
  label: string;
  status: 'pass' | 'warn' | 'fail' | 'loading';
  detail?: string;
}


const getStatusColor = (status: string) => {
  switch (status) {
    case 'DRAFT': return 'bg-gray-100 text-gray-700';
    case 'PROCESSING': return 'bg-yellow-100 text-yellow-700';
    case 'PROCESSED': return 'bg-blue-100 text-blue-700';
    case 'FINALIZED': return 'bg-purple-100 text-purple-700';
    case 'PAID': return 'bg-green-100 text-green-700';
    case 'CANCELLED': return 'bg-red-100 text-red-700';
    default: return 'bg-gray-100 text-gray-700';
  }
};

const RunPayrollPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;
  const organizationId = user?.employee?.organizationId;

  const isHRManager = user?.role === 'HR_MANAGER';
  const isOrgAdmin = user?.role === 'ORG_ADMIN';
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const canManagePayroll = isHRManager || isOrgAdmin || isSuperAdmin;

  // Step state
  const [step, setStep] = useState<Step>(1);

  // Step 1 state
  const [cycles, setCycles] = useState<PayrollCycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>('');
  const [selectedCycle, setSelectedCycle] = useState<PayrollCycle | null>(null);
  const [loadingCycles, setLoadingCycles] = useState(true);

  // Create cycle form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', periodStart: '', periodEnd: '', paymentDate: '', notes: '' });
  const [creating, setCreating] = useState(false);

  // Step 2 state
  const [preChecks, setPreChecks] = useState<PreCheck[]>([]);
  const [checksLoading, setChecksLoading] = useState(false);

  // Step 3 state
  const [processing, setProcessing] = useState(false);
  const [processResult, setProcessResult] = useState<any>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [finalized, setFinalized] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (organizationId) fetchCycles();
  }, [organizationId]);

  const fetchCycles = async () => {
    try {
      setLoadingCycles(true);
      const res = await payrollCycleService.getAll({ organizationId, page: '1', limit: '50' });
      // Show cycles that can still be acted on (not PAID/CANCELLED)
      const actionable = (res.data || []).filter(c => !['PAID', 'CANCELLED'].includes(c.status));
      setCycles(actionable);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load payroll cycles');
    } finally {
      setLoadingCycles(false);
    }
  };

  const handleSelectCycle = (id: string) => {
    setSelectedCycleId(id);
    const found = cycles.find(c => c.id === id) || null;
    setSelectedCycle(found);
  };

  const handleCreateCycle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId) return;
    const ps = new Date(createForm.periodStart);
    const pe = new Date(createForm.periodEnd);
    const pd = new Date(createForm.paymentDate);
    if (pe <= ps) { alert('Period end must be after period start'); return; }
    if (pd <= pe) { alert('Payment date must be after period end'); return; }
    try {
      setCreating(true);
      const newCycle = await payrollCycleService.create({
        organizationId,
        name: createForm.name,
        periodStart: createForm.periodStart,
        periodEnd: createForm.periodEnd,
        paymentDate: createForm.paymentDate,
        notes: createForm.notes || undefined,
      });
      setShowCreateForm(false);
      setCreateForm({ name: '', periodStart: '', periodEnd: '', paymentDate: '', notes: '' });
      await fetchCycles();
      setSelectedCycleId(newCycle.id);
      setSelectedCycle(newCycle);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create cycle');
    } finally {
      setCreating(false);
    }
  };

  const handleGoToStep2 = async () => {
    if (!selectedCycle || !selectedCycleId) { alert('Please select or create a payroll cycle'); return; }
    setStep(2);
    setChecksLoading(true);
    setPreChecks([
      { label: 'Salary Structures', status: 'loading' },
      { label: 'Attendance Posted', status: 'loading' },
      { label: 'Bank Accounts', status: 'loading' },
      { label: 'Duplicate Active Cycles', status: 'loading' },
    ]);
    try {
      const result = await payrollCycleService.preRunCheck(selectedCycleId);
      setPreChecks(result.checks);
    } catch {
      setPreChecks([
        { label: 'Pre-run check failed', status: 'fail', detail: 'Unable to validate. You may still proceed with caution.' },
      ]);
    } finally {
      setChecksLoading(false);
    }
  };

  const handleProcess = async () => {
    if (!selectedCycleId) return;
    if (!confirm('This will calculate salaries for all employees in this cycle. Proceed?')) return;
    try {
      setProcessing(true);
      setError(null);
      const result = await payrollCycleService.processPayrollCycle(selectedCycleId);
      setProcessResult(result);
      // Refresh the cycle data
      const updated = await payrollCycleService.getById(selectedCycleId);
      setSelectedCycle(updated);
      setStep(3);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to process payroll');
    } finally {
      setProcessing(false);
    }
  };

  const handleFinalize = async () => {
    if (!selectedCycleId) return;
    if (!confirm('Finalize and LOCK this payroll cycle? This cannot be undone without a Rollback.')) return;
    try {
      setFinalizing(true);
      setError(null);
      const updated = await payrollCycleService.finalizePayrollCycle(selectedCycleId);
      setSelectedCycle(updated);
      setFinalized(true);
      await fetchCycles();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to finalize payroll');
    } finally {
      setFinalizing(false);
    }
  };

  const handleRollback = async () => {
    if (!selectedCycleId) return;
    if (!confirm('Rollback will unlock this cycle and allow re-processing. Proceed?')) return;
    try {
      setRollingBack(true);
      setError(null);
      const updated = await payrollCycleService.rollbackPayrollCycle(selectedCycleId);
      setSelectedCycle(updated);
      setFinalized(false);
      setProcessResult(null);
      setStep(2);
      await fetchCycles();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to rollback payroll');
    } finally {
      setRollingBack(false);
    }
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  const hasFails = preChecks.some(c => c.status === 'fail');
  const allChecksLoaded = preChecks.length > 0 && !preChecks.some(c => c.status === 'loading');
  const isAlreadyProcessed = selectedCycle && ['PROCESSED', 'FINALIZED', 'PAID'].includes(selectedCycle.status);

  if (!canManagePayroll) {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
        <AppHeader title="Run Payroll" onLogout={handleLogout} />
        <div className="p-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800 text-sm">You don't have permission to run payroll.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader
        title="Run Payroll"
        subtitle={organizationName ? `Organization: ${organizationName}` : undefined}
        onLogout={handleLogout}
      />

      <div className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Process Monthly Payroll</h2>
          <p className="text-sm text-gray-500 mt-1">Follow the steps to calculate and lock employee salaries</p>
        </div>

        {/* Step Indicator */}
        <div className="mb-6">
          <div className="flex items-center gap-0">
            {[
              { num: 1, label: 'Select Cycle' },
              { num: 2, label: 'Pre-Run Checks' },
              { num: 3, label: 'Process & Finalize' },
            ].map((s, idx) => (
              <div key={s.num} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                    step > s.num ? 'bg-green-500 border-green-500 text-white' :
                    step === s.num ? 'bg-blue-600 border-blue-600 text-white' :
                    'bg-white border-gray-300 text-gray-400'
                  }`}>
                    {step > s.num ? '✓' : s.num}
                  </div>
                  <span className={`mt-1.5 text-xs font-medium whitespace-nowrap ${
                    step === s.num ? 'text-blue-600' : step > s.num ? 'text-green-600' : 'text-gray-400'
                  }`}>{s.label}</span>
                </div>
                {idx < 2 && (
                  <div className={`flex-1 h-0.5 mx-2 mb-5 ${step > s.num ? 'bg-green-400' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* ─── STEP 1: Select Cycle ─── */}
        {step === 1 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-base font-semibold text-gray-800 mb-4">Select Payroll Cycle</h3>

            {loadingCycles ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                <p className="mt-2 text-gray-500 text-sm">Loading cycles...</p>
              </div>
            ) : (
              <>
                {cycles.length > 0 && (
                  <div className="mb-5">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Choose an existing cycle to process:
                    </label>
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {cycles.map(cycle => (
                        <label
                          key={cycle.id}
                          className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition ${
                            selectedCycleId === cycle.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300 bg-white'
                          }`}
                        >
                          <input
                            type="radio"
                            name="cycle"
                            value={cycle.id}
                            checked={selectedCycleId === cycle.id}
                            onChange={() => handleSelectCycle(cycle.id)}
                            className="text-blue-600"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900">{cycle.name}</p>
                            <p className="text-xs text-gray-500">
                              {new Date(cycle.periodStart).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                              {' – '}
                              {new Date(cycle.periodEnd).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            {cycle.totalEmployees != null && (
                              <span className="text-xs text-gray-500">{cycle.totalEmployees} emp</span>
                            )}
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusColor(cycle.status)}`}>
                              {cycle.status}
                            </span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="border-t border-gray-100 pt-4">
                  {!showCreateForm ? (
                    <button
                      onClick={() => setShowCreateForm(true)}
                      className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      + Create New Payroll Cycle
                    </button>
                  ) : (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">New Payroll Cycle</h4>
                      <form onSubmit={handleCreateCycle} className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Cycle Name <span className="text-red-500">*</span></label>
                          <input
                            type="text" required
                            placeholder="e.g., April 2026 Payroll"
                            value={createForm.name}
                            onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
                            className="w-full h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Period Start <span className="text-red-500">*</span></label>
                            <input type="date" required value={createForm.periodStart}
                              onChange={e => setCreateForm({ ...createForm, periodStart: e.target.value })}
                              className="w-full h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Period End <span className="text-red-500">*</span></label>
                            <input type="date" required value={createForm.periodEnd}
                              onChange={e => setCreateForm({ ...createForm, periodEnd: e.target.value })}
                              className="w-full h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Payment Date <span className="text-red-500">*</span></label>
                            <input type="date" required value={createForm.paymentDate}
                              onChange={e => setCreateForm({ ...createForm, paymentDate: e.target.value })}
                              className="w-full h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button type="submit" disabled={creating}
                            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
                          >
                            {creating ? 'Creating...' : 'Create Cycle'}
                          </button>
                          <button type="button" onClick={() => setShowCreateForm(false)}
                            className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                </div>

                <div className="flex justify-end mt-6 pt-4 border-t border-gray-100">
                  <button
                    onClick={handleGoToStep2}
                    disabled={!selectedCycleId}
                    className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    Next: Pre-Run Checks →
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ─── STEP 2: Pre-Run Checks ─── */}
        {step === 2 && selectedCycle && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="mb-5">
              <h3 className="text-base font-semibold text-gray-800">Pre-Run Validation</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Checking readiness for: <span className="font-medium text-gray-700">{selectedCycle.name}</span>
              </p>
            </div>

            {/* Selected cycle summary */}
            <div className="bg-gray-50 rounded-lg p-4 mb-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-400 text-xs">Period</p>
                <p className="font-medium text-gray-800">
                  {new Date(selectedCycle.periodStart).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  {' – '}
                  {new Date(selectedCycle.periodEnd).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Payment Date</p>
                <p className="font-medium text-gray-800">
                  {new Date(selectedCycle.paymentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Employees</p>
                <p className="font-medium text-gray-800">{selectedCycle.totalEmployees ?? 'N/A'}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Status</p>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(selectedCycle.status)}`}>
                  {selectedCycle.status}
                </span>
              </div>
            </div>

            {/* Checks list */}
            <div className="space-y-3 mb-6">
              {checksLoading && preChecks.every(c => c.status === 'loading') ? (
                <div className="text-center py-6">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                  <p className="mt-2 text-gray-500 text-sm">Running checks...</p>
                </div>
              ) : (
                preChecks.map((check, idx) => (
                  <div key={idx} className={`flex items-start gap-3 p-3.5 rounded-lg border ${
                    check.status === 'pass' ? 'bg-green-50 border-green-200' :
                    check.status === 'warn' ? 'bg-yellow-50 border-yellow-200' :
                    check.status === 'fail' ? 'bg-red-50 border-red-200' :
                    'bg-gray-50 border-gray-200'
                  }`}>
                    <span className="text-lg mt-0.5">
                      {check.status === 'pass' ? '✅' :
                       check.status === 'warn' ? '⚠️' :
                       check.status === 'fail' ? '❌' : '⏳'}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{check.label}</p>
                      {check.detail && <p className="text-xs text-gray-500 mt-0.5">{check.detail}</p>}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
              <button
                onClick={() => { setStep(1); setPreChecks([]); }}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition"
              >
                ← Back
              </button>
              <button
                onClick={handleProcess}
                disabled={processing || !allChecksLoaded || hasFails || isAlreadyProcessed as boolean}
                className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-2"
              >
                {processing ? (
                  <>
                    <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Processing...
                  </>
                ) : isAlreadyProcessed ? (
                  'Already Processed — Go to Step 3 →'
                ) : (
                  '▶ Process Payroll →'
                )}
              </button>
              {isAlreadyProcessed && (
                <button
                  onClick={() => setStep(3)}
                  className="ml-2 px-4 py-2.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition"
                >
                  View Results →
                </button>
              )}
            </div>
          </div>
        )}

        {/* ─── STEP 3: Results & Finalize ─── */}
        {step === 3 && selectedCycle && (
          <div className="space-y-5">
            {/* Result banner */}
            {processResult && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-5">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">✅</span>
                  <div>
                    <p className="text-sm font-semibold text-green-800">Payroll Processed Successfully</p>
                    <p className="text-xs text-green-600 mt-0.5">
                      {processResult.data?.message || processResult.message || 'Payslips generated for all eligible employees'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {finalized && (
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-5">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🔒</span>
                  <div>
                    <p className="text-sm font-semibold text-purple-800">Payroll Finalized &amp; Locked</p>
                    <p className="text-xs text-purple-600 mt-0.5">
                      No further modifications allowed. Use Rollback to unlock if required.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Cycle summary */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-base font-semibold text-gray-800 mb-4">Payroll Summary — {selectedCycle.name}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <p className="text-xs text-blue-500 font-medium mb-1">Employees</p>
                  <p className="text-2xl font-bold text-blue-700">{selectedCycle.totalEmployees ?? 0}</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 text-center">
                  <p className="text-xs text-purple-500 font-medium mb-1">Total Gross</p>
                  <p className="text-lg font-bold text-purple-700">
                    {selectedCycle.totalGross
                      ? '₹' + Number(selectedCycle.totalGross).toLocaleString('en-IN', { minimumFractionDigits: 0 })
                      : '—'}
                  </p>
                </div>
                <div className="bg-red-50 rounded-lg p-4 text-center">
                  <p className="text-xs text-red-500 font-medium mb-1">Total Deductions</p>
                  <p className="text-lg font-bold text-red-700">
                    {selectedCycle.totalDeductions
                      ? '₹' + Number(selectedCycle.totalDeductions).toLocaleString('en-IN', { minimumFractionDigits: 0 })
                      : '—'}
                  </p>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <p className="text-xs text-green-500 font-medium mb-1">Net Pay</p>
                  <p className="text-lg font-bold text-green-700">
                    {selectedCycle.totalNet
                      ? '₹' + Number(selectedCycle.totalNet).toLocaleString('en-IN', { minimumFractionDigits: 0 })
                      : '—'}
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-3 text-sm">
                <span className="text-gray-500">Status:</span>
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusColor(selectedCycle.status)}`}>
                  {selectedCycle.status}
                </span>
                {selectedCycle.isLocked && (
                  <span className="text-purple-600 font-medium">🔒 Locked</span>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Next Actions</h3>
              <div className="flex flex-wrap gap-3">
                {/* View Payslips */}
                <button
                  onClick={() => navigate('/payroll')}
                  className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
                >
                  📄 View Payslips
                </button>

                {/* Finalize — only if PROCESSED, not yet finalized */}
                {selectedCycle.status === 'PROCESSED' && !finalized && (
                  <button
                    onClick={handleFinalize}
                    disabled={finalizing}
                    className="px-5 py-2.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 transition flex items-center gap-2"
                  >
                    {finalizing ? (
                      <>
                        <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                        Finalizing...
                      </>
                    ) : (
                      '🔒 Finalize & Lock'
                    )}
                  </button>
                )}

                {/* Rollback — if FINALIZED */}
                {(selectedCycle.status === 'FINALIZED' || finalized) && (
                  <button
                    onClick={handleRollback}
                    disabled={rollingBack}
                    className="px-5 py-2.5 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50 transition"
                  >
                    {rollingBack ? 'Rolling back...' : '↩️ Rollback'}
                  </button>
                )}

                {/* Mark as Paid — if FINALIZED */}
                {(selectedCycle.status === 'FINALIZED' || finalized) && (
                  <button
                    onClick={async () => {
                      if (!confirm('Mark this payroll as PAID? This updates all payslips to PAID status.')) return;
                      try {
                        const updated = await payrollCycleService.markAsPaid(selectedCycleId);
                        setSelectedCycle(updated);
                        alert('Payroll marked as PAID!');
                        navigate('/payroll/history');
                      } catch (err: any) {
                        alert(err.response?.data?.message || 'Failed to mark as paid');
                      }
                    }}
                    className="px-5 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition"
                  >
                    ✅ Mark as Paid
                  </button>
                )}

                {/* Payroll History */}
                <button
                  onClick={() => navigate('/payroll/history')}
                  className="px-5 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition"
                >
                  📋 Payroll History
                </button>
              </div>

              {/* Lock status info */}
              {selectedCycle.isLocked && (
                <div className="mt-4 p-3 bg-purple-50 border border-purple-100 rounded-lg text-xs text-purple-700">
                  🔒 This payroll cycle is <strong>LOCKED</strong>. Editing is disabled. Use Rollback to unlock if corrections are needed.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RunPayrollPage;
