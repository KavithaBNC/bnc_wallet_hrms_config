import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AppHeader from '../components/layout/AppHeader';
import { useAuthStore } from '../store/authStore';
import postToPayrollService from '../services/postToPayroll.service';

type VariableInputRow = {
  id: string;
  associateCode: string;
  associateName: string;
  compensationSalary: number;
  lossOfPay: number;
  vehicleAllowance: number;
  nfh: number;
  weekOff: number;
  otHours: number;
  otherEarnings: number;
  incentive: number;
  normalTax: number;
  salaryAdvance: number;
  otherDeductions: number;
  ptax: number;
};

export default function VariableInputEntryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();

  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id;
  const { paygroupId, paygroupName, month, year } =
    (location.state as {
      paygroupId?: string;
      paygroupName?: string;
      month?: string;
      year?: string;
    } | null) ?? {};

  const organizationName = user?.employee?.organization?.name;

  const [rows, setRows] = useState<VariableInputRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const loadRows = useCallback(async () => {
    if (!organizationId || !paygroupId || !month || !year) return;
    setLoading(true);
    setLoadError(null);
    try {
      const apiRows = await postToPayrollService.getVariableInputEntry(
        organizationId,
        paygroupId,
        parseInt(year, 10),
        parseInt(month, 10)
      );
      const mapped: VariableInputRow[] = apiRows.map((r) => ({
        id: r.employeeId,
        associateCode: r.associateCode,
        associateName: r.associateName,
        compensationSalary: r.compensationSalary,
        lossOfPay: r.lossOfPay,
        vehicleAllowance: r.vehicleAllowance,
        nfh: r.nfh,
        weekOff: r.weekOff,
        otHours: r.otHours,
        otherEarnings: r.otherEarnings,
        incentive: r.incentive,
        normalTax: r.normalTax,
        salaryAdvance: r.salaryAdvance,
        otherDeductions: r.otherDeductions,
        ptax: r.ptax,
      }));
      setRows(mapped);
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : 'Failed to load variable input data';
      setLoadError(String(msg));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [organizationId, paygroupId, month, year]);

  useEffect(() => {
    if (!paygroupName || !month || !year || !paygroupId) {
      navigate('/core-hr/variable-input', { replace: true });
      return;
    }
    loadRows();
  }, [paygroupId, paygroupName, month, year, navigate, loadRows]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleChangeCell = (id: string, field: keyof VariableInputRow, value: string) => {
    const numeric = Number(value.replace(/,/g, ''));
    if (Number.isNaN(numeric)) return;
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, [field]: numeric } : row)));
  };

  const handleCancel = () => {
    navigate('/core-hr/variable-input');
  };

  const handleSave = async () => {
    if (!organizationId || !paygroupId || !month || !year) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);
    try {
      await postToPayrollService.saveVariableInputEntry(
        organizationId,
        paygroupId,
        parseInt(year, 10),
        parseInt(month, 10),
        rows.map((r) => ({
          employeeId: r.id,
          compensationSalary: r.compensationSalary,
          lossOfPay: r.lossOfPay,
          vehicleAllowance: r.vehicleAllowance,
          nfh: r.nfh,
          weekOff: r.weekOff,
          otHours: r.otHours,
          otherEarnings: r.otherEarnings,
          incentive: r.incentive,
          normalTax: r.normalTax,
          salaryAdvance: r.salaryAdvance,
          otherDeductions: r.otherDeductions,
          ptax: r.ptax,
        }))
      );
      setSaveSuccess('Variable input saved successfully.');
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : 'Failed to save variable input. Please try again.';
      setSaveError(String(msg));
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-gray-100 items-center justify-center p-8">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
        <AppHeader
          title="Variable Input"
          subtitle={organizationName ? `Organization: ${organizationName}` : undefined}
          onLogout={handleLogout}
        />
        <main className="flex-1 flex items-center justify-center p-8">
          <p className="text-gray-600">Loading variable input data...</p>
        </main>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
        <AppHeader
          title="Variable Input"
          subtitle={organizationName ? `Organization: ${organizationName}` : undefined}
          onLogout={handleLogout}
        />
        <main className="flex-1 flex flex-col items-center justify-center p-8 gap-4">
          <p className="text-red-600">{loadError}</p>
          <p className="text-sm text-gray-600">
            Ensure the month is posted from HR Activities → Post to Payroll and that the paygroup has employees with
            attendance summary for the selected month.
          </p>
          <button
            type="button"
            onClick={() => navigate('/core-hr/variable-input')}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Back to Variable Input
          </button>
        </main>
      </div>
    );
  }

  const monthLabel = month ?? '';

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader
        title="Variable Input"
        subtitle={
          organizationName
            ? `Organization: ${organizationName} – ${paygroupName ?? ''} [${monthLabel} ${year ?? ''}]`
            : `${paygroupName ?? ''} [${monthLabel} ${year ?? ''}]`
        }
        onLogout={handleLogout}
      />

      <main className="flex-1 min-h-0 overflow-y-auto w-full px-4 sm:px-6 lg:px-8 py-6 bg-gray-50">
        <div className="w-full">
          {/* Breadcrumbs */}
          <div className="mb-6">
            <nav className="flex items-center text-sm text-gray-600" aria-label="Breadcrumb">
              <Link to="/core-hr" className="text-gray-500 hover:text-gray-900">
                Core HR
              </Link>
              <span className="mx-1 text-gray-400">/</span>
              <Link to="/core-hr/variable-input" className="text-gray-500 hover:text-gray-900">
                Variable Input
              </Link>
              <span className="mx-1 text-gray-400">/</span>
              <span className="font-semibold text-gray-900">Entry</span>
            </nav>
          </div>

          <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
            {/* Title */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Variable Input [{monthLabel} {year}]
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  Enter variable earnings and deductions for each associate.
                </p>
              </div>
            </div>

            {/* Grid */}
            <div className="px-4 pb-4 pt-4">
              <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="bg-blue-600 text-white">
                      <th className="px-3 py-2 text-left font-semibold">Associate Code</th>
                      <th className="px-3 py-2 text-left font-semibold">Associate Name</th>
                      <th className="px-3 py-2 text-right font-semibold bg-teal-100/40 text-black">
                        Compensation Salary
                      </th>
                      <th className="px-3 py-2 text-right font-semibold bg-teal-100/40 text-black">
                        Loss of Pay
                      </th>
                      <th className="px-3 py-2 text-right font-semibold bg-teal-100/40 text-black">
                        Vehicle Allowance
                      </th>
                      <th className="px-3 py-2 text-right font-semibold bg-teal-100/40 text-black">
                        NFH
                      </th>
                      <th className="px-3 py-2 text-right font-semibold bg-teal-100/40 text-black">
                        WeekOff
                      </th>
                      <th className="px-3 py-2 text-right font-semibold bg-teal-100/40 text-black">
                        OT Hours
                      </th>
                      <th className="px-3 py-2 text-right font-semibold bg-teal-100/40 text-black">
                        Other Earnings
                      </th>
                      <th className="px-3 py-2 text-right font-semibold bg-teal-100/40 text-black">
                        Incentive
                      </th>
                      <th className="px-3 py-2 text-right font-semibold bg-rose-100/40 text-black">
                        Normal Tax
                      </th>
                      <th className="px-3 py-2 text-right font-semibold bg-rose-100/40 text-black">
                        Salary Advance
                      </th>
                      <th className="px-3 py-2 text-right font-semibold bg-rose-100/40 text-black">
                        Other Deductions
                      </th>
                      <th className="px-3 py-2 text-right font-semibold bg-rose-100/40 text-black">
                        PTAX
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} className="border-t border-gray-200 hover:bg-gray-50">
                        <td className="px-3 py-2 text-sm text-gray-900 font-medium whitespace-nowrap">
                          {row.associateCode}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                          {row.associateName}
                        </td>
                        <td className="px-3 py-1 text-right bg-teal-50">
                          <input
                            type="number"
                            className="w-24 text-right border-gray-300 rounded-md text-xs px-2 py-1 focus:border-indigo-500 focus:ring-indigo-500"
                            value={row.compensationSalary}
                            onChange={(e) =>
                              handleChangeCell(row.id, 'compensationSalary', e.target.value)
                            }
                          />
                        </td>
                        <td className="px-3 py-1 text-right bg-teal-50">
                          <input
                            type="number"
                            className="w-20 text-right border-gray-300 rounded-md text-xs px-2 py-1 focus:border-indigo-500 focus:ring-indigo-500"
                            value={row.lossOfPay}
                            onChange={(e) => handleChangeCell(row.id, 'lossOfPay', e.target.value)}
                          />
                        </td>
                        <td className="px-3 py-1 text-right bg-teal-50">
                          <input
                            type="number"
                            className="w-20 text-right border-gray-300 rounded-md text-xs px-2 py-1 focus:border-indigo-500 focus:ring-indigo-500"
                            value={row.vehicleAllowance}
                            onChange={(e) => handleChangeCell(row.id, 'vehicleAllowance', e.target.value)}
                          />
                        </td>
                        <td className="px-3 py-1 text-right bg-teal-50">
                          <input
                            type="number"
                            className="w-16 text-right border-gray-300 rounded-md text-xs px-2 py-1 focus:border-indigo-500 focus:ring-indigo-500"
                            value={row.nfh}
                            onChange={(e) => handleChangeCell(row.id, 'nfh', e.target.value)}
                          />
                        </td>
                        <td className="px-3 py-1 text-right bg-teal-50">
                          <input
                            type="number"
                            className="w-16 text-right border-gray-300 rounded-md text-xs px-2 py-1 focus:border-indigo-500 focus:ring-indigo-500"
                            value={row.weekOff}
                            onChange={(e) => handleChangeCell(row.id, 'weekOff', e.target.value)}
                          />
                        </td>
                        <td className="px-3 py-1 text-right bg-teal-50">
                          <input
                            type="number"
                            className="w-20 text-right border-gray-300 rounded-md text-xs px-2 py-1 focus:border-indigo-500 focus:ring-indigo-500"
                            value={row.otHours}
                            onChange={(e) => handleChangeCell(row.id, 'otHours', e.target.value)}
                          />
                        </td>
                        <td className="px-3 py-1 text-right bg-teal-50">
                          <input
                            type="number"
                            className="w-24 text-right border-gray-300 rounded-md text-xs px-2 py-1 focus:border-indigo-500 focus:ring-indigo-500"
                            value={row.otherEarnings}
                            onChange={(e) => handleChangeCell(row.id, 'otherEarnings', e.target.value)}
                          />
                        </td>
                        <td className="px-3 py-1 text-right bg-teal-50">
                          <input
                            type="number"
                            className="w-24 text-right border-gray-300 rounded-md text-xs px-2 py-1 focus:border-indigo-500 focus:ring-indigo-500"
                            value={row.incentive}
                            onChange={(e) => handleChangeCell(row.id, 'incentive', e.target.value)}
                          />
                        </td>
                        <td className="px-3 py-1 text-right bg-rose-50">
                          <input
                            type="number"
                            className="w-24 text-right border-gray-300 rounded-md text-xs px-2 py-1 focus:border-indigo-500 focus:ring-indigo-500"
                            value={row.normalTax}
                            onChange={(e) => handleChangeCell(row.id, 'normalTax', e.target.value)}
                          />
                        </td>
                        <td className="px-3 py-1 text-right bg-rose-50">
                          <input
                            type="number"
                            className="w-24 text-right border-gray-300 rounded-md text-xs px-2 py-1 focus:border-indigo-500 focus:ring-indigo-500"
                            value={row.salaryAdvance}
                            onChange={(e) => handleChangeCell(row.id, 'salaryAdvance', e.target.value)}
                          />
                        </td>
                        <td className="px-3 py-1 text-right bg-rose-50">
                          <input
                            type="number"
                            className="w-24 text-right border-gray-300 rounded-md text-xs px-2 py-1 focus:border-indigo-500 focus:ring-indigo-500"
                            value={row.otherDeductions}
                            onChange={(e) => handleChangeCell(row.id, 'otherDeductions', e.target.value)}
                          />
                        </td>
                        <td className="px-3 py-1 text-right bg-rose-50">
                          <input
                            type="number"
                            className="w-20 text-right border-gray-300 rounded-md text-xs px-2 py-1 focus:border-indigo-500 focus:ring-indigo-500"
                            value={row.ptax}
                            onChange={(e) => handleChangeCell(row.id, 'ptax', e.target.value)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination hint (mock) */}
              <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
                <span>
                  Showing {rows.length} of {rows.length} entries
                </span>
              </div>
            </div>

            {/* Footer buttons */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex flex-wrap justify-between items-center gap-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={saving}
                  className="inline-flex items-center justify-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
                {saveError && (
                  <span className="text-sm text-red-600">{saveError}</span>
                )}
                {saveSuccess && (
                  <span className="text-sm text-green-600">{saveSuccess}</span>
                )}
              </div>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || loading}
                className="inline-flex items-center justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

