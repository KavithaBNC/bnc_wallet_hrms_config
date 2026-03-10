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

export default function Form16ReportPage() {
  const navigate = useNavigate();
  const [startYear, setStartYear] = useState(() => {
    const now = new Date();
    return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  });
  const [search, setSearch] = useState('');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  const financialYear = `${startYear}-${String(startYear + 1).slice(-2)}`;

  useEffect(() => {
    setLoading(true);
    setError('');
    complianceService.getForm16(financialYear)
      .then((rows) => setData(Array.isArray(rows) ? rows : rows?.employees || []))
      .catch(() => setError('Failed to load Form 16 data'))
      .finally(() => setLoading(false));
    setPage(1);
  }, [financialYear]);

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(r =>
      (r.employee?.name || r.employeeName || `${r.firstName||''} ${r.lastName||''}`).toLowerCase().includes(q) ||
      (r.employee?.employeeCode || r.employeeCode || r.empCode || '').toLowerCase().includes(q)
    );
  }, [data, search]);

  const pagedData = filtered.slice((page - 1) * LIMIT, page * LIMIT);
  const totalPages = Math.ceil(filtered.length / LIMIT);

  const totals = useMemo(() => ({
    gross: filtered.reduce((s, r) => s + Number(r.partB?.grossSalary || r.grossIncome || r.annualGross || 0), 0),
    taxable: filtered.reduce((s, r) => s + Number(r.partB?.taxableIncome || r.taxableIncome || r.netTaxable || 0), 0),
    tds: filtered.reduce((s, r) => s + Number(r.partB?.tdsDeducted || r.tdsDeducted || r.annualTds || 0), 0),
  }), [filtered]);

  const handleExport = async () => {
    try {
      setExporting(true);
      const blob = await complianceService.downloadForm16Csv(financialYear);
      downloadBlob(blob, `form16-${financialYear}.csv`);
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
            <h1 className="text-2xl font-bold text-gray-900">Form 16 Data Report</h1>
            <p className="text-sm text-gray-500 mt-0.5">Annual income tax computation data for Form 16 — FY {financialYear}</p>
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
          <div className="flex-1 min-w-48">
            <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by name or code..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <p className="ml-auto text-xs text-gray-400">{filtered.length} records</p>
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
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-gray-400 text-sm">No Form 16 data for FY {financialYear}.</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {['#','Emp Code','Employee Name','Department','Annual Gross','Std Deduction','Taxable Income','Tax Payable','TDS Deducted','Status'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {pagedData.map((row, i) => {
                      const tds = Number(row.partB?.tdsDeducted || row.tdsDeducted || row.annualTds || 0);
                      const taxPayable = Number(row.partB?.totalTaxLiability || row.partB?.taxOnIncome || row.taxPayable || row.incomeTax || 0);
                      const issuedLabel = row.form16Issued ? 'Issued' : 'Pending';
                      const issuedColor = row.form16Issued ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700';
                      return (
                        <tr key={i} className="hover:bg-gray-50 transition">
                          <td className="px-4 py-3 text-gray-400 text-xs">{(page-1)*LIMIT + i + 1}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{row.employee?.employeeCode || row.employeeCode || row.empCode || '—'}</td>
                          <td className="px-4 py-3 font-medium text-gray-900">{row.employee?.name || row.employeeName || `${row.firstName||''} ${row.lastName||''}`.trim() || '—'}</td>
                          <td className="px-4 py-3 text-gray-600">{row.employee?.department || row.department || '—'}</td>
                          <td className="px-4 py-3 text-right text-gray-900">{fmt(Number(row.partB?.grossSalary || row.grossIncome || row.annualGross || 0))}</td>
                          <td className="px-4 py-3 text-right text-gray-500">{fmt(Number(row.partB?.standardDeduction || row.standardDeduction || 75000))}</td>
                          <td className="px-4 py-3 text-right text-gray-900">{fmt(Number(row.partB?.taxableIncome || row.taxableIncome || row.netTaxable || 0))}</td>
                          <td className="px-4 py-3 text-right text-orange-700">{fmt(taxPayable)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt(tds)}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${issuedColor}`}>
                              {issuedLabel}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                    <tr>
                      <td colSpan={4} className="px-4 py-3 font-semibold text-gray-700 text-sm">Total ({filtered.length} employees)</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">{fmt(totals.gross)}</td>
                      <td className="px-4 py-3"></td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">{fmt(totals.taxable)}</td>
                      <td className="px-4 py-3"></td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">{fmt(totals.tds)}</td>
                      <td className="px-4 py-3"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between no-print">
                  <p className="text-sm text-gray-500">Showing {(page-1)*LIMIT+1}–{Math.min(page*LIMIT, filtered.length)} of {filtered.length}</p>
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
