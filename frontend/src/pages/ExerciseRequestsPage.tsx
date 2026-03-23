import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { getModulePermissions } from '../config/configurator-module-mapping';
import {
  esopService,
  EsopExerciseRequest,
  EsopGrant,
  CreateExerciseRequestInput,
} from '../services/esop.service';

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-blue-100 text-blue-700',
  REJECTED: 'bg-red-100 text-red-600',
  COMPLETED: 'bg-green-100 text-green-700',
};

const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN');
const fmtCurrency = (v: string | number) => `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

export default function ExerciseRequestsPage() {
  const { user } = useAuthStore();
  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id || '';
  const employeeId = user?.employee?.id || '';
  const esopPerms = getModulePermissions('/esop');
  const isAdmin = esopPerms.can_edit;

  const [requests, setRequests] = useState<EsopExerciseRequest[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  // Create request modal
  const [showCreate, setShowCreate] = useState(false);
  const [grants, setGrants] = useState<EsopGrant[]>([]);
  const [availableInfo, setAvailableInfo] = useState<{ totalVested: number; committedShares: number; availableToExercise: number } | null>(null);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [form, setForm] = useState<CreateExerciseRequestInput>({
    organizationId: '',
    grantId: '',
    employeeId: '',
    sharesRequested: 0,
    exercisePrice: 0,
    remarks: '',
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Reject modal
  const [showReject, setShowReject] = useState(false);
  const [rejectId, setRejectId] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  const fetchRequests = async (page = 1) => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const res = await esopService.getAllExerciseRequests({
        organizationId,
        page,
        limit: 20,
        status: statusFilter || undefined,
        employeeId: !isAdmin ? employeeId : undefined,
      });
      setRequests(res.items);
      setPagination(res.pagination);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests(1);
  }, [organizationId, statusFilter]);

  const openCreate = async () => {
    setFormError('');
    setAvailableInfo(null);
    setForm({ organizationId, grantId: '', employeeId, sharesRequested: 0, exercisePrice: 0, remarks: '' });
    // Load active grants — admins see all org grants, employees see only their own
    const res = await esopService.getAllGrants({ organizationId, ...(isAdmin ? {} : { employeeId }), status: 'ACTIVE', limit: 100 });
    setGrants(res.items);
    setShowCreate(true);
  };

  const handleGrantChange = async (grantId: string) => {
    const selectedGrant = grants.find(g => g.id === grantId);
    setForm(f => ({ ...f, grantId, employeeId: selectedGrant?.employeeId || f.employeeId }));
    setAvailableInfo(null);
    if (!grantId) return;
    setLoadingAvailable(true);
    try {
      const info = await esopService.getAvailableToExercise(grantId);
      setAvailableInfo(info);
      // Pre-fill exercise price from grant price
      const grant = grants.find(g => g.id === grantId);
      if (grant) setForm(f => ({ ...f, exercisePrice: Number(grant.grantPrice) }));
    } finally {
      setLoadingAvailable(false);
    }
  };

  const handleCreate = async () => {
    if (!form.grantId || form.sharesRequested <= 0 || form.exercisePrice <= 0) {
      setFormError('Please fill all required fields');
      return;
    }
    if (availableInfo && form.sharesRequested > availableInfo.availableToExercise) {
      setFormError(`Cannot request more than ${availableInfo.availableToExercise} available shares`);
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await esopService.createExerciseRequest(form);
      setShowCreate(false);
      fetchRequests(pagination.page);
    } catch (e: any) {
      setFormError(e?.response?.data?.message || 'Failed to submit exercise request');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (id: string) => {
    if (!confirm('Approve this exercise request?')) return;
    try {
      await esopService.approveExercise(id);
      fetchRequests(pagination.page);
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Failed to approve');
    }
  };

  const openReject = (id: string) => {
    setRejectId(id);
    setRejectionReason('');
    setShowReject(true);
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) { alert('Please provide a rejection reason'); return; }
    try {
      await esopService.rejectExercise(rejectId, rejectionReason);
      setShowReject(false);
      fetchRequests(pagination.page);
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Failed to reject');
    }
  };

  const handleComplete = async (id: string) => {
    if (!confirm('Mark this exercise request as completed? This will update the grant exercised shares.')) return;
    try {
      await esopService.completeExercise(id);
      fetchRequests(pagination.page);
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Failed to complete');
    }
  };

  const totalValue = form.sharesRequested > 0 && form.exercisePrice > 0
    ? form.sharesRequested * form.exercisePrice : 0;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Exercise Requests</h1>
          <p className="text-gray-500 text-sm">Submit and manage ESOP exercise requests</p>
        </div>
        <button onClick={openCreate} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">
          + New Exercise Request
        </button>
      </div>

      <div className="flex gap-3 mb-4">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="COMPLETED">Completed</option>
        </select>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left">Employee</th>
              <th className="px-4 py-3 text-left">Request Date</th>
              <th className="px-4 py-3 text-right">Shares</th>
              <th className="px-4 py-3 text-right">Exercise Price</th>
              <th className="px-4 py-3 text-right">Total Value</th>
              <th className="px-4 py-3 text-center">Status</th>
              {isAdmin && <th className="px-4 py-3 text-center">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={isAdmin ? 7 : 6} className="text-center py-8 text-gray-400">Loading...</td></tr>
            ) : requests.length === 0 ? (
              <tr><td colSpan={isAdmin ? 7 : 6} className="text-center py-8 text-gray-400">No exercise requests found.</td></tr>
            ) : requests.map(r => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{r.employee?.firstName} {r.employee?.lastName}</p>
                  <p className="text-xs text-gray-400">{r.employee?.employeeCode}</p>
                </td>
                <td className="px-4 py-3 text-gray-600">{fmtDate(r.requestDate)}</td>
                <td className="px-4 py-3 text-right font-medium">{r.sharesRequested.toLocaleString()}</td>
                <td className="px-4 py-3 text-right">{fmtCurrency(r.exercisePrice)}</td>
                <td className="px-4 py-3 text-right text-indigo-600 font-medium">{fmtCurrency(r.totalExerciseValue)}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-600'}`}>
                    {r.status}
                  </span>
                  {r.rejectionReason && (
                    <p className="text-xs text-red-500 mt-0.5">{r.rejectionReason}</p>
                  )}
                </td>
                {isAdmin && (
                  <td className="px-4 py-3 text-center whitespace-nowrap">
                    {r.status === 'PENDING' && (
                      <>
                        <button onClick={() => handleApprove(r.id)} className="text-blue-600 hover:underline text-xs mr-2">Approve</button>
                        <button onClick={() => openReject(r.id)} className="text-red-500 hover:underline text-xs">Reject</button>
                      </>
                    )}
                    {r.status === 'APPROVED' && (
                      <button onClick={() => handleComplete(r.id)} className="text-green-600 hover:underline text-xs">Complete</button>
                    )}
                    {['REJECTED', 'COMPLETED'].includes(r.status) && (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
          <span>Showing {requests.length} of {pagination.total}</span>
          <div className="flex gap-2">
            <button disabled={pagination.page <= 1} onClick={() => fetchRequests(pagination.page - 1)}
              className="px-3 py-1 border rounded disabled:opacity-40">Previous</button>
            <button disabled={pagination.page >= pagination.totalPages} onClick={() => fetchRequests(pagination.page + 1)}
              className="px-3 py-1 border rounded disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      {/* Create Exercise Request Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900 mb-4">New Exercise Request</h2>
            {formError && <div className="text-red-500 text-sm mb-3">{formError}</div>}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Select Grant *</label>
                <select value={form.grantId} onChange={e => handleGrantChange(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value="">Select active grant...</option>
                  {grants.map(g => (
                    <option key={g.id} value={g.id}>
                      {isAdmin && (g as any).employee ? `${(g as any).employee.firstName} ${(g as any).employee.lastName} — ` : ''}
                      {fmtDate(g.grantDate)} — {g.totalShares.toLocaleString()} shares @ ₹{Number(g.grantPrice).toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>

              {loadingAvailable && (
                <p className="text-xs text-gray-400">Loading available shares...</p>
              )}

              {availableInfo && (
                <div className="bg-indigo-50 rounded-lg p-3 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Vested:</span>
                    <span className="font-medium">{availableInfo.totalVested.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Committed (pending/approved):</span>
                    <span className="font-medium text-orange-600">{availableInfo.committedShares.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1 mt-1">
                    <span className="text-gray-700 font-medium">Available to Exercise:</span>
                    <span className="font-bold text-indigo-600">{availableInfo.availableToExercise.toLocaleString()}</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Shares to Exercise *</label>
                  <input type="number" min={1} max={availableInfo?.availableToExercise}
                    value={form.sharesRequested}
                    onChange={e => setForm(f => ({ ...f, sharesRequested: Number(e.target.value) }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Exercise Price (₹) *</label>
                  <input type="number" min={0.01} step={0.01} value={form.exercisePrice}
                    onChange={e => setForm(f => ({ ...f, exercisePrice: Number(e.target.value) }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>

              {totalValue > 0 && (
                <div className="bg-gray-50 rounded-lg px-3 py-2 flex justify-between text-sm">
                  <span className="text-gray-600">Total Exercise Value:</span>
                  <span className="font-bold text-indigo-600">{fmtCurrency(totalValue)}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Remarks</label>
                <textarea rows={2} value={form.remarks ?? ''}
                  onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleCreate} disabled={saving}
                className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {saving ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showReject && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-3">Reject Exercise Request</h2>
            <label className="block text-xs font-medium text-gray-600 mb-1">Rejection Reason *</label>
            <textarea rows={3} value={rejectionReason} onChange={e => setRejectionReason(e.target.value)}
              placeholder="Provide reason for rejection..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowReject(false)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleReject}
                className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700">
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
