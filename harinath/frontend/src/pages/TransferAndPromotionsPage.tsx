import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';
import transferPromotionService, { TransferPromotionRecord as ApiRecord } from '../services/transfer-promotion.service';

export type SortKey = 'associateCode' | 'associateName' | 'effectiveDate' | 'appliedFrom' | 'details';
export type SortOrder = 'asc' | 'desc';

export interface TransferPromotionRecord {
  id: string;
  associateCode: string;
  associateName: string;
  effectiveDate: string;
  effectiveDateIso: string;
  appliedFrom: string;
  details: string;
  incrementValue?: number;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

function formatEffectiveDate(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function mapApiRecordToDisplay(r: ApiRecord): TransferPromotionRecord {
  const name = r.employee
    ? [r.employee.firstName, r.employee.middleName, r.employee.lastName].filter(Boolean).join(' ')
    : '';
  const incrementValue = r.incrementComponents?.[0]?.incrementValue;
  return {
    id: r.id,
    associateCode: r.employee?.employeeCode ?? '-',
    associateName: name || '-',
    effectiveDate: formatEffectiveDate(r.effectiveDate),
    effectiveDateIso: r.effectiveDate ?? '',
    appliedFrom: r.appliedFrom,
    details: r.isIncrement ? 'Increment' : 'Transfer',
    incrementValue,
  };
}

export default function TransferAndPromotionsPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;
  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id;

  const [searchTerm, setSearchTerm] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [records, setRecords] = useState<TransferPromotionRecord[]>([]);
  const [totalEntries, setTotalEntries] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [viewRecordId, setViewRecordId] = useState<string | null>(null);
  const [viewDetail, setViewDetail] = useState<ApiRecord | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState<string | null>(null);

  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [sortBy, setSortBy] = useState<SortKey>('effectiveDate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!showExportMenu) return;
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showExportMenu]);

  useEffect(() => {
    if (!organizationId) return;
    setLoading(true);
    setLoadError(null);
    transferPromotionService
      .getAll({
        organizationId,
        page: currentPage,
        limit: pageSize,
        search: searchTerm.trim() || undefined,
      })
      .then((res) => {
        setRecords(res.transferPromotions.map(mapApiRecordToDisplay));
        setTotalEntries(res.pagination.total);
      })
      .catch((err: { response?: { data?: { message?: string } }; message?: string }) => {
        setLoadError(err.response?.data?.message || err.message || 'Failed to load records');
        setRecords([]);
        setTotalEntries(0);
      })
      .finally(() => setLoading(false));
  }, [organizationId, currentPage, pageSize, searchTerm]);

  useEffect(() => {
    if (!viewRecordId) {
      setViewDetail(null);
      setViewError(null);
      return;
    }
    setViewLoading(true);
    setViewError(null);
    transferPromotionService
      .getById(viewRecordId)
      .then((record) => {
        setViewDetail(record);
      })
      .catch((err: { response?: { data?: { message?: string } }; message?: string }) => {
        setViewError(err.response?.data?.message || err.message || 'Failed to load record');
        setViewDetail(null);
      })
      .finally(() => setViewLoading(false));
  }, [viewRecordId]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const totalPages = Math.max(1, Math.ceil(totalEntries / pageSize));
  const startEntry = totalEntries === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endEntry = Math.min(currentPage * pageSize, totalEntries);

  const sortedRecords = useMemo(() => {
    const list = [...records];
    const mult = sortOrder === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'associateCode') cmp = (a.associateCode ?? '').localeCompare(b.associateCode ?? '');
      else if (sortBy === 'associateName') cmp = (a.associateName ?? '').localeCompare(b.associateName ?? '');
      else if (sortBy === 'effectiveDate') cmp = (a.effectiveDateIso ?? '').localeCompare(b.effectiveDateIso ?? '');
      else if (sortBy === 'appliedFrom') cmp = (a.appliedFrom ?? '').localeCompare(b.appliedFrom ?? '');
      else if (sortBy === 'details') cmp = (a.details ?? '').localeCompare(b.details ?? '');
      return mult * cmp;
    });
    return list;
  }, [records, sortBy, sortOrder]);

  const handleSort = (key: SortKey) => {
    setSortOrder((prev) => (sortBy === key && prev === 'asc' ? 'desc' : 'asc'));
    setSortBy(key);
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortBy !== column) return <span className="inline-block w-4 opacity-0 group-hover:opacity-40">↕</span>;
    return sortOrder === 'asc' ? (
      <span className="inline-block w-4 text-gray-700">↑</span>
    ) : (
      <span className="inline-block w-4 text-gray-700">↓</span>
    );
  };

  const handleAdd = () => {
    navigate('/transaction/transfer-promotions/add');
  };

  const handleExportExcel = () => {
    setShowExportMenu(false);
    if (!records.length) {
      alert('No records to export.');
      return;
    }
    const headers = ['Associate Code', 'Associate Name', 'Effective Date', 'Applied From', 'Details', 'Increment Value'];
    const rows = records.map((r) => [
      r.associateCode,
      r.associateName,
      r.effectiveDate,
      r.appliedFrom,
      r.details,
      r.incrementValue != null ? String(r.incrementValue) : '',
    ]);
    const csvContent = [headers, ...rows]
      .map((row) =>
        row
          .map((value) => {
            const safe = String(value ?? '').replace(/"/g, '""');
            return `"${safe}"`;
          })
          .join(',')
      )
      .join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `increment-list_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    setShowExportMenu(false);
    if (!records.length) {
      alert('No records to export.');
      return;
    }
    const rowsHtml = records
      .map(
        (r) =>
          `<tr>
            <td>${r.associateCode}</td>
            <td>${r.associateName}</td>
            <td>${r.effectiveDate}</td>
            <td>${r.appliedFrom}</td>
            <td>${r.details}</td>
            <td>${r.incrementValue != null ? r.incrementValue : ''}</td>
          </tr>`
      )
      .join('');
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Increment List Export</title>
          <style>
            body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 16px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; }
            th { background: #f3f4f6; text-align: left; }
          </style>
        </head>
        <body>
          <h2>Increment List</h2>
          <table>
            <thead>
              <tr>
                <th>Associate Code</th>
                <th>Associate Name</th>
                <th>Effective Date</th>
                <th>Applied From</th>
                <th>Details</th>
                <th>Increment Value</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          <script>window.onload = function () { window.print(); };</script>
        </body>
      </html>
    `;
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  };

  const handleView = (record: TransferPromotionRecord) => {
    setViewRecordId(record.id);
  };

  const handleEdit = (record: TransferPromotionRecord) => {
    navigate(`/transaction/transfer-promotions/edit/${record.id}`);
  };

  const closeViewModal = () => {
    setViewRecordId(null);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader
        title="Increment"
        subtitle={organizationName ? organizationName : undefined}
        onLogout={handleLogout}
      />

      <main className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-6 bg-gray-50">
        <div className="w-full max-w-[1600px] mx-auto">
          {/* Breadcrumbs - same pattern as Employee List: Transaction > Transaction > Increment List */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
            <nav className="flex items-center gap-1.5 text-sm text-gray-500" aria-label="Breadcrumb">
              <span className="font-semibold text-gray-900">Transaction</span>
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span className="text-gray-500">Transaction</span>
              <span className="mx-1 text-gray-400">/</span>
              <span className="text-gray-500">Increment List</span>
            </nav>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative" ref={exportMenuRef}>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setShowExportMenu((open) => !open); }}
                  className="h-9 px-3 flex items-center gap-1 border border-gray-300 rounded-lg bg-gray-50 text-sm text-gray-700 hover:bg-gray-100 transition"
                >
                  Export
                  <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showExportMenu && (
                  <div className="absolute right-0 mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1">
                    <button
                      type="button"
                      onClick={handleExportPdf}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      Export as PDF
                    </button>
                    <button
                      type="button"
                      onClick={handleExportExcel}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Export as Excel
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={handleAdd}
                className="h-9 px-4 py-2 rounded-lg bg-orange-500 text-white font-medium text-sm hover:bg-orange-600 transition"
              >
                + Add
              </button>
            </div>
          </div>

          {/* Total Records card and Search - same grid as Employee list (each 1 column width on lg) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex items-center gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-orange-500 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500">Total Records</div>
                <div className="text-2xl font-bold text-gray-900">{totalEntries}</div>
              </div>
            </div>
            <div className="flex flex-col sm:col-start-2 lg:col-start-4">
              <label className="text-sm font-medium text-gray-500 mb-1.5">Search</label>
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="h-10 w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-700 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {loadError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              <p className="font-semibold">Error loading records</p>
              <p className="text-sm mt-1">{loadError}</p>
            </div>
          )}

          {/* Table card - same structure as Employee list */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>Row Per Page</span>
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                  className="h-9 px-3 py-1 bg-white border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>{n} Entries</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 table-fixed">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="w-[14%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button type="button" onClick={() => handleSort('associateCode')} className="inline-flex items-center gap-1 group font-medium">
                        Associate Code <SortIcon column="associateCode" />
                      </button>
                    </th>
                    <th className="w-[20%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button type="button" onClick={() => handleSort('associateName')} className="inline-flex items-center gap-1 group font-medium">
                        Associate Name <SortIcon column="associateName" />
                      </button>
                    </th>
                    <th className="w-[14%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button type="button" onClick={() => handleSort('effectiveDate')} className="inline-flex items-center gap-1 group font-medium">
                        Effective Date <SortIcon column="effectiveDate" />
                      </button>
                    </th>
                    <th className="w-[14%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button type="button" onClick={() => handleSort('appliedFrom')} className="inline-flex items-center gap-1 group font-medium">
                        Applied From <SortIcon column="appliedFrom" />
                      </button>
                    </th>
                    <th className="w-[14%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button type="button" onClick={() => handleSort('details')} className="inline-flex items-center gap-1 group font-medium">
                        Details <SortIcon column="details" />
                      </button>
                    </th>
                    <th className="w-[14%] px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                        Loading...
                      </td>
                    </tr>
                  ) : sortedRecords.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                        No records found. Add one using the Add button.
                      </td>
                    </tr>
                  ) : (
                    sortedRecords.map((record) => (
                      <tr key={record.id} className="hover:bg-gray-50">
                        <td className="w-[14%] px-4 py-4 whitespace-nowrap text-left">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-medium text-gray-500">
                                {record.associateName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                              </span>
                            </div>
                            <span className="text-sm font-medium text-gray-900 truncate block">{record.associateCode}</span>
                          </div>
                        </td>
                        <td className="w-[20%] px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-left truncate">
                          {record.associateName}
                        </td>
                        <td className="w-[14%] px-4 py-4 whitespace-nowrap text-sm text-gray-600 text-left">
                          {record.effectiveDate}
                        </td>
                        <td className="w-[14%] px-4 py-4 whitespace-nowrap text-sm text-gray-600 text-left">
                          {record.appliedFrom}
                        </td>
                        <td className="w-[14%] px-4 py-4 whitespace-nowrap text-left">
                          <span className="inline-flex px-2 py-1 text-xs font-medium rounded bg-amber-100 text-amber-800">
                            {record.details}
                          </span>
                        </td>
                        <td className="w-[14%] px-4 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleView(record)}
                              className="p-2 rounded text-blue-600 hover:bg-blue-50"
                              title="View"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEdit(record)}
                              className="p-2 rounded text-indigo-600 hover:bg-indigo-50"
                              title="Edit"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination - same as Employee list */}
            {totalEntries > 0 && (
              <div className="px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 flex-wrap gap-2 bg-white">
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{startEntry}</span> to{' '}
                  <span className="font-medium">{endEntry}</span> of{' '}
                  <span className="font-medium">{totalEntries}</span> results
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-lg bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="px-3 py-1.5 text-sm text-gray-600">Page {currentPage} of {totalPages}</span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages || totalPages === 0}
                    className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-lg bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* View record details modal */}
        {viewRecordId != null && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            role="dialog"
            aria-modal="true"
            aria-labelledby="view-record-title"
          >
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <h2 id="view-record-title" className="text-lg font-semibold text-gray-900">
                  Record Details
                </h2>
                <button
                  type="button"
                  onClick={closeViewModal}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
                  aria-label="Close"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-4">
                {viewLoading && (
                  <div className="py-8 text-center text-gray-500">Loading...</div>
                )}
                {viewError && (
                  <div className="py-4 px-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {viewError}
                  </div>
                )}
                {!viewLoading && !viewError && viewDetail && (
                  <div className="space-y-5">
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                      <div className="flex gap-3 sm:gap-4">
                        <dt className="text-gray-500 font-medium shrink-0 w-28 sm:w-32">Associate Code</dt>
                        <dd className="text-gray-900">{viewDetail.employee?.employeeCode ?? '-'}</dd>
                      </div>
                      <div className="flex gap-3 sm:gap-4">
                        <dt className="text-gray-500 font-medium shrink-0 w-28 sm:w-32">Associate Name</dt>
                        <dd className="text-gray-900">
                          {viewDetail.employee
                            ? [viewDetail.employee.firstName, viewDetail.employee.middleName, viewDetail.employee.lastName]
                                .filter(Boolean)
                                .join(' ')
                            : '-'}
                        </dd>
                      </div>
                      <div className="flex gap-3 sm:gap-4">
                        <dt className="text-gray-500 font-medium shrink-0 w-28 sm:w-32">Paygroup</dt>
                        <dd className="text-gray-900">{viewDetail.paygroup?.name ?? '-'}</dd>
                      </div>
                      <div className="flex gap-3 sm:gap-4">
                        <dt className="text-gray-500 font-medium shrink-0 w-28 sm:w-32">Effective Date</dt>
                        <dd className="text-gray-900">{viewDetail.effectiveDate ? formatEffectiveDate(viewDetail.effectiveDate) : '-'}</dd>
                      </div>
                      <div className="flex gap-3 sm:gap-4">
                        <dt className="text-gray-500 font-medium shrink-0 w-28 sm:w-32">Applied From</dt>
                        <dd className="text-gray-900">{viewDetail.appliedFrom ?? '-'}</dd>
                      </div>
                      <div className="flex gap-3 sm:gap-4">
                        <dt className="text-gray-500 font-medium shrink-0 w-28 sm:w-32">Type</dt>
                        <dd>
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${viewDetail.isIncrement ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-800'}`}>
                            {viewDetail.isIncrement ? 'Increment' : 'Transfer'}
                          </span>
                        </dd>
                      </div>
                    </dl>
                    {viewDetail.isIncrement && (
                      <>
                        <div className="border-t border-gray-200 pt-4">
                          <h3 className="text-sm font-medium text-gray-700 mb-3">Increment</h3>
                          <dl className="space-y-2 text-sm">
                            <div className="flex gap-3 sm:gap-4">
                              <dt className="text-gray-500 font-medium shrink-0 w-28 sm:w-32">Increment From</dt>
                              <dd className="text-gray-900">{viewDetail.incrementFrom ? formatEffectiveDate(viewDetail.incrementFrom) : '-'}</dd>
                            </div>
                            <div className="flex gap-3 sm:gap-4">
                              <dt className="text-gray-500 font-medium shrink-0 w-28 sm:w-32">After LOP</dt>
                              <dd className="text-gray-900 tabular-nums">{viewDetail.afterLOP ?? 0}</dd>
                            </div>
                            <div className="flex gap-3 sm:gap-4">
                              <dt className="text-gray-500 font-medium shrink-0 w-28 sm:w-32">Before LOP</dt>
                              <dd className="text-gray-900 tabular-nums">{viewDetail.beforeLOP ?? 0}</dd>
                            </div>
                          </dl>
                        </div>
                        {viewDetail.incrementComponents && viewDetail.incrementComponents.length > 0 && (
                          <div className="border-t border-gray-200 pt-4">
                            <h3 className="text-sm font-medium text-gray-700 mb-3">Increment Components</h3>
                            <div className="overflow-x-auto border border-gray-200 rounded-lg">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Component</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Current Value</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Increment Value</th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {viewDetail.incrementComponents.map((row, idx) => (
                                    <tr key={idx}>
                                      <td className="px-4 py-3 text-sm text-gray-900">{row.component}</td>
                                      <td className="px-4 py-3 text-sm text-gray-900 text-right tabular-nums">{Number(row.currentValue).toFixed(2)}</td>
                                      <td className="px-4 py-3 text-sm text-gray-900 text-right tabular-nums">{Number(row.incrementValue).toFixed(2)}</td>
                                    </tr>
                                  ))}
                                  <tr className="bg-gray-50 font-medium">
                                    <td className="px-4 py-3 text-sm text-gray-900">Total</td>
                                    <td className="px-4 py-3 text-sm text-gray-900 text-right tabular-nums">
                                      {viewDetail.incrementComponents
                                        .reduce((s, r) => s + Number(r.currentValue), 0)
                                        .toFixed(2)}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-900 text-right tabular-nums">
                                      {viewDetail.incrementComponents
                                        .reduce((s, r) => s + Number(r.incrementValue), 0)
                                        .toFixed(2)}
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">
                <button
                  type="button"
                  onClick={closeViewModal}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
