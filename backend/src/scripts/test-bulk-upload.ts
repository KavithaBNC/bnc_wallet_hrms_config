/**
 * Test script: Verify bulk upload parsing and Config DB integration
 * Run: npx ts-node -r tsconfig-paths/register src/scripts/test-bulk-upload.ts
 */

import * as XLSX from 'xlsx';
import * as path from 'path';
import { EmployeeBulkImportService } from '../services/employee-bulk-import.service';
import * as fs from 'fs';

async function main() {
  console.log('=== Bulk Upload Test ===\n');

  const filePath = path.resolve(__dirname, '../../../docs/bnc emp.xlsx');
  console.log('File:', filePath);

  if (!fs.existsSync(filePath)) {
    console.error('File not found!');
    process.exit(1);
  }

  const buffer = fs.readFileSync(filePath);
  console.log('File size:', buffer.length, 'bytes\n');

  // Check what sheet_to_json produces
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
  console.log('Raw row count:', rawRows.length);
  console.log('Row 0 keys:', Object.keys(rawRows[0] || {}).slice(0, 5));
  console.log('Row 0 values:', Object.values(rawRows[0] || {}).slice(0, 5));
  console.log('Row 1 keys:', Object.keys(rawRows[1] || {}).slice(0, 5));
  console.log('Row 1 values:', Object.values(rawRows[1] || {}).slice(0, 5));

  // Test parseExcel
  const service = new EmployeeBulkImportService();
  try {
    const parsed = service.parseExcel(buffer);
    console.log('\n--- Parsed rows:', parsed.length, '---');
    for (const row of parsed) {
      console.log(`  Row ${row.rowIndex}: ${row.firstName} ${row.lastName} | email: ${row.email} | dept: ${row.department} | cc: ${row.costCentreName} | subDept: ${row.subDepartment} | code: ${row.employeeCode}`);
    }
  } catch (err: any) {
    console.error('Parse error:', err.message);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
