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
import { hashPassword } from '../utils/password';
import { configuratorService } from './configurator.service';
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

    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[firstSheet], { defval: '' });
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
      const designation = String(getCellValue(row, ['designation', 'Designation', 'position'])).trim();
      const department = String(getCellValue(row, ['department', 'departmentName', 'dept', 'Department', 'DEPARTMENT'])).trim();
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
      const subDepartmentVal = String(getCellValue(row, ['subDepartment', 'sub_department', 'Sub Department', 'SubDepartment', 'SUB.DEPARTMENT'])).trim();
      const qualification = String(getCellValue(row, ['qualification', 'Qualification', 'QUALIFICATION'])).trim();
      const course = String(getCellValue(row, ['course', 'Course'])).trim();
      const university = String(getCellValue(row, ['university', 'University', 'INSTITUTE'])).trim();
      const passoutYear = String(getCellValue(row, ['passoutYear', 'passout_year', 'Passout Year', 'YEAR OF PASSING'])).trim();
      const associateNoticePeriodDays = String(getCellValue(row, ['Associate Notice Period Days', 'associateNoticePeriodDays', 'notice_period_days'])).trim();
      const lwfLocation = String(getCellValue(row, ['LWF Location', 'lwfLocation', 'lwf_location'])).trim();
      const alternateSaturdayOff = String(getCellValue(row, ['Alternate Saturday Off', 'alternateSaturdayOff', 'alternate_saturday_off'])).trim();
      const compoffApplicable = String(getCellValue(row, ['Compoff Applicable', 'compoffApplicable', 'compoff_applicable'])).trim();

      const emergencyContactName = String(getCellValue(row, ['emergencyContactName', 'emergency_contact_name', 'Emergency Contact Name', 'EMRG.CONTACT NAME'])).trim();
      const emergencyContactNo = String(getCellValue(row, ['emergencyContactNo', 'emergency_contact_no', 'Emergency Contact No', 'EMRG.CONTACT NO.'])).trim();
      const relationship = String(getCellValue(row, ['relationship', 'Relationship', 'RELATION'])).trim();

      const workLocation = String(getCellValue(row, ['Location', 'location', 'workLocation'])).trim();
      const reportingManagerName = getReportingManagerWithFallback(row);
      const costCentreName = String(getCellValue(row, ['Cost Centre', 'costCentre', 'cost_centre', 'cost_center'])).trim();
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
        associateNoticePeriodDays || lwfLocation || alternateSaturdayOff || compoffApplicable
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
      });
    }

    return parsed;
  }

  /**
   * Main bulk import entry point.
   */
  async bulkImport(
    fileBuffer: Buffer,
    fileName: string,
    organizationId: string,
    createdByUserId: string,
    options: { createSalaryRecords?: boolean; skipConfiguratorSync?: boolean } = {},
  ): Promise<BulkImportResult> {
    const { createSalaryRecords = false, skipConfiguratorSync = false } = options;

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
      existingEmployees,
      existingUsers,
      organization,
    ] = await Promise.all([
      prisma.jobPosition.findMany({ where: { organizationId }, select: { id: true, title: true } }),
      prisma.department.findMany({ where: { organizationId }, select: { id: true, name: true, code: true, configuratorDepartmentId: true } }),
      prisma.paygroup.findMany({ where: { organizationId }, select: { id: true, name: true, code: true } }),
      prisma.costCentre.findMany({ where: { organizationId }, select: { id: true, name: true, code: true, configuratorCostCentreId: true } }),
      prisma.entity.findMany({ where: { organizationId }, select: { id: true, name: true, code: true } }),
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

    // Build lookup maps
    const positionMap = new Map(orgPositions.map((p) => [p.title.toLowerCase(), p.id]));
    const departmentMap = new Map(orgDepartments.map((d) => [d.name.toLowerCase(), d.id]));
    const paygroupMap = new Map(orgPaygroups.map((p) => [p.name.toLowerCase(), p.id]));
    const costCentreMap = new Map<string, string>();
    for (const c of orgCostCentres) {
      costCentreMap.set(c.name.toLowerCase(), c.id);
      if (c.code) costCentreMap.set(c.code.toLowerCase(), c.id);
    }
    const entityMap = new Map<string, string>();
    for (const e of orgEntities) {
      entityMap.set(e.name.toLowerCase(), e.id);
      if (e.code) entityMap.set(e.code.toLowerCase(), e.id);
    }
    const existingEmailSet = new Set(existingEmployees.map((e) => e.email.toLowerCase()));
    const existingCodeMap = new Map(existingEmployees.map((e) => [e.employeeCode.toLowerCase(), e]));
    const existingUserEmailSet = new Set(existingUsers.map((u) => u.email.toLowerCase()));

    // ── 3. Configurator bulk upload (if org has Config link and not skipped) ──
    let configuratorResults: BulkImportResult['configuratorResults'] = undefined;
    const configuratorUserMap = new Map<string, { user_id: number; encrypted_password: string }>();

    if (!skipConfiguratorSync && organization.configuratorCompanyId != null) {
      const tokenUser = await prisma.user.findUnique({
        where: { id: createdByUserId },
        select: { configuratorAccessToken: true },
      });

      if (tokenUser?.configuratorAccessToken) {
        try {
          const configResult = await configuratorService.uploadExcel(
            tokenUser.configuratorAccessToken,
            fileBuffer,
            fileName,
            organization.configuratorCompanyId,
            config.configuratorHrmsProjectId || 0,
            0, // role_id — Configurator assigns based on Excel content
          );
          configuratorResults = {
            total: configResult.total,
            created: configResult.created,
            updated: configResult.updated,
            failed: configResult.failed,
          };
          // Build email → config user mapping
          for (const r of configResult.results) {
            if (r.user?.email && r.user?.user_id) {
              configuratorUserMap.set(r.user.email.toLowerCase(), {
                user_id: r.user.user_id,
                encrypted_password: r.user.encrypted_password || '',
              });
            }
          }
        } catch (err: any) {
          console.warn('[BulkImport] Configurator upload-excel failed:', err?.message);
          // Continue — create HRMS records without configuratorUserId
        }
      } else {
        console.warn('[BulkImport] No configuratorAccessToken for user', createdByUserId);
      }
    }

    // ── 4. Classify rows: toCreate, toUpdate, toSkip ──
    const toCreate: ParsedRow[] = [];
    const toUpdate: Array<{ row: ParsedRow; existingId: string }> = [];
    const failures: BulkImportRowResult[] = [];
    let skipped = 0;
    const batchEmailSet = new Set<string>(); // track intra-batch duplicates

    for (const row of parsedRows) {
      // Check existing by code (update)
      if (row.employeeCode) {
        const existing = existingCodeMap.get(row.employeeCode.toLowerCase());
        if (existing) {
          toUpdate.push({ row, existingId: existing.id });
          continue;
        }
      }

      // Check existing by email (skip)
      if (existingEmailSet.has(row.email.toLowerCase())) {
        skipped++;
        continue;
      }

      // Check intra-batch duplicate email
      if (batchEmailSet.has(row.email.toLowerCase())) {
        failures.push({
          row: row.rowIndex + 2,
          email: row.email,
          associateCode: row.employeeCode || undefined,
          status: 'failed',
          message: 'Duplicate email within this import batch',
        });
        continue;
      }

      // Check existing user email (without employee)
      // We'll handle linking later during creation
      batchEmailSet.add(row.email.toLowerCase());
      toCreate.push(row);
    }

    // ── 5. Batch reserve employee codes ──
    const needCodeCount = toCreate.filter((r) => !r.employeeCode).length;
    let generatedCodes: string[] = [];

    if (needCodeCount > 0) {
      generatedCodes = await this.batchReserveEmployeeCodes(organizationId, needCodeCount, organization);
    }

    // Assign codes to rows that need them
    let codeIdx = 0;
    for (const row of toCreate) {
      if (!row.employeeCode && codeIdx < generatedCodes.length) {
        row.employeeCode = generatedCodes[codeIdx++];
      }
    }

    // ── 6. Batch create HRMS Users ──
    // Generate a default password hash for all new users
    const defaultPasswordHash = await hashPassword(`Temp@${Math.random().toString(36).slice(-8)}`);
    let success = 0;
    let updated = 0;

    // Create users one at a time (can't use createMany because we need to handle existing users
    // and get back individual user IDs for linking to employees)
    const userIdByEmail = new Map<string, string>();

    // First, map existing users
    for (const u of existingUsers) {
      userIdByEmail.set(u.email.toLowerCase(), u.id);
    }

    // Create new users for emails that don't exist yet
    const newUserEmails = toCreate.filter((r) => !existingUserEmailSet.has(r.email.toLowerCase()));

    if (newUserEmails.length > 0) {
      const userCreateData: Prisma.UserCreateManyInput[] = newUserEmails.map((row) => {
        const configUser = configuratorUserMap.get(row.email.toLowerCase());
        const passwordHash = configUser?.encrypted_password || defaultPasswordHash;

        // Determine role from position
        let role: 'EMPLOYEE' | 'HR_MANAGER' | 'MANAGER' = 'EMPLOYEE';
        if (row.designation) {
          const title = row.designation.toLowerCase();
          if (title.includes('hr admin') || title.includes('hr manager') || title.includes('hr administrator') ||
              title.includes('human resources manager') || title.includes('human resource manager')) {
            role = 'HR_MANAGER';
          } else if (title.includes('manager') && !title.includes('hr')) {
            role = 'MANAGER';
          } else if (title.includes('team lead') || title.includes('team leader') || title.includes('lead')) {
            role = 'MANAGER';
          }
        }

        return {
          email: row.email,
          passwordHash,
          role,
          organizationId,
          isActive: true,
          isEmailVerified: false,
          ...(configUser?.user_id != null ? { configuratorUserId: configUser.user_id } : {}),
        };
      });

      try {
        await prisma.user.createMany({
          data: userCreateData,
          skipDuplicates: true,
        });
      } catch (err: any) {
        console.warn('[BulkImport] User createMany partial error:', err?.message);
      }

      // Fetch back created users to get their IDs
      const createdUsers = await prisma.user.findMany({
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

    // ── 7. Batch create Employees ──
    const employeeCreateData: Prisma.EmployeeCreateManyInput[] = [];

    for (const row of toCreate) {
      const userId = userIdByEmail.get(row.email.toLowerCase());
      if (!userId) {
        failures.push({
          row: row.rowIndex + 2,
          email: row.email,
          associateCode: row.employeeCode || undefined,
          status: 'failed',
          message: 'Failed to create/find user account for this email',
        });
        continue;
      }

      const positionId = row.designation ? positionMap.get(row.designation.toLowerCase()) ?? null : null;
      const departmentId = row.department ? departmentMap.get(row.department.toLowerCase()) ?? null : null;
      const paygroupId = row.paygroupName ? paygroupMap.get(row.paygroupName.toLowerCase()) ?? null : null;
      const costCentreId = row.costCentreName ? costCentreMap.get(row.costCentreName.toLowerCase()) ?? null : null;
      const entityId = row.entityName ? entityMap.get(row.entityName.toLowerCase()) ?? null : null;
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
        ...(positionId ? { positionId } : {}),
        ...(departmentId ? { departmentId } : {}),
        ...(paygroupId ? { paygroupId } : {}),
        ...(costCentreId ? { costCentreId } : {}),
        ...(entityId ? { entityId } : {}),
        ...(row.workLocation ? { workLocation: row.workLocation } : {}),
        ...(row.placeOfTaxDeduction ? { placeOfTaxDeduction: row.placeOfTaxDeduction as any } : {}),
        ...(row.address ? { address: row.address as any } : {}),
        ...(row.taxInformation ? { taxInformation: row.taxInformation as any } : {}),
        ...(row.bankDetails ? { bankDetails: row.bankDetails as any } : {}),
        ...(row.profileExtensions ? { profileExtensions: row.profileExtensions as any } : {}),
        ...(row.emergencyContacts ? { emergencyContacts: row.emergencyContacts as any } : {}),
        ...(configUser?.user_id != null ? { configuratorUserId: configUser.user_id } : {}),
        employeeStatus: 'ACTIVE',
      });
    }

    if (employeeCreateData.length > 0) {
      try {
        const result = await prisma.employee.createMany({
          data: employeeCreateData,
          skipDuplicates: true,
        });
        success = result.count;

        // Track which rows failed due to skipDuplicates (email/code conflict)
        if (success < employeeCreateData.length) {
          const skippedCount = employeeCreateData.length - success;
          // We can't tell exactly which rows were skipped by createMany, so we log the difference
          console.warn(`[BulkImport] ${skippedCount} employees skipped by createMany (duplicate constraints)`);
        }
      } catch (err: any) {
        console.error('[BulkImport] Employee createMany failed:', err?.message);
        throw new AppError(`Bulk employee creation failed: ${err?.message}`, 500);
      }
    }

    // ── 8. Batch update existing employees (by code match) ──
    for (const { row, existingId } of toUpdate) {
      const positionId = row.designation ? positionMap.get(row.designation.toLowerCase()) ?? undefined : undefined;
      const departmentId = row.department ? departmentMap.get(row.department.toLowerCase()) ?? undefined : undefined;
      const paygroupId = row.paygroupName ? paygroupMap.get(row.paygroupName.toLowerCase()) ?? undefined : undefined;
      const costCentreId = row.costCentreName ? costCentreMap.get(row.costCentreName.toLowerCase()) ?? undefined : undefined;
      const entityId = row.entityName ? entityMap.get(row.entityName.toLowerCase()) ?? undefined : undefined;

      const updatePayload: Record<string, unknown> = {};
      if (positionId) updatePayload.positionId = positionId;
      if (departmentId) updatePayload.departmentId = departmentId;
      if (paygroupId) updatePayload.paygroupId = paygroupId;
      if (costCentreId) updatePayload.costCentreId = costCentreId;
      if (entityId) updatePayload.entityId = entityId;
      if (row.workLocation) updatePayload.workLocation = row.workLocation;
      if (row.placeOfTaxDeduction) updatePayload.placeOfTaxDeduction = row.placeOfTaxDeduction;
      if (row.profileExtensions && Object.keys(row.profileExtensions).length > 0) {
        updatePayload.profileExtensions = row.profileExtensions;
      }

      if (Object.keys(updatePayload).length > 0) {
        try {
          await prisma.employee.update({ where: { id: existingId }, data: updatePayload });
          updated++;
        } catch (err: any) {
          failures.push({
            row: row.rowIndex + 2,
            email: row.email,
            associateCode: row.employeeCode || undefined,
            status: 'failed',
            message: `Update failed: ${err?.message}`,
          });
        }
      } else {
        updated++;
      }
    }

    // ── 9. Second pass: reporting managers ──
    let managersSet = 0;

    // Re-fetch all employees to build complete lookup for manager resolution
    const allEmployees = await prisma.employee.findMany({
      where: { organizationId, deletedAt: null },
      select: { id: true, employeeCode: true, firstName: true, lastName: true },
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

      // By code
      const byCode = allEmployees.find((e) => {
        const code = e.employeeCode?.toLowerCase()?.trim();
        return code && (code === search || possibleCodes.some((c) => c && code === c));
      });
      if (byCode) return byCode.id;

      // By name
      const byName = allEmployees.find((e) => {
        const full = `${e.firstName || ''} ${e.lastName || ''}`.replace(/\s+/g, ' ').trim().toLowerCase();
        const alt = `${e.lastName || ''} ${e.firstName || ''}`.replace(/\s+/g, ' ').trim().toLowerCase();
        return full === search || alt === search || full.includes(search) || search.includes(full);
      });
      return byName?.id ?? null;
    };

    // Collect all rows that have reporting managers
    const rowsWithManagers = parsedRows.filter((r) => r.reportingManagerName);

    for (const row of rowsWithManagers) {
      const managerId = resolveManagerId(row.reportingManagerName);
      if (!managerId) continue;

      // Find the employee record for this row
      const emp = allEmployees.find((e) =>
        (row.employeeCode && e.employeeCode.toLowerCase() === row.employeeCode.toLowerCase()) ||
        (row.email && e.firstName?.toLowerCase() === row.firstName.toLowerCase())
      );
      if (!emp) continue;

      try {
        await prisma.employee.update({
          where: { id: emp.id },
          data: { reportingManagerId: managerId },
        });
        managersSet++;
      } catch (err: any) {
        console.warn('[BulkImport] Failed to set reporting manager:', err?.message);
      }
    }

    // ── 10. Third pass: salary records ──
    if (createSalaryRecords) {
      const rowsWithSalary = parsedRows.filter((r) => r.fixedGross > 0 || r.vehicleAllowances > 0);

      if (rowsWithSalary.length > 0) {
        // Fetch created employees to get their IDs
        const createdEmps = await prisma.employee.findMany({
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
          try {
            await prisma.employeeSalary.create({
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
          } catch (err: any) {
            console.warn('[BulkImport] Salary creation failed for', row.email, err?.message);
          }
        }
      }
    }

    return {
      total: parsedRows.length,
      success,
      updated,
      skipped,
      failed: failures.length,
      managersSet,
      failures,
      configuratorResults,
    };
  }

  /**
   * Batch reserve N employee codes in a single transaction.
   */
  private async batchReserveEmployeeCodes(
    organizationId: string,
    count: number,
    org: { employeeIdPrefix: string | null; employeeIdNextNumber: number | null },
  ): Promise<string[]> {
    if (org.employeeIdNextNumber == null || count === 0) {
      // Fallback: generate timestamp-based codes
      return Array.from({ length: count }, () =>
        `EMP${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
      );
    }

    const prefix = org.employeeIdPrefix?.trim() ?? '';

    return prisma.$transaction(async (tx) => {
      const row = await tx.organization.findUnique({
        where: { id: organizationId },
        select: { employeeIdNextNumber: true },
      });
      if (!row || row.employeeIdNextNumber == null) {
        // Fallback
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
    });
  }
}

export const employeeBulkImportService = new EmployeeBulkImportService();
