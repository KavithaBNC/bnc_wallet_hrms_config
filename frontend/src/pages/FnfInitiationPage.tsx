import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import fnfSettlementService, { EligibleSeparation } from '../services/fnfSettlement.service';

const fmtDate = (d: string) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const calcYears = (joiningDate: string, relievingDate: string) => {
  const diff = new Date(relievingDate).getTime() - new Date(joiningDate).getTime();
  const years = diff / (365.25 * 24 * 60 * 60 * 1000);
  const y = Math.floor(years);
  const m = Math.floor((years - y) * 12);
  return `${y} yr${y !== 1 ? 's' : ''} ${m} mo${m !== 1 ? 's' : ''}`;
};

export default function FnfInitiationPage() {
  const navigate = useNavigate();

  const [separations, setSeparations] = useState<EligibleSeparation[]>([]);
  const [selected, setSelected] = useState<EligibleSeparation | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fnfSettlementService
      .getEligibleSeparations()
      .then(setSeparations)
      .catch(() => setError('Failed to load eligible separations'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = separations.filter((s) => {
    const q = searchTerm.toLowerCase();
    return (
      `${s.employee.firstName} ${s.employee.lastName}`.toLowerCase().includes(q) ||
      s.employee.employeeCode.toLowerCase().includes(q) ||
      (s.employee.department?.name || '').toLowerCase().includes(q)
    );
  });

  const handleSelect = (sep: EligibleSeparation) => {
    setSelected(sep);
    setSearchTerm(`${sep.employee.firstName} ${sep.employee.lastName} (${sep.employee.employeeCode})`);
    setError('');
  };

  const handleCalculate = async () => {
    if (!selected) return;
    try {
      setCalculating(true);
      setError('');
      const result = await fnfSettlementService.calculate(selected.id, selected.organizationId);
      navigate(`/payroll/fnf-settlement/${result.settlement.id}`);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Calculation failed. Please try again.');
    } finally {
      setCalculating(false);
    }
  };

  const showDropdown = searchTerm.length > 0 && !selected && filtered.length > 0;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/payroll/fnf-settlement')}
          className="text-gray-400 hover:text-gray-600 transition"
        >
          ← Back
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Initiate F&amp;F Settlement</h1>
          <p className="text-sm text-gray-500">Select a separated employee to calculate their settlement</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div>
      )}

      {/* Step 1: Select Separation */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">1</span>
          Select Employee Separation
        </h2>

        {loading ? (
          <p className="text-sm text-gray-400">Loading separations...</p>
        ) : separations.length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-700 text-sm">
            No eligible separations found. All separated employees already have settlements initiated.
          </div>
        ) : (
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setSelected(null);
              }}
              placeholder="Search by employee name, code or department..."
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {showDropdown && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                {filtered.map((sep) => (
                  <button
                    key={sep.id}
                    onClick={() => handleSelect(sep)}
                    className="w-full text-left px-4 py-3 hover:bg-indigo-50 transition border-b border-gray-50 last:border-0"
                  >
                    <div className="font-medium text-gray-900 text-sm">
                      {sep.employee.firstName} {sep.employee.lastName}
                      <span className="ml-2 text-gray-400 text-xs">({sep.employee.employeeCode})</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {sep.employee.department?.name} · LWD: {fmtDate(sep.relievingDate)} · {sep.separationType}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Step 2: Employee Card (after selection) */}
      {selected && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">2</span>
            Employee Details
          </h2>

          <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div>
              <p className="text-gray-500 text-xs">Employee Name</p>
              <p className="font-medium text-gray-900">{selected.employee.firstName} {selected.employee.lastName}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Employee Code</p>
              <p className="font-medium text-gray-900">{selected.employee.employeeCode}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Department</p>
              <p className="font-medium text-gray-900">{selected.employee.department?.name || '—'}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Designation</p>
              <p className="font-medium text-gray-900">{selected.employee.position?.title || '—'}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Date of Joining</p>
              <p className="font-medium text-gray-900">{fmtDate(selected.employee.dateOfJoining)}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Last Working Date</p>
              <p className="font-medium text-gray-900">{fmtDate(selected.relievingDate)}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Years of Service</p>
              <p className="font-medium text-gray-900">
                {calcYears(selected.employee.dateOfJoining, selected.relievingDate)}
              </p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Separation Type</p>
              <p className="font-medium text-gray-900">{selected.separationType}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Notice Period</p>
              <p className="font-medium text-gray-900">
                {selected.noticePeriod} days
                {selected.noticePeriodReason && (
                  <span className="ml-1 text-xs text-gray-400">({selected.noticePeriodReason})</span>
                )}
              </p>
            </div>
            {selected.reasonOfLeaving && (
              <div className="col-span-2">
                <p className="text-gray-500 text-xs">Reason of Leaving</p>
                <p className="font-medium text-gray-900">{selected.reasonOfLeaving}</p>
              </div>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
            ℹ️ Settlement will be calculated using the employee's current active salary, leave balances, and pending loan records.
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <button
          onClick={() => navigate('/payroll/fnf-settlement')}
          className="px-5 py-2.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
        >
          Cancel
        </button>
        <button
          onClick={handleCalculate}
          disabled={!selected || calculating}
          className="px-6 py-2.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
        >
          {calculating ? 'Calculating...' : 'Calculate & Initiate Settlement →'}
        </button>
      </div>
    </div>
  );
}
