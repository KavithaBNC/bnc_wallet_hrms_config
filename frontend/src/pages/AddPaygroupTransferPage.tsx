import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';
import employeeService, { Employee } from '../services/employee.service';
import paygroupService, { Paygroup } from '../services/paygroup.service';

function fullName(e: Employee): string {
  const parts = [e.firstName, e.middleName, e.lastName].filter(Boolean);
  return parts.join(' ').trim() || '-';
}

export default function AddPaygroupTransferPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;
  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id;
  const preselectedEmployeeId = (location.state as { employeeId?: string })?.employeeId;

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [paygroups, setPaygroups] = useState<Paygroup[]>([]);
  const [_loadingEmployees, setLoadingEmployees] = useState(false);
  const [loadingPaygroups, setLoadingPaygroups] = useState(false);

  const [associateId, setAssociateId] = useState(preselectedEmployeeId ?? '');
  const [associateSearch, setAssociateSearch] = useState('');
  const [showAssociateDropdown, setShowAssociateDropdown] = useState(false);
  const [currentPaygroup, setCurrentPaygroup] = useState<Paygroup | null>(null);
  const [transferPayGroupId, setTransferPayGroupId] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (!organizationId) return;
    setLoadingEmployees(true);
    employeeService
      .getAll({ organizationId, page: 1, limit: 500, employeeStatus: 'ACTIVE' })
      .then((res) => setEmployees(res.employees || []))
      .finally(() => setLoadingEmployees(false));
  }, [organizationId]);

  useEffect(() => {
    if (preselectedEmployeeId) setAssociateId(preselectedEmployeeId);
  }, [preselectedEmployeeId]);

  useEffect(() => {
    if (!organizationId) return;
    setLoadingPaygroups(true);
    paygroupService
      .getAll({ organizationId })
      .then((list) => {
        setPaygroups(list);
        if (list.length > 0 && !transferPayGroupId) setTransferPayGroupId(list[0].id);
      })
      .finally(() => setLoadingPaygroups(false));
  }, [organizationId]);

  useEffect(() => {
    if (!associateId) {
      setCurrentPaygroup(null);
      return;
    }
    employeeService
      .getById(associateId)
      .then((emp) => {
        const pg = (emp as any).paygroup;
        if (pg && pg.id) {
          setCurrentPaygroup({ id: pg.id, name: pg.name, code: pg.code ?? null, isActive: true });
        } else {
          setCurrentPaygroup(null);
        }
      })
      .catch(() => setCurrentPaygroup(null));
  }, [associateId]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const selectedEmployee = employees.find((e) => e.id === associateId);
  const associateDisplay = selectedEmployee
    ? `${selectedEmployee.employeeCode ?? ''} – ${fullName(selectedEmployee)}`
    : '';

  const filteredEmployees = associateSearch.trim()
    ? employees.filter(
        (e) =>
          e.employeeCode?.toLowerCase().includes(associateSearch.toLowerCase()) ||
          fullName(e).toLowerCase().includes(associateSearch.toLowerCase())
      )
    : employees;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!associateId || !transferPayGroupId) {
      setSaveError('Please select Associate and Transfer Pay Group.');
      return;
    }
    setSaveError(null);
    setSaving(true);
    setSaveSuccess(false);
    try {
      await employeeService.update(associateId, { paygroupId: transferPayGroupId } as any);
      setSaveSuccess(true);
      setCurrentPaygroup(paygroups.find((p) => p.id === transferPayGroupId) ?? null);
    } catch (err: any) {
      setSaveError(err.response?.data?.message || err.message || 'Failed to save pay group transfer.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    navigate('/transaction/paygroup-transfer');
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader
        title="Pay Group Transfer"
        subtitle={organizationName ? organizationName : undefined}
        onLogout={handleLogout}
      />

      <main className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        <nav className="text-sm text-gray-600 mb-4">
          <ol className="flex flex-wrap gap-1">
            <li>
              <Link to="/dashboard" className="hover:text-gray-900">Home</Link>
            </li>
            <li>/</li>
            <li>
              <Link to="/transaction" className="hover:text-gray-900">Core HR</Link>
            </li>
            <li>/</li>
            <li>
              <Link to="/transaction" className="hover:text-gray-900">Transaction</Link>
            </li>
            <li>/</li>
            <li>
              <Link to="/transaction/paygroup-transfer" className="hover:text-gray-900">Pay Group Transfer</Link>
            </li>
            <li>/</li>
            <li className="text-gray-900 font-medium">Add</li>
          </ol>
        </nav>

        <div className="bg-white border border-gray-200 border-b-0 rounded-t-lg px-4 py-3 mb-0 shadow-sm">
          <h1 className="text-lg font-semibold text-gray-900">Pay Group Transfer</h1>
        </div>

        <form onSubmit={handleSave} className="bg-white rounded-b-lg shadow border border-t-0 border-gray-200 p-6 space-y-6">
          {saveError && (
            <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
              {saveError}
            </div>
          )}
          {saveSuccess && (
            <div className="rounded-lg bg-green-50 border border-green-200 text-green-700 px-4 py-3 text-sm">
              Pay group transferred successfully.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1 relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Associate <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={showAssociateDropdown ? associateSearch : associateDisplay}
                onChange={(e) => {
                  setAssociateSearch(e.target.value);
                  setShowAssociateDropdown(true);
                }}
                onFocus={() => setShowAssociateDropdown(true)}
                onBlur={() => setTimeout(() => setShowAssociateDropdown(false), 200)}
                placeholder="Associate Code or Associate Name"
                className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 bg-white pr-8"
              />
              <span className="absolute right-2 top-9 text-gray-400 pointer-events-none">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </span>
              {showAssociateDropdown && (
                <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-y-auto">
                  {filteredEmployees.slice(0, 20).map((emp) => (
                    <li
                      key={emp.id}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setAssociateId(emp.id);
                        setAssociateSearch('');
                        setShowAssociateDropdown(false);
                      }}
                      className="px-3 py-2 cursor-pointer hover:bg-blue-50 text-sm text-gray-900"
                    >
                      {emp.employeeCode} – {fullName(emp)}
                    </li>
                  ))}
                  {filteredEmployees.length === 0 && (
                    <li className="px-3 py-2 text-sm text-gray-500">No matches</li>
                  )}
                </ul>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Paygroup</label>
              <input
                type="text"
                readOnly
                value={currentPaygroup?.name ?? ''}
                placeholder="Paygroup"
                className="w-full border border-gray-300 rounded px-3 py-2 text-gray-600 bg-gray-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Transfer Pay Group <span className="text-red-500">*</span>
              </label>
              <select
                value={transferPayGroupId}
                onChange={(e) => setTransferPayGroupId(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 bg-white"
                disabled={loadingPaygroups}
              >
                <option value="">Paygroup</option>
                {paygroups.map((pg) => (
                  <option key={pg.id} value={pg.id}>{pg.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleCancel}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 transition text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 transition text-sm font-medium"
            >
              {saving ? (
                'Saving...'
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  Save
                </>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
