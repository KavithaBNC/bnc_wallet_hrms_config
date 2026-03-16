import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';
import employeeService, { Employee } from '../services/employee.service';
import { esopService } from '../services/esop.service';

function fullName(e: Employee): string {
  const parts = [e.firstName, e.middleName, e.lastName].filter(Boolean);
  return parts.join(' ').trim() || e.employeeCode || '';
}

/** Generate financial year options: FY 20-21, FY 21-22, ... up to upcoming years. */
function getFinancialYearOptions(): string[] {
  const startYear = 2020;
  const currentYear = new Date().getFullYear();
  const endYear = currentYear + 2;
  const options: string[] = [];
  for (let y = startYear; y <= endYear; y++) {
    const yy1 = String(y).slice(-2);
    const yy2 = String(y + 1).slice(-2);
    options.push(`FY ${yy1}-${yy2}`);
  }
  return options;
}

/** Parse FY string (e.g. "FY 23-24") to get start and end dates. FY = April to March. */
function getFinancialYearRange(fy: string): { start: string; end: string } | null {
  const match = fy.match(/FY\s*(\d{2})-(\d{2})/);
  if (!match) return null;
  const yy1 = parseInt(match[1], 10);
  const yy2 = parseInt(match[2], 10);
  const startYear = 2000 + yy1;
  const endYear = 2000 + yy2;
  return {
    start: `${startYear}-04-01`,
    end: `${endYear}-03-31`,
  };
}

/** Check if dateOfJoining falls within FY range (April 1 - March 31). */
function isJoinerInFY(dateOfJoining: string | undefined, fy: string): boolean {
  if (!dateOfJoining) return false;
  const range = getFinancialYearRange(fy);
  if (!range) return false;
  const joinDate = dateOfJoining.slice(0, 10);
  return joinDate >= range.start && joinDate <= range.end;
}

export interface EsopRowData {
  noOfEsop: string;
  dateOfAllocation: string;
  visted: string;
}

export default function EsopPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;
  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id;

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [financialYear, setFinancialYear] = useState('');
  const [rowData, setRowData] = useState<Record<string, EsopRowData>>({});

  const financialYearOptions = getFinancialYearOptions();

  useEffect(() => {
    if (!organizationId) return;
    setLoading(true);
    employeeService
      .getAll({ organizationId, page: 1, limit: 1000, employeeStatus: 'ACTIVE' })
      .then((res) => setEmployees(res.employees || []))
      .finally(() => setLoading(false));
  }, [organizationId]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  /** Live employees (joiners) who joined in the selected financial year. */
  const joiners = financialYear
    ? employees.filter((e) => isJoinerInFY(e.dateOfJoining, financialYear))
    : [];

  const updateRowData = (employeeId: string, field: keyof EsopRowData, value: string) => {
    setRowData((prev) => ({
      ...prev,
      [employeeId]: {
        ...(prev[employeeId] ?? { noOfEsop: '', dateOfAllocation: '', visted: '' }),
        [field]: value,
      },
    }));
  };

  const getRowData = (employeeId: string): EsopRowData =>
    rowData[employeeId] ?? { noOfEsop: '', dateOfAllocation: '', visted: '' };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId || !financialYear) return;
    const recordsToSave = joiners
      .map((emp) => {
        const d = getRowData(emp.id);
        return {
          employeeId: emp.id,
          noOfEsop: parseInt(d.noOfEsop, 10) || 0,
          dateOfAllocation: d.dateOfAllocation || null,
          visted: d.visted?.trim() || null,
        };
      })
      .filter((r) => r.noOfEsop > 0 || r.dateOfAllocation || r.visted);
    if (recordsToSave.length === 0) {
      setSubmitError('Please enter at least one ESOP record (No of ESOP, Date of allocation, or Visted).');
      return;
    }
    setSubmitError(null);
    setSaving(true);
    try {
      await esopService.createBulk({
        organizationId,
        financialYear,
        records: recordsToSave,
      });
      navigate('/esop');
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : 'Failed to save ESOP records';
      setSubmitError(typeof msg === 'string' ? msg : 'Failed to save ESOP records');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100 w-full h-full">
      <AppHeader
        title="ESOP"
        subtitle={organizationName ? organizationName : undefined}
        onLogout={handleLogout}
      />

      <main className="flex-1 min-h-0 flex flex-col w-full min-w-0 p-4 overflow-auto">
        <div className="mb-3 flex-shrink-0 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Add ESOP</h2>
            <p className="mt-0.5 text-sm text-gray-600">Allocate ESOP for joiners by financial year.</p>
          </div>
          <Link to="/esop" className="text-sm text-blue-600 hover:underline">
            ← Back to List
          </Link>
        </div>

        <div className="flex-1 min-h-0 w-full min-w-0 bg-white rounded-lg shadow border border-gray-200 flex flex-col overflow-hidden">
          <div className="bg-blue-600 text-white px-4 py-3 flex-shrink-0">
            <h3 className="text-lg font-semibold">ESOP Form</h3>
          </div>
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col p-6 min-h-0 overflow-auto">
            {/* Financial Year - First field */}
            <div className="flex-shrink-0 mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Financial Year <span className="text-red-500">*</span>
              </label>
              <select
                value={financialYear}
                onChange={(e) => {
                  setFinancialYear(e.target.value);
                  setRowData({});
                }}
                className="w-full max-w-xs border border-gray-300 rounded px-3 py-2 text-gray-900 bg-white"
                disabled={loading}
              >
                <option value="">Select Financial Year</option>
                {financialYearOptions.map((fy) => (
                  <option key={fy} value={fy}>
                    {fy}
                  </option>
                ))}
              </select>
            </div>

            {/* Table - shown when FY is selected */}
            {financialYear && (
              <div className="flex-1 min-h-0 overflow-auto border-t border-gray-200 pt-6">
                <p className="text-sm text-gray-600 mb-4">
                  Particular joiner associate details for {financialYear}
                </p>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Live employees
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          No of ESOP
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date of allocation
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Vested
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {joiners.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                            No employees joined in {financialYear}
                          </td>
                        </tr>
                      ) : (
                        joiners.map((emp) => {
                          const data = getRowData(emp.id);
                          return (
                            <tr key={emp.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">
                                  {fullName(emp)}
                                </div>
                                <div className="text-xs text-gray-500">{emp.employeeCode}</div>
                              </td>
                              <td className="px-4 py-2">
                                <input
                                  type="number"
                                  min={0}
                                  value={data.noOfEsop}
                                  onChange={(e) =>
                                    updateRowData(emp.id, 'noOfEsop', e.target.value)
                                  }
                                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-gray-900"
                                  placeholder="0"
                                />
                              </td>
                              <td className="px-4 py-2">
                                <input
                                  type="date"
                                  value={data.dateOfAllocation}
                                  onChange={(e) =>
                                    updateRowData(emp.id, 'dateOfAllocation', e.target.value)
                                  }
                                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-gray-900"
                                />
                              </td>
                              <td className="px-4 py-2">
                                <input
                                  type="text"
                                  value={data.visted}
                                  onChange={(e) =>
                                    updateRowData(emp.id, 'visted', e.target.value)
                                  }
                                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-gray-900"
                                  placeholder="—"
                                />
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                {submitError && (
                  <p className="mt-4 text-sm text-red-600">{submitError}</p>
                )}
                <div className="mt-6 flex gap-3">
                  <button
                    type="submit"
                    disabled={saving || joiners.length === 0}
                    className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Submit'}
                  </button>
                  <Link
                    to="/esop"
                    className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 font-medium hover:bg-gray-50"
                  >
                    Cancel
                  </Link>
                </div>
              </div>
            )}
          </form>
        </div>
      </main>
    </div>
  );
}
