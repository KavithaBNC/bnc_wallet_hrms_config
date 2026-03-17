import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import fnfSettlementService, { FnfSettlement } from '../services/fnfSettlement.service';
import { useAuthStore } from '../store/authStore';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const fmtDateTime = (d?: string) =>
  d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

type ApprovalStep = 'idle' | 'approving' | 'paid';

export default function FnfApprovalPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [settlement, setSettlement] = useState<FnfSettlement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionState, setActionState] = useState<ApprovalStep>('idle');
  const [actionError, setActionError] = useState('');

  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ORG_ADMIN';
  const isHrOrAbove = isAdmin || user?.role === 'HR_MANAGER';

  const load = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await fnfSettlementService.getById(id);
      const s = (data as any).settlement ?? data;
      setSettlement(s);
    } catch {
      setError('Failed to load settlement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const handleApprove = async () => {
    if (!id) return;
    try {
      setActionState('approving');
      setActionError('');
      await fnfSettlementService.approve(id);
      await load();
    } catch (err: any) {
      setActionError(err?.response?.data?.message || 'Approval failed');
    } finally {
      setActionState('idle');
    }
  };

  const handleMarkPaid = async () => {
    if (!id) return;
    try {
      setActionState('paid');
      setActionError('');
      await fnfSettlementService.markAsPaid(id);
      await load();
    } catch (err: any) {
      setActionError(err?.response?.data?.message || 'Failed to mark as paid');
    } finally {
      setActionState('idle');
    }
  };

  if (loading) {
    return <div className="p-6 text-center text-gray-400">Loading...</div>;
  }
  if (error || !settlement) {
    return <div className="p-6"><div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">{error}</div></div>;
  }

  const s = settlement;
  const isCalculated = s.status === 'CALCULATED' || s.status === 'DRAFT';
  const isApproved = s.status === 'APPROVED';
  const isPaid = s.status === 'PAID';

  // Stepper states
  const step1Done = isApproved || isPaid;
  const step2Done = isPaid;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(`/payroll/fnf-settlement/${id}`)} className="text-gray-400 hover:text-gray-600">
          ← Back
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Approval — {s.employee?.firstName} {s.employee?.lastName}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Net Settlement: {fmt(Number(s.netSettlement))}</p>
        </div>
      </div>

      {actionError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{actionError}</div>
      )}

      {/* Approval Workflow */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">Approval Workflow</h2>
          <p className="text-xs text-gray-500 mt-0.5">Two-level approval required for settlement release</p>
        </div>

        <div className="p-6 space-y-6">
          {/* Level 1 — HR Approval */}
          <div className={`rounded-xl border-2 p-5 ${step1Done ? 'border-green-200 bg-green-50' : isCalculated ? 'border-indigo-200 bg-indigo-50' : 'border-gray-200 bg-gray-50'}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step1Done ? 'bg-green-500 text-white' : isCalculated ? 'bg-indigo-600 text-white' : 'bg-gray-300 text-gray-600'}`}>
                  {step1Done ? '✓' : '1'}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">Level 1 — HR Manager Approval</p>
                  {step1Done ? (
                    <p className="text-xs text-green-700 mt-0.5">
                      Approved by {s.approvedBy || 'HR Manager'} on {fmtDate(s.approvedAt)}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500 mt-0.5">Review settlement details and approve for processing</p>
                  )}
                </div>
              </div>
              {step1Done ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                  ✓ Approved
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                  ⏳ Pending
                </span>
              )}
            </div>

            {isCalculated && isHrOrAbove && (
              <div className="mt-4 flex gap-3">
                <button
                  onClick={handleApprove}
                  disabled={actionState !== 'idle'}
                  className="px-5 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
                >
                  {actionState === 'approving' ? 'Approving...' : '✓ Approve Settlement'}
                </button>
              </div>
            )}
          </div>

          {/* Connector */}
          <div className="flex justify-center">
            <div className={`w-0.5 h-6 ${step1Done ? 'bg-green-300' : 'bg-gray-200'}`} />
          </div>

          {/* Level 2 — Accounts Approval */}
          <div className={`rounded-xl border-2 p-5 ${step2Done ? 'border-green-200 bg-green-50' : isApproved ? 'border-purple-200 bg-purple-50' : 'border-gray-200 bg-gray-50 opacity-60'}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step2Done ? 'bg-green-500 text-white' : isApproved ? 'bg-purple-600 text-white' : 'bg-gray-300 text-gray-500'}`}>
                  {step2Done ? '✓' : '2'}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">Level 2 — Accounts Approval (Payment Release)</p>
                  {step2Done ? (
                    <p className="text-xs text-green-700 mt-0.5">
                      Payment released on {fmtDate(s.settlementDate)}
                    </p>
                  ) : isApproved ? (
                    <p className="text-xs text-purple-700 mt-0.5">HR approved — accounts can now release payment</p>
                  ) : (
                    <p className="text-xs text-gray-500 mt-0.5">Locked until Level 1 approval is complete</p>
                  )}
                </div>
              </div>
              {step2Done ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                  ✓ Paid
                </span>
              ) : isApproved ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                  🔓 Active
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                  🔒 Locked
                </span>
              )}
            </div>

            {isApproved && isAdmin && (
              <div className="mt-4 flex gap-3">
                <button
                  onClick={handleMarkPaid}
                  disabled={actionState !== 'idle'}
                  className="px-5 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium"
                >
                  {actionState === 'paid' ? 'Processing...' : '✓ Mark as Paid / Release Payment'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Settlement Summary */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Settlement Summary</h2>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="bg-green-50 rounded-lg p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">Total Payable</p>
            <p className="text-lg font-bold text-green-700">{fmt(Number(s.totalPayable))}</p>
          </div>
          <div className="bg-red-50 rounded-lg p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">Total Recovery</p>
            <p className="text-lg font-bold text-red-700">{fmt(Number(s.totalRecovery))}</p>
          </div>
          <div className="bg-indigo-50 rounded-lg p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">Net Settlement</p>
            <p className="text-lg font-bold text-indigo-700">{fmt(Number(s.netSettlement))}</p>
          </div>
        </div>
        {s.remarks && (
          <div className="mt-4 text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
            <span className="text-xs font-semibold text-gray-500 mr-2">REMARKS:</span>{s.remarks}
          </div>
        )}
      </div>

      {/* Audit Trail */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Audit Trail</h2>
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 shrink-0" />
            <div>
              <p className="text-gray-800">Settlement Initiated / Calculated</p>
              <p className="text-xs text-gray-400">{fmtDateTime(s.calculatedAt)}</p>
            </div>
          </div>
          {step1Done && (
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-green-400 mt-1.5 shrink-0" />
              <div>
                <p className="text-gray-800">HR Approval — Approved</p>
                <p className="text-xs text-gray-400">{fmtDateTime(s.approvedAt)}</p>
              </div>
            </div>
          )}
          {step2Done && (
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-purple-400 mt-1.5 shrink-0" />
              <div>
                <p className="text-gray-800">Payment Released — Settlement Completed</p>
                <p className="text-xs text-gray-400">{fmtDateTime(s.settlementDate)}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between">
        <button
          onClick={() => navigate(`/payroll/fnf-settlement/${id}`)}
          className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
        >
          ← View Calculation
        </button>
        <button
          onClick={() => navigate(`/payroll/fnf-settlement/${id}/statement`)}
          className="px-4 py-2 text-sm border border-indigo-300 text-indigo-700 rounded-lg hover:bg-indigo-50"
        >
          📄 View Statement →
        </button>
      </div>
    </div>
  );
}
