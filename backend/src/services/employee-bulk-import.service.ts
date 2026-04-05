/**
 * Bulk Employee Import Service
 *
 * Handles Excel-based bulk employee creation:
 * 1. Forwards Excel file to Configurator upload-excel API (creates users in Config DB)
 * 2. Parses Excel server-side to extract employee-specific fields
 * 3. Batch creates HRMS User + Employee records using Prisma createMany
 * 4. Second pass: resolves reporting managers
 * 5. Third pass: creates salary records
 */

import * as XLSX from 'xlsx';
import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { configPrisma } from '../utils/config-prisma';
import { hashPassword } from '../utils/password';
import { configOrgDataService } from './config-org-data.service';
import { configUsersService } from './config-users.service';
import { configAuthService } from './config-auth.service';
import { config } from '../config/config';
import { AppError } from '../middlewares/errorHandler';
import type { BulkImportResult, BulkImportRowResult } from '../utils/employee-bulk-import.validation';

// ─── Excel parsing helpers (replicated from frontend) ───

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getCellValue(row: Record<string, unknown>, keys: string[]): unknown {
  const normalizedEntries = Object.entries(row).map(([k, v]) => [normalizeHeader(k), v] as const);
  for (const key of keys.map((k) => normalizeHeader(k))) {
    const found = normalizedEntries.find(([k]) => k === key);
    if (found && found[1] !== '' && found[1] != null) return found[1];
  }
  return '';
}

/** Trim, lowercase, collapse whitespace — matches Config / Excel variants */
function normalizeOrgLookupKey(value: string): string {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Same as header normalize: alphanumeric only, for code/name loose match */
function looseAlphanumericKey(value: string): string {
  return normalizeHeader(value);
}

function registerConfigLookupKeys(map: Map<string, number>, id: number, name?: string | null, code?: string | null): void {
  if (name != null && String(name).trim()) {
    const nk = normalizeOrgLookupKey(String(name));
    if (nk) map.set(nk, id);
    const ak = looseAlphanumericKey(String(name));
    if (ak) map.set(ak, id);
  }
  if (code != null && String(code).trim()) {
    const ck = normalizeOrgLookupKey(String(code));
    if (ck) map.set(ck, id);
    const cak = looseAlphanumericKey(String(code));
    if (cak) map.set(cak, id);
  }
}

function lookupConfiguratorId(map: Map<string, number>, raw: string): number | undefined {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return undefined;
  const nk = normalizeOrgLookupKey(trimmed);
  if (nk && map.has(nk)) return map.get(nk);
  const ak = looseAlphanumericKey(trimmed);
  if (ak && map.has(ak)) return map.get(ak);
  return undefined;
}

interface ConfigSubDeptRow {
  id: number;
  name: string;
  code: string | null;
  department_id: number | null;
}

function resolveConfiguratorSubDeptId(
  list: ConfigSubDeptRow[],
  raw: string,
  parentDeptConfiguratorId?: number | null,
): number | undefined {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return undefined;
  const nk = normalizeOrgLookupKey(trimmed);
  const ak = looseAlphanumericKey(trimmed);
  const matches = list.filter((s) => {
    const sn = normalizeOrgLookupKey(s.name);
    const sc = s.code ? normalizeOrgLookupKey(s.code) : '';
    const snA = looseAlphanumericKey(s.name);
    const scA = s.code ? looseAlphanumericKey(s.code) : '';
    const byNorm = Boolean(nk) && (sn === nk || Boolean(sc && sc === nk));
    const byLoose = Boolean(ak) && (snA === ak || Boolean(scA && scA === ak));
    return byNorm || byLoose;
  });
  if (matches.length === 0) return undefined;
  if (parentDeptConfiguratorId != null && parentDeptConfiguratorId > 0) {
    const under = matches.filter((m) => m.department_id === parentDeptConfiguratorId);
    if (under.length) return under[0].id;
  }
  return matches[0].id;
}

function pickDefaultConfiguratorRoleId(
  roleNameToId: Map<string, number>,
): number | undefined {
  const ids = config.configuratorRoleIds;
  if (ids && typeof ids === 'object') {
    for (const k of ['EMPLOYEE', 'employee', 'DEFAULT', 'default']) {
      const v = (ids as Record<string, number>)[k];
      if (typeof v === 'number' && v > 0) return v;
    }
    const fromEnv = Object.values(ids).filter((v) => typeof v === 'number' && v > 0) as number[];
    if (fromEnv.length) return fromEnv[0];
  }
  const fromDb = [...roleNameToId.values()].filter((n) => n > 0);
  if (fromDb.length) return Math.min(...fromDb);
  return undefined;
}

function resolveConfiguratorRoleIdFromExcelValue(
  userRole: string | undefined,
  roleNameToId: Map<string, number>,
): number | undefined {
  if (!userRole?.trim()) return undefined;
  const roleLower = userRole.trim().toLowerCase();
  const roleNormalized = roleLower.replace(/[\s-]+/g, '_');
  return roleNameToId.get(roleLower) || roleNameToId.get(roleNormalized) || undefined;
}

function toDateOnly(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const utcMillis = Math.round((value - 25569) * 86400 * 1000);
    const asDate = new Date(utcMillis);
    if (!Number.isNaN(asDate.getTime())) return asDate.toISOString().slice(0, 10);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const dmy = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
    if (dmy) {
      const a = parseInt(dmy[1], 10);
      const b = parseInt(dmy[2], 10);
      let dd: string, mm: string;
      if (a > 12) { dd = dmy[1].padStart(2, '0'); mm = dmy[2].padStart(2, '0'); }
      else if (b > 12) { mm = dmy[1].padStart(2, '0'); dd = dmy[2].padStart(2, '0'); }
      else { dd = dmy[1].padStart(2, '0'); mm = dmy[2].padStart(2, '0'); }
      return `${dmy[3]}-${mm}-${dd}`;
    }
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
    const monthNames = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    const monthMatch = trimmed.match(/^(\d{1,2})[-./\s]?([a-z]{3,})[-./\s]?(\d{2,4})$/i);
    if (monthMatch) {
      const d = monthMatch[1].padStart(2, '0');
      const mIdx = monthNames.findIndex((m) => monthMatch[2].toLowerCase().startsWith(m));
      if (mIdx >= 0) {
        const m = String(mIdx + 1).padStart(2, '0');
        const y = monthMatch[3].length === 2 ? '20' + monthMatch[3] : monthMatch[3];
        return `${y}-${m}-${d}`;
      }
    }
  }
  return null;
}

function mapGender(val: string): string | undefined {
  const v = (val || '').trim().toUpperCase();
  if (v === 'M' || v === 'MALE') return 'MALE';
  if (v === 'F' || v === 'FEMALE') return 'FEMALE';
  if (v === 'OTHER') return 'OTHER';
  return undefined;
}

function mapMaritalStatus(val: string): string | undefined {
  const v = (val || '').trim().toUpperCase();
  if (v === 'S' || v === 'SINGLE' || v === 'UNMARRIED') return 'SINGLE';
  if (v === 'M' || v === 'MARRIED') return 'MARRIED';
  if (v === 'D' || v === 'DIVORCED') return 'DIVORCED';
  if (v === 'W' || v === 'WIDOWED') return 'WIDOWED';
  return undefined;
}

function getEmailWithFallback(row: Record<string, unknown>): string {
  const official = String(getCellValue(row, ['Official/Permanent E-Mail Id', 'Official E-Mail Id', 'officialEmail', 'Permanent E-Mail Id', 'permanentEmail', 'email', 'Email', 'E-Mail'])).trim();
  if (official && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(official)) return official;
  const normalizedEntries = Object.entries(row).map(([k, v]) => [normalizeHeader(k), v] as const);
  const emailLike = normalizedEntries.find(([norm, val]) => {
    if (!val || typeof val !== 'string') return false;
    const str = String(val).trim();
    return (norm.includes('email') || norm.includes('mail')) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
  });
  return emailLike ? String(emailLike[1]).trim() : '';
}

function getAssociateNameWithFallback(row: Record<string, unknown>): string {
  const explicit = getCellValue(row, [
    'Associate Name', 'associateName', 'associate_name', 'Name', 'Employee Name', 'Full Name', 'Emp Name',
    'EMP NAME', 'EMP.NAME', 'Associate', 'Employee', 'Staff Name', 'Candidate Name', 'NAME',
  ]);
  if (explicit !== '' && explicit != null) return String(explicit).trim();
  return '';
}

function getReportingManagerWithFallback(row: Record<string, unknown>): string {
  const explicit = getCellValue(row, ['Reporting Manager', 'reportingManager', 'reporting_manager', 'Manager', 'Report To', 'Reporting To', 'REPORTING MANAGER', 'Manager Name', 'Manager Code']);
  if (explicit !== '' && explicit != null) return String(explicit).trim();
  return '';
}

function getEsiNumber(row: Record<string, unknown>): string {
  const explicit = getCellValue(row, [
    'esiNumber', 'esi_number', 'ESIC', 'ESIC No', 'ESI Number', 'ESIC NO', 'ESIC Number', 'ESI NO', 'ESI No',
    'ESI No.', 'ESI NUMBER', 'ESI NUM', 'EMPLOYEE STATE INSURANCE NO', 'ESI',
  ]);
  if (explicit !== '' && explicit != null) return String(explicit).trim();
  const normalizedEntries = Object.entries(row).map(([k, v]) => [normalizeHeader(k), v] as const);
  const esiNumLike = normalizedEntries.find(([norm]) =>
    norm.includes('esi') && (norm.includes('number') || norm.includes('no') || norm === 'esic') &&
    !norm.includes('location') && !norm.includes('dispensary')
  );
  if (esiNumLike && esiNumLike[1] !== '' && esiNumLike[1] != null) return String(esiNumLike[1]).trim();
  return '';
}

// ─── Parsed row interface ───

interface ParsedRow {
  rowIndex: number; // 0-based index in Excel (add 2 for display: header + 1-based)
  firstName: string;
  lastName: string;
  middleName: string;
  email: string;
  personalEmail: string;
  officialEmail: string;
  phone: string;
  employeeCode: string;
  dateOfJoining: string;
  dateOfBirth: string | null;
  dateOfLeaving: string | null;
  gender: string | undefined;
  maritalStatus: string | undefined;
  employmentType: string | undefined;
  designation: string;
  department: string;
  paygroupName: string;
  entityName: string;
  costCentreName: string;
  workLocation: string;
  reportingManagerName: string;
  placeOfTaxDeduction: string | undefined;
  address: Record<string, string> | undefined;
  taxInformation: Record<string, string> | undefined;
  bankDetails: Record<string, string> | undefined;
  profileExtensions: Record<string, string> | undefined;
  emergencyContacts: Array<{ name: string; phone: string; relationship: string }> | undefined;
  fixedGross: number;
  vehicleAllowances: number;
  subDepartment: string;
  userRole: string;
}

// ─── Main service ───

export class EmployeeBulkImportService {
  /**
   * Parse Excel buffer into structured rows.
   */
  parseExcel(buffer: Buffer): ParsedRow[] {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const firstSheet = workbook.SheetNames[0];
    if (!firstSheet) throw new AppError('No sheets found in the uploaded file', 400);

    const sheet = workbook.Sheets[firstSheet];

    // Auto-detect header row: if first row looks like a title (keys contain __EMPTY),
    // find the actual header row by scanning for a row with recognizable column names.
    let rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
    const firstKeys = Object.keys(rawRows[0] || {});
    if (firstKeys.some((k) => k.startsWith('__EMPTY'))) {
      // Title row detected — scan raw data to find the actual header row
      const allRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
      let headerRowIdx = 0;
      const headerKeywords = ['name', 'email', 'department', 'gender', 'doj', 'joining', 'code', 'paygroup', 'associate'];
      for (let i = 0; i < Math.min(allRows.length, 10); i++) {
        const row = allRows[i];
        if (!Array.isArray(row)) continue;
        const cellTexts = row.map((c) => String(c || '').toLowerCase());
        const matches = cellTexts.filter((t) => headerKeywords.some((kw) => t.includes(kw)));
        if (matches.length >= 3) {
          headerRowIdx = i;
          break;
        }
      }
      // Re-parse with correct range (skip rows before actual header)
      const ref = sheet['!ref'] || 'A1';
      const range = XLSX.utils.decode_range(ref);
      range.s.r = headerRowIdx; // start from actual header row
      rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', range });
      console.log(`[parseExcel] Skipped ${headerRowIdx} title row(s). Header row: ${headerRowIdx + 1}. Data rows: ${rawRows.length}`);
    }

    if (!rawRows.length) throw new AppError('Uploaded file has no data rows', 400);

    const parsed: ParsedRow[] = [];

    for (let index = 0; index < rawRows.length; index++) {
      const row = rawRows[index];

      const associateName = getAssociateNameWithFallback(row);
      const firstNameCol = String(getCellValue(row, ['firstName', 'first_name', 'firstname', 'First Name', 'EMP.F.NAME'])).trim();
      const lastNameCol = String(getCellValue(row, ['lastName', 'last_name', 'lastname', 'Last Name', 'EMP.L.NAME'])).trim();
      let firstName = firstNameCol;
      let lastName = lastNameCol;
      if (associateName && !firstNameCol && !lastNameCol) {
        const parts = associateName.split(/\s+/).filter(Boolean);
        firstName = parts[0] || associateName;
        lastName = parts.length > 1 ? parts.slice(1).join(' ') : associateName;
      }
      const middleName = String(getCellValue(row, ['middleName', 'middle_name', 'EMP.M.NAME'])).trim();
      const officialEmail = String(getCellValue(row, ['Official/Permanent E-Mail Id', 'Official E-Mail Id', 'officialEmail', 'official_email', 'Official Email', 'email', 'E-Mail', 'Email'])).trim();
      const permanentEmail = String(getCellValue(row, ['Official/Permanent E-Mail Id', 'Permanent E-Mail Id', 'permanentEmail', 'permanent_email', 'Permanent Email'])).trim();
      const emailCol = String(getCellValue(row, ['Official/Permanent E-Mail Id', 'email', 'emailId', 'mail', 'Email ID', 'EMAIL ID', 'Email', 'E-Mail Id', 'E-Mail', 'Mail', 'Official E-Mail', 'Mail Id', 'Email Address'])).trim();
      let email = emailCol || officialEmail || permanentEmail || getEmailWithFallback(row);
      if (!email) {
        const emailLike = Object.values(row).find((v) => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim()));
        if (emailLike) email = String(emailLike).trim();
      }

      const fatherName = String(getCellValue(row, ['fatherName', 'father_name', 'Father Name', 'FATHER NAME'])).trim();
      if ((!firstName || !lastName) && email && /^[^\s@]+@[^\s@]+/.test(email)) {
        const localPart = email.split('@')[0] || '';
        const nameParts = localPart.replace(/[._]/g, ' ').split(/\s+/).filter(Boolean);
        if (!firstName && nameParts.length) firstName = nameParts[0];
        if (!lastName && nameParts.length) lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : nameParts[0] || localPart;
      }
      if (!lastName && fatherName) lastName = fatherName;

      const personalEmailRaw = String(getCellValue(row, ['personalEmail', 'personal_email', 'Permanent E-Mail Id'])).trim()
        || (permanentEmail && permanentEmail !== email ? permanentEmail : '');
      const personalEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personalEmailRaw) ? personalEmailRaw : '';

      const employeeCode = String(getCellValue(row, ['Associate Code', 'employeeCode', 'employee_code', 'empCode', 'empcode', 'empId', 'emp id', 'Emp ID', 'EMP.CODE'])).trim();
      const dateOfJoining = toDateOnly(getCellValue(row, ['dateOfJoining', 'date_of_joining', 'joiningDate', 'doj', 'Date of Joining', 'DOJ', 'Joining Date', 'Appointment Date', 'Date of Appointment', 'DOJ (Date of Joining)']));
      const phone = String(getCellValue(row, ['phone', 'mobile', 'mobileNumber', 'mobile_number', 'phone_number', 'Mobile No', 'Permanent mobile', 'Permanent Phone', 'Current Phone', 'EMRG.CONTACT NO.'])).trim();
      const designation = String(getCellValue(row, [
        'designation', 'Designation', 'DESIGNATION', 'position', 'Position', 'POSITION',
        'Job Title', 'jobTitle', 'job_title', 'Job Position', 'jobPosition', 'job_position',
        'Title', 'title', 'Post', 'post', 'Grade', 'grade', 'GRADE',
      ])).trim();
      const department = String(getCellValue(row, [
        'department', 'departmentName', 'dept', 'Department', 'DEPARTMENT', 'Dept', 'DEPT', 'Dept Name', 'Department Name',
      ])).trim();
      const paygroupName = String(getCellValue(row, ['Paygroup', 'paygroup', 'payGroup', 'PAY GROUP'])).trim();
      const gender = mapGender(String(getCellValue(row, ['gender', 'Gender', 'GENDER'])));
      const maritalStatus = mapMaritalStatus(String(getCellValue(row, ['maritalStatus', 'marital_status', 'Marital Status', 'MARITIAL STATUS'])));
      const dateOfLeaving = toDateOnly(getCellValue(row, ['dateOfLeaving', 'date_of_leaving', 'dol', 'RELIEVING DATE']));
      const dateOfBirth = toDateOnly(getCellValue(row, ['dateOfBirth', 'date_of_birth', 'dob', 'Date of Birth', 'DOB']));

      const permanentAddress = String(getCellValue(row, ['permanentAddress', 'permanent_address', 'Permanent Address', 'Address - Permanent', 'PARMANENT ADDRESS'])).trim();
      const presentAddress = String(getCellValue(row, ['presentAddress', 'present_address', 'Current Address', 'Address - Current', 'COMMUNICATON ADDRESS'])).trim();
      const city = String(getCellValue(row, ['city', 'City', 'Permanent City', 'City - Permanent'])).trim();
      const cityCurrent = String(getCellValue(row, ['cityCurrent', 'City - Current', 'Current City'])).trim();
      const state = String(getCellValue(row, ['state', 'State', 'Permanent State', 'State - Permanent'])).trim();
      const stateCurrent = String(getCellValue(row, ['stateCurrent', 'State - Current', 'Current State'])).trim();
      const pincode = String(getCellValue(row, ['pincode', 'postalCode', 'postal_code', 'Permanent Pincode', 'Pincode - Permanent'])).trim();
      const pincodeCurrent = String(getCellValue(row, ['pincodeCurrent', 'Pincode - Current', 'Current Pincode'])).trim();
      const countryPermanent = String(getCellValue(row, ['countryPermanent', 'Country - Permanent'])).trim();
      const countryCurrent = String(getCellValue(row, ['countryCurrent', 'Country - Current'])).trim();
      const permanentDistrict = String(getCellValue(row, ['Permanent District', 'permanentDistrict', 'permanent_district'])).trim();
      const presentDistrict = String(getCellValue(row, ['Current District', 'presentDistrict', 'currentDistrict', 'current_district'])).trim();
      const presentPhone = String(getCellValue(row, ['Current Phone', 'presentPhone', 'present_phone'])).trim();

      const panNumber = String(getCellValue(row, ['panNumber', 'pan_number', 'PAN', 'Pan No', 'Pan No.', 'Pan Card Number', 'PANCARD NO'])).trim();
      const aadhaarNumber = String(getCellValue(row, ['aadhaarNumber', 'aadhar_number', 'aadhar', 'Aadhar', 'Aadhar No', 'Adhaar Number', 'Aadhar Number', 'AADHAR NO'])).trim();
      const uanNumber = String(getCellValue(row, ['uanNumber', 'uan_number', 'UAN', 'UAN No', 'UAN Number', 'UAN NO'])).trim();
      const pfNumber = String(getCellValue(row, ['pfNumber', 'pf_number', 'EPF', 'epfNumber', 'PF No', 'PF Number', 'PF NO'])).trim();
      const esiNumber = getEsiNumber(row);
      const esiLocation = String(getCellValue(row, ['ESI Location', 'esiLocation', 'esi_location'])).trim();
      const ptaxLocation = String(getCellValue(row, ['Ptax Location', 'ptaxLocation', 'ptax_location'])).trim();
      const taxRegimeRaw = String(getCellValue(row, ['Tax Regime', 'taxRegime', 'tax_regime'])).trim();
      const taxRegime = taxRegimeRaw ? (taxRegimeRaw.toUpperCase() === 'N' || taxRegimeRaw.toUpperCase() === 'NEW' ? 'NEW' : taxRegimeRaw.toUpperCase() === 'O' || taxRegimeRaw.toUpperCase() === 'OLD' ? 'OLD' : taxRegimeRaw) : '';

      const bankName = String(getCellValue(row, ['bankName', 'bank_name', 'Bank Name', 'BANK NAME'])).trim();
      const accountNumber = String(getCellValue(row, ['accountNumber', 'account_number', 'accountNo', 'Account No', 'Bank Account No', 'Bank A/c No.', 'ACCOUNT NO'])).trim();
      const ifscCode = String(getCellValue(row, ['ifscCode', 'ifsc_code', 'IFSC', 'Bank IFSC Code', 'IFSC CODE'])).trim();

      const age = String(getCellValue(row, ['age', 'Age'])).trim();
      const passportNumber = String(getCellValue(row, ['passportNumber', 'passport_number', 'PASSPORT NO'])).trim();
      const drivingLicenseNumber = String(getCellValue(row, ['drivingLicenseNumber', 'driving_license', 'DRIVING LICENCE NO'])).trim();
      const bloodGroup = String(getCellValue(row, ['bloodGroup', 'blood_group', 'Blood Group', 'BLOOD GROUP'])).trim();
      const experienceYears = String(getCellValue(row, ['experienceYears', 'experience', 'Experience', 'Exp - Total', 'Exp - Relevant', 'PREVIOUS EXPERIENCE'])).trim();
      const subDepartmentVal = String(getCellValue(row, [
        'subDepartment', 'sub_department', 'Sub Department', 'SubDepartment', 'SUB.DEPARTMENT', 'Sub-Department', 'Subdept',
        'SUB DEPARTMENT', 'Sub Dept', 'SUB DEPT',
      ])).trim();
      const qualification = String(getCellValue(row, ['qualification', 'Qualification', 'QUALIFICATION'])).trim();
      const course = String(getCellValue(row, ['course', 'Course'])).trim();
      const university = String(getCellValue(row, ['university', 'University', 'INSTITUTE'])).trim();
      const passoutYear = String(getCellValue(row, ['passoutYear', 'passout_year', 'Passout Year', 'YEAR OF PASSING'])).trim();
      const associateNoticePeriodDays = String(getCellValue(row, ['Associate Notice Period Days', 'associateNoticePeriodDays', 'notice_period_days'])).trim();
      const lwfLocation = String(getCellValue(row, ['LWF Location', 'lwfLocation', 'lwf_location'])).trim();
      const alternateSaturdayOff = String(getCellValue(row, ['Alternate Saturday Off', 'alternateSaturdayOff', 'alternate_saturday_off'])).trim();
      const compoffApplicable = String(getCellValue(row, ['Compoff Applicable', 'compoffApplicable', 'compoff_applicable'])).trim();
      const userRoleVal = String(getCellValue(row, ['User Role', 'userRole', 'user_role', 'Role', 'ROLE'])).trim();

      const emergencyContactName = String(getCellValue(row, ['emergencyContactName', 'emergency_contact_name', 'Emergency Contact Name', 'EMRG.CONTACT NAME'])).trim();
      const emergencyContactNo = String(getCellValue(row, ['emergencyContactNo', 'emergency_contact_no', 'Emergency Contact No', 'EMRG.CONTACT NO.'])).trim();
      const relationship = String(getCellValue(row, ['relationship', 'Relationship', 'RELATION'])).trim();

      const workLocation = String(getCellValue(row, ['Location', 'location', 'workLocation'])).trim();
      const reportingManagerName = getReportingManagerWithFallback(row);
      const costCentreName = String(getCellValue(row, [
        'Cost Centre', 'Cost Center', 'costCentre', 'cost_centre', 'cost_center', 'COST CENTRE', 'COST CENTER',
        'CostCentre', 'cc', 'CC', 'Cost Centre Name', 'Cost Center Name',
      ])).trim();
      const fixedGrossStr = String(getCellValue(row, ['Fixed Gross', 'fixedGross', 'fixed_gross'])).trim();
      const vehicleAllowancesStr = String(getCellValue(row, ['Vehicle Allowances', 'vehicleAllowances', 'vehicle_allowances'])).trim();
      const entityName = String(getCellValue(row, ['entity', 'Entity', 'ENTITY', 'entityName'])).trim();

      const placeOfTaxRaw = String(getCellValue(row, ['Place of Tax Deduction', 'placeOfTaxDeduction', 'place_of_tax_deduction'])).trim().toUpperCase();
      const placeOfTaxDeduction = placeOfTaxRaw === 'M' ? 'METRO' : placeOfTaxRaw === 'N' ? 'NON_METRO' : (placeOfTaxRaw === 'METRO' || placeOfTaxRaw === 'NON_METRO' ? placeOfTaxRaw : undefined);

      const employmentTypeVal = String(getCellValue(row, ['employmentType', 'Emp Type', 'empType'])).trim().toUpperCase();
      const employmentType = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'].includes(employmentTypeVal) ? employmentTypeVal : undefined;

      // Skip fully empty rows
      if (!firstName && !lastName && !email && !dateOfJoining && !employeeCode) continue;

      // Build final values with safe defaults
      const finalFirstName = (firstName || lastName || associateName || employeeCode || `Emp${index + 1}`).trim();
      const finalLastName = (lastName || firstName || '').trim();
      const safeFirstName = finalFirstName.length >= 2 ? finalFirstName : (finalFirstName + ' ').slice(0, 2);
      const finalEmail = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ? email.trim()
        : `${(employeeCode || `imported${index + 2}`).replace(/[^a-zA-Z0-9]/g, '')}@imported.placeholder`;
      const finalDateOfJoining = dateOfJoining || new Date().toISOString().slice(0, 10);

      // Build address
      const address =
        permanentAddress || presentAddress || city || cityCurrent || state || stateCurrent || pincode || pincodeCurrent || countryPermanent || countryCurrent || permanentDistrict || presentDistrict || presentPhone
          ? {
              ...(permanentAddress ? { street: permanentAddress, permanentAddress } : {}),
              ...(presentAddress ? { presentAddress } : {}),
              ...(city ? { city } : {}),
              ...(state ? { state } : {}),
              ...(pincode ? { postalCode: pincode } : {}),
              ...(countryPermanent ? { country: countryPermanent } : {}),
              ...(cityCurrent ? { presentCity: cityCurrent } : {}),
              ...(stateCurrent ? { presentState: stateCurrent } : {}),
              ...(pincodeCurrent ? { presentPincode: pincodeCurrent } : {}),
              ...(permanentDistrict ? { permanentDistrict } : {}),
              ...(presentDistrict ? { presentDistrict } : {}),
              ...(presentPhone ? { presentPhoneNumber: presentPhone } : {}),
            }
          : undefined;

      const taxInformation =
        panNumber || aadhaarNumber || uanNumber || pfNumber || esiNumber || esiLocation || ptaxLocation || taxRegime
          ? {
              ...(panNumber ? { panNumber } : {}),
              ...(aadhaarNumber ? { aadhaarNumber } : {}),
              ...(uanNumber ? { uanNumber } : {}),
              ...(pfNumber ? { pfNumber } : {}),
              ...(esiNumber ? { esiNumber } : {}),
              ...(esiLocation ? { esiLocation } : {}),
              ...(ptaxLocation ? { ptaxLocation } : {}),
              ...(taxRegime ? { taxRegime } : {}),
            }
          : undefined;

      const bankDetails =
        bankName || accountNumber || ifscCode
          ? {
              ...(bankName ? { bankName } : {}),
              ...(accountNumber ? { accountNumber } : {}),
              ...(ifscCode ? { ifscCode } : {}),
            }
          : undefined;

      const profileExtensions =
        fatherName || age || passportNumber || drivingLicenseNumber || bloodGroup || experienceYears ||
        subDepartmentVal || qualification || course || university || passoutYear ||
        associateNoticePeriodDays || lwfLocation || alternateSaturdayOff || compoffApplicable ||
        designation
          ? {
              ...(fatherName ? { fatherName } : {}),
              ...(age ? { age } : {}),
              ...(passportNumber ? { passportNumber } : {}),
              ...(drivingLicenseNumber ? { drivingLicenseNumber } : {}),
              ...(bloodGroup ? { bloodGroup } : {}),
              ...(experienceYears ? { experienceYears } : {}),
              ...(subDepartmentVal ? { subDepartment: subDepartmentVal } : {}),
              ...(qualification ? { qualification } : {}),
              ...(course ? { course } : {}),
              ...(university ? { university } : {}),
              ...(passoutYear ? { passoutYear } : {}),
              ...(associateNoticePeriodDays ? { associateNoticePeriodDays } : {}),
              ...(lwfLocation ? { lwfLocation } : {}),
              ...(alternateSaturdayOff ? { alternateSaturdayOff } : {}),
              ...(compoffApplicable ? { compoffApplicable } : {}),
              ...(designation ? { designation } : {}),
            }
          : undefined;

      const emergencyContacts =
        emergencyContactName || emergencyContactNo || relationship
          ? [{ name: emergencyContactName || '', phone: emergencyContactNo || '', relationship: relationship || '' }]
          : undefined;

      parsed.push({
        rowIndex: index,
        firstName: safeFirstName,
        lastName: finalLastName,
        middleName,
        email: finalEmail,
        personalEmail,
        officialEmail: officialEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(officialEmail) ? officialEmail : '',
        phone,
        employeeCode,
        dateOfJoining: finalDateOfJoining,
        dateOfBirth,
        dateOfLeaving,
        gender,
        maritalStatus,
        employmentType,
        designation,
        department,
        paygroupName,
        entityName,
        costCentreName,
        workLocation,
        reportingManagerName,
        placeOfTaxDeduction,
        address,
        taxInformation,
        bankDetails,
        profileExtensions,
        emergencyContacts,
        fixedGross: parseFloat(String(fixedGrossStr).replace(/,/g, '')) || 0,
        vehicleAllowances: parseFloat(String(vehicleAllowancesStr).replace(/,/g, '')) || 0,
        subDepartment: subDepartmentVal,
        userRole: userRoleVal,
      });
    }

    return parsed;
  }

  /**
   * Main bulk import entry point.
   */
  async bulkImport(
    fileBuffer: Buffer,
    _fileName: string,
    organizationId: string,
    createdByUserId: string,
    options: { createSalaryRecords?: boolean; skipConfiguratorSync?: boolean } = {},
  ): Promise<BulkImportResult> {
    const { createSalaryRecords = false, skipConfiguratorSync = false } = options;

    // Resolve creator's Config DB user ID for created_by field
    let creatorConfigId: number | null = null;
    if (createdByUserId) {
      const creatorHrmsUser = await prisma.user.findUnique({
        where: { id: createdByUserId },
        select: { configuratorUserId: true },
      });
      creatorConfigId = creatorHrmsUser?.configuratorUserId ?? null;
    }

    // ── 1. Parse Excel ──
    const parsedRows = this.parseExcel(fileBuffer);
    if (!parsedRows.length) throw new AppError('No valid data rows found in Excel file', 400);

    // ── 2. Pre-fetch reference data ──
    const [
      orgPositions,
      orgDepartments,
      orgPaygroups,
      orgCostCentres,
      orgEntities,
      _orgSubDepartments,
      existingEmployees,
      existingUsers,
      organization,
    ] = await Promise.all([
      prisma.jobPosition.findMany({ where: { organizationId }, select: { id: true, title: true, code: true } }),
      prisma.department.findMany({ where: { organizationId }, select: { id: true, name: true, code: true, configuratorDepartmentId: true } }),
      prisma.paygroup.findMany({ where: { organizationId }, select: { id: true, name: true, code: true } }),
      prisma.costCentre.findMany({ where: { organizationId }, select: { id: true, name: true, code: true, configuratorCostCentreId: true } }),
      prisma.entity.findMany({ where: { organizationId }, select: { id: true, name: true, code: true } }),
      prisma.subDepartment.findMany({ where: { organizationId }, select: { id: true, name: true } }),
      prisma.employee.findMany({
        where: { organizationId, deletedAt: null },
        select: { id: true, employeeCode: true, email: true, firstName: true, lastName: true, configuratorUserId: true },
      }),
      prisma.user.findMany({
        where: { organizationId },
        select: { id: true, email: true },
      }),
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
          id: true, name: true,
          employeeIdPrefix: true, employeeIdNextNumber: true,
          configuratorCompanyId: true,
        },
      }),
    ]);

    if (!organization) throw new AppError('Organization not found', 404);

    // Build lookup maps (HRMS) — multiple keys per row for name/code/spacing variants
    const positionMap = new Map<string, string>();
    for (const p of orgPositions) {
      positionMap.set(p.title.toLowerCase(), p.id);
      positionMap.set(normalizeOrgLookupKey(p.title), p.id);
      if (p.code?.trim()) {
        positionMap.set(p.code.toLowerCase(), p.id);
        positionMap.set(normalizeOrgLookupKey(p.code), p.id);
        positionMap.set(looseAlphanumericKey(p.code), p.id);
      }
      positionMap.set(looseAlphanumericKey(p.title), p.id);
    }
    const departmentMap = new Map<string, string>();
    for (const d of orgDepartments) {
      departmentMap.set(d.name.toLowerCase(), d.id);
      departmentMap.set(normalizeOrgLookupKey(d.name), d.id);
      if (d.code?.trim()) {
        departmentMap.set(d.code.toLowerCase(), d.id);
        departmentMap.set(normalizeOrgLookupKey(d.code), d.id);
      }
    }
    const hrmsDepartmentIdByConfiguratorId = new Map<number, string>(
      orgDepartments.filter((d) => d.configuratorDepartmentId != null).map((d) => [d.configuratorDepartmentId!, d.id]),
    );
    const paygroupMap = new Map(orgPaygroups.map((p) => [p.name.toLowerCase(), p.id]));
    for (const p of orgPaygroups) {
      paygroupMap.set(normalizeOrgLookupKey(p.name), p.id);
    }
    const costCentreMap = new Map<string, string>();
    for (const c of orgCostCentres) {
      costCentreMap.set(c.name.toLowerCase(), c.id);
      costCentreMap.set(normalizeOrgLookupKey(c.name), c.id);
      if (c.code) {
        costCentreMap.set(c.code.toLowerCase(), c.id);
        costCentreMap.set(normalizeOrgLookupKey(c.code), c.id);
      }
    }
    const hrmsCostCentreIdByConfiguratorId = new Map<number, string>(
      orgCostCentres.filter((c) => c.configuratorCostCentreId != null).map((c) => [c.configuratorCostCentreId!, c.id]),
    );
    const entityMap = new Map<string, string>();
    for (const e of orgEntities) {
      entityMap.set(e.name.toLowerCase(), e.id);
      entityMap.set(normalizeOrgLookupKey(e.name), e.id);
      if (e.code) {
        entityMap.set(e.code.toLowerCase(), e.id);
        entityMap.set(normalizeOrgLookupKey(e.code), e.id);
      }
    }
    const existingEmailSet = new Set(existingEmployees.map((e) => e.email.toLowerCase()));
    const existingUserEmailSet = new Set(existingUsers.map((u) => u.email.toLowerCase()));

    // ── 2b. Config DB reference data (department / sub-dept / cost centre / roles)
    let configuratorEmailSet = new Set<string>();
    const configDeptLookupMap = new Map<string, number>();
    const configCostCentreLookupMap = new Map<string, number>();
    const configSubDeptRows: ConfigSubDeptRow[] = [];
    const configRoleNameToCode = new Map<string, string>();
    const configRoleNameToId = new Map<string, number>();
    const configRoleIdToRoleType = new Map<number, string>();
    const configBranchLookupMap = new Map<string, number>(); // branch name/code → branch id
    let configuratorAccessToken: string | null = null;

    try {
      if (organization.configuratorCompanyId != null) {
          configuratorAccessToken = 'direct-db';
          const companyId = organization.configuratorCompanyId;

          const [configDepts, configSubDepts, configCostCentres, configUserRoles, configUsers, configBranches] = await Promise.all([
            configOrgDataService.getDepartments(companyId),
            configOrgDataService.getSubDepartments(companyId),
            configOrgDataService.getCostCentres(companyId),
            configAuthService.getUserRoles(companyId),
            configUsersService.getUsers(companyId),
            configPrisma.branches.findMany({
              where: { company_id: companyId, status: 'active', is_deleted: false },
              select: { id: true, branch_name: true, code: true },
            }),
          ]);

          for (const d of configDepts) {
            if (d.id) registerConfigLookupKeys(configDeptLookupMap, d.id, d.name, d.code);
          }

          for (const s of configSubDepts) {
            if (s.id) {
              configSubDeptRows.push({
                id: s.id,
                name: s.name || '',
                code: s.code ?? null,
                department_id: s.department_id ?? null,
              });
            }
          }

          for (const c of configCostCentres) {
            if (c.id) registerConfigLookupKeys(configCostCentreLookupMap, c.id, c.name, c.code);
          }

          for (const r of configUserRoles) {
            if (r.name && r.code) configRoleNameToCode.set(r.name.toLowerCase(), r.code);
            if (r.name && r.id) {
              registerConfigLookupKeys(configRoleNameToId, r.id, r.name, r.code);
              configRoleNameToId.set(r.name.toLowerCase(), r.id);
              if (r.code) configRoleNameToId.set(String(r.code).toLowerCase(), r.id);
            }
            if (r.id && r.role_type) configRoleIdToRoleType.set(r.id, r.role_type);
          }

          for (const u of configUsers) {
            if (u.email) configuratorEmailSet.add(u.email.toLowerCase());
            const pr = u.project_role;
            if (pr?.id && pr?.name) {
              const key = pr.name.toLowerCase();
              if (!configRoleNameToId.has(key)) configRoleNameToId.set(key, pr.id);
            }
          }

          for (const b of configBranches) {
            const bid = Number(b.id);
            if (b.branch_name) {
              configBranchLookupMap.set(b.branch_name.toLowerCase().trim(), bid);
              configBranchLookupMap.set(normalizeOrgLookupKey(b.branch_name), bid);
              configBranchLookupMap.set(looseAlphanumericKey(b.branch_name), bid);
            }
            if (b.code) {
              configBranchLookupMap.set(b.code.toLowerCase().trim(), bid);
              configBranchLookupMap.set(looseAlphanumericKey(b.code), bid);
            }
          }

          console.log(
            `[BulkImport] Config DB: ${configDeptLookupMap.size} dept keys, ${configSubDeptRows.length} sub-depts, ${configCostCentreLookupMap.size} cc keys, ${configRoleNameToId.size} role keys, ${configBranchLookupMap.size} branch keys, ${configuratorEmailSet.size} existing users`,
          );
      }
    } catch (err: any) {
      console.warn('[BulkImport] Failed to fetch Configurator reference data:', err?.message);
    }

    // ── 2c. Validate rows before DB writes ──
    // Order: HRMS DB validations first → Configurator API validations second
    // All-or-nothing: if any row fails, the entire upload stops
    const validationErrors: string[] = [];

    const defaultConfiguratorRoleId = pickDefaultConfiguratorRoleId(configRoleNameToId);

    for (const row of parsedRows) {
      const rowNum = row.rowIndex + 2;

      // Only validate email format — duplicates are allowed (will be updated)
      if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
        validationErrors.push(`Row ${rowNum}: Invalid email format "${row.email}"`);
      }
    }

    // Batch-level: duplicate emails within the uploaded file
    const batchEmails = new Map<string, number>();
    for (const row of parsedRows) {
      const email = row.email.toLowerCase();
      if (batchEmails.has(email)) {
        validationErrors.push(`Row ${row.rowIndex + 2}: Duplicate email "${row.email}" (same as row ${batchEmails.get(email)})`);
      } else {
        batchEmails.set(email, row.rowIndex + 2);
      }
    }

    if (!skipConfiguratorSync && organization.configuratorCompanyId != null && configuratorAccessToken) {
      for (const row of parsedRows) {
        const hasExplicitRole = Boolean(row.userRole?.trim());
        let rid = resolveConfiguratorRoleIdFromExcelValue(row.userRole, configRoleNameToId);
        if (!rid && config.configuratorRoleIds && hasExplicitRole) {
          const roleLower = row.userRole!.trim().toLowerCase();
          const roleNormalized = roleLower.replace(/[\s-]+/g, '_');
          for (const [envKey, envId] of Object.entries(config.configuratorRoleIds)) {
            if (envKey.toLowerCase() === roleNormalized || envKey.toLowerCase() === roleLower) {
              rid = envId;
              break;
            }
          }
        }
        if (!rid && !hasExplicitRole) rid = defaultConfiguratorRoleId;
        if (!rid) {
          validationErrors.push(
            hasExplicitRole
              ? `Row ${row.rowIndex + 2}: User Role "${row.userRole}" does not exist in Config DB`
              : `Row ${row.rowIndex + 2}: Could not resolve Config user role — set Role in Excel or CONFIGURATOR_ROLE_IDS (e.g. EMPLOYEE).`,
          );
        }
      }
    }

    // If any validation errors, stop the entire upload (all-or-nothing)
    if (validationErrors.length > 0) {
      throw new AppError(
        `Validation failed for ${validationErrors.length} issue(s). Upload stopped — no data was imported.`,
        400,
        validationErrors,
      );
    }

    // ── 2d. Resolve Configurator role IDs per row (for User.configuratorRoleId storage)
    const rowConfigRoleIdMap = new Map<string, number>();
    for (const row of parsedRows) {
      const hasExplicitRole = Boolean(row.userRole?.trim());
      let roleId = resolveConfiguratorRoleIdFromExcelValue(row.userRole, configRoleNameToId);
      if (!roleId && config.configuratorRoleIds && hasExplicitRole) {
        const roleLower = row.userRole!.trim().toLowerCase();
        const roleNormalized = roleLower.replace(/[\s-]+/g, '_');
        for (const [envKey, envId] of Object.entries(config.configuratorRoleIds)) {
          if (envKey.toLowerCase() === roleNormalized || envKey.toLowerCase() === roleLower) {
            roleId = envId;
            break;
          }
        }
      }
      if (!roleId && !hasExplicitRole) roleId = defaultConfiguratorRoleId;
      if (roleId) rowConfigRoleIdMap.set(row.email.toLowerCase(), roleId);
    }

    // ── 3. Configurator bulk upload via /api/v1/users/upload-excel ──
    let configuratorResults: BulkImportResult['configuratorResults'] = undefined;
    let configuratorSyncStatus: 'success' | 'failed' | 'skipped' = 'skipped';
    let configuratorSyncMessage = '';
    const configuratorUserMap = new Map<string, { user_id: number; encrypted_password: string }>();

    if (skipConfiguratorSync) {
      configuratorSyncMessage = 'Configurator sync was skipped (skipConfiguratorSync=true)';
    } else if (organization.configuratorCompanyId == null) {
      configuratorSyncMessage = 'Organization has no configuratorCompanyId — Configurator sync skipped';
    } else if (!configuratorAccessToken) {
      throw new AppError('No Configurator access token available. Please logout and login again to refresh token.', 401);
    } else {
      const bulkRows = parsedRows.map((row) => {
        const deptCfgId = lookupConfiguratorId(configDeptLookupMap, row.department);
        const subCfgId = resolveConfiguratorSubDeptId(configSubDeptRows, row.subDepartment, deptCfgId ?? null);
        const ccCfgId = lookupConfiguratorId(configCostCentreLookupMap, row.costCentreName);
        const hasExplicitRole = Boolean(row.userRole?.trim());
        let roleId = resolveConfiguratorRoleIdFromExcelValue(row.userRole, configRoleNameToId);
        if (!roleId && config.configuratorRoleIds && hasExplicitRole) {
          const roleLower = row.userRole!.trim().toLowerCase();
          const roleNormalized = roleLower.replace(/[\s-]+/g, '_');
          for (const [envKey, envId] of Object.entries(config.configuratorRoleIds)) {
            if (envKey.toLowerCase() === roleNormalized || envKey.toLowerCase() === roleLower) {
              roleId = envId;
              break;
            }
          }
        }
        if (!roleId && !hasExplicitRole) roleId = defaultConfiguratorRoleId;
        const branchCfgId = row.workLocation?.trim()
          ? lookupConfiguratorId(configBranchLookupMap, row.workLocation) ?? undefined
          : undefined;
        return {
          first_name: row.firstName,
          last_name: row.lastName || 'N/A',
          email: row.email,
          phone: row.phone || '',
          password: `Temp@${Math.random().toString(36).slice(-8)}`,
          code: row.employeeCode || undefined,
          department_id: deptCfgId,
          sub_department_id: subCfgId,
          cost_centre_id: ccCfgId,
          role_id: roleId,
          branch_id: branchCfgId,
          created_by: creatorConfigId ?? undefined,
        };
      });

      const bulkDefaultRoleId = bulkRows[0]?.role_id ?? defaultConfiguratorRoleId;
      if (!bulkDefaultRoleId) {
        throw new AppError(
          'Could not determine Config user role for bulk create. Set CONFIGURATOR_ROLE_IDS or Role column.',
          400,
        );
      }
      console.log(
        '[BulkImport] Creating',
        parsedRows.length,
        'users in Config DB (companyId:',
        organization.configuratorCompanyId,
        ', defaultRoleId:',
        bulkDefaultRoleId,
        ')...',
      );
      const configResult = await configUsersService.bulkCreateUsers(
        bulkRows,
        organization.configuratorCompanyId,
        config.configuratorHrmsProjectId || 0,
        bulkDefaultRoleId,
      );

      // Log config failures but don't abort — continue with HRMS import for successful rows
      if (configResult.failed > 0) {
        const failedDetails = configResult.results
          .filter((r: any) => r.status === 'failed' || r.status === 'error')
          .map((r: any) => `Row ${r.row}: ${r.message || 'Configurator creation failed'}`)
          .slice(0, 20);
        console.warn(
          `[BulkImport] Config DB: ${configResult.failed} row(s) failed. Continuing with HRMS import for successful rows.`,
          failedDetails,
        );
      }

      // Build email → config user mapping (bulkCreateUsers returns user.id, not user_id)
      for (const r of configResult.results) {
        if (r.user?.email && r.user?.id) {
          configuratorUserMap.set(r.user.email.toLowerCase(), {
            user_id: r.user.id,
            encrypted_password: r.user.encrypted_password || '',
          });
        }
      }

      configuratorResults = {
        total: configResult.total,
        created: configResult.created,
        updated: configResult.updated,
        failed: configResult.failed,
      };

      // dept/cc/subdept IDs are already set during bulkCreateUsers — no post-upload update needed

      configuratorSyncStatus = 'success';
      configuratorSyncMessage = `Config DB sync OK: ${configResult.created} created, ${configResult.updated} updated`;
      console.log('[BulkImport] Config DB bulk create done:', configuratorSyncMessage);
    }

    // ── 4. Classify rows: new vs existing (for upsert) ──
    const toCreate: ParsedRow[] = [];
    const toUpdate: ParsedRow[] = [];
    for (const row of parsedRows) {
      if (existingEmailSet.has(row.email.toLowerCase())) {
        toUpdate.push(row);
      } else {
        toCreate.push(row);
      }
    }
    console.log(`[BulkImport] ${toCreate.length} new, ${toUpdate.length} existing (will update missing fields)`);

    // ── 5-10. Atomic HRMS upsert — via Prisma $transaction ──
    const defaultPasswordHash = await hashPassword(`Temp@${Math.random().toString(36).slice(-8)}`);

    // Helper: resolve HRMS role — priority: 1) Excel "User Role" column, 2) Config DB role, 3) designation-based
    const resolveHrmsRole = (row: ParsedRow): 'EMPLOYEE' | 'HR_MANAGER' | 'MANAGER' | 'SUPER_ADMIN' | 'ORG_ADMIN' => {
      const roleTypeMap: Record<string, string> = {
        'EMPLOYEE': 'EMPLOYEE', 'MANAGER': 'MANAGER',
        'HR_ADMIN': 'HR_MANAGER', 'HR_MANAGER': 'HR_MANAGER', 'HRADMIN': 'HR_MANAGER',
        'SUPER_ADMIN': 'SUPER_ADMIN', 'SUPERADMIN': 'SUPER_ADMIN', 'HRMS SUPERADMIN': 'SUPER_ADMIN',
        'ORG_ADMIN': 'ORG_ADMIN', 'ORGADMIN': 'ORG_ADMIN',
      };

      // 1) Excel "User Role" column — highest priority
      if (row.userRole?.trim()) {
        const excelRole = row.userRole.trim().toUpperCase().replace(/\s+/g, '_');
        const mapped = roleTypeMap[excelRole] || roleTypeMap[row.userRole.trim().toUpperCase().replace(/\s+/g, ' ')];
        if (mapped) return mapped as any;
      }

      // 2) Config DB role
      const configRoleId = rowConfigRoleIdMap.get(row.email.toLowerCase());
      if (configRoleId && configRoleIdToRoleType.has(configRoleId)) {
        const roleType = configRoleIdToRoleType.get(configRoleId)!.trim().toUpperCase().replace(/\s+/g, '_');
        const mapped = roleTypeMap[roleType];
        if (mapped) return mapped as any;
      }

      // 3) Designation-based fallback
      if (row.designation) {
        const title = row.designation.toLowerCase();
        if (title.includes('hr admin') || title.includes('hr manager') || title.includes('hr administrator') ||
            title.includes('human resources manager') || title.includes('human resource manager')) {
          return 'HR_MANAGER';
        } else if (title.includes('manager')) {
          return 'MANAGER';
        } else if (title.includes('team lead') || title.includes('team leader') || title.includes('lead')) {
          return 'MANAGER';
        }
      }

      return 'EMPLOYEE';
    };

    // Helper: resolve all reference IDs for a parsed row
    const resolveRowIds = async (row: ParsedRow, tx: any) => {
      // Designation → positionId: lookup or auto-create in HRMS JobPosition
      const des = row.designation?.trim();
      let positionId: string | null = null;
      if (des) {
        positionId = positionMap.get(des.toLowerCase())
          ?? positionMap.get(normalizeOrgLookupKey(des))
          ?? positionMap.get(looseAlphanumericKey(des))
          ?? null;
        // Auto-create designation (JobPosition) if not found
        if (!positionId) {
          try {
            const baseCode = des.replace(/\s+/g, '_').toUpperCase().slice(0, 45);
            // Try create; if code already taken (global unique), append org prefix and retry
            let newPosition: any;
            try {
              newPosition = await tx.jobPosition.create({
                data: { organizationId, title: des, code: baseCode, isActive: true },
              });
            } catch (codeErr: any) {
              // Unique constraint on code — try with org-scoped code
              const orgPrefix = organizationId.slice(0, 6).toUpperCase();
              const scopedCode = `${baseCode}_${orgPrefix}`.slice(0, 50);
              // Check if one already exists for this org with same title
              const existing = await tx.jobPosition.findFirst({
                where: { organizationId, title: { equals: des, mode: 'insensitive' } },
                select: { id: true },
              });
              if (existing) {
                newPosition = existing;
              } else {
                newPosition = await tx.jobPosition.create({
                  data: { organizationId, title: des, code: scopedCode, isActive: true },
                });
              }
            }
            const newId = newPosition.id as string;
            positionId = newId;
            positionMap.set(des.toLowerCase(), newId);
            positionMap.set(normalizeOrgLookupKey(des), newId);
            positionMap.set(looseAlphanumericKey(des), newId);
            console.log(`[BulkImport] Auto-created designation "${des}" → ${newId}`);
          } catch (err: any) {
            console.error(`[BulkImport] Failed to auto-create designation "${des}":`, err.message);
            // Continue without positionId — don't break the import
          }
        }
      }

      const deptCfgIdForRow = row.department?.trim()
        ? lookupConfiguratorId(configDeptLookupMap, row.department) ?? null
        : null;
      let departmentId: string | null = null;
      if (deptCfgIdForRow != null) {
        departmentId = hrmsDepartmentIdByConfiguratorId.get(deptCfgIdForRow) ?? null;
      }
      if (!departmentId && row.department?.trim()) {
        departmentId = departmentMap.get(normalizeOrgLookupKey(row.department))
          ?? departmentMap.get(row.department.toLowerCase()) ?? null;
      }

      const paygroupId = row.paygroupName?.trim()
        ? paygroupMap.get(row.paygroupName.toLowerCase())
          ?? paygroupMap.get(normalizeOrgLookupKey(row.paygroupName)) ?? null
        : null;

      const ccCfgIdForRow = row.costCentreName?.trim()
        ? lookupConfiguratorId(configCostCentreLookupMap, row.costCentreName) ?? null
        : null;
      let costCentreId: string | null = null;
      if (ccCfgIdForRow != null) {
        costCentreId = hrmsCostCentreIdByConfiguratorId.get(ccCfgIdForRow) ?? null;
      }
      if (!costCentreId && row.costCentreName?.trim()) {
        costCentreId = costCentreMap.get(normalizeOrgLookupKey(row.costCentreName))
          ?? costCentreMap.get(row.costCentreName.toLowerCase()) ?? null;
      }

      const entityId = row.entityName?.trim()
        ? entityMap.get(row.entityName.toLowerCase())
          ?? entityMap.get(normalizeOrgLookupKey(row.entityName)) ?? null
        : null;

      const deptConfigId = deptCfgIdForRow;
      const ccConfigId = ccCfgIdForRow;
      const subDeptConfigId = row.subDepartment?.trim()
        ? resolveConfiguratorSubDeptId(configSubDeptRows, row.subDepartment, deptCfgIdForRow) ?? null
        : null;

      // Branch/location → branchConfiguratorId from config DB
      const branchConfigId = row.workLocation?.trim()
        ? lookupConfiguratorId(configBranchLookupMap, row.workLocation) ?? null
        : null;

      return { positionId, departmentId, paygroupId, costCentreId, entityId, deptConfigId, ccConfigId, subDeptConfigId, branchConfigId };
    };

    const txResult = await prisma.$transaction(async (tx) => {
      // ── 5. Batch reserve employee codes (only for new rows) ──
      const needCodeCount = toCreate.filter((r) => !r.employeeCode).length;
      let generatedCodes: string[] = [];

      if (needCodeCount > 0) {
        generatedCodes = await this.batchReserveEmployeeCodes(organizationId, needCodeCount, organization, tx);
      }

      let codeIdx = 0;
      for (const row of toCreate) {
        if (!row.employeeCode && codeIdx < generatedCodes.length) {
          row.employeeCode = generatedCodes[codeIdx++];
        }
      }

      // ── 6. Batch create HRMS Users (only for new employees) ──
      const userIdByEmail = new Map<string, string>();
      for (const u of existingUsers) {
        userIdByEmail.set(u.email.toLowerCase(), u.id);
      }

      const newUserEmails = toCreate.filter((r) => !existingUserEmailSet.has(r.email.toLowerCase()));

      if (newUserEmails.length > 0) {
        const userCreateData: Prisma.UserCreateManyInput[] = newUserEmails.map((row) => {
          const configUser = configuratorUserMap.get(row.email.toLowerCase());
          const passwordHash = configUser?.encrypted_password || defaultPasswordHash;
          const role = resolveHrmsRole(row);
          const configRoleId = rowConfigRoleIdMap.get(row.email.toLowerCase());
          return {
            email: row.email,
            passwordHash,
            role,
            organizationId,
            isActive: true,
            isEmailVerified: false,
            ...(configUser?.user_id != null ? { configuratorUserId: configUser.user_id } : {}),
            ...(configRoleId != null ? { configuratorRoleId: configRoleId } : {}),
            ...(organization.configuratorCompanyId != null ? { configuratorCompanyId: organization.configuratorCompanyId } : {}),
          };
        });

        await tx.user.createMany({
          data: userCreateData,
          skipDuplicates: true,
        });

        const createdUsers = await tx.user.findMany({
          where: {
            email: { in: newUserEmails.map((r) => r.email) },
            organizationId,
          },
          select: { id: true, email: true },
        });
        for (const u of createdUsers) {
          userIdByEmail.set(u.email.toLowerCase(), u.id);
        }
      }

      // ── 7. Create new Employees ──
      const employeeCreateData: Prisma.EmployeeCreateManyInput[] = [];
      const txFailures: BulkImportRowResult[] = [];

      for (const row of toCreate) {
        const userId = userIdByEmail.get(row.email.toLowerCase());
        if (!userId) {
          txFailures.push({
            row: row.rowIndex + 2,
            email: row.email,
            associateCode: row.employeeCode || undefined,
            status: 'failed',
            message: 'Failed to create/find user account for this email',
          });
          continue;
        }

        const ids = await resolveRowIds(row, tx);
        const configUser = configuratorUserMap.get(row.email.toLowerCase());

        employeeCreateData.push({
          organizationId,
          employeeCode: row.employeeCode || `EMP${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          userId,
          firstName: row.firstName,
          lastName: row.lastName || 'N/A',
          ...(row.middleName ? { middleName: row.middleName } : {}),
          email: row.email,
          ...(row.personalEmail ? { personalEmail: row.personalEmail } : {}),
          ...(row.officialEmail ? { officialEmail: row.officialEmail } : {}),
          ...(row.phone ? { phone: row.phone } : {}),
          dateOfJoining: new Date(row.dateOfJoining),
          ...(row.dateOfBirth ? { dateOfBirth: new Date(row.dateOfBirth) } : {}),
          ...(row.dateOfLeaving ? { dateOfLeaving: new Date(row.dateOfLeaving) } : {}),
          ...(row.gender ? { gender: row.gender as any } : {}),
          ...(row.maritalStatus ? { maritalStatus: row.maritalStatus as any } : {}),
          ...(row.employmentType ? { employmentType: row.employmentType as any } : {}),
          ...(ids.positionId ? { positionId: ids.positionId } : {}),
          ...(ids.departmentId ? { departmentId: ids.departmentId } : {}),
          ...(ids.paygroupId ? { paygroupId: ids.paygroupId } : {}),
          ...(ids.costCentreId ? { costCentreId: ids.costCentreId } : {}),
          ...(ids.entityId ? { entityId: ids.entityId } : {}),
          ...(ids.deptConfigId != null && ids.deptConfigId > 0 ? { departmentConfiguratorId: ids.deptConfigId } : {}),
          ...(ids.ccConfigId != null && ids.ccConfigId > 0 ? { costCentreConfiguratorId: ids.ccConfigId } : {}),
          ...(ids.subDeptConfigId != null && ids.subDeptConfigId > 0 ? { subDepartmentConfiguratorId: ids.subDeptConfigId } : {}),
          ...(ids.branchConfigId != null && ids.branchConfigId > 0 ? { branchConfiguratorId: ids.branchConfigId } : {}),
          ...(row.workLocation ? { workLocation: row.workLocation } : {}),
          ...(row.placeOfTaxDeduction ? { placeOfTaxDeduction: row.placeOfTaxDeduction as any } : {}),
          ...(row.address ? { address: row.address as any } : {}),
          ...(row.taxInformation ? { taxInformation: row.taxInformation as any } : {}),
          ...(row.bankDetails ? { bankDetails: row.bankDetails as any } : {}),
          ...(row.profileExtensions ? { profileExtensions: row.profileExtensions as any } : {}),
          ...(row.emergencyContacts ? { emergencyContacts: row.emergencyContacts as any } : {}),
          ...(configUser?.user_id != null ? { configuratorUserId: configUser.user_id } : {}),
          ...(organization.configuratorCompanyId != null ? { configuratorCompanyId: organization.configuratorCompanyId } : {}),
          employeeStatus: 'ACTIVE',
        });
      }

      let success = 0;
      if (employeeCreateData.length > 0) {
        const result = await tx.employee.createMany({
          data: employeeCreateData,
          skipDuplicates: true,
        });
        success = result.count;
      }

      // ── 7b. Update existing employees (re-upload: fill missing fields + update role) ──
      let updated = 0;
      for (const row of toUpdate) {
        try {
          const existingEmp = existingEmployees.find((e) => e.email.toLowerCase() === row.email.toLowerCase());
          if (!existingEmp) continue;

          const ids = await resolveRowIds(row, tx);
          const role = resolveHrmsRole(row);
          const configUser = configuratorUserMap.get(row.email.toLowerCase());

          // Build update data: only fill fields that are currently missing on the existing employee
          // We fetch the full employee to check what's missing
          const fullEmp = await tx.employee.findUnique({
            where: { id: existingEmp.id },
            select: {
              positionId: true, departmentId: true, paygroupId: true, costCentreId: true, entityId: true,
              departmentConfiguratorId: true, costCentreConfiguratorId: true, subDepartmentConfiguratorId: true,
              branchConfiguratorId: true, workLocation: true, phone: true, dateOfBirth: true, gender: true,
              maritalStatus: true, personalEmail: true, officialEmail: true, placeOfTaxDeduction: true,
              address: true, taxInformation: true, bankDetails: true, profileExtensions: true, emergencyContacts: true,
              reportingManagerId: true, configuratorUserId: true,
            },
          });
          if (!fullEmp) continue;

          const updateData: any = {};

          // Fill missing fields from Excel data
          if (!fullEmp.positionId && ids.positionId) updateData.positionId = ids.positionId;
          if (!fullEmp.departmentId && ids.departmentId) updateData.departmentId = ids.departmentId;
          if (!fullEmp.paygroupId && ids.paygroupId) updateData.paygroupId = ids.paygroupId;
          if (!fullEmp.costCentreId && ids.costCentreId) updateData.costCentreId = ids.costCentreId;
          if (!fullEmp.entityId && ids.entityId) updateData.entityId = ids.entityId;
          if (!fullEmp.departmentConfiguratorId && ids.deptConfigId) updateData.departmentConfiguratorId = ids.deptConfigId;
          if (!fullEmp.costCentreConfiguratorId && ids.ccConfigId) updateData.costCentreConfiguratorId = ids.ccConfigId;
          if (!fullEmp.subDepartmentConfiguratorId && ids.subDeptConfigId) updateData.subDepartmentConfiguratorId = ids.subDeptConfigId;
          if (!fullEmp.branchConfiguratorId && ids.branchConfigId) updateData.branchConfiguratorId = ids.branchConfigId;
          if (!fullEmp.workLocation && row.workLocation) updateData.workLocation = row.workLocation;
          if (!fullEmp.phone && row.phone) updateData.phone = row.phone;
          if (!fullEmp.dateOfBirth && row.dateOfBirth) updateData.dateOfBirth = new Date(row.dateOfBirth);
          if (!fullEmp.gender && row.gender) updateData.gender = row.gender;
          if (!fullEmp.maritalStatus && row.maritalStatus) updateData.maritalStatus = row.maritalStatus;
          if (!fullEmp.personalEmail && row.personalEmail) updateData.personalEmail = row.personalEmail;
          if (!fullEmp.officialEmail && row.officialEmail) updateData.officialEmail = row.officialEmail;
          if (!fullEmp.placeOfTaxDeduction && row.placeOfTaxDeduction) updateData.placeOfTaxDeduction = row.placeOfTaxDeduction;
          if (!fullEmp.address && row.address) updateData.address = row.address as any;
          if (!fullEmp.taxInformation && row.taxInformation) updateData.taxInformation = row.taxInformation as any;
          if (!fullEmp.bankDetails && row.bankDetails) updateData.bankDetails = row.bankDetails as any;
          if (!fullEmp.profileExtensions && row.profileExtensions) updateData.profileExtensions = row.profileExtensions as any;
          if (!fullEmp.emergencyContacts && row.emergencyContacts) updateData.emergencyContacts = row.emergencyContacts as any;
          if (!fullEmp.configuratorUserId && configUser?.user_id) updateData.configuratorUserId = configUser.user_id;

          if (Object.keys(updateData).length > 0) {
            await tx.employee.update({ where: { id: existingEmp.id }, data: updateData });
          }

          // Update HRMS User role — always apply on re-upload (Excel role or designation-based)
          const userId = userIdByEmail.get(row.email.toLowerCase());
          if (userId) {
            await tx.user.update({ where: { id: userId }, data: { role } });
          }

          updated++;
        } catch (err: any) {
          txFailures.push({
            row: row.rowIndex + 2,
            email: row.email,
            associateCode: row.employeeCode || undefined,
            status: 'failed',
            message: `Update failed: ${err.message}`,
          });
        }
      }

      // ── 8. Reporting managers (HRMS + Config DB) ──
      let managersSet = 0;
      const allEmployees = await tx.employee.findMany({
        where: { organizationId, deletedAt: null },
        select: { id: true, employeeCode: true, firstName: true, lastName: true, email: true, configuratorUserId: true },
      });

      const resolveManagerId = (nameOrCode: string): string | null => {
        if (!nameOrCode?.trim()) return null;
        const raw = nameOrCode.trim();
        const codeFromBrackets = raw.match(/\[([^\]]+)\]/)?.[1]?.trim().toLowerCase();
        const codeFromParens = raw.match(/\(([^)]+)\)/)?.[1]?.trim().toLowerCase();
        const namePart = raw.replace(/\s*\[.*?\]\s*/g, '').replace(/\s*\(.*?\)\s*/g, '').trim().toLowerCase();
        const search = (namePart || raw.toLowerCase()).replace(/\s+/g, ' ').trim();
        const looksLikeCode = /^[a-zA-Z]*\d+[a-z0-9]*$/i.test(raw) && raw.length <= 20;
        const possibleCodes = [codeFromBrackets, codeFromParens, looksLikeCode ? raw.toLowerCase() : null].filter(Boolean);

        const byCode = allEmployees.find((e) => {
          const code = e.employeeCode?.toLowerCase()?.trim();
          return code && (code === search || possibleCodes.some((c) => c && code === c));
        });
        if (byCode) return byCode.id;

        const byName = allEmployees.find((e) => {
          const full = `${e.firstName || ''} ${e.lastName || ''}`.replace(/\s+/g, ' ').trim().toLowerCase();
          const alt = `${e.lastName || ''} ${e.firstName || ''}`.replace(/\s+/g, ' ').trim().toLowerCase();
          return full === search || alt === search || full.includes(search) || search.includes(full);
        });
        return byName?.id ?? null;
      };

      // Track config DB manager updates to do after HRMS updates
      const configManagerUpdates: Array<{ employeeConfigUserId: number; managerConfigUserId: number }> = [];

      const rowsWithManagers = parsedRows.filter((r) => r.reportingManagerName);
      for (const row of rowsWithManagers) {
        const managerId = resolveManagerId(row.reportingManagerName);
        if (!managerId) continue;

        const emp = allEmployees.find((e) =>
          (row.employeeCode && e.employeeCode?.toLowerCase() === row.employeeCode.toLowerCase()) ||
          (row.email && e.email?.toLowerCase() === row.email.toLowerCase())
        );
        if (!emp) continue;

        // Update HRMS employee reportingManagerId
        await tx.employee.update({
          where: { id: emp.id },
          data: { reportingManagerId: managerId },
        });
        managersSet++;

        // Collect config DB manager_id update: employee's config user → manager's config user
        const managerEmp = allEmployees.find((e) => e.id === managerId);
        if (emp.configuratorUserId && managerEmp?.configuratorUserId) {
          configManagerUpdates.push({
            employeeConfigUserId: emp.configuratorUserId,
            managerConfigUserId: managerEmp.configuratorUserId,
          });
        }
      }

      // ── 8b. Update Config DB users.manager_id ──
      if (configManagerUpdates.length > 0) {
        for (const update of configManagerUpdates) {
          try {
            await configPrisma.users.update({
              where: { id: update.employeeConfigUserId },
              data: { manager_id: update.managerConfigUserId },
            });
          } catch (err: any) {
            console.warn(`[BulkImport] Config DB manager_id update failed for user ${update.employeeConfigUserId}:`, err.message);
          }
        }
        console.log(`[BulkImport] Updated ${configManagerUpdates.length} config DB users with manager_id`);
      }

      // ── 9. Salary records ──
      if (createSalaryRecords) {
        const rowsWithSalary = parsedRows.filter((r) => r.fixedGross > 0 || r.vehicleAllowances > 0);

        if (rowsWithSalary.length > 0) {
          const createdEmps = await tx.employee.findMany({
            where: {
              organizationId,
              email: { in: rowsWithSalary.map((r) => r.email) },
            },
            select: { id: true, email: true, dateOfJoining: true },
          });
          const empByEmail = new Map(createdEmps.map((e) => [e.email.toLowerCase(), e]));

          for (const row of rowsWithSalary) {
            const emp = empByEmail.get(row.email.toLowerCase());
            if (!emp) continue;

            const gross = row.fixedGross + row.vehicleAllowances;
            await tx.employeeSalary.create({
              data: {
                employeeId: emp.id,
                effectiveDate: emp.dateOfJoining || new Date(row.dateOfJoining),
                basicSalary: new Prisma.Decimal(Math.round(gross * 0.4)),
                grossSalary: new Prisma.Decimal(gross),
                netSalary: new Prisma.Decimal(Math.round(gross * 0.75)),
                paymentFrequency: 'MONTHLY',
                currency: 'INR',
                components: { 'Fixed Gross': row.fixedGross, 'Vehicle Allowances': row.vehicleAllowances } as any,
              },
            });
          }
        }
      }

      return { success, updated, managersSet, failures: txFailures };
    }, {
      maxWait: 30000,
      timeout: 120000,
    });

    return {
      total: parsedRows.length,
      success: txResult.success,
      updated: txResult.updated,
      skipped: 0,
      failed: txResult.failures.length,
      managersSet: txResult.managersSet,
      failures: txResult.failures,
      configuratorResults,
      configuratorSyncStatus,
      configuratorSyncMessage,
    };
  }

  /**
   * Batch reserve N employee codes (uses provided transaction client or creates its own).
   */
  private async batchReserveEmployeeCodes(
    organizationId: string,
    count: number,
    org: { employeeIdPrefix: string | null; employeeIdNextNumber: number | null },
    tx?: any,
  ): Promise<string[]> {
    if (org.employeeIdNextNumber == null || count === 0) {
      return Array.from({ length: count }, () =>
        `EMP${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
      );
    }

    const prefix = org.employeeIdPrefix?.trim() ?? '';

    // If a transaction client was provided, use it directly (no nested $transaction)
    if (tx) {
      const row = await tx.organization.findUnique({
        where: { id: organizationId },
        select: { employeeIdNextNumber: true },
      });
      if (!row || row.employeeIdNextNumber == null) {
        return Array.from({ length: count }, () =>
          `EMP${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
        );
      }

      const startNum = row.employeeIdNextNumber;
      await tx.organization.update({
        where: { id: organizationId },
        data: { employeeIdNextNumber: startNum + count },
      });

      const codes: string[] = [];
      for (let i = 0; i < count; i++) {
        const code = prefix === '' ? String(startNum + i) : `${prefix}${startNum + i}`;
        codes.push(code);
      }
      return codes;
    }

    // Fallback: standalone transaction when no tx provided
    return prisma.$transaction(async (innerTx) => {
      const row = await innerTx.organization.findUnique({
        where: { id: organizationId },
        select: { employeeIdNextNumber: true },
      });
      if (!row || row.employeeIdNextNumber == null) {
        return Array.from({ length: count }, () =>
          `EMP${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
        );
      }

      const startNum = row.employeeIdNextNumber;
      await innerTx.organization.update({
        where: { id: organizationId },
        data: { employeeIdNextNumber: startNum + count },
      });

      const codes: string[] = [];
      for (let i = 0; i < count; i++) {
        const code = prefix === '' ? String(startNum + i) : `${prefix}${startNum + i}`;
        codes.push(code);
      }
      return codes;
    });
  }
}

export const employeeBulkImportService = new EmployeeBulkImportService();
