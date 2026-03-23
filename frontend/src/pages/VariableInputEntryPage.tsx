import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AppHeader from '../components/layout/AppHeader';
import BackNavigation from '../components/common/BackNavigation';
import { useAuthStore } from '../store/authStore';

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

const MOCK_ROWS: VariableInputRow[] = [
  {
    id: '1',
    associateCode: 'B8002',
    associateName: 'Devan Fazle Khotis',
    compensationSalary: 0,
    lossOfPay: 0,
    vehicleAllowance: 0,
    nfh: 0,
    weekOff: 0,
    otHours: 0,
    otherEarnings: 0,
    incentive: 0,
    normalTax: 0,
    salaryAdvance: 0,
    otherDeductions: 0,
    ptax: 0,
  },
  {
    id: '2',
    associateCode: 'B8003',
    associateName: 'Paramehs Vasan',
    compensationSalary: 0,
    lossOfPay: 0,
    vehicleAllowance: 0,
    nfh: 0,
    weekOff: 0,
    otHours: 0,
    otherEarnings: 0,
    incentive: 0,
    normalTax: 0,
    salaryAdvance: 0,
    otherDeductions: 0,
    ptax: 0,
  },
];

export default function VariableInputEntryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();

  const { paygroupName, month, year } =
    (location.state as { paygroupName?: string; month?: string; year?: string } | null) ?? {};

  const organizationName = user?.employee?.organization?.name;

  const [rows, setRows] = useState<VariableInputRow[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // If user navigates directly without filters, go back to main page
    if (!paygroupName || !month || !year) {
      navigate('/core-hr/variable-input', { replace: true });
      return;
    }
    // TODO: replace with API call that loads variable input rows
    setRows(MOCK_ROWS);
  }, [paygroupName, month, year, navigate]);

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
    setRows(MOCK_ROWS);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // TODO: integrate with backend save API
      await new Promise((resolve) => setTimeout(resolve, 400));
      // eslint-disable-next-line no-alert
      alert('Variable input saved (mock). Wire to backend API later.');
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

  const monthLabel = month ?? '';

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <BackNavigation to="/core-hr/variable-input" label="Variable Input" />
      <AppHeader
        title="Variable Input"
        subtitle={
          organizationName
            ? `${organizationName} – ${paygroupName ?? ''} [${monthLabel} ${year ?? ''}]`
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
                      <th className="px-3 py-2 text-right font-semibold bg-blue-100/40 text-black">
                        Compensation Salary
                      </th>
                      <th className="px-3 py-2 text-right font-semibold bg-blue-100/40 text-black">
                        Loss of Pay
                      </th>
                      <th className="px-3 py-2 text-right font-semibold bg-blue-100/40 text-black">
                        Vehicle Allowance
                      </th>
                      <th className="px-3 py-2 text-right font-semibold bg-blue-100/40 text-black">
                        NFH
                      </th>
                      <th className="px-3 py-2 text-right font-semibold bg-blue-100/40 text-black">
                        WeekOff
                      </th>
                      <th className="px-3 py-2 text-right font-semibold bg-blue-100/40 text-black">
                        OT Hours
                      </th>
                      <th className="px-3 py-2 text-right font-semibold bg-blue-100/40 text-black">
                        Other Earnings
                      </th>
                      <th className="px-3 py-2 text-right font-semibold bg-blue-100/40 text-black">
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
                        <td className="px-3 py-1 text-right text-sm bg-blue-50">
                          {row.compensationSalary.toFixed(2)}
                        </td>
                        <td className="px-3 py-1 text-right bg-blue-50">
                          <input
                            type="number"
                            className="w-20 text-right border-gray-300 rounded-md text-xs px-2 py-1 focus:border-indigo-500 focus:ring-indigo-500"
                            value={row.lossOfPay}
                            onChange={(e) => handleChangeCell(row.id, 'lossOfPay', e.target.value)}
                          />
                        </td>
                        <td className="px-3 py-1 text-right bg-blue-50">
                          <input
                            type="number"
                            className="w-20 text-right border-gray-300 rounded-md text-xs px-2 py-1 focus:border-indigo-500 focus:ring-indigo-500"
                            value={row.vehicleAllowance}
                            onChange={(e) => handleChangeCell(row.id, 'vehicleAllowance', e.target.value)}
                          />
                        </td>
                        <td className="px-3 py-1 text-right bg-blue-50">
                          <input
                            type="number"
                            className="w-16 text-right border-gray-300 rounded-md text-xs px-2 py-1 focus:border-indigo-500 focus:ring-indigo-500"
                            value={row.nfh}
                            onChange={(e) => handleChangeCell(row.id, 'nfh', e.target.value)}
                          />
                        </td>
                        <td className="px-3 py-1 text-right bg-blue-50">
                          <input
                            type="number"
                            className="w-16 text-right border-gray-300 rounded-md text-xs px-2 py-1 focus:border-indigo-500 focus:ring-indigo-500"
                            value={row.weekOff}
                            onChange={(e) => handleChangeCell(row.id, 'weekOff', e.target.value)}
                          />
                        </td>
                        <td className="px-3 py-1 text-right bg-blue-50">
                          <input
                            type="number"
                            className="w-20 text-right border-gray-300 rounded-md text-xs px-2 py-1 focus:border-indigo-500 focus:ring-indigo-500"
                            value={row.otHours}
                            onChange={(e) => handleChangeCell(row.id, 'otHours', e.target.value)}
                          />
                        </td>
                        <td className="px-3 py-1 text-right bg-blue-50">
                          <input
                            type="number"
                            className="w-24 text-right border-gray-300 rounded-md text-xs px-2 py-1 focus:border-indigo-500 focus:ring-indigo-500"
                            value={row.otherEarnings}
                            onChange={(e) => handleChangeCell(row.id, 'otherEarnings', e.target.value)}
                          />
                        </td>
                        <td className="px-3 py-1 text-right bg-blue-50">
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
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                className="inline-flex items-center justify-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60"
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

