import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';
import BackNavigation from '../components/common/BackNavigation';
import postToPayrollService, {
  type PostToPayrollMapping,
  type PostToPayrollRowInput,
  type ColumnOption,
} from '../services/postToPayroll.service';

const FORMAT_OPTIONS = [
  { value: 'HH:MM', label: 'HH:MM' },
  { value: '0.00', label: '0.00' },
  { value: '0', label: '0' },
];

type RowState = {
  localId: string;
  columnKey: string;
  columnName: string;
  format: string;
  elementMapping: string;
};

function toRowState(m: PostToPayrollMapping): RowState {
  return {
    localId: m.id,
    columnKey: m.columnKey,
    columnName: m.columnName,
    format: m.format,
    elementMapping: m.elementMapping ?? '',
  };
}

export default function PostToPayrollPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id;
  const organizationName = user?.employee?.organization?.name;

  const [rows, setRows] = useState<RowState[]>([]);
  const [showAll, setShowAll] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [columnOptions, setColumnOptions] = useState<ColumnOption[]>([]);
  const [elementMappingOptions, setElementMappingOptions] = useState<string[]>([]);

  const fetchColumnOptions = async () => {
    try {
      const opts = await postToPayrollService.getColumnOptions();
      setColumnOptions(opts);
    } catch {
      setColumnOptions([]);
    }
  };

  const fetchElementMappingOptions = async () => {
    if (!organizationId) return;
    try {
      const names = await postToPayrollService.getSalaryElementNames(organizationId);
      setElementMappingOptions(names);
    } catch {
      setElementMappingOptions([]);
    }
  };

  const fetchList = async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await postToPayrollService.getList(organizationId, showAll);
      setRows(list.map((m) => toRowState(m)));
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : 'Failed to load mappings';
      setError(String(msg));
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchColumnOptions();
  }, []);

  useEffect(() => {
    if (organizationId) {
      fetchElementMappingOptions();
    }
  }, [organizationId]);

  useEffect(() => {
    fetchList();
  }, [organizationId, showAll]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const addRow = () => {
    const firstCol = columnOptions[0];
    setRows((prev) => [
      ...prev,
      {
        localId: `new-${Date.now()}`,
        columnKey: firstCol?.key ?? '',
        columnName: firstCol ? firstCol.label.replace('Post To Payroll.', '').trim() : '',
        format: firstCol?.format ?? '0.00',
        elementMapping: '',
      },
    ]);
  };

  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const updateRow = (index: number, field: keyof RowState, value: string) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleSave = async () => {
    if (!organizationId) {
      setError('Organization not found. Please contact administrator.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const payload: PostToPayrollRowInput[] = rows.map((r, i) => ({
        columnKey: r.columnKey,
        columnName: r.columnName || r.columnKey,
        format: r.format,
        elementMapping: r.elementMapping || null,
        orderIndex: i,
      }));
      const list = await postToPayrollService.saveAll(organizationId, payload);
      setRows(list.map((m) => toRowState(m)));
      setSuccessMsg('Mappings saved successfully.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string }; status?: number } };
      const msg =
        axiosErr?.response?.data?.message ||
        (axiosErr?.response?.status === 403 ? 'Access denied.' : 'Failed to save. Please try again.');
      setError(String(msg));
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
      <BackNavigation to="/others-configuration" label="Others Configuration" />
      <AppHeader
        title="Post to Payroll Setup"
        subtitle={organizationName ? organizationName : undefined}
        onLogout={handleLogout}
      />

      <main className="flex-1 min-h-0 overflow-auto w-full bg-gray-100">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-6 bg-gray-50">
          {/* Breadcrumbs - Employee module style */}
          <div className="mb-6">
            <nav className="flex items-center text-sm text-gray-600" aria-label="Breadcrumb">
              <Link to="/others-configuration" className="text-gray-500 hover:text-gray-900">
                Others Configuration
              </Link>
              <span className="mx-1 text-gray-400">/</span>
              <span className="font-semibold text-gray-900">Post to Payroll Setup</span>
            </nav>
          </div>

          {/* Title bar - project theme (gray, not blue) */}
          <div className="bg-white rounded-lg shadow border border-gray-200 mb-6 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h1 className="text-2xl font-bold text-gray-900">Post to Payroll Setup</h1>
              <p className="text-sm text-gray-600 mt-1">
                Map attendance columns to payroll elements. Add rows and save.
              </p>
            </div>

            {!organizationId && (
              <div className="px-6 py-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                No organization assigned. Please contact your administrator.
              </div>
            )}

            {organizationId && (
              <>
                {error && (
                  <div className="mx-6 mt-4 rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
                    {error}
                  </div>
                )}
                {successMsg && (
                  <div className="mx-6 mt-4 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 text-sm">
                    {successMsg}
                  </div>
                )}

                {/* Table toolbar: Add row */}
                <div className="px-6 py-3 border-b border-gray-200 flex justify-end">
                  <button
                    type="button"
                    onClick={addRow}
                    className="h-9 px-4 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 transition inline-flex items-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add row
                  </button>
                </div>

                {/* Table - project theme: thead bg-gray-50 */}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Column
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Column Name
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Format
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Element Mapping
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {loading ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-gray-500 text-sm">
                            Loading…
                          </td>
                        </tr>
                      ) : rows.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-gray-500 text-sm">
                            No mappings. Click &quot;Add row&quot; to add one.
                          </td>
                        </tr>
                      ) : (
                        rows.map((row, index) => (
                          <tr key={row.localId} className="hover:bg-gray-50">
                            <td className="px-4 py-2">
                              <select
                                value={row.columnKey}
                                onChange={(e) => {
                                  const opt = columnOptions.find((o) => o.key === e.target.value);
                                  updateRow(index, 'columnKey', e.target.value);
                                  if (opt) {
                                    updateRow(index, 'columnName', opt.label.replace('Post To Payroll.', '').trim());
                                    updateRow(index, 'format', opt.format);
                                  }
                                }}
                                className="w-full min-w-[180px] h-9 px-3 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
                              >
                                {columnOptions.map((o) => (
                                  <option key={o.key} value={o.key}>
                                    {o.label}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-2">
                              <input
                                type="text"
                                value={row.columnName}
                                onChange={(e) => updateRow(index, 'columnName', e.target.value)}
                                className="w-full min-w-[140px] h-9 px-3 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
                                placeholder="Column Name"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <select
                                value={row.format}
                                onChange={(e) => updateRow(index, 'format', e.target.value)}
                                className="w-full min-w-[80px] h-9 px-3 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
                              >
                                {FORMAT_OPTIONS.map((o) => (
                                  <option key={o.value} value={o.value}>
                                    {o.value}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-1">
                                <select
                                  value={row.elementMapping}
                                  onChange={(e) => updateRow(index, 'elementMapping', e.target.value)}
                                  className="flex-1 min-w-[120px] h-9 px-3 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
                                >
                                  <option value="">—</option>
                                  {elementMappingOptions.map((name) => (
                                    <option key={name} value={name}>
                                      {name}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  onClick={() => updateRow(index, 'elementMapping', '')}
                                  className="p-1.5 rounded text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                                  title="Clear mapping"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                            <td className="px-4 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => removeRow(index)}
                                className="p-1.5 rounded text-gray-500 hover:bg-red-50 hover:text-red-600"
                                title="Delete"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Filters - Show All - project theme */}
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center gap-3">
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

                {/* Save - project theme (orange) */}
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || loading}
                    className="h-9 px-4 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition inline-flex items-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
