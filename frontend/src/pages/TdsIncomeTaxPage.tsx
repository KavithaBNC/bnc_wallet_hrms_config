import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/layout/AppHeader';
import { useAuthStore } from '../store/authStore';
import { payrollCycleService, PayrollCycle } from '../services/payroll.service';
import { complianceService } from '../services/compliance.service';

const fmt = (v: number | string | undefined | null) =>
  '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const FY_OPTIONS = ['2025-26', '2024-25', '2023-24'];
const CURRENT_FY = '2025-26';

const PanStatusBadge = ({ pan }: { pan: string | null | undefined }) => {
  if (!pan || pan.trim() === '') return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Missing — 20% TDS</span>;
  if (/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan.trim())) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Valid</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">Invalid</span>;
};

const TdsIncomeTaxPage = () => {
  const navigate = useNavigate();
  const { logout } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'monthly' | 'annual' | 'form16'>('monthly');

  // Shared
  const [cycles, setCycles] = useState<PayrollCycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState('');
  const [selectedFY, setSelectedFY] = useState(CURRENT_FY);

  // Monthly TDS
  const [monthlyData, setMonthlyData] = useState<any>(null);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [monthlyError, setMonthlyError] = useState<string | null>(null);

  // Annual Working Sheet
  const [annualData, setAnnualData] = useState<any>(null);
  const [annualLoading, setAnnualLoading] = useState(false);
  const [annualError, setAnnualError] = useState<string | null>(null);

  // Form 16
  const [form16List, setForm16List] = useState<any[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);
  const [form16Detail, setForm16Detail] = useState<any>(null);
  const [form16Loading, setForm16Loading] = useState(false);
  const [form16Error, setForm16Error] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');

  const selectedCycle = cycles.find((c) => c.id === selectedCycleId);
  const isLocked = selectedCycle
    ? selectedCycle.isLocked || ['FINALIZED', 'PAID'].includes(selectedCycle.status)
    : false;

  useEffect(() => {
    payrollCycleService.getAll().then((res) => {
      const list: PayrollCycle[] = res.data || [];
      setCycles(list);
      if (list.length > 0) setSelectedCycleId(list[0].id);
    }).catch(() => {});
  }, []);

  // Monthly TDS fetch
  const fetchMonthly = useCallback(async () => {
    if (!selectedCycleId) return;
    setMonthlyLoading(true);
    setMonthlyError(null);
    try {
      const data = await complianceService.getPayrollRegister(selectedCycleId);
      setMonthlyData(data);
    } catch (err: any) {
      setMonthlyError(err.response?.data?.message || 'Failed to load monthly TDS data.');
    } finally {
      setMonthlyLoading(false);
    }
  }, [selectedCycleId]);

  // Annual fetch
  const fetchAnnual = useCallback(async () => {
    setAnnualLoading(true);
    setAnnualError(null);
    try {
      const data = await complianceService.getTdsWorkingSheet(selectedFY);
      setAnnualData(data);
    } catch (err: any) {
      setAnnualError(err.response?.data?.message || 'Failed to load annual TDS data.');
    } finally {
      setAnnualLoading(false);
    }
  }, [selectedFY]);

  // Form 16 fetch
  const fetchForm16List = useCallback(async () => {
    setForm16Loading(true);
    setForm16Error(null);
    try {
      const data = await complianceService.getForm16(selectedFY);
      setForm16List(Array.isArray(data) ? data : data?.employees || []);
    } catch (err: any) {
      setForm16Error(err.response?.data?.message || 'Failed to load Form 16 data.');
    } finally {
      setForm16Loading(false);
    }
  }, [selectedFY]);

  const fetchForm16Detail = useCallback(async (empId: string) => {
    setForm16Loading(true);
    try {
      const data = await complianceService.getForm16(selectedFY, empId);
      setForm16Detail(data);
    } catch (err: any) {
      setForm16Error(err.response?.data?.message || 'Failed to load Form 16 detail.');
    } finally {
      setForm16Loading(false);
    }
  }, [selectedFY]);

  useEffect(() => { if (activeTab === 'monthly') fetchMonthly(); }, [activeTab, fetchMonthly]);
  useEffect(() => { if (activeTab === 'annual') fetchAnnual(); }, [activeTab, fetchAnnual]);
  useEffect(() => { if (activeTab === 'form16') fetchForm16List(); }, [activeTab, fetchForm16List]);

  // Monthly employees from payroll register
  const monthlyEmps: any[] = monthlyData?.employees || [];
  const totalTDS = monthlyEmps.reduce((s: number, e: any) => s + Number(e.taxDetails?.incomeTax || e.incomeTax || 0), 0);
  const validPAN = monthlyEmps.filter((e: any) => {
    const pan = e.taxInformation?.panNumber || e.pan;
    return pan && /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan.trim());
  }).length;

  // Annual employees
  const annualEmps: any[] = annualData?.employees || [];
  const totalAnnualGross = annualEmps.reduce((s: number, e: any) => s + Number(e.ytdGross || 0), 0);
  const totalAnnualTDS = annualEmps.reduce((s: number, e: any) => s + Number(e.ytdTax || 0), 0);

  // Form 16 filtered list
  const filteredForm16 = form16List.filter((e: any) => {
    const name = `${e.firstName || ''} ${e.lastName || ''} ${e.employeeCode || ''}`.toLowerCase();
    return name.includes(searchText.toLowerCase());
  });

  const handleLogout = () => { logout(); navigate('/login'); };

  const TABS = [
    { key: 'monthly', label: '📅 Monthly TDS' },
    { key: 'annual', label: '📊 Annual Working Sheet' },
    { key: 'form16', label: '📄 Form 16' },
  ] as const;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <AppHeader
        title="TDS / Income Tax"
        subtitle="Monthly TDS, Annual Working Sheet & Form 16"
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
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-2 text-sm font-medium rounded-md transition ${activeTab === tab.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Tab 1: Monthly TDS ── */}
        {activeTab === 'monthly' && (
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <select
                value={selectedCycleId}
                onChange={(e) => setSelectedCycleId(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-w-[220px]"
              >
                <option value="">Select Payroll Cycle</option>
                {cycles.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.status}</option>)}
              </select>
            </div>

            {isLocked && (
              <div className="mb-4 bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 text-sm text-orange-600 font-medium">
                🔒 Finalized / Locked Cycle — View only.
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
              {[
                { label: 'Total Employees', value: monthlyEmps.length.toString() },
                { label: 'Valid PAN', value: validPAN.toString() },
                { label: 'Missing/Invalid PAN', value: (monthlyEmps.length - validPAN).toString() },
                { label: 'Total TDS Deducted', value: fmt(totalTDS) },
              ].map((c) => (
                <div key={c.label} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <p className="text-xs text-gray-500">{c.label}</p>
                  <p className="text-lg font-bold text-gray-900 mt-1">{c.value}</p>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {monthlyLoading ? (
                <div className="py-16 text-center text-gray-400 text-sm">Loading TDS data...</div>
              ) : monthlyError ? (
                <div className="py-16 text-center text-red-400 text-sm">{monthlyError}</div>
              ) : monthlyEmps.length === 0 ? (
                <div className="py-16 text-center text-gray-400 text-sm">
                  {selectedCycleId ? 'No data for this cycle. Process payroll first.' : 'Select a cycle.'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        {['Emp Code','Name','PAN','Regime','Gross','Std Deduction','Taxable Income','Monthly TDS','PAN Status'].map((h) => (
                          <th key={h} className="px-3 py-3 text-left font-medium text-gray-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {monthlyEmps.map((emp: any, i: number) => {
                        const pan = emp.taxInformation?.panNumber || emp.pan || '';
                        const tds = Number(emp.taxDetails?.incomeTax || emp.incomeTax || 0);
                        const gross = Number(emp.grossSalary || 0);
                        const regime = emp.taxDetails?.regime || emp.taxInformation?.taxRegime || 'NEW';
                        const stdDed = regime === 'OLD' ? 50000 / 12 : 75000 / 12;
                        return (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-3 py-2.5 text-gray-600">{emp.employeeCode}</td>
                            <td className="px-3 py-2.5 font-medium text-gray-900">{emp.firstName} {emp.lastName}</td>
                            <td className="px-3 py-2.5 font-mono text-gray-600">{pan || '—'}</td>
                            <td className="px-3 py-2.5">
                              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${regime === 'OLD' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                                {regime}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-gray-700">{fmt(gross)}</td>
                            <td className="px-3 py-2.5 text-gray-600">{fmt(stdDed)}</td>
                            <td className="px-3 py-2.5 text-gray-700">{fmt(Math.max(0, gross - stdDed))}</td>
                            <td className="px-3 py-2.5 font-semibold text-orange-700">{fmt(tds)}</td>
                            <td className="px-3 py-2.5"><PanStatusBadge pan={pan} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Tab 2: Annual Working Sheet ── */}
        {activeTab === 'annual' && (
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <select
                value={selectedFY}
                onChange={(e) => setSelectedFY(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                {FY_OPTIONS.map((fy) => <option key={fy} value={fy}>FY {fy}</option>)}
              </select>
              <button onClick={fetchAnnual} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
                Load
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-5">
              {[
                { label: 'Employees', value: annualEmps.length.toString() },
                { label: 'Total Annual Gross', value: fmt(totalAnnualGross) },
                { label: 'Total TDS Collected', value: fmt(totalAnnualTDS) },
              ].map((c) => (
                <div key={c.label} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <p className="text-xs text-gray-500">{c.label}</p>
                  <p className="text-lg font-bold text-gray-900 mt-1">{c.value}</p>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {annualLoading ? (
                <div className="py-16 text-center text-gray-400 text-sm">Loading annual data...</div>
              ) : annualError ? (
                <div className="py-16 text-center text-red-400 text-sm">{annualError}</div>
              ) : annualEmps.length === 0 ? (
                <div className="py-16 text-center text-gray-400 text-sm">No annual TDS data for FY {selectedFY}.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        {['Emp','PAN','Regime','Annual Gross','Std Ded.','80C/D','Taxable','Tax','Surcharge','Cess','Total TDS','YTD Paid','Balance'].map((h) => (
                          <th key={h} className="px-3 py-3 text-left font-medium text-gray-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {annualEmps.map((emp: any, i: number) => {
                        const balance = Number(emp.ytdTax || 0) - Number(emp.ytdTaxPaid || 0);
                        return (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-3 py-2.5 font-medium text-gray-900">{emp.name}</td>
                            <td className="px-3 py-2.5 font-mono text-gray-500">{emp.pan || '—'}</td>
                            <td className="px-3 py-2.5">
                              <span className={`px-1.5 py-0.5 rounded text-xs ${emp.regime === 'OLD' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>{emp.regime || 'NEW'}</span>
                            </td>
                            <td className="px-3 py-2.5">{fmt(emp.ytdGross)}</td>
                            <td className="px-3 py-2.5 text-gray-500">{fmt(emp.standardDeduction)}</td>
                            <td className="px-3 py-2.5 text-gray-500">{fmt(emp.chapter6Deductions)}</td>
                            <td className="px-3 py-2.5">{fmt(emp.taxableIncome)}</td>
                            <td className="px-3 py-2.5 text-orange-700">{fmt(emp.incomeTax)}</td>
                            <td className="px-3 py-2.5 text-gray-600">{fmt(emp.surcharge)}</td>
                            <td className="px-3 py-2.5 text-gray-600">{fmt(emp.cess)}</td>
                            <td className="px-3 py-2.5 font-semibold text-orange-700">{fmt(emp.ytdTax)}</td>
                            <td className="px-3 py-2.5 text-gray-700">{fmt(emp.ytdTaxPaid)}</td>
                            <td className={`px-3 py-2.5 font-semibold ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {balance > 0 ? `Due: ${fmt(balance)}` : `Refund: ${fmt(Math.abs(balance))}`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Tab 3: Form 16 ── */}
        {activeTab === 'form16' && (
          <div className="flex gap-5">
            {/* Left: Employee List */}
            <div className="w-72 flex-shrink-0">
              <div className="flex items-center gap-2 mb-3">
                <select
                  value={selectedFY}
                  onChange={(e) => { setSelectedFY(e.target.value); setForm16Detail(null); setSelectedEmpId(null); }}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1"
                >
                  {FY_OPTIONS.map((fy) => <option key={fy} value={fy}>FY {fy}</option>)}
                </select>
              </div>
              <input
                type="text"
                placeholder="Search employee..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3"
              />
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden max-h-[560px] overflow-y-auto">
                {form16Loading && !form16Detail ? (
                  <div className="py-10 text-center text-gray-400 text-xs">Loading...</div>
                ) : form16Error ? (
                  <div className="py-10 text-center text-red-400 text-xs">{form16Error}</div>
                ) : filteredForm16.length === 0 ? (
                  <div className="py-10 text-center text-gray-400 text-xs">No data for FY {selectedFY}.</div>
                ) : (
                  filteredForm16.map((emp: any) => (
                    <button
                      key={emp.id || emp.employeeId}
                      onClick={() => { setSelectedEmpId(emp.id || emp.employeeId); fetchForm16Detail(emp.id || emp.employeeId); }}
                      className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition ${selectedEmpId === (emp.id || emp.employeeId) ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''}`}
                    >
                      <p className="text-sm font-medium text-gray-900">{emp.firstName} {emp.lastName}</p>
                      <p className="text-xs text-gray-500">{emp.employeeCode} | {emp.pan || 'No PAN'}</p>
                      <p className="text-xs text-orange-600 mt-0.5">TDS: {fmt(emp.totalTDS || emp.ytdTax || 0)}</p>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Right: Form 16 Detail */}
            <div className="flex-1">
              {!selectedEmpId ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 py-24 text-center text-gray-400 text-sm">
                  Select an employee to view Form 16
                </div>
              ) : form16Loading ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 py-24 text-center text-gray-400 text-sm">Loading Form 16...</div>
              ) : form16Detail ? (
                <div className="space-y-4">
                  {/* Part A */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-5 py-3 bg-gray-800 text-white">
                      <h3 className="text-sm font-semibold">Form 16 — Part A: TDS Deposits (FY {selectedFY})</h3>
                      <p className="text-xs text-gray-300 mt-0.5">
                        Employee: {form16Detail.employee?.firstName} {form16Detail.employee?.lastName} | PAN: {form16Detail.employee?.pan || 'N/A'}
                      </p>
                    </div>
                    <div className="p-5">
                      {(['Q1 (Apr–Jun)', 'Q2 (Jul–Sep)', 'Q3 (Oct–Dec)', 'Q4 (Jan–Mar)'] as const).map((q, qi) => {
                        const qData = form16Detail.partA?.quarters?.[qi];
                        return (
                          <div key={q} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                            <span className="text-sm text-gray-700">{q}</span>
                            <span className="text-sm font-medium text-gray-900">{fmt(qData?.tdsDeposited || 0)}</span>
                          </div>
                        );
                      })}
                      <div className="flex items-center justify-between py-2 mt-2 bg-gray-50 rounded-lg px-3">
                        <span className="text-sm font-semibold text-gray-800">Total TDS Deposited</span>
                        <span className="text-sm font-bold text-orange-700">{fmt(form16Detail.partA?.totalTDS || 0)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Part B */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-5 py-3 bg-blue-700 text-white">
                      <h3 className="text-sm font-semibold">Form 16 — Part B: Income & Tax Computation</h3>
                    </div>
                    <div className="p-5 space-y-1.5">
                      {[
                        { label: 'Gross Salary', value: form16Detail.partB?.grossSalary, bold: false },
                        { label: 'Less: HRA Exemption (Sec 10(13A))', value: -(form16Detail.partB?.hraExemption || 0), bold: false },
                        { label: 'Less: Standard Deduction', value: -(form16Detail.partB?.standardDeduction || 0), bold: false },
                        { label: 'Less: Professional Tax', value: -(form16Detail.partB?.professionalTax || 0), bold: false },
                        { label: 'Gross Total Income', value: form16Detail.partB?.grossTotalIncome, bold: true },
                        { label: 'Less: 80C Deductions', value: -(form16Detail.partB?.deductions80C || 0), bold: false },
                        { label: 'Less: 80D Deductions', value: -(form16Detail.partB?.deductions80D || 0), bold: false },
                        { label: 'Total Taxable Income', value: form16Detail.partB?.taxableIncome, bold: true },
                        { label: 'Tax on Income', value: form16Detail.partB?.incomeTax, bold: false },
                        { label: 'Surcharge', value: form16Detail.partB?.surcharge, bold: false },
                        { label: 'Health & Education Cess (4%)', value: form16Detail.partB?.cess, bold: false },
                        { label: 'Total Tax Liability', value: form16Detail.partB?.totalTax, bold: true },
                        { label: 'TDS Deducted', value: -(form16Detail.partB?.tdsDeducted || 0), bold: false },
                        { label: 'Tax Payable / (Refund)', value: (form16Detail.partB?.totalTax || 0) - (form16Detail.partB?.tdsDeducted || 0), bold: true },
                      ].map((row) => (
                        <div key={row.label} className={`flex items-center justify-between py-1.5 ${row.bold ? 'border-t border-gray-200 mt-1 pt-2' : ''}`}>
                          <span className={`text-sm ${row.bold ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>{row.label}</span>
                          <span className={`text-sm ${row.bold ? 'font-bold text-gray-900' : 'text-gray-700'}`}>{fmt(row.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default TdsIncomeTaxPage;
