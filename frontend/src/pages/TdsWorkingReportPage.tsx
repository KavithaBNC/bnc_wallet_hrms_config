import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { complianceService } from '../services/compliance.service';

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

export default function TdsWorkingReportPage() {
  const navigate = useNavigate();
  // For TDS, the FY starts in April. Year 2026 → FY 2025-26
  const [startYear, setStartYear] = useState(() => {
    const now = new Date();
    return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  });
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  const financialYear = `${startYear}-${String(startYear + 1).slice(-2)}`;

  useEffect(() => {
    setLoading(true);
    setError('');
    complianceService.getTdsWorkingSheet(financialYear)
      .then((result) => setData(Array.isArray(result) ? result : result?.employees || []))
      .catch(() => setError('Failed to load TDS working sheet'))
      .finally(() => setLoading(false));
    setPage(1);
  }, [financialYear]);

  const pagedData = data.slice((page - 1) * LIMIT, page * LIMIT);
  const totalPages = Math.ceil(data.length / LIMIT);

  const totals = useMemo(() => ({
    annualGross: data.reduce((s, r) => s + Number(r.ytdGrossSalary || r.annualGross || r.grossIncome || 0), 0),
    taxable: data.reduce((s, r) => s + Number(r.taxableIncome || r.netTaxable || r.ytdGrossSalary || 0), 0),
    tax: data.reduce((s, r) => s + Number(r.ytdTdsPaid || r.incomeTax || r.tax || 0), 0),
    tdsPerMonth: data.reduce((s, r) => s + Number(r.tdsPerMonth || r.monthlyTds || (r.ytdTdsPaid ? Math.round(r.ytdTdsPaid / 12) : 0)), 0),
  }), [data]);

  const handleExport = async () => {
    try {
      setExporting(true);
      const blob = await complianceService.downloadTdsCsv(financialYear);
      downloadBlob(blob, `tds-working-${financialYear}.csv`);
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
            <h1 className="text-2xl font-bold text-gray-900">TDS Working Report</h1>
            <p className="text-sm text-gray-500 mt-0.5">Employee income tax computation — FY {financialYear}</p>
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm no-print">{error}</div>}

        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-center gap-3 no-print">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 font-medium">Financial Year</label>
            <select value={startYear} onChange={e => { setStartYear(Number(e.target.value)); setPage(1); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
              {YEAR_OPTIONS.map(y => <option key={y} value={y}>FY {y}-{String(y+1).slice(-2)}</option>)}
            </select>
          </div>
          <p className="ml-auto text-xs text-gray-400">{data.length} employees</p>
          <button onClick={handleExport} disabled={exporting}
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
          ) : data.length === 0 ? (
            <div className="p-10 text-center text-gray-400 text-sm">No TDS data for FY {financialYear}.</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {['#','Emp Code','Employee Name','Annual Gross','Std Deduction','Taxable Income','Income Tax','Sec 87A Rebate','TDS / Month'].map(h => (
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
                        <td className="px-4 py-3 text-right text-gray-900">{fmt(Number(row.ytdGrossSalary || row.annualGross || row.grossIncome || 0))}</td>
                        <td className="px-4 py-3 text-right text-gray-500">{fmt(Number(row.standardDeduction || 75000))}</td>
                        <td className="px-4 py-3 text-right text-gray-900">{fmt(Number(row.taxableIncome || row.netTaxable || 0))}</td>
                        <td className="px-4 py-3 text-right text-orange-700">{fmt(Number(row.ytdTdsPaid || row.incomeTax || row.tax || 0))}</td>
                        <td className="px-4 py-3 text-right text-green-700">{fmt(Number(row.rebate87A || row.sec87aRebate || 0))}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt(Number(row.tdsPerMonth || row.monthlyTds || (row.ytdTdsPaid ? Math.round(row.ytdTdsPaid / 12) : 0)))}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                    <tr>
                      <td colSpan={3} className="px-4 py-3 font-semibold text-gray-700 text-sm">Total ({data.length} employees)</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">{fmt(totals.annualGross)}</td>
                      <td className="px-4 py-3"></td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">{fmt(totals.taxable)}</td>
                      <td className="px-4 py-3 text-right font-bold text-orange-700">{fmt(totals.tax)}</td>
                      <td className="px-4 py-3"></td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">{fmt(totals.tdsPerMonth)}</td>
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
