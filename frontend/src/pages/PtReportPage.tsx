import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { complianceService } from '../services/compliance.service';
import { payrollCycleService } from '../services/payroll.service';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
const LIMIT = 20;

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

export default function PtReportPage() {
  const navigate = useNavigate();
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [cycles, setCycles] = useState<any[]>([]);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    payrollCycleService.getAll({}).then((r) => setCycles(r.data || [])).catch(() => {});
  }, []);

  const cycleId = useMemo(() =>
    cycles.find((c) => {
      const d = new Date(c.periodStart);
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    })?.id || ''
  , [cycles, year, month]);

  useEffect(() => {
    if (!cycleId) { setData([]); return; }
    setLoading(true);
    setError('');
    complianceService.getPtReport(cycleId)
      .then((result) => {
        if (Array.isArray(result)) { setData(result); return; }
        // Backend returns { states: [{state, employees:[…]}] }
        const flat = (result?.states || []).flatMap((s: any) =>
          (s.employees || []).map((e: any) => ({ ...e, state: s.state }))
        );
        setData(flat);
      })
      .catch(() => setError('Failed to load PT data'))
      .finally(() => setLoading(false));
  }, [cycleId]);

  const pagedData = data.slice((page - 1) * LIMIT, page * LIMIT);
  const totalPages = Math.ceil(data.length / LIMIT);
  const totalPt = useMemo(() => data.reduce((s, r) => s + Number(r.ptAmount || r.professionalTax || 0), 0), [data]);

  const handleExport = async () => {
    if (!cycleId) return;
    try {
      setExporting(true);
      const blob = await complianceService.downloadPtCsv(cycleId);
      downloadBlob(blob, `pt-report-${year}-${String(month).padStart(2,'0')}.csv`);
    } catch { setError('Export failed'); }
    finally { setExporting(false); }
  };

  return (
    <>
      <style>{`@media print { .no-print { display: none !important; } }`}</style>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3 no-print">
          <button onClick={() => navigate('/reports')} className="text-gray-400 hover:text-gray-600 transition">← Back</button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Professional Tax Report</h1>
            <p className="text-sm text-gray-500 mt-0.5">State-wise professional tax deductions for selected month</p>
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm no-print">{error}</div>}

        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-center gap-3 no-print">
          <select value={month} onChange={e => { setMonth(Number(e.target.value)); setPage(1); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
            {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => { setYear(Number(e.target.value)); setPage(1); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
            {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <p className="ml-auto text-xs text-gray-400">{data.length} employees</p>
          <button onClick={handleExport} disabled={exporting || !cycleId}
            className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40 font-medium">
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
          <button onClick={() => window.print()}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
            Print
          </button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>
          ) : !cycleId ? (
            <div className="p-10 text-center text-gray-400 text-sm">No payroll cycle found for {MONTHS[month-1]} {year}.</div>
          ) : data.length === 0 ? (
            <div className="p-10 text-center text-gray-400 text-sm">No PT data for this period.</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {['#','Emp Code','Employee Name','Department','State','Gross Salary','PT Deducted'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {pagedData.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50 transition">
                        <td className="px-4 py-3 text-gray-400 text-xs">{(page-1)*LIMIT + i + 1}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{row.employeeCode || row.empCode || '—'}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{row.employeeName || `${row.firstName||''} ${row.lastName||''}`.trim() || '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{row.department || '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{row.state || row.location || '—'}</td>
                        <td className="px-4 py-3 text-right text-gray-900">{fmt(Number(row.grossSalary || row.gross || 0))}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt(Number(row.ptAmount || row.professionalTax || 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                    <tr>
                      <td colSpan={6} className="px-4 py-3 font-semibold text-gray-700 text-sm">Total PT ({data.length} employees)</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">{fmt(totalPt)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between no-print">
                  <p className="text-sm text-gray-500">Showing {(page-1)*LIMIT+1}–{Math.min(page*LIMIT, data.length)} of {data.length}</p>
                  <div className="flex gap-2">
                    <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">← Prev</button>
                    <button onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page===totalPages}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">Next →</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
