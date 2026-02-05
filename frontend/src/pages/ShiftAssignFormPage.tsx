import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';
import shiftAssignmentRuleService from '../services/shiftAssignmentRule.service';
import employeeService, { Employee } from '../services/employee.service';
import shiftService from '../services/shift.service';
import paygroupService from '../services/paygroup.service';
import departmentService from '../services/department.service';

function fullName(e: Employee): string {
  const parts = [e.firstName, e.middleName, e.lastName].filter(Boolean);
  return parts.join(' ').trim() || e.employeeCode || '';
}

export default function ShiftAssignFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const { user, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;
  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id;

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [selectedEmployees, setSelectedEmployees] = useState<Employee[]>([]);
  const [associateSearch, setAssociateSearch] = useState('');
  const [showAssociateDropdown, setShowAssociateDropdown] = useState(false);
  const [paygroupId, setPaygroupId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [priority, setPriority] = useState('');
  const [shiftId, setShiftId] = useState('');
  const [remarks, setRemarks] = useState('');
  const [policyRulesJson, setPolicyRulesJson] = useState<string | null>(null);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Array<{ id: string; name: string; code?: string | null }>>([]);
  const [paygroups, setPaygroups] = useState<{ id: string; name: string; code?: string | null }[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string; code?: string }[]>([]);

  useEffect(() => {
    if (!organizationId) return;
    Promise.all([
      employeeService.getAll({ organizationId, page: 1, limit: 500, employeeStatus: 'ACTIVE' }),
      shiftService.getAll({ organizationId, limit: 100 }),
      paygroupService.getAll({ organizationId }),
      departmentService.getAll({ organizationId, limit: 500 }),
    ]).then(([empRes, shiftRes, pgList, deptRes]) => {
      setEmployees(empRes.employees || []);
      setShifts(shiftRes.shifts || []);
      setPaygroups(pgList || []);
      setDepartments(deptRes?.departments || []);
    }).catch(() => {});
  }, [organizationId]);

  useEffect(() => {
    if (!id || !organizationId) return;
    setLoading(true);
    setError(null);
    shiftAssignmentRuleService
      .getById(id)
      .then((rule) => {
        setDisplayName(rule.displayName);
        setPaygroupId(rule.paygroupId ?? '');
        setDepartmentId(rule.departmentId ?? '');
        setEffectiveDate(rule.effectiveDate?.slice(0, 10) || new Date().toISOString().slice(0, 10));
        setPriority(rule.priority != null ? String(rule.priority) : '');
        setShiftId(rule.shiftId);
        const rawRemarks = rule.remarks ?? '';
        const policyMarker = '__POLICY_RULES__';
        const markerIdx = rawRemarks.indexOf(policyMarker);
        if (markerIdx >= 0) {
          setRemarks(rawRemarks.slice(0, markerIdx).trim());
          setPolicyRulesJson(rawRemarks.slice(markerIdx + policyMarker.length));
        } else {
          setRemarks(rawRemarks);
          setPolicyRulesJson(null);
        }
        const ids = Array.isArray(rule.employeeIds) ? rule.employeeIds : [];
        if (ids.length > 0) {
          employeeService.getAll({ organizationId, page: 1, limit: 500, employeeStatus: 'ACTIVE' }).then((r) => {
            const list = r.employees || [];
            setEmployees((prev) => (prev.length ? prev : list));
            setSelectedEmployees(list.filter((e) => ids.includes(e.id)));
          });
        } else {
          setSelectedEmployees([]);
        }
      })
      .catch((err: unknown) => {
        setError(err && typeof err === 'object' && 'response' in err ? (err as { response?: { data?: { message?: string } } }).response?.data?.message as string : 'Failed to load rule');
      })
      .finally(() => setLoading(false));
  }, [id, organizationId]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleClose = () => navigate('/time-attendance/shift-assign');

  const addEmployee = (emp: Employee) => {
    if (selectedEmployees.some((e) => e.id === emp.id)) return;
    setSelectedEmployees((prev) => [...prev, emp]);
    setAssociateSearch('');
    setShowAssociateDropdown(false);
  };

  const removeEmployee = (empId: string) => {
    setSelectedEmployees((prev) => prev.filter((e) => e.id !== empId));
  };

  const filteredEmployees = employees.filter(
    (e) =>
      !selectedEmployees.some((s) => s.id === e.id) &&
      (fullName(e).toLowerCase().includes(associateSearch.toLowerCase()) ||
        (e.employeeCode ?? '').toLowerCase().includes(associateSearch.toLowerCase()))
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId) return;
    if (!displayName.trim()) {
      setError('Display Name is required.');
      return;
    }
    if (!shiftId) {
      setError('Shift is required.');
      return;
    }
    if (!effectiveDate) {
      setError('Effective Date is required.');
      return;
    }

    setError(null);
    setSaving(true);
    try {
      let remarksValue: string | undefined;
      if (remarks.trim() || policyRulesJson) {
        const userPart = remarks.trim();
        remarksValue = policyRulesJson
          ? (userPart ? `${userPart}\n__POLICY_RULES__${policyRulesJson}` : `__POLICY_RULES__${policyRulesJson}`)
          : (userPart || undefined);
      }
      const payload = {
        organizationId,
        displayName: displayName.trim(),
        shiftId,
        paygroupId: paygroupId || undefined,
        departmentId: departmentId || undefined,
        effectiveDate,
        priority: priority.trim() ? Number(priority) : undefined,
        remarks: remarksValue,
        employeeIds: selectedEmployees.map((emp) => emp.id),
      };
      if (isEdit && id) {
        await shiftAssignmentRuleService.update(id, payload);
      } else {
        await shiftAssignmentRuleService.create(payload);
      }
      navigate('/time-attendance/shift-assign');
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : 'Failed to save';
      setError(String(msg || 'Failed to save'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader
        title="Time attendance"
        subtitle={organizationName ? `Organization: ${organizationName}` : undefined}
        onLogout={handleLogout}
      />

      <main className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        <nav className="flex text-sm text-gray-600 mb-4" aria-label="Breadcrumb">
          <Link to="/dashboard" className="hover:text-gray-900">Home</Link>
          <span className="mx-2">/</span>
          <Link to="/time-attendance" className="hover:text-gray-900">Time attendance</Link>
          <span className="mx-2">/</span>
          <Link to="/time-attendance/shift-assign" className="hover:text-gray-900">Shift Assign</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-900 font-medium">Assign</span>
        </nav>

        <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="bg-white px-6 py-4 border-b border-gray-200">
            <h1 className="text-lg font-semibold text-black">Assign</h1>
          </div>
          <div className="p-6 !bg-white">
            {loading ? (
              <div className="py-8 text-center text-gray-500">Loading...</div>
            ) : (
              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
                  <div className="flex items-baseline gap-2">
                    <label className="w-36 shrink-0 text-sm font-medium text-gray-700 after:content-[':']">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. House Keeping"
                      className="flex-1 rounded border border-gray-300 !bg-white px-3 py-2 text-sm text-black placeholder:text-black placeholder:opacity-80"
                    />
                  </div>
                  <div className="sm:col-span-2 flex items-start gap-2">
                    <label className="w-36 shrink-0 pt-2 text-sm font-medium text-gray-700 after:content-[':']">
                      Associate
                    </label>
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap gap-2 min-h-[2.5rem] rounded border border-gray-300 px-3 py-2 !bg-white">
                        {selectedEmployees.map((emp) => (
                          <span
                            key={emp.id}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-gray-800 text-sm"
                          >
                            {fullName(emp)} [{emp.employeeCode ?? emp.id.slice(0, 4)}]
                            <button
                              type="button"
                              onClick={() => removeEmployee(emp.id)}
                              className="ml-1 text-gray-600 hover:text-gray-900"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                        <input
                          type="text"
                          value={associateSearch}
                          onChange={(e) => {
                            setAssociateSearch(e.target.value);
                            setShowAssociateDropdown(true);
                          }}
                          onFocus={() => setShowAssociateDropdown(true)}
                          placeholder="Search and add associates..."
                          className="min-w-[140px] flex-1 border-0 !bg-white p-0 text-sm text-black placeholder:text-black placeholder:opacity-80 focus:ring-0 focus:outline-none"
                        />
                      </div>
                      {showAssociateDropdown && (
                        <div className="border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto bg-white">
                          {filteredEmployees.slice(0, 20).map((emp) => (
                            <button
                              key={emp.id}
                              type="button"
                              onClick={() => addEmployee(emp)}
                              className="w-full text-left px-3 py-2 text-sm text-gray-900 hover:bg-gray-100"
                            >
                              {fullName(emp)} [{emp.employeeCode ?? ''}]
                            </button>
                          ))}
                          {filteredEmployees.length === 0 && (
                            <div className="px-3 py-2 text-sm text-gray-500">No matches</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <label className="w-36 shrink-0 text-sm font-medium text-gray-700 after:content-[':']">
                      Paygroup <span className="text-red-600">*</span>
                    </label>
                    <select
                      value={paygroupId}
                      onChange={(e) => setPaygroupId(e.target.value)}
                      className="flex-1 rounded border border-gray-300 !bg-white px-3 py-2 text-sm text-black placeholder:text-black placeholder:opacity-80"
                    >
                      <option value="">-- Select --</option>
                      {paygroups.map((pg) => (
                        <option key={pg.id} value={pg.id}>{pg.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <label className="w-36 shrink-0 text-sm font-medium text-gray-700 after:content-[':']">
                      Department <span className="text-red-600">*</span>
                    </label>
                    <select
                      value={departmentId}
                      onChange={(e) => setDepartmentId(e.target.value)}
                      className="flex-1 rounded border border-gray-300 !bg-white px-3 py-2 text-sm text-black placeholder:text-black placeholder:opacity-80"
                    >
                      <option value="">-- Select --</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <label className="w-36 shrink-0 text-sm font-medium text-gray-700 after:content-[':']">
                      Priority
                    </label>
                    <input
                      type="text"
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      placeholder="(Auto)"
                      className="flex-1 rounded border border-gray-300 !bg-white px-3 py-2 text-sm text-black placeholder:text-black placeholder:opacity-80"
                    />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <label className="w-36 shrink-0 text-sm font-medium text-gray-700 after:content-[':']">
                      Effective Date <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="date"
                      value={effectiveDate}
                      onChange={(e) => setEffectiveDate(e.target.value)}
                      className="flex-1 rounded border border-gray-300 !bg-white px-3 py-2 text-sm text-black placeholder:text-black placeholder:opacity-80"
                    />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <label className="w-36 shrink-0 text-sm font-medium text-gray-700 after:content-[':']">
                      Shift <span className="text-red-600">*</span>
                    </label>
                    <select
                      value={shiftId}
                      onChange={(e) => setShiftId(e.target.value)}
                      className="flex-1 rounded border border-gray-300 !bg-white px-3 py-2 text-sm text-black placeholder:text-black placeholder:opacity-80"
                    >
                      <option value="">-- Select --</option>
                      {shifts.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2 flex items-baseline gap-2">
                    <label className="w-36 shrink-0 text-sm font-medium text-gray-700 after:content-[':']">
                      Remarks
                    </label>
                    <input
                      type="text"
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Remarks"
                      className="flex-1 rounded border border-gray-300 !bg-white px-3 py-2 text-sm text-black placeholder:text-black placeholder:opacity-80"
                    />
                  </div>
                </div>

                {error && (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                    {error}
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-gray-200 pt-6">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                  >
                    <span aria-hidden>×</span> Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-600 transition disabled:opacity-50"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
