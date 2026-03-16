import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';
import employeeService, { Employee } from '../services/employee.service';

type SortKey = 'associateName' | 'associateCode';
type SortOrder = 'asc' | 'desc';

interface RowState {
  id: string;
  associateName: string;
  associateCode: string;
  newCode: string;
  profilePictureUrl?: string;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

function fullName(e: Employee): string {
  return [e.firstName, e.middleName, e.lastName].filter(Boolean).join(' ') || '-';
}

export default function EmpCodeTransferPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;
  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id;

  const [searchTerm, setSearchTerm] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [rows, setRows] = useState<RowState[]>([]);
  const [totalEntries, setTotalEntries] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
        setTotalEntries(res.pagination.total);
        setRows(
          res.employees.map((e) => ({
            id: e.id,
            associateName: fullName(e),
            associateCode: e.employeeCode ?? '-',
            newCode: '',
            profilePictureUrl: e.profilePictureUrl,
          }))
        );
      })
      .catch((err: { response?: { data?: { message?: string } }; message?: string }) => {
        setLoadError(err.response?.data?.message || err.message || 'Failed to load employees');
        setRows([]);
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

  const sortedRows = useMemo(() => {
    const list = [...rows];
    const mult = sortOrder === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'associateName') cmp = (a.associateName ?? '').localeCompare(b.associateName ?? '');
      else if (sortBy === 'associateCode') cmp = (a.associateCode ?? '').localeCompare(b.associateCode ?? '');
      return mult * cmp;
    });
    return list;
  }, [rows, sortBy, sortOrder]);

  const handleSort = (key: SortKey) => {
    setSortOrder((prev) => (sortBy === key && prev === 'asc' ? 'desc' : 'asc'));
    setSortBy(key);
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortBy !== column) return <span className="inline-block w-4 opacity-0 group-hover:opacity-40">↕</span>;
    return sortOrder === 'asc' ? <span className="inline-block w-4 text-gray-700">↑</span> : <span className="inline-block w-4 text-gray-700">↓</span>;
  };

  const handleExportExcel = () => {
    setShowExportMenu(false);
    if (!rows.length) {
      alert('No records to export.');
      return;
    }
    const headers = ['Associate Name', 'Associate Code', 'New Code'];
    const rowsData = rows.map((r) => [r.associateName, r.associateCode, r.newCode]);
    const csvContent = [headers, ...rowsData]
      .map((row) => row.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `emp-code-transfer_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    setShowExportMenu(false);
    if (!rows.length) {
      alert('No records to export.');
      return;
    }
    const rowsHtml = rows.map((r) => `<tr><td>${r.associateName}</td><td>${r.associateCode}</td><td>${r.newCode}</td></tr>`).join('');
    const html = `<!DOCTYPE html><html><head><title>Emp Code Transfer Export</title><style>body{font-family:system-ui,sans-serif;padding:16px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;font-size:12px}th{background:#f3f4f6;text-align:left}</style></head><body><h2>Emp Code Transfer</h2><table><thead><tr><th>Associate Name</th><th>Associate Code</th><th>New Code</th></tr></thead><tbody>${rowsHtml}</tbody></table><script>window.onload=function(){window.print()}<\/script></body></html>`;
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
  };

  const handleSave = async () => {
    const withNewCode = rows.filter((r) => r.newCode.trim());
    if (withNewCode.length === 0) {
      alert('Enter at least one New Code to save.');
      return;
    }
    setSubmitting(true);
    try {
      await Promise.all(
        withNewCode.map((r) =>
          employeeService.update(r.id, { employeeCode: r.newCode.trim() })
        )
      );
      // Refetch current page so Associate Code column and employee form show updated codes
      if (organizationId) {
        const res = await employeeService.getAll({
          organizationId,
          page: currentPage,
          limit: pageSize,
          search: searchTerm.trim() || undefined,
          employeeStatus: 'ACTIVE',
        });
        setTotalEntries(res.pagination.total);
        setRows(
          res.employees.map((e) => ({
            id: e.id,
            associateName: fullName(e),
            associateCode: e.employeeCode ?? '-',
            newCode: '',
            profilePictureUrl: e.profilePictureUrl,
          }))
        );
      }
      alert(`Saved: ${withNewCode.length} employee code(s) updated. They will appear in the employee form.`);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      alert(e.response?.data?.message || e.message || 'Failed to update employee code(s).');
    } finally {
      setSubmitting(false);
    }
  };

  const setNewCode = (employeeId: string, value: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === employeeId ? { ...r, newCode: value } : r))
    );
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader
        title="Emp Code Transfer"
        subtitle={organizationName ? organizationName : undefined}
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
              <span className="text-gray-500">Emp Code Transfer</span>
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
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex items-center gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-green-600 flex items-center justify-center">
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
                    <th className="w-[35%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button type="button" onClick={() => handleSort('associateName')} className="inline-flex items-center gap-1 group font-medium">
                        Associate Name <SortIcon column="associateName" />
                      </button>
                    </th>
                    <th className="w-[25%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button type="button" onClick={() => handleSort('associateCode')} className="inline-flex items-center gap-1 group font-medium">
                        Associate Code <SortIcon column="associateCode" />
                      </button>
                    </th>
                    <th className="w-[40%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">New Code</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-gray-500">Loading...</td>
                    </tr>
                  ) : sortedRows.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-gray-500">No employees found.</td>
                    </tr>
                  ) : (
                    sortedRows.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50">
                        <td className="w-[35%] px-4 py-4 whitespace-nowrap text-left">
                          <div className="flex items-center gap-3">
                            {row.profilePictureUrl ? (
                              <img src={row.profilePictureUrl} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                                <span className="text-xs font-medium text-gray-500">
                                  {row.associateName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                                </span>
                              </div>
                            )}
                            <span className="text-sm font-medium text-gray-900 truncate block">{row.associateName}</span>
                          </div>
                        </td>
                        <td className="w-[25%] px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-left">{row.associateCode}</td>
                        <td className="w-[40%] px-4 py-4 whitespace-nowrap text-left">
                          <input
                            type="text"
                            placeholder="New Code"
                            value={row.newCode}
                            onChange={(e) => setNewCode(row.id, e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
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

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setRows((prev) => prev.map((r) => ({ ...r, newCode: '' })))}
              className="flex items-center gap-2 px-5 py-2.5 border border-gray-300 bg-white text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Save
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
