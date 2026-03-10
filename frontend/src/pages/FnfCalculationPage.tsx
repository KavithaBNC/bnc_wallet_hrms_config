import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import fnfSettlementService, { FnfSettlement } from '../services/fnfSettlement.service';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const fmtDate = (d: string) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const statusConfig: Record<string, { label: string; color: string }> = {
  DRAFT:      { label: 'Draft',       color: 'bg-gray-100 text-gray-700' },
  CALCULATED: { label: 'Calculated',  color: 'bg-blue-100 text-blue-700' },
  APPROVED:   { label: 'HR Approved', color: 'bg-orange-100 text-orange-700' },
  PAID:       { label: 'Completed',   color: 'bg-green-100 text-green-700' },
};

export default function FnfCalculationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [settlement, setSettlement] = useState<FnfSettlement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Adjustment modal
  const [showAdj, setShowAdj] = useState(false);
  const [otherEarnings, setOtherEarnings] = useState('');
  const [otherDeductions, setOtherDeductions] = useState('');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [adjError, setAdjError] = useState('');

  const load = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await fnfSettlementService.getById(id);
      // getById wraps in { settlement }
      const s = (data as any).settlement ?? data;
      setSettlement(s);
      setOtherEarnings(String(s.otherEarnings || 0));
      setOtherDeductions(String(s.otherDeductions || 0));
      setRemarks(s.remarks || '');
    } catch {
      setError('Failed to load settlement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const handleSaveAdjustment = async () => {
    if (!id) return;
    try {
      setSaving(true);
      setAdjError('');
      await fnfSettlementService.update(id, {
        otherEarnings: parseFloat(otherEarnings) || 0,
        otherDeductions: parseFloat(otherDeductions) || 0,
        remarks,
      });
      setShowAdj(false);
      await load();
    } catch (err: any) {
      setAdjError(err?.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-64">
        <p className="text-gray-400">Loading settlement...</p>
      </div>
    );
  }

  if (error || !settlement) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">{error || 'Settlement not found'}</div>
      </div>
    );
  }

  const s = settlement;
  const cfg = statusConfig[s.status] || statusConfig.DRAFT;
  const canEdit = s.status !== 'PAID';
  const canApprove = s.status === 'CALCULATED' || s.status === 'DRAFT';

  const earnings = s.earningsBreakdown || [];
  const deductions = s.deductionsBreakdown || [];

  // Append other earnings/deductions to breakdown display
  const allEarnings = [
    ...earnings,
    ...(Number(s.otherEarnings) > 0 ? [{ component: 'Other Earnings (Manual)', amount: Number(s.otherEarnings) }] : []),
  ];
  const allDeductions = [
    ...deductions,
    ...(Number(s.otherDeductions) > 0 ? [{ component: 'Other Deductions (Manual)', amount: Number(s.otherDeductions) }] : []),
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/payroll/fnf-settlement')} className="text-gray-400 hover:text-gray-600">
            ← Back
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">
                F&amp;F Calculation — {s.employee?.firstName} {s.employee?.lastName}
              </h1>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                {cfg.label}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">Emp Code: {s.employee?.employeeCode}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <button
              onClick={() => setShowAdj(true)}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Edit Adjustments
            </button>
          )}
          <button
            onClick={() => navigate(`/payroll/fnf-settlement/${id}/statement`)}
            className="px-4 py-2 text-sm border border-indigo-300 text-indigo-700 rounded-lg hover:bg-indigo-50"
          >
            📄 Statement
          </button>
          {canApprove && (
            <button
              onClick={() => navigate(`/payroll/fnf-settlement/${id}/approval`)}
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              → Approve
            </button>
          )}
          {s.status === 'APPROVED' && (
            <button
              onClick={() => navigate(`/payroll/fnf-settlement/${id}/approval`)}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              → Mark as Paid
            </button>
          )}
        </div>
      </div>

      {/* Employee Information */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Employee Information</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-500">Department</p>
            <p className="font-medium text-gray-900">{s.employee?.department?.name || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Date of Joining</p>
            <p className="font-medium text-gray-900">{fmtDate(s.employee?.dateOfJoining || '')}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Last Working Date</p>
            <p className="font-medium text-gray-900">{fmtDate(s.lastWorkingDate)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Years of Service</p>
            <p className="font-medium text-gray-900">{Number(s.yearsOfService || 0).toFixed(1)} yrs</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Separation Type</p>
            <p className="font-medium text-gray-900">{s.separation?.separationType || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Notice Period</p>
            <p className="font-medium text-gray-900">
              {s.noticePeriodDays} days ({s.noticePeriodServed} served)
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Gratuity Eligible</p>
            <p className="font-medium text-gray-900">{s.gratuityEligible ? 'Yes' : 'No'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Calculated At</p>
            <p className="font-medium text-gray-900">{s.calculatedAt ? fmtDate(s.calculatedAt) : '—'}</p>
          </div>
        </div>
      </div>

      {/* Earnings */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 bg-green-50 border-b border-green-100">
          <h2 className="text-sm font-semibold text-green-800 uppercase tracking-wide">Earnings</h2>
        </div>
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Component</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Details</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {allEarnings.map((e, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-6 py-3 text-gray-800 font-medium">{e.component}</td>
                <td className="px-6 py-3 text-gray-500 text-xs">
                  {(e as any).days ? `${(e as any).days} days` : ''}
                  {e.component.includes('Final Month') && s.noticePeriodServed ? `` : ''}
                </td>
                <td className="px-6 py-3 text-right text-gray-900 font-medium">{fmt(Number(e.amount))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-green-50 border-t border-green-100">
            <tr>
              <td colSpan={2} className="px-6 py-3 text-sm font-bold text-green-800">Total Payable</td>
              <td className="px-6 py-3 text-right text-sm font-bold text-green-800">{fmt(Number(s.totalPayable))}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Deductions */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 bg-red-50 border-b border-red-100">
          <h2 className="text-sm font-semibold text-red-800 uppercase tracking-wide">Deductions &amp; Recoveries</h2>
        </div>
        {allDeductions.length === 0 ? (
          <p className="px-6 py-4 text-sm text-gray-400">No deductions applicable</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Component</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {allDeductions.map((d, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-gray-800 font-medium">{d.component}</td>
                  <td className="px-6 py-3 text-right text-red-700 font-medium">{fmt(Number(d.amount))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-red-50 border-t border-red-100">
              <tr>
                <td className="px-6 py-3 text-sm font-bold text-red-800">Total Recoveries</td>
                <td className="px-6 py-3 text-right text-sm font-bold text-red-800">{fmt(Number(s.totalRecovery))}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Net Settlement */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-indigo-600 font-medium">Net Settlement Amount</p>
          <p className="text-xs text-indigo-400 mt-0.5">Total Payable − Total Recoveries</p>
          {s.remarks && <p className="text-xs text-gray-500 mt-2">Remarks: {s.remarks}</p>}
        </div>
        <p className="text-3xl font-bold text-indigo-700">{fmt(Number(s.netSettlement))}</p>
      </div>

      {/* Manual Adjustments Modal */}
      {showAdj && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-base font-semibold text-gray-900">Edit Adjustments</h3>
            {adjError && <p className="text-sm text-red-600">{adjError}</p>}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Other Earnings (₹)</label>
              <input
                type="number"
                min="0"
                value={otherEarnings}
                onChange={(e) => setOtherEarnings(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Other Deductions (₹)</label>
              <input
                type="number"
                min="0"
                value={otherDeductions}
                onChange={(e) => setOtherDeductions(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Remarks</label>
              <textarea
                rows={3}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                maxLength={2000}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowAdj(false)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAdjustment}
                disabled={saving}
                className="px-5 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
