import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';
import postToPayrollService, {
  type PostToPayrollMapping,
  type PostToPayrollRowInput,
} from '../services/postToPayroll.service';

const COLUMN_OPTIONS = [
  { value: 'Post To Payroll.Over Time', label: 'Post To Payroll.Over Time' },
  { value: 'Post To Payroll.LOP Current Month Used', label: 'Post To Payroll.LOP Current Mon...' },
  { value: 'Post To Payroll.NFH', label: 'Post To Payroll.NFH' },
  { value: 'Post To Payroll.WO', label: 'Post To Payroll.WO' },
];

const ELEMENT_MAPPING_OPTIONS = [
  { value: 'OT Hours', label: 'OT Hours' },
  { value: 'Loss of Pay', label: 'Loss of Pay' },
  { value: 'NFH', label: 'NFH' },
  { value: 'WeekOff', label: 'WeekOff' },
];

const FORMAT_OPTIONS = [
  { value: '00:00', label: '00:00' },
  { value: '0.00', label: '0.00' },
];

type RowState = {
  localId: string;
  columnKey: string;
  columnName: string;
  format: string;
  elementMapping: string;
};

function toRowState(m: PostToPayrollMapping, index: number): RowState {
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

  const fetchList = async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await postToPayrollService.getList(organizationId, showAll);
      setRows(list.map((m, i) => toRowState(m, i)));
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
    fetchList();
  }, [organizationId, showAll]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      {
        localId: `new-${Date.now()}`,
        columnKey: COLUMN_OPTIONS[0]?.value ?? '',
        columnName: '',
        format: FORMAT_OPTIONS[0]?.value ?? '0.00',
        elementMapping: '',
      },
    ]);
  };

  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const moveUp = (index: number) => {
    if (index <= 0) return;
    setRows((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  };

  const moveDown = (index: number) => {
    if (index >= rows.length - 1) return;
    setRows((prev) => {
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  };

  const updateRow = (index: number, field: keyof RowState, value: string) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleSave = async () => {
    if (!organizationId) return;
    setSaving(true);
    setError(null);
    try {
      const payload: PostToPayrollRowInput[] = rows.map((r, i) => ({
        columnKey: r.columnKey,
        columnName: r.columnName || r.columnKey,
        format: r.format,
        elementMapping: r.elementMapping || null,
        orderIndex: i,
      }));
      const list = await postToPayrollService.saveAll(organizationId, payload);
      setRows(list.map((m, i) => toRowState(m, i)));
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : 'Failed to save';
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
      <AppHeader
        title="Post to Payroll"
        subtitle={organizationName ? `Organization: ${organizationName}` : undefined}
        onLogout={handleLogout}
      />

      <main className="flex-1 min-h-0 overflow-auto w-full bg-gray-100">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6 bg-gray-50">
          {/* Breadcrumbs - Employee module style */}
          <div className="mb-6">
            <nav className="flex items-center text-sm text-gray-600" aria-label="Breadcrumb">
              <Link to="/others-configuration" className="text-gray-500 hover:text-gray-900">
                Others Configuration
              </Link>
              <span className="mx-1 text-gray-400">/</span>
              <span className="font-semibold text-gray-900">Post to Payroll</span>
            </nav>
          </div>

          {/* Title bar - project theme (gray, not blue) */}
          <div className="bg-white rounded-lg shadow border border-gray-200 mb-6 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h1 className="text-2xl font-bold text-gray-900">Post to Payroll</h1>
              <p className="text-sm text-gray-600 mt-1">
                Map attendance columns to payroll elements. Add rows, set order, and save.
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
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                          Order
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {loading ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-gray-500 text-sm">
                            Loading…
                          </td>
                        </tr>
                      ) : rows.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-gray-500 text-sm">
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
                                  const opt = COLUMN_OPTIONS.find((o) => o.value === e.target.value);
                                  updateRow(index, 'columnKey', e.target.value);
                                  if (opt && !row.columnName) {
                                    const name = opt.value.replace('Post To Payroll.', '').trim();
                                    updateRow(index, 'columnName', name);
                                  }
                                }}
                                className="w-full min-w-[180px] h-9 px-3 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
                              >
                                {COLUMN_OPTIONS.map((o) => (
                                  <option key={o.value} value={o.value}>
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
                                  {ELEMENT_MAPPING_OPTIONS.map((o) => (
                                    <option key={o.value} value={o.value}>
                                      {o.label}
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
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-0.5">
                                <button
                                  type="button"
                                  onClick={() => moveUp(index)}
                                  disabled={index === 0}
                                  className="p-1.5 rounded border border-gray-300 bg-white text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                                  aria-label="Move up"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveDown(index)}
                                  disabled={index === rows.length - 1}
                                  className="p-1.5 rounded border border-gray-300 bg-white text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                                  aria-label="Move down"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l7 7-7 7" />
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
