/**
 * Bulk Excel download/upload service for Designations (job_positions) and Entities.
 * Uses local HRMS database via Prisma (NOT the Configurator API).
 */

import * as XLSX from 'xlsx';
import { prisma } from '../utils/prisma';
import { AppError } from '../middlewares/errorHandler';

interface BulkResult {
  total: number;
  created: number;
  skipped: number;
  failed: number;
  failures: { row: number; name: string; message: string }[];
}

/* ─── Designation (job_positions) ─────────────────────────────────── */

export async function generateDesignationExcel(organizationId: string): Promise<Buffer> {
  const existing = await prisma.jobPosition.findMany({
    where: { organizationId, isActive: true },
    orderBy: { title: 'asc' },
    select: { title: true, code: true },
  });

  const ws = XLSX.utils.aoa_to_sheet([['S.No', 'Name', 'Code']]);
  ws['!cols'] = [{ wch: 8 }, { wch: 30 }, { wch: 20 }];

  const existingRows = existing.map((p, i) => ({
    'S.No': i + 1,
    'Name': p.title ?? '',
    'Code': p.code ?? '',
  }));
  const wsExisting = XLSX.utils.json_to_sheet(
    existingRows.length ? existingRows : [{ 'S.No': '', 'Name': 'No existing data', 'Code': '' }]
  );
  wsExisting['!cols'] = [{ wch: 8 }, { wch: 30 }, { wch: 20 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Upload');
  XLSX.utils.book_append_sheet(wb, wsExisting, 'Existing Data');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

export async function processDesignationUpload(buffer: Buffer, organizationId: string): Promise<BulkResult> {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new AppError('Excel file has no sheets', 400);
  const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);
  if (!rows.length) throw new AppError('Excel file is empty. Please fill in data before uploading.', 400);

  const existing = await prisma.jobPosition.findMany({
    where: { organizationId, isActive: true },
    select: { title: true },
  });
  const existingNames = new Set(existing.map((p) => p.title.toLowerCase().trim()));

  const result: BulkResult = { total: rows.length, created: 0, skipped: 0, failed: 0, failures: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const name = String(row['Name'] || row['name'] || '').trim();
    const code = String(row['Code'] || row['code'] || '').trim();
    const rowNum = i + 2;

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
      await prisma.jobPosition.create({
        data: {
          organizationId,
          title: name,
          code: code || null,
          isActive: true,
        },
      });
      existingNames.add(name.toLowerCase());
      result.created++;
    } catch (err: any) {
      result.failed++;
      result.failures.push({ row: rowNum, name, message: err?.message || 'Creation failed' });
    }
  }

  return result;
}

/* ─── Entity ──────────────────────────────────────────────────────── */

export async function generateEntityExcel(organizationId: string): Promise<Buffer> {
  const existing = await prisma.entity.findMany({
    where: { organizationId, isActive: true },
    orderBy: { name: 'asc' },
    select: { name: true, code: true },
  });

  const ws = XLSX.utils.aoa_to_sheet([['S.No', 'Name', 'Code']]);
  ws['!cols'] = [{ wch: 8 }, { wch: 30 }, { wch: 20 }];

  const existingRows = existing.map((e, i) => ({
    'S.No': i + 1,
    'Name': e.name ?? '',
    'Code': e.code ?? '',
  }));
  const wsExisting = XLSX.utils.json_to_sheet(
    existingRows.length ? existingRows : [{ 'S.No': '', 'Name': 'No existing data', 'Code': '' }]
  );
  wsExisting['!cols'] = [{ wch: 8 }, { wch: 30 }, { wch: 20 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Upload');
  XLSX.utils.book_append_sheet(wb, wsExisting, 'Existing Data');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

export async function processEntityUpload(buffer: Buffer, organizationId: string): Promise<BulkResult> {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new AppError('Excel file has no sheets', 400);
  const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);
  if (!rows.length) throw new AppError('Excel file is empty. Please fill in data before uploading.', 400);

  const existing = await prisma.entity.findMany({
    where: { organizationId, isActive: true },
    select: { name: true },
  });
  const existingNames = new Set(existing.map((e) => e.name.toLowerCase().trim()));

  const result: BulkResult = { total: rows.length, created: 0, skipped: 0, failed: 0, failures: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const name = String(row['Name'] || row['name'] || '').trim();
    const code = String(row['Code'] || row['code'] || '').trim();
    const rowNum = i + 2;

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
      await prisma.entity.create({
        data: {
          organizationId,
          name,
          code: code || null,
          isActive: true,
        },
      });
      existingNames.add(name.toLowerCase());
      result.created++;
    } catch (err: any) {
      result.failed++;
      result.failures.push({ row: rowNum, name, message: err?.message || 'Creation failed' });
    }
  }

  return result;
}
