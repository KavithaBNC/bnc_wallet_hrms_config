import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';
import rulesEngineService, { type RulesEngineRow, type ConditionalRule } from '../services/rules-engine.service';
import paygroupService from '../services/paygroup.service';

const INPUT_TYPE_OPTIONS = ['Input', 'Derived', 'System Derived', 'Conditional'];
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
  const [conditionalRules, setConditionalRules] = useState<ConditionalRule[]>([]);
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
  const [editingRow, setEditingRow] = useState<ConditionalRule | null>(null);
  const [activeConditionalField, setActiveConditionalField] = useState<'condition' | 'then' | null>(null);
  const conditionInputRef = useRef<HTMLInputElement>(null);
  const thenInputRef = useRef<HTMLInputElement>(null);
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
      if (rule.inputType === 'Conditional' && rule.formula) {
        try {
          const parsed = JSON.parse(rule.formula);
          if (Array.isArray(parsed)) setConditionalRules(parsed);
        } catch {
          setConditionalRules([]);
        }
      } else {
        setConditionalRules([]);
      }
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

  const insertConditionalToken = (shortName: string) => {
    if (editingRowIndex === null || !editingRow) return;
    const field = activeConditionalField ?? 'then';
    const ref = field === 'condition' ? conditionInputRef.current : thenInputRef.current;
    const currentVal = field === 'condition' ? (editingRow.condition ?? '') : (editingRow.then ?? '');
    const start = ref?.selectionStart ?? currentVal.length;
    const end = ref?.selectionEnd ?? currentVal.length;
    const newVal = currentVal.slice(0, start) + shortName + currentVal.slice(end);
    setEditingRow((prev) => prev ? { ...prev, [field]: newVal } : prev);
    setTimeout(() => {
      ref?.focus();
      ref?.setSelectionRange(start + shortName.length, start + shortName.length);
    }, 0);
  };

  const handleComponentClick = (shortName: string) => {
    if (inputType === 'Conditional') {
      insertConditionalToken(shortName);
    } else if (inputType !== 'Input') {
      insertFormulaToken(`[${shortName}]`);
    }
  };

  const handleSave = async () => {
    if (!organizationId || !paygroupId || !currentRule) return;
    setSaving(true);
    setError(null);

    if (inputType === 'Conditional') {
      if (conditionalRules.length === 0) {
        setError('Add at least one condition row.');
        setSaving(false);
        return;
      }
      for (const cr of conditionalRules) {
        if (cr.type === 'IF' && !cr.condition.trim()) {
          setError('All IF rows must have a condition expression.');
          setSaving(false);
          return;
        }
        if (!cr.then.trim()) {
          setError('All rows must have a Then expression.');
          setSaving(false);
          return;
        }
      }
      const elseRows = conditionalRules.filter((cr) => cr.type === 'ELSE');
      if (elseRows.length > 1) {
        setError('Only one ELSE row is allowed.');
        setSaving(false);
        return;
      }
      if (elseRows.length === 1 && conditionalRules[conditionalRules.length - 1].type !== 'ELSE') {
        setError('ELSE must be the last row.');
        setSaving(false);
        return;
      }
    }

    try {
      let formulaToSave: string | null;
      if (inputType === 'Input') {
        formulaToSave = null;
      } else if (inputType === 'Conditional') {
        formulaToSave = conditionalRules.length > 0 ? JSON.stringify(conditionalRules) : null;
      } else {
        formulaToSave = formula.trim() || null;
      }
      await rulesEngineService.saveRules({
        organizationId,
        paygroupId,
        rules: [
          {
            compoundId: currentRule.compoundId,
            inputType,
            componentBehavior: currentRule.componentBehavior,
            formula: formulaToSave,
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
          <Link to="/core-hr/rules-engine" className="text-blue-600 hover:underline mt-2 inline-block">Back to Rules Engine</Link>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader
        title="Formula Editor"
        subtitle={organizationName ? `Organization: ${organizationName}` : undefined}
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
                <Link to="/core-hr/rules-engine" className="ml-2 text-blue-600 hover:underline">Back to list</Link>
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

                {inputType !== 'Conditional' && (
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
                )}

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
                                onClick={() => handleComponentClick(r.shortName)}
                                disabled={inputType === 'Input' || (inputType === 'Conditional' && editingRowIndex === null)}
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
                                onClick={() => handleComponentClick(r.shortName)}
                                disabled={inputType === 'Input' || (inputType === 'Conditional' && editingRowIndex === null)}
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
                        rounding ? 'bg-green-500' : 'bg-gray-200'
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

                {inputType === 'Conditional' && (
                  <div className="pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-blue-600">Conditional</h3>
                      <button
                        type="button"
                        onClick={() => {
                          const hasElse = conditionalRules.some((r) => r.type === 'ELSE');
                          const newRule: ConditionalRule = hasElse
                            ? { type: 'IF', condition: '', then: '' }
                            : conditionalRules.length === 0
                              ? { type: 'IF', condition: '', then: '' }
                              : { type: 'ELSE', condition: '', then: '' };
                          setConditionalRules([...conditionalRules, newRule]);
                          setEditingRowIndex(conditionalRules.length);
                          setEditingRow({ ...newRule });
                        }}
                        className="h-8 px-3 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 inline-flex items-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add
                      </button>
                    </div>
                    <hr className="border-blue-400 mb-3" />
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-blue-600 text-white text-sm">
                            <th className="px-4 py-2 text-left font-medium w-28">If or Else</th>
                            <th className="px-4 py-2 text-left font-medium">Condition</th>
                            <th className="px-4 py-2 text-left font-medium">Then</th>
                            <th className="px-4 py-2 text-left font-medium w-24">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {conditionalRules.length === 0 && (
                            <tr>
                              <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-400">
                                No conditions added. Click "+ Add" to create one.
                              </td>
                            </tr>
                          )}
                          {conditionalRules.map((rule, idx) => (
                            <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50">
                              {editingRowIndex === idx ? (
                                <>
                                  <td className="px-4 py-2">
                                    <select
                                      value={editingRow?.type ?? 'IF'}
                                      onChange={(e) =>
                                        setEditingRow((prev) =>
                                          prev ? { ...prev, type: e.target.value as 'IF' | 'ELSE' } : prev
                                        )
                                      }
                                      className="h-8 w-full px-2 border border-gray-300 rounded bg-white text-sm"
                                    >
                                      <option value="IF">IF</option>
                                      <option value="ELSE">ELSE</option>
                                    </select>
                                  </td>
                                  <td className="px-4 py-2">
                                    <input
                                      ref={conditionInputRef}
                                      type="text"
                                      value={editingRow?.condition ?? ''}
                                      onChange={(e) =>
                                        setEditingRow((prev) =>
                                          prev ? { ...prev, condition: e.target.value } : prev
                                        )
                                      }
                                      onFocus={() => setActiveConditionalField('condition')}
                                      disabled={editingRow?.type === 'ELSE'}
                                      placeholder={editingRow?.type === 'ELSE' ? '' : 'e.g. FGROSS <= 21000'}
                                      className="h-8 w-full px-2 border border-gray-300 rounded bg-white text-sm font-mono disabled:bg-gray-100"
                                    />
                                  </td>
                                  <td className="px-4 py-2">
                                    <input
                                      ref={thenInputRef}
                                      type="text"
                                      value={editingRow?.then ?? ''}
                                      onChange={(e) =>
                                        setEditingRow((prev) =>
                                          prev ? { ...prev, then: e.target.value } : prev
                                        )
                                      }
                                      onFocus={() => setActiveConditionalField('then')}
                                      placeholder="e.g. (FGROSS*0.75/100)"
                                      className="h-8 w-full px-2 border border-gray-300 rounded bg-white text-sm font-mono"
                                    />
                                  </td>
                                  <td className="px-4 py-2">
                                    <div className="flex gap-1">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (editingRow) {
                                            const updated = [...conditionalRules];
                                            updated[idx] = { ...editingRow };
                                            if (editingRow.type === 'ELSE') updated[idx].condition = '';
                                            setConditionalRules(updated);
                                          }
                                          setEditingRowIndex(null);
                                          setEditingRow(null);
                                        }}
                                        className="h-8 w-8 rounded bg-green-100 text-green-700 hover:bg-green-200 inline-flex items-center justify-center"
                                        title="Save"
                                      >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (!conditionalRules[idx].condition && !conditionalRules[idx].then) {
                                            setConditionalRules(conditionalRules.filter((_, i) => i !== idx));
                                          }
                                          setEditingRowIndex(null);
                                          setEditingRow(null);
                                        }}
                                        className="h-8 w-8 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 inline-flex items-center justify-center"
                                        title="Cancel"
                                      >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      </button>
                                    </div>
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{rule.type}</td>
                                  <td className="px-4 py-3 text-sm font-mono text-gray-700">{rule.condition}</td>
                                  <td className="px-4 py-3 text-sm font-mono text-gray-700">{rule.then}</td>
                                  <td className="px-4 py-3">
                                    <div className="flex gap-1">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingRowIndex(idx);
                                          setEditingRow({ ...rule });
                                        }}
                                        className="h-8 w-8 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 inline-flex items-center justify-center"
                                        title="Edit"
                                      >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                        </svg>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setConditionalRules(conditionalRules.filter((_, i) => i !== idx))}
                                        className="h-8 w-8 rounded bg-red-50 text-red-600 hover:bg-red-100 inline-flex items-center justify-center"
                                        title="Delete"
                                      >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                      </button>
                                    </div>
                                  </td>
                                </>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

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
                    className="h-10 px-4 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 inline-flex items-center gap-2"
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
