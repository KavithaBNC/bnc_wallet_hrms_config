import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppHeader from '../components/layout/AppHeader';
import { useAuthStore } from '../store/authStore';
import { payslipService, Payslip } from '../services/payroll.service';

const fmt = (v: number | string | undefined | null) =>
  '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const getStatusColor = (status: string) => {
  switch (status) {
    case 'DRAFT': return 'bg-gray-100 text-gray-700';
    case 'GENERATED': case 'PROCESSED': return 'bg-blue-100 text-blue-700';
    case 'SENT': return 'bg-yellow-100 text-yellow-700';
    case 'PAID': return 'bg-green-100 text-green-700';
    case 'HOLD': return 'bg-red-100 text-red-700';
    default: return 'bg-gray-100 text-gray-700';
  }
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const EmployeePayrollDetailsPage = () => {
  const navigate = useNavigate();
  const { employeeId } = useParams<{ employeeId: string }>();
  const { user, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;

  const isHRManager = user?.role === 'HR_MANAGER';
  const isOrgAdmin = user?.role === 'ORG_ADMIN';
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const _canViewAll = isHRManager || isOrgAdmin || isSuperAdmin; void _canViewAll;

  // Use logged-in employee's id if no param (self-service)
  const targetEmployeeId = employeeId || user?.employee?.id;

  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);
  const [payslipDetail, setPayslipDetail] = useState<any>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // PDF state
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    if (targetEmployeeId) fetchPayslips();
  }, [targetEmployeeId]);

  const fetchPayslips = async () => {
    try {
      setLoadingList(true);
      setError(null);
      const res = await payslipService.getByEmployeeId(targetEmployeeId!, { page: '1', limit: '24' });
      const list = res.data || [];
      setPayslips(list);
      if (list.length > 0) loadDetail(list[0]);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load payslips');
    } finally {
      setLoadingList(false);
    }
  };

  const loadDetail = async (payslip: Payslip) => {
    try {
      setSelectedPayslip(payslip);
      setLoadingDetail(true);
      setPayslipDetail(null);
      const detail = await payslipService.getComprehensive(payslip.id);
      setPayslipDetail(detail);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load payslip details');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleDownloadPdf = async (payslipId: string) => {
    try {
      setDownloadingPdf(true);
      const blob = await payslipService.downloadPayslipPDF(payslipId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payslip-${payslipId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to download PDF');
    } finally {
      setDownloadingPdf(false);
    }
  };


  const handleLogout = () => { logout(); navigate('/login'); };

  // Derive employee info from payslips
  const employeeInfo = payslipDetail?.employee || selectedPayslip?.employee || null;
  const employeeName = employeeInfo ? `${employeeInfo.firstName} ${employeeInfo.lastName}` : 'Employee';
  const employeeCode = employeeInfo?.employeeCode || '';

  // YTD from detail
  const ytd = payslipDetail?.ytdTotals;

  // Earnings breakdown
  const earningsBreakdown: Array<{ component: string; amount: number }> = payslipDetail?.earningsBreakdown || [];
  const deductionsBreakdown: Array<{ component: string; amount: number; isStatutory?: boolean }> = payslipDetail?.deductionsBreakdown || [];

  // Statutory deductions (PF, ESI, PT, TDS)
  const statutory = payslipDetail?.statutoryDeductions as any || {};
  const pfAmount = Number(statutory?.pf || statutory?.employeePF || 0);
  const esicAmount = Number(statutory?.esic || statutory?.employeeESIC || 0);
  const ptAmount = Number(statutory?.professionalTax || statutory?.pt || 0);
  const tdsAmount = Number(payslipDetail?.taxDetails?.incomeTax || statutory?.tds || 0);

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader
        title={`Payroll Details${employeeCode ? ` — ${employeeCode}` : ''}`}
        subtitle={organizationName ? `Organization: ${organizationName}` : undefined}
        onLogout={handleLogout}
      />

      <div className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        {/* Back button */}
        <div className="mb-5 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 font-medium"
          >
            ← Back
          </button>
          <span className="text-gray-300">|</span>
          <h2 className="text-xl font-semibold text-gray-900">
            {employeeName}
            {employeeCode && <span className="ml-2 text-sm font-normal text-gray-400">({employeeCode})</span>}
          </h2>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {loadingList ? (
          <div className="text-center py-16">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            <p className="mt-3 text-gray-500 text-sm">Loading payslips...</p>
          </div>
        ) : payslips.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <p className="text-gray-400 text-sm">No payslips found for this employee.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
            {/* Left: Month selector list */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Payslip History</p>
                </div>
                <div className="max-h-[520px] overflow-y-auto">
                  {payslips.map((ps) => {
                    const d = new Date(ps.periodStart);
                    const isSelected = selectedPayslip?.id === ps.id;
                    return (
                      <button
                        key={ps.id}
                        onClick={() => loadDetail(ps)}
                        className={`w-full text-left px-4 py-3 border-b border-gray-50 transition ${
                          isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'hover:bg-gray-50 border-l-4 border-l-transparent'
                        }`}
                      >
                        <p className={`text-sm font-semibold ${isSelected ? 'text-blue-700' : 'text-gray-800'}`}>
                          {MONTHS[d.getMonth()]} {d.getFullYear()}
                        </p>
                        <div className="flex items-center justify-between mt-0.5">
                          <p className="text-xs text-gray-500">
                            ₹{Number(ps.netSalary).toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                          </p>
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${getStatusColor(ps.status)}`}>
                            {ps.status}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right: Payslip detail */}
            <div className="lg:col-span-3 space-y-4">
              {loadingDetail ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                  <p className="mt-3 text-gray-500 text-sm">Loading details...</p>
                </div>
              ) : selectedPayslip && payslipDetail ? (
                <>
                  {/* Period header */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div>
                        <p className="text-base font-semibold text-gray-900">
                          {new Date(selectedPayslip.periodStart).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })} Payslip
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Period: {new Date(selectedPayslip.periodStart).toLocaleDateString('en-IN')}
                          {' – '}
                          {new Date(selectedPayslip.periodEnd).toLocaleDateString('en-IN')}
                          {' · '}
                          Payment: {new Date(selectedPayslip.paymentDate).toLocaleDateString('en-IN')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusColor(selectedPayslip.status)}`}>
                          {selectedPayslip.status}
                        </span>
                        <button
                          onClick={() => navigate(`/payroll/payslip/${selectedPayslip.id}`)}
                          className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                        >
                          👁 View Full Payslip
                        </button>
                        <button
                          onClick={() => handleDownloadPdf(selectedPayslip.id)}
                          disabled={downloadingPdf}
                          className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
                        >
                          {downloadingPdf ? 'Downloading...' : '⬇ Download PDF'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Attendance strip */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-5 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                      { label: 'Attendance Days', value: payslipDetail.attendanceDays ?? '—' },
                      { label: 'Paid Days', value: payslipDetail.paidDays ?? '—' },
                      { label: 'Unpaid Days (LWP)', value: payslipDetail.unpaidDays ?? '—' },
                      { label: 'Overtime Hours', value: payslipDetail.overtimeHours ?? '0' },
                    ].map(item => (
                      <div key={item.label} className="text-center">
                        <p className="text-lg font-bold text-gray-800">{item.value}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{item.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Earnings & Deductions */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Earnings */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                      <div className="px-5 py-3 bg-green-50 border-b border-green-100">
                        <p className="text-sm font-semibold text-green-700">Earnings</p>
                      </div>
                      <div className="divide-y divide-gray-50">
                        {earningsBreakdown.length > 0 ? (
                          earningsBreakdown.map((e, idx) => (
                            <div key={idx} className="flex justify-between items-center px-5 py-2.5">
                              <span className="text-sm text-gray-700">{e.component}</span>
                              <span className="text-sm font-medium text-gray-900">{fmt(e.amount)}</span>
                            </div>
                          ))
                        ) : (
                          payslipDetail.earnings?.map((e: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center px-5 py-2.5">
                              <span className="text-sm text-gray-700">{e.component}</span>
                              <span className="text-sm font-medium text-gray-900">{fmt(e.amount)}</span>
                            </div>
                          ))
                        )}
                      </div>
                      <div className="flex justify-between items-center px-5 py-3 bg-green-50 border-t border-green-100">
                        <span className="text-sm font-semibold text-green-700">Gross Salary</span>
                        <span className="text-sm font-bold text-green-700">{fmt(payslipDetail.grossSalary)}</span>
                      </div>
                    </div>

                    {/* Deductions */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                      <div className="px-5 py-3 bg-red-50 border-b border-red-100">
                        <p className="text-sm font-semibold text-red-700">Deductions</p>
                      </div>
                      <div className="divide-y divide-gray-50">
                        {/* Statutory deductions */}
                        {pfAmount > 0 && (
                          <div className="flex justify-between items-center px-5 py-2.5">
                            <span className="text-sm text-gray-700">Provident Fund (PF)</span>
                            <span className="text-sm font-medium text-gray-900">{fmt(pfAmount)}</span>
                          </div>
                        )}
                        {esicAmount > 0 && (
                          <div className="flex justify-between items-center px-5 py-2.5">
                            <span className="text-sm text-gray-700">ESIC</span>
                            <span className="text-sm font-medium text-gray-900">{fmt(esicAmount)}</span>
                          </div>
                        )}
                        {ptAmount > 0 && (
                          <div className="flex justify-between items-center px-5 py-2.5">
                            <span className="text-sm text-gray-700">Professional Tax</span>
                            <span className="text-sm font-medium text-gray-900">{fmt(ptAmount)}</span>
                          </div>
                        )}
                        {tdsAmount > 0 && (
                          <div className="flex justify-between items-center px-5 py-2.5">
                            <span className="text-sm text-gray-700">TDS (Income Tax)</span>
                            <span className="text-sm font-medium text-gray-900">{fmt(tdsAmount)}</span>
                          </div>
                        )}
                        {/* Other deductions from breakdown */}
                        {deductionsBreakdown.filter(d => !d.isStatutory).map((d, idx) => (
                          <div key={idx} className="flex justify-between items-center px-5 py-2.5">
                            <span className="text-sm text-gray-700">{d.component}</span>
                            <span className="text-sm font-medium text-gray-900">{fmt(d.amount)}</span>
                          </div>
                        ))}
                        {pfAmount === 0 && esicAmount === 0 && ptAmount === 0 && tdsAmount === 0 && deductionsBreakdown.length === 0 && (
                          <div className="px-5 py-4 text-sm text-gray-400">No deductions</div>
                        )}
                      </div>
                      <div className="flex justify-between items-center px-5 py-3 bg-red-50 border-t border-red-100">
                        <span className="text-sm font-semibold text-red-700">Total Deductions</span>
                        <span className="text-sm font-bold text-red-700">{fmt(payslipDetail.totalDeductions)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Net Salary */}
                  <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-5 flex items-center justify-between">
                    <div>
                      <p className="text-blue-100 text-sm">Net Salary</p>
                      <p className="text-white text-2xl font-bold mt-0.5">{fmt(payslipDetail.netSalary)}</p>
                    </div>
                    {payslipDetail.bankDetails && (
                      <div className="text-right">
                        <p className="text-blue-200 text-xs">Bank Transfer</p>
                        <p className="text-white text-sm font-medium">{payslipDetail.bankDetails.bankName}</p>
                        <p className="text-blue-200 text-xs">****{payslipDetail.bankDetails.accountNumber?.slice(-4)}</p>
                      </div>
                    )}
                  </div>

                  {/* YTD Summary */}
                  {ytd && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                      <p className="text-sm font-semibold text-gray-700 mb-3">Year-to-Date Summary</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {[
                          { label: 'YTD Gross', value: ytd.ytdGrossSalary, color: 'text-blue-600' },
                          { label: 'YTD Deductions', value: ytd.ytdDeductions, color: 'text-red-600' },
                          { label: 'YTD Net', value: ytd.ytdNetSalary, color: 'text-green-600' },
                          { label: 'YTD Tax', value: ytd.ytdTaxPaid, color: 'text-purple-600' },
                        ].map(item => (
                          <div key={item.label} className="text-center p-3 bg-gray-50 rounded-lg">
                            <p className={`text-base font-bold ${item.color}`}>
                              ₹{Number(item.value || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">{item.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                  <p className="text-gray-400 text-sm">Select a month from the list to view details.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeePayrollDetailsPage;
