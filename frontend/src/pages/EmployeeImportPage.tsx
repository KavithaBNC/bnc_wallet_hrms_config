import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import employeeService from '../services/employee.service';
import AppHeader from '../components/layout/AppHeader';
import * as XLSX from 'xlsx';

type ImportState = 'initial' | 'file-selected' | 'validating' | 'success' | 'validation-failed' | 'upload-failed';

interface ImportResult {
  total: number;
  success: number;
  updated: number;
  skipped: number;
  failed: number;
  managersSet?: number;
  configuratorSyncStatus?: string;
  configuratorSyncMessage?: string;
}

export default function EmployeeImportPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<ImportState>('initial');
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState('');

  const organizationId =
    user?.employee?.organizationId ||
    user?.employee?.organization?.id ||
    (user as any)?.organizationId ||
    '';

  const handleFileSelect = useCallback((selectedFile: File | null) => {
    if (!selectedFile) return;
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ];
    if (!validTypes.includes(selectedFile.type) && !/\.(xlsx|xls|csv)$/i.test(selectedFile.name)) {
      setErrorMessage('Only Excel (.xlsx, .xls) and CSV files are allowed');
      setState('upload-failed');
      return;
    }
    setFile(selectedFile);
    setState('file-selected');
    setResult(null);
    setValidationErrors([]);
    setErrorMessage('');
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files?.[0];
    handleFileSelect(droppedFile || null);
  }, [handleFileSelect]);

  const handleUpload = async () => {
    if (!file) return;
    if (!organizationId) {
      setErrorMessage('No organization found. Please ensure your account is linked to an organization.');
      setState('upload-failed');
      return;
    }

    setState('validating');
    setResult(null);
    setValidationErrors([]);
    setErrorMessage('');

    try {
      const res = await employeeService.bulkImport(file, organizationId, {
        createSalaryRecords: true,
        skipConfiguratorSync: false,
      });

      setResult({
        total: res.total,
        success: res.success,
        updated: res.updated,
        skipped: res.skipped,
        failed: res.failed,
        managersSet: res.managersSet,
        configuratorSyncStatus: res.configuratorSyncStatus,
        configuratorSyncMessage: res.configuratorSyncMessage,
      });
      setState('success');
    } catch (err: any) {
      const status = err?.response?.status;
      const data = err?.response?.data;

      // Structured validation errors from backend
      if (status === 400 && data?.validationErrors && Array.isArray(data.validationErrors)) {
        setValidationErrors(data.validationErrors);
        setErrorMessage(data.message || 'Validation failed');
        setState('validation-failed');
      } else if (status === 400) {
        // Legacy: parse from message string
        const msg = data?.message || err?.message || 'Validation failed';
        const lines = msg.split('\n').filter((l: string) => l.trim());
        if (lines.length > 1) {
          setErrorMessage(lines[0]);
          setValidationErrors(lines.slice(1));
        } else {
          setErrorMessage(msg);
          setValidationErrors([]);
        }
        setState('validation-failed');
      } else if (!err?.response && (err?.code === 'ECONNREFUSED' || err?.message?.includes('Network'))) {
        setErrorMessage('Cannot connect to server. Please ensure the backend is running.');
        setState('upload-failed');
      } else {
        setErrorMessage(data?.message || err?.message || 'Import failed with an unexpected error');
        setState('upload-failed');
      }
    }
  };

  const handleReset = () => {
    setState('initial');
    setFile(null);
    setResult(null);
    setValidationErrors([]);
    setErrorMessage('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownloadTemplate = () => {
    // Generate empty HRMS template with column headers only (49 columns)
    const COLUMNS = [
      'S.No', 'Paygroup', 'Associate Code', 'Associate First Name', 'Associate Last Name', 'Gender',
      'Department', 'Sub Department', 'Cost Centre', 'Designation', 'Role',
      'Father Name', 'Blood Group', 'Date of Birth', 'Date of Joining',
      'Pan Card Number', 'Bank Name', 'Account No', 'Bank IFSC Code',
      'Permanent E-Mail Id', 'Official E-Mail Id',
      'Permanent Address', 'Permanent City', 'Permanent District', 'Permanent State', 'Permanent Pincode', 'Permanent Phone', 'Permanent mobile',
      'Current Address', 'Current City', 'Current District', 'Current State', 'Current Pincode', 'Current Phone',
      'Place of Tax Deduction', 'PF Number', 'ESI Number', 'Location', 'ESI Location', 'Ptax Location',
      'Marital Status', 'Reporting Manager', 'Associate Notice Period Days', 'LWF Location',
      'UAN Number', 'Adhaar Number', 'Tax Regime', 'Alternate Saturday Off', 'Compoff Applicable', 'Fixed Gross', 'Vehicle Allowances',
    ];
    const ws = XLSX.utils.aoa_to_sheet([COLUMNS]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Employees');
    XLSX.writeFile(wb, `employee_import_template_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-100">
      <AppHeader
        title="Employee Bulk Import"
        subtitle={user?.employee?.organization?.name || undefined}
        onLogout={() => { logout(); navigate('/login'); }}
      />

      <main className="flex-1 min-h-0 overflow-auto w-full px-4 sm:px-6 lg:px-8 py-6 bg-gray-50">
        <div className="w-full max-w-3xl mx-auto">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
            <button
              onClick={() => navigate('/employees')}
              className="flex items-center gap-1 text-orange-600 hover:text-orange-700 font-medium"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Employee Directory
            </button>
            <span className="text-gray-400">/</span>
            <span className="font-semibold text-gray-900">Bulk Import</span>
          </nav>

          {/* Main Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-orange-500 to-orange-600">
              <h1 className="text-xl font-semibold text-white">Import Employees from Excel</h1>
              <p className="text-orange-100 text-sm mt-1">Upload an Excel file to add multiple employees at once. All rows are validated before import.</p>
            </div>

            <div className="p-6 space-y-6">
              {/* Download Template */}
              <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div>
                  <p className="text-sm font-medium text-gray-700">Need a template?</p>
                  <p className="text-xs text-gray-500 mt-0.5">Download the sample Excel template with all required columns.</p>
                </div>
                <button
                  onClick={handleDownloadTemplate}
                  className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download Template
                </button>
              </div>

              {/* File Upload Area — show only in initial / file-selected / validation-failed / upload-failed */}
              {(state === 'initial' || state === 'file-selected' || state === 'validation-failed' || state === 'upload-failed') && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Select Excel File</label>
                    <div
                      className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                        dragOver
                          ? 'border-orange-400 bg-orange-50'
                          : file
                          ? 'border-green-300 bg-green-50'
                          : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
                      }`}
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        className="hidden"
                        onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                      />

                      {file ? (
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                            <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{file.name}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{formatFileSize(file.size)}</p>
                          </div>
                          <p className="text-xs text-gray-400">Click or drop to replace</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                            <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                          </div>
                          <p className="text-sm text-gray-600">
                            <span className="font-medium text-orange-600">Click to browse</span> or drag and drop
                          </p>
                          <p className="text-xs text-gray-400">Supports .xlsx, .xls, .csv (max 50MB)</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Upload Button */}
                  <div className="flex justify-end gap-3">
                    {file && (
                      <button
                        onClick={handleReset}
                        className="px-4 py-2.5 text-sm font-medium border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                      >
                        Clear
                      </button>
                    )}
                    <button
                      onClick={handleUpload}
                      disabled={!file}
                      className="px-6 py-2.5 text-sm font-medium bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Upload & Validate
                    </button>
                  </div>
                </>
              )}

              {/* Validating State */}
              {state === 'validating' && (
                <div className="flex flex-col items-center py-12 gap-4">
                  <div className="relative">
                    <div className="w-16 h-16 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-medium text-gray-900">Validating & Importing...</p>
                    <p className="text-sm text-gray-500 mt-1">Checking all rows against master data before inserting. Please wait.</p>
                  </div>
                </div>
              )}

              {/* Validation Failed State */}
              {state === 'validation-failed' && (
                <div className="space-y-4">
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-red-800">Validation Failed</h3>
                        <p className="text-sm text-red-700 mt-1">{errorMessage}</p>
                        <p className="text-xs text-red-600 mt-1 font-medium">No employees were imported. Fix the issues below and try again.</p>
                      </div>
                    </div>
                  </div>

                  {validationErrors.length > 0 && (
                    <div className="border border-red-200 rounded-xl overflow-hidden">
                      <div className="bg-red-50 px-4 py-3 border-b border-red-200">
                        <h4 className="text-sm font-semibold text-red-800">
                          {validationErrors.length} Issue{validationErrors.length !== 1 ? 's' : ''} Found
                        </h4>
                      </div>
                      <div className="max-h-80 overflow-auto divide-y divide-red-100">
                        {validationErrors.map((error, idx) => {
                          const rowMatch = error.match(/^Row\s+(\d+):\s*(.*)/);
                          return (
                            <div key={idx} className="px-4 py-3 flex items-start gap-3 hover:bg-red-50/50 transition">
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-700 text-xs font-bold flex-shrink-0">
                                {rowMatch ? rowMatch[1] : idx + 1}
                              </span>
                              <p className="text-sm text-red-700">
                                {rowMatch ? rowMatch[2] : error}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <button
                      onClick={handleReset}
                      className="px-5 py-2.5 text-sm font-medium bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition"
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              )}

              {/* Upload Failed State */}
              {state === 'upload-failed' && !validationErrors.length && (
                <div className="space-y-4">
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-red-800">Upload Failed</h3>
                        <p className="text-sm text-red-700 mt-1">{errorMessage}</p>
                        <p className="text-xs text-red-600 mt-1">No employees were imported.</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={handleReset}
                      className="px-5 py-2.5 text-sm font-medium bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition"
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              )}

              {/* Success State */}
              {state === 'success' && result && (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-xl p-5">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                        <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-green-800">Import Successful!</h3>
                        <p className="text-sm text-green-700 mt-1">All employees have been imported and are now visible in the employee directory.</p>
                      </div>
                    </div>
                  </div>

                  {/* Result Summary Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-gray-900">{result.total}</p>
                      <p className="text-xs text-gray-500 mt-1">Total Rows</p>
                    </div>
                    <div className="bg-white border border-green-200 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-green-600">{result.success}</p>
                      <p className="text-xs text-gray-500 mt-1">Created</p>
                    </div>
                    {(result.managersSet ?? 0) > 0 && (
                      <div className="bg-white border border-blue-200 rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-blue-600">{result.managersSet}</p>
                        <p className="text-xs text-gray-500 mt-1">Managers Set</p>
                      </div>
                    )}
                    {result.configuratorSyncStatus && (
                      <div className={`bg-white border rounded-lg p-4 text-center ${
                        result.configuratorSyncStatus === 'success' ? 'border-green-200' : 'border-amber-200'
                      }`}>
                        <p className={`text-sm font-bold ${
                          result.configuratorSyncStatus === 'success' ? 'text-green-600' : 'text-amber-600'
                        }`}>
                          {result.configuratorSyncStatus === 'success' ? 'Synced' : result.configuratorSyncStatus}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">Configurator</p>
                      </div>
                    )}
                  </div>

                  {result.configuratorSyncMessage && (
                    <div className={`text-xs rounded-lg p-3 ${
                      result.configuratorSyncStatus === 'success'
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                      {result.configuratorSyncMessage}
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      onClick={handleReset}
                      className="px-4 py-2.5 text-sm font-medium border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                    >
                      Import More
                    </button>
                    <button
                      onClick={() => navigate('/employees')}
                      className="px-5 py-2.5 text-sm font-medium bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition flex items-center gap-2"
                    >
                      View Employees
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              {/* Info Note */}
              {(state === 'initial' || state === 'file-selected') && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="text-xs text-blue-700 space-y-1">
                      <p className="font-medium">All-or-nothing validation:</p>
                      <ul className="list-disc list-inside space-y-0.5 text-blue-600">
                        <li>All dropdown fields (Department, Sub Department, Cost Centre, User Role) are validated against master data</li>
                        <li>Required fields: Name, Email, Date of Joining, Date of Birth, Gender, Department, Sub Department, Cost Centre, Paygroup, Phone, Place of Tax Deduction</li>
                        <li>If even one row has an invalid value, the entire upload is blocked</li>
                        <li>No partial imports — either all employees are created, or none</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
