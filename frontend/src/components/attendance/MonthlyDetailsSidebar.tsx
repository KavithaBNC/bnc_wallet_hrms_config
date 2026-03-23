import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

interface MonthlyDetailsData {
  shortFall: { excessStay: string; shortfall: string; difference: string };
  leave: Array<{
    name: string;
    opening: number;
    credit: number;
    used: number;
    balance: number;
    source?: 'attendance_component' | 'default_leave_module';
  }>;
  entitlementWarnings?: string[];
  onduty: Array<{
    name: string;
    opening: number;
    credit: number;
    used: number;
    balance: number;
    source?: 'attendance_component' | 'default_leave_module';
  }>;
  permission: Array<{
    name: string;
    opening: number;
    credit: number;
    used: number;
    balance: number;
    source?: 'attendance_component' | 'default_leave_module';
  }>;
  present: Array<{
    name: string;
    opening: number;
    credit: number;
    used: number;
    balance: number;
    source?: 'attendance_component' | 'default_leave_module';
  }>;
  late: { count: number; hours: string };
  earlyGoing: { count: number; hours: string };
}

interface MonthlyDetailsSidebarProps {
  organizationId: string | undefined;
  employeeId: string | undefined;
  year: number;
  month: number;
  employeeName?: string;
}

type ApplyTab = 'Leave' | 'Onduty' | 'Permission';

function formatBalance(value: number, asHours = false): string {
  if (asHours) {
    const h = Math.floor(value);
    const m = Math.round((value - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  return String(value);
}

function isPermissionName(name: string | null | undefined): boolean {
  return (name || '').toLowerCase().includes('permission');
}

function isForcedZeroOpeningLeaveName(name: string | null | undefined): boolean {
  void name;
  return false;
}

type MonthlyRow = {
  name: string;
  opening: number;
  credit: number;
  used: number;
  balance: number;
  source?: 'attendance_component' | 'default_leave_module';
};

export default function MonthlyDetailsSidebar({
  organizationId,
  employeeId,
  year,
  month,
  employeeName,
}: MonthlyDetailsSidebarProps) {
  const [data, setData] = useState<MonthlyDetailsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applyTab, setApplyTab] = useState<ApplyTab>('Leave');
  const navigate = useNavigate();

  useEffect(() => {
    if (!organizationId || !employeeId) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get<{ data: MonthlyDetailsData }>('/attendance/monthly-details', {
        params: { organizationId, employeeId, year, month },
      })
      .then((res) => {
        if (!cancelled) setData(res.data?.data ?? null);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.response?.data?.message || 'Failed to load monthly details');
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId, employeeId, year, month]);

  if (!organizationId || !employeeId) {
    return (
      <div className="w-80 flex-shrink-0 bg-white border-l border-gray-200 p-4 overflow-auto">
        <p className="text-sm text-gray-500">Select an employee to see monthly details.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-80 flex-shrink-0 bg-white border-l border-gray-200 p-4 overflow-auto">
        <p className="text-sm text-gray-500">Loading monthly details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-80 flex-shrink-0 bg-white border-l border-gray-200 p-4 overflow-auto">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="w-80 flex-shrink-0 bg-white border-l border-gray-200 p-4 overflow-auto">
        <p className="text-sm text-gray-500">No data.</p>
      </div>
    );
  }

  const leaveRowsWithoutPermission = data.leave
    .filter((row) => !isPermissionName(row.name))
    .map((row) => {
      if (!isForcedZeroOpeningLeaveName(row.name)) return row;
      return {
        ...row,
        opening: 0,
        credit: 0,
        balance: Math.max(0, 0 + 0 - Number(row.used || 0)),
      };
    });
  const entitlementWarningsWithoutPermission = (data.entitlementWarnings || []).filter(
    (name) => !isPermissionName(name)
  );

  const renderTable = (
    title: string,
    rows: MonthlyRow[],
    colLabel: string
  ) => (
    <div className="mb-4">
      <h4 className="text-sm font-semibold text-gray-800 mb-2">{title}</h4>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs border border-gray-200 rounded">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-2 py-1.5 text-left font-medium text-gray-700">{colLabel}</th>
              <th className="px-2 py-1.5 text-right font-medium text-gray-700">Opening</th>
              <th className="px-2 py-1.5 text-right font-medium text-gray-700">Credit</th>
              <th className="px-2 py-1.5 text-right font-medium text-gray-700">Used</th>
              <th className="px-2 py-1.5 text-right font-medium text-gray-700">Balance</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-2 py-2 text-gray-500">
                  No entries
                </td>
              </tr>
            ) : (
              rows.map((row, i) => {
                return (
                <tr
                  key={i}
                  className={undefined}
                >
                  <td className="px-2 py-1.5 text-gray-900">
                    {row.name}
                  </td>
                  <td className="px-2 py-1.5 text-right text-gray-700">{formatBalance(row.opening)}</td>
                  <td className="px-2 py-1.5 text-right text-gray-700">{formatBalance(row.credit)}</td>
                  <td className="px-2 py-1.5 text-right text-gray-700">{formatBalance(row.used)}</td>
                  <td className="px-2 py-1.5 text-right text-gray-700">{formatBalance(row.balance)}</td>
                </tr>
              );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="w-80 flex-shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-hidden">
      {/* Apply – Leave / Onduty / Permission */}
      <div className="border-b border-gray-200 px-2 pt-2">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Apply</h3>
        <div className="flex gap-1 flex-wrap">
          {(['Leave', 'Onduty', 'Permission'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setApplyTab(tab);
                navigate('/attendance/apply-event', {
                  state: { employeeId, year, month, applyTab: tab, employeeName },
                });
              }}
              className={`px-3 py-1.5 rounded text-sm font-medium ${
                applyTab === tab
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Monthly Details</h3>

        {/* Short fall */}
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gray-800 mb-2">Short fall</h4>
          <table className="min-w-full text-xs border border-gray-200 rounded">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium text-gray-700">ExcessStay</th>
                <th className="px-2 py-1.5 text-right font-medium text-gray-700">Shortfall</th>
                <th className="px-2 py-1.5 text-right font-medium text-gray-700">Difference</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              <tr>
                <td className="px-2 py-1.5 text-gray-900">{data.shortFall.excessStay}</td>
                <td className="px-2 py-1.5 text-right text-gray-700">{data.shortFall.shortfall}</td>
                <td className="px-2 py-1.5 text-right text-gray-700">{data.shortFall.difference}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {entitlementWarningsWithoutPermission.length > 0 && (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <p className="font-medium">Entitlement not configured</p>
            <p className="mt-1">
              Configure entitlement for: {entitlementWarningsWithoutPermission.join(', ')} in Leave Management (Default Days Per Year)
              or Event Configuration → Auto Credit Setting.
            </p>
          </div>
        )}
        {renderTable('Leave', leaveRowsWithoutPermission, 'Leave')}
        {renderTable('Onduty', data.onduty, 'Onduty')}
        {renderTable('Permission', data.permission, 'Permission')}
        {renderTable('Present', data.present, 'Present')}

        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gray-800 mb-2">Late</h4>
          <table className="min-w-full text-xs border border-gray-200 rounded">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium text-gray-700">Count</th>
                <th className="px-2 py-1.5 text-right font-medium text-gray-700">Hours</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              <tr>
                <td className="px-2 py-1.5 text-gray-900">{data.late.count}</td>
                <td className="px-2 py-1.5 text-right text-gray-700">{data.late.hours}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gray-800 mb-2">Early Going</h4>
          <table className="min-w-full text-xs border border-gray-200 rounded">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium text-gray-700">Count</th>
                <th className="px-2 py-1.5 text-right font-medium text-gray-700">Hours</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              <tr>
                <td className="px-2 py-1.5 text-gray-900">{data.earlyGoing.count}</td>
                <td className="px-2 py-1.5 text-right text-gray-700">{data.earlyGoing.hours}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
