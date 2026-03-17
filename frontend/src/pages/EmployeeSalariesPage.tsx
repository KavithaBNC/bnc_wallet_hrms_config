import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';
import { useEmployeeStore } from '../store/employeeStore';
import {
  employeeSalaryService,
  salaryStructureService,
  salaryTemplateService,
  EmployeeSalary,
  SalaryStructure,
  SalaryTemplate,
  BankAccount,
} from '../services/payroll.service';

const EmployeeSalariesPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;
  const organizationId = user?.employee?.organizationId;
  const { employees, fetchEmployees } = useEmployeeStore();

  const isHRManager = user?.role === 'HR_MANAGER';
  const isOrgAdmin = user?.role === 'ORG_ADMIN';
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const canManage = isHRManager || isOrgAdmin || isSuperAdmin;

  const [salaries, setSalaries] = useState<EmployeeSalary[]>([]);
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [templates, setTemplates] = useState<SalaryTemplate[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form
  const emptyForm = {
    employeeId: '',
    assignMode: 'structure' as 'structure' | 'template' | 'manual',
    salaryStructureId: '',
    salaryTemplateId: '',
    effectiveDate: new Date().toISOString().split('T')[0],
    basicSalary: '',
    grossSalary: '',
    netSalary: '',
    ctc: '',
    revisionReason: '',
    currency: 'INR',
    paymentFrequency: 'MONTHLY' as 'MONTHLY' | 'BI_WEEKLY' | 'WEEKLY',
    bankAccountId: '',
  };
  const [formData, setFormData] = useState(emptyForm);

  useEffect(() => {
    if (organizationId) {
      fetchAll();
      fetchEmployees({ organizationId, page: 1, limit: 500 });
    }
  }, [organizationId]);

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [salRes, structRes, tmplRes] = await Promise.all([
        employeeSalaryService.getAllSalaries({ organizationId, limit: '500' }),
        salaryStructureService.getAll({ organizationId, limit: '50' }),
        salaryTemplateService.getAll({ organizationId, limit: '100' }),
      ]);
      setSalaries(salRes.data || []);
      setStructures(structRes.data || []);
      setTemplates(tmplRes.data || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Get only the ACTIVE salary per employee (latest)
  const activeSalaryMap = new Map<string, EmployeeSalary>();
  salaries.forEach((s) => {
    if (s.isActive) activeSalaryMap.set(s.employeeId, s);
  });

  const handleEmployeeSelect = async (employeeId: string) => {
    setFormData((prev) => ({ ...prev, employeeId, bankAccountId: '' }));
    if (!employeeId) return;
    try {
      const accounts = await employeeSalaryService.getBankAccounts(employeeId);
      setBankAccounts(accounts);
      const primary = accounts.find((a) => a.isPrimary) || accounts[0];
      if (primary) setFormData((prev) => ({ ...prev, bankAccountId: primary.id }));
    } catch {
      setBankAccounts([]);
    }
  };

  const handleStructureSelect = (structureId: string) => {
    const s = structures.find((x) => x.id === structureId);
    if (!s) { setFormData((prev) => ({ ...prev, salaryStructureId: structureId })); return; }
    let basic = 0, gross = 0;
    s.components.forEach((c) => {
      if (c.type === 'EARNING') {
        const val = c.calculationType === 'FIXED' ? c.value : c.calculationType === 'PERCENTAGE' && basic > 0 ? (basic * c.value) / 100 : 0;
        if (c.code === 'BASIC' || c.name.toLowerCase().includes('basic')) basic = val;
        gross += val;
      }
    });
    let ded = 0;
    s.components.forEach((c) => { if (c.type === 'DEDUCTION' && c.calculationType === 'FIXED') ded += c.value; });
    const net = Math.max(0, gross - ded);
    setFormData((prev) => ({ ...prev, salaryStructureId: structureId, basicSalary: String(basic || ''), grossSalary: String(gross || ''), netSalary: String(net || '') }));
  };

  const handleTemplateSelect = (templateId: string) => {
    const t = templates.find((x) => x.id === templateId);
    if (!t) { setFormData((prev) => ({ ...prev, salaryTemplateId: templateId })); return; }
    setFormData((prev) => ({
      ...prev,
      salaryTemplateId: templateId,
      basicSalary: String(t.basicSalary),
      grossSalary: String(t.grossSalary),
      netSalary: String(t.netSalary),
      ctc: String(t.ctc),
      paymentFrequency: t.paymentFrequency,
      currency: t.currency,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.employeeId || !formData.basicSalary || !formData.grossSalary || !formData.netSalary) {
      alert('Please fill in all required fields');
      return;
    }
    setSubmitting(true);
    try {
      await employeeSalaryService.createSalaryEnhanced({
        employeeId: formData.employeeId,
        salaryStructureId: formData.salaryStructureId || undefined,
        salaryTemplateId: formData.salaryTemplateId || undefined,
        effectiveDate: formData.effectiveDate,
        basicSalary: parseFloat(formData.basicSalary),
        grossSalary: parseFloat(formData.grossSalary),
        netSalary: parseFloat(formData.netSalary),
        ctc: formData.ctc ? parseFloat(formData.ctc) : undefined,
        revisionReason: formData.revisionReason || undefined,
        currency: formData.currency,
        paymentFrequency: formData.paymentFrequency,
        bankAccountId: formData.bankAccountId || undefined,
        isActive: true,
      });
      setShowModal(false);
      setFormData(emptyForm);
      fetchAll();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to assign salary');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => { await logout(); navigate('/login'); };
  const fmt = (v: number) => `₹${Number(v).toLocaleString('en-IN')}`;

  const filteredEmployees = employees.filter((e) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
      (e.employeeCode || '').toLowerCase().includes(q) ||
      (e.department?.name || '').toLowerCase().includes(q)
    );
  });

  const employeesWithSalary = filteredEmployees.filter((e) => activeSalaryMap.has(e.id));
  const employeesWithoutSalary = filteredEmployees.filter((e) => !activeSalaryMap.has(e.id));

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader
        title="Employee Salary"
        subtitle={organizationName ? `Organization: ${organizationName}` : undefined}
        onLogout={handleLogout}
      />
      <main className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Assign &amp; manage employee salary packages</h2>
            <p className="text-sm text-gray-500 mt-1">Click any employee row to view breakdown, edit, or see revision history.</p>
          </div>
          {canManage && (
            <button
              onClick={() => { setFormData(emptyForm); setBankAccounts([]); setShowModal(true); }}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm whitespace-nowrap"
            >
              + Assign Salary
            </button>
          )}
        </div>

        {error && <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">{error}</div>}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Employees', value: employees.length, color: 'blue' },
            { label: 'Salary Assigned', value: activeSalaryMap.size, color: 'green' },
            { label: 'Pending Assignment', value: employees.length - activeSalaryMap.size, color: 'orange' },
            { label: 'Templates Available', value: templates.filter((t) => t.isActive).length, color: 'purple' },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 text-${s.color}-600`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search by name, employee code or department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-96 h-10 px-4 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {loading ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
            <p className="mt-3 text-gray-500">Loading...</p>
          </div>
        ) : (
          <>
            {/* Employees with salary */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Assigned Salaries</h3>
                <span className="text-xs text-gray-400 bg-green-50 text-green-700 px-2 py-1 rounded-full font-medium">{employeesWithSalary.length} employees</span>
              </div>
              {employeesWithSalary.length === 0 ? (
                <div className="p-8 text-center text-gray-400">No employees with assigned salaries</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-100">
                    <thead className="bg-gray-50">
                      <tr>
                        {['Employee', 'Department', 'Basic', 'Gross', 'Net', 'CTC', 'Effective Date', 'Actions'].map((h) => (
                          <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {employeesWithSalary.map((emp) => {
                        const sal = activeSalaryMap.get(emp.id)!;
                        return (
                          <tr
                            key={emp.id}
                            className="hover:bg-blue-50 cursor-pointer transition-colors"
                            onClick={() => navigate(`/employee-salaries/${emp.id}`)}
                          >
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                                  {(emp.firstName?.[0] || '').toUpperCase()}
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-gray-900">{emp.firstName} {emp.lastName}</p>
                                  <p className="text-xs text-gray-400">{emp.employeeCode}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-4 text-sm text-gray-600">{emp.department?.name || '—'}</td>
                            <td className="px-5 py-4 text-sm font-medium text-gray-900">{fmt(sal.basicSalary)}</td>
                            <td className="px-5 py-4 text-sm font-medium text-green-700">{fmt(sal.grossSalary)}</td>
                            <td className="px-5 py-4 text-sm font-bold text-blue-700">{fmt(sal.netSalary)}</td>
                            <td className="px-5 py-4 text-sm text-gray-700">{sal.ctc ? fmt(sal.ctc) : '—'}</td>
                            <td className="px-5 py-4 text-sm text-gray-600">
                              {new Date(sal.effectiveDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </td>
                            <td className="px-5 py-4 text-sm" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => navigate(`/employee-salaries/${emp.id}`)}
                                className="text-blue-600 hover:text-blue-800 font-medium mr-3 text-xs"
                              >
                                View Details
                              </button>
                              {canManage && (
                                <button
                                  onClick={() => { setFormData({ ...emptyForm, employeeId: emp.id }); handleEmployeeSelect(emp.id); setShowModal(true); }}
                                  className="text-purple-600 hover:text-purple-800 font-medium text-xs"
                                >
                                  Revise
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Employees without salary */}
            {employeesWithoutSalary.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-orange-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-orange-100 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">Pending Salary Assignment</h3>
                  <span className="text-xs bg-orange-50 text-orange-700 px-2 py-1 rounded-full font-medium">{employeesWithoutSalary.length} employees</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-100">
                    <thead className="bg-orange-50">
                      <tr>
                        {['Employee', 'Department', 'Position', 'Status', 'Action'].map((h) => (
                          <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {employeesWithoutSalary.map((emp) => (
                        <tr key={emp.id} className="hover:bg-orange-50 transition-colors">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-sm flex-shrink-0">
                                {(emp.firstName?.[0] || '').toUpperCase()}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-gray-900">{emp.firstName} {emp.lastName}</p>
                                <p className="text-xs text-gray-400">{emp.employeeCode}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-sm text-gray-600">{emp.department?.name || '—'}</td>
                          <td className="px-5 py-4 text-sm text-gray-600">{emp.position?.title || '—'}</td>
                          <td className="px-5 py-4">
                            <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold">Not Assigned</span>
                          </td>
                          <td className="px-5 py-4">
                            {canManage && (
                              <button
                                onClick={() => { setFormData({ ...emptyForm, employeeId: emp.id }); handleEmployeeSelect(emp.id); setShowModal(true); }}
                                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                              >
                                Assign Salary
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Assign / Revise Salary Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Assign Salary to Employee</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Employee */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee <span className="text-red-500">*</span></label>
                <select
                  value={formData.employeeId}
                  onChange={(e) => handleEmployeeSelect(e.target.value)}
                  className="w-full h-10 px-4 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select Employee</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.employeeCode} — {emp.firstName} {emp.lastName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Assignment mode tabs */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Assignment Method</label>
                <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                  {(['template', 'structure', 'manual'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, assignMode: mode, salaryStructureId: '', salaryTemplateId: '' }))}
                      className={`flex-1 py-2 text-sm font-medium transition ${
                        formData.assignMode === mode
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {mode === 'template' ? 'From Template' : mode === 'structure' ? 'From Structure' : 'Manual Entry'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Template selector */}
              {formData.assignMode === 'template' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Salary Template</label>
                  <select
                    value={formData.salaryTemplateId}
                    onChange={(e) => handleTemplateSelect(e.target.value)}
                    className="w-full h-10 px-4 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Template</option>
                    {templates.filter((t) => t.isActive).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} {t.grade ? `[${t.grade}${t.level ? `/${t.level}` : ''}]` : ''} — CTC: ₹{Number(t.ctc).toLocaleString('en-IN')}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Structure selector */}
              {formData.assignMode === 'structure' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Salary Structure</label>
                  <select
                    value={formData.salaryStructureId}
                    onChange={(e) => handleStructureSelect(e.target.value)}
                    className="w-full h-10 px-4 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Structure</option>
                    {structures.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Salary amounts */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { key: 'basicSalary', label: 'Basic Salary (₹)', required: true },
                  { key: 'grossSalary', label: 'Gross Salary (₹)', required: true },
                  { key: 'netSalary', label: 'Net Salary (₹)', required: true },
                  { key: 'ctc', label: 'CTC (₹)', required: false },
                ].map(({ key, label, required }) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {label} {required && <span className="text-red-500">*</span>}
                    </label>
                    <input
                      type="number"
                      value={(formData as any)[key]}
                      onChange={(e) => setFormData((prev) => ({ ...prev, [key]: e.target.value }))}
                      min="0"
                      step="0.01"
                      className="w-full h-10 px-4 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      required={required}
                    />
                  </div>
                ))}
              </div>

              {/* Effective date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Effective Date <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  value={formData.effectiveDate}
                  onChange={(e) => setFormData((prev) => ({ ...prev, effectiveDate: e.target.value }))}
                  className="w-full h-10 px-4 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Revision reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Revision Reason / Remarks</label>
                <input
                  type="text"
                  value={formData.revisionReason}
                  onChange={(e) => setFormData((prev) => ({ ...prev, revisionReason: e.target.value }))}
                  placeholder="e.g. Annual appraisal, Promotion, Market correction..."
                  className="w-full h-10 px-4 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Currency + Frequency */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData((prev) => ({ ...prev, currency: e.target.value }))}
                    className="w-full h-10 px-4 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Frequency</label>
                  <select
                    value={formData.paymentFrequency}
                    onChange={(e) => setFormData((prev) => ({ ...prev, paymentFrequency: e.target.value as any }))}
                    className="w-full h-10 px-4 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="MONTHLY">Monthly</option>
                    <option value="BI_WEEKLY">Bi-Weekly</option>
                    <option value="WEEKLY">Weekly</option>
                  </select>
                </div>
              </div>

              {/* Bank account */}
              {bankAccounts.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bank Account</label>
                  <select
                    value={formData.bankAccountId}
                    onChange={(e) => setFormData((prev) => ({ ...prev, bankAccountId: e.target.value }))}
                    className="w-full h-10 px-4 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">No Bank Account</option>
                    {bankAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.bankName} — {a.accountNumber} {a.isPrimary ? '(Primary)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm">Cancel</button>
                <button type="submit" disabled={submitting} className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50">
                  {submitting ? 'Assigning...' : 'Assign Salary'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeSalariesPage;
