import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';
import rulesEngineService, { type RulesEngineRow } from '../services/rules-engine.service';
import paygroupService from '../services/paygroup.service';
import BackNavigation from '../components/common/BackNavigation';

const INPUT_TYPE_OPTIONS = ['Input', 'Derived', 'System Derived'];
const ROUNDING_TYPE_OPTIONS = ['Nearest', 'Up', 'Down'];

type LocationState = { paygroupName?: string; longName?: string; shortName?: string } | null;

export default function RulesEngineFormulaEditorPage() {
  const navigate = useNavigate();
  const { paygroupId, compoundId } = useParams<{ paygroupId: string; compoundId: string }>();
  const location = useLocation();
  const state = (location.state as LocationState) ?? null;

  const { user, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;
  const organizationId = user?.employee?.organizationId || (user?.employee?.organization as { id?: string } | undefined)?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paygroupName, setPaygroupName] = useState(state?.paygroupName ?? '');
  const [allRules, setAllRules] = useState<RulesEngineRow[]>([]);
  const [currentRule, setCurrentRule] = useState<RulesEngineRow | null>(null);

  const [inputType, setInputType] = useState('Input');
  const [formula, setFormula] = useState('');
  const [rounding, setRounding] = useState(false);
  const [roundingType, setRoundingType] = useState<string | null>('Nearest');
  const [roundOffValue, setRoundOffValue] = useState<number | null>(0);
  const [percentage, setPercentage] = useState<number | null>(100);
  const [order, setOrder] = useState(0);
  const formulaInputRef = useRef<HTMLTextAreaElement>(null);

  const fetchData = useCallback(async () => {
    if (!organizationId || !paygroupId || !compoundId) return;
    setLoading(true);
    setError(null);
    try {
      const [rules, paygroups] = await Promise.all([
        rulesEngineService.getRules({ organizationId, paygroupId }),
        paygroupService.getAll({ organizationId }),
      ]);
      setAllRules(rules);
      const pg = paygroups.find((p) => p.id === paygroupId);
      setPaygroupName(state?.paygroupName ?? pg?.name ?? '');
      const rule = rules.find((r) => r.compoundId === compoundId);
      if (!rule) {
        setError('Component not found for this paygroup.');
        setCurrentRule(null);
        setLoading(false);
        return;
      }
      setCurrentRule(rule);
      setInputType(rule.inputType);
      setFormula(rule.formula ?? '');
      setRounding(rule.rounding);
      setRoundingType(rule.roundingType ?? 'Nearest');
      setRoundOffValue(rule.roundOffValue ?? 0);
      setPercentage(rule.percentage ?? 100);
      setOrder(rule.order ?? 0);
    } catch {
      setError('Failed to load rule.');
      setCurrentRule(null);
    } finally {
      setLoading(false);
    }
  }, [organizationId, paygroupId, compoundId, state?.paygroupName]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const insertFormulaToken = (token: string) => {
    const input = formulaInputRef.current;
    if (input) {
      const start = input.selectionStart ?? formula.length;
      const end = input.selectionEnd ?? formula.length;
      const next = formula.slice(0, start) + token + formula.slice(end);
      setFormula(next);
      setTimeout(() => {
        input.focus();
        input.setSelectionRange(start + token.length, start + token.length);
      }, 0);
    } else {
      setFormula((prev) => prev + token);
    }
  };

  const handleSave = async () => {
    if (!organizationId || !paygroupId || !currentRule) return;
    setSaving(true);
    setError(null);
    try {
      await rulesEngineService.saveRules({
        organizationId,
        paygroupId,
        rules: [
          {
            compoundId: currentRule.compoundId,
            inputType,
            componentBehavior: currentRule.componentBehavior,
            formula: inputType === 'Input' ? null : formula.trim() || null,
            percentage,
            rounding,
            roundingType: roundingType?.trim() || null,
            roundOffValue,
            order,
          },
        ],
      });
      navigate(`/core-hr/rules-engine`, { state: { paygroupId } });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || (err instanceof Error ? err.message : 'Failed to save.'));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    navigate(`/core-hr/rules-engine`, { state: { paygroupId } });
  };

  const earningsList = allRules.filter((r) => r.category === 'EARNING');
  const deductionsList = allRules.filter((r) => r.category === 'DEDUCTION');

  if (!paygroupId || !compoundId) {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
        <AppHeader title="Formula Editor" onLogout={handleLogout} />
        <main className="flex-1 p-6">
          <p className="text-red-600">Invalid URL. Missing paygroup or component.</p>
          <div className="mt-2">
            <BackNavigation to="/core-hr/rules-engine" label="Rules Engine" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader
        title="Formula Editor"
        subtitle={organizationName ? organizationName : undefined}
        onLogout={handleLogout}
      />
      <main className="flex-1 min-h-0 overflow-y-auto w-full px-4 sm:px-6 lg:px-8 py-6 bg-gray-50">
        <div className="w-full">
          <div className="mb-4">
            <nav className="flex items-center text-sm text-gray-600" aria-label="Breadcrumb">
              <span className="text-gray-500">Configuration</span>
              <span className="mx-1 text-gray-400">/</span>
              <Link to="/core-hr" className="text-gray-500 hover:text-gray-900">Core HR</Link>
              <span className="mx-1 text-gray-400">/</span>
              <Link to="/core-hr/rules-engine" className="text-gray-500 hover:text-gray-900">Rules Engine</Link>
              <span className="mx-1 text-gray-400">/</span>
              <span className="font-semibold text-gray-900">Formula Editor</span>
            </nav>
          </div>

          <div className="bg-white rounded-lg shadow border border-gray-200 mb-4 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Formula Editor</h2>
            </div>

            {loading && <div className="px-6 py-8 text-center text-gray-500">Loading...</div>}
            {error && !loading && (
              <div className="mx-6 mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
                {error}
                <span className="ml-2"><BackNavigation to="/core-hr/rules-engine" label="Rules Engine" /></span>
              </div>
            )}

            {!loading && currentRule && (
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Paygroup</label>
                    <div className="h-9 px-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 flex items-center">{paygroupName}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Long Name</label>
                    <div className="h-9 px-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 flex items-center">{currentRule.longName}</div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Input Type</label>
                  <select
                    value={inputType}
                    onChange={(e) => setInputType(e.target.value)}
                    className="h-9 w-full max-w-xs px-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
                  >
                    {INPUT_TYPE_OPTIONS.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Formula</label>
                  <div className="flex flex-wrap items-start gap-2">
                    <textarea
                      ref={formulaInputRef}
                      value={formula}
                      onChange={(e) => setFormula(e.target.value)}
                      disabled={inputType === 'Input'}
                      placeholder={inputType === 'Input' ? '—' : 'e.g. (FGROSS * 55/100)'}
                      rows={2}
                      className="flex-1 min-w-[200px] w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 font-mono text-sm disabled:bg-gray-100 disabled:text-gray-500 focus:ring-2 focus:ring-gray-400 focus:border-gray-400 resize-y"
                    />
                    {inputType !== 'Input' && (
                      <div className="flex flex-wrap gap-1">
                        {['(', ')', '+', '-', '*', '/'].map((op) => (
                          <button
                            key={op}
                            type="button"
                            onClick={() => insertFormulaToken(op)}
                            className="h-9 w-9 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 focus:ring-2 focus:ring-gray-400"
                          >
                            {op}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-gray-200">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Earnings</label>
                    <div className="border border-gray-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto bg-gray-50">
                      {earningsList.length === 0 ? (
                        <div className="p-3 text-sm text-gray-500">No earnings components</div>
                      ) : (
                        <ul className="divide-y divide-gray-100">
                          {earningsList.map((r) => (
                            <li key={r.compoundId}>
                              <button
                                type="button"
                                onClick={() => inputType !== 'Input' && insertFormulaToken(`[${r.shortName}]`)}
                                disabled={inputType === 'Input'}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <span className="font-medium text-gray-900">{r.longName}</span>
                                <span className="block text-xs text-gray-500">({r.shortName})</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Deductions</label>
                    <div className="border border-gray-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto bg-gray-50">
                      {deductionsList.length === 0 ? (
                        <div className="p-3 text-sm text-gray-500">No deduction components</div>
                      ) : (
                        <ul className="divide-y divide-gray-100">
                          {deductionsList.map((r) => (
                            <li key={r.compoundId}>
                              <button
                                type="button"
                                onClick={() => inputType !== 'Input' && insertFormulaToken(`[${r.shortName}]`)}
                                disabled={inputType === 'Input'}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <span className="font-medium text-gray-900">{r.longName}</span>
                                <span className="block text-xs text-gray-500">({r.shortName})</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-gray-700">Rounding</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={rounding}
                      onClick={() => setRounding(!rounding)}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        rounding ? 'bg-blue-500' : 'bg-gray-200'
                      }`}
                    >
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${rounding ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                    <span className="text-sm text-gray-600">{rounding ? 'Yes' : 'No'}</span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rounding Type</label>
                    <select
                      value={roundingType ?? ''}
                      onChange={(e) => setRoundingType(e.target.value || null)}
                      className="h-9 w-full max-w-xs px-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
                    >
                      <option value="">—</option>
                      {ROUNDING_TYPE_OPTIONS.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Round Off Value *</label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={roundOffValue ?? ''}
                      onChange={(e) => setRoundOffValue(e.target.value === '' ? null : Number(e.target.value))}
                      className="h-9 w-full max-w-xs px-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Percentage *</label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={percentage ?? ''}
                      onChange={(e) => setPercentage(e.target.value === '' ? null : Number(e.target.value))}
                      className="h-9 w-full max-w-xs px-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Order *</label>
                    <input
                      type="number"
                      min={0}
                      value={order}
                      onChange={(e) => setOrder(Number(e.target.value) || 0)}
                      className="h-9 w-full max-w-xs px-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="h-10 px-4 rounded-lg border border-red-300 bg-white text-red-700 text-sm font-medium hover:bg-red-50 inline-flex items-center gap-2"
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
                    className="h-10 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
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
