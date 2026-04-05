/**
 * Bulk Excel download/upload service for Cost Centres, Departments, Sub-Departments.
 * Generates sample Excel templates and processes uploaded Excel files.
 * Uses the Configurator API (via configuratorService) for fetching existing data and creating entries.
 */

import * as XLSX from 'xlsx';
import { prisma } from '../utils/prisma';
import { configOrgDataService } from './config-org-data.service';
import { AppError } from '../middlewares/errorHandler';

/* ─── Helpers ──────────────────────────────────────────────────────── */

async function getConfigContext(organizationId: string, _userId: string, _frontendToken?: string) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { configuratorCompanyId: true },
  });
  if (!org?.configuratorCompanyId) {
    throw new AppError('Organization not linked to Configurator', 400);
  }
  // Direct Config DB access — no token needed
  return { companyId: org.configuratorCompanyId };
}

/**
 * Fetch helpers — direct Config DB queries, no API calls needed.
 */
async function fetchCostCentres(companyId: number): Promise<any[]> {
  return configOrgDataService.getCostCentres(companyId);
}

async function fetchDepartments(companyId: number): Promise<any[]> {
  return configOrgDataService.getDepartments(companyId);
}

async function fetchSubDepartments(companyId: number): Promise<any[]> {
  return configOrgDataService.getSubDepartments(companyId);
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
  const { companyId } = await getConfigContext(organizationId, userId, configToken);
  const existing = await fetchCostCentres(companyId);

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
  const { companyId } = await getConfigContext(organizationId, userId, configToken);

  // Parse Excel
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new AppError('Excel file has no sheets', 400);
  const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);
  if (!rows.length) throw new AppError('Excel file is empty. Please fill in data before uploading.', 400);

  // Fetch existing for duplicate check
  const existing = await fetchCostCentres(companyId);
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
      // Direct Config DB access — no token needed
      await configOrgDataService.createCostCentre({
        name,
        code: code || name.replace(/\s+/g, '_').toUpperCase(),
        company_id: companyId,
      });
      existingNames.add(name.toLowerCase()); // prevent intra-file duplicates
      result.created++;
    } catch (err: any) {
      result.failed++;
      result.failures.push({ row: rowNum, name, message: err?.message || 'Creation failed' });
    }
  }

  return result;
}

/* ─── Department ───────────────────────────────────────────────────── */

export async function generateDepartmentExcel(organizationId: string, userId: string, configToken?: string): Promise<Buffer> {
  const { companyId } = await getConfigContext(organizationId, userId, configToken);
  const existingDepts = await fetchDepartments(companyId);
  const existingCC = await fetchCostCentres(companyId);

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
  const { companyId } = await getConfigContext(organizationId, userId, configToken);

  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new AppError('Excel file has no sheets', 400);
  const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);
  if (!rows.length) throw new AppError('Excel file is empty. Please fill in data before uploading.', 400);

  // Fetch existing for duplicate check and cost centre resolution
  const existingDepts = await fetchDepartments(companyId);
  const existingCC = await fetchCostCentres(companyId);

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
      // Direct Config DB access — no token needed
      await configOrgDataService.createDepartment({
        name,
        code: name.replace(/\s+/g, '_').toUpperCase(),
        cost_centre_id: ccId,
        company_id: companyId,
      });
      existingDeptNames.add(name.toLowerCase());
      result.created++;
    } catch (err: any) {
      result.failed++;
      result.failures.push({ row: rowNum, name, message: err?.message || 'Creation failed' });
    }
  }

  return result;
}

/* ─── Sub-Department ───────────────────────────────────────────────── */

export async function generateSubDepartmentExcel(organizationId: string, userId: string, configToken?: string): Promise<Buffer> {
  const { companyId } = await getConfigContext(organizationId, userId, configToken);
  const existingSubs = await fetchSubDepartments(companyId);
  const existingDepts = await fetchDepartments(companyId);

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
  const { companyId } = await getConfigContext(organizationId, userId, configToken);

  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new AppError('Excel file has no sheets', 400);
  const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);
  if (!rows.length) throw new AppError('Excel file is empty. Please fill in data before uploading.', 400);

  // Fetch existing for duplicate check and department resolution
  const existingSubs = await fetchSubDepartments(companyId);
  const existingDepts = await fetchDepartments(companyId);

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
      // Direct Config DB access — no token needed
      await configOrgDataService.createSubDepartment({
        name,
        code: name.replace(/\s+/g, '_').toUpperCase(),
        department_id: deptId,
        company_id: companyId,
      });
      existingSubNames.add(name.toLowerCase());
      result.created++;
    } catch (err: any) {
      result.failed++;
      result.failures.push({ row: rowNum, name, message: err?.message || 'Creation failed' });
    }
  }

  return result;
}
