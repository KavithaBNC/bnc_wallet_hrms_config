import { useState, useEffect } from 'react';
import AppHeader from '../components/layout/AppHeader';
import Modal from '../components/common/Modal';
import loanService, {
  EmployeeLoan,
  CreateLoanInput,
  LoanType,
  LoanStatus,
  RecordRepaymentInput,
} from '../services/loan.service';
import employeeService from '../services/employee.service';
import { useAuthStore } from '../store/authStore';

const LOAN_TYPES: { value: LoanType; label: string }[] = [
  { value: 'SALARY_ADVANCE', label: 'Salary Advance' },
  { value: 'PERSONAL_LOAN', label: 'Personal Loan' },
  { value: 'TRAVEL_ADVANCE', label: 'Travel Advance' },
  { value: 'INSURANCE_ADVANCE', label: 'Insurance Advance' },
  { value: 'OTHER', label: 'Other' },
];

const STATUS_COLORS: Record<LoanStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-blue-100 text-blue-800',
  ACTIVE: 'bg-green-100 text-green-800',
  CLOSED: 'bg-gray-100 text-gray-700',
  REJECTED: 'bg-red-100 text-red-800',
  WRITTEN_OFF: 'bg-purple-100 text-purple-800',
};

function fmt(val: string | number | null | undefined): string {
  if (val == null) return '—';
  const n = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(n)) return '—';
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function LoanPage() {
  const { user, logout } = useAuthStore();
  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id || '';

  const [loans, setLoans] = useState<EmployeeLoan[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [loanTypeFilter, setLoanTypeFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showRepaymentModal, setShowRepaymentModal] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<EmployeeLoan | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [employees, setEmployees] = useState<Array<{ id: string; employeeCode: string; firstName: string; lastName: string }>>([]);

  const [createForm, setCreateForm] = useState<Partial<CreateLoanInput>>({
    organizationId,
    loanType: 'SALARY_ADVANCE',
    loanAmount: 0,
    totalEmis: 1,
    startDate: new Date().toISOString().split('T')[0],
  });

  const [repaymentForm, setRepaymentForm] = useState<RecordRepaymentInput>({
    amount: 0,
    repaymentDate: new Date().toISOString().split('T')[0],
  });

  const fetchLoans = async () => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);
    try {
      const params: any = { organizationId, page, limit: pageSize };
      if (searchTerm) params.search = searchTerm;
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (loanTypeFilter !== 'ALL') params.loanType = loanTypeFilter;
      const result = await loanService.getAll(params);
      setLoans(result.items || []);
      setPagination(result.pagination || { page: 1, limit: 10, total: 0, totalPages: 0 });
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Failed to load loans');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoans();
  }, [organizationId, page, statusFilter, loanTypeFilter]);

  useEffect(() => {
    if (!organizationId) return;
    employeeService.getAll({ organizationId, limit: 1000 }).then((res: any) => {
      setEmployees(res.employees || res.data?.employees || []);
    }).catch(() => {});
  }, [organizationId]);

  const handleSearch = () => {
    setPage(1);
    fetchLoans();
  };

  const openDetail = async (loan: EmployeeLoan) => {
    try {
      const full = await loanService.getById(loan.id);
      setSelectedLoan(full);
      setShowDetailModal(true);
    } catch {
      setSelectedLoan(loan);
      setShowDetailModal(true);
    }
  };

  const handleCreate = async () => {
    if (!createForm.employeeId || !createForm.loanAmount || !createForm.startDate) {
      alert('Employee, Loan Amount and Start Date are required');
      return;
    }
    setSubmitting(true);
    try {
      await loanService.create({
        ...createForm,
        organizationId,
      } as CreateLoanInput);
      setShowCreateModal(false);
      setCreateForm({ organizationId, loanType: 'SALARY_ADVANCE', loanAmount: 0, totalEmis: 1, startDate: new Date().toISOString().split('T')[0] });
      fetchLoans();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to create loan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (loan: EmployeeLoan) => {
    if (!confirm(`Approve loan of ${fmt(loan.loanAmount)} for ${loan.employee?.firstName} ${loan.employee?.lastName}?`)) return;
    try {
      await loanService.approve(loan.id);
      fetchLoans();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to approve loan');
    }
  };

  const handleDisburse = async (loan: EmployeeLoan) => {
    if (!confirm(`Disburse loan of ${fmt(loan.loanAmount)}? This will mark it as ACTIVE.`)) return;
    try {
      await loanService.disburse(loan.id);
      fetchLoans();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to disburse loan');
    }
  };

  const handleReject = async (loan: EmployeeLoan) => {
    if (!confirm(`Reject this loan request?`)) return;
    try {
      await loanService.reject(loan.id);
      fetchLoans();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to reject loan');
    }
  };

  const handleRepayment = async () => {
    if (!selectedLoan) return;
    if (!repaymentForm.amount || repaymentForm.amount <= 0) {
      alert('Enter a valid repayment amount');
      return;
    }
    setSubmitting(true);
    try {
      const result = await loanService.recordRepayment(selectedLoan.id, repaymentForm);
      setShowRepaymentModal(false);
      setRepaymentForm({ amount: 0, repaymentDate: new Date().toISOString().split('T')[0] });
      if (result.loanClosed) {
        alert('Repayment recorded. Loan is now CLOSED.');
      }
      fetchLoans();
      setShowDetailModal(false);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to record repayment');
    } finally {
      setSubmitting(false);
    }
  };

  const emiAmount = createForm.loanAmount && createForm.totalEmis
    ? (createForm.loanAmount / (createForm.totalEmis || 1)).toFixed(2)
    : '0.00';

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader title="Loan & Advance Management" onLogout={logout} />
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Page Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Loan & Advance Management</h1>
            <p className="text-sm text-gray-500 mt-1">Manage employee loans, salary advances and repayments</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            + New Loan Request
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-48">
              <label className="block text-xs font-medium text-gray-600 mb-1">Search Employee</label>
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="Name or code..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="ALL">All Status</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="ACTIVE">Active</option>
                <option value="CLOSED">Closed</option>
                <option value="REJECTED">Rejected</option>
                <option value="WRITTEN_OFF">Written Off</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Loan Type</label>
              <select
                value={loanTypeFilter}
                onChange={e => { setLoanTypeFilter(e.target.value); setPage(1); }}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="ALL">All Types</option>
                {LOAN_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
            >
              Search
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {error && (
            <div className="px-4 py-3 bg-red-50 border-b border-red-200 text-red-700 text-sm">{error}</div>
          )}
          {loading ? (
            <div className="py-16 text-center text-gray-400">Loading loans...</div>
          ) : loans.length === 0 ? (
            <div className="py-16 text-center text-gray-400">No loans found</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Employee</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Type</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-700">Loan Amount</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-700">Pending</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-700">EMI</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-700">EMIs</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Start Date</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-700">Status</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loans.map(loan => (
                  <tr key={loan.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {loan.employee?.firstName} {loan.employee?.lastName}
                      </div>
                      <div className="text-xs text-gray-500">{loan.employee?.employeeCode}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {LOAN_TYPES.find(t => t.value === loan.loanType)?.label || loan.loanType}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{fmt(loan.loanAmount)}</td>
                    <td className="px-4 py-3 text-right font-mono text-orange-600">{fmt(loan.pendingAmount)}</td>
                    <td className="px-4 py-3 text-right font-mono">{fmt(loan.emiAmount)}</td>
                    <td className="px-4 py-3 text-center text-gray-600">
                      {loan.paidEmis}/{loan.totalEmis}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{fmtDate(loan.startDate)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[loan.status] || 'bg-gray-100 text-gray-700'}`}>
                        {loan.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center gap-1">
                        <button
                          onClick={() => openDetail(loan)}
                          className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                        >
                          View
                        </button>
                        {loan.status === 'PENDING' && (
                          <>
                            <button
                              onClick={() => handleApprove(loan)}
                              className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleReject(loan)}
                              className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {loan.status === 'APPROVED' && (
                          <button
                            onClick={() => handleDisburse(loan)}
                            className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                          >
                            Disburse
                          </button>
                        )}
                        {loan.status === 'ACTIVE' && (
                          <button
                            onClick={() => { setSelectedLoan(loan); setRepaymentForm({ amount: parseFloat(loan.emiAmount) || 0, repaymentDate: new Date().toISOString().split('T')[0] }); setShowRepaymentModal(true); }}
                            className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                          >
                            Repay
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="px-4 py-3 border-t border-gray-200 flex justify-between items-center text-sm text-gray-600">
              <span>Showing {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded disabled:opacity-40">Prev</button>
                <button disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Loan Modal */}
      {showCreateModal && (
        <Modal isOpen={showCreateModal} title="New Loan / Advance Request" onClose={() => setShowCreateModal(false)}>
          <div className="space-y-4 min-w-[480px]">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee *</label>
                <select
                  value={createForm.employeeId || ''}
                  onChange={e => setCreateForm(f => ({ ...f, employeeId: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">-- Select Employee --</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.employeeCode} – {emp.firstName} {emp.lastName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Loan Type *</label>
                <select
                  value={createForm.loanType || 'SALARY_ADVANCE'}
                  onChange={e => setCreateForm(f => ({ ...f, loanType: e.target.value as LoanType }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  {LOAN_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Loan Amount (₹) *</label>
                <input
                  type="number"
                  min="1"
                  value={createForm.loanAmount || ''}
                  onChange={e => setCreateForm(f => ({ ...f, loanAmount: parseFloat(e.target.value) || 0 }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Number of EMIs</label>
                <input
                  type="number"
                  min="1"
                  value={createForm.totalEmis || 1}
                  onChange={e => setCreateForm(f => ({ ...f, totalEmis: parseInt(e.target.value) || 1 }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">EMI Amount (Auto)</label>
                <input
                  type="text"
                  readOnly
                  value={`₹${emiAmount}`}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Interest Rate (%)</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={createForm.interestRate ?? ''}
                  onChange={e => setCreateForm(f => ({ ...f, interestRate: parseFloat(e.target.value) || undefined }))}
                  placeholder="0 = interest free"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
                <input
                  type="date"
                  value={createForm.startDate || ''}
                  onChange={e => setCreateForm(f => ({ ...f, startDate: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason / Purpose</label>
                <textarea
                  rows={2}
                  value={createForm.reason || ''}
                  onChange={e => setCreateForm(f => ({ ...f, reason: e.target.value }))}
                  placeholder="Brief description of purpose..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={handleCreate} disabled={submitting} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {submitting ? 'Creating...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedLoan && (
        <Modal isOpen={showDetailModal} title="Loan Details" onClose={() => setShowDetailModal(false)}>
          <div className="min-w-[520px] space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-500">Employee</p>
                <p className="font-semibold">{selectedLoan.employee?.firstName} {selectedLoan.employee?.lastName} ({selectedLoan.employee?.employeeCode})</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Type</p>
                <p className="font-semibold">{LOAN_TYPES.find(t => t.value === selectedLoan.loanType)?.label}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Loan Amount</p>
                <p className="font-semibold text-blue-700">{fmt(selectedLoan.loanAmount)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Pending Amount</p>
                <p className="font-semibold text-orange-600">{fmt(selectedLoan.pendingAmount)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">EMI Amount</p>
                <p className="font-semibold">{fmt(selectedLoan.emiAmount)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">EMIs Paid</p>
                <p className="font-semibold">{selectedLoan.paidEmis} / {selectedLoan.totalEmis}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Start Date</p>
                <p>{fmtDate(selectedLoan.startDate)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Disbursed Date</p>
                <p>{fmtDate(selectedLoan.disbursedDate)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Interest Rate</p>
                <p>{selectedLoan.interestRate ? `${selectedLoan.interestRate}%` : 'Interest Free'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Status</p>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[selectedLoan.status]}`}>{selectedLoan.status}</span>
              </div>
              {selectedLoan.reason && (
                <div className="col-span-2">
                  <p className="text-xs text-gray-500">Reason</p>
                  <p className="text-sm">{selectedLoan.reason}</p>
                </div>
              )}
            </div>

            {/* Repayment History */}
            {selectedLoan.repayments && selectedLoan.repayments.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Repayment History</h4>
                <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600">Date</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-gray-600">Amount</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-gray-600">Principal</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-gray-600">Interest</th>
                      <th className="text-center px-3 py-2 text-xs font-semibold text-gray-600">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedLoan.repayments.map(r => (
                      <tr key={r.id}>
                        <td className="px-3 py-2">{fmtDate(r.repaymentDate)}</td>
                        <td className="px-3 py-2 text-right font-mono">{fmt(r.amount)}</td>
                        <td className="px-3 py-2 text-right font-mono text-gray-500">{fmt(r.principalAmount)}</td>
                        <td className="px-3 py-2 text-right font-mono text-gray-500">{fmt(r.interestAmount)}</td>
                        <td className="px-3 py-2 text-center">
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">{r.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              {selectedLoan.status === 'ACTIVE' && (
                <button
                  onClick={() => { setShowRepaymentModal(true); setRepaymentForm({ amount: parseFloat(selectedLoan.emiAmount) || 0, repaymentDate: new Date().toISOString().split('T')[0] }); }}
                  className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Record Repayment
                </button>
              )}
              <button onClick={() => setShowDetailModal(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Close</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Repayment Modal */}
      {showRepaymentModal && selectedLoan && (
        <Modal isOpen={showRepaymentModal} title="Record Repayment" onClose={() => setShowRepaymentModal(false)}>
          <div className="min-w-[360px] space-y-4">
            <div className="bg-blue-50 rounded-lg p-3 text-sm">
              <p className="text-blue-700">Pending: <strong>{fmt(selectedLoan.pendingAmount)}</strong></p>
              <p className="text-blue-600 text-xs mt-1">EMI Amount: {fmt(selectedLoan.emiAmount)}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Repayment Amount (₹) *</label>
              <input
                type="number"
                min="1"
                value={repaymentForm.amount || ''}
                onChange={e => setRepaymentForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Repayment Date *</label>
              <input
                type="date"
                value={repaymentForm.repaymentDate}
                onChange={e => setRepaymentForm(f => ({ ...f, repaymentDate: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Interest Component (₹)</label>
              <input
                type="number"
                min="0"
                value={repaymentForm.interestAmount ?? ''}
                onChange={e => setRepaymentForm(f => ({ ...f, interestAmount: parseFloat(e.target.value) || 0 }))}
                placeholder="0 if interest free"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
              <button onClick={() => setShowRepaymentModal(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={handleRepayment} disabled={submitting} className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50">
                {submitting ? 'Recording...' : 'Record Repayment'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
