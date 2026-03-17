import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { esopService, EsopPool, CreatePoolInput } from '../services/esop.service';

const emptyForm = (): CreatePoolInput & { isActive?: boolean } => ({
  organizationId: '',
  poolName: '',
  totalShares: 0,
  sharePrice: 0,
  currency: 'INR',
  description: '',
});

export default function EsopPoolsPage() {
  const { user } = useAuthStore();
  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id || '';

  const [pools, setPools] = useState<EsopPool[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchPools = async (page = 1) => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const res = await esopService.getAllPools({ organizationId, page, limit: 20, search: search || undefined });
      setPools(res.items);
      setPagination(res.pagination);
    } catch {
      setError('Failed to load ESOP pools');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPools(1); }, [organizationId]);

  const openCreate = () => {
    setForm({ ...emptyForm(), organizationId });
    setEditingId(null);
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (pool: EsopPool) => {
    setForm({
      organizationId,
      poolName: pool.poolName,
      totalShares: pool.totalShares,
      sharePrice: parseFloat(pool.sharePrice),
      currency: pool.currency,
      description: pool.description ?? '',
      isActive: pool.isActive,
    });
    setEditingId(pool.id);
    setFormError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.poolName || form.totalShares <= 0 || form.sharePrice <= 0) {
      setFormError('Pool name, total shares, and share price are required');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      if (editingId) {
        await esopService.updatePool(editingId, form);
      } else {
        await esopService.createPool(form);
      }
      setShowModal(false);
      fetchPools(pagination.page);
    } catch (e: any) {
      setFormError(e?.response?.data?.message || 'Failed to save pool');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this ESOP pool? This cannot be undone.')) return;
    try {
      await esopService.deletePool(id);
      fetchPools(pagination.page);
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Failed to delete pool');
    }
  };

  const fmt = (n: number | string) => Number(n).toLocaleString('en-IN');

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">ESOP Pools</h1>
          <p className="text-gray-500 text-sm">Manage company ESOP share pools</p>
        </div>
        <button onClick={openCreate} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">
          + Create Pool
        </button>
      </div>

      <div className="flex gap-3 mb-4">
        <input
          type="text" placeholder="Search pools..." value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && fetchPools(1)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <button onClick={() => fetchPools(1)} className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">Search</button>
      </div>

      {error && <div className="text-red-500 text-sm mb-3">{error}</div>}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left">Pool Name</th>
              <th className="px-4 py-3 text-right">Total Shares</th>
              <th className="px-4 py-3 text-right">Allocated</th>
              <th className="px-4 py-3 text-right">Available</th>
              <th className="px-4 py-3 text-right">Share Price</th>
              <th className="px-4 py-3 text-center">Grants</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={8} className="text-center py-8 text-gray-400">Loading...</td></tr>
            ) : pools.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-8 text-gray-400">No ESOP pools found. Create one to get started.</td></tr>
            ) : pools.map(pool => (
              <tr key={pool.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{pool.poolName}</td>
                <td className="px-4 py-3 text-right">{fmt(pool.totalShares)}</td>
                <td className="px-4 py-3 text-right text-indigo-600">{fmt(pool.allocatedShares)}</td>
                <td className="px-4 py-3 text-right text-green-600">{fmt(pool.availableShares)}</td>
                <td className="px-4 py-3 text-right">₹{fmt(pool.sharePrice)}</td>
                <td className="px-4 py-3 text-center text-gray-500">{pool._count?.grants ?? 0}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${pool.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {pool.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => openEdit(pool)} className="text-indigo-600 hover:underline text-xs mr-3">Edit</button>
                  <button onClick={() => handleDelete(pool.id)} className="text-red-500 hover:underline text-xs">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
          <span>Showing {pools.length} of {pagination.total} pools</span>
          <div className="flex gap-2">
            <button disabled={pagination.page <= 1} onClick={() => fetchPools(pagination.page - 1)}
              className="px-3 py-1 border rounded disabled:opacity-40">Previous</button>
            <button disabled={pagination.page >= pagination.totalPages} onClick={() => fetchPools(pagination.page + 1)}
              className="px-3 py-1 border rounded disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">{editingId ? 'Edit ESOP Pool' : 'Create ESOP Pool'}</h2>
            {formError && <div className="text-red-500 text-sm mb-3">{formError}</div>}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Pool Name *</label>
                <input type="text" value={form.poolName} onChange={e => setForm(f => ({ ...f, poolName: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Total Shares *</label>
                  <input type="number" min={1} value={form.totalShares} onChange={e => setForm(f => ({ ...f, totalShares: Number(e.target.value) }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Share Price (₹) *</label>
                  <input type="number" min={0.01} step={0.01} value={form.sharePrice} onChange={e => setForm(f => ({ ...f, sharePrice: Number(e.target.value) }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                <textarea rows={2} value={form.description ?? ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
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
