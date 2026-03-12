import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/layout/AppHeader';
import { useAuthStore } from '../store/authStore';
import { getModulePermissions } from '../config/configurator-module-mapping';
import {
  payrollCycleService,
  payslipService,
  PayrollCycle,
  Payslip,
} from '../services/payroll.service';

const PayrollPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;
  const [payrollCycles, setPayrollCycles] = useState<PayrollCycle[]>([]);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'cycles' | 'payslips'>('cycles');
  const [showCreateCycle, setShowCreateCycle] = useState(false);
  const [processingCycle, setProcessingCycle] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    periodStart: '',
    periodEnd: '',
    paymentDate: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);
  const [showPayslipDetail, setShowPayslipDetail] = useState(false);
  const [payslipDetail, setPayslipDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Module permissions from /api/v1/user-role-modules/project API response
  const payrollPerms = getModulePermissions('/payroll');
  const canManagePayroll = payrollPerms.can_add || payrollPerms.can_edit;
  const canViewPayroll = payrollPerms.can_view;

  const organizationId = user?.employee?.organizationId;

  useEffect(() => {
    if (organizationId && canViewPayroll) {
      fetchPayrollCycles();
      fetchPayslips();
    } else if (user?.employee?.id) {
      // Employee can only view their own payslips
      fetchMyPayslips();
    } else {
      setLoading(false);
    }
  }, [organizationId, user, canViewPayroll]);

  const fetchPayrollCycles = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await payrollCycleService.getAll({
        organizationId,
        page: '1',
        limit: '50',
      });
      setPayrollCycles(response.data || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch payroll cycles');
    } finally {
      setLoading(false);
    }
  };

  const fetchPayslips = async () => {
    try {
      const response = await payslipService.getAll({
        organizationId,
        page: '1',
        limit: '50',
      });
      setPayslips(response.data || []);
    } catch (err: any) {
      console.error('Failed to fetch payslips:', err);
      setError(err.response?.data?.message || 'Failed to fetch payslips');
    }
  };

  const fetchMyPayslips = async () => {
    try {
      setLoading(true);
      setError(null);
      if (user?.employee?.id) {
        const response = await payslipService.getByEmployeeId(user.employee.id, {
          page: '1',
          limit: '50',
        });
        setPayslips(response.data || []);
        setViewMode('payslips');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch payslips');
    } finally {
      setLoading(false);
    }
  };

  const handleProcessPayroll = async (cycleId: string) => {
    if (!confirm('Are you sure you want to process this payroll cycle? This will generate payslips for all employees.')) {
      return;
    }

    try {
      setProcessingCycle(cycleId);
      await payrollCycleService.processPayrollCycle(cycleId);
      alert('Payroll processed successfully!');
      fetchPayrollCycles();
      fetchPayslips();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to process payroll');
    } finally {
      setProcessingCycle(null);
    }
  };

  const handleFinalizePayroll = async (cycleId: string) => {
    if (!confirm('Are you sure you want to finalize this payroll cycle? This will lock it and prevent further modifications.')) {
      return;
    }

    try {
      await payrollCycleService.finalizePayrollCycle(cycleId);
      alert('Payroll cycle finalized successfully!');
      fetchPayrollCycles();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to finalize payroll');
    }
  };

  const handleRollbackPayroll = async (cycleId: string) => {
    if (!confirm('Are you sure you want to rollback this payroll cycle? This will unlock it and allow modifications.')) {
      return;
    }

    try {
      await payrollCycleService.rollbackPayrollCycle(cycleId);
      alert('Payroll cycle rolled back successfully!');
      fetchPayrollCycles();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to rollback payroll');
    }
  };

  const handleMarkAsPaid = async (cycleId: string) => {
    if (!confirm('Mark this payroll cycle as paid? This will update all payslips to PAID status.')) {
      return;
    }

    try {
      await payrollCycleService.markAsPaid(cycleId);
      alert('Payroll cycle marked as paid!');
      fetchPayrollCycles();
      fetchPayslips();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to mark as paid');
    }
  };

  const handleDeletePayroll = async (cycleId: string, cycleName: string) => {
    if (!confirm(`Are you sure you want to delete "${cycleName}"?\n\nThis will also delete all associated payslips. This action cannot be undone.`)) {
      return;
    }

    try {
      await payrollCycleService.delete(cycleId);
      alert('Payroll cycle deleted successfully!');
      fetchPayrollCycles();
      fetchPayslips();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete payroll cycle');
    }
  };

  const handleViewPayslip = async (payslip: Payslip) => {
    try {
      setSelectedPayslip(payslip);
      setShowPayslipDetail(true);
      setLoadingDetail(true);
      
      // Fetch comprehensive payslip details
      const comprehensive = await payslipService.getComprehensive(payslip.id);
      setPayslipDetail(comprehensive);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to load payslip details');
      setShowPayslipDetail(false);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCreateCycle = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!organizationId) {
      alert('Organization ID not found. Please refresh and try again.');
      return;
    }

    // Validate dates
    const periodStart = new Date(formData.periodStart);
    const periodEnd = new Date(formData.periodEnd);
    const paymentDate = new Date(formData.paymentDate);

    if (periodEnd <= periodStart) {
      alert('Period end date must be after period start date');
      return;
    }

    if (paymentDate <= periodEnd) {
      alert('Payment date should be after period end date');
      return;
    }

    try {
      setSubmitting(true);
      await payrollCycleService.create({
        organizationId,
        name: formData.name,
        periodStart: formData.periodStart,
        periodEnd: formData.periodEnd,
        paymentDate: formData.paymentDate,
        notes: formData.notes || undefined,
      });

      alert('Payroll cycle created successfully!');
      setShowCreateCycle(false);
      setFormData({
        name: '',
        periodStart: '',
        periodEnd: '',
        paymentDate: '',
        notes: '',
      });
      fetchPayrollCycles();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create payroll cycle');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return 'bg-gray-100 text-gray-800';
      case 'PROCESSING':
        return 'bg-yellow-100 text-yellow-800';
      case 'PROCESSED':
        return 'bg-blue-100 text-blue-800';
      case 'FINALIZED':
        return 'bg-purple-100 text-purple-800';
      case 'PAID':
        return 'bg-green-100 text-green-800';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (!canViewPayroll && !user?.employee?.id) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">You don't have permission to view payroll information.</p>
        </div>
      </div>
    );
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader
        title="Payroll Management"
        subtitle={organizationName ? `Organization: ${organizationName}` : undefined}
        onLogout={handleLogout}
      />

      {/* Main Content */}
      <div className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Manage payroll cycles and view payslips</h2>
        </div>

      {/* View Toggle */}
      {canViewPayroll && (
        <div className="mb-6 flex items-center space-x-4">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('cycles')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                viewMode === 'cycles'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              📅 Payroll Cycles
            </button>
            <button
              onClick={() => setViewMode('payslips')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                viewMode === 'payslips'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              💰 Payslips
            </button>
          </div>
          {canManagePayroll && viewMode === 'cycles' && (
            <button
              onClick={() => setShowCreateCycle(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              + Create Payroll Cycle
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      ) : viewMode === 'cycles' && canViewPayroll ? (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Payroll Cycles</h2>
          </div>
          {payrollCycles.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No payroll cycles found. {canManagePayroll && 'Create a new cycle to get started.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employees</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Net</th>
                    {canManagePayroll && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {payrollCycles.map((cycle) => (
                    <tr key={cycle.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {cycle.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(cycle.periodStart).toLocaleDateString()} - {new Date(cycle.periodEnd).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(cycle.paymentDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(cycle.status)}`}>
                          {cycle.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {cycle.totalEmployees || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {cycle.totalNet ? `$${Number(cycle.totalNet).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                      </td>
                      {canManagePayroll && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            {cycle.status === 'DRAFT' && (
                              <>
                                <button
                                  onClick={() => handleProcessPayroll(cycle.id)}
                                  disabled={processingCycle === cycle.id}
                                  className="text-blue-600 hover:text-blue-900 disabled:opacity-50"
                                >
                                  {processingCycle === cycle.id ? 'Processing...' : '⚙️ Process'}
                                </button>
                                <button
                                  onClick={() => handleDeletePayroll(cycle.id, cycle.name)}
                                  className="text-red-600 hover:text-red-900"
                                  title="Delete cycle (for testing)"
                                >
                                  🗑️ Delete
                                </button>
                              </>
                            )}
                            {cycle.status === 'PROCESSED' && (
                              <>
                                <button
                                  onClick={() => handleFinalizePayroll(cycle.id)}
                                  className="text-purple-600 hover:text-purple-900"
                                >
                                  🔒 Finalize
                                </button>
                                <button
                                  onClick={() => handleMarkAsPaid(cycle.id)}
                                  className="text-green-600 hover:text-green-900"
                                >
                                  ✅ Mark Paid
                                </button>
                                <button
                                  onClick={() => handleDeletePayroll(cycle.id, cycle.name)}
                                  className="text-red-600 hover:text-red-900"
                                  title="Delete cycle (for testing)"
                                >
                                  🗑️ Delete
                                </button>
                              </>
                            )}
                            {cycle.status === 'FINALIZED' && (
                              <>
                                <button
                                  onClick={() => handleRollbackPayroll(cycle.id)}
                                  className="text-orange-600 hover:text-orange-900"
                                >
                                  ↩️ Rollback
                                </button>
                                <button
                                  onClick={() => handleMarkAsPaid(cycle.id)}
                                  className="text-green-600 hover:text-green-900"
                                >
                                  ✅ Mark Paid
                                </button>
                              </>
                            )}
                            {cycle.status === 'PAID' && (
                              <button
                                onClick={() => handleDeletePayroll(cycle.id, cycle.name)}
                                className="text-red-600 hover:text-red-900"
                                title="Delete cycle (for testing)"
                              >
                                🗑️ Delete
                              </button>
                            )}
                            {cycle.status === 'PROCESSING' && (
                              <span className="text-gray-500 text-sm">Processing...</span>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              {canViewPayroll ? 'All Payslips' : 'My Payslips'}
            </h2>
          </div>
          {payslips.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No payslips found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gross Salary</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deductions</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Net Salary</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {payslips.map((payslip) => {
                    const employee = (payslip as any).employee;
                    return (
                    <tr key={payslip.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {employee?.firstName || ''} {employee?.lastName || ''}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(payslip.periodStart).toLocaleDateString()} - {new Date(payslip.periodEnd).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${Number(payslip.grossSalary).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${payslip.totalDeductions ? Number(payslip.totalDeductions).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        ${Number(payslip.netSalary).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(payslip.status)}`}>
                          {payslip.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleViewPayslip(payslip)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          👁️ View
                        </button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Create Payroll Cycle Modal */}
      {showCreateCycle && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Create Payroll Cycle</h2>
              <button
                onClick={() => {
                  setShowCreateCycle(false);
                  setFormData({
                    name: '',
                    periodStart: '',
                    periodEnd: '',
                    paymentDate: '',
                    notes: '',
                  });
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCycle} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Cycle Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., January 2026 Payroll"
                  className="w-full h-10 px-3 py-2 bg-white text-black border border-black rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="periodStart" className="block text-sm font-medium text-gray-700 mb-1">
                    Period Start <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    id="periodStart"
                    required
                    value={formData.periodStart}
                    onChange={(e) => setFormData({ ...formData, periodStart: e.target.value })}
                    className="w-full h-10 px-3 py-2 bg-white text-black border border-black rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="periodEnd" className="block text-sm font-medium text-gray-700 mb-1">
                    Period End <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    id="periodEnd"
                    required
                    value={formData.periodEnd}
                    onChange={(e) => setFormData({ ...formData, periodEnd: e.target.value })}
                    className="w-full h-10 px-3 py-2 bg-white text-black border border-black rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="paymentDate" className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  id="paymentDate"
                  required
                  value={formData.paymentDate}
                  onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
                  className="w-full h-10 px-3 py-2 bg-white text-black border border-black rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">Date when employees will receive payment</p>
              </div>

              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  id="notes"
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional notes about this payroll cycle..."
                  className="w-full h-10 px-3 py-2 bg-white text-black border border-black rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateCycle(false);
                    setFormData({
                      name: '',
                      periodStart: '',
                      periodEnd: '',
                      paymentDate: '',
                      notes: '',
                    });
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Creating...' : 'Create Cycle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payslip Detail Modal */}
      {showPayslipDetail && selectedPayslip && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Payslip Details</h3>
                <button
                  onClick={() => {
                    setShowPayslipDetail(false);
                    setSelectedPayslip(null);
                    setPayslipDetail(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              {loadingDetail ? (
                <div className="text-center py-8">Loading payslip details...</div>
              ) : payslipDetail ? (
                <div className="space-y-6">
                  {/* Employee Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Employee</p>
                      <p className="text-sm text-gray-900">
                        {payslipDetail.employee?.firstName || ''} {payslipDetail.employee?.lastName || ''}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Employee Code</p>
                      <p className="text-sm text-gray-900">{payslipDetail.employee?.employeeCode || ''}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Period</p>
                      <p className="text-sm text-gray-900">
                        {new Date(payslipDetail.periodStart).toLocaleDateString()} - {new Date(payslipDetail.periodEnd).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Payment Date</p>
                      <p className="text-sm text-gray-900">{new Date(payslipDetail.paymentDate).toLocaleDateString()}</p>
                    </div>
                  </div>

                  {/* Earnings Breakdown */}
                  {payslipDetail.earningsBreakdown && payslipDetail.earningsBreakdown.length > 0 && (
                    <div>
                      <h4 className="text-md font-semibold text-gray-900 mb-2">Earnings</h4>
                      <div className="border rounded-lg overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Component</th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {payslipDetail.earningsBreakdown.map((earning: any, idx: number) => (
                              <tr key={idx}>
                                <td className="px-4 py-2 text-sm text-gray-900">{earning.component}</td>
                                <td className="px-4 py-2 text-sm text-gray-900 text-right">
                                  ₹{Number(earning.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Deductions Breakdown */}
                  {payslipDetail.deductionsBreakdown && payslipDetail.deductionsBreakdown.length > 0 && (
                    <div>
                      <h4 className="text-md font-semibold text-gray-900 mb-2">Deductions</h4>
                      <div className="border rounded-lg overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Component</th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {payslipDetail.deductionsBreakdown.map((deduction: any, idx: number) => (
                              <tr key={idx}>
                                <td className="px-4 py-2 text-sm text-gray-900">{deduction.component}</td>
                                <td className="px-4 py-2 text-sm text-gray-900 text-right">
                                  ₹{Number(deduction.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Summary */}
                  <div className="border-t pt-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-700">Gross Salary:</span>
                        <span className="text-sm font-semibold text-gray-900">
                          ₹{Number(payslipDetail.grossSalary || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-700">Total Deductions:</span>
                        <span className="text-sm font-semibold text-gray-900">
                          ₹{Number(payslipDetail.totalDeductions || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span className="text-sm font-bold text-gray-900">Net Salary:</span>
                        <span className="text-sm font-bold text-gray-900">
                          ₹{Number(payslipDetail.netSalary || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Attendance Info */}
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="font-medium text-gray-500">Paid Days</p>
                      <p className="text-gray-900">{payslipDetail.paidDays ?? ''}</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-500">Unpaid Days</p>
                      <p className="text-gray-900">{payslipDetail.unpaidDays ?? ''}</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-500">Overtime Hours</p>
                      <p className="text-gray-900">{payslipDetail.overtimeHours || '0'}</p>
                    </div>
                  </div>

                  {/* Bank Details */}
                  {payslipDetail.bankDetails && (
                    <div className="border-t pt-4">
                      <h4 className="text-md font-semibold text-gray-900 mb-2">Bank Details</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="font-medium text-gray-500">Bank Name</p>
                          <p className="text-gray-900">{payslipDetail.bankDetails.bankName}</p>
                        </div>
                        <div>
                          <p className="font-medium text-gray-500">Account Number</p>
                          <p className="text-gray-900">{payslipDetail.bankDetails.accountNumber}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">No payslip details available</div>
              )}

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => {
                    setShowPayslipDetail(false);
                    setSelectedPayslip(null);
                    setPayslipDetail(null);
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default PayrollPage;
