import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppHeader from '../components/layout/AppHeader';
import { useAuthStore } from '../store/authStore';
import { payslipService } from '../services/payroll.service';

const fmt = (v: number | string | undefined | null) =>
  '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const PayslipPage = () => {
  const navigate = useNavigate();
  const { payslipId } = useParams<{ payslipId: string }>();
  const { user, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;
  const printRef = useRef<HTMLDivElement>(null);

  const [payslipDetail, setPayslipDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (payslipId) fetchPayslip();
  }, [payslipId]);

  const fetchPayslip = async () => {
    try {
      setLoading(true);
      setError(null);
      const detail = await payslipService.getComprehensive(payslipId!);
      setPayslipDetail(detail);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load payslip');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async () => {
    try {
      setDownloading(true);
      const blob = await payslipService.downloadPayslipPDF(payslipId!);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payslip-${payslipId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // If PDF endpoint not available, fallback to print
      alert('PDF generation: use the Print button to save as PDF.');
    } finally {
      setDownloading(false);
    }
  };

  const handleSendEmail = async () => {
    if (!confirm('Send this payslip to the employee email?')) return;
    try {
      setSending(true);
      await payslipService.sendPayslip(payslipId!);
      alert('Payslip sent to employee email successfully!');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to send payslip');
    } finally {
      setSending(false);
    }
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  // Computed data
  const employee = payslipDetail?.employee || {};
  const empName = `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || 'Employee';
  const empCode = employee.employeeCode || '';

  const statutory = payslipDetail?.statutoryDeductions as any || {};
  const pfAmount = Number(statutory?.pf || statutory?.employeePF || 0);
  const employerPF = Number(statutory?.employerPF || 0);
  const esicAmount = Number(statutory?.esic || statutory?.employeeESIC || 0);
  const ptAmount = Number(statutory?.professionalTax || statutory?.pt || 0);
  const tdsAmount = Number(payslipDetail?.taxDetails?.incomeTax || statutory?.tds || 0);

  const earningsBreakdown: Array<{ component: string; amount: number; isTaxable?: boolean }> =
    payslipDetail?.earningsBreakdown || payslipDetail?.earnings || [];
  const deductionsBreakdown: Array<{ component: string; amount: number; isStatutory?: boolean }> =
    payslipDetail?.deductionsBreakdown || payslipDetail?.deductions || [];

  const ytd = payslipDetail?.ytdTotals;

  const periodStr = payslipDetail
    ? new Date(payslipDetail.periodStart).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    : '';

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      {/* Hide header on print */}
      <div className="print:hidden">
        <AppHeader
          title="Payslip"
          subtitle={organizationName ? `Organization: ${organizationName}` : undefined}
          onLogout={handleLogout}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        {/* Action bar (hidden on print) */}
        <div className="print:hidden mb-5 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 font-medium"
            >
              ← Back
            </button>
            <span className="text-gray-300">|</span>
            <h2 className="text-xl font-semibold text-gray-900">
              {empName && empCode ? `${empName} — ${periodStr}` : periodStr || 'Payslip'}
            </h2>
          </div>
          {!loading && !error && payslipDetail && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition flex items-center gap-2"
              >
                🖨 Print
              </button>
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition flex items-center gap-2"
              >
                {downloading ? 'Downloading...' : '⬇ Download PDF'}
              </button>
              <button
                onClick={handleSendEmail}
                disabled={sending}
                className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 transition flex items-center gap-2"
              >
                {sending ? 'Sending...' : '✉ Send to Employee'}
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="print:hidden mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="print:hidden text-center py-16">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            <p className="mt-3 text-gray-500 text-sm">Loading payslip...</p>
          </div>
        ) : !payslipDetail ? (
          <div className="print:hidden bg-white rounded-xl p-12 text-center text-gray-400 text-sm">
            Payslip not found.
          </div>
        ) : (
          /* ─── PAYSLIP TEMPLATE ─── */
          <div
            ref={printRef}
            className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden print:shadow-none print:border-none print:rounded-none print:max-w-none"
          >
            {/* Company Header */}
            <div className="bg-gradient-to-r from-blue-700 to-blue-900 text-white px-8 py-6">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-xl font-bold tracking-wide">
                    {organizationName || 'HRMS Organization'}
                  </h1>
                  <p className="text-blue-200 text-sm mt-0.5">Salary Slip</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold">{periodStr}</p>
                  <p className="text-blue-200 text-xs mt-0.5">
                    Payment: {payslipDetail.paymentDate
                      ? new Date(payslipDetail.paymentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                      : '—'}
                  </p>
                </div>
              </div>
            </div>

            {/* Employee Details */}
            <div className="px-8 py-5 border-b border-gray-100 grid grid-cols-2 sm:grid-cols-3 gap-5">
              {[
                { label: 'Employee Name', value: empName },
                { label: 'Employee Code', value: empCode || '—' },
                { label: 'Email', value: employee.email || '—' },
                {
                  label: 'Pay Period',
                  value: `${new Date(payslipDetail.periodStart).toLocaleDateString('en-IN')} – ${new Date(payslipDetail.periodEnd).toLocaleDateString('en-IN')}`
                },
                { label: 'Working Days', value: payslipDetail.attendanceDays ?? '—' },
                { label: 'Paid Days', value: payslipDetail.paidDays ?? '—' },
              ].map(item => (
                <div key={item.label}>
                  <p className="text-xs text-gray-400 font-medium">{item.label}</p>
                  <p className="text-sm text-gray-800 font-semibold mt-0.5">{item.value}</p>
                </div>
              ))}
            </div>

            {/* Earnings & Deductions Table */}
            <div className="px-8 py-5">
              <div className="grid grid-cols-2 gap-6">
                {/* Earnings */}
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Earnings</p>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="py-1.5 text-left text-xs text-gray-500 font-medium">Component</th>
                        <th className="py-1.5 text-right text-xs text-gray-500 font-medium">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {earningsBreakdown.length > 0 ? (
                        earningsBreakdown.map((e, idx) => (
                          <tr key={idx} className="border-b border-gray-50">
                            <td className="py-2 text-gray-700">{e.component}</td>
                            <td className="py-2 text-right text-gray-800 font-medium">{fmt(e.amount)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr className="border-b border-gray-50">
                          <td className="py-2 text-gray-700">Basic Salary</td>
                          <td className="py-2 text-right text-gray-800 font-medium">{fmt(payslipDetail.basicSalary)}</td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-green-200 bg-green-50">
                        <td className="py-2.5 text-sm font-bold text-green-700">Gross Salary</td>
                        <td className="py-2.5 text-right text-sm font-bold text-green-700">{fmt(payslipDetail.grossSalary)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Deductions */}
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Deductions</p>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="py-1.5 text-left text-xs text-gray-500 font-medium">Component</th>
                        <th className="py-1.5 text-right text-xs text-gray-500 font-medium">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pfAmount > 0 && (
                        <tr className="border-b border-gray-50">
                          <td className="py-2 text-gray-700">Provident Fund (PF)</td>
                          <td className="py-2 text-right text-gray-800 font-medium">{fmt(pfAmount)}</td>
                        </tr>
                      )}
                      {esicAmount > 0 && (
                        <tr className="border-b border-gray-50">
                          <td className="py-2 text-gray-700">ESIC</td>
                          <td className="py-2 text-right text-gray-800 font-medium">{fmt(esicAmount)}</td>
                        </tr>
                      )}
                      {ptAmount > 0 && (
                        <tr className="border-b border-gray-50">
                          <td className="py-2 text-gray-700">Professional Tax (PT)</td>
                          <td className="py-2 text-right text-gray-800 font-medium">{fmt(ptAmount)}</td>
                        </tr>
                      )}
                      {tdsAmount > 0 && (
                        <tr className="border-b border-gray-50">
                          <td className="py-2 text-gray-700">TDS / Income Tax</td>
                          <td className="py-2 text-right text-gray-800 font-medium">{fmt(tdsAmount)}</td>
                        </tr>
                      )}
                      {deductionsBreakdown.filter(d => !d.isStatutory).map((d, idx) => (
                        <tr key={idx} className="border-b border-gray-50">
                          <td className="py-2 text-gray-700">{d.component}</td>
                          <td className="py-2 text-right text-gray-800 font-medium">{fmt(d.amount)}</td>
                        </tr>
                      ))}
                      {pfAmount === 0 && esicAmount === 0 && ptAmount === 0 && tdsAmount === 0 && deductionsBreakdown.length === 0 && (
                        <tr>
                          <td colSpan={2} className="py-4 text-center text-gray-400 text-xs">No deductions</td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-red-200 bg-red-50">
                        <td className="py-2.5 text-sm font-bold text-red-700">Total Deductions</td>
                        <td className="py-2.5 text-right text-sm font-bold text-red-700">{fmt(payslipDetail.totalDeductions)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>

            {/* Net Salary */}
            <div className="mx-8 mb-5 bg-gradient-to-r from-blue-600 to-blue-800 rounded-xl px-6 py-4 flex items-center justify-between">
              <p className="text-white text-sm font-medium">Net Salary (Take Home)</p>
              <p className="text-white text-2xl font-bold">{fmt(payslipDetail.netSalary)}</p>
            </div>

            {/* Statutory Employer Contribution */}
            {employerPF > 0 && (
              <div className="px-8 mb-5">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Employer Contributions</p>
                <div className="bg-gray-50 rounded-lg px-4 py-3 flex items-center justify-between text-sm">
                  <span className="text-gray-600">Employer PF (3.67% EPF + 8.33% EPS)</span>
                  <span className="text-gray-800 font-medium">{fmt(employerPF)}</span>
                </div>
              </div>
            )}

            {/* Attendance */}
            <div className="px-8 mb-5">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Attendance Summary</p>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Attendance Days', val: payslipDetail.attendanceDays ?? '—' },
                  { label: 'Paid Days', val: payslipDetail.paidDays ?? '—' },
                  { label: 'LWP Days', val: payslipDetail.unpaidDays ?? 0 },
                  { label: 'Overtime Hrs', val: payslipDetail.overtimeHours ?? 0 },
                ].map(item => (
                  <div key={item.label} className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-base font-bold text-gray-800">{item.val}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* YTD */}
            {ytd && (
              <div className="px-8 mb-5">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Year-to-Date (YTD)</p>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: 'YTD Gross', val: ytd.ytdGrossSalary },
                    { label: 'YTD Deductions', val: ytd.ytdDeductions },
                    { label: 'YTD Net', val: ytd.ytdNetSalary },
                    { label: 'YTD TDS', val: ytd.ytdTaxPaid },
                  ].map(item => (
                    <div key={item.label} className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-sm font-bold text-gray-800">
                        ₹{Number(item.val || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bank Details */}
            {payslipDetail.bankDetails && (
              <div className="px-8 mb-5">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Bank Details</p>
                <div className="bg-gray-50 rounded-lg px-5 py-3 grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400 text-xs">Bank Name</p>
                    <p className="text-gray-800 font-medium">{payslipDetail.bankDetails.bankName}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">Account Number</p>
                    <p className="text-gray-800 font-medium">****{payslipDetail.bankDetails.accountNumber?.slice(-4)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">Account Type</p>
                    <p className="text-gray-800 font-medium">{payslipDetail.bankDetails.accountType}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="px-8 py-4 border-t border-gray-100 bg-gray-50">
              <p className="text-xs text-gray-400 text-center">
                This is a computer generated payslip and does not require a physical signature.
                {' '}Generated by HRMS System.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #payslip-print, #payslip-print * { visibility: visible; }
          #payslip-print { position: absolute; left: 0; top: 0; width: 100%; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
};

export default PayslipPage;
