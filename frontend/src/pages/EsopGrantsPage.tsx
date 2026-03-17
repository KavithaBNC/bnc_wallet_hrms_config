import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { esopService, EsopGrant, EsopPool, VestingPlan, CreateGrantInput } from '../services/esop.service';
import employeeService from '../services/employee.service';

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-600',
  COMPLETED: 'bg-gray-100 text-gray-600',
};

const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN');

export default function EsopGrantsPage() {
  const { user } = useAuthStore();
  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id || '';

  const [grants, setGrants] = useState<EsopGrant[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [pools, setPools] = useState<EsopPool[]>([]);
  const [vestingPlans, setVestingPlans] = useState<VestingPlan[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);

  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [selectedGrant, setSelectedGrant] = useState<EsopGrant | null>(null);
  const [form, setForm] = useState<CreateGrantInput>({
    organizationId: '', employeeId: '', poolId: '', vestingPlanId: '',
    grantDate: new Date().toISOString().split('T')[0],
    totalShares: 0, grantPrice: 0, remarks: '',
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchGrants = async (page = 1) => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const res = await esopService.getAllGrants({
        organizationId, page, limit: 20,
        search: search || undefined,
        status: statusFilter || undefined,
      });
      setGrants(res.items);
      setPagination(res.pagination);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!organizationId) return;
    fetchGrants(1);
    esopService.getAllPools({ organizationId, limit: 100 }).then(r => setPools(r.items));
    esopService.getAllVestingPlans({ organizationId, limit: 100, isActive: true }).then(r => setVestingPlans(r.items));
    employeeService.getAll({ organizationId, limit: 1000, employeeStatus: 'ACTIVE' }).then((r) => setEmployees(r.employees ?? []));
  }, [organizationId]);

  const openCreate = () => {
    setForm({ organizationId, employeeId: '', poolId: '', vestingPlanId: '', grantDate: new Date().toISOString().split('T')[0], totalShares: 0, grantPrice: 0, remarks: '' });
    setFormError('');
    setShowCreate(true);
  };

  const openDetail = async (grant: EsopGrant) => {
    const full = await esopService.getGrantById(grant.id);
    setSelectedGrant(full);
    setShowDetail(true);
  };

  const handleCreate = async () => {
    if (!form.employeeId || !form.poolId || !form.vestingPlanId || form.totalShares <= 0 || form.grantPrice <= 0) {
      setFormError('All fields are required');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await esopService.createGrant(form);
      setShowCreate(false);
      fetchGrants(pagination.page);
    } catch (e: any) {
      setFormError(e?.response?.data?.message || 'Failed to create grant');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Cancel this ESOP grant? Unvested shares will return to the pool.')) return;
    try {
      await esopService.cancelGrant(id);
      fetchGrants(pagination.page);
      if (showDetail) setShowDetail(false);
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Failed to cancel grant');
    }
  };

  const selectedPool = pools.find(p => p.id === form.poolId);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">ESOP Grants</h1>
          <p className="text-gray-500 text-sm">Issue and manage ESOP grants to employees</p>
        </div>
        <button onClick={openCreate} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">
          + Issue Grant
        </button>
      </div>

      <div className="flex gap-3 mb-4">
        <input type="text" placeholder="Search employee..." value={search}
          onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchGrants(1)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); fetchGrants(1); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="COMPLETED">Completed</option>
        </select>
        <button onClick={() => fetchGrants(1)} className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">Search</button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left">Employee</th>
              <th className="px-4 py-3 text-left">Grant Date</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Vested</th>
              <th className="px-4 py-3 text-right">Exercised</th>
              <th className="px-4 py-3 text-right">Price</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={8} className="text-center py-8 text-gray-400">Loading...</td></tr>
            ) : grants.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-8 text-gray-400">No grants found.</td></tr>
            ) : grants.map(g => (
              <tr key={g.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{g.employee?.firstName} {g.employee?.lastName}</p>
                  <p className="text-xs text-gray-400">{g.employee?.employeeCode}</p>
                </td>
                <td className="px-4 py-3 text-gray-600">{fmtDate(g.grantDate)}</td>
                <td className="px-4 py-3 text-right font-medium">{g.totalShares.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-indigo-600">{g.vestedShares.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-green-600">{g.exercisedShares.toLocaleString()}</td>
                <td className="px-4 py-3 text-right">₹{Number(g.grantPrice).toLocaleString()}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[g.status] || 'bg-gray-100 text-gray-600'}`}>
                    {g.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => openDetail(g)} className="text-indigo-600 hover:underline text-xs mr-2">View</button>
                  {g.status === 'ACTIVE' && (
                    <button onClick={() => handleCancel(g.id)} className="text-red-500 hover:underline text-xs">Cancel</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
          <span>Showing {grants.length} of {pagination.total}</span>
          <div className="flex gap-2">
            <button disabled={pagination.page <= 1} onClick={() => fetchGrants(pagination.page - 1)} className="px-3 py-1 border rounded disabled:opacity-40">Previous</button>
            <button disabled={pagination.page >= pagination.totalPages} onClick={() => fetchGrants(pagination.page + 1)} className="px-3 py-1 border rounded disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Issue ESOP Grant</h2>
            {formError && <div className="text-red-500 text-sm mb-3">{formError}</div>}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Employee *</label>
                <select value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value="">Select employee...</option>
                  {employees.map((e: any) => (
                    <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeCode})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">ESOP Pool *</label>
                <select value={form.poolId} onChange={e => setForm(f => ({ ...f, poolId: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value="">Select pool...</option>
                  {pools.filter(p => p.isActive).map(p => (
                    <option key={p.id} value={p.id}>{p.poolName} (Available: {p.availableShares.toLocaleString()})</option>
                  ))}
                </select>
                {selectedPool && (
                  <p className="text-xs text-green-600 mt-1">Available shares: {selectedPool.availableShares.toLocaleString()}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Vesting Plan *</label>
                <select value={form.vestingPlanId} onChange={e => setForm(f => ({ ...f, vestingPlanId: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value="">Select vesting plan...</option>
                  {vestingPlans.map(p => (
                    <option key={p.id} value={p.id}>{p.planName} ({p.vestingPeriodMonths}m, {p.cliffMonths}m cliff, {p.frequency})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Grant Date *</label>
                  <input type="date" value={form.grantDate} onChange={e => setForm(f => ({ ...f, grantDate: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Shares to Grant *</label>
                  <input type="number" min={1} value={form.totalShares} onChange={e => setForm(f => ({ ...f, totalShares: Number(e.target.value) }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Grant Price (₹) *</label>
                <input type="number" min={0.01} step={0.01} value={form.grantPrice} onChange={e => setForm(f => ({ ...f, grantPrice: Number(e.target.value) }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Remarks</label>
                <textarea rows={2} value={form.remarks ?? ''} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleCreate} disabled={saving} className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {saving ? 'Issuing...' : 'Issue Grant'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetail && selectedGrant && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-lg font-bold text-gray-900">Grant Details</h2>
              <button onClick={() => setShowDetail(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm mb-4">
              <div><span className="text-gray-500">Employee:</span> <strong>{selectedGrant.employee?.firstName} {selectedGrant.employee?.lastName}</strong></div>
              <div><span className="text-gray-500">Code:</span> {selectedGrant.employee?.employeeCode}</div>
              <div><span className="text-gray-500">Grant Date:</span> {fmtDate(selectedGrant.grantDate)}</div>
              <div><span className="text-gray-500">Total Shares:</span> <strong>{selectedGrant.totalShares.toLocaleString()}</strong></div>
              <div><span className="text-gray-500">Vested:</span> <span className="text-indigo-600 font-medium">{selectedGrant.vestedShares.toLocaleString()}</span></div>
              <div><span className="text-gray-500">Exercised:</span> <span className="text-green-600 font-medium">{selectedGrant.exercisedShares.toLocaleString()}</span></div>
              <div><span className="text-gray-500">Grant Price:</span> ₹{Number(selectedGrant.grantPrice).toLocaleString()}</div>
              <div><span className="text-gray-500">Status:</span> <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[selectedGrant.status]}`}>{selectedGrant.status}</span></div>
              <div><span className="text-gray-500">Pool:</span> {selectedGrant.pool?.poolName}</div>
              <div><span className="text-gray-500">Vesting Plan:</span> {selectedGrant.vestingPlan?.planName}</div>
            </div>

            <h3 className="text-sm font-semibold text-gray-700 mb-2">Vesting Schedule</h3>
            <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-gray-50 text-gray-600 uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Tranche</th>
                  <th className="px-3 py-2 text-left">Vesting Date</th>
                  <th className="px-3 py-2 text-right">Shares</th>
                  <th className="px-3 py-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(selectedGrant.vestingSchedules ?? []).map(vs => (
                  <tr key={vs.id}>
                    <td className="px-3 py-2">{vs.trancheNumber}</td>
                    <td className="px-3 py-2">{fmtDate(vs.vestingDate)}</td>
                    <td className="px-3 py-2 text-right">{vs.scheduledShares.toLocaleString()}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        vs.status === 'VESTED' ? 'bg-green-100 text-green-700' :
                        vs.status === 'LAPSED' ? 'bg-gray-100 text-gray-500' : 'bg-yellow-100 text-yellow-700'
                      }`}>{vs.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {selectedGrant.status === 'ACTIVE' && (
              <div className="mt-4 flex justify-end">
                <button onClick={() => handleCancel(selectedGrant.id)} className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50">
                  Cancel Grant
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
