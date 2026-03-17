import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AppHeader from '../components/layout/AppHeader';
import { useAuthStore } from '../store/authStore';
import paygroupService, { type Paygroup } from '../services/paygroup.service';
import postToPayrollService from '../services/postToPayroll.service';

const MONTH_OPTIONS = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

const YEAR_OPTIONS = [
  { value: '2025', label: '2025' },
  { value: '2026', label: '2026' },
  { value: '2027', label: '2027' },
];

type VariableRow = {
  employeeId: string;
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

export default function VariableInputPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;
  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id;

  const [paygroups, setPaygroups] = useState<Paygroup[]>([]);
  const [selectedPaygroup, setSelectedPaygroup] = useState<string>('');
  const [month, setMonth] = useState<string>(MONTH_OPTIONS[0]?.value ?? '');
  const [year, setYear] = useState<string>(YEAR_OPTIONS[1]?.value ?? '2026');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [showAll, setShowAll] = useState<boolean>(true);
  const [rows, setRows] = useState<VariableRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);

  const handleNew = () => {
    if (!selectedPaygroup || !month || !year) {
      alert('Please select Paygroup, Month and Year before continuing.');
      return;
    }
    const pg = paygroups.find((p) => p.id === selectedPaygroup);
    navigate('/core-hr/variable-input/entry', {
      state: {
        paygroupId: selectedPaygroup,
        paygroupName: pg?.name ?? 'Paygroup',
        month,
        year,
      },
    });
  };

  useEffect(() => {
    const loadPaygroups = async () => {
      if (!organizationId) return;
      try {
        const list = await paygroupService.getAll({ organizationId });
        setPaygroups(list);
        if (!selectedPaygroup && list.length > 0) {
          setSelectedPaygroup(list[0].id);
        }
      } catch {
        // ignore; filter shows empty list
      }
    };
    loadPaygroups();
  }, [organizationId, selectedPaygroup]);

  // Load variable input rows whenever the filters change
  useEffect(() => {
    const loadRows = async () => {
      if (!organizationId || !selectedPaygroup || !month || !year) return;
      setLoadingRows(true);
      try {
        const data = await postToPayrollService.getVariableInputEntry(
          organizationId,
          selectedPaygroup,
          parseInt(year, 10),
          parseInt(month, 10)
        );
        setRows(data);
      } catch {
        setRows([]);
      } finally {
        setLoadingRows(false);
      }
    };
    loadRows();
  }, [organizationId, selectedPaygroup, month, year]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleSave = async () => {
    if (!organizationId || !selectedPaygroup || !month || !year) return;
    setSaving(true);
    setError(null);
    setSaveSuccess(null);
    try {
      await postToPayrollService.saveVariableInputEntry(
        organizationId,
        selectedPaygroup,
        parseInt(year, 10),
        parseInt(month, 10),
        rows.map((r) => ({
          employeeId: r.employeeId,
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
          : 'Failed to save variable input';
      setError(String(msg ?? 'Failed to save variable input'));
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

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader
        title="Variable Input"
        subtitle={organizationName ? `Organization: ${organizationName}` : undefined}
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
              <span className="font-semibold text-gray-900">Variable Input</span>
            </nav>
          </div>

          {/* Header card */}
          <div className="bg-white rounded-lg shadow border border-gray-200 mb-4 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h1 className="text-2xl font-bold text-gray-900">Variable Input</h1>
              <p className="text-sm text-gray-600 mt-1">
                Capture month-wise variable earnings and deductions per associate (OT, incentives, advances, etc.).
              </p>
            </div>

            {/* Filters: Paygroup / Month / Year */}
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-gray-700 w-28">Paygroup</label>
                  <select
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                    value={selectedPaygroup}
                    onChange={(e) => setSelectedPaygroup(e.target.value)}
                  >
                    <option value="">Select Paygroup</option>
                    {paygroups.map((pg) => (
                      <option key={pg.id} value={pg.id}>
                        {pg.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-gray-700 w-28">Month</label>
                  <select
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                  >
                    {MONTH_OPTIONS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-gray-700 w-28">Year</label>
                  <select
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                  >
                    {YEAR_OPTIONS.map((y) => (
                      <option key={y.value} value={y.value}>
                        {y.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Filters: Show All toggle */}
            <div className="px-6 py-3 border-b border-gray-200 bg-gray-50 flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700">Filters</span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Show All :</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={showAll}
                  onClick={() => setShowAll((v) => !v)}
                  className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 ${
                    showAll ? 'bg-orange-500' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition ${
                      showAll ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
                <span className="text-sm font-medium text-gray-700">{showAll ? 'YES' : 'NO'}</span>
              </div>
            </div>

            {error && (
              <div className="px-6 py-3 bg-red-50 border-t border-red-200 text-sm text-red-800">
                {error}
              </div>
            )}

            {saveSuccess && (
              <div className="px-6 py-3 bg-green-50 border-t border-green-200 text-sm text-green-800">
                {saveSuccess}
              </div>
            )}

            {/* Variable input data table – visible only when Show All = YES */}
            {showAll && (
              <div className="px-6 pt-4 pb-6">
                {loadingRows ? (
                  <p className="text-sm text-gray-500 py-4">Loading entries...</p>
                ) : rows.length === 0 ? (
                  <p className="text-sm text-gray-500 py-4">
                    No variable input entries found for the selected paygroup / month / year.
                    Click <strong>New</strong> to add entries.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr className="bg-blue-600 text-white">
                          <th className="px-3 py-2 text-left font-semibold">Code</th>
                          <th className="px-3 py-2 text-left font-semibold">Name</th>
                          <th className="px-3 py-2 text-right font-semibold">Comp. Salary</th>
                          <th className="px-3 py-2 text-right font-semibold">LOP</th>
                          <th className="px-3 py-2 text-right font-semibold">Vehicle Allow.</th>
                          <th className="px-3 py-2 text-right font-semibold">NFH</th>
                          <th className="px-3 py-2 text-right font-semibold">Week Off</th>
                          <th className="px-3 py-2 text-right font-semibold">OT Hrs</th>
                          <th className="px-3 py-2 text-right font-semibold">Other Earn.</th>
                          <th className="px-3 py-2 text-right font-semibold">Incentive</th>
                          <th className="px-3 py-2 text-right font-semibold">Normal Tax</th>
                          <th className="px-3 py-2 text-right font-semibold">Sal. Advance</th>
                          <th className="px-3 py-2 text-right font-semibold">Other Ded.</th>
                          <th className="px-3 py-2 text-right font-semibold">PTax</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, idx) => (
                          <tr
                            key={row.employeeId}
                            className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                          >
                            <td className="px-3 py-2 text-gray-700">{row.associateCode}</td>
                            <td className="px-3 py-2 text-gray-900 font-medium">{row.associateName}</td>
                            <td className="px-3 py-2 text-right text-gray-700">{row.compensationSalary.toLocaleString()}</td>
                            <td className="px-3 py-2 text-right text-gray-700">{row.lossOfPay}</td>
                            <td className="px-3 py-2 text-right text-gray-700">{row.vehicleAllowance.toLocaleString()}</td>
                            <td className="px-3 py-2 text-right text-gray-700">{row.nfh}</td>
                            <td className="px-3 py-2 text-right text-gray-700">{row.weekOff}</td>
                            <td className="px-3 py-2 text-right text-gray-700">{row.otHours}</td>
                            <td className="px-3 py-2 text-right text-gray-700">{row.otherEarnings.toLocaleString()}</td>
                            <td className="px-3 py-2 text-right text-gray-700">{row.incentive.toLocaleString()}</td>
                            <td className="px-3 py-2 text-right text-gray-700">{row.normalTax.toLocaleString()}</td>
                            <td className="px-3 py-2 text-right text-gray-700">{row.salaryAdvance.toLocaleString()}</td>
                            <td className="px-3 py-2 text-right text-gray-700">{row.otherDeductions.toLocaleString()}</td>
                            <td className="px-3 py-2 text-right text-gray-700">{row.ptax.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Footer buttons – toolbar style (Reset / Save as Default / Export / New / Update) */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex flex-wrap justify-between items-center gap-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={saving}
                  className="inline-flex items-center justify-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Reset
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={saving}
                  className="inline-flex items-center justify-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Save as Default
                </button>
                <button
                  type="button"
                  disabled={saving}
                  className="inline-flex items-center justify-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Export
                </button>
                <button
                  type="button"
                  disabled={saving}
                  className="inline-flex items-center justify-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  onClick={handleNew}
                >
                  New
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || rows.length === 0}
                  className="inline-flex items-center justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-60"
                >
                  {saving ? 'Updating...' : 'Update'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
