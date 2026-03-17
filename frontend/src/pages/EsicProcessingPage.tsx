import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/layout/AppHeader';
import { useAuthStore } from '../store/authStore';
import { payrollCycleService, PayrollCycle } from '../services/payroll.service';
import { complianceService } from '../services/compliance.service';

const fmt = (v: number | string | undefined | null) =>
  '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const EsicProcessingPage = () => {
  const navigate = useNavigate();
  const { logout } = useAuthStore();

  const [cycles, setCycles] = useState<PayrollCycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState('');
  const [esicData, setEsicData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const fetchEsic = useCallback(async () => {
    if (!selectedCycleId) return;
    setLoading(true);
    setError(null);
    setEsicData(null);
    try {
      const data = await complianceService.getEsicStatement(selectedCycleId);
      setEsicData(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load ESIC data. Process payroll first.');
    } finally {
      setLoading(false);
    }
  }, [selectedCycleId]);

  useEffect(() => { fetchEsic(); }, [fetchEsic]);

  const handleDownload = async () => {
    if (!selectedCycleId) return;
    setDownloading(true);
    try {
      const blob = await complianceService.downloadEsicCsv(selectedCycleId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ESIC_Statement_${selectedCycle?.name || 'cycle'}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Download failed. Ensure payroll is processed for this cycle.');
    } finally {
      setDownloading(false);
    }
  };

  const employees: any[] = esicData?.employees || [];
  const totalEmpESIC = employees.reduce((s: number, e: any) => s + Number(e.employeeESIC || 0), 0);
  const totalEmprESIC = employees.reduce((s: number, e: any) => s + Number(e.employerESIC || 0), 0);
  const totalChallan = totalEmpESIC + totalEmprESIC;

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <AppHeader
        title="ESIC Processing"
        subtitle="Employees' State Insurance — Monthly Contributions"
        onLogout={handleLogout}
      />

      <main className="flex-1 p-6">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <button onClick={() => navigate('/statutory')} className="text-sm text-gray-500 hover:text-gray-800">
            ← Statutory Compliance
          </button>
          <select
            value={selectedCycleId}
            onChange={(e) => setSelectedCycleId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-w-[200px]"
          >
            <option value="">Select Payroll Cycle</option>
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>{c.name} — {c.status}</option>
            ))}
          </select>
          <div className="flex-1" />
          <button
            onClick={handleDownload}
            disabled={downloading || !esicData}
            className="px-4 py-2 bg-gray-800 text-white text-sm rounded-lg hover:bg-gray-900 disabled:opacity-50 flex items-center gap-2"
          >
            {downloading ? '⏳' : '⬇'} Download ESIC Statement
          </button>
        </div>

        {/* Lock Banner */}
        {isLocked && (
          <div className="mb-4 bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 text-sm text-orange-600 font-medium">
            🔒 Finalized / Locked Cycle — View & download only.
          </div>
        )}

        {/* Config Info */}
        <div className="bg-green-50 border border-green-100 rounded-xl p-4 mb-5 flex flex-wrap gap-6">
          {[
            { label: 'Gross Threshold', value: '₹21,000/month' },
            { label: 'Employee ESIC', value: '0.75%' },
            { label: 'Employer ESIC', value: '3.25%' },
            { label: 'Total Contribution', value: '4.00%' },
          ].map((r) => (
            <div key={r.label}>
              <p className="text-xs text-green-500">{r.label}</p>
              <p className="text-sm font-semibold text-green-800">{r.value}</p>
            </div>
          ))}
        </div>

        {/* Filter Note */}
        {esicData && (
          <div className="mb-4 bg-yellow-50 border border-yellow-100 rounded-lg px-4 py-2 text-xs text-yellow-700">
            Showing <strong>{employees.length} employees</strong> with Gross Salary ≤ ₹21,000 (ESIC eligible).
            Employees above threshold are excluded from ESIC.
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Eligible Employees', value: employees.length.toString() },
            { label: 'Employee Contribution (0.75%)', value: fmt(totalEmpESIC) },
            { label: 'Employer Contribution (3.25%)', value: fmt(totalEmprESIC) },
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
            <h3 className="text-sm font-semibold text-gray-700">ESIC Contribution Details</h3>
          </div>
          {loading ? (
            <div className="py-16 text-center text-gray-400 text-sm">Loading ESIC data...</div>
          ) : error ? (
            <div className="py-16 text-center text-red-400 text-sm">{error}</div>
          ) : employees.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">
              {selectedCycleId ? 'No ESIC eligible employees for this cycle.' : 'Select a payroll cycle.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Emp Code','Name','ESIC Number','Gross Salary','Employee ESIC (0.75%)','Employer ESIC (3.25%)','Total','Status'].map((h) => (
                      <th key={h} className="px-3 py-3 text-left font-medium text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {employees.map((emp: any, i: number) => {
                    const hasEsicNo = emp.esicNumber && emp.esicNumber.trim();
                    return (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2.5 text-gray-600">{emp.employeeCode}</td>
                        <td className="px-3 py-2.5 font-medium text-gray-900">{emp.name}</td>
                        <td className="px-3 py-2.5 font-mono text-gray-600">
                          {hasEsicNo ? emp.esicNumber : <span className="text-yellow-600 font-medium">No ESIC No.</span>}
                        </td>
                        <td className="px-3 py-2.5 text-gray-700">{fmt(emp.grossSalary)}</td>
                        <td className="px-3 py-2.5 text-green-700 font-medium">{fmt(emp.employeeESIC)}</td>
                        <td className="px-3 py-2.5 text-gray-700">{fmt(emp.employerESIC)}</td>
                        <td className="px-3 py-2.5 font-semibold text-gray-900">
                          {fmt(Number(emp.employeeESIC || 0) + Number(emp.employerESIC || 0))}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${hasEsicNo ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {hasEsicNo ? 'Registered' : 'No ESIC No.'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-50 border-t border-gray-200">
                  <tr>
                    <td colSpan={4} className="px-3 py-3 font-semibold text-gray-700 text-xs">TOTAL</td>
                    <td className="px-3 py-3 font-bold text-green-700">{fmt(totalEmpESIC)}</td>
                    <td className="px-3 py-3 font-bold text-gray-700">{fmt(totalEmprESIC)}</td>
                    <td className="px-3 py-3 font-bold text-gray-900">{fmt(totalChallan)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default EsicProcessingPage;
