import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import fnfSettlementService, { FnfSettlement } from '../services/fnfSettlement.service';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const statusLabel: Record<string, string> = {
  DRAFT:      'Draft',
  CALCULATED: 'Calculated',
  APPROVED:   'Approved',
  PAID:       'Paid / Completed',
};

export default function FnfStatementPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);

  const [settlement, setSettlement] = useState<FnfSettlement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    fnfSettlementService
      .getById(id)
      .then((data) => {
        const s = (data as any).settlement ?? data;
        setSettlement(s);
      })
      .catch(() => setError('Failed to load settlement'))
      .finally(() => setLoading(false));
  }, [id]);

  const handlePrint = () => window.print();

  if (loading) return <div className="p-6 text-center text-gray-400">Loading...</div>;
  if (error || !settlement) {
    return <div className="p-6"><div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">{error}</div></div>;
  }

  const s = settlement;
  const earnings = s.earningsBreakdown || [];
  const deductions = s.deductionsBreakdown || [];

  const allEarnings = [
    ...earnings,
    ...(Number(s.otherEarnings) > 0 ? [{ component: 'Other Earnings', amount: Number(s.otherEarnings) }] : []),
  ];
  const allDeductions = [
    ...deductions,
    ...(Number(s.otherDeductions) > 0 ? [{ component: 'Other Deductions', amount: Number(s.otherDeductions) }] : []),
  ];

  return (
    <>
      {/* Print-specific styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #fnf-print-area, #fnf-print-area * { visibility: visible; }
          #fnf-print-area { position: fixed; top: 0; left: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="p-6 max-w-3xl mx-auto space-y-6">
        {/* Toolbar — hidden on print */}
        <div className="no-print flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(`/payroll/fnf-settlement/${id}`)} className="text-gray-400 hover:text-gray-600 text-sm">
              ← Back
            </button>
            <h1 className="text-xl font-bold text-gray-900">Settlement Statement</h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate(`/payroll/fnf-settlement/${id}/approval`)}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Approval
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
            >
              🖨️ Print / Download PDF
            </button>
          </div>
        </div>

        {/* Printable Area */}
        <div id="fnf-print-area" ref={printRef} className="bg-white rounded-xl border border-gray-200 p-8 space-y-6">
          {/* Company Header */}
          <div className="text-center border-b border-gray-200 pb-6">
            <h1 className="text-xl font-bold text-gray-900 uppercase tracking-widest">Full &amp; Final Settlement Statement</h1>
            <p className="text-sm text-gray-500 mt-1">Confidential — For HR and Finance Use Only</p>
          </div>

          {/* Employee Details */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm border-b border-gray-100 pb-6">
            <div>
              <span className="text-xs text-gray-500">Employee Name</span>
              <p className="font-semibold text-gray-900">{s.employee?.firstName} {s.employee?.lastName}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500">Employee Code</span>
              <p className="font-semibold text-gray-900">{s.employee?.employeeCode}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500">Department</span>
              <p className="font-semibold text-gray-900">{s.employee?.department?.name || '—'}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500">Separation Type</span>
              <p className="font-semibold text-gray-900">{s.separation?.separationType || '—'}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500">Date of Joining</span>
              <p className="font-semibold text-gray-900">{fmtDate(s.employee?.dateOfJoining)}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500">Last Working Date</span>
              <p className="font-semibold text-gray-900">{fmtDate(s.lastWorkingDate)}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500">Years of Service</span>
              <p className="font-semibold text-gray-900">{Number(s.yearsOfService || 0).toFixed(1)} years</p>
            </div>
            <div>
              <span className="text-xs text-gray-500">Statement Status</span>
              <p className="font-semibold text-gray-900">{statusLabel[s.status] || s.status}</p>
            </div>
          </div>

          {/* Earnings Table */}
          <div>
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-3 bg-gray-50 px-3 py-2 rounded">
              A. Earnings
            </h2>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 text-xs text-gray-500 font-semibold">Component</th>
                  <th className="text-right py-2 px-3 text-xs text-gray-500 font-semibold">Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {allEarnings.map((e, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-2 px-3 text-gray-700">
                      {e.component}
                      {(e as any).days ? <span className="ml-1 text-xs text-gray-400">({(e as any).days} days)</span> : null}
                    </td>
                    <td className="py-2 px-3 text-right text-gray-900">{fmt(Number(e.amount))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300 bg-gray-50">
                  <td className="py-2 px-3 font-bold text-gray-900">Total Earnings (A)</td>
                  <td className="py-2 px-3 text-right font-bold text-gray-900">{fmt(Number(s.totalPayable))}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Deductions Table */}
          <div>
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-3 bg-gray-50 px-3 py-2 rounded">
              B. Deductions &amp; Recoveries
            </h2>
            {allDeductions.length === 0 ? (
              <p className="text-sm text-gray-400 px-3">No deductions applicable</p>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 text-xs text-gray-500 font-semibold">Component</th>
                    <th className="text-right py-2 px-3 text-xs text-gray-500 font-semibold">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {allDeductions.map((d, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-2 px-3 text-gray-700">{d.component}</td>
                      <td className="py-2 px-3 text-right text-gray-900">{fmt(Number(d.amount))}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-300 bg-gray-50">
                    <td className="py-2 px-3 font-bold text-gray-900">Total Deductions (B)</td>
                    <td className="py-2 px-3 text-right font-bold text-gray-900">{fmt(Number(s.totalRecovery))}</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

          {/* Net Settlement */}
          <div className="border-2 border-gray-900 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-bold text-gray-900 text-base">Net Settlement Amount (A − B)</p>
                <p className="text-xs text-gray-500 mt-0.5">Amount payable to employee</p>
              </div>
              <p className="text-2xl font-bold text-gray-900">{fmt(Number(s.netSettlement))}</p>
            </div>
          </div>

          {/* Remarks */}
          {s.remarks && (
            <div className="bg-gray-50 rounded-lg p-4 text-sm">
              <p className="text-xs font-semibold text-gray-500 mb-1">REMARKS</p>
              <p className="text-gray-700">{s.remarks}</p>
            </div>
          )}

          {/* Signature Block */}
          <div className="grid grid-cols-3 gap-8 pt-8 border-t border-gray-200 text-center text-xs text-gray-500">
            <div>
              <div className="h-12 border-b border-gray-300 mb-2" />
              <p>Employee Signature</p>
              <p className="text-gray-400">{s.employee?.firstName} {s.employee?.lastName}</p>
            </div>
            <div>
              <div className="h-12 border-b border-gray-300 mb-2" />
              <p>HR Manager</p>
              {s.approvedAt && <p className="text-gray-400">Approved: {fmtDate(s.approvedAt)}</p>}
            </div>
            <div>
              <div className="h-12 border-b border-gray-300 mb-2" />
              <p>Accounts / Finance</p>
              {s.settlementDate && <p className="text-gray-400">Released: {fmtDate(s.settlementDate)}</p>}
            </div>
          </div>

          {/* Footer */}
          <div className="text-center text-xs text-gray-400 pt-2 border-t border-gray-100">
            <p>Generated on {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
            <p>This is a system-generated document. No signature required for electronic copies.</p>
          </div>
        </div>
      </div>
    </>
  );
}
