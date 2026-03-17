import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';

export default function EventTypeFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const { user, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;

  const [eventTypeName, setEventTypeName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleCancel = () => navigate('/event-configuration/event-type');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTypeName.trim()) {
      setError('Event Type Name is required');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      // TODO: Connect to backend API when available
      await new Promise((r) => setTimeout(r, 500));
      navigate('/event-configuration/event-type');
    } catch (err: unknown) {
      setError(String(err || 'Failed to save'));
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm';

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader
        title="Event Configuration"
        subtitle={organizationName ? `Organization: ${organizationName}` : undefined}
        onLogout={handleLogout}
      />

      <main className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-6 bg-gray-50">
        <div className="w-full max-w-[900px] mx-auto">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
            <nav className="flex items-center gap-1.5 text-sm text-gray-500">
              <Link to="/event-configuration" className="text-gray-500 hover:text-gray-900">Event Configuration</Link>
              <span className="mx-1 text-gray-400">/</span>
              <Link to="/event-configuration/event-type" className="text-gray-500 hover:text-gray-900">Event Type</Link>
              <span className="mx-1 text-gray-400">/</span>
              <span className="text-gray-900 font-medium">{isEdit ? 'Edit' : 'Add'}</span>
            </nav>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h1 className="text-lg font-semibold text-gray-900">
                {isEdit ? 'Edit Event Type' : 'Event Type'}
              </h1>
              <button type="button" onClick={handleCancel} className="text-gray-400 hover:text-gray-500 focus:outline-none">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSave}>
              {error && (
                <div className="mx-6 mt-6 p-4 bg-red-50 border border-red-200 text-sm text-red-700 rounded-md">{error}</div>
              )}

              <div className="divide-y divide-gray-200 p-6">
                <div className="flex flex-col sm:flex-row sm:items-center py-4 border-b border-gray-200 gap-2 sm:gap-4">
                  <label className="sm:w-48 flex-shrink-0 text-sm font-medium text-gray-700">
                    Event Type Name <span className="text-red-500">*</span>
                  </label>
                  <div className="flex-1 min-w-0">
                    <input type="text" value={eventTypeName} onChange={(e) => setEventTypeName(e.target.value)} placeholder="e.g. Earned Leave" className={inputClass} />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center py-4 border-b border-gray-200 gap-2 sm:gap-4">
                  <label className="sm:w-48 flex-shrink-0 text-sm font-medium text-gray-700">Code</label>
                  <div className="flex-1 min-w-0">
                    <input type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. EL" className={inputClass} />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center py-4 border-b border-gray-200 gap-2 sm:gap-4">
                  <label className="sm:w-48 flex-shrink-0 text-sm font-medium text-gray-700">Description</label>
                  <div className="flex-1 min-w-0">
                    <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Description" className="block w-full bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-4 px-6 py-6 border-t border-gray-200 bg-white">
                <button type="button" onClick={handleCancel} className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-gray-300 bg-white text-gray-600 text-sm font-medium shadow-sm hover:bg-gray-50">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-transparent bg-green-600 text-white text-sm font-medium shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
