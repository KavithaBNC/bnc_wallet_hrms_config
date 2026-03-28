import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';
import leaveTypeService from '../services/leaveType.service';

const ACCRUAL_TYPES = ['MONTHLY', 'QUARTERLY', 'ANNUALLY', 'NONE'] as const;

export default function LeaveTypeFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const { user, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;
  const organizationId = user?.employee?.organizationId || user?.employee?.organization?.id;

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [isPaid, setIsPaid] = useState(true);
  const [defaultDaysPerYear, setDefaultDaysPerYear] = useState<number | ''>('');
  const [maxCarryForward, setMaxCarryForward] = useState<number | ''>('');
  const [maxConsecutiveDays, setMaxConsecutiveDays] = useState<number | ''>('');
  const [requiresDocument, setRequiresDocument] = useState(false);
  const [requiresApproval, setRequiresApproval] = useState(true);
  const [canBeNegative, setCanBeNegative] = useState(false);
  const [accrualType, setAccrualType] = useState<string>('');
  const [colorCode, setColorCode] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (isEdit && id) {
      setLoading(true);
      leaveTypeService
        .getById(id)
        .then((item) => {
          setName(item.name);
          setCode(item.code || '');
          setDescription(item.description || '');
          setIsPaid(item.isPaid);
          setDefaultDaysPerYear(item.defaultDaysPerYear ?? '');
          setMaxCarryForward(item.maxCarryForward ?? '');
          setMaxConsecutiveDays(item.maxConsecutiveDays ?? '');
          setRequiresDocument(item.requiresDocument);
          setRequiresApproval(item.requiresApproval);
          setCanBeNegative(item.canBeNegative);
          setAccrualType(item.accrualType || '');
          setColorCode(item.colorCode || '');
          setIsActive(item.isActive);
        })
        .catch(() => setError('Failed to load leave type'))
        .finally(() => setLoading(false));
    }
  }, [id, isEdit]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleCancel = () => navigate('/event-configuration/leave-types');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId) { setError('Organization not found'); return; }
    if (!name.trim()) { setError('Name is required'); return; }

    setError(null);
    setSaving(true);
    try {
      const payload = {
        organizationId,
        name: name.trim(),
        code: code.trim() || undefined,
        description: description.trim() || undefined,
        isPaid,
        defaultDaysPerYear: defaultDaysPerYear !== '' ? Number(defaultDaysPerYear) : undefined,
        maxCarryForward: maxCarryForward !== '' ? Number(maxCarryForward) : undefined,
        maxConsecutiveDays: maxConsecutiveDays !== '' ? Number(maxConsecutiveDays) : undefined,
        requiresDocument,
        requiresApproval,
        canBeNegative,
        accrualType: (accrualType as 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY' | 'NONE') || undefined,
        colorCode: colorCode.trim() || undefined,
        isActive,
      };
      if (isEdit && id) {
        await leaveTypeService.update(id, payload);
      } else {
        await leaveTypeService.create(payload);
      }
      navigate('/event-configuration/leave-types');
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
        title="Event Configuration"
        subtitle={organizationName ? `Organization: ${organizationName}` : undefined}
        onLogout={handleLogout}
      />

      <main className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-6 bg-gray-50">
        <div className="w-full max-w-[1600px] mx-auto">
          <nav className="flex text-sm text-gray-600 mb-4" aria-label="Breadcrumb">
            <Link to="/dashboard" className="hover:text-gray-900">Home</Link>
            <span className="mx-2">/</span>
            <Link to="/event-configuration" className="hover:text-gray-900">Event Configuration</Link>
            <span className="mx-2">/</span>
            <Link to="/event-configuration/leave-types" className="hover:text-gray-900">Leave Types</Link>
            <span className="mx-2">/</span>
            <span className="text-gray-900 font-medium">{isEdit ? 'Edit' : 'Add'}</span>
          </nav>

          <form onSubmit={handleSave} className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="bg-white px-6 py-4 border-b border-gray-200">
              <h1 className="text-lg font-semibold text-black">Leave Type</h1>
            </div>
            <div className="p-6">
              {loading ? (
                <div className="py-8 text-center text-gray-500">Loading...</div>
              ) : (
                <>
                  {error && (
                    <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                      {error}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        placeholder="e.g. Permission, Sick Leave"
                        className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-3"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Code</label>
                      <input
                        type="text"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        placeholder="e.g. PERMISSION, SL"
                        className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-3"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Default Days Per Year</label>
                      <input
                        type="number"
                        value={defaultDaysPerYear}
                        onChange={(e) => setDefaultDaysPerYear(e.target.value === '' ? '' : Number(e.target.value))}
                        min="0"
                        max="365"
                        placeholder="e.g. 12"
                        className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-3"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Max Carry Forward Days</label>
                      <input
                        type="number"
                        value={maxCarryForward}
                        onChange={(e) => setMaxCarryForward(e.target.value === '' ? '' : Number(e.target.value))}
                        min="0"
                        max="365"
                        placeholder="e.g. 5"
                        className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-3"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Max Consecutive Days</label>
                      <input
                        type="number"
                        value={maxConsecutiveDays}
                        onChange={(e) => setMaxConsecutiveDays(e.target.value === '' ? '' : Number(e.target.value))}
                        min="1"
                        max="365"
                        placeholder="e.g. 3"
                        className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-3"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Accrual Type</label>
                      <select
                        value={accrualType}
                        onChange={(e) => setAccrualType(e.target.value)}
                        className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      >
                        <option value="">Select accrual type</option>
                        {ACCRUAL_TYPES.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Color Code</label>
                      <div className="flex gap-2 mt-1">
                        <input
                          type="color"
                          value={colorCode || '#6B7280'}
                          onChange={(e) => setColorCode(e.target.value)}
                          className="h-10 w-12 rounded-md border border-black cursor-pointer p-1"
                        />
                        <input
                          type="text"
                          value={colorCode}
                          onChange={(e) => setColorCode(e.target.value)}
                          placeholder="#FF5733"
                          className="block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-3"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 mb-4">
                    <label className="block text-sm font-medium text-gray-700">Description</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      placeholder="Optional description for this leave type"
                      className="mt-1 block w-full bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm resize-y px-3 py-2"
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mt-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isPaid}
                        onChange={(e) => setIsPaid(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-700">Paid Leave</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={requiresApproval}
                        onChange={(e) => setRequiresApproval(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-700">Requires Approval</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={requiresDocument}
                        onChange={(e) => setRequiresDocument(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-700">Requires Document</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={canBeNegative}
                        onChange={(e) => setCanBeNegative(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-700">Can Be Negative</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-700">Active</span>
                    </label>
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 pb-4 border-t border-gray-200 px-6">
              <button
                type="button"
                onClick={handleCancel}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 transition"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || loading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
