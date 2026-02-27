const XLSX = require('xlsx');
const wb = XLSX.readFile('docs/employee_import_test_sasikumar.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
const headers = rows[0] ? Object.keys(rows[0]) : [];
console.log('Headers:', headers.join(' | '));
const managerCol = headers.find(h => /manager|report/i.test(h));
console.log('\nReporting Manager column:', managerCol);
console.log('\nFirst 20 rows - Associate Code | Name | Reporting Manager:');
rows.slice(0, 20).forEach((r, i) => {
  const code = r['Associate Code'] || r['associateCode'] || r['EMP.CODE'] || '';
  const name = r['Associate Name'] || r['associateName'] || r['EMP.F.NAME'] || '';
  const mgr = managerCol ? r[managerCol] : (r['Reporting Manager'] || r['reportingManager'] || '');
  console.log((i+1) + ':', String(code), '|', String(name).slice(0,25), '| RM:', String(mgr));
});
