import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';
import employeeService from '../services/employee.service';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/** One row for Revert Process table */
interface RevertRow {
  id: string;
  associateCode: string;
  associateName: string;
  date: string;
}

function formatDisplayDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

/** Toggle switch - Employee module theme (gray track, orange when ON) */
function ToggleSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        <span className="text-sm font-medium text-gray-700">{label}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 ${
          checked ? 'bg-orange-500' : 'bg-gray-200'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}

function getDateKeysInRange(fromDate: string, toDate: string): string[] {
  const from = new Date(fromDate + 'T12:00:00');
  const to = new Date(toDate + 'T12:00:00');
  const keys: string[] = [];
  const current = new Date(from);
  while (current <= to) {
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, '0');
    const d = String(current.getDate()).padStart(2, '0');
    keys.push(`${y}-${m}-${d}`);
    current.setDate(current.getDate() + 1);
  }
  return keys;
}

export default function RevertProcessPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;
  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id;

  const associateId = searchParams.get('associateId') ?? '';
  const fromDateParam = searchParams.get('fromDate') ?? '';
  const toDateParam = searchParams.get('toDate') ?? '';

  const [associateName, setAssociateName] = useState('');
  const [associateCode, setAssociateCode] = useState('');
  const [loadingAssociate, setLoadingAssociate] = useState(true);
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showColumns, setShowColumns] = useState(true);
  const [showValidationOnHoldModal, setShowValidationOnHoldModal] = useState(false);
  const [includeAutoCleanedRecords, setIncludeAutoCleanedRecords] = useState(false);
  const [onHoldAssociateCanModify, setOnHoldAssociateCanModify] = useState(false);
  const [onHoldManagersCanModify, setOnHoldManagersCanModify] = useState(false);
  const [showRevertModal, setShowRevertModal] = useState(false);
  const [holdValidation, setHoldValidation] = useState(false);
  const [revertRegularization, setRevertRegularization] = useState(false);
  const [revertReason, setRevertReason] = useState('');

  const dateRange = useMemo(() => {
    if (!fromDateParam || !toDateParam) {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const first = `${y}-${m}-01`;
      const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
      const last = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
      return { from: first, to: last };
    }
    return { from: fromDateParam, to: toDateParam };
  }, [fromDateParam, toDateParam]);

  const allRows = useMemo((): RevertRow[] => {
    if (!associateId || !associateCode) return [];
    const keys = getDateKeysInRange(dateRange.from, dateRange.to);
    return keys.map((dateKey) => ({
      id: `${associateId}-${dateKey}`,
      associateCode,
      associateName: associateName || '—',
      date: dateKey,
    }));
  }, [associateId, associateCode, associateName, dateRange.from, dateRange.to]);

  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return allRows;
    const term = searchTerm.toLowerCase();
    return allRows.filter(
      (r) =>
        r.associateCode.toLowerCase().includes(term) ||
        r.associateName.toLowerCase().includes(term) ||
        r.date.includes(term) ||
        formatDisplayDate(r.date).includes(term)
    );
  }, [allRows, searchTerm]);

  const totalRows = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const startIdx = (page - 1) * pageSize;
  const pageRows = filteredRows.slice(startIdx, startIdx + pageSize);
  const startEntry = totalRows === 0 ? 0 : startIdx + 1;
  const endEntry = Math.min(startIdx + pageSize, totalRows);

  useEffect(() => {
    if (!associateId || !organizationId) {
      setLoadingAssociate(false);
      return;
    }
    setLoadingAssociate(true);
    employeeService
      .getById(associateId)
      .then((emp) => {
        const parts = [emp.firstName, emp.middleName, emp.lastName].filter(Boolean);
        setAssociateName(parts.join(' ').trim() || '—');
        setAssociateCode(emp.employeeCode || '—');
      })
      .catch(() => {
        setAssociateName('—');
        setAssociateCode('—');
      })
      .finally(() => setLoadingAssociate(false));
  }, [associateId, organizationId]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === pageRows.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pageRows.map((r) => r.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCancel = () => {
    navigate('/hr-activities/validation-process');
  };

  const handleValidationOnHold = () => {
    if (selectedIds.size === 0) {
      alert('At least one entry select pannunga.');
      return;
    }
    setIncludeAutoCleanedRecords(false);
    setOnHoldAssociateCanModify(false);
    setOnHoldManagersCanModify(false);
    setShowValidationOnHoldModal(true);
  };

  const handleValidationOnHoldConfirm = () => {
    // TODO: API integration with includeAutoCleanedRecords, onHoldAssociateCanModify, onHoldManagersCanModify
    setShowValidationOnHoldModal(false);
  };

  const handleValidationOnHoldCancel = () => {
    setShowValidationOnHoldModal(false);
  };

  const handleRevert = () => {
    if (selectedIds.size === 0) {
      alert('At least one entry select pannunga.');
      return;
    }
    setHoldValidation(false);
    setRevertRegularization(false);
    setRevertReason('');
    setShowRevertModal(true);
  };

  const handleRevertConfirm = () => {
    // TODO: API integration with holdValidation, revertRegularization, revertReason
    setShowRevertModal(false);
  };

  const handleRevertCancel = () => {
    setShowRevertModal(false);
  };

  const handlePrint = () => {
    window.print();
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
        title="HR Activities"
        subtitle={organizationName ? `Organization: ${organizationName}` : undefined}
        onLogout={handleLogout}
      />

      <main className="flex-1 min-h-0 overflow-auto w-full bg-gray-100">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 bg-gray-50">
          {/* Breadcrumbs - Employee module style */}
          <div className="mb-6">
            <nav className="flex items-center text-sm text-gray-600" aria-label="Breadcrumb">
              <Link to="/hr-activities/validation-process" className="text-gray-500 hover:text-gray-900">
                HR Activities
              </Link>
              <span className="mx-1 text-gray-400">/</span>
              <Link to="/hr-activities/validation-process" className="text-gray-500 hover:text-gray-900">
                Validation Process
              </Link>
              <span className="mx-1 text-gray-400">/</span>
              <span className="font-semibold text-gray-900">Revert Process</span>
            </nav>
          </div>

          {/* Title bar - Employee module style (no blue) */}
          <div className="bg-white rounded-lg shadow border border-gray-200 mb-6">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Revert Process</h2>
            </div>

            {/* Toolbar */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">Show</label>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                    className="h-9 px-2 py-1 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 font-medium min-w-[4rem]"
                  >
                    {PAGE_SIZE_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <span className="text-sm font-medium text-gray-700">entries</span>
                </div>
                <input
                  type="text"
                  placeholder="Search"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1);
                  }}
                  className="h-9 px-3 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 placeholder-gray-500 min-w-[180px]"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="h-9 px-3 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 transition inline-flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Print
                </button>
                <button
                  type="button"
                  className="h-9 px-3 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 transition inline-flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  Save
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setShowColumns(!showColumns)}
                  className="h-9 px-3 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 transition inline-flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Show / hide columns
                </button>
              </div>
            </div>

            {/* Table - Employee module: thead bg-gray-50, no blue */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={pageRows.length > 0 && selectedIds.size === pageRows.length}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300 text-gray-700 focus:ring-gray-500"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Associate Code
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Associate Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loadingAssociate ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                        Loading...
                      </td>
                    </tr>
                  ) : !associateId ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                        Associate select pannunga. Validation Process page la irundhu Revert / Validation On Hold click pannunga.
                      </td>
                    </tr>
                  ) : pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                        No records to display.
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(row.id)}
                            onChange={() => toggleSelectOne(row.id)}
                            className="rounded border-gray-300 text-gray-700 focus:ring-gray-500"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.associateCode}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{row.associateName}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{formatDisplayDate(row.date)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination - Employee module style (gray, no blue) */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex flex-wrap items-center justify-between gap-4">
              <div className="text-sm font-medium text-gray-700">
                Showing {startEntry} to {endEntry} of {totalRows} entries
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="h-9 px-3 py-1 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition"
                >
                  Previous
                </button>
                {(() => {
                  const maxVisible = 5;
                  let start = Math.max(1, page - Math.floor(maxVisible / 2));
                  let end = Math.min(totalPages, start + maxVisible - 1);
                  if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);
                  const showPages: number[] = [];
                  for (let i = start; i <= end; i++) showPages.push(i);
                  const showEllipsisAndLast = totalPages > 5 && end < totalPages;
                  return (
                    <>
                      {showPages.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPage(p)}
                          className={`h-9 min-w-[2.25rem] px-3 py-1 rounded-lg text-sm font-medium transition ${
                            page === p
                              ? 'bg-gray-700 text-white'
                              : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                      {showEllipsisAndLast && (
                        <>
                          <span className="px-2 text-gray-500 text-sm">…</span>
                          <button
                            type="button"
                            onClick={() => setPage(totalPages)}
                            className="h-9 min-w-[2.25rem] px-3 py-1 rounded-lg text-sm font-medium bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
                          >
                            {totalPages}
                          </button>
                        </>
                      )}
                    </>
                  );
                })()}
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="h-9 px-3 py-1 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition"
                >
                  Next
                </button>
              </div>
            </div>

            {/* Bottom action buttons - Employee module theme */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleCancel}
                className="h-9 px-4 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 transition inline-flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cancel
              </button>
              <button
                type="button"
                onClick={handleValidationOnHold}
                className="h-9 px-4 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition inline-flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Validation On Hold
              </button>
              <button
                type="button"
                onClick={handleRevert}
                className="h-9 px-4 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 hover:text-red-700 hover:border-red-300 transition inline-flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
                Revert
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Validation On Hold popup - 2nd image layout, employee module theme */}
      {showValidationOnHoldModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" aria-hidden onClick={handleValidationOnHoldCancel} />
          <div className="relative bg-white rounded-lg shadow-xl border border-gray-200 w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-gray-700 text-white">
              <h3 className="text-lg font-semibold">Do you want to put selected data on hold?</h3>
              <button
                type="button"
                onClick={handleValidationOnHoldCancel}
                className="p-1 rounded hover:bg-gray-600 text-white"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-3 border-b border-gray-200">
              <ToggleSwitch
                label="Include Auto Cleaned Records :"
                checked={includeAutoCleanedRecords}
                onChange={setIncludeAutoCleanedRecords}
              />
              <ToggleSwitch
                label="On Hold - Associate Can Modify :"
                checked={onHoldAssociateCanModify}
                onChange={setOnHoldAssociateCanModify}
              />
              <ToggleSwitch
                label="On Hold - Managers Can Modify :"
                checked={onHoldManagersCanModify}
                onChange={setOnHoldManagersCanModify}
              />
            </div>
            <div className="px-6 py-4 flex justify-end gap-3 bg-gray-50">
              <button
                type="button"
                onClick={handleValidationOnHoldConfirm}
                className="h-9 px-4 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition inline-flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Yes
              </button>
              <button
                type="button"
                onClick={handleValidationOnHoldCancel}
                className="h-9 px-4 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 transition inline-flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                No
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revert popup - 1st image layout, project theme */}
      {showRevertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" aria-hidden onClick={handleRevertCancel} />
          <div className="relative bg-white rounded-lg shadow-xl border border-gray-200 w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-gray-700 text-white">
              <h3 className="text-lg font-semibold">Are you want to revert this selected data?</h3>
              <button
                type="button"
                onClick={handleRevertCancel}
                className="p-1 rounded hover:bg-gray-600 text-white"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4 border-b border-gray-200">
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
                <p className="text-sm font-medium text-red-800">
                  All data, including events, shifts completed through the validation process, will be permanently removed.
                </p>
              </div>
              <ToggleSwitch
                label="Hold Validation :"
                checked={holdValidation}
                onChange={setHoldValidation}
              />
              <ToggleSwitch
                label="Revert Regularization :"
                checked={revertRegularization}
                onChange={setRevertRegularization}
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Reason :</label>
                <textarea
                  value={revertReason}
                  onChange={(e) => setRevertReason(e.target.value)}
                  placeholder="Reason"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
                />
              </div>
            </div>
            <div className="px-6 py-4 flex justify-end gap-3 bg-gray-50">
              <button
                type="button"
                onClick={handleRevertConfirm}
                className="h-9 px-4 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition inline-flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Yes
              </button>
              <button
                type="button"
                onClick={handleRevertCancel}
                className="h-9 px-4 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 transition inline-flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                No
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
