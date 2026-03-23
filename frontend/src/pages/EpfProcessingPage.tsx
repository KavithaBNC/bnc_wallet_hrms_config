import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/layout/AppHeader';
import { useAuthStore } from '../store/authStore';
import { payrollCycleService, PayrollCycle } from '../services/payroll.service';
import { complianceService } from '../services/compliance.service';

const fmt = (v: number | string | undefined | null) =>
  '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const CURRENT_YEAR = new Date().getFullYear();

const EpfProcessingPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const orgId = user?.employee?.organizationId || user?.employee?.organization?.id || user?.organizationId || '';

  const [cycles, setCycles] = useState<PayrollCycle[]>([]);
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [epfData, setEpfData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCycle = cycles.find((c) => {
    const d = new Date(c.periodStart);
    return (d.getMonth() + 1) === selectedMonth && d.getFullYear() === selectedYear;
  });
  const isLocked = selectedCycle ? (selectedCycle.isLocked || ['FINALIZED', 'PAID'].includes(selectedCycle.status)) : false;

  useEffect(() => {
    if (!orgId) return;
    payrollCycleService.getAll({ organizationId: orgId }).then((res) => setCycles(res.data || [])).catch(() => {});
  }, [orgId]);

  const fetchEpf = useCallback(async () => {
    setLoading(true);
    setError(null);
    setEpfData(null);
    try {
      const data = await complianceService.getPfEcr(selectedYear, selectedMonth);
      setEpfData(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load EPF data. Process payroll first.');
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedMonth]);

  useEffect(() => { fetchEpf(); }, [fetchEpf]);

  const handleDownloadEcr = async () => {
    setDownloading(true);
    try {
      const blob = await complianceService.downloadPfEcrCsv(selectedYear, selectedMonth);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `PF_ECR_${selectedYear}_${String(selectedMonth).padStart(2,'0')}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('ECR download failed. Ensure payroll is processed for this period.');
    } finally {
      setDownloading(false);
    }
  };

  const employees: any[] = epfData?.employees || [];
  const _summary = epfData?.summary || {}; void _summary;

  const totalEmpPF = employees.reduce((s: number, e: any) => s + Number(e.employeePF || 0), 0);
  const totalEmpEPS = employees.reduce((s: number, e: any) => s + Number(e.employerEPS || 0), 0);
  const totalEmpEPF = employees.reduce((s: number, e: any) => s + Number(e.employerEPF || 0), 0);
  const totalEdli = employees.reduce((s: number, e: any) => s + Number(e.edli || 0), 0);
  const totalAdmin = employees.reduce((s: number, e: any) => s + Number(e.adminCharges || 0), 0);
  const totalChallan = totalEmpPF + totalEmpEPS + totalEmpEPF + totalEdli + totalAdmin;

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <AppHeader
        title="EPF Processing"
        subtitle="Employees' Provident Fund — Monthly Contributions"
        onLogout={handleLogout}
      />

      <main className="flex-1 p-6">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <button onClick={() => navigate('/statutory')} className="text-sm text-gray-500 hover:text-gray-800">
            ← Statutory Compliance
          </button>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            {[CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button onClick={fetchEpf} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
            Load
          </button>
          <div className="flex-1" />
          <button
            onClick={handleDownloadEcr}
            disabled={downloading || !epfData}
            className="px-4 py-2 bg-gray-800 text-white text-sm rounded-lg hover:bg-gray-900 disabled:opacity-50 flex items-center gap-2"
          >
            {downloading ? '⏳' : '⬇'} Download ECR File
          </button>
        </div>

        {/* Lock Banner */}
        {isLocked && (
          <div className="mb-4 bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 flex items-center gap-2">
            <span className="text-orange-600 font-medium text-sm">🔒 Finalized / Locked Cycle — View & download only. No changes allowed.</span>
          </div>
        )}

        {/* Config Info Bar */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-5 flex flex-wrap gap-6">
          {[
            { label: 'Wage Ceiling', value: '₹15,000' },
            { label: 'Employee PF', value: '12%' },
            { label: 'Employer EPS', value: '8.33%' },
            { label: 'Employer EPF', value: '3.67%' },
            { label: 'EDLI', value: '0.5%' },
            { label: 'Admin Charges', value: '0.5%' },
          ].map((r) => (
            <div key={r.label}>
              <p className="text-xs text-blue-500">{r.label}</p>
              <p className="text-sm font-semibold text-blue-800">{r.value}</p>
            </div>
          ))}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Total Employees', value: employees.length.toString() },
            { label: 'Employee PF Total', value: fmt(totalEmpPF) },
            { label: 'Employer PF Total', value: fmt(totalEmpEPS + totalEmpEPF) },
            { label: 'Total Challan', value: fmt(totalChallan) },
          ].map((c) => (
            <div key={c.label} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <p className="text-xs text-gray-500">{c.label}</p>
              <p className="text-lg font-bold text-gray-900 mt-1">{c.value}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700">
              Employee-wise EPF Contribution — {MONTHS[selectedMonth - 1]} {selectedYear}
            </h3>
          </div>

          {loading ? (
            <div className="py-16 text-center text-gray-400 text-sm">Loading EPF data...</div>
          ) : error ? (
            <div className="py-16 text-center text-red-400 text-sm">{error}</div>
          ) : employees.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">No EPF data for this period. Process payroll first.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Emp Code','Name','UAN','Basic Wage','PF Wage','Emp PF (12%)','EPS (8.33%)','Empr EPF (3.67%)','EDLI (0.5%)','Admin (0.5%)','Total'].map((h) => (
                      <th key={h} className="px-3 py-3 text-left font-medium text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {employees.map((emp: any, i: number) => {
                    const total = Number(emp.employeePF || 0) + Number(emp.employerEPS || 0) + Number(emp.employerEPF || 0) + Number(emp.edli || 0) + Number(emp.adminCharges || 0);
                    return (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2.5 text-gray-600">{emp.employeeCode}</td>
                        <td className="px-3 py-2.5 font-medium text-gray-900">{emp.employeeName}</td>
                        <td className="px-3 py-2.5 text-gray-500 font-mono">{emp.uan || <span className="text-orange-500">No UAN</span>}</td>
                        <td className="px-3 py-2.5 text-gray-700">{fmt(emp.basicWage)}</td>
                        <td className="px-3 py-2.5 text-gray-700">{fmt(emp.pfWage)}</td>
                        <td className="px-3 py-2.5 text-blue-700 font-medium">{fmt(emp.employeePF)}</td>
                        <td className="px-3 py-2.5 text-gray-700">{fmt(emp.employerEPS)}</td>
                        <td className="px-3 py-2.5 text-gray-700">{fmt(emp.employerEPF)}</td>
                        <td className="px-3 py-2.5 text-gray-600">{fmt(emp.edli)}</td>
                        <td className="px-3 py-2.5 text-gray-600">{fmt(emp.adminCharges)}</td>
                        <td className="px-3 py-2.5 font-semibold text-gray-900">{fmt(total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-50 border-t border-gray-200">
                  <tr>
                    <td colSpan={5} className="px-3 py-3 font-semibold text-gray-700 text-xs">TOTAL</td>
                    <td className="px-3 py-3 font-bold text-blue-700">{fmt(totalEmpPF)}</td>
                    <td className="px-3 py-3 font-bold text-gray-700">{fmt(totalEmpEPS)}</td>
                    <td className="px-3 py-3 font-bold text-gray-700">{fmt(totalEmpEPF)}</td>
                    <td className="px-3 py-3 font-bold text-gray-700">{fmt(totalEdli)}</td>
                    <td className="px-3 py-3 font-bold text-gray-700">{fmt(totalAdmin)}</td>
                    <td className="px-3 py-3 font-bold text-gray-900">{fmt(totalChallan)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* ECR Format Note */}
        {epfData && (
          <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-500">
            ECR file format: Pipe-separated (|) per EPFO standard. Columns: UAN#Emp Name#Gross Wage#EPF Wage#EPS Wage#EPF Contrib#EPS Contrib#EPF Remitted#EPS Remitted#NCP Days#Refund of Advances
          </div>
        )}
      </main>
    </div>
  );
};

export default EpfProcessingPage;
