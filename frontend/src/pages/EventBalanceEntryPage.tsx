import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';
import Modal from '../components/common/Modal';

interface LeaveTypeOption {
  id: string;
  name: string;
  code?: string | null;
}

interface EventBalanceRow {
  employeeId: string;
  associate: string;
  employeeCode?: string | null;
  fromDate: string;
  toDate: string;
  openingDays: number;
  usedDays: number;
  availableDays: number;
  remarks: string;
}

interface FormState {
  employeeId: string;
  fromDate: string;
  toDate: string;
  openingDays: string;
  remarks: string;
}

interface EmployeeOption {
  employeeId: string;
  label: string;
}

const toInputDate = (value: string | Date) => {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export default function EventBalanceEntryPage() {
  const navigate = useNavigate();
  const { user, loadUser, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;
  const role = (user?.role || '').toUpperCase();
  const isHr = role === 'HR_MANAGER';

  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id;
  const currentYear = new Date().getFullYear();

  const [loadingUser, setLoadingUser] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeOption[]>([]);
  const [selectedLeaveTypeId, setSelectedLeaveTypeId] = useState('');
  const [year, setYear] = useState<number>(currentYear);
  const [rows, setRows] = useState<EventBalanceRow[]>([]);
  const [associateOptions, setAssociateOptions] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [form, setForm] = useState<FormState>({
    employeeId: '',
    fromDate: `${currentYear}-01-01`,
    toDate: `${currentYear}-12-31`,
    openingDays: '',
    remarks: '',
  });

  useEffect(() => {
    if (!organizationId && user && !loadingUser) {
      setLoadingUser(true);
      loadUser()
        .catch(() => {
          setError('Unable to load user details');
        })
        .finally(() => setLoadingUser(false));
    }
  }, [organizationId, user, loadingUser, loadUser]);

  useEffect(() => {
    if (!organizationId || !isHr) return;
    const loadTypes = async () => {
      try {
        const res = await api.get<{ data?: { leaveTypes?: LeaveTypeOption[] } }>('/leaves/types', {
          params: {
            organizationId,
            isActive: true,
            limit: 200,
          },
        });
        const list = res.data?.data?.leaveTypes || [];
        setLeaveTypes(list);
        if (list.length > 0) {
          setSelectedLeaveTypeId((prev) => prev || list[0].id);
        }
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Failed to load event types');
      }
    };
    loadTypes();
  }, [organizationId, isHr]);

  useEffect(() => {
    if (!organizationId || !isHr) return;
    const loadAssociates = async () => {
      try {
        const res = await api.get<{ data?: { employees?: Array<{ id: string; employeeCode?: string; firstName: string; lastName?: string | null }> } }>('/employees', {
          params: {
            organizationId,
            employeeStatus: 'ACTIVE',
            page: 1,
            limit: 2000,
          },
        });
        const employees = res.data?.data?.employees || [];
        const options = employees.map((e) => {
          const fullName = `${e.firstName || ''} ${e.lastName || ''}`.trim();
          return {
            employeeId: e.id,
            label: e.employeeCode ? `${fullName} [${e.employeeCode}]` : fullName,
          };
        });
        setAssociateOptions(options);
      } catch {
        setAssociateOptions([]);
      }
    };
    loadAssociates();
  }, [organizationId, isHr]);

  const fetchRows = async () => {
    if (!organizationId || !selectedLeaveTypeId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await api.get<{ data?: { entries?: EventBalanceRow[] } }>('/leaves/balance-entry', {
        params: {
          organizationId,
          leaveTypeId: selectedLeaveTypeId,
          year,
        },
      });
      const list = res.data?.data?.entries || [];
      setRows(list);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load event balance entries');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, selectedLeaveTypeId, year]);

  useEffect(() => {
    if (!showForm || isEditMode) return;
    setForm((prev) => ({
      ...prev,
      fromDate: `${year}-01-01`,
      toDate: `${year}-12-31`,
    }));
  }, [year, showForm, isEditMode]);

  const filteredRows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (row) =>
        row.associate.toLowerCase().includes(q) ||
        (row.employeeCode || '').toLowerCase().includes(q)
    );
  }, [rows, searchTerm]);

  const employeeOptions = useMemo(() => {
    return associateOptions;
  }, [associateOptions]);

  const resetForm = () => {
    setForm({
      employeeId: employeeOptions[0]?.employeeId || '',
      fromDate: `${year}-01-01`,
      toDate: `${year}-12-31`,
      openingDays: '',
      remarks: leaveTypes.find((l) => l.id === selectedLeaveTypeId)?.name || '',
    });
  };

  const handleOpenAdd = () => {
    setIsEditMode(false);
    resetForm();
    setShowForm(true);
  };

  const handleEdit = (row: EventBalanceRow) => {
    setIsEditMode(true);
    setAssociateOptions((prev) => {
      const exists = prev.some((p) => p.employeeId === row.employeeId);
      if (exists) return prev;
      const label = row.employeeCode ? `${row.associate} [${row.employeeCode}]` : row.associate;
      return [{ employeeId: row.employeeId, label }, ...prev];
    });
    setForm({
      employeeId: row.employeeId,
      fromDate: toInputDate(row.fromDate),
      toDate: toInputDate(row.toDate),
      openingDays: String(row.openingDays),
      remarks: row.remarks || '',
    });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId) return;
    if (!form.employeeId) {
      setError('Associate is required');
      return;
    }
    const openingDays = Number(form.openingDays);
    if (!Number.isFinite(openingDays) || openingDays < 0) {
      setError('Opening days must be a valid non-negative number');
      return;
    }
    if (!form.fromDate || !form.toDate) {
      setError('From Date and To Date are required');
      return;
    }
    if (form.toDate < form.fromDate) {
      setError('To Date must be on or after From Date');
      return;
    }
    if (
      new Date(form.fromDate).getFullYear() !== year ||
      new Date(form.toDate).getFullYear() !== year
    ) {
      setError('From Date and To Date must be within selected year');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await api.put('/leaves/balance-entry', {
        organizationId,
        employeeId: form.employeeId,
        leaveTypeId: selectedLeaveTypeId,
        // Keep update in selected grid year; avoid accidental row move on date edits.
        year,
        fromDate: form.fromDate,
        toDate: form.toDate,
        openingDays,
        remarks: form.remarks,
      });
      setShowForm(false);
      await fetchRows();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to save entry');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (!organizationId && !loadingUser) {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
        <AppHeader title="Event Balance Entry" onLogout={handleLogout} />
        <main className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg">
            Organization details are not available for this user.
          </div>
        </main>
      </div>
    );
  }

  if (!isHr) {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
        <AppHeader title="Event Balance Entry" onLogout={handleLogout} />
        <main className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            Access denied. This menu is available only for HR login.
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader
        title="Event Balance Entry"
        subtitle={organizationName ? `Organization: ${organizationName}` : undefined}
        onLogout={handleLogout}
      />

      <main className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900">Manage event balance opening days</h2>
        </div>

        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              <select
                value={selectedLeaveTypeId}
                onChange={(e) => setSelectedLeaveTypeId(e.target.value)}
                className="h-10 px-3 border border-black rounded-lg bg-white text-black min-w-56"
              >
                {leaveTypes.map((lt) => (
                  <option key={lt.id} value={lt.id}>
                    {lt.name}
                  </option>
                ))}
              </select>

              <input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value) || currentYear)}
                min={2000}
                max={2100}
                className="h-10 px-3 border border-black rounded-lg bg-white text-black w-32"
                placeholder="Year"
              />

              <input
                type="text"
                placeholder="Search associate..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-10 px-4 border border-black rounded-lg bg-white text-black min-w-72"
              />
            </div>

            <button
              onClick={handleOpenAdd}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
            >
              + Add
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Associate</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">From Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">To Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Days</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Remarks</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">Loading...</td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">No entries found</td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.employeeId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {row.associate} {row.employeeCode ? `[${row.employeeCode}]` : ''}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{toInputDate(row.fromDate)}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{toInputDate(row.toDate)}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{row.openingDays}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{row.remarks || '-'}</td>
                    <td className="px-6 py-4 text-sm">
                      <button onClick={() => handleEdit(row)} className="text-blue-600 hover:text-blue-900">
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Event Balance Entry" size="2xl">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Associate *</label>
              <select
                value={form.employeeId}
                onChange={(e) => setForm((prev) => ({ ...prev, employeeId: e.target.value }))}
                className="w-full h-10 px-3 border border-black rounded-lg bg-white text-black"
                disabled={isEditMode}
                required
              >
                <option value="">Select associate</option>
                {employeeOptions.map((opt) => (
                  <option key={opt.employeeId} value={opt.employeeId}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Opening Days *</label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={form.openingDays}
                onChange={(e) => setForm((prev) => ({ ...prev, openingDays: e.target.value }))}
                className="w-full h-10 px-3 border border-black rounded-lg bg-white text-black"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From Date (Year Start)</label>
              <input
                type="date"
                value={form.fromDate}
                onChange={(e) => setForm((prev) => ({ ...prev, fromDate: e.target.value }))}
                className="w-full h-10 px-3 border border-black rounded-lg bg-white text-black"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To Date (Year End)</label>
              <input
                type="date"
                value={form.toDate}
                onChange={(e) => setForm((prev) => ({ ...prev, toDate: e.target.value }))}
                className="w-full h-10 px-3 border border-black rounded-lg bg-white text-black"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
            <textarea
              rows={3}
              value={form.remarks}
              onChange={(e) => setForm((prev) => ({ ...prev, remarks: e.target.value }))}
              className="w-full px-3 py-2 border border-black rounded-lg bg-white text-black"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
