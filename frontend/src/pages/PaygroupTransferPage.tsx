import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';
import employeeService, { Employee } from '../services/employee.service';

type SortKey = 'associateCode' | 'associateName' | 'payGroup';
type SortOrder = 'asc' | 'desc';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

function fullName(e: Employee): string {
  const parts = [e.firstName, e.middleName, e.lastName].filter(Boolean);
  return parts.join(' ').trim() || '-';
}

export default function PaygroupTransferPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;
  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id;

  const [searchTerm, setSearchTerm] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [totalEntries, setTotalEntries] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [sortBy, setSortBy] = useState<SortKey>('associateName');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

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
    employeeService
      .getAll({
        organizationId,
        page: currentPage,
        limit: pageSize,
        search: searchTerm.trim() || undefined,
        employeeStatus: 'ACTIVE',
      })
      .then((res) => {
        setEmployees(res.employees || []);
        setTotalEntries(res.pagination?.total ?? 0);
      })
      .catch((err: { response?: { data?: { message?: string } }; message?: string }) => {
        setLoadError(err.response?.data?.message || err.message || 'Failed to load employees');
        setEmployees([]);
        setTotalEntries(0);
      })
      .finally(() => setLoading(false));
  }, [organizationId, currentPage, pageSize, searchTerm]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const totalPages = Math.max(1, Math.ceil(totalEntries / pageSize));
  const startEntry = totalEntries === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endEntry = Math.min(currentPage * pageSize, totalEntries);

  const sortedEmployees = useMemo(() => {
    const list = [...employees];
    const mult = sortOrder === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'associateCode') cmp = (a.employeeCode ?? '').localeCompare(b.employeeCode ?? '');
      else if (sortBy === 'associateName') cmp = fullName(a).localeCompare(fullName(b));
      else if (sortBy === 'payGroup') cmp = (a.paygroup?.name ?? '').localeCompare(b.paygroup?.name ?? '');
      return mult * cmp;
    });
    return list;
  }, [employees, sortBy, sortOrder]);

  const handleSort = (key: SortKey) => {
    setSortOrder((prev) => (sortBy === key && prev === 'asc' ? 'desc' : 'asc'));
    setSortBy(key);
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortBy !== column) return <span className="inline-block w-4 opacity-0 group-hover:opacity-40">↕</span>;
    return sortOrder === 'asc' ? <span className="inline-block w-4 text-gray-700">↑</span> : <span className="inline-block w-4 text-gray-700">↓</span>;
  };

  const handleAdd = () => navigate('/transaction/paygroup-transfer/add');

  const handleExportExcel = () => {
    setShowExportMenu(false);
    if (!employees.length) {
      alert('No records to export.');
      return;
    }
    const headers = ['Associate Code', 'Associate Name', 'Pay Group'];
    const rowsData = employees.map((e) => [e.employeeCode ?? '-', fullName(e), e.paygroup?.name ?? '-']);
    const csvContent = [headers, ...rowsData]
      .map((row) => row.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `paygroup-transfer_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    setShowExportMenu(false);
    if (!employees.length) {
      alert('No records to export.');
      return;
    }
    const rowsHtml = employees.map((e) => `<tr><td>${e.employeeCode ?? '-'}</td><td>${fullName(e)}</td><td>${e.paygroup?.name ?? '-'}</td></tr>`).join('');
    const html = `<!DOCTYPE html><html><head><title>Pay Group Transfer Export</title><style>body{font-family:system-ui,sans-serif;padding:16px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;font-size:12px}th{background:#f3f4f6;text-align:left}</style></head><body><h2>Pay Group Transfer</h2><table><thead><tr><th>Associate Code</th><th>Associate Name</th><th>Pay Group</th></tr></thead><tbody>${rowsHtml}</tbody></table><script>window.onload=function(){window.print()}<\/script></body></html>`;
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
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
          <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
            <nav className="flex items-center gap-1.5 text-sm text-gray-500" aria-label="Breadcrumb">
              <span className="font-semibold text-gray-900">Transaction</span>
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span className="text-gray-500">Transaction</span>
              <span className="mx-1 text-gray-400">/</span>
              <span className="text-gray-500">Pay Group Transfer</span>
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
                    <button type="button" onClick={handleExportPdf} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                      Export as PDF
                    </button>
                    <button type="button" onClick={handleExportExcel} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      Export as Excel
                    </button>
                  </div>
                )}
              </div>
              <button onClick={handleAdd} className="h-9 px-4 py-2 rounded-lg bg-orange-500 text-white font-medium text-sm hover:bg-orange-600 transition">
                + Add
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex items-center gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-pink-500 flex items-center justify-center">
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
                    <th className="w-[22%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button type="button" onClick={() => handleSort('associateCode')} className="inline-flex items-center gap-1 group font-medium">
                        Associate Code <SortIcon column="associateCode" />
                      </button>
                    </th>
                    <th className="w-[28%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button type="button" onClick={() => handleSort('associateName')} className="inline-flex items-center gap-1 group font-medium">
                        Associate Name <SortIcon column="associateName" />
                      </button>
                    </th>
                    <th className="w-[28%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button type="button" onClick={() => handleSort('payGroup')} className="inline-flex items-center gap-1 group font-medium">
                        Pay Group <SortIcon column="payGroup" />
                      </button>
                    </th>
                    <th className="w-[22%] px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-gray-500">Loading...</td>
                    </tr>
                  ) : sortedEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-gray-500">No employees found. Add a pay group transfer using the Add button.</td>
                    </tr>
                  ) : (
                    sortedEmployees.map((emp) => (
                      <tr key={emp.id} className="hover:bg-gray-50">
                        <td className="w-[22%] px-4 py-4 whitespace-nowrap text-left">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-medium text-gray-500">
                                {fullName(emp).split(' ').map((n) => n[0]).join('').slice(0, 2)}
                              </span>
                            </div>
                            <span className="text-sm font-medium text-gray-900 truncate block">{emp.employeeCode ?? '-'}</span>
                          </div>
                        </td>
                        <td className="w-[28%] px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-left truncate">{fullName(emp)}</td>
                        <td className="w-[28%] px-4 py-4 whitespace-nowrap text-sm text-gray-600 text-left">{emp.paygroup?.name ?? '-'}</td>
                        <td className="w-[22%] px-4 py-4 whitespace-nowrap text-right">
                          <button
                            onClick={() => navigate('/transaction/paygroup-transfer/add', { state: { employeeId: emp.id } })}
                            className="text-blue-600 hover:text-blue-800 p-1 rounded"
                            title="Transfer pay group"
                          >
                            <svg className="w-5 h-5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l4-4m0 6H4m0 0l4 4m-4-4l4-4" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 flex flex-wrap items-center justify-between gap-2 bg-gray-50 text-sm text-gray-700">
              <span>Showing {totalEntries === 0 ? 0 : startEntry} to {endEntry} of {totalEntries} results</span>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1} className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 font-medium disabled:opacity-50 hover:bg-gray-50">Previous</button>
                <span className="px-3 py-1.5">Page {currentPage} of {totalPages}</span>
                <button type="button" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 font-medium disabled:opacity-50 hover:bg-gray-50">Next</button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
