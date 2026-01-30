import { z } from 'zod';

/**
 * Validation schema for creating employee
 */
export const createEmployeeSchema = z.object({
  organizationId: z.string().uuid(),
  employeeCode: z.string().min(2).max(50).optional(),

  // Personal Information
  firstName: z.string().min(2).max(100),
  middleName: z.string().max(100).optional(),
  lastName: z.string().min(2).max(100),
  email: z.string().email().max(255),
  personalEmail: z.string().email().max(255).optional(),
  phone: z.string().max(20).optional(),
  dateOfBirth: z.string().optional(), // ISO date string
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']).optional(),
  maritalStatus: z.enum(['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED']).optional(),
  nationality: z.string().max(100).optional(),
  profilePictureUrl: z.string().url().max(500).optional(),

  // Paygroup (from Associate create flow)
  paygroupId: z.string().uuid().optional().nullable(),

  // Official contact (separate from login email/phone)
  officialEmail: z.string().email().max(255).optional().nullable(),
  officialMobile: z.string().max(20).optional().nullable(),

  // Employment Information
  departmentId: z.string().uuid().optional().nullable(),
  positionId: z.string().uuid().optional().nullable(),
  reportingManagerId: z.string().uuid().optional().nullable(),
  workLocation: z.string().max(255).optional(),
  locationId: z.string().uuid().optional().nullable(),
  costCentreId: z.string().uuid().optional().nullable(),
  grade: z.string().max(50).optional().nullable(),
  placeOfTaxDeduction: z.enum(['METRO', 'NON_METRO']).optional().nullable(),
  jobResponsibility: z.string().max(2000).optional().nullable(),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN']).optional(),
  employeeStatus: z.enum(['ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED', 'RESIGNED']).optional().default('ACTIVE'),

  // Dates
  dateOfJoining: z.string(), // ISO date string - required
  probationEndDate: z.string().optional(),
  confirmationDate: z.string().optional(),
  dateOfLeaving: z.string().optional(),
  terminationReason: z.string().max(1000).optional(),

  // Additional Information (JSON fields)
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    postalCode: z.string().optional(),
    sameAsPermanent: z.boolean().optional(),
    presentAddress: z.string().optional(),
    presentCity: z.string().optional(),
    presentDistrict: z.string().optional(),
    presentState: z.string().optional(),
    presentPincode: z.string().optional(),
    presentPhoneNumber: z.string().optional(),
  }).optional(),
  emergencyContacts: z.array(z.object({
    name: z.string(),
    relationship: z.string(),
    phone: z.string(),
    email: z.string().email().optional(),
  })).optional(),
  bankDetails: z.object({
    accountNumber: z.string().optional(),
    bankName: z.string().optional(),
    ifscCode: z.string().optional(),
    accountHolderName: z.string().optional(),
  }).optional(),
  taxInformation: z.object({
    taxId: z.string().optional(),
    panNumber: z.string().optional(),
    taxFilingStatus: z.string().optional(),
  }).optional(),
  documents: z.array(z.object({
    type: z.string(),
    name: z.string(),
    url: z.string(),
    uploadedAt: z.string(),
  })).optional(),
});

/**
 * Validation schema for updating employee
 */
export const updateEmployeeSchema = z.object({
  employeeCode: z.string().min(2).max(50).optional(),

  // Personal Information
  firstName: z.string().min(2).max(100).optional(),
  middleName: z.string().max(100).optional(),
  lastName: z.string().min(2).max(100).optional(),
  email: z.string().email().max(255).optional(),
  personalEmail: z.string().email().max(255).optional(),
  phone: z.string().max(20).optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']).optional(),
  maritalStatus: z.enum(['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED']).optional(),
  nationality: z.string().max(100).optional(),
  profilePictureUrl: z.string().url().max(500).optional(),

  // Employment Information
  paygroupId: z.string().uuid().optional().nullable(),
  officialEmail: z.string().email().max(255).optional().nullable(),
  officialMobile: z.string().max(20).optional().nullable(),

  departmentId: z.string().uuid().optional().nullable(),
  positionId: z.string().uuid().optional().nullable(),
  reportingManagerId: z.string().uuid().optional().nullable(),
  workLocation: z.string().max(255).optional(),
  locationId: z.string().uuid().optional().nullable(),
  costCentreId: z.string().uuid().optional().nullable(),
  grade: z.string().max(50).optional().nullable(),
  placeOfTaxDeduction: z.enum(['METRO', 'NON_METRO']).optional().nullable(),
  jobResponsibility: z.string().max(2000).optional().nullable(),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN']).optional(),
  employeeStatus: z.enum(['ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED', 'RESIGNED']).optional(),

  // Dates
  dateOfJoining: z.string().optional(),
  probationEndDate: z.string().optional(),
  confirmationDate: z.string().optional(),
  dateOfLeaving: z.string().optional(),
  terminationReason: z.string().max(1000).optional(),

  // Additional Information (JSON fields)
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    postalCode: z.string().optional(),
    sameAsPermanent: z.boolean().optional(),
    presentAddress: z.string().optional(),
    presentCity: z.string().optional(),
    presentDistrict: z.string().optional(),
    presentState: z.string().optional(),
    presentPincode: z.string().optional(),
    presentPhoneNumber: z.string().optional(),
  }).optional(),
  emergencyContacts: z.array(z.object({
    name: z.string(),
    relationship: z.string(),
    phone: z.string(),
    email: z.string().email().optional(),
  })).optional(),
  bankDetails: z.object({
    accountNumber: z.string().optional(),
    bankName: z.string().optional(),
    ifscCode: z.string().optional(),
    accountHolderName: z.string().optional(),
  }).optional(),
  taxInformation: z.object({
    taxId: z.string().optional(),
    panNumber: z.string().optional(),
    taxFilingStatus: z.string().optional(),
  }).optional(),
  documents: z.array(z.object({
    type: z.string(),
    name: z.string(),
    url: z.string(),
    uploadedAt: z.string(),
  })).optional(),
  
  // User role (for ORG_ADMIN and HR_MANAGER only)
  role: z.enum(['SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE']).optional(),
});

/**
 * Validation schema for querying employees
 */
export const queryEmployeesSchema = z.object({
  organizationId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  positionId: z.string().uuid().optional(),
  reportingManagerId: z.string().uuid().optional(),
  employeeId: z.string().uuid().optional(), // For EMPLOYEE self-service filtering
  managerEmployeeId: z.string().uuid().optional(), // For MANAGER to filter by their employee ID
  managerDepartmentId: z.string().uuid().optional(), // For MANAGER to filter by their department
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN']).optional(),
  employeeStatus: z.enum(['ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED', 'RESIGNED']).optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']).optional(),
  search: z.string().optional(),
  page: z.string().regex(/^\d+$/).optional().default('1'),
  limit: z.string().regex(/^\d+$/).optional().default('20'),
  sortBy: z.enum(['firstName', 'lastName', 'employeeCode', 'dateOfJoining', 'createdAt']).optional().default('firstName'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
  listView: z.enum(['true', 'false']).optional(), // lighter response for list page
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type QueryEmployeesInput = z.infer<typeof queryEmployeesSchema>;
