import { useState } from 'react';
import { getMockDocuments, type DocumentItem } from '../../services/dashboard.service';

const TYPE_ICON_COLORS: Record<string, string> = {
  letter: 'bg-blue-100 text-blue-600',
  payslip: 'bg-green-100 text-green-600',
  id: 'bg-purple-100 text-purple-600',
  tax: 'bg-amber-100 text-amber-600',
};

const STATUS_BADGE: Record<string, string> = {
  verified: 'bg-green-100 text-green-700',
  available: 'bg-blue-100 text-blue-700',
  pending: 'bg-amber-100 text-amber-700',
};

const DocumentsWidget = () => {
  const [documents] = useState<DocumentItem[]>(() => getMockDocuments());
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = searchQuery
    ? documents.filter((d) => d.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : documents;

  const stats = {
    total: documents.length,
    payslips: documents.filter((d) => d.type === 'payslip').length,
    verified: documents.filter((d) => d.status === 'verified').length,
    available: documents.filter((d) => d.status === 'available').length,
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 border border-gray-100 p-6 transition-all duration-300 hover:shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Documents</h3>
          <p className="text-xs text-gray-500">Your files & records</p>
        </div>
        <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-2 py-1 rounded-full">Placeholder</span>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="text"
          placeholder="Search documents..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <StatBox label="Total" value={stats.total} color="text-blue-600" bg="bg-blue-50" />
        <StatBox label="Payslips" value={stats.payslips} color="text-green-600" bg="bg-green-50" />
        <StatBox label="Verified" value={stats.verified} color="text-purple-600" bg="bg-purple-50" />
        <StatBox label="Available" value={stats.available} color="text-amber-600" bg="bg-amber-50" />
      </div>

      {/* Document list */}
      <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No documents found</p>
        ) : (
          filtered.map((doc) => (
            <div key={doc.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors group">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${TYPE_ICON_COLORS[doc.type] || 'bg-gray-100 text-gray-600'}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-medium text-gray-800 truncate">{doc.name}</p>
                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${STATUS_BADGE[doc.status] || 'bg-gray-100 text-gray-600'}`}>
                    {doc.status}
                  </span>
                </div>
                <p className="text-[10px] text-gray-400">{doc.format} &middot; {doc.size} &middot; {formatShortDate(doc.date)}</p>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="text-blue-500 hover:text-blue-700 p-1" title="View">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
                <button className="text-blue-500 hover:text-blue-700 p-1" title="Download">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

function StatBox({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div className={`${bg} rounded-lg p-2 text-center`}>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-gray-500 font-medium">{label}</p>
    </div>
  );
}

function formatShortDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export default DocumentsWidget;
