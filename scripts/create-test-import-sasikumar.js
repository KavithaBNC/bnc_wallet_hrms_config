/**
 * Creates test Excel with SASIKUMAR L data for import verification.
 * Run: node scripts/create-test-import-sasikumar.js
 */
const path = require('path');
const XLSX = require(path.join(__dirname, '..', 'frontend', 'node_modules', 'xlsx'));
const fs = require('fs');

const COLUMNS = [
  'S.No', 'Paygroup', 'Associate Code', 'Associate Name', 'Gender', 'Department', 'Designation',
  'Father Name', 'Blood Group', 'Date of Birth', 'Date of Joining', 'Cost Centre', 'Pan Card Number',
  'Bank Name', 'Account No', 'Bank IFSC Code', 'Permanent E-Mail Id', 'Official E-Mail Id',
  'Permanent Address', 'Permanent City', 'Permanent State', 'Permanent Pincode', 'Permanent Phone',
  'Current Address', 'Current City', 'Current State', 'Current Pincode', 'Current Phone',
  'Place of Tax Deduction', 'PF Number', 'ESI Number', 'Location', 'ESI Location', 'Ptax Location',
  'Marital Status', 'Reporting Manager', 'Associate Notice Period Days', 'LWF Location',
  'Permanent District', 'Current District', 'Permanent mobile', 'UAN Number', 'Adhaar Number',
  'Tax Regime', 'Sub Department', 'Alternate Saturday Off', 'Compoff Applicable', 'Fixed Gross', 'Vehicle Allowances',
];

const row = {
  'S.No': 1,
  'Paygroup': 'Staff',
  'Associate Code': 'B001',
  'Associate Name': 'SASIKUMAR L',
  'Gender': 'M',
  'Department': 'R & D',
  'Designation': 'Manager',
  'Father Name': 'LOGANATHAN',
  'Blood Group': 'B+',
  'Date of Birth': '15-Nov-1981',
  'Date of Joining': '25-Dec-2019',
  'Cost Centre': 'R&D - Prototyping',
  'Pan Card Number': 'JDVPS7057E',
  'Bank Name': 'ICICI BANK',
  'Account No': '155001506289',
  'Bank IFSC Code': 'ICIC0001550',
  'Permanent E-Mail Id': '',
  'Official E-Mail Id': 'Sasikumar.L@bncmotors.in',
  'Permanent Address': 'NO.7E/17,RAMASAMYNAGAR, NEELIKONAMPALAYAM',
  'Permanent City': 'COIMBATORE',
  'Permanent State': 'TAMILNADU',
  'Permanent Pincode': '641033',
  'Permanent Phone': '9943872702',
  'Current Address': 'NO.7E/17,RAMASAMYNAGAR, NEELIKONAMPALAYAM',
  'Current City': 'COIMBATORE',
  'Current State': 'TAMILNADU',
  'Current Pincode': '641033',
  'Current Phone': '9943872702',
  'Place of Tax Deduction': 'M',
  'PF Number': 'CBCBE21229460000010009',
  'ESI Number': '31-12345-67-890',
  'Location': 'Coimbatore',
  'ESI Location': 'COIMBATORE',
  'Ptax Location': 'COIMBATORE',
  'Marital Status': 'M',
  'Reporting Manager': 'Vinoth T   [D002 ]',
  'Associate Notice Period Days': '90',
  'LWF Location': 'COIMBATORE',
  'Permanent District': 'COIMBATORE',
  'Current District': 'COIMBATORE',
  'Permanent mobile': '9943872702',
  'UAN Number': '100340013651',
  'Adhaar Number': '274787624160',
  'Tax Regime': 'N',
  'Sub Department': 'Proto Typing',
  'Alternate Saturday Off': '',
  'Compoff Applicable': 'Yes',
  'Fixed Gross': '54400',
  'Vehicle Allowances': '',
};

const ordered = {};
COLUMNS.forEach((col) => { ordered[col] = row[col] ?? ''; });

const worksheet = XLSX.utils.json_to_sheet([ordered]);
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, 'Employees');

const outDir = path.join(__dirname, '..', 'docs');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'employee_import_test_sasikumar.xlsx');
XLSX.writeFile(workbook, outPath);
console.log('Created:', outPath);
console.log('Ready for upload via Employees page Import Excel.');
