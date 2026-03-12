import React, { useEffect, useState } from 'react';
import { useEmployeeStore } from '../../store/employeeStore';
import { useDepartmentStore } from '../../store/departmentStore';
import { usePositionStore } from '../../store/positionStore';
import employeeService, { Employee, Gender, MaritalStatus, EmployeeStatus } from '../../services/employee.service';
import { employeeChangeRequestService } from '../../services/employee-change-request.service';
import api from '../../services/api';
import { subDepartmentService } from '../../services/sub-department.service';
import configuratorDataService from '../../services/configurator-data.service';
import entityService from '../../services/entity.service';
import locationService from '../../services/location.service';
import { employeeSalaryService } from '../../services/payroll.service';
import { esopService, EsopRecord } from '../../services/esop.service';
import Modal from '../common/Modal';
import SearchableSelect from '../common/SearchableSelect';
import { toDisplayEmail, toDisplayName } from '../../utils/display';
import PositionForm from '../positions/PositionForm';
import EntityForm from '../entities/EntityForm';
import LocationForm from '../locations/LocationForm';
import { FaceCapture } from './FaceCapture';

export type EmployeeFormTabKey =
  | 'company'
  | 'personal'
  | 'statutory'
  | 'bank'
  | 'salary'
  | 'assets'
  | 'academic'
  | 'previousEmployment'
  | 'family'
  | 'others'
  | 'newFields'
  | 'esop';

interface EmployeeFormProps {
  employee?: Employee | null;
  organizationId: string;
  initialPaygroupId?: string;
  initialPaygroupName?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
  /** When 'view', form is read-only and Update Employee button is hidden */
  mode?: 'view' | 'edit';
  /** When in edit mode, only these tabs are editable. Omit/undefined = all tabs editable. */
  editableTabs?: EmployeeFormTabKey[];
  /** Rejoin flow: create new employee from separated one; only joining date and new login email editable. */
  rejoinMode?: boolean;
}

const EmployeeForm: React.FC<EmployeeFormProps> = ({
  employee,
  organizationId,
  initialPaygroupId,
  initialPaygroupName,
  onSuccess,
  onCancel,
  mode = 'edit',
  editableTabs,
  rejoinMode = false,
}) => {
  const isViewMode = mode === 'view';
  const { createEmployee, updateEmployee, loading } = useEmployeeStore();
  const [_rejoinJoiningDate, setRejoinJoiningDate] = useState(
    () => employee?.dateOfJoining?.split('T')[0] ?? new Date().toISOString().split('T')[0]
  );
  const [rejoinNewEmail, setRejoinNewEmail] = useState('');
  const [rejoinSubmitting, setRejoinSubmitting] = useState(false);
  const [rejoinErrors, setRejoinErrors] = useState<{ joiningDate?: string; newLoginEmail?: string }>({});

  useEffect(() => {
    if (rejoinMode && employee?.dateOfJoining) {
      setRejoinJoiningDate(employee.dateOfJoining.split('T')[0]);
      setRejoinErrors({});
    }
  }, [rejoinMode, employee?.id, employee?.dateOfJoining]);

  useEffect(() => {
    if (rejoinMode && employee) setCurrentTab('company');
  }, [rejoinMode, !!employee]);

  const { departments: localDepartments, fetchDepartments } = useDepartmentStore();
  const { positions, fetchPositions } = usePositionStore();
  const [configDepartments, setConfigDepartments] = useState<{ id: number; name: string }[]>([]);
  const [availableManagers, setAvailableManagers] = useState<Employee[]>([]);
  const [entities, setEntities] = useState<{ id: string; name: string; code?: string }[]>([]);
  const [locations, setLocations] = useState<{ id: string; name: string; code?: string }[]>([]);
  const [costCentres, setCostCentres] = useState<{ id: string; name: string; code?: string }[]>([]);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [createdEmployeeEmail, setCreatedEmployeeEmail] = useState<string>('');
  const [approvalSubmitted, setApprovalSubmitted] = useState(false);
  const [submittingApproval, setSubmittingApproval] = useState(false);
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [showPositionModal, setShowPositionModal] = useState(false);
  const [showEntityModal, setShowEntityModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showSubDepartmentModal, setShowSubDepartmentModal] = useState(false);
  const [newSubDepartmentName, setNewSubDepartmentName] = useState('');
  const [subDepartmentError, setSubDepartmentError] = useState('');
  const [subDepartmentOptions, setSubDepartmentOptions] = useState<string[]>([]);
  const [showCostCentreModal, setShowCostCentreModal] = useState(false);
  const [newCostCentreName, setNewCostCentreName] = useState('');
  const [costCentreError, setCostCentreError] = useState('');
  const [costCentreOptions, setCostCentreOptions] = useState<string[]>([]);
  // Full Configurator items with IDs for passing relationship IDs in create calls
  const [configCostCentres, setConfigCostCentres] = useState<{ id: number; name: string }[]>([]);
  const [selectedConfigCostCentreId, setSelectedConfigCostCentreId] = useState<number | null>(null);
  const [configSubDepartments, setConfigSubDepartments] = useState<{ id: number; name: string; department_id?: number }[]>([]);
  const [selectedConfigDepartmentId, setSelectedConfigDepartmentId] = useState<number | null>(null);
  const [selectedConfigSubDepartmentId, setSelectedConfigSubDepartmentId] = useState<number | null>(null);
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [showAcademicModal, setShowAcademicModal] = useState(false);
  const [showPreviousEmploymentModal, setShowPreviousEmploymentModal] = useState(false);
  const [showFamilyModal, setShowFamilyModal] = useState(false);
  const [showCertificationModal, setShowCertificationModal] = useState(false);
  const [showKnownLanguageModal, setShowKnownLanguageModal] = useState(false);
  // User Role dropdown state (same pattern as Cost Centre)
  const [showUserRoleModal, setShowUserRoleModal] = useState(false);
  const [newUserRoleName, setNewUserRoleName] = useState('');
  const [userRoleError, setUserRoleError] = useState('');
  const [userRoleOptions, setUserRoleOptions] = useState<{ id: number; name: string }[]>([]);
  const [selectedUserRoleId, setSelectedUserRoleId] = useState<number | null>(null);

  const [salaryTab, setSalaryTab] = useState<'earnings' | 'deductions' | 'reimbursement'>('earnings');
  const [salaryFixedGross, setSalaryFixedGross] = useState(0);
  const [salaryVehicleAllowances, setSalaryVehicleAllowances] = useState(0);
  const [previousSalaryGross, setPreviousSalaryGross] = useState<number | null>(null);
  const [salaryHistory, setSalaryHistory] = useState<Array<{ effectiveDate: string; grossSalary: number; isCurrent: boolean }>>([]);
  const [salaryLoading, setSalaryLoading] = useState(false);
  const [othersTab, setOthersTab] = useState<'certifications' | 'knownLanguages'>('certifications');
  const [esopRecords, setEsopRecords] = useState<EsopRecord[]>([]);
  const [esopLoading, setEsopLoading] = useState(false);
  const [assets, setAssets] = useState<Array<{
    id: string;
    assetName: string;
    serialNumber: string;
    dateOfIssuance: string;
    assetId: string;
    make: string;
    model: string;
    colour: string;
    inchargeName: string;
    remarks: string;
    released: boolean;
  }>>([]);
  const [assetFormData, setAssetFormData] = useState({
    assetName: '',
    serialNumber: '',
    dateOfIssuance: '',
    assetId: '',
    make: '',
    model: '',
    colour: '',
    inchargeName: '',
    remarks: '',
    released: false,
  });
  const [academicQualifications, setAcademicQualifications] = useState<Array<{
    id: string;
    degree: string;
    discipline: string;
    university: string;
    grade: string;
    percentage: string;
    yearOfPassing: string;
    nameOfInstitution: string;
    remarks: string;
  }>>([]);
  const [academicFormData, setAcademicFormData] = useState({
    degree: '',
    discipline: '',
    university: '',
    grade: '',
    percentage: '',
    yearOfPassing: '',
    nameOfInstitution: '',
    remarks: '',
  });
  const [previousEmployments, setPreviousEmployments] = useState<Array<{
    id: string;
    organization: string;
    designation: string;
    fromDate: string;
    toDate: string;
    yearsOfExperience: string;
    relevantExperience: string;
    remarks: string;
    ctc: string;
  }>>([]);
  const [previousEmploymentFormData, setPreviousEmploymentFormData] = useState({
    organization: '',
    designation: '',
    fromDate: '',
    toDate: '',
    yearsOfExperience: '',
    relevantExperience: '',
    remarks: '',
    ctc: '',
  });
  const [familyMembers, setFamilyMembers] = useState<Array<{
    id: string;
    firstName: string;
    lastName: string;
    relationship: string;
    dateOfBirth: string;
    phoneNumber: string;
    occupation: string;
    address: string;
    aadhaarNumber: string;
    passportNumber: string;
    passportIssueDate: string;
    passportExpiryDate: string;
    pfShare: string;
    gratuityShare: string;
    nominationRemarks: string;
  }>>([]);
  const [familyFormData, setFamilyFormData] = useState({
    firstName: '',
    lastName: '',
    relationship: '',
    dateOfBirth: '',
    phoneNumber: '',
    occupation: '',
    address: '',
    aadhaarNumber: '',
    passportNumber: '',
    passportIssueDate: '',
    passportExpiryDate: '',
    pfShare: '',
    gratuityShare: '',
    nominationRemarks: '',
  });
  const [certifications, setCertifications] = useState<Array<{
    id: string;
    skillSet: string;
    yearsOfExperience: string;
    certifiedBy: string;
    remarks: string;
  }>>([]);
  const [certificationFormData, setCertificationFormData] = useState({
    skillSet: '',
    yearsOfExperience: '',
    certifiedBy: '',
    remarks: '',
  });
  const [knownLanguages, setKnownLanguages] = useState<Array<{
    id: string;
    language: string;
    speak: string;
    write: string;
    read: string;
  }>>([]);
  const [knownLanguageFormData, setKnownLanguageFormData] = useState({
    language: '',
    speak: '',
    write: '',
    read: '',
  });

  const [currentTab, setCurrentTab] = useState<
    'company' | 'personal' | 'statutory' | 'bank' | 'salary' | 'assets' | 'academic' | 'previousEmployment' | 'family' | 'others' | 'newFields' | 'esop'
  >('company');

  // Fetch ESOP records when ESOP tab is selected and employee exists
  useEffect(() => {
    if (currentTab === 'esop' && employee?.id) {
      setEsopLoading(true);
      esopService
        .getByEmployeeId(employee.id)
        .then((records) => {
          setEsopRecords(records);
        })
        .catch((error) => {
          console.error('Failed to fetch ESOP records:', error);
          setEsopRecords([]);
        })
        .finally(() => {
          setEsopLoading(false);
        });
    }
  }, [currentTab, employee?.id]);

  /** Tab is editable when in edit mode and (no restriction or tab is in editableTabs) */
  const isTabEditable = (tab: EmployeeFormTabKey) =>
    mode === 'edit' && (editableTabs == null || editableTabs.length === 0 || editableTabs.includes(tab));

  const [formData, setFormData] = useState({
    // Company Details (Module 2)
    paygroupDisplay: initialPaygroupName || (employee as any)?.paygroup?.name || '',
    firstName: toDisplayName(employee?.firstName) || '',
    middleName: (employee as any)?.middleName || '',
    lastName: toDisplayName(employee?.lastName) || '',
    gender: employee?.gender || '',
    dateOfBirth: employee?.dateOfBirth ? employee.dateOfBirth.split('T')[0] : '',
    joiningDate: employee?.dateOfJoining ? employee.dateOfJoining.split('T')[0] : '',
    officialEmail: (employee as any)?.officialEmail || '',
    officialMobile: (employee as any)?.officialMobile || '',
    departmentId: employee?.departmentId || '',
    subDepartmentId: (employee as any)?.subDepartmentId || '',
    subDepartment: ((employee as any)?.profileExtensions?.subDepartment ?? (employee as any)?.subDepartment) || '',
    positionId: employee?.positionId || '',
    entityId: (employee as any)?.entityId || (employee as any)?.location?.entityId || '',
    locationId: (employee as any)?.locationId || '',
    costCentreId: (employee as any)?.costCentreId || '',
    costCentre: (employee as any)?.costCentre?.name || (employee as any)?.profileExtensions?.costCentre || '',
    managerId: employee?.reportingManagerId || '',
    userRoleId: '',
    grade: (employee as any)?.grade || '',
    placeOfTaxDeduction: (employee as any)?.placeOfTaxDeduction || '',
    jobResponsibility: (employee as any)?.jobResponsibility || '',
    // Statutory Details (from taxInformation JSON)
    pfNumber: ((employee as any)?.taxInformation?.pfNumber ?? (employee as any)?.pfNumber) || '',
    esiNumber: ((employee as any)?.taxInformation?.esiNumber ?? (employee as any)?.esiNumber) || '',
    pfApplicable: (employee as any)?.pfApplicable ?? false,
    esiApplicable: (employee as any)?.esiApplicable ?? false,
    taxApplicable: (employee as any)?.taxApplicable ?? false,
    uanNumber: ((employee as any)?.taxInformation?.uanNumber ?? (employee as any)?.uanNumber) || '',
    panNumber: ((employee as any)?.taxInformation?.panNumber ?? (employee as any)?.panNumber) || '',
    pTaxLocation: ((employee as any)?.taxInformation?.ptaxLocation ?? (employee as any)?.pTaxLocation) || '',
    dateOfRetirement: (employee as any)?.dateOfRetirement
      ? (employee as any).dateOfRetirement.split('T')[0]
      : '',
    expatriate: (employee as any)?.expatriate ?? false,
    pfTransferred: (employee as any)?.pfTransferred ?? false,
    esiDispensary: ((employee as any)?.taxInformation?.esiDispensary ?? (employee as any)?.esiDispensary) || '',
    gratuityApplicable: (employee as any)?.gratuityApplicable ?? false,
    confirmationPeriod: (employee as any)?.confirmationPeriod || '',
    pfApplicableFrom: !!(employee as any)?.pfApplicableFrom,
    lwfLocation: ((employee as any)?.profileExtensions?.lwfLocation ?? (employee as any)?.lwfLocation) || '',
    taxRegime: (() => {
      const raw = (employee as any)?.taxInformation?.taxRegime ?? (employee as any)?.taxRegime;
      if (!raw) return 'OLD';
      const u = String(raw).toUpperCase();
      if (u === 'N' || u === 'NEW') return 'NEW';
      if (u === 'O' || u === 'OLD') return 'OLD';
      return u; // keep as-is if already NEW/OLD
    })(),
    aadhaarNumber: ((employee as any)?.taxInformation?.aadhaarNumber ?? (employee as any)?.aadhaarNumber) || '',
    dateOfProbationary: employee?.probationEndDate ? employee.probationEndDate.split('T')[0] : '',
    dateOfConfirmation: employee?.confirmationDate ? employee.confirmationDate.split('T')[0] : '',
    noticePeriodDays:
      (employee as any)?.profileExtensions?.associateNoticePeriodDays !== undefined && (employee as any)?.profileExtensions?.associateNoticePeriodDays !== null
        ? String((employee as any).profileExtensions.associateNoticePeriodDays)
        : ((employee as any)?.noticePeriodDays !== undefined && (employee as any)?.noticePeriodDays !== null
          ? String((employee as any).noticePeriodDays)
          : ''),
    husbandNameOnOnlinePf: (employee as any)?.husbandNameOnOnlinePf || '',
    // Bank Details
    bankName: (employee as any)?.bankDetails?.bankName || '',
    bankAccountNumber: (employee as any)?.bankDetails?.accountNumber || '',
    bankIfscCode: (employee as any)?.bankDetails?.ifscCode || '',
    bankPaymentMode: (employee as any)?.bankDetails?.paymentMode || '',
    bankCurrency: (employee as any)?.bankDetails?.currency || '',
    // Personal (login email required for create) - never show placeholder emails
    email: toDisplayEmail(employee?.email) || '',
    phoneNumber: employee?.phone || '',
    maritalStatus: employee?.maritalStatus || '',
    // Permanent Address (map from API address JSON when no dedicated fields)
    permanentAddress: (employee as any)?.permanentAddress || (typeof employee?.address === 'object' && employee?.address && 'street' in employee.address ? (employee.address as { street?: string }).street : '') || '',
    permanentCity: (employee as any)?.permanentCity || (typeof employee?.address === 'object' && employee?.address && 'city' in employee.address ? (employee.address as { city?: string }).city : '') || '',
    permanentDistrict: ((typeof employee?.address === 'object' && employee?.address && 'permanentDistrict' in employee.address ? (employee.address as { permanentDistrict?: string }).permanentDistrict : null) ?? (employee as any)?.permanentDistrict) || '',
    permanentState: (employee as any)?.permanentState || (typeof employee?.address === 'object' && employee?.address && 'state' in employee.address ? (employee.address as { state?: string }).state : '') || '',
    permanentPincode: (employee as any)?.permanentPincode || (typeof employee?.address === 'object' && employee?.address && 'postalCode' in employee.address ? (employee.address as { postalCode?: string }).postalCode : '') || '',
    permanentPhoneNumber: (employee as any)?.permanentPhoneNumber || employee?.phone || '',
    personalMobile: (employee as any)?.personalMobile || '',
    personalEmail: (employee as any)?.personalEmail || employee?.personalEmail || '',
    // Present Address (from API address JSON when saved)
    sameAsPermanent: (typeof employee?.address === 'object' && employee?.address && 'sameAsPermanent' in employee.address ? (employee.address as { sameAsPermanent?: boolean }).sameAsPermanent : (employee as any)?.sameAsPermanent) ?? false,
    presentAddress: (typeof employee?.address === 'object' && employee?.address && 'presentAddress' in employee.address ? (employee.address as { presentAddress?: string }).presentAddress : (employee as any)?.presentAddress) || '',
    presentCity: (typeof employee?.address === 'object' && employee?.address && 'presentCity' in employee.address ? (employee.address as { presentCity?: string }).presentCity : (employee as any)?.presentCity) || '',
    presentDistrict: (typeof employee?.address === 'object' && employee?.address && 'presentDistrict' in employee.address ? (employee.address as { presentDistrict?: string }).presentDistrict : (employee as any)?.presentDistrict) || '',
    presentState: (typeof employee?.address === 'object' && employee?.address && 'presentState' in employee.address ? (employee.address as { presentState?: string }).presentState : (employee as any)?.presentState) || '',
    presentPincode: (typeof employee?.address === 'object' && employee?.address && 'presentPincode' in employee.address ? (employee.address as { presentPincode?: string }).presentPincode : (employee as any)?.presentPincode) || '',
    presentPhoneNumber: (typeof employee?.address === 'object' && employee?.address && 'presentPhoneNumber' in employee.address ? (employee.address as { presentPhoneNumber?: string }).presentPhoneNumber : (employee as any)?.presentPhoneNumber) || '',
    // Others (from profileExtensions JSON)
    bloodGroup: ((employee as any)?.profileExtensions?.bloodGroup ?? (employee as any)?.bloodGroup) || '',
    dateOfWedding: (employee as any)?.profileExtensions?.dateOfWedding ? (employee as any).profileExtensions.dateOfWedding.split('T')[0] : ((employee as any)?.dateOfWedding ? (employee as any).dateOfWedding.split('T')[0] : ''),
    children: ((employee as any)?.profileExtensions?.children ?? (employee as any)?.children) || '',
    physicallyChallenged: (employee as any)?.profileExtensions?.physicallyChallenged ?? (employee as any)?.physicallyChallenged ?? false,
    physicallyChallengedRemarks: ((employee as any)?.profileExtensions?.physicallyChallengedRemarks ?? (employee as any)?.physicallyChallengedRemarks) || '',
    passportNumber: ((employee as any)?.profileExtensions?.passportNumber ?? (employee as any)?.passportNumber) || '',
    passportExpiry: (employee as any)?.profileExtensions?.passportExpiry ? (employee as any).profileExtensions.passportExpiry.split('T')[0] : ((employee as any)?.passportExpiry ? (employee as any).passportExpiry.split('T')[0] : ''),
    drivingLicenseNumber: ((employee as any)?.profileExtensions?.drivingLicenseNumber ?? (employee as any)?.drivingLicenseNumber) || '',
    drivingLicenseExpiry: (employee as any)?.profileExtensions?.drivingLicenseExpiry ? (employee as any).profileExtensions.drivingLicenseExpiry.split('T')[0] : ((employee as any)?.drivingLicenseExpiry ? (employee as any).drivingLicenseExpiry.split('T')[0] : ''),
    // Employment
    employeeStatus: employee?.employeeStatus || 'ACTIVE',
    // Contact
    addressLine1: employee?.address?.street || '',
    addressLine2: '',
    city: employee?.address?.city || '',
    state: employee?.address?.state || '',
    postalCode: employee?.address?.postalCode || '',
    country: employee?.address?.country || '',
    emergencyContactName: employee?.emergencyContacts?.[0]?.name || '',
    emergencyContactRelationship: employee?.emergencyContacts?.[0]?.relationship || '',
    emergencyContactPhone: employee?.emergencyContacts?.[0]?.phone || '',
    imei: (employee as any)?.imei || '',
    pfAbrySchemeApplicable: (employee as any)?.pfAbrySchemeApplicable || '',
    alternateSaturdayOff: ((employee as any)?.profileExtensions?.alternateSaturdayOff ?? (employee as any)?.alternateSaturdayOff) || '',
    compoffApplicable: ((employee as any)?.profileExtensions?.compoffApplicable ?? (employee as any)?.compoffApplicable) || '',
    face_encoding: (employee as any)?.faceEncoding && Array.isArray((employee as any).faceEncoding) ? (employee as any).faceEncoding as number[] : ([] as number[]),
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [faceCaptureError, setFaceCaptureError] = useState('');

  useEffect(() => {
    if (initialPaygroupName) {
      setFormData((prev) => ({ ...prev, paygroupDisplay: initialPaygroupName }));
    }
  }, [initialPaygroupName]);

  useEffect(() => {
    if (employee?.id) {
      const eId = (employee as { entityId?: string; location?: { entityId?: string } }).entityId
        || (employee as { location?: { entityId?: string } }).location?.entityId
        || '';
      const locId = (employee as { locationId?: string }).locationId || '';
      setFormData((prev) =>
        prev.entityId !== eId || prev.locationId !== locId
          ? { ...prev, entityId: eId, locationId: locId }
          : prev
      );
    }
  }, [employee?.id, (employee as any)?.entityId, (employee as any)?.locationId]);

  useEffect(() => {
    fetchDepartments(organizationId);
    fetchPositions({ organizationId, limit: 100 });
    fetchManagersForDropdown();
    // Fetch departments from Configurator DB (primary source for dropdown)
    const fetchConfigDepartments = async () => {
      try {
        const list = await configuratorDataService.getDepartments();
        setConfigDepartments(list.map((d) => ({ id: d.id, name: d.name })));
      } catch (err) {
        console.warn('Failed to fetch Configurator departments, falling back to local:', err);
        setConfigDepartments([]);
      }
    };
    fetchConfigDepartments();
    const fetchEntities = async () => {
      try {
        const list = await entityService.getByOrganization(organizationId);
        setEntities(list.map((e) => ({ id: e.id, name: e.name, code: e.code ?? undefined })));
      } catch {
        setEntities([]);
      }
    };
    const fetchCostCentres = async () => {
      try {
        // Fetch from Configurator DB (primary source)
        const configList = await configuratorDataService.getCostCentres();
        setConfigCostCentres(configList.map((c) => ({ id: c.id, name: c.name })));
        let names = configList.map((c) => c.name).sort((a, b) => a.localeCompare(b));
        // Also keep local HRMS cost centres as fallback
        try {
          const { data } = await api.get<{ data: { costCentres: { id: string; name: string; code?: string }[] } }>('/cost-centres', { params: { organizationId } });
          const localList = data.data?.costCentres ?? [];
          setCostCentres(localList);
          // Merge local names not in configurator list
          for (const c of localList) {
            if (!names.some((n) => n.toLowerCase() === c.name.toLowerCase())) {
              names.push(c.name);
            }
          }
          names.sort((a, b) => a.localeCompare(b));
          if (employee?.id && (employee as any)?.costCentreId) {
            const match = localList.find((c: { id: string }) => c.id === (employee as any).costCentreId);
            if (match) setFormData((prev) => ({ ...prev, costCentre: match.name }));
          }
          // Also ensure the employee's current cost centre name (from relation or profileExtensions) is in the options
          const empCCName = (employee as any)?.costCentre?.name || (employee as any)?.profileExtensions?.costCentre || '';
          if (empCCName && !names.some((n) => n.toLowerCase() === empCCName.toLowerCase())) {
            names.push(empCCName);
            names.sort((a, b) => a.localeCompare(b));
          }
        } catch {
          setCostCentres([]);
        }
        setCostCentreOptions(names);
      } catch {
        // Fallback to local HRMS cost centres only
        try {
          const { data } = await api.get<{ data: { costCentres: { id: string; name: string; code?: string }[] } }>('/cost-centres', { params: { organizationId } });
          const localList = data.data?.costCentres ?? [];
          setCostCentres(localList);
          setCostCentreOptions(localList.map((c) => c.name).sort((a, b) => a.localeCompare(b)));
        } catch {
          setCostCentres([]);
          setCostCentreOptions([]);
        }
      }
    };
    const fetchSubDepartments = async () => {
      try {
        // Fetch from Configurator DB (primary source)
        const configList = await configuratorDataService.getSubDepartments();
        setConfigSubDepartments(configList.map((s) => ({ id: s.id, name: s.name, department_id: s.department_id })));
        let names = configList.map((s) => s.name).sort((a, b) => a.localeCompare(b));
        // Also fetch local HRMS sub-departments as fallback/merge
        try {
          const localList = await subDepartmentService.getByOrganization(organizationId);
          for (const s of localList) {
            if (!names.some((n) => n.toLowerCase() === s.name.toLowerCase())) {
              names.push(s.name);
            }
          }
          names.sort((a, b) => a.localeCompare(b));
        } catch { /* ignore local fetch failure */ }
        const empSubDept = ((employee as any)?.profileExtensions?.subDepartment ?? (employee as any)?.subDepartment)?.toString?.()?.split(',')[0]?.trim();
        if (empSubDept && !names.some((n) => n.toLowerCase() === empSubDept.toLowerCase())) {
          names = [...names, empSubDept].sort((a, b) => a.localeCompare(b));
        }
        setSubDepartmentOptions(names);
      } catch {
        // Fallback to local HRMS sub-departments only
        try {
          const list = await subDepartmentService.getByOrganization(organizationId);
          let names = list.map((s) => s.name).sort((a, b) => a.localeCompare(b));
          const empSubDept = ((employee as any)?.profileExtensions?.subDepartment ?? (employee as any)?.subDepartment)?.toString?.()?.split(',')[0]?.trim();
          if (empSubDept && !names.some((n) => n.toLowerCase() === empSubDept.toLowerCase())) {
            names = [...names, empSubDept].sort((a, b) => a.localeCompare(b));
          }
          setSubDepartmentOptions(names);
        } catch {
          setSubDepartmentOptions([]);
        }
      }
    };
    const fetchUserRoles = async () => {
      try {
        const list = await configuratorDataService.getUserRoles();
        setUserRoleOptions(list.map((r) => ({ id: r.role_id, name: r.name })));
      } catch {
        setUserRoleOptions([]);
      }
    };
    fetchEntities();
    fetchCostCentres();
    fetchSubDepartments();
    fetchUserRoles();
  }, [organizationId, fetchDepartments, fetchPositions, employee?.id]);

  // Initialize Configurator IDs and prefill dropdown names when editing an existing employee
  useEffect(() => {
    if (!employee?.id) return;
    let cancelled = false;

    // Read the Configurator IDs stored directly on the HRMS employee record
    const empCCConfigId = (employee as any)?.costCentreConfiguratorId as number | undefined;
    const empDeptConfigId = (employee as any)?.departmentConfiguratorId as number | undefined;
    const empSubDeptConfigId = (employee as any)?.subDepartmentConfiguratorId as number | undefined;
    const configUserId = (employee as any)?.configuratorUserId as number | undefined;

    const init = async () => {
      // 1. Fetch Configurator cost centres, departments, sub-departments to resolve IDs → names
      let allCostCentres: { id: number; name: string }[] = [];
      let filteredDepts: { id: number; name: string }[] = [];
      let allSubDepts: { id: number; name: string; department_id?: number }[] = [];
      let allUserRoles: { role_id: number; name: string }[] = [];

      try {
        const [ccList, subDeptList, roleList] = await Promise.all([
          configuratorDataService.getCostCentres(),
          configuratorDataService.getSubDepartments(),
          configuratorDataService.getUserRoles(),
        ]);
        allCostCentres = ccList.map((c) => ({ id: c.id, name: c.name }));
        allSubDepts = subDeptList.map((s) => ({ id: s.id, name: s.name, department_id: s.department_id }));
        allUserRoles = roleList;
        // Ensure user role options are populated for the dropdown
        if (roleList.length > 0) {
          setUserRoleOptions(roleList.map((r) => ({ id: r.role_id, name: r.name })));
        }
      } catch (err) {
        console.warn('Failed to fetch Configurator dropdowns for edit init:', err);
      }
      if (cancelled) return;

      // Fetch departments filtered by cost centre (if available)
      const ccId = empCCConfigId || null;
      if (ccId) {
        try {
          const deptList = await configuratorDataService.getDepartments(ccId);
          filteredDepts = deptList.map((d) => ({ id: d.id, name: d.name }));
          setConfigDepartments(filteredDepts);
        } catch {
          // Try unfiltered
          try {
            const deptList = await configuratorDataService.getDepartments();
            filteredDepts = deptList.map((d) => ({ id: d.id, name: d.name }));
          } catch { /* ignore */ }
        }
      } else {
        try {
          const deptList = await configuratorDataService.getDepartments();
          filteredDepts = deptList.map((d) => ({ id: d.id, name: d.name }));
        } catch { /* ignore */ }
      }
      if (cancelled) return;

      // 2. Resolve names from Configurator IDs
      const ccName = (employee as any)?.costCentre?.name
        || (empCCConfigId ? allCostCentres.find((c) => c.id === empCCConfigId)?.name : null)
        || (employee as any)?.profileExtensions?.costCentre
        || '';

      const deptMatch = empDeptConfigId ? filteredDepts.find((d) => d.id === empDeptConfigId) : null;
      const deptName = (employee as any)?.department?.name || deptMatch?.name || '';

      const subDeptName = (employee as any)?.profileExtensions?.subDepartment
        || (empSubDeptConfigId ? allSubDepts.find((s) => s.id === empSubDeptConfigId)?.name : null)
        || (employee as any)?.sub_department?.name
        || (employee as any)?.subDepartment
        || '';

      // 3. Set internal Configurator IDs for the update API
      if (empCCConfigId) setSelectedConfigCostCentreId(empCCConfigId);
      if (empDeptConfigId) setSelectedConfigDepartmentId(empDeptConfigId);
      if (empSubDeptConfigId) setSelectedConfigSubDepartmentId(empSubDeptConfigId);

      // Resolve user role from enriched employee, Configurator user, or stored role
      const empConfigRoleId = (employee as any)?.configuratorRoleId as number | undefined;
      let resolvedRoleId: number | null = empConfigRoleId ?? null;
      if (!resolvedRoleId && configUserId) {
        try {
          const configUser = await configuratorDataService.getConfiguratorUser(configUserId);
          if (!cancelled) {
            resolvedRoleId = configUser?.role_id || configUser?.project_role?.id || null;
          }
        } catch { /* ignore */ }
      }
      if (cancelled) return;
      if (resolvedRoleId) setSelectedUserRoleId(resolvedRoleId);

      // 4. Prefill the form fields
      setFormData((prev) => {
        const updates: Record<string, any> = {};

        if (!prev.costCentre && ccName) updates.costCentre = ccName;

        if (!prev.departmentId && deptMatch) {
          // Check if a local HRMS department matches by name
          const localMatch = localDepartments.find((d) => d.name.toLowerCase() === deptMatch.name.toLowerCase());
          updates.departmentId = localMatch ? localMatch.id : `config_${deptMatch.id}`;
        }

        if (!prev.subDepartment && subDeptName) updates.subDepartment = subDeptName;

        if (!prev.userRoleId && resolvedRoleId) {
          updates.userRoleId = String(resolvedRoleId);
        }

        if (Object.keys(updates).length === 0) return prev;
        return { ...prev, ...updates };
      });

      // 5. Ensure cost centre name is in the options list
      if (ccName) {
        setCostCentreOptions((prev) => {
          if (prev.some((n) => n.toLowerCase() === ccName.toLowerCase())) return prev;
          return [...prev, ccName].sort((a, b) => a.localeCompare(b));
        });
      }

      // 6. Ensure sub-department name is in the options list
      if (subDeptName) {
        setSubDepartmentOptions((prev) => {
          if (prev.some((n) => n.toLowerCase() === subDeptName.toLowerCase())) return prev;
          return [...prev, subDeptName].sort((a, b) => a.localeCompare(b));
        });
      }
    };

    init();
    return () => { cancelled = true; };
  }, [employee?.id, (employee as any)?.configuratorUserId]);

  // Fetch locations for selected entity
  useEffect(() => {
    if (!formData.entityId?.trim()) {
      setLocations([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const list = await locationService.getByEntity(organizationId, formData.entityId);
        if (!cancelled) setLocations(list.map((l) => ({ id: l.id, name: l.name, code: l.code ?? undefined })));
      } catch {
        if (!cancelled) setLocations([]);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [organizationId, formData.entityId]);

  // When "Same as permanent" is ON, keep present address in sync with permanent
  useEffect(() => {
    if (!formData.sameAsPermanent) return;
    setFormData((prev) => {
      const next = {
        ...prev,
        presentAddress: prev.permanentAddress,
        presentCity: prev.permanentCity,
        presentDistrict: prev.permanentDistrict,
        presentState: prev.permanentState,
        presentPincode: prev.permanentPincode,
        presentPhoneNumber: prev.permanentPhoneNumber,
      };
      if (prev.presentAddress === next.presentAddress && prev.presentCity === next.presentCity && prev.presentDistrict === next.presentDistrict && prev.presentState === next.presentState && prev.presentPincode === next.presentPincode && prev.presentPhoneNumber === next.presentPhoneNumber) return prev;
      return next;
    });
  }, [formData.sameAsPermanent, formData.permanentAddress, formData.permanentCity, formData.permanentDistrict, formData.permanentState, formData.permanentPincode, formData.permanentPhoneNumber]);

  // When editing, merge employee's sub-department name into options if not already loaded from API
  useEffect(() => {
    const value = ((employee as any)?.profileExtensions?.subDepartment ?? (employee as any)?.subDepartment) || '';
    if (!value || typeof value !== 'string') return;
    const name = value.split(',')[0]?.trim();
    if (!name) return;
    setSubDepartmentOptions((prev) => {
      if (prev.some((o) => o.toLowerCase() === name.toLowerCase())) return prev;
      return [...prev, name].sort((a, b) => a.localeCompare(b));
    });
  }, [employee?.id]);

  // Load current salary, previous salary, and full salary history when editing an employee
  useEffect(() => {
    if (!employee?.id) {
      setSalaryFixedGross(0);
      setSalaryVehicleAllowances(0);
      setPreviousSalaryGross(null);
      setSalaryHistory([]);
      return;
    }
    setSalaryLoading(true);
    setPreviousSalaryGross(null);
    setSalaryHistory([]);
    Promise.all([
      employeeSalaryService.getCurrentSalary(employee.id),
      employeeSalaryService.getAllSalaries({ employeeId: employee.id, limit: '20' }),
    ])
      .then(([currentSalary, listResult]) => {
        const current = currentSalary;
        const list = (listResult?.data ?? []) as Array<{ id: string; effectiveDate: string; grossSalary: number; isActive?: boolean }>;
        setSalaryFixedGross(Number(current?.grossSalary ?? 0));
        const vehicle = current?.components && typeof current.components === 'object' && 'Vehicle Allowances' in current.components
          ? Number((current.components as Record<string, unknown>)['Vehicle Allowances']) || 0
          : 0;
        setSalaryVehicleAllowances(vehicle);
        const currentId = current?.id;
        const previous = list.find((s) => s.id !== currentId);
        setPreviousSalaryGross(previous != null ? Number(previous.grossSalary ?? 0) : null);
        // Build salary log: date and salary, newest first; mark current
        const history = list
          .map((s) => ({
            effectiveDate: typeof s.effectiveDate === 'string' ? s.effectiveDate.split('T')[0] : '',
            grossSalary: Number(s.grossSalary ?? 0),
            isCurrent: s.id === currentId,
          }))
          .sort((a, b) => (b.effectiveDate || '').localeCompare(a.effectiveDate || ''));
        setSalaryHistory(history);
      })
      .catch(() => {
        setSalaryFixedGross(0);
        setSalaryVehicleAllowances(0);
        setPreviousSalaryGross(null);
        setSalaryHistory([]);
      })
      .finally(() => setSalaryLoading(false));
  }, [employee?.id]);

  // When employee is loaded (e.g. from getById after approval), sync academic/previous employment/family from API
  useEffect(() => {
    const emp = employee as { id?: string; academicQualifications?: unknown[]; previousEmployments?: unknown[]; familyMembers?: unknown[] } | null | undefined;
    if (!emp?.id) return;

    const ensureId = (item: Record<string, unknown>) =>
      typeof (item as { id?: unknown }).id === 'string' ? (item as { id: string }).id : (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `gen-${Date.now()}-${Math.random().toString(36).slice(2)}`);

    const rawAcademic = Array.isArray(emp.academicQualifications) ? emp.academicQualifications : [];
    setAcademicQualifications(rawAcademic.map((q: unknown) => {
      const row = (q && typeof q === 'object' ? q : {}) as Record<string, unknown>;
      return {
        id: ensureId(row),
        degree: typeof row.degree === 'string' ? row.degree : '',
        discipline: typeof row.discipline === 'string' ? row.discipline : '',
        university: typeof row.university === 'string' ? row.university : '',
        grade: typeof row.grade === 'string' ? row.grade : '',
        percentage: typeof row.percentage === 'string' ? row.percentage : '',
        yearOfPassing: typeof row.yearOfPassing === 'string' ? row.yearOfPassing : '',
        nameOfInstitution: typeof row.nameOfInstitution === 'string' ? row.nameOfInstitution : '',
        remarks: typeof row.remarks === 'string' ? row.remarks : '',
      };
    }));

    const rawPrev = Array.isArray(emp.previousEmployments) ? emp.previousEmployments : [];
    setPreviousEmployments(rawPrev.map((e: unknown) => {
      const row = (e && typeof e === 'object' ? e : {}) as Record<string, unknown>;
      return {
        id: ensureId(row),
        organization: typeof row.organization === 'string' ? row.organization : '',
        designation: typeof row.designation === 'string' ? row.designation : '',
        fromDate: typeof row.fromDate === 'string' ? row.fromDate : '',
        toDate: typeof row.toDate === 'string' ? row.toDate : '',
        yearsOfExperience: typeof (row.yearsOfExperience ?? row.relevantExperience) === 'string' ? String(row.yearsOfExperience ?? row.relevantExperience ?? '') : '',
        relevantExperience: typeof row.relevantExperience === 'string' ? row.relevantExperience : '',
        remarks: typeof row.remarks === 'string' ? row.remarks : '',
        ctc: typeof row.ctc === 'string' ? row.ctc : '',
      };
    }));

    const rawFamily = Array.isArray(emp.familyMembers) ? emp.familyMembers : [];
    setFamilyMembers(rawFamily.map((m: unknown) => {
      const row = (m && typeof m === 'object' ? m : {}) as Record<string, unknown>;
      const phone = row.phoneNumber ?? row.phone ?? '';
      return {
        id: ensureId(row),
        firstName: typeof row.firstName === 'string' ? row.firstName : '',
        lastName: typeof row.lastName === 'string' ? row.lastName : '',
        relationship: typeof row.relationship === 'string' ? row.relationship : '',
        dateOfBirth: typeof row.dateOfBirth === 'string' ? row.dateOfBirth : '',
        phoneNumber: typeof phone === 'string' ? phone : '',
        occupation: typeof row.occupation === 'string' ? row.occupation : '',
        address: typeof row.address === 'string' ? row.address : '',
        aadhaarNumber: typeof row.aadhaarNumber === 'string' ? row.aadhaarNumber : '',
        passportNumber: typeof row.passportNumber === 'string' ? row.passportNumber : '',
        passportIssueDate: typeof row.passportIssueDate === 'string' ? row.passportIssueDate : '',
        passportExpiryDate: typeof row.passportExpiryDate === 'string' ? row.passportExpiryDate : '',
        pfShare: typeof row.pfShare === 'string' ? row.pfShare : '',
        gratuityShare: typeof row.gratuityShare === 'string' ? row.gratuityShare : '',
        nominationRemarks: typeof row.nominationRemarks === 'string' ? row.nominationRemarks : '',
      };
    }));
  }, [employee?.id, (employee as any)?.academicQualifications, (employee as any)?.previousEmployments, (employee as any)?.familyMembers]);

  // Fetch potential managers (all active employees in the organization)
  const fetchManagersForDropdown = async () => {
    try {
      const response = await employeeService.getAll({
        organizationId,
        employeeStatus: 'ACTIVE',
        limit: 1000, // Get all active employees
      });
      
      // Filter out the current employee if editing
      const allEmployees = response.employees || [];
      const filteredManagers = employee 
        ? allEmployees.filter(emp => emp.id !== employee.id && emp.employeeStatus === 'ACTIVE')
        : allEmployees.filter(emp => emp.employeeStatus === 'ACTIVE');
      
      setAvailableManagers(filteredManagers);
      console.log('Fetched managers for dropdown:', filteredManagers.length);
    } catch (error) {
      console.error('Failed to fetch employees for managers dropdown:', error);
      setAvailableManagers([]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    if (isViewMode) return;
    if (editableTabs != null && editableTabs.length > 0 && !editableTabs.includes(currentTab)) return;
    const { name, value } = e.target;
    const updates: Record<string, string> = { [name]: value };
    // When entity changes, clear location so user picks from entity-scoped list
    if (name === 'entityId') updates.locationId = '';
    // Sync Personal Info fields used for validation/submit
    if (name === 'personalEmail') updates.email = value;
    if (name === 'permanentPhoneNumber') updates.phoneNumber = value;
    setFormData(prev => ({ ...prev, ...updates }));

    // Clear error for this field (and synced fields) and any global submit error
    const keysToClear = [name, 'submit'];
    if (name === 'personalEmail') keysToClear.push('email');
    if (name === 'permanentPhoneNumber') keysToClear.push('phoneNumber');
    setErrors(prev => {
      const newErrors = { ...prev };
      keysToClear.forEach(k => delete newErrors[k]);
      return newErrors;
    });
  };

  const validateCompany = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.firstName?.trim()) newErrors.firstName = 'First name is required';
    if (!formData.dateOfBirth?.trim()) newErrors.dateOfBirth = 'Date of birth is required';
    if (!formData.gender) newErrors.gender = 'Gender is required';
    if (!formData.joiningDate?.trim()) newErrors.joiningDate = 'Date of joining is required';
    if (!formData.placeOfTaxDeduction?.trim()) {
      newErrors.placeOfTaxDeduction = 'Place of Tax Deduction is required';
    }
    if (!formData.departmentId?.trim()) newErrors.departmentId = 'Department is required';
    if (!formData.positionId?.trim()) newErrors.positionId = 'Designation is required';
    setErrors(prev => ({ ...prev, ...newErrors }));
    return Object.keys(newErrors).length === 0;
  };

  const validatePersonal = () => {
    const newErrors: Record<string, string> = {};
    const emailVal = formData.email?.trim() || formData.personalEmail?.trim() || '';
    const phoneVal = formData.phoneNumber?.trim() || formData.permanentPhoneNumber?.trim() || '';

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }

    if (!emailVal) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
      newErrors.email = 'Invalid email format';
    }

    if (!phoneVal) {
      newErrors.phoneNumber = 'Phone number is required';
    }

    if (!formData.dateOfBirth) {
      newErrors.dateOfBirth = 'Date of birth is required';
    }

    if (!formData.gender) {
      newErrors.gender = 'Gender is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (currentTab === 'company' && validateCompany()) {
      setCurrentTab('personal');
    } else if (currentTab === 'personal' && validatePersonal()) {
      setCurrentTab('statutory');
    } else if (currentTab === 'statutory') {
      setCurrentTab('bank');
    } else if (currentTab === 'bank') {
      setCurrentTab('salary');
    } else if (currentTab === 'salary') {
      setCurrentTab('assets');
    } else if (currentTab === 'assets') {
      setCurrentTab('academic');
    } else if (currentTab === 'academic') {
      setCurrentTab('previousEmployment');
    } else if (currentTab === 'previousEmployment') {
      setCurrentTab('family');
    } else if (currentTab === 'family') {
      setCurrentTab('others');
    } else if (currentTab === 'others') {
      setCurrentTab('newFields');
    } else if (currentTab === 'newFields') {
      if (employee?.id) {
        setCurrentTab('esop');
      }
    }
  };

  const handleBack = () => {
    if (currentTab === 'esop') setCurrentTab('newFields');
    else if (currentTab === 'newFields') setCurrentTab('others');
    else if (currentTab === 'others') setCurrentTab('family');
    else if (currentTab === 'family') setCurrentTab('previousEmployment');
    else if (currentTab === 'previousEmployment') setCurrentTab('academic');
    else if (currentTab === 'academic') setCurrentTab('assets');
    else if (currentTab === 'assets') setCurrentTab('salary');
    else if (currentTab === 'salary') setCurrentTab('bank');
    else if (currentTab === 'bank') setCurrentTab('statutory');
    else if (currentTab === 'statutory') setCurrentTab('personal');
    else if (currentTab === 'personal') setCurrentTab('company');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[EmployeeForm] handleSubmit CALLED — mode:', employee ? 'update' : 'create', 'rejoinMode:', rejoinMode);

    // Rejoin flow: create new employee from this (previous) record; only joining date + new login email used
    if (rejoinMode && employee) {
      const err: { joiningDate?: string; newLoginEmail?: string } = {};
      if (!formData.joiningDate?.trim()) err.joiningDate = 'Date of Joining is required';
      if (!rejoinNewEmail?.trim()) err.newLoginEmail = 'New Login Email is required';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rejoinNewEmail.trim())) err.newLoginEmail = 'Enter a valid email';
      setRejoinErrors(err);
      if (Object.keys(err).length > 0) {
        setCurrentTab('company');
        return;
      }
      setRejoinSubmitting(true);
      try {
        const result = await employeeService.rejoin({
          previousEmployeeId: employee.id,
          newJoiningDate: formData.joiningDate!.trim(),
          newLoginEmail: rejoinNewEmail.trim(),
        });
        if (result.temporaryPassword) {
          setTemporaryPassword(result.temporaryPassword);
          setCreatedEmployeeEmail(rejoinNewEmail.trim());
          setShowPasswordModal(true);
        } else {
          onSuccess?.();
        }
      } catch (error: any) {
        const msg = error.response?.data?.message || error.message || 'Rejoin failed';
        setRejoinErrors({ newLoginEmail: msg });
        setCurrentTab('company');
      } finally {
        setRejoinSubmitting(false);
      }
      return;
    }

    if (!validatePersonal()) {
      console.warn('[EmployeeForm] validatePersonal() FAILED — switching to personal tab. Errors:', errors);
      setCurrentTab('personal');
      return;
    }
    console.log('[EmployeeForm] Validation passed — building submitData...');

    try {
      // Helper function to convert empty strings to undefined
      const emptyToUndefined = (value: string | undefined) => {
        return value && value.trim() ? value.trim() : undefined;
      };

      // Build address object only if at least one field is filled
      const addressFields: any = {};
      const streetValue = emptyToUndefined(
        formData.addressLine1 
          ? formData.addressLine1 + (formData.addressLine2 ? ', ' + formData.addressLine2 : '')
          : undefined
      );
      if (streetValue) addressFields.street = streetValue;
      if (emptyToUndefined(formData.city)) addressFields.city = emptyToUndefined(formData.city);
      if (emptyToUndefined(formData.state)) addressFields.state = emptyToUndefined(formData.state);
      if (emptyToUndefined(formData.postalCode)) addressFields.postalCode = emptyToUndefined(formData.postalCode);
      if (emptyToUndefined(formData.country)) addressFields.country = emptyToUndefined(formData.country);
      
      const hasAddress = Object.keys(addressFields).length > 0;
      
      // Build emergency contacts only if all required fields are filled
      const emergencyContactName = emptyToUndefined(formData.emergencyContactName);
      const emergencyContactRelationship = emptyToUndefined(formData.emergencyContactRelationship);
      const emergencyContactPhone = emptyToUndefined(formData.emergencyContactPhone);
      const hasCompleteEmergencyContact = emergencyContactName && emergencyContactRelationship && emergencyContactPhone;

      const submitData: any = {
        organizationId,
        firstName: formData.firstName.trim(),
        middleName: emptyToUndefined(formData.middleName),
        lastName: formData.lastName.trim() || '',
        email: employee ? emptyToUndefined((formData.email || formData.personalEmail || '').trim()) : (formData.email || formData.personalEmail || '').trim(),
        phone: emptyToUndefined(formData.phoneNumber || formData.permanentPhoneNumber),
        officialEmail: emptyToUndefined(formData.officialEmail) || null,
        officialMobile: emptyToUndefined(formData.officialMobile) || null,
        dateOfBirth: emptyToUndefined(formData.dateOfBirth),
        gender: formData.gender ? (formData.gender as Gender) : undefined,
        maritalStatus: formData.maritalStatus ? (formData.maritalStatus as MaritalStatus) : undefined,
        departmentId: (() => {
          const val = formData.departmentId?.trim();
          if (!val) return null;
          // config_ prefix means it's a Configurator-only department, not a valid HRMS UUID
          if (val.startsWith('config_')) return null;
          return val;
        })(),
        positionId: formData.positionId && formData.positionId.trim() ? formData.positionId : null,
        reportingManagerId: formData.managerId && formData.managerId.trim() ? formData.managerId : null,
        entityId: formData.entityId && formData.entityId.trim() ? formData.entityId : null,
        locationId: formData.locationId && formData.locationId.trim() ? formData.locationId : null,
        costCentreId: (() => {
          const text = formData.costCentre?.trim();
          if (!text) return null;
          const match = costCentres.find((c) => c.name?.toLowerCase() === text.toLowerCase() || (c.code && c.code.toLowerCase() === text.toLowerCase()));
          return match ? match.id : null;
        })(),
        grade: emptyToUndefined(formData.grade) || null,
        placeOfTaxDeduction: formData.placeOfTaxDeduction ? (formData.placeOfTaxDeduction as 'METRO' | 'NON_METRO') : null,
        jobResponsibility: emptyToUndefined(formData.jobResponsibility) || null,
        dateOfJoining: formData.joiningDate?.trim() || new Date().toISOString().split('T')[0],
        employeeStatus: formData.employeeStatus as EmployeeStatus,
        personalEmail: emptyToUndefined(formData.personalEmail) || null,
        address: (() => {
          const fromPermanent = formData.permanentAddress || formData.permanentCity || formData.permanentState || formData.permanentPincode || formData.permanentDistrict;
          const fromPresent = formData.presentAddress || formData.presentCity || formData.presentState || formData.presentPincode || formData.presentDistrict;
          const base = fromPermanent ? {
            street: emptyToUndefined(formData.permanentAddress),
            city: emptyToUndefined(formData.permanentCity),
            state: emptyToUndefined(formData.permanentState),
            postalCode: emptyToUndefined(formData.permanentPincode),
          } : (hasAddress ? addressFields : {});
          if (Object.keys(base).length === 0 && !fromPresent) return undefined;
          return {
            ...base,
            sameAsPermanent: formData.sameAsPermanent,
            permanentDistrict: emptyToUndefined(formData.permanentDistrict),
            presentAddress: emptyToUndefined(formData.presentAddress),
            presentCity: emptyToUndefined(formData.presentCity),
            presentDistrict: emptyToUndefined(formData.presentDistrict),
            presentState: emptyToUndefined(formData.presentState),
            presentPincode: emptyToUndefined(formData.presentPincode),
            presentPhoneNumber: emptyToUndefined(formData.presentPhoneNumber),
          };
        })(),
        emergencyContacts: hasCompleteEmergencyContact ? [{
          name: emergencyContactName!,
          relationship: emergencyContactRelationship!,
          phone: emergencyContactPhone!,
        }] : undefined,
        bankDetails: (formData.bankName || formData.bankAccountNumber || formData.bankIfscCode)
          ? {
              bankName: emptyToUndefined(formData.bankName),
              accountNumber: emptyToUndefined(formData.bankAccountNumber),
              ifscCode: emptyToUndefined(formData.bankIfscCode),
            }
          : undefined,
        taxInformation: (() => {
          const fromForm: Record<string, string | undefined> = {
            pfNumber: emptyToUndefined(formData.pfNumber),
            uanNumber: emptyToUndefined(formData.uanNumber),
            panNumber: emptyToUndefined(formData.panNumber),
            aadhaarNumber: emptyToUndefined(formData.aadhaarNumber),
            esiNumber: emptyToUndefined(formData.esiNumber),
            ptaxLocation: emptyToUndefined(formData.pTaxLocation),
            taxRegime: emptyToUndefined(formData.taxRegime),
            esiDispensary: emptyToUndefined(formData.esiDispensary),
          };
          const hasAny = Object.values(fromForm).some((v) => v != null && v !== '');
          if (!hasAny) return undefined;
          const existing = (employee as any)?.taxInformation && typeof (employee as any).taxInformation === 'object' ? (employee as any).taxInformation : {};
          const merged = { ...existing };
          Object.entries(fromForm).forEach(([k, v]) => { merged[k] = v ?? ''; });
          return merged;
        })(),
        profileExtensions: (() => {
          const fromForm: Record<string, string> = {};
          if (formData.bloodGroup?.trim()) fromForm.bloodGroup = formData.bloodGroup.trim();
          if (formData.lwfLocation?.trim()) fromForm.lwfLocation = formData.lwfLocation.trim();
          if (formData.noticePeriodDays?.trim()) fromForm.associateNoticePeriodDays = formData.noticePeriodDays.trim();
          if (formData.passportNumber?.trim()) fromForm.passportNumber = formData.passportNumber.trim();
          if (formData.drivingLicenseNumber?.trim()) fromForm.drivingLicenseNumber = formData.drivingLicenseNumber.trim();
          if (formData.subDepartment?.trim() || employee) fromForm.subDepartment = formData.subDepartment?.trim() ?? '';
          if (formData.alternateSaturdayOff?.trim() || employee) fromForm.alternateSaturdayOff = formData.alternateSaturdayOff?.trim() ?? '';
          if (formData.compoffApplicable?.trim() || employee) fromForm.compoffApplicable = formData.compoffApplicable?.trim() ?? '';
          if (Object.keys(fromForm).length === 0) return undefined;
          const existing = (employee as any)?.profileExtensions && typeof (employee as any).profileExtensions === 'object' ? (employee as any).profileExtensions : {};
          return { ...existing, ...fromForm };
        })(),
        faceEncoding: (formData as any).face_encoding?.length === 128 ? (formData as any).face_encoding : undefined,
      };
      // Attach configurator IDs for backend storage
      if (selectedConfigCostCentreId) submitData.costCentreConfiguratorId = selectedConfigCostCentreId;
      if (selectedConfigDepartmentId) submitData.departmentConfiguratorId = selectedConfigDepartmentId;
      if (selectedConfigSubDepartmentId) submitData.subDepartmentConfiguratorId = selectedConfigSubDepartmentId;
      if (selectedUserRoleId) submitData.configuratorRoleId = selectedUserRoleId;
      const companyId = Number(localStorage.getItem('configuratorCompanyId')) || undefined;
      if (companyId) submitData.configuratorCompanyId = companyId;

      console.log('[EmployeeForm] submitData:', JSON.stringify(submitData, null, 2));

      if (initialPaygroupId) {
        submitData.paygroupId = initialPaygroupId;
      }

      // When restricted to personal (+ academic/family/previousEmployment) tabs (e.g. EMPLOYEE self-edit), send only allowed fields
      if (employee && editableTabs && editableTabs.length > 0 && editableTabs.includes('personal') && !editableTabs.includes('newFields')) {
        const allowedKeys = new Set([
          'organizationId', 'firstName', 'middleName', 'lastName', 'email', 'phone', 'dateOfBirth', 'gender',
          'maritalStatus', 'personalEmail', 'address', 'emergencyContacts', 'officialEmail', 'officialMobile', 'placeOfTaxDeduction',
          'dateOfJoining', // required by backend; keep so submit is not blocked
        ]);
        Object.keys(submitData).forEach(key => {
          if (!allowedKeys.has(key)) delete submitData[key];
        });
      }

      // Remove undefined values for optional fields only (keep required fields even if undefined for validation)
      const requiredFields = ['organizationId', 'firstName', 'email', 'dateOfJoining'];
      Object.keys(submitData).forEach(key => {
        if (submitData[key] === undefined && !requiredFields.includes(key)) {
          delete submitData[key];
        }
      });
      
      // Ensure dateOfJoining is set (we default to today above; this is a safety check)
      if (!submitData.dateOfJoining) {
        setErrors({ joiningDate: 'Joining date is required', submit: 'Please fix the errors below.' });
        setCurrentTab(initialPaygroupId ? 'company' : 'personal');
        return;
      }

      // MANAGER/EMPLOYEE self-edit: always submit via change request for HR approval (so HR sees it on approval page)
      const isEmployeeSelfEdit = employee && editableTabs && editableTabs.length > 0;
      if (isEmployeeSelfEdit) {
        setSubmittingApproval(true);
        try {
          const emp = employee as any;
          const existingData: Record<string, unknown> = {};
          Object.keys(submitData).forEach((key) => {
            if (key === 'address' && emp?.address) existingData[key] = typeof emp.address === 'object' ? emp.address : undefined;
            else if (key === 'emergencyContacts' && emp?.emergencyContacts) existingData[key] = emp.emergencyContacts;
            else if (key === 'bankDetails' && emp?.bankDetails) existingData[key] = emp.bankDetails;
            else if (key in emp) existingData[key] = emp[key];
          });
          // Include academic, previous employment, and family so approval screen shows them
          existingData.academicQualifications = emp?.academicQualifications ?? [];
          existingData.previousEmployments = emp?.previousEmployments ?? [];
          existingData.familyMembers = emp?.familyMembers ?? [];
          const requestedData: Record<string, unknown> = { ...submitData };
          requestedData.academicQualifications = academicQualifications;
          requestedData.previousEmployments = previousEmployments;
          requestedData.familyMembers = familyMembers;
          await employeeChangeRequestService.submit({
            employeeId: employee.id,
            organizationId,
            existingData,
            requestedData,
          });
          setApprovalSubmitted(true);
        } finally {
          setSubmittingApproval(false);
        }
        return;
      }

      if (employee) {
        // ── 1st API: Update Configurator user (PUT /api/v1/users/) ──
        const configUserId = (employee as any).configuratorUserId;
        const hasConfigToken = !!localStorage.getItem('configuratorAccessToken');
        const companyId = Number(localStorage.getItem('configuratorCompanyId')) || 0;
        const projectId = Number(localStorage.getItem('configuratorProjectId')) || 0;

        if (configUserId && hasConfigToken) {
          const configuratorPayload = {
            user_id: configUserId,
            first_name: formData.firstName?.trim() || null,
            last_name: formData.lastName?.trim() || null,
            email: (formData.email || formData.personalEmail || '').trim() || null,
            phone: formData.phoneNumber || formData.permanentPhoneNumber || null,
            company_id: companyId || null,
            project_id: projectId || null,
            role_id: selectedUserRoleId || null,
            department_id: selectedConfigDepartmentId || null,
            sub_department_id: selectedConfigSubDepartmentId || null,
            cost_centre_id: selectedConfigCostCentreId || null,
          };
          console.log('[EmployeeForm] 1st API: PUT /api/v1/users/ payload:', configuratorPayload);
          const configResponse = await configuratorDataService.updateConfiguratorUser(configuratorPayload);
          console.log('[EmployeeForm] 1st API: PUT /api/v1/users/ response:', configResponse);
        }

        // ── 2nd API: Update HRMS employee (PUT /api/v1/employees/{id}) ──
        console.log('[EmployeeForm] 2nd API: PUT /api/v1/employees/' + employee.id, 'payload:', submitData);
        await updateEmployee(employee.id, submitData);
        console.log('[EmployeeForm] 2nd API: HRMS employee updated successfully');

        // Persist Salary Details > Earnings (Fixed Gross) when user has entered values
        const grossToSave = salaryFixedGross + salaryVehicleAllowances;
        if (grossToSave >= 0) {
          try {
            const current = await employeeSalaryService.getCurrentSalary(employee.id);
            await employeeSalaryService.updateSalary(current.id, {
              grossSalary: grossToSave,
              components: current.components && typeof current.components === 'object'
                ? { ...current.components, 'Vehicle Allowances': salaryVehicleAllowances }
                : { 'Fixed Gross': salaryFixedGross, 'Vehicle Allowances': salaryVehicleAllowances },
            });
          } catch (e: unknown) {
            const status = (e as { response?: { status?: number } })?.response?.status;
            if (status === 404 || (e as Error)?.message?.includes?.('No active salary')) {
              // No existing salary: create one
              const today = new Date().toISOString().split('T')[0];
              await employeeSalaryService.createSalary({
                employeeId: employee.id,
                effectiveDate: today,
                basicSalary: Math.round(grossToSave * 0.4),
                grossSalary: grossToSave,
                netSalary: Math.round(grossToSave * 0.75),
                paymentFrequency: 'MONTHLY',
                currency: 'INR',
                components: { 'Fixed Gross': salaryFixedGross, 'Vehicle Allowances': salaryVehicleAllowances },
              });
            } else {
              throw e;
            }
          }
        }
        onSuccess?.();
      } else {
        // Store selected User Role ID in HRMS DB
        if (selectedUserRoleId) {
          submitData.configuratorRoleId = selectedUserRoleId;
        }

        // Step 1: Create Configurator user FIRST so we get the real user_id
        const empEmail = (formData.email || formData.personalEmail || '').trim();
        const tempPassword = `Temp@${Math.random().toString(36).slice(-8)}`;
        const companyId = Number(localStorage.getItem('configuratorCompanyId')) || 0;
        const projectId = Number(localStorage.getItem('configuratorProjectId')) || 0;
        const hasConfigToken = !!localStorage.getItem('configuratorAccessToken');

        const configuratorPayload = {
          first_name: formData.firstName.trim(),
          last_name: formData.lastName.trim() || '',
          email: empEmail,
          phone: formData.phoneNumber || formData.permanentPhoneNumber || '',
          password: tempPassword,
          company_id: companyId,
          project_id: projectId,
          role_id: selectedUserRoleId || userRoleOptions[0]?.id || 0,
          cost_centre_id: selectedConfigCostCentreId || null,
          department_id: selectedConfigDepartmentId || null,
          sub_department_id: selectedConfigSubDepartmentId || null,
        };
        console.log('[EmployeeForm] Configurator Payload:', JSON.stringify(configuratorPayload, null, 2));
        console.log('[EmployeeForm] hasConfigToken:', hasConfigToken, 'companyId:', companyId, 'projectId:', projectId);

        let configuratorFailed = false;
        if (hasConfigToken && companyId > 0) {
          try {
            const configUser = await configuratorDataService.createConfiguratorUser(configuratorPayload);
            console.log('[EmployeeForm] Configurator API raw response:', JSON.stringify(configUser));
            // Extract fields from API response
            const responseData = configUser?.data ?? configUser;
            const realConfigUserId = responseData?.user_id ?? responseData?.id ?? configUser?.user_id ?? configUser?.id;
            if (realConfigUserId) {
              submitData.configuratorUserId = Number(realConfigUserId);
            }
            // Extract department, cost_centre, sub_department IDs from response (fallback to request payload)
            const respDeptId = responseData?.department?.id ?? responseData?.department_id ?? configuratorPayload.department_id;
            const respCCId = responseData?.cost_centre?.id ?? responseData?.cost_centre_id ?? configuratorPayload.cost_centre_id;
            const respSubDeptId = responseData?.sub_department?.id ?? responseData?.sub_department_id ?? configuratorPayload.sub_department_id;
            if (respDeptId) submitData.departmentConfiguratorId = Number(respDeptId);
            if (respCCId) submitData.costCentreConfiguratorId = Number(respCCId);
            if (respSubDeptId) submitData.subDepartmentConfiguratorId = Number(respSubDeptId);
            // Always store company_id from the payload
            if (companyId > 0) submitData.configuratorCompanyId = companyId;
            console.log('[EmployeeForm] Configurator user created, id:', realConfigUserId,
              'deptId:', respDeptId, 'ccId:', respCCId, 'subDeptId:', respSubDeptId, 'companyId:', companyId);
          } catch (err: any) {
            configuratorFailed = true;
            const detail = err?.response?.data?.detail || err?.response?.data?.message || err?.message || 'Unknown error';
            console.error('[EmployeeForm] Configurator user creation failed:', err?.response?.status, detail, err?.response?.data);
            // Don't block HRMS creation — just log the warning
          }
        } else {
          console.warn('[EmployeeForm] Skipping frontend Configurator call — hasConfigToken:', hasConfigToken, 'companyId:', companyId, '. Backend will handle.');
        }

        console.log('[EmployeeForm] Creating employee — HRMS submitData:', JSON.stringify({
          email: submitData.email,
          firstName: submitData.firstName,
          configuratorUserId: submitData.configuratorUserId,
          configuratorRoleId: submitData.configuratorRoleId,
          departmentId: submitData.departmentId,
          costCentreConfiguratorId: submitData.costCentreConfiguratorId,
          departmentConfiguratorId: submitData.departmentConfiguratorId,
          subDepartmentConfiguratorId: submitData.subDepartmentConfiguratorId,
        }, null, 2));

        // Step 2: Create employee in HRMS (backend will also try Configurator user creation as fallback)
        const result = await createEmployee(submitData);

        // Show temporary password modal if it was generated
        if (result.temporaryPassword) {
          setTemporaryPassword(result.temporaryPassword);
          setCreatedEmployeeEmail(empEmail);
          setShowPasswordModal(true);
          if (configuratorFailed && !submitData.configuratorUserId) {
            console.warn('[EmployeeForm] WARNING: Configurator user may not have been created. Check backend logs.');
          }
        } else {
          onSuccess?.();
        }
      }
    } catch (error: any) {
      console.error('Error creating employee:', error);
      
      // Handle validation errors from backend
      if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
        const validationErrors: Record<string, string> = {};
        error.response.data.errors.forEach((err: { field: string; message: string }) => {
          const fieldMap: Record<string, string> = {
            'dateOfJoining': 'joiningDate',
            'phoneNumber': 'phoneNumber',
            'dateOfBirth': 'dateOfBirth',
            'lastName': 'lastName',
          };
          const formField = fieldMap[err.field] || err.field;
          validationErrors[formField] = err.message;
        });
        if (Object.keys(validationErrors).length > 0) {
          setErrors({ ...validationErrors, submit: 'Please fix the errors below.' });
          const hasCompanyError = !!(validationErrors.joiningDate || validationErrors.departmentId || validationErrors.positionId);
          const hasPersonalError = !!(validationErrors.firstName || validationErrors.email || validationErrors.phoneNumber);
          if (initialPaygroupId && hasCompanyError) setCurrentTab('company');
          else if (hasPersonalError) setCurrentTab('personal');
          return;
        }
      }
      
      // Fallback to generic error message
      const errorMessage = error.response?.data?.message || error.message || 'Failed to save employee';
      setErrors({ submit: errorMessage });
    }
  };

  return (
    <>
    <form onSubmit={handleSubmit} className="space-y-6 w-full max-w-full min-w-0 h-full">
      {/* Rejoin banner: full form is shown; on Save a new employee record will be created */}
      {rejoinMode && employee && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-medium">Employee Rejoin</p>
          <p className="mt-1">
            Editing this form and saving will create a <strong>new</strong> employee record with a new employee code. The previous record ({employee.employeeCode}) remains unchanged. Set <strong>Date of Joining</strong> and <strong>New Login Email</strong> below, then click the button below to rejoin.
          </p>
        </div>
      )}

      {/* Layout: Vertical tab menu on the left, content on the right */}
      <div className="flex gap-6 h-full min-w-0">
        {/* Tab Navigation - vertical menu */}
        <div className="w-56 flex-shrink-0">
          <nav className="flex flex-col space-y-2 bg-white rounded-lg border border-gray-200 p-3">
          <button
            type="button"
            onClick={() => setCurrentTab('company')}
            className={`${
              currentTab === 'company'
                ? 'bg-blue-50 text-blue-600 border-blue-500'
                : 'bg-white text-gray-600 border-transparent hover:bg-gray-50 hover:text-gray-800'
            } w-full text-left px-3 py-2 rounded-md border text-sm font-medium`}
          >
            Company Details
          </button>
          <button
            type="button"
            onClick={() => setCurrentTab('personal')}
            className={`${
              currentTab === 'personal'
                ? 'bg-blue-50 text-blue-600 border-blue-500'
                : 'bg-white text-gray-600 border-transparent hover:bg-gray-50 hover:text-gray-800'
            } w-full text-left px-3 py-2 rounded-md border text-sm font-medium`}
          >
            Personal Info
          </button>
          <button
            type="button"
            onClick={() => setCurrentTab('statutory')}
            className={`${
              currentTab === 'statutory'
                ? 'bg-blue-50 text-blue-600 border-blue-500'
                : 'bg-white text-gray-600 border-transparent hover:bg-gray-50 hover:text-gray-800'
            } w-full text-left px-3 py-2 rounded-md border text-sm font-medium`}
          >
            Statutory Details
          </button>
          <button
            type="button"
            onClick={() => setCurrentTab('bank')}
            className={`${
              currentTab === 'bank'
                ? 'bg-blue-50 text-blue-600 border-blue-500'
                : 'bg-white text-gray-600 border-transparent hover:bg-gray-50 hover:text-gray-800'
            } w-full text-left px-3 py-2 rounded-md border text-sm font-medium`}
          >
            Bank Details
          </button>
          <button
            type="button"
            onClick={() => setCurrentTab('salary')}
            className={`${
              currentTab === 'salary'
                ? 'bg-blue-50 text-blue-600 border-blue-500'
                : 'bg-white text-gray-600 border-transparent hover:bg-gray-50 hover:text-gray-800'
            } w-full text-left px-3 py-2 rounded-md border text-sm font-medium`}
          >
            Salary Details
          </button>
          <button
            type="button"
            onClick={() => setCurrentTab('assets')}
            className={`${
              currentTab === 'assets'
                ? 'bg-blue-50 text-blue-600 border-blue-500'
                : 'bg-white text-gray-600 border-transparent hover:bg-gray-50 hover:text-gray-800'
            } w-full text-left px-3 py-2 rounded-md border text-sm font-medium`}
          >
            Assets
          </button>
          <button
            type="button"
            onClick={() => setCurrentTab('academic')}
            className={`${
              currentTab === 'academic'
                ? 'bg-blue-50 text-blue-600 border-blue-500'
                : 'bg-white text-gray-600 border-transparent hover:bg-gray-50 hover:text-gray-800'
            } w-full text-left px-3 py-2 rounded-md border text-sm font-medium`}
          >
            Academic Qualification
          </button>
          <button
            type="button"
            onClick={() => setCurrentTab('previousEmployment')}
            className={`${
              currentTab === 'previousEmployment'
                ? 'bg-blue-50 text-blue-600 border-blue-500'
                : 'bg-white text-gray-600 border-transparent hover:bg-gray-50 hover:text-gray-800'
            } w-full text-left px-3 py-2 rounded-md border text-sm font-medium`}
          >
            Previous Employment
          </button>
          <button
            type="button"
            onClick={() => setCurrentTab('family')}
            className={`${
              currentTab === 'family'
                ? 'bg-blue-50 text-blue-600 border-blue-500'
                : 'bg-white text-gray-600 border-transparent hover:bg-gray-50 hover:text-gray-800'
            } w-full text-left px-3 py-2 rounded-md border text-sm font-medium flex items-center gap-2`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Family Details
          </button>
          <button
            type="button"
            onClick={() => setCurrentTab('others')}
            className={`${
              currentTab === 'others'
                ? 'bg-blue-50 text-blue-600 border-blue-500'
                : 'bg-white text-gray-600 border-transparent hover:bg-gray-50 hover:text-gray-800'
            } w-full text-left px-3 py-2 rounded-md border text-sm font-medium flex items-center gap-2`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Others
          </button>
          <button
            type="button"
            onClick={() => setCurrentTab('newFields')}
            className={`${
              currentTab === 'newFields'
                ? 'bg-blue-50 text-blue-600 border-blue-500'
                : 'bg-white text-gray-600 border-transparent hover:bg-gray-50 hover:text-gray-800'
            } w-full text-left px-3 py-2 rounded-md border text-sm font-medium`}
          >
            New Fields
          </button>
          {employee?.id && (
            <button
              type="button"
              onClick={() => setCurrentTab('esop')}
              className={`${
                currentTab === 'esop'
                  ? 'bg-blue-50 text-blue-600 border-blue-500'
                  : 'bg-white text-gray-600 border-transparent hover:bg-gray-50 hover:text-gray-800'
              } w-full text-left px-3 py-2 rounded-md border text-sm font-medium flex items-center gap-2`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              ESOP
            </button>
          )}
        </nav>
      </div>

      {/* Tab Content - full width */}
      <div className="flex-1 min-w-0 space-y-6">

      {/* Company Details Tab */}
      {currentTab === 'company' && (
        <div className="space-y-4">
          {rejoinMode && employee && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">New Login Email <span className="text-red-500">*</span></label>
                <input
                  type="email"
                  value={rejoinNewEmail}
                  onChange={(e) => setRejoinNewEmail(e.target.value)}
                  placeholder="e.g. new.email@company.com (for new employee login)"
                  className={`mt-1 block w-full h-10 bg-white text-black rounded-md border shadow-sm sm:text-sm ${
                    rejoinErrors.newLoginEmail ? 'border-red-500' : 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                  }`}
                />
                {rejoinErrors.newLoginEmail && <p className="mt-1 text-sm text-red-600">{rejoinErrors.newLoginEmail}</p>}
                <p className="mt-1 text-xs text-gray-500">Used for the new employee&apos;s login. Must be unique.</p>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Paygroup</label>
              <input
                type="text"
                value={formData.paygroupDisplay || ''}
                readOnly
                placeholder="Select paygroup when creating employee"
                className="mt-1 block w-full h-10 bg-gray-100 rounded-md border border-gray-300 text-gray-700 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">First Name <span className="text-red-500">*</span></label>
              <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} placeholder="First Name"
                className={`mt-1 block w-full h-10 bg-white text-black rounded-md border shadow-sm sm:text-sm ${
                  errors.firstName
                    ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500'
                    : 'border-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                }`} />
              {errors.firstName && <p className="mt-1 text-sm text-red-600">{errors.firstName}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Middle Name</label>
              <input type="text" name="middleName" value={formData.middleName} onChange={handleChange} placeholder="Middle Name"
                className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Last Name</label>
              <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} placeholder="Last Name"
                className={`mt-1 block w-full h-10 bg-white text-black rounded-md border shadow-sm sm:text-sm ${
                  errors.lastName
                    ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500'
                    : 'border-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                }`} />
              {errors.lastName && <p className="mt-1 text-sm text-red-600">{errors.lastName}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Date Of Birth <span className="text-red-500">*</span>
              </label>
              <div
                className={`relative mt-1 h-10 rounded-md bg-white shadow-sm border ${
                  errors.dateOfBirth
                    ? 'border-red-500 focus-within:ring-2 focus-within:ring-red-500 focus-within:border-red-500'
                    : 'border-black focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500'
                }`}
              >
                <input
                  type="date"
                  value={formData.dateOfBirth || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFormData((prev) => ({ ...prev, dateOfBirth: value }));
                    if (errors.dateOfBirth) {
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next.dateOfBirth;
                        return next;
                      });
                    }
                  }}
                  className="block w-full h-full bg-transparent text-black rounded-md border-none outline-none focus:outline-none sm:text-sm pl-3 pr-10"
                />
                <span role="button" tabIndex={0} className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 cursor-pointer hover:text-gray-600" onClick={(e) => { e.preventDefault(); e.stopPropagation(); const input = (e.currentTarget.parentElement as HTMLElement).querySelector('input[type=date]'); if (input && typeof (input as HTMLInputElement).showPicker === 'function') (input as HTMLInputElement).showPicker(); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const input = (e.currentTarget.parentElement as HTMLElement).querySelector('input[type=date]'); if (input && typeof (input as HTMLInputElement).showPicker === 'function') (input as HTMLInputElement).showPicker(); } }}>
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </span>
              </div>
              {errors.dateOfBirth && <p className="mt-1 text-sm text-red-600">{errors.dateOfBirth}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Gender <span className="text-red-500">*</span></label>
              <select name="gender" value={formData.gender} onChange={handleChange}
                className={`mt-1 block w-full h-10 bg-white text-black rounded-md border shadow-sm sm:text-sm ${
                  errors.gender
                    ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500'
                    : 'border-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                }`}>
                <option value="">-- Select --</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
              {errors.gender && <p className="mt-1 text-sm text-red-600">{errors.gender}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Date Of Joining <span className="text-red-500">*</span>
              </label>
              <div
                className={`relative mt-1 h-10 rounded-md bg-white shadow-sm border ${
                  errors.joiningDate
                    ? 'border-red-500 focus-within:ring-2 focus-within:ring-red-500 focus-within:border-red-500'
                    : 'border-black focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500'
                }`}
              >
                <input
                  type="date"
                  value={formData.joiningDate || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFormData((prev) => ({ ...prev, joiningDate: value }));
                    if (errors.joiningDate) {
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next.joiningDate;
                        return next;
                      });
                    }
                  }}
                  className="block w-full h-full bg-transparent text-black rounded-md border-none outline-none focus:outline-none sm:text-sm pl-3 pr-10"
                />
                <span role="button" tabIndex={0} className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 cursor-pointer hover:text-gray-600" onClick={(e) => { e.preventDefault(); e.stopPropagation(); const input = (e.currentTarget.parentElement as HTMLElement).querySelector('input[type=date]'); if (input && typeof (input as HTMLInputElement).showPicker === 'function') (input as HTMLInputElement).showPicker(); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const input = (e.currentTarget.parentElement as HTMLElement).querySelector('input[type=date]'); if (input && typeof (input as HTMLInputElement).showPicker === 'function') (input as HTMLInputElement).showPicker(); } }}>
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </span>
              </div>
              {errors.joiningDate && <p className="mt-1 text-sm text-red-600">{errors.joiningDate}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Marital Status</label>
              <select
                name="maritalStatus"
                value={formData.maritalStatus}
                onChange={handleChange}
                className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value="">Select</option>
                <option value="SINGLE">Single</option>
                <option value="MARRIED">Married</option>
                <option value="DIVORCED">Divorced</option>
                <option value="WIDOWED">Widowed</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Official Email</label>
              <input
                type="email"
                name="officialEmail"
                value={formData.officialEmail}
                onChange={handleChange}
                placeholder="Official Email"
                className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Official Mobile</label>
              <input
                type="tel"
                name="officialMobile"
                value={formData.officialMobile}
                onChange={handleChange}
                placeholder="Official Mobile"
                className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Place of Tax Deduction <span className="text-red-500">*</span>
              </label>
              <select
                name="placeOfTaxDeduction"
                value={formData.placeOfTaxDeduction}
                onChange={handleChange}
                className={`mt-1 block w-full h-10 bg-white text-black rounded-md border shadow-sm sm:text-sm ${
                  errors.placeOfTaxDeduction
                    ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500'
                    : 'border-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                }`}
              >
                <option value="">-- Select --</option>
                <option value="METRO">Metro</option>
                <option value="NON_METRO">Non-Metro</option>
              </select>
              {errors.placeOfTaxDeduction && (
                <p className="mt-1 text-sm text-red-600">{errors.placeOfTaxDeduction}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* 1️⃣ Cost Centre (first in cascading order) */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Cost Centre</label>
              <div className="flex gap-2">
                <SearchableSelect
                  name="costCentre"
                  value={formData.costCentre}
                  placeholder="Cost Centre"
                  options={costCentreOptions.map((name) => ({ value: name, label: name }))}
                  onChange={(val) => {
                    // Simulate native event for handleChange
                    const syntheticEvent = { target: { name: 'costCentre', value: val } } as React.ChangeEvent<HTMLSelectElement>;
                    handleChange(syntheticEvent);
                    // Cascading: clear Department and Sub-Department when Cost Centre changes
                    setFormData((prev) => ({ ...prev, costCentre: val, departmentId: '', subDepartment: '' }));
                    // Resolve and store the Configurator cost centre ID for create calls
                    const ccName = val?.trim()?.toLowerCase();
                    const matchedCC = ccName ? configCostCentres.find(c => c.name.toLowerCase() === ccName) : null;
                    setSelectedConfigCostCentreId(matchedCC?.id ?? null);
                    setSelectedConfigDepartmentId(null);
                    setSelectedConfigSubDepartmentId(null);
                    // Re-fetch departments filtered by the selected cost centre
                    if (matchedCC?.id) {
                      configuratorDataService.getDepartments(matchedCC.id).then((list) => {
                        setConfigDepartments(list.map((d) => ({ id: d.id, name: d.name })));
                      }).catch((err) => {
                        console.warn('Failed to fetch departments for cost centre:', err);
                      });
                    } else {
                      // No cost centre selected — load all departments
                      configuratorDataService.getDepartments().then((list) => {
                        setConfigDepartments(list.map((d) => ({ id: d.id, name: d.name })));
                      }).catch(() => {});
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    setShowCostCentreModal(true);
                    setNewCostCentreName('');
                    setCostCentreError('');
                  }}
                  className="mt-1 px-3 h-10 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center justify-center"
                  title="Add New Cost Centre"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            </div>
            {/* 2️⃣ Department (depends on Cost Centre) */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Department <span className="text-red-500">*</span></label>
              <div className="flex gap-2">
                <SearchableSelect
                  name="departmentId"
                  value={formData.departmentId}
                  placeholder={formData.costCentre?.trim() ? 'Department' : 'Select cost centre first'}
                  disabled={!formData.costCentre?.trim()}
                  options={(() => {
                    const merged: { value: string; label: string }[] = [];
                    const seenNames = new Set<string>();
                    for (const d of localDepartments) {
                      merged.push({ value: d.id, label: d.name });
                      seenNames.add(d.name.toLowerCase());
                    }
                    for (const d of configDepartments) {
                      if (!seenNames.has(d.name.toLowerCase())) {
                        merged.push({ value: `config_${d.id}`, label: d.name });
                        seenNames.add(d.name.toLowerCase());
                      }
                    }
                    return merged;
                  })()}
                  onChange={(val) => {
                    const syntheticEvent = { target: { name: 'departmentId', value: val } } as React.ChangeEvent<HTMLSelectElement>;
                    handleChange(syntheticEvent);
                    // Cascading: clear Sub-Department and Designation when Department changes
                    setFormData((prev) => ({ ...prev, departmentId: val, subDepartment: '', positionId: '' }));
                    // Track configurator department ID for the /api/v1/users/add call
                    if (val.startsWith('config_')) {
                      setSelectedConfigDepartmentId(Number(val.replace('config_', '')));
                    } else {
                      // Local HRMS department — try to match by name in configDepartments
                      const localDept = localDepartments.find((d) => d.id === val);
                      const configMatch = localDept ? configDepartments.find((c) => c.name.toLowerCase() === localDept.name.toLowerCase()) : null;
                      setSelectedConfigDepartmentId(configMatch?.id ?? null);
                    }
                    setSelectedConfigSubDepartmentId(null);
                  }}
                />
                <button
                  type="button"
                  onClick={() => formData.costCentre?.trim() && setShowDepartmentModal(true)}
                  disabled={!formData.costCentre?.trim()}
                  className="mt-1 px-3 h-10 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  title={formData.costCentre?.trim() ? 'Add New Department' : 'Select a cost centre first'}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
              {errors.departmentId && <p className="mt-1 text-sm text-red-600">{errors.departmentId}</p>}
            </div>
            {/* 3️⃣ Sub-Department (depends on Department) */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Sub-Department</label>
              <div className="flex gap-2">
                <SearchableSelect
                  name="subDepartment"
                  value={formData.subDepartment}
                  placeholder={formData.departmentId?.trim() ? 'Sub-Department' : 'Select department first'}
                  disabled={!formData.departmentId?.trim()}
                  options={subDepartmentOptions.map((name) => ({ value: name, label: name }))}
                  onChange={(val) => {
                    const syntheticEvent = { target: { name: 'subDepartment', value: val } } as React.ChangeEvent<HTMLSelectElement>;
                    handleChange(syntheticEvent);
                    // Resolve configurator sub-department ID from name
                    const subName = val?.trim()?.toLowerCase();
                    const configMatch = subName ? configSubDepartments.find((s) => s.name.toLowerCase() === subName) : null;
                    setSelectedConfigSubDepartmentId(configMatch?.id ?? null);
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!formData.departmentId?.trim()) return;
                    setShowSubDepartmentModal(true);
                    setNewSubDepartmentName('');
                    setSubDepartmentError('');
                  }}
                  disabled={!formData.departmentId?.trim()}
                  className="mt-1 px-3 h-10 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  title={formData.departmentId?.trim() ? 'Add New Sub-Department' : 'Select a department first'}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Designation <span className="text-red-500">*</span></label>
              <div className="flex gap-2">
                <select name="positionId" value={formData.positionId} onChange={handleChange}
                  className={`flex-1 mt-1 block w-full h-10 bg-white text-black rounded-md border shadow-sm sm:text-sm ${
                    errors.positionId
                      ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500'
                      : 'border-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                  }`}>
                  <option value="">Designation</option>
                  {positions
                    .filter((p) => !formData.departmentId?.trim() || !p.departmentId || p.departmentId === formData.departmentId)
                    .map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => setShowPositionModal(true)}
                  className="mt-1 px-3 h-10 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center justify-center"
                  title="Add New Designation"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
              {errors.positionId && <p className="mt-1 text-sm text-red-600">{errors.positionId}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Entity</label>
              <div className="flex gap-2">
                <select name="entityId" value={formData.entityId} onChange={handleChange}
                  className="flex-1 mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
                  <option value="">Entity</option>
                  {entities.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => setShowEntityModal(true)}
                  className="mt-1 px-3 h-10 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center justify-center"
                  title="Add New Entity"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Location</label>
              <div className="flex gap-2">
                <select name="locationId" value={formData.locationId} onChange={handleChange}
                  disabled={!formData.entityId?.trim()}
                  className={`flex-1 mt-1 block w-full h-10 bg-white text-black rounded-md border shadow-sm sm:text-sm ${
                    !formData.entityId?.trim() ? 'opacity-60 cursor-not-allowed border-gray-300' : 'border-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                  }`}>
                  <option value="">{formData.entityId?.trim() ? 'Location' : 'Select entity first'}</option>
                  {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => formData.entityId?.trim() && setShowLocationModal(true)}
                  disabled={!formData.entityId?.trim()}
                  className="mt-1 px-3 h-10 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  title={formData.entityId?.trim() ? 'Add New Location' : 'Select an entity first'}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Grade</label>
              <input type="text" name="grade" value={formData.grade} onChange={handleChange} placeholder="Grade"
                className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Reporting Manager</label>
              <select
                name="managerId"
                value={formData.managerId}
                onChange={handleChange}
                className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value="">Reporting Manager</option>
                {availableManagers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.firstName} {m.lastName} ({m.employeeCode})
                  </option>
                ))}
              </select>
            </div>
            {/* User Role dropdown (same pattern as Cost Centre) */}
            <div>
              <label className="block text-sm font-medium text-gray-700">User Role</label>
              <div className="flex gap-2">
                <SearchableSelect
                  name="userRoleId"
                  value={formData.userRoleId}
                  placeholder="Select User Role"
                  options={userRoleOptions.map((r) => ({ value: String(r.id), label: r.name }))}
                  onChange={(val) => {
                    const syntheticEvent = { target: { name: 'userRoleId', value: val } } as React.ChangeEvent<HTMLSelectElement>;
                    handleChange(syntheticEvent);
                    setSelectedUserRoleId(val ? Number(val) : null);
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    setShowUserRoleModal(true);
                    setNewUserRoleName('');
                    setUserRoleError('');
                  }}
                  className="mt-1 px-3 h-10 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center justify-center"
                  title="Add New User Role"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Job Responsibility</label>
            <textarea name="jobResponsibility" value={formData.jobResponsibility} onChange={handleChange} rows={3} placeholder="Job Responsibility"
              className="mt-1 block w-full bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
          </div>
          <div className="border-t pt-4 mt-4">
            <FaceCapture
              existingEncoding={(formData as any).face_encoding?.length === 128 ? (formData as any).face_encoding : null}
              onEncodingCaptured={(encoding) => setFormData((prev) => ({ ...prev, face_encoding: encoding }))}
              onError={setFaceCaptureError}
              disabled={isViewMode}
            />
            {faceCaptureError && <p className="mt-2 text-sm text-red-600">{faceCaptureError}</p>}
          </div>
        </div>
      )}

      {/* Personal Information Tab */}
      {currentTab === 'personal' && (
        <div className={`space-y-6 ${!isTabEditable('personal') ? 'pointer-events-none opacity-75' : ''}`}>
          {/* Permanent Address Section */}
          <div className="bg-gray-50 border rounded-lg p-4 text-left">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Permanent Address</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Address</label>
                <textarea
                  name="permanentAddress"
                  value={formData.permanentAddress}
                  onChange={handleChange}
                  rows={3}
                  className="mt-1 block w-full bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-left"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Personal Email <span className="text-red-500">*</span></label>
                <input
                  type="email"
                  name="personalEmail"
                  value={formData.personalEmail}
                  onChange={handleChange}
                  className={`mt-1 block w-full h-10 bg-white text-black rounded-md border shadow-sm sm:text-sm ${
                    (errors.email || errors.personalEmail)
                      ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500'
                      : 'border-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                  }`}
                />
                {(errors.email || errors.personalEmail) && (
                  <p className="mt-1 text-sm text-red-600">{errors.email || errors.personalEmail}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">City</label>
                <input
                  type="text"
                  name="permanentCity"
                  value={formData.permanentCity}
                  onChange={handleChange}
                  className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">District</label>
                <input
                  type="text"
                  name="permanentDistrict"
                  value={formData.permanentDistrict}
                  onChange={handleChange}
                  className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">State</label>
                <input
                  type="text"
                  name="permanentState"
                  value={formData.permanentState}
                  onChange={handleChange}
                  className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Pincode</label>
                <input
                  type="text"
                  name="permanentPincode"
                  value={formData.permanentPincode}
                  onChange={handleChange}
                  className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Phone Number <span className="text-red-500">*</span></label>
                <input
                  type="tel"
                  name="permanentPhoneNumber"
                  value={formData.permanentPhoneNumber}
                  onChange={handleChange}
                  className={`mt-1 block w-full h-10 bg-white text-black rounded-md border shadow-sm sm:text-sm ${
                    (errors.phoneNumber || errors.permanentPhoneNumber)
                      ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500'
                      : 'border-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                  }`}
                />
                {(errors.phoneNumber || errors.permanentPhoneNumber) && (
                  <p className="mt-1 text-sm text-red-600">{errors.phoneNumber || errors.permanentPhoneNumber}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Personal Mobile</label>
                <input
                  type="tel"
                  name="personalMobile"
                  value={formData.personalMobile}
                  onChange={handleChange}
                  className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>
          </div>

          {/* Present Address Section */}
          <div className="bg-gray-50 border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900">Present Address</h3>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700">Same as permanent</span>
                <button
                  type="button"
                  onClick={() => {
                    const sameAsPermanent = !formData.sameAsPermanent;
                    setFormData(prev => ({
                      ...prev,
                      sameAsPermanent,
                      ...(sameAsPermanent ? {
                        presentAddress: prev.permanentAddress,
                        presentCity: prev.permanentCity,
                        presentDistrict: prev.permanentDistrict,
                        presentState: prev.permanentState,
                        presentPincode: prev.permanentPincode,
                        presentPhoneNumber: prev.permanentPhoneNumber,
                      } : {})
                    }));
                  }}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium border ${
                    formData.sameAsPermanent
                      ? 'bg-green-500 border-green-600 text-white'
                      : 'bg-red-500 border-red-600 text-white'
                  }`}
                >
                  {formData.sameAsPermanent ? 'YES' : 'NO'}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-3">
                <label className="block text-sm font-medium text-gray-700">Address</label>
                <textarea
                  name="presentAddress"
                  value={formData.presentAddress}
                  onChange={handleChange}
                  rows={3}
                  disabled={formData.sameAsPermanent}
                  className={`mt-1 block w-full bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                    formData.sameAsPermanent ? 'bg-gray-100 cursor-not-allowed' : ''
                  }`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">City</label>
                <input
                  type="text"
                  name="presentCity"
                  value={formData.presentCity}
                  onChange={handleChange}
                  disabled={formData.sameAsPermanent}
                  className={`mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                    formData.sameAsPermanent ? 'bg-gray-100 cursor-not-allowed' : ''
                  }`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">District</label>
                <input
                  type="text"
                  name="presentDistrict"
                  value={formData.presentDistrict}
                  onChange={handleChange}
                  disabled={formData.sameAsPermanent}
                  className={`mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                    formData.sameAsPermanent ? 'bg-gray-100 cursor-not-allowed' : ''
                  }`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">State</label>
                <input
                  type="text"
                  name="presentState"
                  value={formData.presentState}
                  onChange={handleChange}
                  disabled={formData.sameAsPermanent}
                  className={`mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                    formData.sameAsPermanent ? 'bg-gray-100 cursor-not-allowed' : ''
                  }`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Pincode</label>
                <input
                  type="text"
                  name="presentPincode"
                  value={formData.presentPincode}
                  onChange={handleChange}
                  disabled={formData.sameAsPermanent}
                  className={`mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                    formData.sameAsPermanent ? 'bg-gray-100 cursor-not-allowed' : ''
                  }`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Phone Number</label>
                <input
                  type="tel"
                  name="presentPhoneNumber"
                  value={formData.presentPhoneNumber}
                  onChange={handleChange}
                  disabled={formData.sameAsPermanent}
                  className={`mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                    formData.sameAsPermanent ? 'bg-gray-100 cursor-not-allowed' : ''
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Others Section */}
          <div className="bg-gray-50 border rounded-lg p-4 text-left">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Others</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Blood Group</label>
                <select
                  name="bloodGroup"
                  value={formData.bloodGroup}
                  onChange={handleChange}
                  className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  <option value="">Blood Group</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Date of Wedding</label>
                <div className="relative mt-1 h-10 rounded-md bg-white shadow-sm border border-black focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
                  <input
                    type="date"
                    value={formData.dateOfWedding || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, dateOfWedding: e.target.value }))}
                  className="block w-full h-full bg-transparent text-black rounded-md border-none outline-none focus:outline-none sm:text-sm pl-3 pr-10"
                  />
                <span role="button" tabIndex={0} className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 cursor-pointer hover:text-gray-600" onClick={(e) => { e.preventDefault(); e.stopPropagation(); const input = (e.currentTarget.parentElement as HTMLElement).querySelector('input[type=date]'); if (input && typeof (input as HTMLInputElement).showPicker === 'function') (input as HTMLInputElement).showPicker(); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const input = (e.currentTarget.parentElement as HTMLElement).querySelector('input[type=date]'); if (input && typeof (input as HTMLInputElement).showPicker === 'function') (input as HTMLInputElement).showPicker(); } }}>
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Children</label>
                <input
                  type="text"
                  name="children"
                  value={formData.children}
                  onChange={handleChange}
                  className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Physically Challenged</label>
                <div className="mt-1 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, physicallyChallenged: true }))}
                    className={`px-4 py-1.5 rounded-full text-xs font-medium border ${
                      formData.physicallyChallenged
                        ? 'bg-green-500 border-green-600 text-white'
                        : 'bg-white border-black text-gray-700'
                    }`}
                  >
                    YES
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, physicallyChallenged: false }))}
                    className={`px-4 py-1.5 rounded-full text-xs font-medium border ${
                      !formData.physicallyChallenged
                        ? 'bg-red-500 border-red-600 text-white'
                        : 'bg-white border-black text-gray-700'
                    }`}
                  >
                    NO
                  </button>
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Physically Challenged Remarks</label>
                <textarea
                  name="physicallyChallengedRemarks"
                  value={formData.physicallyChallengedRemarks}
                  onChange={handleChange}
                  rows={3}
                  className="mt-1 block w-full bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Passport Number</label>
                <input
                  type="text"
                  name="passportNumber"
                  value={formData.passportNumber}
                  onChange={handleChange}
                  className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Passport Expiry</label>
                <div className="relative mt-1 h-10 rounded-md bg-white shadow-sm border border-black focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
                  <input
                    type="date"
                    value={formData.passportExpiry || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, passportExpiry: e.target.value }))}
                  className="block w-full h-full bg-transparent text-black rounded-md border-none outline-none focus:outline-none sm:text-sm pl-3 pr-10"
                  />
                <span role="button" tabIndex={0} className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 cursor-pointer hover:text-gray-600" onClick={(e) => { e.preventDefault(); e.stopPropagation(); const input = (e.currentTarget.parentElement as HTMLElement).querySelector('input[type=date]'); if (input && typeof (input as HTMLInputElement).showPicker === 'function') (input as HTMLInputElement).showPicker(); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const input = (e.currentTarget.parentElement as HTMLElement).querySelector('input[type=date]'); if (input && typeof (input as HTMLInputElement).showPicker === 'function') (input as HTMLInputElement).showPicker(); } }}>
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Driving License Number</label>
                <input
                  type="text"
                  name="drivingLicenseNumber"
                  value={formData.drivingLicenseNumber}
                  onChange={handleChange}
                  className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Driving License Expiry</label>
                <div className="relative mt-1 h-10 rounded-md bg-white shadow-sm border border-black focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
                  <input
                    type="date"
                    value={formData.drivingLicenseExpiry || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, drivingLicenseExpiry: e.target.value }))}
                  className="block w-full h-full bg-transparent text-black rounded-md border-none outline-none focus:outline-none sm:text-sm pl-3 pr-10"
                  />
                <span role="button" tabIndex={0} className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 cursor-pointer hover:text-gray-600" onClick={(e) => { e.preventDefault(); e.stopPropagation(); const input = (e.currentTarget.parentElement as HTMLElement).querySelector('input[type=date]'); if (input && typeof (input as HTMLInputElement).showPicker === 'function') (input as HTMLInputElement).showPicker(); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const input = (e.currentTarget.parentElement as HTMLElement).querySelector('input[type=date]'); if (input && typeof (input as HTMLInputElement).showPicker === 'function') (input as HTMLInputElement).showPicker(); } }}>
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Statutory Details Tab */}
      {currentTab === 'statutory' && (
        <div className={`space-y-6 ${!isTabEditable('statutory') ? 'pointer-events-none opacity-75' : ''}`}>
          {/* Statutory fields – first 12 in specified order, then rest */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
            <h3 className="text-base font-medium text-gray-900">Statutory Numbers & Locations</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 1. PF Applicable */}
              <div>
                <label className="block text-sm font-medium text-gray-700">PF Applicable</label>
                <div className="mt-1 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, pfApplicable: true }))}
                    className={`px-4 py-1.5 rounded-full text-xs font-medium border ${
                      formData.pfApplicable
                        ? 'bg-green-500 border-green-600 text-white'
                        : 'bg-white border-black text-gray-700'
                    }`}
                  >
                    YES
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, pfApplicable: false }))}
                    className={`px-4 py-1.5 rounded-full text-xs font-medium border ${
                      !formData.pfApplicable
                        ? 'bg-red-500 border-red-600 text-white'
                        : 'bg-white border-black text-gray-700'
                    }`}
                  >
                    NO
                  </button>
                </div>
              </div>
              {/* 2. PF Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700">PF Number</label>
                <input
                  type="text"
                  name="pfNumber"
                  value={formData.pfNumber}
                  onChange={handleChange}
                  placeholder="PF Number"
                  className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              {/* 3. UAN Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700">UAN Number</label>
                <input
                  type="text"
                  name="uanNumber"
                  value={formData.uanNumber}
                  onChange={handleChange}
                  placeholder="UAN Number"
                  className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              {/* 4. ESI Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700">ESI Number</label>
                <input
                  type="text"
                  name="esiNumber"
                  value={formData.esiNumber}
                  onChange={handleChange}
                  placeholder="ESI Number"
                  className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              {/* 5. ESI Applicable */}
              <div>
                <label className="block text-sm font-medium text-gray-700">ESI Applicable</label>
                <div className="mt-1 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, esiApplicable: true }))}
                    className={`px-4 py-1.5 rounded-full text-xs font-medium border ${
                      formData.esiApplicable
                        ? 'bg-green-500 border-green-600 text-white'
                        : 'bg-white border-black text-gray-700'
                    }`}
                  >
                    YES
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, esiApplicable: false }))}
                    className={`px-4 py-1.5 rounded-full text-xs font-medium border ${
                      !formData.esiApplicable
                        ? 'bg-red-500 border-red-600 text-white'
                        : 'bg-white border-black text-gray-700'
                    }`}
                  >
                    NO
                  </button>
                </div>
              </div>
              {/* 6. Gratuity Applicable */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Gratuity Applicable</label>
                <div className="mt-1 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, gratuityApplicable: true }))}
                    className={`px-4 py-1.5 rounded-full text-xs font-medium border ${
                      formData.gratuityApplicable
                        ? 'bg-green-500 border-green-600 text-white'
                        : 'bg-white border-black text-gray-700'
                    }`}
                  >
                    YES
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, gratuityApplicable: false }))}
                    className={`px-4 py-1.5 rounded-full text-xs font-medium border ${
                      !formData.gratuityApplicable
                        ? 'bg-red-500 border-red-600 text-white'
                        : 'bg-white border-black text-gray-700'
                    }`}
                  >
                    NO
                  </button>
                </div>
              </div>
              {/* 7. LWF Location */}
              <div>
                <label className="block text-sm font-medium text-gray-700">LWF Location</label>
                <input
                  type="text"
                  name="lwfLocation"
                  value={formData.lwfLocation}
                  onChange={handleChange}
                  placeholder="LWF Location"
                  className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              {/* 8. Tax Regime */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Tax Regime</label>
                <select
                  name="taxRegime"
                  value={formData.taxRegime}
                  onChange={handleChange}
                  className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  <option value="OLD">Old</option>
                  <option value="NEW">New</option>
                </select>
              </div>
              {/* 9. Date Of Probationary */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Date Of Probationary</label>
                <div className="relative">
                  <input
                    type="date"
                    name="dateOfProbationary"
                    value={formData.dateOfProbationary}
                    onChange={handleChange}
                    className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm pl-3 pr-10"
                  />
                  <span role="button" tabIndex={0} className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 cursor-pointer hover:text-gray-600" onClick={(e) => { e.preventDefault(); e.stopPropagation(); const input = (e.currentTarget.parentElement as HTMLElement).querySelector('input[type=date]'); if (input && typeof (input as HTMLInputElement).showPicker === 'function') (input as HTMLInputElement).showPicker(); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const input = (e.currentTarget.parentElement as HTMLElement).querySelector('input[type=date]'); if (input && typeof (input as HTMLInputElement).showPicker === 'function') (input as HTMLInputElement).showPicker(); } }}>
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </span>
                </div>
              </div>
              {/* 10. Date Of Confirmation */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Date Of Confirmation</label>
                <div className="relative">
                  <input
                    type="date"
                    name="dateOfConfirmation"
                    value={formData.dateOfConfirmation}
                    onChange={handleChange}
                    className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm pl-3 pr-10"
                  />
                  <span role="button" tabIndex={0} className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 cursor-pointer hover:text-gray-600" onClick={(e) => { e.preventDefault(); e.stopPropagation(); const input = (e.currentTarget.parentElement as HTMLElement).querySelector('input[type=date]'); if (input && typeof (input as HTMLInputElement).showPicker === 'function') (input as HTMLInputElement).showPicker(); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const input = (e.currentTarget.parentElement as HTMLElement).querySelector('input[type=date]'); if (input && typeof (input as HTMLInputElement).showPicker === 'function') (input as HTMLInputElement).showPicker(); } }}>
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </span>
                </div>
              </div>
              {/* 11. Confirmation Period */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Confirmation Period</label>
                <input
                  type="text"
                  name="confirmationPeriod"
                  value={formData.confirmationPeriod}
                  onChange={handleChange}
                  placeholder="Confirmation Period"
                  className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              {/* 12. Notice Period Days */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Notice Period Days</label>
                <input
                  type="number"
                  min={0}
                  name="noticePeriodDays"
                  value={formData.noticePeriodDays}
                  onChange={handleChange}
                  placeholder="Notice Period Days"
                  className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>

              {/* Rest of fields */}
              <div>
                <label className="block text-sm font-medium text-gray-700">PTax Location</label>
                <input
                  type="text"
                  name="pTaxLocation"
                  value={formData.pTaxLocation}
                  onChange={handleChange}
                  placeholder="PTax Location"
                  className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">PAN Card Number</label>
                <input
                  type="text"
                  name="panNumber"
                  value={formData.panNumber}
                  onChange={handleChange}
                  placeholder="PAN Card Number"
                  className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Aadhaar Number</label>
                <input
                  type="text"
                  name="aadhaarNumber"
                  value={formData.aadhaarNumber}
                  onChange={handleChange}
                  placeholder="Aadhaar Number"
                  className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Date Of Retirement</label>
                <div className="relative">
                  <input
                    type="date"
                    name="dateOfRetirement"
                    value={formData.dateOfRetirement}
                    onChange={handleChange}
                    className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm pl-3 pr-10"
                  />
                  <span role="button" tabIndex={0} className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 cursor-pointer hover:text-gray-600" onClick={(e) => { e.preventDefault(); e.stopPropagation(); const input = (e.currentTarget.parentElement as HTMLElement).querySelector('input[type=date]'); if (input && typeof (input as HTMLInputElement).showPicker === 'function') (input as HTMLInputElement).showPicker(); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const input = (e.currentTarget.parentElement as HTMLElement).querySelector('input[type=date]'); if (input && typeof (input as HTMLInputElement).showPicker === 'function') (input as HTMLInputElement).showPicker(); } }}>
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">ESI Dispensary</label>
                <input
                  type="text"
                  name="esiDispensary"
                  value={formData.esiDispensary}
                  onChange={handleChange}
                  placeholder="ESI Dispensary"
                  className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Husband Name On Online PF</label>
                <input
                  type="text"
                  name="husbandNameOnOnlinePf"
                  value={formData.husbandNameOnOnlinePf}
                  onChange={handleChange}
                  placeholder="Husband Name On Online PF"
                  className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              {/* Tax Applicable */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Tax Applicable</label>
                <div className="mt-1 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, taxApplicable: true }))}
                    className={`px-4 py-1.5 rounded-full text-xs font-medium border ${
                      formData.taxApplicable
                        ? 'bg-green-500 border-green-600 text-white'
                        : 'bg-white border-black text-gray-700'
                    }`}
                  >
                    YES
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, taxApplicable: false }))}
                    className={`px-4 py-1.5 rounded-full text-xs font-medium border ${
                      !formData.taxApplicable
                        ? 'bg-red-500 border-red-600 text-white'
                        : 'bg-white border-black text-gray-700'
                    }`}
                  >
                    NO
                  </button>
                </div>
              </div>
              {/* Expatriate */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Expatriate</label>
                <div className="mt-1 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, expatriate: true }))}
                    className={`px-4 py-1.5 rounded-full text-xs font-medium border ${
                      formData.expatriate
                        ? 'bg-green-500 border-green-600 text-white'
                        : 'bg-white border-black text-gray-700'
                    }`}
                  >
                    YES
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, expatriate: false }))}
                    className={`px-4 py-1.5 rounded-full text-xs font-medium border ${
                      !formData.expatriate
                        ? 'bg-red-500 border-red-600 text-white'
                        : 'bg-white border-black text-gray-700'
                    }`}
                  >
                    NO
                  </button>
                </div>
              </div>
              {/* PF Transferred */}
              <div>
                <label className="block text-sm font-medium text-gray-700">PF Transferred</label>
                <div className="mt-1 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, pfTransferred: true }))}
                    className={`px-4 py-1.5 rounded-full text-xs font-medium border ${
                      formData.pfTransferred
                        ? 'bg-green-500 border-green-600 text-white'
                        : 'bg-white border-black text-gray-700'
                    }`}
                  >
                    YES
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, pfTransferred: false }))}
                    className={`px-4 py-1.5 rounded-full text-xs font-medium border ${
                      !formData.pfTransferred
                        ? 'bg-red-500 border-red-600 text-white'
                        : 'bg-white border-black text-gray-700'
                    }`}
                  >
                    NO
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bank Details Tab */}
      {currentTab === 'bank' && (
        <div className={`space-y-4 ${!isTabEditable('bank') ? 'pointer-events-none opacity-75' : ''}`}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Bank Name</label>
              <input
                type="text"
                name="bankName"
                value={formData.bankName}
                onChange={handleChange}
                placeholder="Bank Name"
                className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Account Number</label>
              <input
                type="text"
                name="bankAccountNumber"
                value={formData.bankAccountNumber}
                onChange={handleChange}
                placeholder="Account Number"
                className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">IFSC Code</label>
              <input
                type="text"
                name="bankIfscCode"
                value={formData.bankIfscCode}
                onChange={handleChange}
                placeholder="IFSC Code"
                className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Payment Mode</label>
              <select
                name="bankPaymentMode"
                value={formData.bankPaymentMode}
                onChange={handleChange}
                className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value="">Payment Mode</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CHEQUE">Cheque</option>
                <option value="CASH">Cash</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Currency</label>
              <select
                name="bankCurrency"
                value={formData.bankCurrency}
                onChange={handleChange}
                className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value="">Currency</option>
                <option value="INR">INR - Indian Rupee</option>
                <option value="USD">USD - US Dollar</option>
                <option value="EUR">EUR - Euro</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Salary Details Tab */}
      {currentTab === 'salary' && (
        <div className={`space-y-4 ${!isTabEditable('salary') ? 'pointer-events-none opacity-75' : ''}`}>
          <div className="flex border-b border-gray-200">
            <button
              type="button"
              onClick={() => setSalaryTab('earnings')}
              className={`px-4 py-2 text-sm font-medium border-b-2 ${
                salaryTab === 'earnings'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
              }`}
            >
              Earnings
            </button>
            <button
              type="button"
              onClick={() => setSalaryTab('deductions')}
              className={`px-4 py-2 text-sm font-medium border-b-2 ${
                salaryTab === 'deductions'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
              }`}
            >
              Deductions
            </button>
            <button
              type="button"
              onClick={() => setSalaryTab('reimbursement')}
              className={`px-4 py-2 text-sm font-medium border-b-2 ${
                salaryTab === 'reimbursement'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
              }`}
            >
              Reimbursement
            </button>
          </div>

          {salaryTab === 'earnings' && (
            <div className="space-y-4">
              {/* Previous salary & updated fixed gross (shown after increment) */}
              {(previousSalaryGross != null || salaryFixedGross > 0) && !salaryLoading && (
                <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Salary summary</p>
                  <div className="flex flex-wrap gap-6 text-sm">
                    {previousSalaryGross != null && (
                      <span className="text-gray-600">
                        Previous salary: <span className="font-semibold text-gray-900">₹ {Number(previousSalaryGross).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </span>
                    )}
                    <span className="text-gray-600">
                      Now updated fixed gross: <span className="font-semibold text-green-700">₹ {(salaryFixedGross + salaryVehicleAllowances).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </span>
                  </div>
                </div>
              )}

              {/* Previous salary log: datewise revision — starting 15000, 01 Dec 2025 - 3000, … 02 Feb 2026 - 23000 currently */}
              {salaryHistory.length > 0 && !salaryLoading && (() => {
                const chronological = [...salaryHistory].sort((a, b) => (a.effectiveDate || '').localeCompare(b.effectiveDate || ''));
                const formatRevDate = (d: string) =>
                  d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
                return (
                  <div className="rounded-md border border-gray-200 bg-white overflow-hidden">
                    <p className="text-sm font-medium text-gray-700 px-4 py-2 border-b border-gray-200 bg-gray-50">Previous salary log (datewise revision)</p>
                    <ul className="px-4 py-3 space-y-1.5 text-sm list-none">
                      {chronological.map((row, idx) => {
                        const prevSalary = idx > 0 ? chronological[idx - 1].grossSalary : 0;
                        const increment = idx > 0 ? row.grossSalary - prevSalary : 0;
                        const dateStr = formatRevDate(row.effectiveDate);
                        const isLast = idx === chronological.length - 1;
                        const isCurrent = row.isCurrent;
                        if (idx === 0) {
                          return (
                            <li key={idx} className="text-gray-900">
                              <span className="font-medium">starting </span>
                              <span className="tabular-nums">{row.grossSalary.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                            </li>
                          );
                        }
                        if (isLast && isCurrent) {
                          return (
                            <li key={idx} className={isCurrent ? 'text-green-700 font-medium' : 'text-gray-900'}>
                              <span className="tabular-nums">{dateStr}</span>
                              <span className="mx-1">-</span>
                              <span className="tabular-nums">{row.grossSalary.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                              <span className="ml-1">currently</span>
                            </li>
                          );
                        }
                        return (
                          <li key={idx} className="text-gray-900">
                            <span className="tabular-nums">{dateStr}</span>
                            <span className="mx-1">-</span>
                            <span className="tabular-nums">{increment.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })()}

              <div className="overflow-hidden border border-gray-200 rounded-md">
              <table className="min-w-full divide-y divide-gray-200">
                <tbody className="divide-y divide-gray-200 bg-white">
                  <tr>
                    <td className="px-4 py-2 text-sm text-gray-700 text-left">Fixed Gross</td>
                    <td className="px-4 py-2 text-left">:</td>
                    <td className="px-4 py-2 text-left">
                      <input
                        type="number"
                        min={0}
                        value={salaryLoading ? '' : salaryFixedGross}
                        onChange={(e) => setSalaryFixedGross(Number(e.target.value) || 0)}
                        className="block w-32 h-9 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-left"
                        disabled={salaryLoading}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 text-sm text-gray-700 text-left">Vehicle Allowances</td>
                    <td className="px-4 py-2 text-left">:</td>
                    <td className="px-4 py-2 text-left">
                      <input
                        type="number"
                        min={0}
                        value={salaryLoading ? '' : salaryVehicleAllowances}
                        onChange={(e) => setSalaryVehicleAllowances(Number(e.target.value) || 0)}
                        className="block w-32 h-9 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-left"
                        disabled={salaryLoading}
                      />
                    </td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="px-4 py-2 text-sm font-semibold text-gray-900 text-left">Total</td>
                    <td className="px-4 py-2 text-left">:</td>
                    <td className="px-4 py-2 text-left">
                      <span className="block w-32 h-9 flex items-center text-sm font-semibold text-gray-900">
                        {salaryLoading ? '' : (salaryFixedGross + salaryVehicleAllowances).toFixed(2)}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            </div>
          )}

          {salaryTab === 'deductions' && (
            <div className="overflow-hidden border border-gray-200 rounded-md">
              <table className="min-w-full divide-y divide-gray-200">
                <tbody className="divide-y divide-gray-200 bg-white">
                  {[
                    'VPF Amount',
                    'Labour Welfare Fund',
                    'Bus Deduction',
                  ].map((label) => (
                    <tr key={label}>
                      <td className="px-4 py-2 text-sm text-gray-700 text-left">{label}</td>
                      <td className="px-4 py-2 text-left">:</td>
                      <td className="px-4 py-2 text-left">
                        <input
                          type="number"
                          min={0}
                          className="block w-32 h-9 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-left"
                          defaultValue={0}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {salaryTab === 'reimbursement' && (
            <div className="text-sm text-gray-500">Reimbursement structure can be configured here (coming soon).</div>
          )}
        </div>
      )}

      {/* Assets Tab */}
      {currentTab === 'assets' && (
        <div className={`space-y-4 ${!isTabEditable('assets') ? 'pointer-events-none opacity-75' : ''}`}>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Assets</h3>
            <button
              type="button"
              onClick={() => {
                setAssetFormData({
                  assetName: '',
                  serialNumber: '',
                  dateOfIssuance: '',
                  assetId: '',
                  make: '',
                  model: '',
                  colour: '',
                  inchargeName: '',
                  remarks: '',
                  released: false,
                });
                setShowAssetModal(true);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add
            </button>
          </div>

          <div className="overflow-hidden border border-gray-200 rounded-md">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Asset Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Serial Number</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Date of Issuance</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Asset ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Make</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Model</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Colour</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Incharge Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Remarks</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Released</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {assets.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-8 text-center text-sm text-gray-500">
                      No data available in table
                    </td>
                  </tr>
                ) : (
                  assets.map((asset) => (
                    <tr key={asset.id}>
                      <td className="px-4 py-2 text-sm text-gray-900">{asset.assetName}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{asset.serialNumber}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{asset.dateOfIssuance}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{asset.assetId}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{asset.make}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{asset.model}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{asset.colour}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{asset.inchargeName}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{asset.remarks}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{asset.released ? 'Yes' : 'No'}</td>
                      <td className="px-4 py-2 text-sm">
                        <button
                          type="button"
                          onClick={() => {
                            const assetToEdit = assets.find(a => a.id === asset.id);
                            if (assetToEdit) {
                              setAssetFormData(assetToEdit);
                              setShowAssetModal(true);
                            }
                          }}
                          className="text-blue-600 hover:text-blue-800 mr-3"
                          title="Edit"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => setAssets(assets.filter(a => a.id !== asset.id))}
                          className="text-red-600 hover:text-red-800"
                          title="Delete"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Academic Qualification Tab */}
      {currentTab === 'academic' && (
        <div className={`space-y-4 ${!isTabEditable('academic') ? 'pointer-events-none opacity-75' : ''}`}>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Academic Qualification</h3>
            <button
              type="button"
              onClick={() => {
                setAcademicFormData({
                  degree: '',
                  discipline: '',
                  university: '',
                  grade: '',
                  percentage: '',
                  yearOfPassing: '',
                  nameOfInstitution: '',
                  remarks: '',
                });
                setShowAcademicModal(true);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add
            </button>
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-md p-3">
            <p className="text-sm text-orange-700 font-medium">Higher degree should be added first</p>
          </div>

          <div className="overflow-hidden border border-gray-200 rounded-md">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Degree</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Discipline</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">University</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Grade</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Percentage</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Year of Passing</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Name of Institution</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Remarks</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {academicQualifications.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-500">
                      No data available in table
                    </td>
                  </tr>
                ) : (
                  academicQualifications.map((qualification) => (
                    <tr key={qualification.id}>
                      <td className="px-4 py-2 text-sm text-gray-900">{qualification.degree}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{qualification.discipline}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{qualification.university}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{qualification.grade}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{qualification.percentage}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{qualification.yearOfPassing}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{qualification.nameOfInstitution}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{qualification.remarks}</td>
                      <td className="px-4 py-2 text-sm">
                        <button
                          type="button"
                          onClick={() => {
                            const qualToEdit = academicQualifications.find(q => q.id === qualification.id);
                            if (qualToEdit) {
                              setAcademicFormData(qualToEdit);
                              setShowAcademicModal(true);
                            }
                          }}
                          className="text-blue-600 hover:text-blue-800 mr-3"
                          title="Edit"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => setAcademicQualifications(academicQualifications.filter(q => q.id !== qualification.id))}
                          className="text-red-600 hover:text-red-800"
                          title="Delete"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Family Details Tab */}
      {currentTab === 'family' && (
        <div className={`space-y-4 ${!isTabEditable('family') ? 'pointer-events-none opacity-75' : ''}`}>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Family Details</h3>
            <button
              type="button"
              onClick={() => {
                setFamilyFormData({
                  firstName: '',
                  lastName: '',
                  relationship: '',
                  dateOfBirth: '',
                  phoneNumber: '',
                  occupation: '',
                  address: '',
                  aadhaarNumber: '',
                  passportNumber: '',
                  passportIssueDate: '',
                  passportExpiryDate: '',
                  pfShare: '',
                  gratuityShare: '',
                  nominationRemarks: '',
                });
                setShowFamilyModal(true);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
            >
              + Add
            </button>
          </div>
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">First Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Last Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Relationship</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">DOB</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Phone #</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Passport #</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Passport Issue Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Passport Expiry Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">PF Share</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Gratuity Share</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Nomination Remarks</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {familyMembers.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-8 text-center text-sm text-gray-500">
                      No data available in table
                    </td>
                  </tr>
                ) : (
                  familyMembers.map((member) => (
                    <tr key={member.id}>
                      <td className="px-4 py-2 text-sm text-gray-900">{member.firstName}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{member.lastName}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{member.relationship}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{member.dateOfBirth}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{member.phoneNumber}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{member.passportNumber}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{member.passportIssueDate}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{member.passportExpiryDate}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{member.pfShare}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{member.gratuityShare}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{member.nominationRemarks}</td>
                      <td className="px-4 py-2 text-sm">
                        <button
                          type="button"
                          onClick={() => {
                            const memberToEdit = familyMembers.find(m => m.id === member.id);
                            if (memberToEdit) {
                              setFamilyFormData(memberToEdit);
                              setShowFamilyModal(true);
                            }
                          }}
                          className="text-blue-600 hover:text-blue-800 mr-3"
                          title="Edit"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => setFamilyMembers(familyMembers.filter(m => m.id !== member.id))}
                          className="text-red-600 hover:text-red-800"
                          title="Delete"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Previous Employment Tab */}
      {currentTab === 'previousEmployment' && (
        <div className={`space-y-4 ${!isTabEditable('previousEmployment') ? 'pointer-events-none opacity-75' : ''}`}>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Previous Employment</h3>
            <button
              type="button"
              onClick={() => {
                setPreviousEmploymentFormData({
                  organization: '',
                  designation: '',
                  fromDate: '',
                  toDate: '',
                  yearsOfExperience: '',
                  relevantExperience: '',
                  remarks: '',
                  ctc: '',
                });
                setShowPreviousEmploymentModal(true);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add
            </button>
          </div>

          <div className="overflow-hidden border border-gray-200 rounded-md">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Organization</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Designation</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">From Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">To Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Years of Experience</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Relevant experience</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Remarks</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">CTC</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {previousEmployments.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-500">
                      No data available in table
                    </td>
                  </tr>
                ) : (
                  previousEmployments.map((employment) => (
                    <tr key={employment.id}>
                      <td className="px-4 py-2 text-sm text-gray-900">{employment.organization}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{employment.designation}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{employment.fromDate}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{employment.toDate}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{employment.yearsOfExperience}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{employment.relevantExperience}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{employment.remarks}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{employment.ctc}</td>
                      <td className="px-4 py-2 text-sm">
                        <button
                          type="button"
                          onClick={() => {
                            const empToEdit = previousEmployments.find(e => e.id === employment.id);
                            if (empToEdit) {
                              setPreviousEmploymentFormData(empToEdit);
                              setShowPreviousEmploymentModal(true);
                            }
                          }}
                          className="text-blue-600 hover:text-blue-800 mr-3"
                          title="Edit"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviousEmployments(previousEmployments.filter(e => e.id !== employment.id))}
                          className="text-red-600 hover:text-red-800"
                          title="Delete"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Others Tab */}
      {currentTab === 'others' && (
        <div className={`space-y-4 ${!isTabEditable('others') ? 'pointer-events-none opacity-75' : ''}`}>
          {/* Sub-tab Navigation */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                type="button"
                onClick={() => setOthersTab('certifications')}
                className={`${
                  othersTab === 'certifications'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                Certifications
              </button>
              <button
                type="button"
                onClick={() => setOthersTab('knownLanguages')}
                className={`${
                  othersTab === 'knownLanguages'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                Known Language
              </button>
            </nav>
          </div>

          {/* Certifications Tab */}
          {othersTab === 'certifications' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Certifications</h3>
                <button
                  type="button"
                  onClick={() => {
                    setCertificationFormData({
                      skillSet: '',
                      yearsOfExperience: '',
                      certifiedBy: '',
                      remarks: '',
                    });
                    setShowCertificationModal(true);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
                >
                  + Add
                </button>
              </div>
              <div className="bg-white shadow overflow-hidden sm:rounded-md">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Skill Set</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Remarks</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {certifications.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-500">
                          No data available in table
                        </td>
                      </tr>
                    ) : (
                      certifications.map((cert) => (
                        <tr key={cert.id}>
                          <td className="px-4 py-2 text-sm text-gray-900">{cert.skillSet}</td>
                          <td className="px-4 py-2 text-sm text-gray-900">{cert.remarks}</td>
                          <td className="px-4 py-2 text-sm">
                            <button
                              type="button"
                              onClick={() => {
                                const certToEdit = certifications.find(c => c.id === cert.id);
                                if (certToEdit) {
                                  setCertificationFormData(certToEdit);
                                  setShowCertificationModal(true);
                                }
                              }}
                              className="text-blue-600 hover:text-blue-800 mr-3"
                              title="Edit"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => setCertifications(certifications.filter(c => c.id !== cert.id))}
                              className="text-red-600 hover:text-red-800"
                              title="Delete"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Known Languages Tab */}
          {othersTab === 'knownLanguages' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Known Languages</h3>
                <button
                  type="button"
                  onClick={() => {
                    setKnownLanguageFormData({
                      language: '',
                      speak: '',
                      write: '',
                      read: '',
                    });
                    setShowKnownLanguageModal(true);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
                >
                  + Add
                </button>
              </div>
              <div className="bg-white shadow overflow-hidden sm:rounded-md">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Language</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Read</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {knownLanguages.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-500">
                          No data available in table
                        </td>
                      </tr>
                    ) : (
                      knownLanguages.map((lang) => (
                        <tr key={lang.id}>
                          <td className="px-4 py-2 text-sm text-gray-900">{lang.language}</td>
                          <td className="px-4 py-2 text-sm text-gray-900">{lang.read}</td>
                          <td className="px-4 py-2 text-sm">
                            <button
                              type="button"
                              onClick={() => {
                                const langToEdit = knownLanguages.find(l => l.id === lang.id);
                                if (langToEdit) {
                                  setKnownLanguageFormData(langToEdit);
                                  setShowKnownLanguageModal(true);
                                }
                              }}
                              className="text-blue-600 hover:text-blue-800 mr-3"
                              title="Edit"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => setKnownLanguages(knownLanguages.filter(l => l.id !== lang.id))}
                              className="text-red-600 hover:text-red-800"
                              title="Delete"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* New Fields Tab */}
      {currentTab === 'newFields' && (
        <div className={`space-y-4 ${!isTabEditable('newFields') ? 'pointer-events-none opacity-75' : ''}`}>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">New Fields</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">IMEI</label>
              <input
                type="text"
                name="imei"
                value={formData.imei}
                onChange={handleChange}
                className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="IMEI"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Sub Department</label>
              <select
                name="subDepartment"
                value={formData.subDepartment}
                onChange={handleChange}
                className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value="">Sub Department</option>
                {subDepartmentOptions.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">PF ABRY Scheme Applicable</label>
              <select
                name="pfAbrySchemeApplicable"
                value={formData.pfAbrySchemeApplicable}
                onChange={handleChange}
                className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value="">PF ABRY Scheme Applicable</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Alternate Saturday Off</label>
              <select
                name="alternateSaturdayOff"
                value={formData.alternateSaturdayOff}
                onChange={handleChange}
                className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value="">Alternate Saturday Off</option>
                <option value="1st 3rd saturday off">1st 3rd saturday off</option>
                <option value="2nd 4th saturday off">2nd 4th saturday off</option>
                <option value="nil">nil</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Compoff Applicable</label>
              <select
                name="compoffApplicable"
                value={formData.compoffApplicable}
                onChange={handleChange}
                className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value="">Compoff Applicable</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {currentTab === 'esop' && employee?.id && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">ESOP Records</h3>
          </div>
          
          {esopLoading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : esopRecords.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No ESOP records found for this employee.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 border border-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-b border-gray-300">
                      Financial Year
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-b border-gray-300">
                      No of ESOP
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-b border-gray-300">
                      Date of Allocation
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-b border-gray-300">
                      Vested
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-b border-gray-300">
                      Created At
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {esopRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 border-b border-gray-200">
                        {record.financialYear}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 border-b border-gray-200">
                        {record.noOfEsop}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 border-b border-gray-200">
                        {record.dateOfAllocation ? new Date(record.dateOfAllocation).toLocaleDateString('en-GB') : ''}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 border-b border-gray-200">
                        {record.visted || ''}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 border-b border-gray-200">
                        {new Date(record.createdAt).toLocaleDateString('en-GB')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Submit Error + Error List */}
      {errors.submit && (
        <div className="rounded-md bg-red-50 border border-red-200 p-4">
          <p className="text-sm font-medium text-red-800">{errors.submit}</p>
          {(() => {
            const fieldLabels: Record<string, string> = {
              joiningDate: 'Date of Joining',
              dateOfJoining: 'Date of Joining',
              departmentId: 'Department',
              positionId: 'Designation',
              firstName: 'First Name',
              lastName: 'Last Name',
              email: 'Email',
              personalEmail: 'Personal Email',
              phoneNumber: 'Phone Number',
              dateOfBirth: 'Date of Birth',
              entityId: 'Entity',
              locationId: 'Location',
              costCentreId: 'Cost Centre',
              subDepartmentId: 'Sub Department',
              newLoginEmail: 'New Login Email',
            };
            const fieldErrors = Object.entries(errors).filter(([k]) => k !== 'submit');
            if (fieldErrors.length === 0) return null;
            return (
              <ul className="mt-3 list-disc list-inside space-y-1 text-sm text-red-700">
                {fieldErrors.map(([key, msg]) => (
                  <li key={key}>
                    <span className="font-medium">{fieldLabels[key] ?? key}:</span> {msg}
                  </li>
                ))}
              </ul>
            );
          })()}
        </div>
      )}

      {/* Form Actions */}
      <div className="flex justify-between pt-4 border-t">
        <div>
          {currentTab !== 'company' && (
            <button
              type="button"
              onClick={handleBack}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Back
            </button>
          )}
        </div>
        <div className="flex space-x-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
          )}
          {(() => {
            const showSubmit = !isViewMode && (
              !employee
                ? true
                : (currentTab === 'company' && isTabEditable('company')) ||
                  (currentTab === 'newFields' && (editableTabs == null || editableTabs.includes('newFields'))) ||
                  (currentTab === 'personal' && isTabEditable('personal')) ||
                  (currentTab === 'academic' && isTabEditable('academic')) ||
                  (currentTab === 'previousEmployment' && isTabEditable('previousEmployment')) ||
                  (currentTab === 'family' && isTabEditable('family'))
            );
            if (showSubmit) {
              return (
                <button
                  type="submit"
                  disabled={loading || submittingApproval || rejoinSubmitting}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {rejoinSubmitting ? 'Rejoining...' : submittingApproval ? 'Submitting...' : loading ? 'Saving...' : rejoinMode && employee ? 'Rejoin (Create New Employee)' : employee ? 'Update Employee' : 'Create Employee'}
                </button>
              );
            }
            if (isViewMode) return null;
            // Don't show Next button on ESOP tab (it's the last tab)
            if (currentTab === 'esop') return null;
            return (
              <button
                type="button"
                onClick={handleNext}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                Next
              </button>
            );
          })()}
        </div>
      </div>

      {/* Approval submitted message – employee self-edit goes for HR approval */}
      {approvalSubmitted && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 text-center mb-2">Changes submitted</h2>
            <p className="text-gray-600 text-center mb-6">
              Your changes will be updated once approved by HR.
            </p>
            <button
              type="button"
              onClick={() => { setApprovalSubmitted(false); onSuccess?.(); }}
              className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Temporary Password Modal */}
      {showPasswordModal && temporaryPassword && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mx-auto mb-4">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
              Employee Created Successfully!
            </h2>
            <p className="text-gray-600 text-center mb-6">
              Please save the temporary password below and share it with the employee.
            </p>
            
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Email:</label>
                <p className="text-sm text-gray-900 font-mono">{createdEmployeeEmail}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Temporary Password:</label>
                <div className="flex items-center justify-between bg-white border border-gray-300 rounded px-3 py-2">
                  <p className="text-sm font-mono text-gray-900 font-bold">{temporaryPassword}</p>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(temporaryPassword);
                      alert('Password copied to clipboard!');
                    }}
                    className="ml-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-6">
              <p className="text-sm text-yellow-800">
                <strong>Important:</strong> The employee should change this password after their first login.
                They can do this from their Profile page.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowPasswordModal(false);
                setTemporaryPassword(null);
                setCreatedEmployeeEmail('');
                onSuccess?.();
              }}
              className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition duration-300"
            >
              Close
            </button>
          </div>
        </div>
      )}
      </div> {/* end tab content */}
      </div> {/* end layout flex */}
    </form>

    {/* Department Modal - Creates in Configurator DB (Bnc_Configurator.departments) */}
    {showDepartmentModal && (
      <Modal
        isOpen={showDepartmentModal}
        onClose={() => setShowDepartmentModal(false)}
        title="Create Department"
        size="md"
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const nameInput = (e.target as HTMLFormElement).elements.namedItem('deptName') as HTMLInputElement;
            const name = nameInput?.value?.trim();
            if (!name) return;
            // Check for duplicates
            const allDepts = [...localDepartments.map(d => d.name), ...configDepartments.map(d => d.name)];
            if (allDepts.some(n => n.toLowerCase() === name.toLowerCase())) {
              alert('A department with this name already exists.');
              return;
            }
            try {
              // Use the pre-resolved Configurator cost centre ID (set when cost centre was selected)
              const ccId = selectedConfigCostCentreId ?? configCostCentres.find(c => c.name.toLowerCase() === formData.costCentre?.trim()?.toLowerCase())?.id;
              if (!ccId) {
                alert('Could not resolve cost centre ID. Please re-select the cost centre and try again.');
                return;
              }
              // 1. POST /api/v1/departments/ with { name, company_id, cost_centre_id }
              const configResult = await configuratorDataService.createDepartment(name, ccId);
              console.log('Department created:', configResult);
              // 2. Also create in local HRMS DB for FK reference
              let localId: string | undefined;
              try {
                const { createDepartment: createLocalDept } = useDepartmentStore.getState();
                const localDept = await createLocalDept({ organizationId, name, isActive: true });
                localId = localDept?.id;
              } catch (localErr) {
                console.warn('Local HRMS department creation failed (Configurator save succeeded):', localErr);
              }
              // 3. Refresh both lists
              await fetchDepartments(organizationId);
              try {
                const freshList = await configuratorDataService.getDepartments();
                setConfigDepartments(freshList.map(d => ({ id: d.id, name: d.name })));
              } catch { /* ignore refresh failure */ }
              // 4. Auto-select the new department
              if (localId) {
                setFormData(prev => ({ ...prev, departmentId: localId! }));
              } else {
                setFormData(prev => ({ ...prev, departmentId: `config_${configResult.id}` }));
              }
              setShowDepartmentModal(false);
            } catch (err: any) {
              console.error('Failed to create department:', err);
              // Show full API error detail (FastAPI uses 'detail', not 'message')
              const detail = err.response?.data?.detail;
              let errMsg: string;
              if (Array.isArray(detail)) {
                errMsg = detail.map((d: any) => `${d.loc?.join('.')}: ${d.msg}`).join('\n');
              } else if (typeof detail === 'string') {
                errMsg = detail;
              } else {
                errMsg = err.response?.data?.message || err.message || 'Failed to create department.';
              }
              console.error('Department creation error detail:', JSON.stringify(err.response?.data));
              alert(errMsg);
            }
          }}
          className="space-y-4"
        >
          <div>
            <label htmlFor="deptName" className="block text-sm font-medium text-gray-700">
              Department Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="deptName"
              name="deptName"
              autoFocus
              className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="e.g., Engineering, Sales"
            />
          </div>
          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={() => setShowDepartmentModal(false)}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              Create Department
            </button>
          </div>
        </form>
      </Modal>
    )}

    {/* Position Modal - Outside form to avoid nested forms */}
    {showPositionModal && (
      <Modal
        isOpen={showPositionModal}
        onClose={() => setShowPositionModal(false)}
        title="Create Designation"
        size="2xl"
      >
        <PositionForm
          organizationId={organizationId}
          onSuccess={async (createdPosition) => {
            console.log('Position created successfully:', createdPosition);
            // Refresh positions list
            await fetchPositions({ organizationId, limit: 100 });
            // Auto-select the newly created position
            if (createdPosition) {
              setFormData(prev => ({ ...prev, positionId: createdPosition.id }));
            }
            setShowPositionModal(false);
          }}
          onCancel={() => setShowPositionModal(false)}
        />
      </Modal>
    )}

    {/* Entity Modal */}
    {showEntityModal && (
      <Modal
        isOpen={showEntityModal}
        onClose={() => setShowEntityModal(false)}
        title="Create Entity"
        size="2xl"
      >
        <EntityForm
          organizationId={organizationId}
          onSuccess={async (createdEntity) => {
            const list = await entityService.getByOrganization(organizationId);
            setEntities(list.map((e) => ({ id: e.id, name: e.name, code: e.code ?? undefined })));
            if (createdEntity) {
              setFormData(prev => ({ ...prev, entityId: createdEntity.id, locationId: '' }));
            }
            setShowEntityModal(false);
          }}
          onCancel={() => setShowEntityModal(false)}
        />
      </Modal>
    )}

    {/* Location Modal */}
    {showLocationModal && formData.entityId?.trim() && (
      <Modal
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        title="Create Location"
        size="2xl"
      >
        <LocationForm
          organizationId={organizationId}
          entityId={formData.entityId}
          entityName={entities.find(e => e.id === formData.entityId)?.name}
          onSuccess={async (createdLocation) => {
            const list = await locationService.getByEntity(organizationId, formData.entityId);
            setLocations(list.map((l) => ({ id: l.id, name: l.name, code: l.code ?? undefined })));
            if (createdLocation) {
              setFormData(prev => ({ ...prev, locationId: createdLocation.id }));
            }
            setShowLocationModal(false);
          }}
          onCancel={() => setShowLocationModal(false)}
        />
      </Modal>
    )}

    {/* Add Sub-Department Modal */}
    {showSubDepartmentModal && (
      <Modal
        isOpen={showSubDepartmentModal}
        onClose={() => {
          setShowSubDepartmentModal(false);
          setNewSubDepartmentName('');
          setSubDepartmentError('');
        }}
        title="Add Sub-Department"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="newSubDepartmentName" className="block text-sm font-medium text-gray-700">
              Sub-Department Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="newSubDepartmentName"
              value={newSubDepartmentName}
              onChange={(e) => {
                setNewSubDepartmentName(e.target.value);
                if (subDepartmentError) setSubDepartmentError('');
              }}
              onKeyDown={async (e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const name = newSubDepartmentName.trim();
                  if (!name) return;
                  const isDuplicate = subDepartmentOptions.some((o) => o.toLowerCase() === name.toLowerCase());
                  if (isDuplicate) {
                    setSubDepartmentError('This sub-department already exists. Please enter a different name.');
                    return;
                  }
                  try {
                    // Resolve department & cost centre Configurator IDs
                    const selectedDeptConfig = configDepartments.find(d => formData.departmentId === `config_${d.id}` || localDepartments.find(ld => ld.id === formData.departmentId)?.name?.toLowerCase() === d.name.toLowerCase());
                    const resolvedCCId = selectedConfigCostCentreId ?? configCostCentres.find(c => c.name.toLowerCase() === formData.costCentre?.trim()?.toLowerCase())?.id;
                    if (!selectedDeptConfig?.id) {
                      setSubDepartmentError('Could not resolve department ID. Please re-select the department.');
                      return;
                    }
                    // POST /api/v1/sub-departments/ with { name, department_id, company_id, costcenter_id }
                    await configuratorDataService.createSubDepartment(name, selectedDeptConfig.id, resolvedCCId);
                    // Also save to local HRMS DB
                    try { await subDepartmentService.create(organizationId, name); } catch { /* local save optional */ }
                    // Refresh dropdown via GET /api/v1/sub-departments/
                    try {
                      const freshList = await configuratorDataService.getSubDepartments();
                      setConfigSubDepartments(freshList.map((s) => ({ id: s.id, name: s.name, department_id: s.department_id })));
                      const freshNames = freshList.map((s) => s.name).sort((a, b) => a.localeCompare(b));
                      setSubDepartmentOptions(freshNames);
                    } catch {
                      // Fallback: just add locally
                      setSubDepartmentOptions((prev) => [...prev, name].sort((a, b) => a.localeCompare(b)));
                    }
                    setFormData((prev) => ({ ...prev, subDepartment: name }));
                    setNewSubDepartmentName('');
                    setSubDepartmentError('');
                    setShowSubDepartmentModal(false);
                  } catch (err: any) {
                    const detail = err.response?.data?.detail;
                    const errMsg = Array.isArray(detail) ? detail.map((d: any) => `${d.loc?.join('.')}: ${d.msg}`).join('; ') : (typeof detail === 'string' ? detail : err.response?.data?.message || err.message || 'Failed to add sub-department. Try again.');
                    console.error('Sub-department creation error detail:', JSON.stringify(err.response?.data));
                    setSubDepartmentError(errMsg);
                  }
                }
              }}
              className={`mt-1 block w-full h-10 bg-white text-black rounded-md border shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                subDepartmentError ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="e.g., Backend, Frontend, QA"
            />
            {subDepartmentError && <p className="mt-1 text-sm text-red-600">{subDepartmentError}</p>}
          </div>
          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setShowSubDepartmentModal(false);
                setNewSubDepartmentName('');
                setSubDepartmentError('');
              }}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                const name = newSubDepartmentName.trim();
                if (!name) return;
                const isDuplicate = subDepartmentOptions.some((o) => o.toLowerCase() === name.toLowerCase());
                if (isDuplicate) {
                  setSubDepartmentError('This sub-department already exists. Please enter a different name.');
                  return;
                }
                try {
                  // Resolve department & cost centre Configurator IDs
                  const selectedDeptConfig = configDepartments.find(d => formData.departmentId === `config_${d.id}` || localDepartments.find(ld => ld.id === formData.departmentId)?.name?.toLowerCase() === d.name.toLowerCase());
                  const resolvedCCId = selectedConfigCostCentreId ?? configCostCentres.find(c => c.name.toLowerCase() === formData.costCentre?.trim()?.toLowerCase())?.id;
                  if (!selectedDeptConfig?.id) {
                    setSubDepartmentError('Could not resolve department ID. Please re-select the department.');
                    return;
                  }
                  // POST /api/v1/sub-departments/ with { name, department_id, company_id, costcenter_id }
                  await configuratorDataService.createSubDepartment(name, selectedDeptConfig.id, resolvedCCId);
                  // Also save to local HRMS DB
                  try { await subDepartmentService.create(organizationId, name); } catch { /* local save optional */ }
                  // Refresh dropdown via GET /api/v1/sub-departments/
                  try {
                    const freshList = await configuratorDataService.getSubDepartments();
                    setConfigSubDepartments(freshList.map((s) => ({ id: s.id, name: s.name, department_id: s.department_id })));
                    const freshNames = freshList.map((s) => s.name).sort((a, b) => a.localeCompare(b));
                    setSubDepartmentOptions(freshNames);
                  } catch {
                    setSubDepartmentOptions((prev) => [...prev, name].sort((a, b) => a.localeCompare(b)));
                  }
                  setFormData((prev) => ({ ...prev, subDepartment: name }));
                  setNewSubDepartmentName('');
                  setSubDepartmentError('');
                  setShowSubDepartmentModal(false);
                } catch (err: any) {
                  setSubDepartmentError(err.response?.data?.detail || err.response?.data?.message || err.message || 'Failed to add sub-department. Try again.');
                }
              }}
              disabled={!newSubDepartmentName.trim()}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Sub-Department
            </button>
          </div>
        </div>
      </Modal>
    )}

    {/* Add Cost Centre Modal */}
    {showCostCentreModal && (
      <Modal
        isOpen={showCostCentreModal}
        onClose={() => {
          setShowCostCentreModal(false);
          setNewCostCentreName('');
          setCostCentreError('');
        }}
        title="Add Cost Centre"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="newCostCentreName" className="block text-sm font-medium text-gray-700">
              Cost Centre Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="newCostCentreName"
              value={newCostCentreName}
              onChange={(e) => {
                setNewCostCentreName(e.target.value);
                if (costCentreError) setCostCentreError('');
              }}
              onKeyDown={async (e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const name = newCostCentreName.trim();
                  if (!name) return;
                  const isDuplicate = costCentreOptions.some((o) => o.toLowerCase() === name.toLowerCase());
                  if (isDuplicate) {
                    setCostCentreError('This cost centre already exists. Please enter a different name.');
                    return;
                  }
                  try {
                    // POST /api/v1/cost-centres/ with { name, company_id }
                    const created = await configuratorDataService.createCostCentre(name);
                    // Refresh dropdown via GET /api/v1/cost-centres/
                    try {
                      const freshList = await configuratorDataService.getCostCentres();
                      setConfigCostCentres(freshList.map((c) => ({ id: c.id, name: c.name })));
                      setCostCentreOptions(freshList.map((c) => c.name).sort((a, b) => a.localeCompare(b)));
                      // Auto-resolve the new cost centre ID
                      const newCC = freshList.find((c) => c.name.toLowerCase() === name.toLowerCase());
                      setSelectedConfigCostCentreId(newCC?.id ?? created.id ?? null);
                    } catch {
                      setCostCentreOptions((prev) => [...prev, name].sort((a, b) => a.localeCompare(b)));
                      setSelectedConfigCostCentreId(created.id ?? null);
                    }
                    setFormData((prev) => ({ ...prev, costCentre: name, departmentId: '', subDepartment: '' }));
                    setNewCostCentreName('');
                    setCostCentreError('');
                    setShowCostCentreModal(false);
                  } catch (err: any) {
                    const detail = err.response?.data?.detail;
                    const errMsg = Array.isArray(detail) ? detail.map((d: any) => `${d.loc?.join('.')}: ${d.msg}`).join('; ') : (typeof detail === 'string' ? detail : err.response?.data?.message || err.message || 'Failed to add cost centre. Try again.');
                    console.error('Cost centre creation error detail:', JSON.stringify(err.response?.data));
                    setCostCentreError(errMsg);
                  }
                }
              }}
              className={`mt-1 block w-full h-10 bg-white text-black rounded-md border shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                costCentreError ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="e.g., Engineering, Marketing"
            />
            {costCentreError && <p className="mt-1 text-sm text-red-600">{costCentreError}</p>}
          </div>
          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setShowCostCentreModal(false);
                setNewCostCentreName('');
                setCostCentreError('');
              }}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                const name = newCostCentreName.trim();
                if (!name) return;
                const isDuplicate = costCentreOptions.some((o) => o.toLowerCase() === name.toLowerCase());
                if (isDuplicate) {
                  setCostCentreError('This cost centre already exists. Please enter a different name.');
                  return;
                }
                try {
                  // POST /api/v1/cost-centres/ with { name, company_id }
                  const created = await configuratorDataService.createCostCentre(name);
                  try {
                    const freshList = await configuratorDataService.getCostCentres();
                    setConfigCostCentres(freshList.map((c) => ({ id: c.id, name: c.name })));
                    setCostCentreOptions(freshList.map((c) => c.name).sort((a, b) => a.localeCompare(b)));
                    const newCC = freshList.find((c) => c.name.toLowerCase() === name.toLowerCase());
                    setSelectedConfigCostCentreId(newCC?.id ?? created.id ?? null);
                  } catch {
                    setCostCentreOptions((prev) => [...prev, name].sort((a, b) => a.localeCompare(b)));
                    setSelectedConfigCostCentreId(created.id ?? null);
                  }
                  setFormData((prev) => ({ ...prev, costCentre: name, departmentId: '', subDepartment: '' }));
                  setNewCostCentreName('');
                  setCostCentreError('');
                  setShowCostCentreModal(false);
                } catch (err: any) {
                  const detail = err.response?.data?.detail;
                  const errMsg = Array.isArray(detail) ? detail.map((d: any) => `${d.loc?.join('.')}: ${d.msg}`).join('; ') : (typeof detail === 'string' ? detail : err.response?.data?.message || err.message || 'Failed to add cost centre. Try again.');
                  console.error('Cost centre creation error detail:', JSON.stringify(err.response?.data));
                  setCostCentreError(errMsg);
                }
              }}
              disabled={!newCostCentreName.trim()}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Cost Centre
            </button>
          </div>
        </div>
      </Modal>
    )}

    {/* Add User Role Modal */}
    {showUserRoleModal && (
      <Modal
        isOpen={showUserRoleModal}
        onClose={() => {
          setShowUserRoleModal(false);
          setNewUserRoleName('');
          setUserRoleError('');
        }}
        title="Add User Role"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="newUserRoleName" className="block text-sm font-medium text-gray-700">
              User Role Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="newUserRoleName"
              value={newUserRoleName}
              onChange={(e) => {
                setNewUserRoleName(e.target.value);
                if (userRoleError) setUserRoleError('');
              }}
              onKeyDown={async (e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const name = newUserRoleName.trim();
                  if (!name) return;
                  const isDuplicate = userRoleOptions.some((o) => o.name.toLowerCase() === name.toLowerCase());
                  if (isDuplicate) {
                    setUserRoleError('This user role already exists. Please enter a different name.');
                    return;
                  }
                  try {
                    const created = await configuratorDataService.createUserRole(name);
                    try {
                      const freshList = await configuratorDataService.getUserRoles();
                      setUserRoleOptions(freshList.map((r) => ({ id: r.role_id, name: r.name })));
                      const newRole = freshList.find((r) => r.name.toLowerCase() === name.toLowerCase());
                      setSelectedUserRoleId(newRole?.role_id ?? created.role_id ?? null);
                      setFormData((prev) => ({ ...prev, userRoleId: String(newRole?.role_id ?? created.role_id ?? '') }));
                    } catch {
                      setUserRoleOptions((prev) => [...prev, { id: created.role_id, name: created.name || name }]);
                      setSelectedUserRoleId(created.role_id ?? null);
                      setFormData((prev) => ({ ...prev, userRoleId: String(created.role_id ?? '') }));
                    }
                    setNewUserRoleName('');
                    setUserRoleError('');
                    setShowUserRoleModal(false);
                  } catch (err: any) {
                    const detail = err.response?.data?.detail;
                    const errMsg = Array.isArray(detail) ? detail.map((d: any) => `${d.loc?.join('.')}: ${d.msg}`).join('; ') : (typeof detail === 'string' ? detail : err.response?.data?.message || err.message || 'Failed to add user role. Try again.');
                    setUserRoleError(errMsg);
                  }
                }
              }}
              className={`mt-1 block w-full h-10 bg-white text-black rounded-md border shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                userRoleError ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="e.g., Admin, Manager, Employee"
            />
            {userRoleError && <p className="mt-1 text-sm text-red-600">{userRoleError}</p>}
          </div>
          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setShowUserRoleModal(false);
                setNewUserRoleName('');
                setUserRoleError('');
              }}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                const name = newUserRoleName.trim();
                if (!name) return;
                const isDuplicate = userRoleOptions.some((o) => o.name.toLowerCase() === name.toLowerCase());
                if (isDuplicate) {
                  setUserRoleError('This user role already exists. Please enter a different name.');
                  return;
                }
                try {
                  const created = await configuratorDataService.createUserRole(name);
                  try {
                    const freshList = await configuratorDataService.getUserRoles();
                    setUserRoleOptions(freshList.map((r) => ({ id: r.role_id, name: r.name })));
                    const newRole = freshList.find((r) => r.name.toLowerCase() === name.toLowerCase());
                    setSelectedUserRoleId(newRole?.role_id ?? created.role_id ?? null);
                    setFormData((prev) => ({ ...prev, userRoleId: String(newRole?.role_id ?? created.role_id ?? '') }));
                  } catch {
                    setUserRoleOptions((prev) => [...prev, { id: created.role_id, name: created.name || name }]);
                    setSelectedUserRoleId(created.role_id ?? null);
                    setFormData((prev) => ({ ...prev, userRoleId: String(created.role_id ?? '') }));
                  }
                  setNewUserRoleName('');
                  setUserRoleError('');
                  setShowUserRoleModal(false);
                } catch (err: any) {
                  const detail = err.response?.data?.detail;
                  const errMsg = Array.isArray(detail) ? detail.map((d: any) => `${d.loc?.join('.')}: ${d.msg}`).join('; ') : (typeof detail === 'string' ? detail : err.response?.data?.message || err.message || 'Failed to add user role. Try again.');
                  setUserRoleError(errMsg);
                }
              }}
              disabled={!newUserRoleName.trim()}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add User Role
            </button>
          </div>
        </div>
      </Modal>
    )}

    {/* Asset Form Modal */}
    {showAssetModal && (
      <Modal
        isOpen={showAssetModal}
        onClose={() => setShowAssetModal(false)}
        title="Add Asset"
        size="2xl"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const assetId = assetFormData.assetId || `ASSET-${Date.now()}`;
            if (assets.find(a => a.id === assetId)) {
              // Update existing
              setAssets(assets.map(a => a.id === assetId ? { ...assetFormData, id: assetId } : a));
            } else {
              // Add new
              setAssets([...assets, { ...assetFormData, id: assetId }]);
            }
            setShowAssetModal(false);
            setAssetFormData({
              assetName: '',
              serialNumber: '',
              dateOfIssuance: '',
              assetId: '',
              make: '',
              model: '',
              colour: '',
              inchargeName: '',
              remarks: '',
              released: false,
            });
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Asset Name</label>
              <input
                type="text"
                value={assetFormData.assetName}
                onChange={(e) => setAssetFormData({ ...assetFormData, assetName: e.target.value })}
                className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Serial Number</label>
              <input
                type="text"
                value={assetFormData.serialNumber}
                onChange={(e) => setAssetFormData({ ...assetFormData, serialNumber: e.target.value })}
                className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Date of Issuance</label>
              <div className="relative">
                <input
                  type="date"
                  value={assetFormData.dateOfIssuance}
                  onChange={(e) => setAssetFormData({ ...assetFormData, dateOfIssuance: e.target.value })}
                  className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm pl-3 pr-10"
                />
                <span role="button" tabIndex={0} className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 cursor-pointer hover:text-gray-600" onClick={(e) => { e.preventDefault(); e.stopPropagation(); const input = (e.currentTarget.parentElement as HTMLElement).querySelector('input[type=date]'); if (input && typeof (input as HTMLInputElement).showPicker === 'function') (input as HTMLInputElement).showPicker(); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const input = (e.currentTarget.parentElement as HTMLElement).querySelector('input[type=date]'); if (input && typeof (input as HTMLInputElement).showPicker === 'function') (input as HTMLInputElement).showPicker(); } }}>
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Asset ID</label>
              <input
                type="text"
                value={assetFormData.assetId}
                onChange={(e) => setAssetFormData({ ...assetFormData, assetId: e.target.value })}
                className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Make</label>
              <input
                type="text"
                value={assetFormData.make}
                onChange={(e) => setAssetFormData({ ...assetFormData, make: e.target.value })}
                className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Model</label>
              <input
                type="text"
                value={assetFormData.model}
                onChange={(e) => setAssetFormData({ ...assetFormData, model: e.target.value })}
                className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Colour</label>
              <input
                type="text"
                value={assetFormData.colour}
                onChange={(e) => setAssetFormData({ ...assetFormData, colour: e.target.value })}
                className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Incharge Name</label>
              <input
                type="text"
                value={assetFormData.inchargeName}
                onChange={(e) => setAssetFormData({ ...assetFormData, inchargeName: e.target.value })}
                className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Remarks</label>
              <textarea
                value={assetFormData.remarks}
                onChange={(e) => setAssetFormData({ ...assetFormData, remarks: e.target.value })}
                rows={3}
                className="mt-1 block w-full bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Released</label>
              <div className="mt-1 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setAssetFormData({ ...assetFormData, released: true })}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium border ${
                    assetFormData.released
                      ? 'bg-green-500 border-green-600 text-white'
                      : 'bg-white border-black text-gray-700'
                  }`}
                >
                  YES
                </button>
                <button
                  type="button"
                  onClick={() => setAssetFormData({ ...assetFormData, released: false })}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium border ${
                    !assetFormData.released
                      ? 'bg-red-500 border-red-600 text-white'
                      : 'bg-white border-black text-gray-700'
                  }`}
                >
                  NO
                </button>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => setShowAssetModal(false)}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              Save
            </button>
          </div>
        </form>
      </Modal>
    )}

    {/* Academic Qualification Form Modal */}
    {showAcademicModal && (
      <Modal
        isOpen={showAcademicModal}
        onClose={() => setShowAcademicModal(false)}
        title="Add Academic Qualification"
        size="2xl"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const qualId = academicFormData.degree + '-' + academicFormData.yearOfPassing || `QUAL-${Date.now()}`;
            if (academicQualifications.find(q => q.id === qualId)) {
              // Update existing
              setAcademicQualifications(academicQualifications.map(q => q.id === qualId ? { ...academicFormData, id: qualId } : q));
            } else {
              // Add new
              setAcademicQualifications([...academicQualifications, { ...academicFormData, id: qualId }]);
            }
            setShowAcademicModal(false);
            setAcademicFormData({
              degree: '',
              discipline: '',
              university: '',
              grade: '',
              percentage: '',
              yearOfPassing: '',
              nameOfInstitution: '',
              remarks: '',
            });
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Degree</label>
              <input
                type="text"
                value={academicFormData.degree}
                onChange={(e) => setAcademicFormData({ ...academicFormData, degree: e.target.value })}
                className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Discipline</label>
              <input
                type="text"
                value={academicFormData.discipline}
                onChange={(e) => setAcademicFormData({ ...academicFormData, discipline: e.target.value })}
                className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">University</label>
              <input
                type="text"
                value={academicFormData.university}
                onChange={(e) => setAcademicFormData({ ...academicFormData, university: e.target.value })}
                className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Grade</label>
              <input
                type="text"
                value={academicFormData.grade}
                onChange={(e) => setAcademicFormData({ ...academicFormData, grade: e.target.value })}
                className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Percentage</label>
              <input
                type="text"
                value={academicFormData.percentage}
                onChange={(e) => setAcademicFormData({ ...academicFormData, percentage: e.target.value })}
                className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Year of Passing</label>
              <input
                type="text"
                value={academicFormData.yearOfPassing}
                onChange={(e) => setAcademicFormData({ ...academicFormData, yearOfPassing: e.target.value })}
                className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Name of Institution</label>
              <input
                type="text"
                value={academicFormData.nameOfInstitution}
                onChange={(e) => setAcademicFormData({ ...academicFormData, nameOfInstitution: e.target.value })}
                className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Remarks</label>
              <textarea
                value={academicFormData.remarks}
                onChange={(e) => setAcademicFormData({ ...academicFormData, remarks: e.target.value })}
                rows={3}
                className="mt-1 block w-full bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => setShowAcademicModal(false)}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              Save
            </button>
          </div>
        </form>
      </Modal>
    )}

    {/* Previous Employment Form Modal */}
    {showPreviousEmploymentModal && (
      <Modal
        isOpen={showPreviousEmploymentModal}
        onClose={() => setShowPreviousEmploymentModal(false)}
        title="Add Previous Employment"
        size="2xl"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const empId = previousEmploymentFormData.organization + '-' + previousEmploymentFormData.fromDate || `EMP-${Date.now()}`;
            if (previousEmployments.find(e => e.id === empId)) {
              // Update existing
              setPreviousEmployments(previousEmployments.map(e => e.id === empId ? { ...previousEmploymentFormData, id: empId } : e));
            } else {
              // Add new
              setPreviousEmployments([...previousEmployments, { ...previousEmploymentFormData, id: empId }]);
            }
            setShowPreviousEmploymentModal(false);
            setPreviousEmploymentFormData({
              organization: '',
              designation: '',
              fromDate: '',
              toDate: '',
              yearsOfExperience: '',
              relevantExperience: '',
              remarks: '',
              ctc: '',
            });
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Organization</label>
              <input
                type="text"
                value={previousEmploymentFormData.organization}
                onChange={(e) => setPreviousEmploymentFormData({ ...previousEmploymentFormData, organization: e.target.value })}
                className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Designation</label>
              <input
                type="text"
                value={previousEmploymentFormData.designation}
                onChange={(e) => setPreviousEmploymentFormData({ ...previousEmploymentFormData, designation: e.target.value })}
                className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">From Date</label>
              <div className="relative">
                <input
                  type="date"
                  value={previousEmploymentFormData.fromDate}
                  onChange={(e) => setPreviousEmploymentFormData({ ...previousEmploymentFormData, fromDate: e.target.value })}
                  className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm pl-3 pr-10"
                />
                <span role="button" tabIndex={0} className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 cursor-pointer hover:text-gray-600" onClick={(e) => { e.preventDefault(); e.stopPropagation(); const input = (e.currentTarget.parentElement as HTMLElement).querySelector('input[type=date]'); if (input && typeof (input as HTMLInputElement).showPicker === 'function') (input as HTMLInputElement).showPicker(); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const input = (e.currentTarget.parentElement as HTMLElement).querySelector('input[type=date]'); if (input && typeof (input as HTMLInputElement).showPicker === 'function') (input as HTMLInputElement).showPicker(); } }}>
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">To Date</label>
              <div className="relative">
                <input
                  type="date"
                  value={previousEmploymentFormData.toDate}
                  onChange={(e) => setPreviousEmploymentFormData({ ...previousEmploymentFormData, toDate: e.target.value })}
                  className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm pl-3 pr-10"
                />
                <span role="button" tabIndex={0} className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 cursor-pointer hover:text-gray-600" onClick={(e) => { e.preventDefault(); e.stopPropagation(); const input = (e.currentTarget.parentElement as HTMLElement).querySelector('input[type=date]'); if (input && typeof (input as HTMLInputElement).showPicker === 'function') (input as HTMLInputElement).showPicker(); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const input = (e.currentTarget.parentElement as HTMLElement).querySelector('input[type=date]'); if (input && typeof (input as HTMLInputElement).showPicker === 'function') (input as HTMLInputElement).showPicker(); } }}>
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Years of Experience</label>
              <input
                type="text"
                value={previousEmploymentFormData.yearsOfExperience}
                onChange={(e) => setPreviousEmploymentFormData({ ...previousEmploymentFormData, yearsOfExperience: e.target.value })}
                className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Relevant experience</label>
              <input
                type="text"
                value={previousEmploymentFormData.relevantExperience}
                onChange={(e) => setPreviousEmploymentFormData({ ...previousEmploymentFormData, relevantExperience: e.target.value })}
                className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">CTC (Cost to Company)</label>
              <input
                type="text"
                value={previousEmploymentFormData.ctc}
                onChange={(e) => setPreviousEmploymentFormData({ ...previousEmploymentFormData, ctc: e.target.value })}
                className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Remarks</label>
              <textarea
                value={previousEmploymentFormData.remarks}
                onChange={(e) => setPreviousEmploymentFormData({ ...previousEmploymentFormData, remarks: e.target.value })}
                rows={3}
                className="mt-1 block w-full bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => setShowPreviousEmploymentModal(false)}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              Save
            </button>
          </div>
        </form>
      </Modal>
    )}

    {/* Family Details Form Modal */}
    {showFamilyModal && (
      <Modal
        isOpen={showFamilyModal}
        onClose={() => setShowFamilyModal(false)}
        title="Family"
        size="2xl"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const memberId = familyFormData.firstName + '-' + familyFormData.relationship || `FAM-${Date.now()}`;
            if (familyMembers.find(m => m.id === memberId)) {
              // Update existing
              setFamilyMembers(familyMembers.map(m => m.id === memberId ? { ...familyFormData, id: memberId } : m));
            } else {
              // Add new
              setFamilyMembers([...familyMembers, { ...familyFormData, id: memberId }]);
            }
            setShowFamilyModal(false);
            setFamilyFormData({
              firstName: '',
              lastName: '',
              relationship: '',
              dateOfBirth: '',
              phoneNumber: '',
              occupation: '',
              address: '',
              aadhaarNumber: '',
              passportNumber: '',
              passportIssueDate: '',
              passportExpiryDate: '',
              pfShare: '',
              gratuityShare: '',
              nominationRemarks: '',
            });
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                First Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={familyFormData.firstName}
                onChange={(e) => setFamilyFormData({ ...familyFormData, firstName: e.target.value })}
                className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="First Name"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Last Name</label>
              <input
                type="text"
                value={familyFormData.lastName}
                onChange={(e) => setFamilyFormData({ ...familyFormData, lastName: e.target.value })}
                className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Last Name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Relationship <span className="text-red-500">*</span>
              </label>
              <select
                value={familyFormData.relationship}
                onChange={(e) => setFamilyFormData({ ...familyFormData, relationship: e.target.value })}
                className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                required
              >
                <option value="">-- Select --</option>
                <option value="Spouse">Spouse</option>
                <option value="Father">Father</option>
                <option value="Mother">Mother</option>
                <option value="Son">Son</option>
                <option value="Daughter">Daughter</option>
                <option value="Brother">Brother</option>
                <option value="Sister">Sister</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
              <div className="relative mt-1 h-10 rounded-md bg-white shadow-sm border border-black focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
                <input
                  type="date"
                  value={familyFormData.dateOfBirth || ''}
                  onChange={(e) => setFamilyFormData((prev) => ({ ...prev, dateOfBirth: e.target.value }))}
                  className="block w-full h-full bg-transparent text-black rounded-md border-none outline-none focus:outline-none sm:text-sm pl-3 pr-10"
                />
                <span role="button" tabIndex={0} className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 cursor-pointer hover:text-gray-600" onClick={(e) => { e.preventDefault(); e.stopPropagation(); const input = (e.currentTarget.parentElement as HTMLElement).querySelector('input[type=date]'); if (input && typeof (input as HTMLInputElement).showPicker === 'function') (input as HTMLInputElement).showPicker(); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const input = (e.currentTarget.parentElement as HTMLElement).querySelector('input[type=date]'); if (input && typeof (input as HTMLInputElement).showPicker === 'function') (input as HTMLInputElement).showPicker(); } }}>
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Phone Number</label>
              <input
                type="tel"
                value={familyFormData.phoneNumber}
                onChange={(e) => setFamilyFormData({ ...familyFormData, phoneNumber: e.target.value })}
                className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Phone Number"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Occupation</label>
              <input
                type="text"
                value={familyFormData.occupation}
                onChange={(e) => setFamilyFormData({ ...familyFormData, occupation: e.target.value })}
                className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Occupation"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Address</label>
              <textarea
                value={familyFormData.address}
                onChange={(e) => setFamilyFormData({ ...familyFormData, address: e.target.value })}
                rows={3}
                className="mt-1 block w-full bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Address"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Aadhaar Number</label>
              <input
                type="text"
                value={familyFormData.aadhaarNumber}
                onChange={(e) => setFamilyFormData({ ...familyFormData, aadhaarNumber: e.target.value })}
                className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Aadhaar Number"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Passport Number</label>
              <input
                type="text"
                value={familyFormData.passportNumber}
                onChange={(e) => setFamilyFormData({ ...familyFormData, passportNumber: e.target.value })}
                className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Passport Number"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Passport Issue Date</label>
              <div className="relative mt-1 h-10 rounded-md bg-white shadow-sm border border-black focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
                <input
                  type="date"
                  value={familyFormData.passportIssueDate || ''}
                  onChange={(e) => setFamilyFormData((prev) => ({ ...prev, passportIssueDate: e.target.value }))}
                  className="block w-full h-full bg-transparent text-black rounded-md border-none outline-none focus:outline-none sm:text-sm pl-3 pr-10"
                />
                <span role="button" tabIndex={0} className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 cursor-pointer hover:text-gray-600" onClick={(e) => { e.preventDefault(); e.stopPropagation(); const input = (e.currentTarget.parentElement as HTMLElement).querySelector('input[type=date]'); if (input && typeof (input as HTMLInputElement).showPicker === 'function') (input as HTMLInputElement).showPicker(); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const input = (e.currentTarget.parentElement as HTMLElement).querySelector('input[type=date]'); if (input && typeof (input as HTMLInputElement).showPicker === 'function') (input as HTMLInputElement).showPicker(); } }}>
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Passport Expiry Date</label>
              <div className="relative mt-1 h-10 rounded-md bg-white shadow-sm border border-black focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
                <input
                  type="date"
                  value={familyFormData.passportExpiryDate || ''}
                  onChange={(e) => setFamilyFormData((prev) => ({ ...prev, passportExpiryDate: e.target.value }))}
                  className="block w-full h-full bg-transparent text-black rounded-md border-none outline-none focus:outline-none sm:text-sm pl-3 pr-10"
                />
                <span role="button" tabIndex={0} className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 cursor-pointer hover:text-gray-600" onClick={(e) => { e.preventDefault(); e.stopPropagation(); const input = (e.currentTarget.parentElement as HTMLElement).querySelector('input[type=date]'); if (input && typeof (input as HTMLInputElement).showPicker === 'function') (input as HTMLInputElement).showPicker(); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const input = (e.currentTarget.parentElement as HTMLElement).querySelector('input[type=date]'); if (input && typeof (input as HTMLInputElement).showPicker === 'function') (input as HTMLInputElement).showPicker(); } }}>
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </span>
              </div>
            </div>
          </div>

          {/* Nomination Section */}
          <div className="bg-gray-50 border rounded-lg p-4 text-left">
            <h4 className="text-base font-semibold text-gray-900 mb-4">Nomination</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">PF Share Percentage</label>
                <input
                  type="text"
                  value={familyFormData.pfShare}
                  onChange={(e) => setFamilyFormData({ ...familyFormData, pfShare: e.target.value })}
                  className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Percentage"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Gratuity Share Percentage</label>
                <input
                  type="text"
                  value={familyFormData.gratuityShare}
                  onChange={(e) => setFamilyFormData({ ...familyFormData, gratuityShare: e.target.value })}
                  className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Percentage"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Remarks</label>
                <textarea
                  value={familyFormData.nominationRemarks}
                  onChange={(e) => setFamilyFormData({ ...familyFormData, nominationRemarks: e.target.value })}
                  rows={3}
                  className="mt-1 block w-full bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Nomination Remarks"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => setShowFamilyModal(false)}
              className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 text-sm font-medium flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 text-sm font-medium flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Save
            </button>
          </div>
        </form>
      </Modal>
    )}

    {/* Certifications Form Modal */}
    {showCertificationModal && (
      <Modal
        isOpen={showCertificationModal}
        onClose={() => setShowCertificationModal(false)}
        title="Certifications"
        size="2xl"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const certId = certificationFormData.skillSet || `CERT-${Date.now()}`;
            if (certifications.find(c => c.id === certId)) {
              // Update existing
              setCertifications(certifications.map(c => c.id === certId ? { ...certificationFormData, id: certId } : c));
            } else {
              // Add new
              setCertifications([...certifications, { ...certificationFormData, id: certId }]);
            }
            setShowCertificationModal(false);
            setCertificationFormData({
              skillSet: '',
              yearsOfExperience: '',
              certifiedBy: '',
              remarks: '',
            });
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Skill Set <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={certificationFormData.skillSet}
                onChange={(e) => setCertificationFormData({ ...certificationFormData, skillSet: e.target.value })}
                className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Skill Set"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Years of Experience</label>
              <input
                type="text"
                value={certificationFormData.yearsOfExperience}
                onChange={(e) => setCertificationFormData({ ...certificationFormData, yearsOfExperience: e.target.value })}
                className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Years of Experience"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Certified By</label>
              <input
                type="text"
                value={certificationFormData.certifiedBy}
                onChange={(e) => setCertificationFormData({ ...certificationFormData, certifiedBy: e.target.value })}
                className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Certified By"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Remarks</label>
              <textarea
                value={certificationFormData.remarks}
                onChange={(e) => setCertificationFormData({ ...certificationFormData, remarks: e.target.value })}
                rows={3}
                className="mt-1 block w-full bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Remarks"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => setShowCertificationModal(false)}
              className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 text-sm font-medium flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 text-sm font-medium flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Save
            </button>
          </div>
        </form>
      </Modal>
    )}

    {/* Known Languages Form Modal */}
    {showKnownLanguageModal && (
      <Modal
        isOpen={showKnownLanguageModal}
        onClose={() => setShowKnownLanguageModal(false)}
        title="Known Languages"
        size="2xl"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const langId = knownLanguageFormData.language || `LANG-${Date.now()}`;
            if (knownLanguages.find(l => l.id === langId)) {
              // Update existing
              setKnownLanguages(knownLanguages.map(l => l.id === langId ? { ...knownLanguageFormData, id: langId } : l));
            } else {
              // Add new
              setKnownLanguages([...knownLanguages, { ...knownLanguageFormData, id: langId }]);
            }
            setShowKnownLanguageModal(false);
            setKnownLanguageFormData({
              language: '',
              speak: '',
              write: '',
              read: '',
            });
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Language <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={knownLanguageFormData.language}
                onChange={(e) => setKnownLanguageFormData({ ...knownLanguageFormData, language: e.target.value })}
                className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Language"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Speak</label>
              <select
                value={knownLanguageFormData.speak}
                onChange={(e) => setKnownLanguageFormData({ ...knownLanguageFormData, speak: e.target.value })}
                className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value="">Select --</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Write</label>
              <select
                value={knownLanguageFormData.write}
                onChange={(e) => setKnownLanguageFormData({ ...knownLanguageFormData, write: e.target.value })}
                className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value="">Select --</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Read</label>
              <select
                value={knownLanguageFormData.read}
                onChange={(e) => setKnownLanguageFormData({ ...knownLanguageFormData, read: e.target.value })}
                className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value="">Select --</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => setShowKnownLanguageModal(false)}
              className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 text-sm font-medium flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 text-sm font-medium flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Save
            </button>
          </div>
        </form>
      </Modal>
    )}
  </>
  );
};

export default EmployeeForm;
