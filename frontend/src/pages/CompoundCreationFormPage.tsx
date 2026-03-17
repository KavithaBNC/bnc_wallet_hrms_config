import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';
import compoundService, { type Compound } from '../services/compound.service';

const COMPONENT_TYPES = ['MASTER', 'TRANSACTION', 'PAYROLL', 'EARNING', 'DEDUCTION', 'ATTENDANCE', 'LEAVE', 'REIMBURSEMENT'];
const TYPE_OPTIONS = ['TEXT', 'TEXTAREA', 'NUMBER', 'DECIMAL', 'DATE', 'DROPDOWN', 'MULTI_SELECT', 'CHECKBOX', 'RADIO', 'FILE', 'EMAIL', 'PHONE', 'PERCENTAGE', 'CURRENCY'];

/** Toggle switch – project theme (gray when off, orange when on) */
function ToggleSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 ${
          checked ? 'bg-orange-500' : 'bg-gray-200'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}

export default function CompoundCreationFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const { user, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;
  const organizationId = user?.employee?.organizationId || (user?.employee?.organization as { id?: string } | undefined)?.id;

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [componentType, setComponentType] = useState('MASTER');
  const [shortName, setShortName] = useState('');
  const [longName, setLongName] = useState('');
  const [type, setType] = useState('TEXT');
  const [isDropDown, setIsDropDown] = useState(false);
  const [isCompulsory, setIsCompulsory] = useState(false);
  const [isFilterable, setIsFilterable] = useState(false);
  const [showInPayslip, setShowInPayslip] = useState(false);
  const [dropdownValues, setDropdownValues] = useState<{ value: string; sortOrder: number }[]>([]);
  const [newValue, setNewValue] = useState('');

  useEffect(() => {
    if (!isEdit || !id) return;
    setLoading(true);
    compoundService
      .getById(id)
      .then((c: Compound) => {
        setComponentType(c.componentType || 'MASTER');
        setShortName(c.shortName || '');
        setLongName(c.longName || '');
        setType(c.type || 'TEXT');
        setIsDropDown(c.isDropDown ?? false);
        setIsCompulsory(c.isCompulsory ?? false);
        setIsFilterable(c.isFilterable ?? false);
        setShowInPayslip(c.showInPayslip ?? false);
        setDropdownValues(
          (c.values || []).map((v, i) => ({ value: v.value, sortOrder: v.sortOrder ?? i }))
        );
      })
      .catch(() => setError('Failed to load component'))
      .finally(() => setLoading(false));
  }, [isEdit, id]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const addDropdownValue = () => {
    const v = newValue.trim();
    if (!v) return;
    setDropdownValues((prev) => [...prev, { value: v, sortOrder: prev.length }]);
    setNewValue('');
  };

  const removeDropdownValue = (index: number) => {
    setDropdownValues((prev) => prev.filter((_, i) => i !== index));
  };

  const validate = (): string | null => {
    if (!componentType?.trim()) return 'Component Type is required.';
    if (!shortName?.trim()) return 'Short Name is required.';
    if (!longName?.trim()) return 'Long Name is required.';
    if (!type?.trim()) return 'Type is required.';
    return null;
  };

  const handleSave = async () => {
    setError(null);
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    if (!organizationId) {
      setError('Organization not found.');
      return;
    }
    setSaving(true);
    try {
      if (isEdit && id) {
        await compoundService.update(id, {
          componentType: componentType.trim(),
          shortName: shortName.trim(),
          longName: longName.trim(),
          type: type.trim(),
          isDropDown: isDropDown,
          isCompulsory: isCompulsory,
          isFilterable: isFilterable,
          showInPayslip,
          values: isDropDown ? dropdownValues.filter((d) => d.value.trim()).map((d) => ({ value: d.value, sortOrder: d.sortOrder })) : undefined,
        });
      } else {
        await compoundService.create({
          organizationId,
          componentType: componentType.trim(),
          shortName: shortName.trim(),
          longName: longName.trim(),
          type: type.trim(),
          isDropDown: isDropDown,
          isCompulsory: isCompulsory,
          isFilterable: isFilterable,
          showInPayslip,
          values: isDropDown ? dropdownValues.filter((d) => d.value.trim()).map((d) => ({ value: d.value, sortOrder: d.sortOrder })) : undefined,
        });
      }
      navigate('/core-hr/compound-creation');
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : null;
      setError(msg || (err instanceof Error ? err.message : 'Failed to save component'));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    navigate('/core-hr/compound-creation');
  };

  if (!user) {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-gray-100 items-center justify-center p-8">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader
        title="Component Creation"
        subtitle={organizationName ? `Organization: ${organizationName}` : undefined}
        onLogout={handleLogout}
      />

      <main className="flex-1 min-h-0 overflow-y-auto w-full px-4 sm:px-6 lg:px-8 py-6 bg-gray-50">
        <div className="w-full">
          {/* Breadcrumbs */}
          <div className="mb-4">
            <nav className="flex items-center text-sm text-gray-600" aria-label="Breadcrumb">
              <Link to="/core-hr" className="text-gray-500 hover:text-gray-900">Core HR</Link>
              <span className="mx-1 text-gray-400">/</span>
              <Link to="/core-hr/compound-creation" className="text-gray-500 hover:text-gray-900">Component Creation</Link>
              <span className="mx-1 text-gray-400">/</span>
              <span className="font-semibold text-gray-900">{isEdit ? 'Edit' : 'Add'}</span>
            </nav>
          </div>

          {/* Title bar – project theme */}
          <div className="bg-white rounded-lg shadow border border-gray-200 mb-4 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Component Creation</h2>
            </div>

            {loading ? (
              <div className="px-6 py-12 text-center text-gray-500">Loading...</div>
            ) : (
              <div className="p-6 space-y-6">
                {error && (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
                    {error}
                  </div>
                )}

                {/* Form – two-column style: label left, control right */}
                <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-3 items-center">
                  <label className="text-sm font-medium text-gray-700">Component Type <span className="text-red-600">*</span></label>
                  <select
                    value={componentType}
                    onChange={(e) => setComponentType(e.target.value)}
                    className="h-10 px-3 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  >
                    {COMPONENT_TYPES.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>

                  <label className="text-sm font-medium text-gray-700">Short Name</label>
                  <input
                    type="text"
                    placeholder="Short Name"
                    value={shortName}
                    onChange={(e) => setShortName(e.target.value)}
                    className="h-10 px-3 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />

                  <label className="text-sm font-medium text-gray-700">Long Name <span className="text-red-600">*</span></label>
                  <input
                    type="text"
                    placeholder="Long Name"
                    value={longName}
                    onChange={(e) => setLongName(e.target.value)}
                    className="h-10 px-3 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />

                  <label className="text-sm font-medium text-gray-700">Type <span className="text-red-600">*</span></label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="h-10 px-3 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  >
                    {TYPE_OPTIONS.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>

                  <label className="text-sm font-medium text-gray-700">Drop Down</label>
                  <div className="py-1">
                    <ToggleSwitch checked={isDropDown} onChange={setIsDropDown} label="" />
                  </div>

                  <label className="text-sm font-medium text-gray-700">Compulsory</label>
                  <div className="py-1">
                    <ToggleSwitch checked={isCompulsory} onChange={setIsCompulsory} label="" />
                  </div>

                  <label className="text-sm font-medium text-gray-700">Filterable</label>
                  <div className="py-1">
                    <ToggleSwitch checked={isFilterable} onChange={setIsFilterable} label="" />
                  </div>

                  <label className="text-sm font-medium text-gray-700">Show in Payslip</label>
                  <div className="py-1">
                    <ToggleSwitch checked={showInPayslip} onChange={setShowInPayslip} label="" />
                  </div>
                </div>

                {/* Value management – when Drop Down = Yes */}
                {isDropDown && (
                  <div className="border-t border-gray-200 pt-6">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Value management</h3>
                    <div className="flex gap-2 mb-3">
                      <input
                        type="text"
                        placeholder="Add option value"
                        value={newValue}
                        onChange={(e) => setNewValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addDropdownValue())}
                        className="flex-1 h-10 px-3 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                      <button
                        type="button"
                        onClick={addDropdownValue}
                        className="h-10 px-4 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition"
                      >
                        Add
                      </button>
                    </div>
                    <ul className="space-y-2">
                      {dropdownValues.map((item, index) => (
                        <li key={index} className="flex items-center gap-2 text-sm text-gray-700">
                          <span className="flex-1">{item.value}</span>
                          <button
                            type="button"
                            onClick={() => removeDropdownValue(index)}
                            className="p-1.5 rounded text-gray-500 hover:bg-red-50 hover:text-red-600"
                            title="Remove"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </li>
                      ))}
                      {dropdownValues.length === 0 && (
                        <li className="text-gray-500 text-sm">No options yet. Add values above.</li>
                      )}
                    </ul>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="h-9 px-4 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 transition inline-flex items-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="h-9 px-4 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition inline-flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
