import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';
import paygroupService, { type Paygroup } from '../services/paygroup.service';
import rulesEngineService, { type RulesEngineRow } from '../services/rules-engine.service';

type TabKey = 'earnings' | 'deductions';

const INPUT_TYPE_OPTIONS = ['Input', 'Derived', 'System Derived'];
const COMPONENT_TYPE_OPTIONS = ['Default', 'Variable Input', 'Reimbursement', 'Deduction', 'Employer Contribution', 'System'];

export default function RulesEnginePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const organizationName = user?.employee?.organization?.name;
  const organizationId = user?.employee?.organizationId || (user?.employee?.organization as { id?: string } | undefined)?.id;

  const [paygroups, setPaygroups] = useState<Paygroup[]>([]);
  const [selectedPaygroup, setSelectedPaygroup] = useState<string>('');
  const [paygroupSearch, setPaygroupSearch] = useState('');
  const [showPaygroupDropdown, setShowPaygroupDropdown] = useState(false);
  const paygroupDropdownRef = useRef<HTMLDivElement>(null);

  const [rules, setRules] = useState<RulesEngineRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);

  const [legendOpen, setLegendOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('earnings');
  const [findValue, setFindValue] = useState('');
  const [replaceValue, setReplaceValue] = useState('');

  const [filterShortName, setFilterShortName] = useState('');
  const [filterLongName, setFilterLongName] = useState('');
  const [filterInputType, setFilterInputType] = useState('All');
  const [filterComponentType, setFilterComponentType] = useState('All');
  const [filterFormula, setFilterFormula] = useState('');
  const [filterPercentage, setFilterPercentage] = useState('');
  const [filterRounding, setFilterRounding] = useState('All');
  const [filterOrder, setFilterOrder] = useState('');

  const fetchPaygroups = useCallback(async () => {
    if (!organizationId) return;
    try {
      const list = await paygroupService.getAll({ organizationId });
      setPaygroups(list);
      setSelectedPaygroup((prev) => (prev && list.some((p) => p.id === prev) ? prev : list[0]?.id ?? ''));
    } catch {
      setPaygroups([]);
    }
  }, [organizationId]);

  const fetchRules = useCallback(async () => {
    if (!organizationId || !selectedPaygroup) {
      setRules([]);
      return;
    }
    setLoading(true);
    setListError(null);
    try {
      const list = await rulesEngineService.getRules({ organizationId, paygroupId: selectedPaygroup });
      setRules(list);
    } catch {
      setListError('Failed to load rules.');
      setRules([]);
    } finally {
      setLoading(false);
    }
  }, [organizationId, selectedPaygroup]);

  useEffect(() => {
    fetchPaygroups();
  }, [fetchPaygroups]);

  useEffect(() => {
    const state = location.state as { paygroupId?: string } | null;
    if (state?.paygroupId && paygroups.some((p) => p.id === state.paygroupId)) {
      setSelectedPaygroup(state.paygroupId);
    }
  }, [location.state, paygroups]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (paygroupDropdownRef.current && !paygroupDropdownRef.current.contains(e.target as Node)) {
        setShowPaygroupDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const updateRow = useCallback((compoundId: string, patch: Partial<RulesEngineRow>) => {
    setRules((prev) =>
      prev.map((r) => {
        if (r.compoundId !== compoundId) return r;
        const next = { ...r, ...patch };
        if (patch.inputType === 'Input') next.formula = null;
        return next;
      })
    );
  }, []);

  const handlePrint = () => window.print();

  const handleSave = useCallback(async () => {
    if (!organizationId || !selectedPaygroup) return;
    setSaveLoading(true);
    try {
      const payload = rules.map((r) => ({
        compoundId: r.compoundId,
        inputType: r.inputType,
        componentBehavior: r.componentBehavior,
        formula: r.inputType === 'Input' ? null : r.formula,
        percentage: r.percentage,
        rounding: r.rounding,
        roundingType: r.roundingType,
        roundOffValue: r.roundOffValue,
        order: r.order,
      }));
      await rulesEngineService.saveRules({ organizationId, paygroupId: selectedPaygroup, rules: payload });
      await fetchRules();
    } catch {
      setListError('Failed to save rules.');
    } finally {
      setSaveLoading(false);
    }
  }, [organizationId, selectedPaygroup, rules, fetchRules]);

  const tabRows = activeTab === 'earnings' ? rules.filter((r) => r.category === 'EARNING') : rules.filter((r) => r.category === 'DEDUCTION');
  const filteredRows = tabRows.filter((r) => {
    if (filterShortName.trim() && !r.shortName.toLowerCase().includes(filterShortName.toLowerCase())) return false;
    if (filterLongName.trim() && !r.longName.toLowerCase().includes(filterLongName.toLowerCase())) return false;
    if (filterInputType !== 'All' && r.inputType !== filterInputType) return false;
    if (filterComponentType !== 'All' && r.componentBehavior !== filterComponentType) return false;
    if (filterFormula.trim() && !(r.formula ?? '').toLowerCase().includes(filterFormula.toLowerCase())) return false;
    if (filterPercentage.trim() && !String(r.percentage ?? '').includes(filterPercentage)) return false;
    if (filterRounding === 'Yes' && !r.rounding) return false;
    if (filterRounding === 'No' && r.rounding) return false;
    if (filterOrder.trim() && !String(r.order ?? '').includes(filterOrder)) return false;
    return true;
  });

  const paygroupFiltered = paygroups.filter(
    (p) => !paygroupSearch.trim() || p.name.toLowerCase().includes(paygroupSearch.toLowerCase())
  );
  const selectedPaygroupName = paygroups.find((p) => p.id === selectedPaygroup)?.name ?? 'Paygroup';

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader
        title="Rules Engine"
        subtitle={organizationName ? organizationName : undefined}
        onLogout={handleLogout}
      />

      <main className="flex-1 min-h-0 overflow-y-auto w-full px-4 sm:px-6 lg:px-8 py-6 bg-gray-50">
        <div className="w-full">
          <div className="mb-4">
            <nav className="flex items-center text-sm text-gray-600" aria-label="Breadcrumb">
              <span className="text-gray-500">Configuration</span>
              <span className="mx-1 text-gray-400">/</span>
              <Link to="/core-hr" className="text-gray-500 hover:text-gray-900">
                Core HR
              </Link>
              <span className="mx-1 text-gray-400">/</span>
              <span className="font-semibold text-gray-900">Rules Engine</span>
            </nav>
          </div>

          <div className="bg-white rounded-lg shadow border border-gray-200 mb-4">
            <div className="px-6 py-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-2xl font-bold text-gray-900">Rules Engine</h2>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setLegendOpen((v) => !v)}
                  className="h-9 px-4 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 inline-flex items-center gap-2"
                >
                  Legend
                  <svg className={`w-4 h-4 transition-transform ${legendOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {legendOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setLegendOpen(false)} aria-hidden="true" />
                    <div className="absolute right-0 mt-1 w-56 py-2 bg-white border border-gray-200 rounded-lg shadow-lg z-20 text-sm text-gray-700">
                      <div className="px-3 py-2 border-b border-gray-100 font-medium text-gray-900">Legend</div>
                      <div className="px-3 py-2">Input: user-entered value. Derived: calculated from formula.</div>
                      <div className="px-3 py-2">Rounding: Yes/No for amount rounding rule.</div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-b border-gray-200 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Paygroup :</label>
                <div className="relative min-w-[200px]" ref={paygroupDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setShowPaygroupDropdown((v) => !v)}
                    className="w-full h-9 px-3 pr-9 border border-gray-300 rounded-lg bg-white text-left text-sm text-gray-900 flex items-center justify-between"
                  >
                    <span className="truncate">{selectedPaygroupName}</span>
                    <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </button>
                  {showPaygroupDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-30 max-h-60 overflow-hidden flex flex-col">
                      <input
                        type="text"
                        placeholder="Paygroup"
                        value={paygroupSearch}
                        onChange={(e) => setPaygroupSearch(e.target.value)}
                        className="m-2 h-8 px-2 border border-gray-300 rounded text-sm"
                      />
                      <div className="overflow-y-auto">
                        {paygroupFiltered.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-gray-500">No paygroup found</div>
                        ) : (
                          paygroupFiltered.map((pg) => (
                            <button
                              key={pg.id}
                              type="button"
                              onClick={() => {
                                setSelectedPaygroup(pg.id);
                                setShowPaygroupDropdown(false);
                                setPaygroupSearch('');
                              }}
                              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${selectedPaygroup === pg.id ? 'bg-blue-50 text-blue-900' : 'text-gray-700'}`}
                            >
                              {pg.name}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Find"
                  value={findValue}
                  onChange={(e) => setFindValue(e.target.value)}
                  className="h-9 px-3 border border-gray-300 rounded-lg text-sm w-40"
                />
                <input
                  type="text"
                  placeholder="Replace"
                  value={replaceValue}
                  onChange={(e) => setReplaceValue(e.target.value)}
                  className="h-9 px-3 border border-gray-300 rounded-lg text-sm w-40"
                />
                <button type="button" className="h-9 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 inline-flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Replace
                </button>
              </div>
            </div>

            <div className="px-6 py-3 border-b border-gray-200 flex flex-wrap items-center justify-between gap-4 bg-gray-50">
              <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setActiveTab('earnings')}
                  className={`px-4 py-2 text-sm font-medium ${activeTab === 'earnings' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                >
                  Earnings
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('deductions')}
                  className={`px-4 py-2 text-sm font-medium ${activeTab === 'deductions' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                >
                  Deductions
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="h-9 px-4 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 inline-flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Print
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saveLoading || loading}
                  className="h-9 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  {saveLoading ? 'Saving...' : 'Save'}
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            </div>

            {listError && (
              <div className="mx-6 mt-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm text-red-800">{listError}</span>
                <button type="button" onClick={() => fetchRules()} className="shrink-0 h-9 px-4 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700">
                  Retry
                </button>
              </div>
            )}
            {loading && <div className="px-6 py-8 text-center text-gray-500">Loading rules...</div>}

            {!loading && (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Short Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Long Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Input Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Component Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Formula</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Percentage</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rounding</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
                    </tr>
                    <tr className="bg-white border-t border-gray-100">
                      <th className="px-4 py-2">
                        <input
                          type="text"
                          placeholder="Short Name"
                          value={filterShortName}
                          onChange={(e) => setFilterShortName(e.target.value)}
                          className="h-8 w-full px-2 text-sm border border-gray-300 rounded bg-white text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </th>
                      <th className="px-4 py-2">
                        <input
                          type="text"
                          placeholder="Long Name"
                          value={filterLongName}
                          onChange={(e) => setFilterLongName(e.target.value)}
                          className="h-8 w-full px-2 text-sm border border-gray-300 rounded bg-white text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </th>
                      <th className="px-4 py-2">
                        <select
                          value={filterInputType}
                          onChange={(e) => setFilterInputType(e.target.value)}
                          className="h-8 w-full px-2 text-sm border border-gray-300 rounded bg-white text-gray-700 focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="All">All</option>
                          {INPUT_TYPE_OPTIONS.map((o) => (
                            <option key={o} value={o}>{o}</option>
                          ))}
                        </select>
                      </th>
                      <th className="px-4 py-2">
                        <select
                          value={filterComponentType}
                          onChange={(e) => setFilterComponentType(e.target.value)}
                          className="h-8 w-full px-2 text-sm border border-gray-300 rounded bg-white text-gray-700 focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="All">All</option>
                          {COMPONENT_TYPE_OPTIONS.map((o) => (
                            <option key={o} value={o}>{o}</option>
                          ))}
                        </select>
                      </th>
                      <th className="px-4 py-2">
                        <input
                          type="text"
                          placeholder="Formula"
                          value={filterFormula}
                          onChange={(e) => setFilterFormula(e.target.value)}
                          className="h-8 w-full px-2 text-sm border border-gray-300 rounded bg-white text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </th>
                      <th className="px-4 py-2">
                        <input
                          type="text"
                          placeholder="Percentage"
                          value={filterPercentage}
                          onChange={(e) => setFilterPercentage(e.target.value)}
                          className="h-8 w-full px-2 text-sm border border-gray-300 rounded bg-white text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </th>
                      <th className="px-4 py-2">
                        <select
                          value={filterRounding}
                          onChange={(e) => setFilterRounding(e.target.value)}
                          className="h-8 w-full px-2 text-sm border border-gray-300 rounded bg-white text-gray-700 focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="All">All</option>
                          <option value="Yes">Yes</option>
                          <option value="No">No</option>
                        </select>
                      </th>
                      <th className="px-4 py-2">
                        <input
                          type="text"
                          placeholder="Order"
                          value={filterOrder}
                          onChange={(e) => setFilterOrder(e.target.value)}
                          className="h-8 w-full px-2 text-sm border border-gray-300 rounded bg-white text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                          {tabRows.length === 0 ? (activeTab === 'earnings' ? 'No earning components. Add components with category EARNING in Component Creation.' : 'No deduction components. Add components with category DEDUCTION in Component Creation.') : 'No rules match the filters.'}
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map((row, idx) => (
                        <tr
                          key={row.compoundId}
                          className={idx % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50 hover:bg-gray-100'}
                        >
                          <td className="px-4 py-2 text-sm font-medium">
                            <Link
                              to={`/core-hr/rules-engine/formula/${selectedPaygroup}/${row.compoundId}`}
                              state={{ paygroupName: selectedPaygroupName, longName: row.longName, shortName: row.shortName }}
                              className="text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              {row.shortName}
                            </Link>
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-600">{row.longName}</td>
                          <td className="px-4 py-2">
                            <select
                              value={row.inputType}
                              onChange={(e) => updateRow(row.compoundId, { inputType: e.target.value })}
                              className="h-8 w-full px-2 text-sm border border-gray-300 rounded bg-white text-gray-700 focus:ring-2 focus:ring-blue-500"
                            >
                              {INPUT_TYPE_OPTIONS.map((o) => (
                                <option key={o} value={o}>{o}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-2">
                            <select
                              value={row.componentBehavior}
                              onChange={(e) => updateRow(row.compoundId, { componentBehavior: e.target.value })}
                              className="h-8 w-full px-2 text-sm border border-gray-300 rounded bg-white text-gray-700 focus:ring-2 focus:ring-blue-500"
                            >
                              {COMPONENT_TYPE_OPTIONS.map((o) => (
                                <option key={o} value={o}>{o}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="text"
                              value={row.formula ?? ''}
                              onChange={(e) => updateRow(row.compoundId, { formula: e.target.value || null })}
                              disabled={row.inputType === 'Input'}
                              placeholder={row.inputType === 'Input' ? '—' : 'Formula'}
                              className="h-8 w-full px-2 text-sm border border-gray-300 rounded bg-white text-gray-700 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500 font-mono"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="text"
                              value={row.percentage ?? ''}
                              onChange={(e) => {
                                const v = e.target.value;
                                updateRow(row.compoundId, { percentage: v === '' ? null : Number(v) });
                              }}
                              className="h-8 w-full px-2 text-sm border border-gray-300 rounded bg-white text-gray-700 focus:ring-2 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <select
                              value={row.rounding ? 'Yes' : 'No'}
                              onChange={(e) => updateRow(row.compoundId, { rounding: e.target.value === 'Yes' })}
                              className="h-8 w-full px-2 text-sm border border-gray-300 rounded bg-white text-gray-700 focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="No">No</option>
                              <option value="Yes">Yes</option>
                            </select>
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="text"
                              value={row.order ?? ''}
                              onChange={(e) => {
                                const v = e.target.value;
                                updateRow(row.compoundId, { order: v === '' ? 0 : Number(v) || 0 });
                              }}
                              className="h-8 w-full px-2 text-sm border border-gray-300 rounded bg-white text-gray-700 focus:ring-2 focus:ring-blue-500"
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
