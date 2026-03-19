/**
 * Bulk Excel download/upload service for Cost Centres, Departments, Sub-Departments.
 * Generates sample Excel templates and processes uploaded Excel files.
 * Uses the Configurator API (via configuratorService) for fetching existing data and creating entries.
 */

import * as XLSX from 'xlsx';
import axios from 'axios';
import { prisma } from '../utils/prisma';
import { configuratorService } from './configurator.service';
import { config } from '../config/config';
import { AppError } from '../middlewares/errorHandler';

const CONFIGURATOR_BASE = config.configuratorApiUrl;

/* ─── Helpers ──────────────────────────────────────────────────────── */

async function getConfigContext(organizationId: string, userId: string, frontendToken?: string) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { configuratorCompanyId: true },
  });
  if (!org?.configuratorCompanyId) {
    throw new AppError('Organization not linked to Configurator', 400);
  }

  // Prefer the fresh token sent from the frontend (which has auto-refresh)
  if (frontendToken) {
    return { companyId: org.configuratorCompanyId, accessToken: frontendToken };
  }

  // Fallback: use the token stored in the DB
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { configuratorAccessToken: true },
  });
  if (!user?.configuratorAccessToken) {
    throw new AppError('Configurator token not found. Please login again.', 401);
  }
  return { companyId: org.configuratorCompanyId, accessToken: user.configuratorAccessToken };
}

/**
 * Fetch helpers that THROW on error (unlike configuratorService which silently returns []).
 * Critical for bulk upload — we need to know if the API call failed vs returned empty.
 */
async function fetchCostCentres(accessToken: string, companyId: number): Promise<any[]> {
  try {
    const res = await axios.post(`${CONFIGURATOR_BASE}/api/v1/cost-centres/list`,
      { company_id: companyId },
      { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, timeout: 15000 },
    );
    const data = res.data;
    const list = Array.isArray(data) ? data : (data?.data ?? data?.cost_centres ?? data?.results ?? []);
    return list.filter((item: any) => item.is_active !== false);
  } catch (err: any) {
    const status = err?.response?.status;
    if (status === 401) throw new AppError('Configurator token expired. Please log out and log back in.', 401);
    throw new AppError(`Failed to fetch cost centres from Configurator (${status || err.code})`, 500);
  }
}

async function fetchDepartments(accessToken: string, companyId: number): Promise<any[]> {
  try {
    const res = await axios.post(`${CONFIGURATOR_BASE}/api/v1/departments/list`,
      { company_id: companyId },
      { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, timeout: 15000 },
    );
    const data = res.data;
    const list = Array.isArray(data) ? data : (data?.data ?? data?.departments ?? data?.results ?? []);
    return list.filter((item: any) => item.is_active !== false);
  } catch (err: any) {
    const status = err?.response?.status;
    if (status === 401) throw new AppError('Configurator token expired. Please log out and log back in.', 401);
    throw new AppError(`Failed to fetch departments from Configurator (${status || err.code})`, 500);
  }
}

async function fetchSubDepartments(accessToken: string, companyId: number): Promise<any[]> {
  try {
    const res = await axios.post(`${CONFIGURATOR_BASE}/api/v1/sub-departments/list`,
      { company_id: companyId },
      { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, timeout: 15000 },
    );
    const data = res.data;
    const list = Array.isArray(data) ? data : (data?.data ?? data?.sub_departments ?? data?.results ?? []);
    return list.filter((item: any) => item.is_active !== false);
  } catch (err: any) {
    const status = err?.response?.status;
    if (status === 401) throw new AppError('Configurator token expired. Please log out and log back in.', 401);
    throw new AppError(`Failed to fetch sub-departments from Configurator (${status || err.code})`, 500);
  }
}

interface BulkResult {
  total: number;
  created: number;
  skipped: number;
  failed: number;
  failures: { row: number; name: string; message: string }[];
}

/* ─── Cost Centre ──────────────────────────────────────────────────── */

export async function generateCostCentreExcel(organizationId: string, userId: string, configToken?: string): Promise<Buffer> {
  const { companyId, accessToken } = await getConfigContext(organizationId, userId, configToken);
  const existing = await fetchCostCentres(accessToken, companyId);

  // Header-only template — no sample data to avoid accidental uploads
  const ws = XLSX.utils.aoa_to_sheet([['S.No', 'Name', 'Code']]);
  // Set column widths
  ws['!cols'] = [{ wch: 8 }, { wch: 30 }, { wch: 20 }];

  // Add existing data sheet for reference
  const existingRows = existing.map((c: any, i: number) => ({
    'S.No': i + 1,
    'Name': c.name ?? c.Name ?? '',
    'Code': c.code ?? c.Code ?? '',
  }));
  const wsExisting = XLSX.utils.json_to_sheet(existingRows.length ? existingRows : [{ 'S.No': '', 'Name': 'No existing data', 'Code': '' }]);
  wsExisting['!cols'] = [{ wch: 8 }, { wch: 30 }, { wch: 20 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Upload');
  XLSX.utils.book_append_sheet(wb, wsExisting, 'Existing Data');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

export async function processCostCentreUpload(
  buffer: Buffer, organizationId: string, userId: string, configToken?: string,
): Promise<BulkResult> {
  const { companyId, accessToken } = await getConfigContext(organizationId, userId, configToken);

  // Parse Excel
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new AppError('Excel file has no sheets', 400);
  const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);
  if (!rows.length) throw new AppError('Excel file is empty. Please fill in data before uploading.', 400);

  // Fetch existing for duplicate check
  const existing = await fetchCostCentres(accessToken, companyId);
  const existingNames = new Set(existing.map((c: any) => (c.name ?? c.Name ?? '').toLowerCase().trim()));

  const result: BulkResult = { total: rows.length, created: 0, skipped: 0, failed: 0, failures: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const name = String(row['Name'] || row['name'] || '').trim();
    const code = String(row['Code'] || row['code'] || '').trim();
    const rowNum = i + 2; // Excel row (header is row 1)

    if (!name) {
      result.failed++;
      result.failures.push({ row: rowNum, name: '', message: 'Name is required' });
      continue;
    }

    if (existingNames.has(name.toLowerCase())) {
      result.skipped++;
      result.failures.push({ row: rowNum, name, message: 'Duplicate — already exists' });
      continue;
    }

    try {
      await configuratorService.createCostCentre(accessToken, {
        name,
        code: code || name.replace(/\s+/g, '_').toUpperCase(),
        company_id: companyId,
      });
      existingNames.add(name.toLowerCase()); // prevent intra-file duplicates
      result.created++;
    } catch (err: any) {
      result.failed++;
      result.failures.push({ row: rowNum, name, message: err?.response?.data?.detail || err?.message || 'Creation failed' });
    }
  }

  return result;
}

/* ─── Department ───────────────────────────────────────────────────── */

export async function generateDepartmentExcel(organizationId: string, userId: string, configToken?: string): Promise<Buffer> {
  const { companyId, accessToken } = await getConfigContext(organizationId, userId, configToken);
  const existingDepts = await fetchDepartments(accessToken, companyId);
  const existingCC = await fetchCostCentres(accessToken, companyId);

  // Header-only template — no sample data to avoid accidental uploads
  const ws = XLSX.utils.aoa_to_sheet([['S.No', 'Name', 'Cost Centre Name']]);
  ws['!cols'] = [{ wch: 8 }, { wch: 30 }, { wch: 30 }];

  // Existing departments sheet
  const existingRows = existingDepts.map((d: any, i: number) => ({
    'S.No': i + 1,
    'Name': d.name ?? '',
    'Code': d.code ?? '',
    'Cost Centre': existingCC.find((c: any) => c.id === d.cost_centre_id)?.name ?? '',
  }));
  const wsExisting = XLSX.utils.json_to_sheet(existingRows.length ? existingRows : [{ 'S.No': '', 'Name': 'No existing data', 'Code': '', 'Cost Centre': '' }]);
  wsExisting['!cols'] = [{ wch: 8 }, { wch: 30 }, { wch: 20 }, { wch: 30 }];

  // Cost centres reference sheet
  const ccRef = existingCC.map((c: any, i: number) => ({ 'S.No': i + 1, 'Cost Centre Name': c.name ?? c.Name ?? '', 'Code': c.code ?? c.Code ?? '' }));
  const wsCC = XLSX.utils.json_to_sheet(ccRef.length ? ccRef : [{ 'S.No': '', 'Cost Centre Name': 'No cost centres', 'Code': '' }]);
  wsCC['!cols'] = [{ wch: 8 }, { wch: 30 }, { wch: 20 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Upload');
  XLSX.utils.book_append_sheet(wb, wsExisting, 'Existing Departments');
  XLSX.utils.book_append_sheet(wb, wsCC, 'Cost Centres Reference');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

export async function processDepartmentUpload(
  buffer: Buffer, organizationId: string, userId: string, configToken?: string,
): Promise<BulkResult> {
  const { companyId, accessToken } = await getConfigContext(organizationId, userId, configToken);

  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new AppError('Excel file has no sheets', 400);
  const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);
  if (!rows.length) throw new AppError('Excel file is empty. Please fill in data before uploading.', 400);

  // Fetch existing for duplicate check and cost centre resolution
  const existingDepts = await fetchDepartments(accessToken, companyId);
  const existingCC = await fetchCostCentres(accessToken, companyId);

  const existingDeptNames = new Set(existingDepts.map((d: any) => (d.name ?? '').toLowerCase().trim()));
  const ccLookup = new Map(existingCC.map((c: any) => [(c.name ?? c.Name ?? '').toLowerCase().trim(), c.id]));

  const result: BulkResult = { total: rows.length, created: 0, skipped: 0, failed: 0, failures: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const name = String(row['Name'] || row['name'] || '').trim();
    const ccName = String(row['Cost Centre Name'] || row['cost_centre_name'] || row['Cost Centre'] || '').trim();
    const rowNum = i + 2;

    if (!name) {
      result.failed++;
      result.failures.push({ row: rowNum, name: '', message: 'Name is required' });
      continue;
    }

    if (!ccName) {
      result.failed++;
      result.failures.push({ row: rowNum, name, message: 'Cost Centre Name is required' });
      continue;
    }

    const ccId = ccLookup.get(ccName.toLowerCase());
    if (!ccId) {
      result.failed++;
      result.failures.push({ row: rowNum, name, message: `Cost Centre "${ccName}" not found` });
      continue;
    }

    if (existingDeptNames.has(name.toLowerCase())) {
      result.skipped++;
      result.failures.push({ row: rowNum, name, message: 'Duplicate — already exists' });
      continue;
    }

    try {
      await configuratorService.createDepartment(accessToken, {
        name,
        code: name.replace(/\s+/g, '_').toUpperCase(),
        cost_centre_id: ccId,
        company_id: companyId,
      });
      existingDeptNames.add(name.toLowerCase());
      result.created++;
    } catch (err: any) {
      result.failed++;
      result.failures.push({ row: rowNum, name, message: err?.response?.data?.detail || err?.message || 'Creation failed' });
    }
  }

  return result;
}

/* ─── Sub-Department ───────────────────────────────────────────────── */

export async function generateSubDepartmentExcel(organizationId: string, userId: string, configToken?: string): Promise<Buffer> {
  const { companyId, accessToken } = await getConfigContext(organizationId, userId, configToken);
  const existingSubs = await fetchSubDepartments(accessToken, companyId);
  const existingDepts = await fetchDepartments(accessToken, companyId);

  // Header-only template — no sample data to avoid accidental uploads
  const ws = XLSX.utils.aoa_to_sheet([['S.No', 'Name', 'Department Name']]);
  ws['!cols'] = [{ wch: 8 }, { wch: 30 }, { wch: 30 }];

  // Existing sub-departments sheet
  const existingRows = existingSubs.map((s: any, i: number) => ({
    'S.No': i + 1,
    'Name': s.name ?? '',
    'Code': s.code ?? '',
    'Department': existingDepts.find((d: any) => d.id === s.department_id)?.name ?? '',
  }));
  const wsExisting = XLSX.utils.json_to_sheet(existingRows.length ? existingRows : [{ 'S.No': '', 'Name': 'No existing data', 'Code': '', 'Department': '' }]);
  wsExisting['!cols'] = [{ wch: 8 }, { wch: 30 }, { wch: 20 }, { wch: 30 }];

  // Departments reference sheet
  const deptRef = existingDepts.map((d: any, i: number) => ({ 'S.No': i + 1, 'Department Name': d.name ?? '', 'Code': d.code ?? '' }));
  const wsDept = XLSX.utils.json_to_sheet(deptRef.length ? deptRef : [{ 'S.No': '', 'Department Name': 'No departments', 'Code': '' }]);
  wsDept['!cols'] = [{ wch: 8 }, { wch: 30 }, { wch: 20 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Upload');
  XLSX.utils.book_append_sheet(wb, wsExisting, 'Existing Sub-Departments');
  XLSX.utils.book_append_sheet(wb, wsDept, 'Departments Reference');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

export async function processSubDepartmentUpload(
  buffer: Buffer, organizationId: string, userId: string, configToken?: string,
): Promise<BulkResult> {
  const { companyId, accessToken } = await getConfigContext(organizationId, userId, configToken);

  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new AppError('Excel file has no sheets', 400);
  const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);
  if (!rows.length) throw new AppError('Excel file is empty. Please fill in data before uploading.', 400);

  // Fetch existing for duplicate check and department resolution
  const existingSubs = await fetchSubDepartments(accessToken, companyId);
  const existingDepts = await fetchDepartments(accessToken, companyId);

  const existingSubNames = new Set(existingSubs.map((s: any) => (s.name ?? '').toLowerCase().trim()));
  const deptLookup = new Map(existingDepts.map((d: any) => [(d.name ?? '').toLowerCase().trim(), d.id]));

  const result: BulkResult = { total: rows.length, created: 0, skipped: 0, failed: 0, failures: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const name = String(row['Name'] || row['name'] || '').trim();
    const deptName = String(row['Department Name'] || row['department_name'] || row['Department'] || '').trim();
    const rowNum = i + 2;

    if (!name) {
      result.failed++;
      result.failures.push({ row: rowNum, name: '', message: 'Name is required' });
      continue;
    }

    if (!deptName) {
      result.failed++;
      result.failures.push({ row: rowNum, name, message: 'Department Name is required' });
      continue;
    }

    const deptId = deptLookup.get(deptName.toLowerCase());
    if (!deptId) {
      result.failed++;
      result.failures.push({ row: rowNum, name, message: `Department "${deptName}" not found` });
      continue;
    }

    if (existingSubNames.has(name.toLowerCase())) {
      result.skipped++;
      result.failures.push({ row: rowNum, name, message: 'Duplicate — already exists' });
      continue;
    }

    try {
      await configuratorService.createSubDepartment(accessToken, {
        name,
        code: name.replace(/\s+/g, '_').toUpperCase(),
        department_id: deptId,
        company_id: companyId,
      });
      existingSubNames.add(name.toLowerCase());
      result.created++;
    } catch (err: any) {
      result.failed++;
      result.failures.push({ row: rowNum, name, message: err?.response?.data?.detail || err?.message || 'Creation failed' });
    }
  }

  return result;
}
