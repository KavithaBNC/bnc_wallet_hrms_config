import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/layout/AppHeader';
import { useAuthStore } from '../store/authStore';
import { getModulePermissions } from '../config/configurator-module-mapping';
import { payrollCycleService, PayrollCycle } from '../services/payroll.service';
import { complianceService, statutoryConfigService, StatutoryRateConfig } from '../services/compliance.service';

const fmt = (v: number | string | undefined | null) =>
  '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const ProfessionalTaxPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const ptPerms = getModulePermissions('/payroll-master');
  const isAdmin = ptPerms.can_edit;
  const orgId = user?.employee?.organizationId || user?.employee?.organization?.id || user?.organizationId || '';

  const [activeTab, setActiveTab] = useState<'config' | 'report'>('config');

  // --- Config Tab State ---
  const [ptConfigs, setPtConfigs] = useState<StatutoryRateConfig[]>([]);
  const [configLoading, setConfigLoading] = useState(false);
  const [editingConfig, setEditingConfig] = useState<StatutoryRateConfig | null>(null);
  const [editRules, setEditRules] = useState('');
  const [saving, setSaving] = useState(false);

  // --- Report Tab State ---
  const [cycles, setCycles] = useState<PayrollCycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState('');
  const [ptReport, setPtReport] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const selectedCycle = cycles.find((c) => c.id === selectedCycleId);
  const isLocked = selectedCycle
    ? selectedCycle.isLocked || ['FINALIZED', 'PAID'].includes(selectedCycle.status)
    : false;

  // Load configs
  useEffect(() => {
    setConfigLoading(true);
    statutoryConfigService.getAll('PT').then(setPtConfigs).catch(() => {}).finally(() => setConfigLoading(false));
  }, []);

  // Load cycles
  useEffect(() => {
    if (!orgId) return;
    payrollCycleService.getAll({ organizationId: orgId }).then((res) => {
      const list: PayrollCycle[] = res.data || [];
      setCycles(list);
      if (list.length > 0) setSelectedCycleId(list[0].id);
    }).catch(() => {});
  }, [orgId]);

  const fetchReport = useCallback(async () => {
    if (!selectedCycleId) return;
    setReportLoading(true);
    setReportError(null);
    setPtReport(null);
    try {
      const data = await complianceService.getPtReport(selectedCycleId);
      setPtReport(data);
    } catch (err: any) {
      setReportError(err.response?.data?.message || 'Failed to load PT report.');
    } finally {
      setReportLoading(false);
    }
  }, [selectedCycleId]);

  useEffect(() => { if (activeTab === 'report') fetchReport(); }, [activeTab, fetchReport]);

  const handleSaveConfig = async () => {
    if (!editingConfig) return;
    setSaving(true);
    try {
      const rulesObj = JSON.parse(editRules);
      await statutoryConfigService.update(editingConfig.id, { rules: rulesObj });
      const updated = await statutoryConfigService.getAll('PT');
      setPtConfigs(updated);
      setEditingConfig(null);
    } catch (e: any) {
      alert(e.message || 'Failed to save. Check JSON format.');
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async () => {
    if (!selectedCycleId) return;
    setDownloading(true);
    try {
      const blob = await complianceService.downloadPtCsv(selectedCycleId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `PT_Report_${selectedCycle?.name || 'cycle'}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Download failed.');
    } finally {
      setDownloading(false);
    }
  };

  // Build state-grouped rows from report
  const stateGroups: Record<string, any[]> = {};
  const employees: any[] = ptReport?.employees || [];
  employees.forEach((e: any) => {
    const state = e.state || e.ptLocation || 'Unknown';
    if (!stateGroups[state]) stateGroups[state] = [];
    stateGroups[state].push(e);
  });
  const totalPT = employees.reduce((s: number, e: any) => s + Number(e.professionalTax || 0), 0);

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <AppHeader
        title="Professional Tax"
        subtitle="State-wise PT Configuration & Monthly Report"
        onLogout={handleLogout}
      />

      <main className="flex-1 p-6">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => navigate('/statutory')} className="text-sm text-gray-500 hover:text-gray-800">
            ← Statutory Compliance
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
          {(['config', 'report'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 text-sm font-medium rounded-md transition ${activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {tab === 'config' ? '⚙️ PT Configuration' : '📋 PT Report'}
            </button>
          ))}
        </div>

        {/* ── Tab 1: PT Configuration ── */}
        {activeTab === 'config' && (
          <div>
            {!isAdmin && (
              <div className="mb-4 bg-blue-50 border border-blue-100 rounded-lg px-4 py-2 text-xs text-blue-600">
                Read-only: Only ORG_ADMIN or SUPER_ADMIN can edit PT configurations.
              </div>
            )}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">State-wise PT Slab Configuration</h3>
                <span className="text-xs text-gray-400">FY 2025-26</span>
              </div>
              {configLoading ? (
                <div className="py-16 text-center text-gray-400 text-sm">Loading configurations...</div>
              ) : ptConfigs.length === 0 ? (
                <div className="py-16 text-center text-gray-400 text-sm">
                  No PT configurations found. Run the statutory rate config seed script.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {['State / Region','Config Name','Financial Year','Status','Actions'].map((h) => (
                        <th key={h} className="px-4 py-3 text-left font-medium text-gray-500 text-xs">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {ptConfigs.map((cfg) => (
                      <tr key={cfg.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{cfg.region || 'National'}</td>
                        <td className="px-4 py-3 text-gray-600">{cfg.name}</td>
                        <td className="px-4 py-3 text-gray-600">{cfg.financialYear}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {cfg.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {isAdmin && (
                            <button
                              onClick={() => { setEditingConfig(cfg); setEditRules(JSON.stringify(cfg.rules, null, 2)); }}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                              Edit Slabs
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Edit Modal */}
            {editingConfig && (
              <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
                  <h3 className="text-base font-semibold text-gray-900 mb-1">Edit PT Slabs — {editingConfig.region}</h3>
                  <p className="text-xs text-gray-500 mb-4">Edit the JSON rules object. Changes take effect in the next payroll run.</p>
                  <textarea
                    value={editRules}
                    onChange={(e) => setEditRules(e.target.value)}
                    rows={14}
                    className="w-full font-mono text-xs border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex justify-end gap-3 mt-4">
                    <button onClick={() => setEditingConfig(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
                    <button
                      onClick={handleSaveConfig}
                      disabled={saving}
                      className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tab 2: PT Report ── */}
        {activeTab === 'report' && (
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <select
                value={selectedCycleId}
                onChange={(e) => setSelectedCycleId(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-w-[200px]"
              >
                <option value="">Select Payroll Cycle</option>
                {cycles.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.status}</option>)}
              </select>
              <div className="flex-1" />
              <button
                onClick={handleDownload}
                disabled={downloading || !ptReport}
                className="px-4 py-2 bg-gray-800 text-white text-sm rounded-lg hover:bg-gray-900 disabled:opacity-50"
              >
                {downloading ? '⏳' : '⬇'} Download PT Report
              </button>
            </div>

            {isLocked && (
              <div className="mb-4 bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 text-sm text-orange-600 font-medium">
                🔒 Finalized / Locked Cycle — View & download only.
              </div>
            )}

            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-4 mb-5">
              {[
                { label: 'Total Employees', value: employees.length.toString() },
                { label: 'States Covered', value: Object.keys(stateGroups).length.toString() },
                { label: 'Total PT Collected', value: fmt(totalPT) },
              ].map((c) => (
                <div key={c.label} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <p className="text-xs text-gray-500">{c.label}</p>
                  <p className="text-lg font-bold text-gray-900 mt-1">{c.value}</p>
                </div>
              ))}
            </div>

            {reportLoading ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 py-16 text-center text-gray-400 text-sm">Loading PT report...</div>
            ) : reportError ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 py-16 text-center text-red-400 text-sm">{reportError}</div>
            ) : employees.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 py-16 text-center text-gray-400 text-sm">
                {selectedCycleId ? 'No PT data for this cycle.' : 'Select a payroll cycle.'}
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  {Object.entries(stateGroups).map(([state, emps]) => {
                    const statePT = emps.reduce((s: number, e: any) => s + Number(e.professionalTax || 0), 0);
                    return (
                      <div key={state}>
                        <div className="bg-purple-50 px-4 py-2 border-b border-purple-100 flex items-center justify-between">
                          <span className="text-xs font-semibold text-purple-700">{state}</span>
                          <span className="text-xs font-semibold text-purple-700">Subtotal: {fmt(statePT)}</span>
                        </div>
                        <table className="w-full text-xs">
                          <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                              {['Emp Code','Name','Gross Salary','PT Deducted'].map((h) => (
                                <th key={h} className="px-4 py-2 text-left font-medium text-gray-500">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {emps.map((emp: any, i: number) => (
                              <tr key={i} className="hover:bg-gray-50">
                                <td className="px-4 py-2.5 text-gray-600">{emp.employeeCode}</td>
                                <td className="px-4 py-2.5 font-medium text-gray-900">{emp.name}</td>
                                <td className="px-4 py-2.5 text-gray-700">{fmt(emp.grossSalary)}</td>
                                <td className="px-4 py-2.5 font-semibold text-purple-700">{fmt(emp.professionalTax)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                </div>
                <div className="bg-gray-50 border-t border-gray-200 px-4 py-3 flex justify-between">
                  <span className="text-xs font-semibold text-gray-700">GRAND TOTAL — All States</span>
                  <span className="text-xs font-bold text-gray-900">{fmt(totalPT)}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default ProfessionalTaxPage;
