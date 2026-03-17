import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { esopService, VestingPlan, VestingFrequency, CreateVestingPlanInput } from '../services/esop.service';

const FREQ_LABELS: Record<VestingFrequency, string> = {
  MONTHLY: 'Monthly', QUARTERLY: 'Quarterly', YEARLY: 'Yearly',
};

function calcTranches(vestingPeriodMonths: number, cliffMonths: number, frequency: VestingFrequency): number {
  const interval = frequency === 'MONTHLY' ? 1 : frequency === 'QUARTERLY' ? 3 : 12;
  const firstOffset = cliffMonths > 0 ? cliffMonths : interval;
  let count = 0;
  let offset = firstOffset;
  while (offset <= vestingPeriodMonths) { count++; offset += interval; }
  return count || 1;
}

export default function VestingPlansPage() {
  const { user } = useAuthStore();
  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id || '';

  const [plans, setPlans] = useState<VestingPlan[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateVestingPlanInput & { isActive?: boolean }>({
    organizationId: '',
    planName: '',
    vestingPeriodMonths: 36,
    cliffMonths: 12,
    frequency: 'YEARLY',
    description: '',
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchPlans = async (page = 1) => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const res = await esopService.getAllVestingPlans({ organizationId, page, limit: 20 });
      setPlans(res.items);
      setPagination(res.pagination);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPlans(1); }, [organizationId]);

  const openCreate = () => {
    setForm({ organizationId, planName: '', vestingPeriodMonths: 36, cliffMonths: 12, frequency: 'YEARLY', description: '' });
    setEditingId(null);
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (plan: VestingPlan) => {
    setForm({
      organizationId,
      planName: plan.planName,
      vestingPeriodMonths: plan.vestingPeriodMonths,
      cliffMonths: plan.cliffMonths,
      frequency: plan.frequency,
      description: plan.description ?? '',
      isActive: plan.isActive,
    });
    setEditingId(plan.id);
    setFormError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.planName || form.vestingPeriodMonths <= 0) {
      setFormError('Plan name and vesting period are required');
      return;
    }
    if ((form.cliffMonths ?? 0) > form.vestingPeriodMonths) {
      setFormError('Cliff months cannot exceed vesting period');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      if (editingId) {
        await esopService.updateVestingPlan(editingId, form);
      } else {
        await esopService.createVestingPlan(form);
      }
      setShowModal(false);
      fetchPlans(pagination.page);
    } catch (e: any) {
      setFormError(e?.response?.data?.message || 'Failed to save vesting plan');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this vesting plan?')) return;
    try {
      await esopService.deleteVestingPlan(id);
      fetchPlans(pagination.page);
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Failed to delete');
    }
  };

  const tranches = calcTranches(form.vestingPeriodMonths, form.cliffMonths ?? 0, form.frequency);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Vesting Plans</h1>
          <p className="text-gray-500 text-sm">Define how ESOP shares vest over time</p>
        </div>
        <button onClick={openCreate} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">
          + Create Plan
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left">Plan Name</th>
              <th className="px-4 py-3 text-center">Vesting Period</th>
              <th className="px-4 py-3 text-center">Cliff</th>
              <th className="px-4 py-3 text-center">Frequency</th>
              <th className="px-4 py-3 text-center">Grants</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">Loading...</td></tr>
            ) : plans.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">No vesting plans found.</td></tr>
            ) : plans.map(plan => (
              <tr key={plan.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">
                  {plan.planName}
                  {plan.description && <p className="text-xs text-gray-400 mt-0.5">{plan.description}</p>}
                </td>
                <td className="px-4 py-3 text-center">{plan.vestingPeriodMonths} months</td>
                <td className="px-4 py-3 text-center">{plan.cliffMonths > 0 ? `${plan.cliffMonths} months` : 'No cliff'}</td>
                <td className="px-4 py-3 text-center">{FREQ_LABELS[plan.frequency]}</td>
                <td className="px-4 py-3 text-center text-gray-500">{plan._count?.grants ?? 0}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${plan.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {plan.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => openEdit(plan)} className="text-indigo-600 hover:underline text-xs mr-3">Edit</button>
                  <button onClick={() => handleDelete(plan.id)} className="text-red-500 hover:underline text-xs">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">{editingId ? 'Edit Vesting Plan' : 'Create Vesting Plan'}</h2>
            {formError && <div className="text-red-500 text-sm mb-3">{formError}</div>}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Plan Name *</label>
                <input type="text" value={form.planName} onChange={e => setForm(f => ({ ...f, planName: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Vesting Period (months) *</label>
                  <input type="number" min={1} value={form.vestingPeriodMonths} onChange={e => setForm(f => ({ ...f, vestingPeriodMonths: Number(e.target.value) }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Cliff (months)</label>
                  <input type="number" min={0} value={form.cliffMonths} onChange={e => setForm(f => ({ ...f, cliffMonths: Number(e.target.value) }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Vesting Frequency *</label>
                <select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value as VestingFrequency }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                  <option value="MONTHLY">Monthly</option>
                  <option value="QUARTERLY">Quarterly</option>
                  <option value="YEARLY">Yearly</option>
                </select>
              </div>
              <div className="bg-indigo-50 rounded-lg p-3 text-xs text-indigo-700">
                Preview: <strong>{tranches} tranches</strong> of ~{Math.floor(100 / tranches)}% each
                {(form.cliffMonths ?? 0) > 0 && ` (first vesting at ${form.cliffMonths} months)`}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                <textarea rows={2} value={form.description ?? ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              {editingId && (
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="isActive" checked={form.isActive ?? true} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
                  <label htmlFor="isActive" className="text-sm text-gray-700">Active</label>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
