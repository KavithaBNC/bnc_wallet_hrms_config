import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';
import transferPromotionService, { TransferPromotionRecord as ApiRecord } from '../services/transfer-promotion.service';

export interface TransferPromotionRecord {
  id: string;
  associateCode: string;
  associateName: string;
  effectiveDate: string;
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
  const filteredRecords = records;

  const handleAdd = () => {
    navigate('/transaction/transfer-promotions/add');
  };
  const handlePrint = () => {
    window.print();
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
        title="Transaction"
        subtitle={organizationName ? `Organization: ${organizationName}` : undefined}
        onLogout={handleLogout}
      />

      <main className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-6 bg-gray-50">
        <div className="w-full max-w-[1600px] mx-auto">
          {/* Breadcrumbs - Transaction / Increment */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
            <nav className="flex items-center gap-1.5 text-sm text-gray-500" aria-label="Breadcrumb">
              <span className="font-semibold text-gray-900">Transaction</span>
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span className="text-gray-500">Transaction</span>
              <span className="mx-1 text-gray-400">/</span>
              <span className="text-gray-500">Increment</span>
            </nav>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handlePrint}
                className="h-9 px-3 flex items-center gap-1 border border-gray-300 rounded-lg bg-gray-50 text-sm text-gray-700 hover:bg-gray-100 transition"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print
              </button>
              <button
                onClick={handleAdd}
                className="h-9 px-4 py-2 rounded-lg bg-orange-500 text-white font-medium text-sm hover:bg-orange-600 transition"
              >
                + Add
              </button>
            </div>
          </div>

          {/* Filters bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-500 mb-1.5">Search</label>
              <input
                type="text"
                placeholder="Associate Code, Associate Name..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="h-10 w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-700 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Summary card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex items-center gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#333333] flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500">Total Records</div>
                <div className="text-2xl font-bold text-gray-900">{totalEntries}</div>
              </div>
            </div>
          </div>

          {loadError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {loadError}
            </div>
          )}

          {/* Table card */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>Row Per Page</span>
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                  className="h-9 px-3 py-1 bg-white border border-gray-300 rounded text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>{n} Entries</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Associate Code
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Associate Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Effective Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Applied From
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Details
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                        Loading...
                      </td>
                    </tr>
                  ) : filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                        No records found. Add one using the Add button.
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((record) => (
                      <tr key={record.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-medium text-gray-500">
                                {record.associateName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                              </span>
                            </div>
                            <span className="text-sm font-medium text-gray-900">{record.associateCode}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {record.associateName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {record.effectiveDate}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {record.appliedFrom}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex px-2 py-1 text-xs font-medium rounded bg-amber-100 text-amber-800">
                            {record.details}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
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

            {/* Pagination - match Employee list */}
            {totalEntries > 0 && (
              <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 flex-wrap gap-2">
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
                  <div className="space-y-4">
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="text-gray-500 font-medium">Associate Code</dt>
                        <dd className="text-gray-900 mt-0.5">{viewDetail.employee?.employeeCode ?? '-'}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-500 font-medium">Associate Name</dt>
                        <dd className="text-gray-900 mt-0.5">
                          {viewDetail.employee
                            ? [viewDetail.employee.firstName, viewDetail.employee.middleName, viewDetail.employee.lastName]
                                .filter(Boolean)
                                .join(' ')
                            : '-'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-gray-500 font-medium">Paygroup</dt>
                        <dd className="text-gray-900 mt-0.5">{viewDetail.paygroup?.name ?? '-'}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-500 font-medium">Effective Date</dt>
                        <dd className="text-gray-900 mt-0.5">{viewDetail.effectiveDate ? formatEffectiveDate(viewDetail.effectiveDate) : '-'}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-500 font-medium">Applied From</dt>
                        <dd className="text-gray-900 mt-0.5">{viewDetail.appliedFrom ?? '-'}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-500 font-medium">Type</dt>
                        <dd className="mt-0.5">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${viewDetail.isIncrement ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-800'}`}>
                            {viewDetail.isIncrement ? 'Increment' : 'Transfer'}
                          </span>
                        </dd>
                      </div>
                    </dl>
                    {viewDetail.isIncrement && (
                      <>
                        <div className="border-t border-gray-200 pt-4">
                          <h3 className="text-sm font-medium text-gray-700 mb-2">Increment</h3>
                          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                            <div>
                              <dt className="text-gray-500 font-medium">Increment From</dt>
                              <dd className="text-gray-900 mt-0.5">{viewDetail.incrementFrom ? formatEffectiveDate(viewDetail.incrementFrom) : '-'}</dd>
                            </div>
                            <div>
                              <dt className="text-gray-500 font-medium">After LOP</dt>
                              <dd className="text-gray-900 mt-0.5">{viewDetail.afterLOP ?? 0}</dd>
                            </div>
                            <div>
                              <dt className="text-gray-500 font-medium">Before LOP</dt>
                              <dd className="text-gray-900 mt-0.5">{viewDetail.beforeLOP ?? 0}</dd>
                            </div>
                          </dl>
                        </div>
                        {viewDetail.incrementComponents && viewDetail.incrementComponents.length > 0 && (
                          <div className="border-t border-gray-200 pt-4">
                            <h3 className="text-sm font-medium text-gray-700 mb-2">Increment Components</h3>
                            <div className="overflow-x-auto border border-gray-200 rounded-lg">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Component</th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Current Value</th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Increment Value</th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {viewDetail.incrementComponents.map((row, idx) => (
                                    <tr key={idx}>
                                      <td className="px-4 py-2 text-sm text-gray-900">{row.component}</td>
                                      <td className="px-4 py-2 text-sm text-gray-900 text-right">{Number(row.currentValue).toFixed(2)}</td>
                                      <td className="px-4 py-2 text-sm text-gray-900 text-right">{Number(row.incrementValue).toFixed(2)}</td>
                                    </tr>
                                  ))}
                                  <tr className="bg-gray-50 font-medium">
                                    <td className="px-4 py-2 text-sm text-gray-900">Total</td>
                                    <td className="px-4 py-2 text-sm text-gray-900 text-right">
                                      {viewDetail.incrementComponents
                                        .reduce((s, r) => s + Number(r.currentValue), 0)
                                        .toFixed(2)}
                                    </td>
                                    <td className="px-4 py-2 text-sm text-gray-900 text-right">
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
