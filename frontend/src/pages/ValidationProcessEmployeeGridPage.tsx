import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AppHeader from '../components/layout/AppHeader';
import { useAuthStore } from '../store/authStore';
import attendanceComponentService from '../services/attendanceComponent.service';
import { attendanceService, type ValidationProcessEmployeeRow } from '../services/attendance.service';

function getValidationTitle(type?: string | null): string {
  const labelMap: Record<string, string> = {
    absent: 'Absent',
    approvalPending: 'Approval Pending',
    earlyGoing: 'Early Going',
    late: 'Late',
    noOutPunch: 'No Out Punch',
    overtime: 'OverTime',
    shiftChange: 'Shift Change',
    shortfall: 'Shortfall',
    completed: 'Completed',
  };
  const key = (type || '').toLowerCase();
  const label = labelMap[key] ?? 'Validation';
  return `Employee Grid (${label})`;
}

export default function ValidationProcessEmployeeGridPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;
  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id;
  const [searchParams] = useSearchParams();
  const date = searchParams.get('date') || '';
  const type = searchParams.get('type') || '';
  const fromDate = searchParams.get('fromDate') || date;
  const toDate = searchParams.get('toDate') || date;

  const [rows, setRows] = useState<ValidationProcessEmployeeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  interface CorrectionOption {
    id: string;
    name: string;
  }

  const [correctionOptions, setCorrectionOptions] = useState<CorrectionOption[]>([
    { id: 'AS_PER_RULE', name: 'As Per Rule' },
  ]);
  const [correctionLoading, setCorrectionLoading] = useState(false);
  const [selectedCorrectionId, setSelectedCorrectionId] = useState<string>('AS_PER_RULE');
  const [showCorrectionDropdown, setShowCorrectionDropdown] = useState(false);
  const [correctionSearch, setCorrectionSearch] = useState('');

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (!user) {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-gray-100 items-center justify-center p-8">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  const title = getValidationTitle(type);
  const selectedCorrection =
    correctionOptions.find((opt) => opt.id === selectedCorrectionId) ?? correctionOptions[0];

  const loadEmployeeList = useCallback(async () => {
    if (!organizationId || !type) {
      setRows([]);
      return;
    }
    const from = fromDate || toDate || date;
    const to = toDate || fromDate || date;
    if (!from || !to) {
      setRows([]);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const result = await attendanceService.getValidationProcessEmployeeList({
        organizationId,
        fromDate: from,
        toDate: to,
        type,
      });
      setRows(result.rows ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load employee list';
      setLoadError(message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [organizationId, type, fromDate, toDate, date]);

  useEffect(() => {
    loadEmployeeList();
  }, [loadEmployeeList]);

  useEffect(() => {
    const loadCorrectionOptions = async () => {
      if (!organizationId) return;
      try {
        setCorrectionLoading(true);
        const result = await attendanceComponentService.getAll({
          organizationId,
          page: 1,
          limit: 100,
        });
        const dynamicOptions: CorrectionOption[] = result.components
          .filter((c) => c.eventName)
          .map((c) => ({ id: c.id, name: c.eventName }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setCorrectionOptions((prev) => {
          const base = prev.find((p) => p.id === 'AS_PER_RULE') ?? { id: 'AS_PER_RULE', name: 'As Per Rule' };
          return [base, ...dynamicOptions];
        });
      } catch {
        // Keep default As Per Rule only on error.
      } finally {
        setCorrectionLoading(false);
      }
    };
    loadCorrectionOptions();
  }, [organizationId]);

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader
        title="HR Activities"
        subtitle={organizationName ? `Organization: ${organizationName}` : undefined}
        onLogout={handleLogout}
      />

      <main className="flex-1 min-h-0 flex flex-col w-full px-4 sm:px-6 lg:px-8 py-6 bg-gray-50">
        <div className="flex-1 flex flex-col min-h-0 w-full">
          {/* Breadcrumbs */}
          <div className="mb-4 flex-shrink-0">
            <nav className="flex items-center text-sm text-gray-600" aria-label="Breadcrumb">
              <Link to="/hr-activities" className="text-gray-500 hover:text-gray-900">
                HR Activities
              </Link>
              <span className="mx-1 text-gray-400">/</span>
              <Link to="/hr-activities/validation-process" className="text-gray-500 hover:text-gray-900">
                Validation Process
              </Link>
              <span className="mx-1 text-gray-400">/</span>
              <span className="font-semibold text-gray-900">{title}</span>
            </nav>
          </div>

          {/* Card */}
          <div className="flex-1 flex flex-col min-h-0 bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{title}</h2>
                {(fromDate && toDate) && (
                  <p className="text-sm text-gray-600 mt-1">
                    {fromDate === toDate
                      ? `Date: ${new Date(fromDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
                      : `Date range: ${new Date(fromDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })} – ${new Date(toDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}`}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Close
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-blue-600 bg-blue-600 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Correction
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Send Mail
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 flex flex-col md:flex-row">
              {/* Left panel - Correction form */}
              <div className="w-full md:w-72 border-r border-gray-200 bg-gray-50 p-4 flex-shrink-0">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Correction</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowCorrectionDropdown((v) => !v)}
                      className="w-full h-9 px-3 pr-8 border border-gray-300 rounded text-sm text-gray-700 bg-white flex items-center justify-between"
                    >
                      <span>{correctionLoading ? 'Loading...' : selectedCorrection?.name}</span>
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {showCorrectionDropdown && (
                      <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded shadow-lg">
                        <div className="p-2 border-b border-gray-200 flex items-center gap-2">
                          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m0 0A7 7 0 1010.65 5.65a7 7 0 006 11.01z" />
                          </svg>
                          <input
                            type="text"
                            value={correctionSearch}
                            onChange={(e) => setCorrectionSearch(e.target.value)}
                            placeholder="Search..."
                            className="flex-1 h-7 px-2 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        <div className="max-h-56 overflow-auto py-1 text-sm">
                          {correctionOptions
                            .filter((opt) =>
                              opt.name.toLowerCase().includes(correctionSearch.trim().toLowerCase())
                            )
                            .map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => {
                                  setSelectedCorrectionId(opt.id);
                                  setShowCorrectionDropdown(false);
                                }}
                                className={`w-full text-left px-3 py-1.5 hover:bg-blue-50 ${
                                  opt.id === selectedCorrectionId ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                                }`}
                              >
                                {opt.name}
                              </button>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
                  <textarea
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-700 bg-white resize-none"
                  />
                </div>
                <button
                  type="button"
                  className="inline-flex items-center justify-center w-full h-9 px-3 rounded-lg border border-green-600 bg-green-600 text-sm font-medium text-white hover:bg-green-700"
                >
                  Submit
                </button>
              </div>

              {/* Right panel - Employee grid table (placeholder, to be wired to API) */}
              <div className="flex-1 min-h-0 flex flex-col p-4 overflow-auto">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span>Show</span>
                    <select className="h-8 px-2 border border-gray-300 rounded text-sm text-gray-700 bg-white">
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                    </select>
                    <span>entries</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="search"
                      placeholder="Search..."
                      className="h-8 px-3 border border-gray-300 rounded text-sm text-gray-700 w-40"
                    />
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded border border-gray-300 bg-white text-xs text-gray-700 hover:bg-gray-50"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5M9 9V7m3 6v6m2-4v4m2-4v4H5a2 2 0 01-2-2v-4a2 2 0 012-2h2m-4 0V5a2 2 0 012-2h6a2 2 0 012 2v4" />
                      </svg>
                      Print
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded border border-gray-300 bg-white text-xs text-gray-700 hover:bg-gray-50"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m4 3V4" />
                      </svg>
                      Save
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded border border-gray-300 bg-white text-xs text-gray-700 hover:bg-gray-50"
                    >
                      Show / hide columns
                    </button>
                  </div>
                </div>

                <div className="flex-1 min-h-0 overflow-auto border border-gray-200 rounded-lg">
                  <table className="w-full border-collapse text-xs md:text-sm">
                    <thead>
                      <tr>
                        <th className="border border-gray-200 bg-gray-50 px-2 py-2 text-left font-medium text-gray-700">
                          <input type="checkbox" className="rounded border-gray-300 text-gray-600 focus:ring-gray-500" />
                        </th>
                        <th className="border border-gray-200 bg-gray-50 px-2 py-2 text-left font-medium text-gray-700">Associate Code</th>
                        <th className="border border-gray-200 bg-gray-50 px-2 py-2 text-left font-medium text-gray-700">Associate Name</th>
                        <th className="border border-gray-200 bg-gray-50 px-2 py-2 text-left font-medium text-gray-700">Date</th>
                        <th className="border border-gray-200 bg-gray-50 px-2 py-2 text-left font-medium text-gray-700">Shift Name</th>
                        <th className="border border-gray-200 bg-gray-50 px-2 py-2 text-left font-medium text-gray-700">Shift Start</th>
                        <th className="border border-gray-200 bg-gray-50 px-2 py-2 text-left font-medium text-gray-700">Shift End</th>
                        <th className="border border-gray-200 bg-gray-50 px-2 py-2 text-left font-medium text-gray-700">First In Punch</th>
                        <th className="border border-gray-200 bg-gray-50 px-2 py-2 text-left font-medium text-gray-700">Last Out Punch</th>
                        <th className="border border-gray-200 bg-gray-50 px-2 py-2 text-left font-medium text-gray-700">Present First Half</th>
                        <th className="border border-gray-200 bg-gray-50 px-2 py-2 text-left font-medium text-gray-700">Present Second Half</th>
                        <th className="border border-gray-200 bg-gray-50 px-2 py-2 text-left font-medium text-gray-700">Leave First Half</th>
                        <th className="border border-gray-200 bg-gray-50 px-2 py-2 text-left font-medium text-gray-700">Leave Second Half</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading && (
                        <tr>
                          <td colSpan={13} className="px-4 py-6 text-center text-sm text-gray-500">
                            Loading...
                          </td>
                        </tr>
                      )}
                      {!loading && loadError && (
                        <tr>
                          <td colSpan={13} className="px-4 py-6 text-center text-sm text-red-600">
                            {loadError}
                          </td>
                        </tr>
                      )}
                      {!loading && !loadError && rows.length === 0 && (type || fromDate || date) && (
                        <tr>
                          <td colSpan={13} className="px-4 py-6 text-center text-sm text-gray-500">
                            No records to display. Run the Validation Process and select a grouping with count &gt; 0.
                          </td>
                        </tr>
                      )}
                      {!loading && !loadError && rows.length > 0 && rows.map((row, idx) => (
                        <tr key={`${row.employeeId}-${row.date}-${idx}`} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="border border-gray-200 px-2 py-2">
                            <input type="checkbox" className="rounded border-gray-300 text-gray-600 focus:ring-gray-500" />
                          </td>
                          <td className="border border-gray-200 px-2 py-2 text-gray-900">{row.employeeCode}</td>
                          <td className="border border-gray-200 px-2 py-2 text-gray-900">{row.employeeName}</td>
                          <td className="border border-gray-200 px-2 py-2 text-gray-700">
                            {new Date(row.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                          </td>
                          <td className="border border-gray-200 px-2 py-2 text-gray-700">{row.shiftName ?? '—'}</td>
                          <td className="border border-gray-200 px-2 py-2 text-gray-700">{row.shiftStart ?? '—'}</td>
                          <td className="border border-gray-200 px-2 py-2 text-gray-700">{row.shiftEnd ?? '—'}</td>
                          <td className="border border-gray-200 px-2 py-2 text-gray-700">{row.firstInPunch ?? '—'}</td>
                          <td className="border border-gray-200 px-2 py-2 text-gray-700">{row.lastOutPunch ?? '—'}</td>
                          <td className="border border-gray-200 px-2 py-2 text-gray-700">{row.presentFirstHalf ?? '—'}</td>
                          <td className="border border-gray-200 px-2 py-2 text-gray-700">{row.presentSecondHalf ?? '—'}</td>
                          <td className="border border-gray-200 px-2 py-2 text-gray-700">{row.leaveFirstHalf ?? '—'}</td>
                          <td className="border border-gray-200 px-2 py-2 text-gray-700">{row.leaveSecondHalf ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between mt-3 text-xs md:text-sm text-gray-600">
                  <span>Showing {rows.length} entries</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="px-2 py-1 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      className="px-2 py-1 rounded border border-blue-600 bg-blue-600 text-white"
                    >
                      1
                    </button>
                    <button
                      type="button"
                      className="px-2 py-1 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

