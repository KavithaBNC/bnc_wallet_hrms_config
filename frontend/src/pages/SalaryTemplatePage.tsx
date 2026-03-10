import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';
import {
  salaryTemplateService,
  salaryStructureService,
  SalaryTemplate,
  SalaryStructure,
} from '../services/payroll.service';

const PAYMENT_FREQUENCIES = [
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'BI_WEEKLY', label: 'Bi-Weekly' },
  { value: 'WEEKLY', label: 'Weekly' },
];

const emptyForm = {
  name: '',
  grade: '',
  level: '',
  salaryStructureId: '',
  ctc: '',
  basicSalary: '',
  grossSalary: '',
  netSalary: '',
  currency: 'INR',
  paymentFrequency: 'MONTHLY' as 'MONTHLY' | 'BI_WEEKLY' | 'WEEKLY',
  isActive: true,
};

const SalaryTemplatePage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;
  const organizationId = user?.employee?.organizationId;

  const isHRManager = user?.role === 'HR_MANAGER';
  const isOrgAdmin = user?.role === 'ORG_ADMIN';
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const canManage = isHRManager || isOrgAdmin || isSuperAdmin;

  const [templates, setTemplates] = useState<SalaryTemplate[]>([]);
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SalaryTemplate | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (organizationId) {
      fetchData();
    }
  }, [organizationId]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [tmplRes, structRes] = await Promise.all([
        salaryTemplateService.getAll({ organizationId, limit: '100' }),
        salaryStructureService.getAll({ organizationId, limit: '50' }),
      ]);
      setTemplates(tmplRes.data || []);
      setStructures(structRes.data || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingTemplate(null);
    setFormData(emptyForm);
    setShowModal(true);
  };

  const openEdit = (tmpl: SalaryTemplate) => {
    setEditingTemplate(tmpl);
    setFormData({
      name: tmpl.name,
      grade: tmpl.grade || '',
      level: tmpl.level || '',
      salaryStructureId: tmpl.salaryStructureId,
      ctc: String(tmpl.ctc),
      basicSalary: String(tmpl.basicSalary),
      grossSalary: String(tmpl.grossSalary),
      netSalary: String(tmpl.netSalary),
      currency: tmpl.currency,
      paymentFrequency: tmpl.paymentFrequency,
      isActive: tmpl.isActive,
    });
    setShowModal(true);
  };

  const handleStructureSelect = (structureId: string) => {
    const structure = structures.find((s) => s.id === structureId);
    if (!structure) {
      setFormData((prev) => ({ ...prev, salaryStructureId: structureId }));
      return;
    }
    // Auto-calculate from structure components
    let basic = 0;
    let gross = 0;
    structure.components.forEach((comp) => {
      if (comp.type === 'EARNING') {
        if (comp.calculationType === 'FIXED') {
          if (comp.code === 'BASIC' || comp.name.toLowerCase().includes('basic')) basic = comp.value;
          gross += comp.value;
        } else if (comp.calculationType === 'PERCENTAGE' && basic > 0) {
          gross += (basic * comp.value) / 100;
        }
      }
    });
    let deductions = 0;
    structure.components.forEach((comp) => {
      if (comp.type === 'DEDUCTION' && comp.calculationType === 'FIXED') deductions += comp.value;
    });
    const net = Math.max(0, gross - deductions);
    setFormData((prev) => ({
      ...prev,
      salaryStructureId: structureId,
      basicSalary: basic > 0 ? String(basic) : prev.basicSalary,
      grossSalary: gross > 0 ? String(gross) : prev.grossSalary,
      netSalary: net > 0 ? String(net) : prev.netSalary,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.salaryStructureId || !formData.basicSalary || !formData.grossSalary || !formData.netSalary) {
      alert('Please fill in all required fields');
      return;
    }
    const ctcVal = parseFloat(formData.ctc || formData.grossSalary);
    const grossVal = parseFloat(formData.grossSalary);
    const basicVal = parseFloat(formData.basicSalary);
    const netVal = parseFloat(formData.netSalary);
    if (ctcVal < grossVal) { alert('CTC must be ≥ Gross Salary'); return; }
    if (grossVal < basicVal) { alert('Gross Salary must be ≥ Basic Salary'); return; }
    if (netVal > grossVal) { alert('Net Salary must be ≤ Gross Salary'); return; }

    // Build components record from selected structure + entered basicSalary
    const selectedStructure = structures.find(s => s.id === formData.salaryStructureId);
    const components: Record<string, number> = {};
    if (selectedStructure) {
      selectedStructure.components.forEach(comp => {
        const key = (comp.code || comp.name).toLowerCase().replace(/\s+/g, '_');
        if (comp.calculationType === 'FIXED') {
          components[key] = comp.value;
        } else if (comp.calculationType === 'PERCENTAGE') {
          components[key] = Math.round((basicVal * comp.value) / 100);
        }
      });
    }

    setSubmitting(true);
    try {
      const payload = {
        organizationId: organizationId!,
        salaryStructureId: formData.salaryStructureId,
        name: formData.name,
        grade: formData.grade || undefined,
        level: formData.level || undefined,
        ctc: ctcVal,
        basicSalary: basicVal,
        grossSalary: grossVal,
        netSalary: netVal,
        currency: formData.currency,
        paymentFrequency: formData.paymentFrequency,
        isActive: formData.isActive,
        components,
      };
      if (editingTemplate) {
        await salaryTemplateService.update(editingTemplate.id, payload);
      } else {
        await salaryTemplateService.create(payload);
      }
      setShowModal(false);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save template');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await salaryTemplateService.delete(id);
      setDeleteConfirm(null);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete template');
    }
  };

  const handleLogout = async () => { await logout(); navigate('/login'); };

  const filtered = templates.filter((t) =>
    !searchQuery ||
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.grade || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const fmt = (v: number) => `₹${Number(v).toLocaleString('en-IN')}`;

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader
        title="Salary Templates"
        subtitle={organizationName ? `Organization: ${organizationName}` : undefined}
        onLogout={handleLogout}
      />
      <main className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Header actions */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Manage reusable salary templates by grade &amp; level</h2>
            <p className="text-sm text-gray-500 mt-1">Templates let you quickly assign standardised CTC packages to employees.</p>
          </div>
          {canManage && (
            <button
              onClick={openCreate}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm whitespace-nowrap"
            >
              + New Template
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">{error}</div>
        )}

        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Templates', value: templates.length, color: 'blue' },
            { label: 'Active', value: templates.filter((t) => t.isActive).length, color: 'green' },
            { label: 'Grades', value: new Set(templates.map((t) => t.grade).filter(Boolean)).size, color: 'purple' },
            { label: 'Salary Structures', value: structures.length, color: 'orange' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <p className="text-xs text-gray-500">{stat.label}</p>
              <p className={`text-2xl font-bold mt-1 text-${stat.color}-600`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search templates by name or grade..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-80 h-10 px-4 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Templates table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">All Templates</h3>
          </div>
          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
              <p className="mt-3 text-gray-500">Loading...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="font-medium">No templates found</p>
              <p className="text-sm mt-1">Create your first salary template to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    {['Template Name', 'Grade / Level', 'Salary Structure', 'Basic', 'Gross', 'CTC', 'Frequency', 'Status', 'Actions'].map((h) => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {filtered.map((tmpl) => {
                    const struct = structures.find((s) => s.id === tmpl.salaryStructureId);
                    return (
                      <tr key={tmpl.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-4 text-sm font-semibold text-gray-900">{tmpl.name}</td>
                        <td className="px-5 py-4 text-sm text-gray-700">
                          {tmpl.grade ? (
                            <div className="flex gap-1 flex-wrap">
                              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">{tmpl.grade}</span>
                              {tmpl.level && <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-xs font-medium">{tmpl.level}</span>}
                            </div>
                          ) : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-700">{struct?.name || '—'}</td>
                        <td className="px-5 py-4 text-sm font-medium text-gray-900">{fmt(tmpl.basicSalary)}</td>
                        <td className="px-5 py-4 text-sm font-medium text-green-700">{fmt(tmpl.grossSalary)}</td>
                        <td className="px-5 py-4 text-sm font-bold text-blue-700">{fmt(tmpl.ctc)}</td>
                        <td className="px-5 py-4 text-xs text-gray-600">
                          <span className="px-2 py-1 bg-gray-100 rounded font-medium">{tmpl.paymentFrequency.replace('_', '-')}</span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${tmpl.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {tmpl.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm">
                          <div className="flex items-center gap-3">
                            {canManage && (
                              <>
                                <button onClick={() => openEdit(tmpl)} className="text-blue-600 hover:text-blue-800 font-medium">Edit</button>
                                <button onClick={() => setDeleteConfirm(tmpl.id)} className="text-red-500 hover:text-red-700 font-medium">Delete</button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                {editingTemplate ? 'Edit Template' : 'New Salary Template'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Template Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Template Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Senior Engineer - L4"
                  className="w-full h-10 px-4 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              {/* Grade & Level */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Grade</label>
                  <input
                    type="text"
                    value={formData.grade}
                    onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                    placeholder="e.g. A, B, C"
                    className="w-full h-10 px-4 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Level</label>
                  <input
                    type="text"
                    value={formData.level}
                    onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                    placeholder="e.g. L1, L2, L3"
                    className="w-full h-10 px-4 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Salary Structure */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Salary Structure <span className="text-red-500">*</span></label>
                <select
                  value={formData.salaryStructureId}
                  onChange={(e) => handleStructureSelect(e.target.value)}
                  className="w-full h-10 px-4 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select Salary Structure</option>
                  {structures.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">Selecting a structure auto-fills salary amounts</p>
              </div>

              {/* Salary amounts */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Basic Salary (₹) <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    value={formData.basicSalary}
                    onChange={(e) => setFormData({ ...formData, basicSalary: e.target.value })}
                    min="0"
                    step="0.01"
                    className="w-full h-10 px-4 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gross Salary (₹) <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    value={formData.grossSalary}
                    onChange={(e) => setFormData({ ...formData, grossSalary: e.target.value })}
                    min="0"
                    step="0.01"
                    className="w-full h-10 px-4 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Net Salary (₹) <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    value={formData.netSalary}
                    onChange={(e) => setFormData({ ...formData, netSalary: e.target.value })}
                    min="0"
                    step="0.01"
                    className="w-full h-10 px-4 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CTC (₹)</label>
                  <input
                    type="number"
                    value={formData.ctc}
                    onChange={(e) => setFormData({ ...formData, ctc: e.target.value })}
                    min="0"
                    step="0.01"
                    placeholder="Leave blank = Gross"
                    className="w-full h-10 px-4 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Currency & Frequency */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
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
                    onChange={(e) => setFormData({ ...formData, paymentFrequency: e.target.value as any })}
                    className="w-full h-10 px-4 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                  >
                    {PAYMENT_FREQUENCIES.map((f) => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Active toggle */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 accent-blue-600"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-gray-700">Active (visible for assignment)</label>
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : editingTemplate ? 'Update Template' : 'Create Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Template?</h3>
            <p className="text-sm text-gray-600 mb-5">This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalaryTemplatePage;
