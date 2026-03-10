import { useState, useEffect } from 'react';
import AppHeader from '../components/layout/AppHeader';
import Modal from '../components/common/Modal';
import fnfSettlementService, {
  FnfSettlement,
  FnfCalculationDetails,
} from '../services/fnfSettlement.service';
import employeeSeparationService, { EmployeeSeparation } from '../services/employeeSeparation.service';
import { useAuthStore } from '../store/authStore';

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  CALCULATED: 'bg-blue-100 text-blue-700',
  APPROVED: 'bg-green-100 text-green-700',
  PAID: 'bg-emerald-100 text-emerald-700',
};

function fmt(n: number | undefined | null) {
  if (n == null) return '₹0';
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: string | undefined | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function FnfSettlementPage() {
  const { user, logout } = useAuthStore();
  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id || '';

  const [settlements, setSettlements] = useState<FnfSettlement[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  // Calculate modal
  const [showCalculateModal, setShowCalculateModal] = useState(false);
  const [separations, setSeparations] = useState<EmployeeSeparation[]>([]);
  const [selectedSeparationId, setSelectedSeparationId] = useState('');
  const [calculating, setCalculating] = useState(false);
  const [calcError, setCalcError] = useState<string | null>(null);

  // Detail modal
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedSettlement, setSelectedSettlement] = useState<FnfSettlement | null>(null);
  const [_details, setDetails] = useState<FnfCalculationDetails | null>(null);

  // Adjustment modal
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustData, setAdjustData] = useState({ otherEarnings: 0, otherDeductions: 0, remarks: '' });
  const [saving, setSaving] = useState(false);

  const fetchSettlements = async () => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fnfSettlementService.getAll({
        organizationId,
        page,
        limit: 10,
        status: statusFilter || undefined,
        search: search || undefined,
      });
      setSettlements(result.items);
      setPagination(result.pagination);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load settlements');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSettlements(); }, [page, statusFilter, search]);

  // Load separations that don't have a settlement yet
  const openCalculateModal = async () => {
    try {
      const result = await employeeSeparationService.getAll({ organizationId, limit: 100 });
      setSeparations(result.separations || []);
    } catch {
      setSeparations([]);
    }
    setSelectedSeparationId('');
    setCalcError(null);
    setShowCalculateModal(true);
  };

  const handleCalculate = async () => {
    if (!selectedSeparationId) {
      setCalcError('Please select a separation record');
      return;
    }
    setCalculating(true);
    setCalcError(null);
    try {
      await fnfSettlementService.calculate(selectedSeparationId, organizationId);
      setShowCalculateModal(false);
      fetchSettlements();
    } catch (e: any) {
      setCalcError(e?.response?.data?.message || 'Calculation failed');
    } finally {
      setCalculating(false);
    }
  };

  const openDetailModal = async (settlement: FnfSettlement) => {
    try {
      const full = await fnfSettlementService.getById(settlement.id);
      setSelectedSettlement(full);
      setDetails(null);
      setShowDetailModal(true);
    } catch {
      setSelectedSettlement(settlement);
      setShowDetailModal(true);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await fnfSettlementService.approve(id);
      fetchSettlements();
      setShowDetailModal(false);
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Approval failed');
    }
  };

  const handleMarkPaid = async (id: string) => {
    try {
      await fnfSettlementService.markAsPaid(id);
      fetchSettlements();
      setShowDetailModal(false);
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Failed to mark as paid');
    }
  };

  const openAdjustModal = (settlement: FnfSettlement) => {
    setSelectedSettlement(settlement);
    setAdjustData({
      otherEarnings: Number(settlement.otherEarnings) || 0,
      otherDeductions: Number(settlement.otherDeductions) || 0,
      remarks: settlement.remarks || '',
    });
    setShowAdjustModal(true);
  };

  const handleSaveAdjustments = async () => {
    if (!selectedSettlement) return;
    setSaving(true);
    try {
      await fnfSettlementService.update(selectedSettlement.id, adjustData);
      setShowAdjustModal(false);
      fetchSettlements();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Failed to save adjustments');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this settlement? This action cannot be undone.')) return;
    try {
      await fnfSettlementService.delete(id);
      fetchSettlements();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Delete failed');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader title="F&F Settlement" onLogout={logout} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Full & Final Settlement</h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage employee exit settlements — gratuity, leave encashment, notice recovery & TDS
            </p>
          </div>
          <button
            onClick={openCalculateModal}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            + Calculate F&F
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-5">
          <input
            type="text"
            placeholder="Search employee..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="CALCULATED">Calculated</option>
            <option value="APPROVED">Approved</option>
            <option value="PAID">Paid</option>
          </select>
        </div>

        {/* Table */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Employee</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Last Working Date</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Total Payable</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Total Recovery</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Net Settlement</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading...</td>
                </tr>
              ) : settlements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">No settlements found</td>
                </tr>
              ) : (
                settlements.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {s.employee ? `${s.employee.firstName} ${s.employee.lastName}` : s.employeeId}
                      </div>
                      <div className="text-xs text-gray-500">{s.employee?.employeeCode}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{fmtDate(s.lastWorkingDate)}</td>
                    <td className="px-4 py-3 text-right font-medium text-green-700">{fmt(s.totalPayable)}</td>
                    <td className="px-4 py-3 text-right font-medium text-red-600">{fmt(s.totalRecovery)}</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">{fmt(s.netSettlement)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[s.status] || 'bg-gray-100 text-gray-700'}`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => openDetailModal(s)}
                          className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                        >
                          View
                        </button>
                        {(s.status === 'CALCULATED' || s.status === 'DRAFT') && (
                          <>
                            <button
                              onClick={() => openAdjustModal(s)}
                              className="text-amber-600 hover:text-amber-800 text-xs font-medium"
                            >
                              Adjust
                            </button>
                            <button
                              onClick={() => handleDelete(s.id)}
                              className="text-red-500 hover:text-red-700 text-xs font-medium"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
              <span className="text-sm text-gray-500">
                Showing {(pagination.page - 1) * pagination.limit + 1}–
                {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={page === pagination.totalPages}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Calculate F&F Modal */}
      <Modal isOpen={showCalculateModal} onClose={() => setShowCalculateModal(false)} title="Calculate Full & Final Settlement">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Select a separation record to calculate the full & final settlement. This will compute
            gratuity, leave encashment, notice period recovery, bonus, and TDS adjustment.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Separation Record</label>
            <select
              value={selectedSeparationId}
              onChange={(e) => setSelectedSeparationId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Select Separation --</option>
              {separations.map((sep) => (
                <option key={sep.id} value={sep.id}>
                  {sep.employee
                    ? `${sep.employee.firstName} ${sep.employee.lastName} (${sep.employee.employeeCode}) — ${fmtDate(sep.relievingDate)}`
                    : sep.id}
                </option>
              ))}
            </select>
          </div>
          {calcError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
              {calcError}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setShowCalculateModal(false)}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCalculate}
              disabled={calculating || !selectedSeparationId}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {calculating ? 'Calculating...' : 'Calculate F&F'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Settlement Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="F&F Settlement Details"
      >
        {selectedSettlement && (
          <div className="space-y-5 text-sm">
            {/* Employee Info */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-800 mb-2">Employee Information</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-500">Name: </span>
                  <span className="font-medium">
                    {selectedSettlement.employee
                      ? `${selectedSettlement.employee.firstName} ${selectedSettlement.employee.lastName}`
                      : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Code: </span>
                  <span className="font-medium">{selectedSettlement.employee?.employeeCode || '—'}</span>
                </div>
                <div>
                  <span className="text-gray-500">Department: </span>
                  <span className="font-medium">{selectedSettlement.employee?.department?.name || '—'}</span>
                </div>
                <div>
                  <span className="text-gray-500">Last Working Date: </span>
                  <span className="font-medium">{fmtDate(selectedSettlement.lastWorkingDate)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Years of Service: </span>
                  <span className="font-medium">{Number(selectedSettlement.yearsOfService).toFixed(2)} yrs</span>
                </div>
                <div>
                  <span className="text-gray-500">Status: </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[selectedSettlement.status]}`}>
                    {selectedSettlement.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Earnings */}
            <div>
              <h3 className="font-semibold text-gray-800 mb-2 text-green-700">Earnings</h3>
              <table className="w-full text-xs">
                <tbody className="divide-y divide-gray-100">
                  <tr className="bg-gray-50">
                    <td className="py-1.5 pr-4">Final Month Salary (Pro-rata)</td>
                    <td className="py-1.5 text-right font-medium">{fmt(selectedSettlement.finalMonthNet)}</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 pr-4">
                      Leave Encashment
                      <span className="text-gray-400 ml-1">({Number(selectedSettlement.encashableLeaveDays).toFixed(1)} days)</span>
                    </td>
                    <td className="py-1.5 text-right font-medium">{fmt(selectedSettlement.leaveEncashmentAmount)}</td>
                  </tr>
                  {Number(selectedSettlement.gratuityAmount) > 0 && (
                    <tr className="bg-gray-50">
                      <td className="py-1.5 pr-4">
                        Gratuity
                        <span className="text-gray-400 ml-1">({Number(selectedSettlement.yearsOfService).toFixed(1)} yrs)</span>
                        {!selectedSettlement.gratuityEligible && (
                          <span className="text-red-500 ml-1">(Not eligible)</span>
                        )}
                      </td>
                      <td className="py-1.5 text-right font-medium">{fmt(selectedSettlement.gratuityAmount)}</td>
                    </tr>
                  )}
                  {Number(selectedSettlement.bonusPayable) > 0 && (
                    <tr>
                      <td className="py-1.5 pr-4">Pro-rata Bonus</td>
                      <td className="py-1.5 text-right font-medium">{fmt(selectedSettlement.bonusPayable)}</td>
                    </tr>
                  )}
                  {Number(selectedSettlement.otherEarnings) > 0 && (
                    <tr className="bg-gray-50">
                      <td className="py-1.5 pr-4">Other Earnings</td>
                      <td className="py-1.5 text-right font-medium">{fmt(selectedSettlement.otherEarnings)}</td>
                    </tr>
                  )}
                  <tr className="border-t-2 border-green-200 bg-green-50">
                    <td className="py-2 pr-4 font-semibold text-green-800">Total Payable</td>
                    <td className="py-2 text-right font-bold text-green-800">{fmt(selectedSettlement.totalPayable)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Deductions */}
            <div>
              <h3 className="font-semibold text-red-700 mb-2">Deductions / Recoveries</h3>
              <table className="w-full text-xs">
                <tbody className="divide-y divide-gray-100">
                  {Number(selectedSettlement.noticePeriodRecovery) > 0 && (
                    <tr>
                      <td className="py-1.5 pr-4">
                        Notice Period Recovery
                        <span className="text-gray-400 ml-1">
                          ({selectedSettlement.noticePeriodDays - selectedSettlement.noticePeriodServed} days shortfall)
                        </span>
                      </td>
                      <td className="py-1.5 text-right font-medium text-red-600">{fmt(selectedSettlement.noticePeriodRecovery)}</td>
                    </tr>
                  )}
                  {Number(selectedSettlement.tdsAdjustment) > 0 && (
                    <tr className="bg-gray-50">
                      <td className="py-1.5 pr-4">TDS Adjustment (Sec 192)</td>
                      <td className="py-1.5 text-right font-medium text-red-600">{fmt(selectedSettlement.tdsAdjustment)}</td>
                    </tr>
                  )}
                  {Number(selectedSettlement.excessLeaveRecovery) > 0 && (
                    <tr>
                      <td className="py-1.5 pr-4">Excess Leave Recovery</td>
                      <td className="py-1.5 text-right font-medium text-red-600">{fmt(selectedSettlement.excessLeaveRecovery)}</td>
                    </tr>
                  )}
                  {Number(selectedSettlement.loanAdvanceRecovery) > 0 && (
                    <tr className="bg-gray-50">
                      <td className="py-1.5 pr-4">Pending Loan/Advance Recovery</td>
                      <td className="py-1.5 text-right font-medium text-red-600">{fmt(selectedSettlement.loanAdvanceRecovery)}</td>
                    </tr>
                  )}
                  {Number(selectedSettlement.insuranceRecovery) > 0 && (
                    <tr>
                      <td className="py-1.5 pr-4">Insurance Recovery</td>
                      <td className="py-1.5 text-right font-medium text-red-600">{fmt(selectedSettlement.insuranceRecovery)}</td>
                    </tr>
                  )}
                  {Number(selectedSettlement.travelRecovery) > 0 && (
                    <tr className="bg-gray-50">
                      <td className="py-1.5 pr-4">Travel Recovery</td>
                      <td className="py-1.5 text-right font-medium text-red-600">{fmt(selectedSettlement.travelRecovery)}</td>
                    </tr>
                  )}
                  {Number(selectedSettlement.otherDeductions) > 0 && (
                    <tr>
                      <td className="py-1.5 pr-4">Other Deductions</td>
                      <td className="py-1.5 text-right font-medium text-red-600">{fmt(selectedSettlement.otherDeductions)}</td>
                    </tr>
                  )}
                  <tr className="border-t-2 border-red-200 bg-red-50">
                    <td className="py-2 pr-4 font-semibold text-red-800">Total Recovery</td>
                    <td className="py-2 text-right font-bold text-red-800">{fmt(selectedSettlement.totalRecovery)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Net Settlement */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="font-bold text-blue-900 text-base">Net Settlement Amount</span>
                <span className="font-bold text-blue-900 text-xl">{fmt(selectedSettlement.netSettlement)}</span>
              </div>
              {selectedSettlement.remarks && (
                <p className="text-xs text-blue-700 mt-1">Remarks: {selectedSettlement.remarks}</p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
              {selectedSettlement.status === 'CALCULATED' && (
                <button
                  onClick={() => handleApprove(selectedSettlement.id)}
                  className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Approve Settlement
                </button>
              )}
              {selectedSettlement.status === 'APPROVED' && (
                <button
                  onClick={() => handleMarkPaid(selectedSettlement.id)}
                  className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                >
                  Mark as Paid
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Adjustment Modal */}
      <Modal
        isOpen={showAdjustModal}
        onClose={() => setShowAdjustModal(false)}
        title="Manual Adjustments"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Add manual adjustments before approving the settlement.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Other Earnings (₹)</label>
            <input
              type="number"
              min={0}
              value={adjustData.otherEarnings}
              onChange={(e) => setAdjustData((d) => ({ ...d, otherEarnings: Number(e.target.value) }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Other Deductions (₹)</label>
            <input
              type="number"
              min={0}
              value={adjustData.otherDeductions}
              onChange={(e) => setAdjustData((d) => ({ ...d, otherDeductions: Number(e.target.value) }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
            <textarea
              value={adjustData.remarks}
              onChange={(e) => setAdjustData((d) => ({ ...d, remarks: e.target.value }))}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setShowAdjustModal(false)}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveAdjustments}
              disabled={saving}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Adjustments'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
