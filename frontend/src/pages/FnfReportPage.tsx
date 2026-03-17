import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import fnfSettlementService from '../services/fnfSettlement.service';

const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
const LIMIT = 20;

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

const STATUS_OPTIONS = [
  { value: 'PAID', label: 'Completed (Paid)' },
  { value: 'APPROVED', label: 'HR Approved' },
  { value: 'CALCULATED', label: 'Calculated' },
  { value: '', label: 'All Statuses' },
];

const statusConfig: Record<string, { label: string; color: string }> = {
  DRAFT:      { label: 'Draft',       color: 'bg-gray-100 text-gray-700' },
  CALCULATED: { label: 'Calculated',  color: 'bg-blue-100 text-blue-700' },
  APPROVED:   { label: 'HR Approved', color: 'bg-orange-100 text-orange-700' },
  PAID:       { label: 'Completed',   color: 'bg-green-100 text-green-700' },
};

export default function FnfReportPage() {
  const navigate = useNavigate();
  const [year, setYear] = useState(new Date().getFullYear());
  const [statusFilter, setStatusFilter] = useState('PAID');
  const [search, setSearch] = useState('');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    setError('');
    fnfSettlementService.getAll({
      organizationId: '',
      page: 1,
      limit: 200,
      ...(statusFilter ? { status: statusFilter } : {}),
    })
      .then((result) => setData(result.items || []))
      .catch(() => setError('Failed to load F&F settlements'))
      .finally(() => setLoading(false));
    setPage(1);
  }, [statusFilter]);

  // Filter by year on the frontend (lastWorkingDate year)
  const filtered = useMemo(() => {
    let rows = data.filter(r => {
      if (!r.lastWorkingDate) return true;
      return new Date(r.lastWorkingDate).getFullYear() === year;
    });
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        `${r.employee?.firstName||''} ${r.employee?.lastName||''}`.toLowerCase().includes(q) ||
        (r.employee?.employeeCode || '').toLowerCase().includes(q)
      );
    }
    return rows;
  }, [data, year, search]);

  const pagedData = filtered.slice((page - 1) * LIMIT, page * LIMIT);
  const totalPages = Math.ceil(filtered.length / LIMIT);

  const totals = useMemo(() => ({
    gratuity: filtered.reduce((s, r) => s + Number(r.gratuityAmount || 0), 0),
    leaveEnc: filtered.reduce((s, r) => s + Number(r.leaveEncashmentAmount || 0), 0),
    net: filtered.reduce((s, r) => s + Number(r.netSettlement || 0), 0),
  }), [filtered]);

  const handleExport = () => {
    const headers = ['Emp Code','Employee Name','Department','Last Working Date','Years of Service','Gratuity','Leave Encashment','Net Settlement','Status'];
    const rows = filtered.map(r => [
      r.employee?.employeeCode || '',
      `${r.employee?.firstName||''} ${r.employee?.lastName||''}`.trim(),
      r.employee?.department?.name || '',
      fmtDate(r.lastWorkingDate),
      Number(r.yearsOfService || 0).toFixed(1),
      r.gratuityAmount || 0,
      r.leaveEncashmentAmount || 0,
      r.netSettlement || 0,
      r.status || '',
    ]);
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, `fnf-settlements-${year}.csv`);
  };

  return (
    <>
      <style>{`@media print { .no-print { display: none !important; } }`}</style>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3 no-print">
          <button onClick={() => navigate('/reports')} className="text-gray-400 hover:text-gray-600 transition">← Back</button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">F&amp;F Settlement Report</h1>
            <p className="text-sm text-gray-500 mt-0.5">Full &amp; Final settlement records with component-wise totals</p>
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm no-print">{error}</div>}

        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-center gap-3 no-print">
          <select value={year} onChange={e => { setYear(Number(e.target.value)); setPage(1); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
            {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
            {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <div className="flex-1 min-w-44">
            <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by name or code..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <p className="ml-auto text-xs text-gray-400">{filtered.length} records</p>
          <button onClick={handleExport}
            className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium">
            Export CSV
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
            <div className="p-10 text-center text-gray-400 text-sm">No settlements found for {year}.</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {['#','Emp Code','Employee Name','Department','Last Working Date','Yrs of Service','Gratuity','Leave Enc.','Net Settlement','Status'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {pagedData.map((row, i) => {
                      const cfg = statusConfig[row.status] || statusConfig.DRAFT;
                      return (
                        <tr key={row.id || i}
                          className="hover:bg-gray-50 transition cursor-pointer"
                          onClick={() => navigate(`/payroll/fnf-settlement/${row.id}`)}>
                          <td className="px-4 py-3 text-gray-400 text-xs">{(page-1)*LIMIT + i + 1}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{row.employee?.employeeCode || '—'}</td>
                          <td className="px-4 py-3 font-medium text-gray-900">{row.employee?.firstName} {row.employee?.lastName}</td>
                          <td className="px-4 py-3 text-gray-600">{row.employee?.department?.name || '—'}</td>
                          <td className="px-4 py-3 text-gray-600">{fmtDate(row.lastWorkingDate)}</td>
                          <td className="px-4 py-3 text-gray-600">{Number(row.yearsOfService || 0).toFixed(1)} yrs</td>
                          <td className="px-4 py-3 text-right text-gray-900">{fmt(Number(row.gratuityAmount || 0))}</td>
                          <td className="px-4 py-3 text-right text-gray-900">{fmt(Number(row.leaveEncashmentAmount || 0))}</td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt(Number(row.netSettlement || 0))}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                              {cfg.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                    <tr>
                      <td colSpan={6} className="px-4 py-3 font-semibold text-gray-700 text-sm">Total ({filtered.length} settlements)</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">{fmt(totals.gratuity)}</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">{fmt(totals.leaveEnc)}</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">{fmt(totals.net)}</td>
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
