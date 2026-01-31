import React, { useEffect, useState } from 'react';
import { useEmployeeStore } from '../../store/employeeStore';
import { useDepartmentStore } from '../../store/departmentStore';
import { usePositionStore } from '../../store/positionStore';
import employeeService, { Employee, Gender, MaritalStatus, EmployeeStatus } from '../../services/employee.service';
import api from '../../services/api';
import { subDepartmentService } from '../../services/sub-department.service';
import Modal from '../common/Modal';
import DepartmentForm from '../departments/DepartmentForm';
import PositionForm from '../positions/PositionForm';

interface EmployeeFormProps {
  employee?: Employee | null;
  organizationId: string;
  initialPaygroupId?: string;
  initialPaygroupName?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const EmployeeForm: React.FC<EmployeeFormProps> = ({
  employee,
  organizationId,
  initialPaygroupId,
  initialPaygroupName,
  onSuccess,
  onCancel,
}) => {
  const { createEmployee, updateEmployee, loading, fetchEmployees, employees } = useEmployeeStore();
  const { departments, fetchDepartments } = useDepartmentStore();
  const { positions, fetchPositions } = usePositionStore();
  const [availableManagers, setAvailableManagers] = useState<Employee[]>([]);
  const [locations, setLocations] = useState<{ id: string; name: string; code?: string }[]>([]);
  const [costCentres, setCostCentres] = useState<{ id: string; name: string; code?: string }[]>([]);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [createdEmployeeEmail, setCreatedEmployeeEmail] = useState<string>('');
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [showPositionModal, setShowPositionModal] = useState(false);
  const [showSubDepartmentModal, setShowSubDepartmentModal] = useState(false);
  const [newSubDepartmentName, setNewSubDepartmentName] = useState('');
  const [subDepartmentError, setSubDepartmentError] = useState('');
  const [subDepartmentOptions, setSubDepartmentOptions] = useState<string[]>([]);
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [showAcademicModal, setShowAcademicModal] = useState(false);
  const [showPreviousEmploymentModal, setShowPreviousEmploymentModal] = useState(false);
  const [showFamilyModal, setShowFamilyModal] = useState(false);
  const [showCertificationModal, setShowCertificationModal] = useState(false);
  const [showKnownLanguageModal, setShowKnownLanguageModal] = useState(false);

  const [salaryTab, setSalaryTab] = useState<'earnings' | 'deductions' | 'reimbursement'>('earnings');
  const [othersTab, setOthersTab] = useState<'certifications' | 'knownLanguages'>('certifications');
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
    'company' | 'personal' | 'employment' | 'statutory' | 'bank' | 'salary' | 'assets' | 'academic' | 'previousEmployment' | 'family' | 'others' | 'newFields'
  >(
    initialPaygroupId || (employee as any)?.paygroupId || (employee as any)?.paygroup ? 'company' : 'personal'
  );

  const [formData, setFormData] = useState({
    // Company Details (Module 2)
    paygroupDisplay: initialPaygroupName || (employee as any)?.paygroup?.name || '',
    firstName: employee?.firstName || '',
    middleName: (employee as any)?.middleName || '',
    lastName: employee?.lastName || '',
    gender: employee?.gender || '',
    dateOfBirth: employee?.dateOfBirth ? employee.dateOfBirth.split('T')[0] : '',
    joiningDate: employee?.dateOfJoining ? employee.dateOfJoining.split('T')[0] : '',
    officialEmail: (employee as any)?.officialEmail || '',
    officialMobile: (employee as any)?.officialMobile || '',
    departmentId: employee?.departmentId || '',
    subDepartmentId: (employee as any)?.subDepartmentId || '',
    subDepartment: (employee as any)?.subDepartment || '',
    positionId: employee?.positionId || '',
    locationId: (employee as any)?.locationId || '',
    costCentreId: (employee as any)?.costCentreId || '',
    costCentre: (employee as any)?.costCentre?.name || '',
    managerId: employee?.reportingManagerId || '',
    grade: (employee as any)?.grade || '',
    placeOfTaxDeduction: (employee as any)?.placeOfTaxDeduction || '',
    jobResponsibility: (employee as any)?.jobResponsibility || '',
    // Statutory Details
    pfNumber: (employee as any)?.pfNumber || '',
    esiNumber: (employee as any)?.esiNumber || '',
    pfApplicable: (employee as any)?.pfApplicable ?? false,
    esiApplicable: (employee as any)?.esiApplicable ?? false,
    taxApplicable: (employee as any)?.taxApplicable ?? false,
    uanNumber: (employee as any)?.uanNumber || '',
    panNumber: (employee as any)?.panNumber || '',
    pTaxLocation: (employee as any)?.pTaxLocation || '',
    dateOfRetirement: (employee as any)?.dateOfRetirement
      ? (employee as any).dateOfRetirement.split('T')[0]
      : '',
    expatriate: (employee as any)?.expatriate ?? false,
    pfTransferred: (employee as any)?.pfTransferred ?? false,
    esiDispensary: (employee as any)?.esiDispensary || '',
    gratuityApplicable: (employee as any)?.gratuityApplicable ?? false,
    confirmationPeriod: (employee as any)?.confirmationPeriod || '',
    pfApplicableFrom: !!(employee as any)?.pfApplicableFrom,
    lwfLocation: (employee as any)?.lwfLocation || '',
    taxRegime: (employee as any)?.taxRegime || 'OLD',
    aadhaarNumber: (employee as any)?.aadhaarNumber || '',
    dateOfProbationary: employee?.probationEndDate ? employee.probationEndDate.split('T')[0] : '',
    dateOfConfirmation: employee?.confirmationDate ? employee.confirmationDate.split('T')[0] : '',
    noticePeriodDays:
      (employee as any)?.noticePeriodDays !== undefined && (employee as any)?.noticePeriodDays !== null
        ? String((employee as any).noticePeriodDays)
        : '',
    husbandNameOnOnlinePf: (employee as any)?.husbandNameOnOnlinePf || '',
    // Bank Details
    bankName: (employee as any)?.bankDetails?.bankName || '',
    bankAccountNumber: (employee as any)?.bankDetails?.accountNumber || '',
    bankIfscCode: (employee as any)?.bankDetails?.ifscCode || '',
    bankPaymentMode: (employee as any)?.bankDetails?.paymentMode || '',
    bankCurrency: (employee as any)?.bankDetails?.currency || '',
    // Personal (login email required for create)
    email: employee?.email || '',
    phoneNumber: employee?.phone || '',
    maritalStatus: employee?.maritalStatus || '',
    // Permanent Address
    permanentAddress: (employee as any)?.permanentAddress || '',
    permanentCity: (employee as any)?.permanentCity || '',
    permanentDistrict: (employee as any)?.permanentDistrict || '',
    permanentState: (employee as any)?.permanentState || '',
    permanentPincode: (employee as any)?.permanentPincode || '',
    permanentPhoneNumber: (employee as any)?.permanentPhoneNumber || '',
    personalMobile: (employee as any)?.personalMobile || '',
    personalEmail: (employee as any)?.personalEmail || employee?.personalEmail || '',
    // Present Address
    sameAsPermanent: (employee as any)?.sameAsPermanent ?? false,
    presentAddress: (employee as any)?.presentAddress || '',
    presentCity: (employee as any)?.presentCity || '',
    presentDistrict: (employee as any)?.presentDistrict || '',
    presentState: (employee as any)?.presentState || '',
    presentPincode: (employee as any)?.presentPincode || '',
    presentPhoneNumber: (employee as any)?.presentPhoneNumber || '',
    // Others
    bloodGroup: (employee as any)?.bloodGroup || '',
    dateOfWedding: (employee as any)?.dateOfWedding ? (employee as any).dateOfWedding.split('T')[0] : '',
    children: (employee as any)?.children || '',
    physicallyChallenged: (employee as any)?.physicallyChallenged ?? false,
    physicallyChallengedRemarks: (employee as any)?.physicallyChallengedRemarks || '',
    passportNumber: (employee as any)?.passportNumber || '',
    passportExpiry: (employee as any)?.passportExpiry ? (employee as any).passportExpiry.split('T')[0] : '',
    drivingLicenseNumber: (employee as any)?.drivingLicenseNumber || '',
    drivingLicenseExpiry: (employee as any)?.drivingLicenseExpiry ? (employee as any).drivingLicenseExpiry.split('T')[0] : '',
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
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialPaygroupName) {
      setFormData((prev) => ({ ...prev, paygroupDisplay: initialPaygroupName }));
    }
  }, [initialPaygroupName]);

  useEffect(() => {
    fetchDepartments(organizationId);
    fetchPositions({ organizationId, limit: 100 });
    fetchManagersForDropdown();
    const fetchLocations = async () => {
      try {
        const { data } = await api.get<{ data: { locations: { id: string; name: string; code?: string }[] } }>('/locations', { params: { organizationId } });
        setLocations(data.data?.locations ?? []);
      } catch {
        setLocations([]);
      }
    };
    const fetchCostCentres = async () => {
      try {
        const { data } = await api.get<{ data: { costCentres: { id: string; name: string; code?: string }[] } }>('/cost-centres', { params: { organizationId } });
        const list = data.data?.costCentres ?? [];
        setCostCentres(list);
        if (employee?.id && (employee as any)?.costCentreId) {
          const match = list.find((c: { id: string }) => c.id === (employee as any).costCentreId);
          if (match) setFormData((prev) => ({ ...prev, costCentre: match.name }));
        }
      } catch {
        setCostCentres([]);
      }
    };
    const fetchSubDepartments = async () => {
      try {
        const list = await subDepartmentService.getByOrganization(organizationId);
        setSubDepartmentOptions(list.map((s) => s.name).sort((a, b) => a.localeCompare(b)));
      } catch {
        setSubDepartmentOptions([]);
      }
    };
    fetchLocations();
    fetchCostCentres();
    fetchSubDepartments();
  }, [organizationId, fetchDepartments, fetchPositions, employee?.id]);

  // When editing, merge employee's sub-department name into options if not already loaded from API
  useEffect(() => {
    const value = (employee as any)?.subDepartment;
    if (!value || typeof value !== 'string') return;
    const name = value.split(',')[0]?.trim();
    if (!name) return;
    setSubDepartmentOptions((prev) => {
      if (prev.some((o) => o.toLowerCase() === name.toLowerCase())) return prev;
      return [...prev, name].sort((a, b) => a.localeCompare(b));
    });
  }, [employee?.id]);

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
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validateCompany = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!formData.gender) newErrors.gender = 'Gender is required';
    if (!formData.dateOfBirth) newErrors.dateOfBirth = 'Date of birth is required';
    if (!formData.joiningDate) newErrors.joiningDate = 'Date of joining is required';
    if (!formData.departmentId) newErrors.departmentId = 'Department is required';
    if (!formData.positionId) newErrors.positionId = 'Designation is required';
    if (initialPaygroupId && !formData.placeOfTaxDeduction) newErrors.placeOfTaxDeduction = 'Place of tax deduction is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validatePersonal = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (!formData.phoneNumber.trim()) {
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

  const validateEmployment = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.departmentId) {
      newErrors.departmentId = 'Department is required';
    }

    if (!formData.positionId) {
      newErrors.positionId = 'Position is required';
    }

    if (!formData.joiningDate) {
      newErrors.joiningDate = 'Joining date is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (currentTab === 'company' && validateCompany()) {
      setCurrentTab('personal');
    } else if (currentTab === 'personal' && validatePersonal()) {
      setCurrentTab('employment');
    } else if (currentTab === 'employment' && validateEmployment()) {
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
    }
  };

  const handleBack = () => {
    if (currentTab === 'newFields') setCurrentTab('others');
    else if (currentTab === 'others') setCurrentTab('family');
    else if (currentTab === 'family') setCurrentTab('previousEmployment');
    else if (currentTab === 'previousEmployment') setCurrentTab('academic');
    else if (currentTab === 'academic') setCurrentTab('assets');
    else if (currentTab === 'assets') setCurrentTab('salary');
    else if (currentTab === 'salary') setCurrentTab('bank');
    else if (currentTab === 'bank') setCurrentTab('statutory');
    else if (currentTab === 'statutory') setCurrentTab('employment');
    else if (currentTab === 'employment') setCurrentTab('personal');
    else if (currentTab === 'personal' && initialPaygroupId) setCurrentTab('company');
    else if (currentTab === 'personal') setCurrentTab('company');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (initialPaygroupId) {
      if (!validateCompany() || !validatePersonal() || !validateEmployment()) {
        if (!validateCompany()) setCurrentTab('company');
        else if (!validatePersonal()) setCurrentTab('personal');
        else setCurrentTab('employment');
        return;
      }
    } else {
      if (!validatePersonal() || !validateEmployment()) {
        setCurrentTab('personal');
        return;
      }
    }

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
        lastName: formData.lastName.trim(),
        email: formData.email.trim(),
        phone: emptyToUndefined(formData.phoneNumber),
        officialEmail: emptyToUndefined(formData.officialEmail) || null,
        officialMobile: emptyToUndefined(formData.officialMobile) || null,
        dateOfBirth: emptyToUndefined(formData.dateOfBirth),
        gender: formData.gender ? (formData.gender as Gender) : undefined,
        maritalStatus: formData.maritalStatus ? (formData.maritalStatus as MaritalStatus) : undefined,
        departmentId: formData.departmentId && formData.departmentId.trim() ? formData.departmentId : null,
        positionId: formData.positionId && formData.positionId.trim() ? formData.positionId : null,
        reportingManagerId: formData.managerId && formData.managerId.trim() ? formData.managerId : null,
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
        dateOfJoining: formData.joiningDate && formData.joiningDate.trim() ? formData.joiningDate.trim() : undefined,
        employeeStatus: formData.employeeStatus as EmployeeStatus,
        address: hasAddress ? addressFields : undefined,
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
      };
      if (initialPaygroupId) {
        submitData.paygroupId = initialPaygroupId;
      }

      // Remove undefined values for optional fields only (keep required fields even if undefined for validation)
      const requiredFields = ['organizationId', 'firstName', 'lastName', 'email', 'dateOfJoining'];
      Object.keys(submitData).forEach(key => {
        if (submitData[key] === undefined && !requiredFields.includes(key)) {
          delete submitData[key];
        }
      });
      
      // Final validation check - ensure required fields are present
      if (!submitData.dateOfJoining) {
        setErrors({ joiningDate: 'Joining date is required' });
        setCurrentTab('employment');
        return;
      }

      if (employee) {
        await updateEmployee(employee.id, submitData);
        onSuccess?.();
      } else {
        const result = await createEmployee(submitData);
        // Show temporary password modal if it was generated
        if (result.temporaryPassword) {
          setTemporaryPassword(result.temporaryPassword);
          setCreatedEmployeeEmail(formData.email.trim());
          setShowPasswordModal(true);
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
          // Map backend field names to form field names
          const fieldMap: Record<string, string> = {
            'dateOfJoining': 'joiningDate',
            'phoneNumber': 'phoneNumber',
            'dateOfBirth': 'dateOfBirth',
          };
          const formField = fieldMap[err.field] || err.field;
          validationErrors[formField] = err.message;
        });
        
        if (Object.keys(validationErrors).length > 0) {
          setErrors(validationErrors);
          // Switch to the appropriate tab based on the first error
          if (validationErrors.joiningDate || validationErrors.departmentId || validationErrors.positionId) {
            setCurrentTab('employment');
          } else if (validationErrors.firstName || validationErrors.lastName || validationErrors.email) {
            setCurrentTab('personal');
          }
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
    <form onSubmit={handleSubmit} className="space-y-6 w-full h-full">
      {/* Layout: Vertical tab menu on the left, content on the right */}
      <div className="flex gap-6 h-full">
        {/* Tab Navigation - vertical menu */}
        <div className="w-56 flex-shrink-0">
          <nav className="flex flex-col space-y-2 bg-white rounded-lg border border-gray-200 p-3">
          {(initialPaygroupId || (employee as any)?.paygroupId || (employee as any)?.paygroup) && (
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
          )}
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
            onClick={() => setCurrentTab('employment')}
            className={`${
              currentTab === 'employment'
                ? 'bg-blue-50 text-blue-600 border-blue-500'
                : 'bg-white text-gray-600 border-transparent hover:bg-gray-50 hover:text-gray-800'
            } w-full text-left px-3 py-2 rounded-md border text-sm font-medium`}
          >
            Employment
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
        </nav>
      </div>

      {/* Tab Content */}
      <div className="flex-1 space-y-6">

      {/* Company Details Tab */}
      {(initialPaygroupId || (employee as any)?.paygroupId || (employee as any)?.paygroup) && currentTab === 'company' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Paygroup</label>
              <input
                type="text"
                value={formData.paygroupDisplay}
                readOnly
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
              <label className="block text-sm font-medium text-gray-700">Last Name <span className="text-red-500">*</span></label>
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
              <input
                type="date"
                name="dateOfBirth"
                value={formData.dateOfBirth}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, dateOfBirth: e.target.value }));
                  if (errors.dateOfBirth) setErrors((prev) => { const next = { ...prev }; delete next.dateOfBirth; return next; });
                }}
                className={`mt-1 block w-full h-10 bg-white text-black rounded-md border shadow-sm sm:text-sm ${
                  errors.dateOfBirth ? 'border-red-500 focus:ring-red-500' : 'border-black focus:ring-blue-500'
                }`}
              />
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
              <input
                type="date"
                name="joiningDate"
                value={formData.joiningDate}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, joiningDate: e.target.value }));
                  if (errors.joiningDate) setErrors((prev) => { const next = { ...prev }; delete next.joiningDate; return next; });
                }}
                className={`mt-1 block w-full h-10 bg-white text-black rounded-md border shadow-sm sm:text-sm ${
                  errors.joiningDate ? 'border-red-500 focus:ring-red-500' : 'border-black focus:ring-blue-500'
                }`}
              />
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
            <div>
              <label className="block text-sm font-medium text-gray-700">Department <span className="text-red-500">*</span></label>
              <div className="flex gap-2">
                <select name="departmentId" value={formData.departmentId} onChange={(e) => {
                  handleChange(e);
                  setFormData((prev) => ({ ...prev, subDepartment: '' }));
                }}
                  className={`flex-1 mt-1 block w-full h-10 bg-white text-black rounded-md border shadow-sm sm:text-sm ${
                    errors.departmentId
                      ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500'
                      : 'border-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                  }`}>
                  <option value="">Department</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => setShowDepartmentModal(true)}
                  className="mt-1 px-3 h-10 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center justify-center"
                  title="Add New Department"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
              {errors.departmentId && <p className="mt-1 text-sm text-red-600">{errors.departmentId}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Sub-Department</label>
              <div className="flex gap-2">
                <select
                  name="subDepartment"
                  value={formData.subDepartment}
                  onChange={handleChange}
                  className="flex-1 mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  <option value="">Sub-Department</option>
                  {subDepartmentOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setShowSubDepartmentModal(true);
                    setNewSubDepartmentName('');
                    setSubDepartmentError('');
                  }}
                  className="mt-1 px-3 h-10 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center justify-center"
                  title="Add New Sub-Department"
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
                  {positions.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
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
              <label className="block text-sm font-medium text-gray-700">Location</label>
              <select name="locationId" value={formData.locationId} onChange={handleChange}
                className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
                <option value="">Location</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Grade</label>
              <input type="text" name="grade" value={formData.grade} onChange={handleChange} placeholder="Grade"
                className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Cost Centre</label>
              <input
                type="text"
                name="costCentre"
                value={formData.costCentre}
                onChange={handleChange}
                placeholder="Cost Centre"
                className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
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
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Job Responsibility</label>
            <textarea name="jobResponsibility" value={formData.jobResponsibility} onChange={handleChange} rows={3} placeholder="Job Responsibility"
              className="mt-1 block w-full bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
          </div>
        </div>
      )}

      {/* Personal Information Tab */}
      {currentTab === 'personal' && (
        <div className="space-y-6">
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
                <label className="block text-sm font-medium text-gray-700">Personal Email</label>
                <input
                  type="email"
                  name="personalEmail"
                  value={formData.personalEmail}
                  onChange={handleChange}
                  className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
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
                <label className="block text-sm font-medium text-gray-700">Phone Number</label>
                <input
                  type="tel"
                  name="permanentPhoneNumber"
                  value={formData.permanentPhoneNumber}
                  onChange={handleChange}
                  className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
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
                <div
                  className={`relative mt-1 h-10 rounded-md bg-white shadow-sm border ${
                    // no validation error yet, but keep consistent styling helpers
                    'border-black focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500'
                  }`}
                >
                  <DatePicker
                    ref={dateOfWeddingRef}
                    selected={formData.dateOfWedding ? new Date(formData.dateOfWedding) : null}
                    onChange={(date: Date | null) => {
                      const value = date ? date.toISOString().slice(0, 10) : '';
                      setFormData((prev) => ({ ...prev, dateOfWedding: value }));
                    }}
                    dateFormat="dd-MM-yyyy"
                    placeholderText="Select date"
                    className="block w-full h-full bg-transparent text-black rounded-md border-none outline-none focus:outline-none sm:text-sm pl-3 pr-10"
                    popperPlacement="bottom-start"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 focus:outline-none"
                    onClick={() => {
                      if (dateOfWeddingRef.current?.setOpen) {
                        dateOfWeddingRef.current.setOpen(true);
                      } else if (dateOfWeddingRef.current?.input?.focus) {
                        dateOfWeddingRef.current.input.focus();
                      }
                    }}
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </button>
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
                <div
                  className={`relative mt-1 h-10 rounded-md bg-white shadow-sm border ${
                    'border-black focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500'
                  }`}
                >
                  <DatePicker
                    ref={passportExpiryRef}
                    selected={formData.passportExpiry ? new Date(formData.passportExpiry) : null}
                    onChange={(date: Date | null) => {
                      const value = date ? date.toISOString().slice(0, 10) : '';
                      setFormData((prev) => ({ ...prev, passportExpiry: value }));
                    }}
                    dateFormat="dd-MM-yyyy"
                    placeholderText="Select date"
                    className="block w-full h-full bg-transparent text-black rounded-md border-none outline-none focus:outline-none sm:text-sm pl-3 pr-10"
                    popperPlacement="bottom-start"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 focus:outline-none"
                    onClick={() => {
                      if (passportExpiryRef.current?.setOpen) {
                        passportExpiryRef.current.setOpen(true);
                      } else if (passportExpiryRef.current?.input?.focus) {
                        passportExpiryRef.current.input.focus();
                      }
                    }}
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </button>
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
                <div
                  className={`relative mt-1 h-10 rounded-md bg-white shadow-sm border ${
                    'border-black focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500'
                  }`}
                >
                  <DatePicker
                    ref={drivingLicenseExpiryRef}
                    selected={formData.drivingLicenseExpiry ? new Date(formData.drivingLicenseExpiry) : null}
                    onChange={(date: Date | null) => {
                      const value = date ? date.toISOString().slice(0, 10) : '';
                      setFormData((prev) => ({ ...prev, drivingLicenseExpiry: value }));
                    }}
                    dateFormat="dd-MM-yyyy"
                    placeholderText="Select date"
                    className="block w-full h-full bg-transparent text-black rounded-md border-none outline-none focus:outline-none sm:text-sm pl-3 pr-10"
                    popperPlacement="bottom-start"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 focus:outline-none"
                    onClick={() => {
                      if (drivingLicenseExpiryRef.current?.setOpen) {
                        drivingLicenseExpiryRef.current.setOpen(true);
                      } else if (drivingLicenseExpiryRef.current?.input?.focus) {
                        drivingLicenseExpiryRef.current.input.focus();
                      }
                    }}
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Employment Tab */}
      {currentTab === 'employment' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Department */}
            <div>
              <label htmlFor="departmentId" className="block text-sm font-medium text-gray-700">
                Department <span className="text-red-500">*</span>
              </label>
              <select
                id="departmentId"
                name="departmentId"
                value={formData.departmentId}
                onChange={handleChange}
                className={`mt-1 block w-full h-10 bg-white text-black rounded-md border shadow-sm sm:text-sm ${
                  errors.departmentId
                    ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500'
                    : 'border-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                }`}
              >
                <option value="">Select a department</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
              {errors.departmentId && <p className="mt-1 text-sm text-red-600">{errors.departmentId}</p>}
            </div>

            {/* Position */}
            <div>
              <label htmlFor="positionId" className="block text-sm font-medium text-gray-700">
                Position <span className="text-red-500">*</span>
              </label>
              <select
                id="positionId"
                name="positionId"
                value={formData.positionId}
                onChange={handleChange}
                className={`mt-1 block w-full h-10 bg-white text-black rounded-md border shadow-sm sm:text-sm ${
                  errors.positionId
                    ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500'
                    : 'border-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                }`}
              >
                <option value="">Select a position</option>
                {positions.map(pos => (
                  <option key={pos.id} value={pos.id}>
                    {pos.title}
                  </option>
                ))}
              </select>
              {errors.positionId && <p className="mt-1 text-sm text-red-600">{errors.positionId}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Manager */}
            <div>
              <label htmlFor="managerId" className="block text-sm font-medium text-gray-700">
                Reporting Manager
              </label>
              <select
                id="managerId"
                name="managerId"
                value={formData.managerId}
                onChange={handleChange}
                className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-black shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value="">No manager</option>
                {availableManagers.map(mgr => (
                  <option key={mgr.id} value={mgr.id}>
                    {mgr.firstName} {mgr.lastName} ({mgr.employeeCode})
                  </option>
                ))}
              </select>
            </div>

            {/* Joining Date */}
            <div>
              <label htmlFor="joiningDate" className="block text-sm font-medium text-gray-700">
                Joining Date <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  id="joiningDate"
                  name="joiningDate"
                  value={formData.joiningDate}
                  onChange={handleChange}
                  className={`mt-1 block w-full h-10 bg-white text-black rounded-md border shadow-sm sm:text-sm pl-3 pr-10 ${
                    errors.joiningDate
                      ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500'
                      : 'border-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                  }`}
                />
                <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </span>
              </div>
              {errors.joiningDate && <p className="mt-1 text-sm text-red-600">{errors.joiningDate}</p>}
            </div>
          </div>

          {/* Employee Status */}
          <div>
            <label htmlFor="employeeStatus" className="block text-sm font-medium text-gray-700">
              Employee Status
            </label>
            <select
              id="employeeStatus"
              name="employeeStatus"
              value={formData.employeeStatus}
              onChange={handleChange}
              className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm max-w-xs"
            >
              <option value="ACTIVE">Active</option>
              <option value="ON_LEAVE">On Leave</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="TERMINATED">Terminated</option>
              <option value="RESIGNED">Resigned</option>
            </select>
          </div>
        </div>
      )}

      {/* Statutory Details Tab */}
      {currentTab === 'statutory' && (
        <div className="space-y-6">
          {/* Statutory fields – first 12 in specified order, then rest */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
            <h3 className="text-base font-medium text-gray-900">Statutory Numbers & Locations</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 1. PF Applicable From */}
              <div>
                <label className="block text-sm font-medium text-gray-700">PF Applicable From</label>
                <div className="mt-1 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, pfApplicableFrom: true }))}
                    className={`px-4 py-1.5 rounded-full text-xs font-medium border ${
                      formData.pfApplicableFrom
                        ? 'bg-green-500 border-green-600 text-white'
                        : 'bg-white border-black text-gray-700'
                    }`}
                  >
                    YES
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, pfApplicableFrom: false }))}
                    className={`px-4 py-1.5 rounded-full text-xs font-medium border ${
                      !formData.pfApplicableFrom
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
                  <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
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
                  <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
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
                  <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
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
              {/* PF Applicable */}
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
        <div className="space-y-4">
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
        <div className="space-y-4">
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
            <div className="overflow-hidden border border-gray-200 rounded-md">
              <table className="min-w-full divide-y divide-gray-200">
                <tbody className="divide-y divide-gray-200 bg-white">
                  {[
                    'Arrear Basic',
                    'Arrear HRA',
                    'Arrear Conveyance',
                    'Arrear Other Allowance',
                    'Fixed Gross',
                    'Vehicle Allowances',
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
                  <tr className="bg-gray-50">
                    <td className="px-4 py-2 text-sm font-semibold text-gray-900 text-left">Total</td>
                    <td className="px-4 py-2 text-left">:</td>
                    <td className="px-4 py-2 text-left">
                      <span className="block w-32 h-9 flex items-center text-sm font-semibold text-gray-900">0.00</span>
                    </td>
                  </tr>
                </tbody>
              </table>
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
        <div className="space-y-4">
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
        <div className="space-y-4">
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
        <div className="space-y-4">
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
        <div className="space-y-4">
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
        <div className="space-y-4">
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
        <div className="space-y-4">
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

      {/* Submit Error */}
      {errors.submit && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{errors.submit}</p>
        </div>
      )}

      {/* Form Actions */}
      <div className="flex justify-between pt-4 border-t">
        <div>
          {currentTab !== (initialPaygroupId || (employee as any)?.paygroupId || (employee as any)?.paygroup ? 'company' : 'personal') && (
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
          {currentTab === 'newFields' ? (
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : employee ? 'Update Employee' : 'Create Employee'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleNext}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              Next
            </button>
          )}
        </div>
      </div>

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

    {/* Department Modal - Outside form to avoid nested forms */}
    {showDepartmentModal && (
      <Modal
        isOpen={showDepartmentModal}
        onClose={() => setShowDepartmentModal(false)}
        title="Create Department"
        size="2xl"
      >
        <DepartmentForm
          organizationId={organizationId}
          onSuccess={async (createdDepartment) => {
            console.log('Department created successfully:', createdDepartment);
            // Refresh departments list
            await fetchDepartments(organizationId);
            // Auto-select the newly created department
            if (createdDepartment) {
              setFormData(prev => ({ ...prev, departmentId: createdDepartment.id }));
            }
            setShowDepartmentModal(false);
          }}
          onCancel={() => setShowDepartmentModal(false)}
        />
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
                    await subDepartmentService.create(organizationId, name);
                    setSubDepartmentOptions((prev) => [...prev, name].sort((a, b) => a.localeCompare(b)));
                    setFormData((prev) => ({ ...prev, subDepartment: name }));
                    setNewSubDepartmentName('');
                    setSubDepartmentError('');
                    setShowSubDepartmentModal(false);
                  } catch (err: any) {
                    setSubDepartmentError(err.response?.data?.message || 'Failed to add sub-department. Try again.');
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
                  await subDepartmentService.create(organizationId, name);
                  setSubDepartmentOptions((prev) => [...prev, name].sort((a, b) => a.localeCompare(b)));
                  setFormData((prev) => ({ ...prev, subDepartment: name }));
                  setNewSubDepartmentName('');
                  setSubDepartmentError('');
                  setShowSubDepartmentModal(false);
                } catch (err: any) {
                  setSubDepartmentError(err.response?.data?.message || 'Failed to add sub-department. Try again.');
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
                <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
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
                <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
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
                <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
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
              <div
                className={`relative mt-1 h-10 rounded-md bg-white shadow-sm border ${
                  'border-black focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500'
                }`}
              >
                <DatePicker
                  ref={familyDateOfBirthRef}
                  selected={familyFormData.dateOfBirth ? new Date(familyFormData.dateOfBirth) : null}
                  onChange={(date: Date | null) => {
                    const value = date ? date.toISOString().slice(0, 10) : '';
                    setFamilyFormData((prev) => ({ ...prev, dateOfBirth: value }));
                  }}
                  dateFormat="dd-MM-yyyy"
                  placeholderText="Date of Birth"
                  className="block w-full h-full bg-transparent text-black rounded-md border-none outline-none focus:outline-none sm:text-sm pl-3 pr-10"
                  popperPlacement="bottom-start"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 focus:outline-none"
                  onClick={() => {
                    if (familyDateOfBirthRef.current?.setOpen) {
                      familyDateOfBirthRef.current.setOpen(true);
                    } else if (familyDateOfBirthRef.current?.input?.focus) {
                      familyDateOfBirthRef.current.input.focus();
                    }
                  }}
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </button>
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
              <div
                className={`relative mt-1 h-10 rounded-md bg-white shadow-sm border ${
                  'border-black focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500'
                }`}
              >
                <DatePicker
                  ref={familyPassportIssueDateRef}
                  selected={familyFormData.passportIssueDate ? new Date(familyFormData.passportIssueDate) : null}
                  onChange={(date: Date | null) => {
                    const value = date ? date.toISOString().slice(0, 10) : '';
                    setFamilyFormData((prev) => ({ ...prev, passportIssueDate: value }));
                  }}
                  dateFormat="dd-MM-yyyy"
                  placeholderText="Passport Issue Date"
                  className="block w-full h-full bg-transparent text-black rounded-md border-none outline-none focus:outline-none sm:text-sm pl-3 pr-10"
                  popperPlacement="bottom-start"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 focus:outline-none"
                  onClick={() => {
                    if (familyPassportIssueDateRef.current?.setOpen) {
                      familyPassportIssueDateRef.current.setOpen(true);
                    } else if (familyPassportIssueDateRef.current?.input?.focus) {
                      familyPassportIssueDateRef.current.input.focus();
                    }
                  }}
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Passport Expiry Date</label>
              <div
                className={`relative mt-1 h-10 rounded-md bg-white shadow-sm border ${
                  'border-black focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500'
                }`}
              >
                <DatePicker
                  ref={familyPassportExpiryDateRef}
                  selected={familyFormData.passportExpiryDate ? new Date(familyFormData.passportExpiryDate) : null}
                  onChange={(date: Date | null) => {
                    const value = date ? date.toISOString().slice(0, 10) : '';
                    setFamilyFormData((prev) => ({ ...prev, passportExpiryDate: value }));
                  }}
                  dateFormat="dd-MM-yyyy"
                  placeholderText="Passport Expiry Date"
                  className="block w-full h-full bg-transparent text-black rounded-md border-none outline-none focus:outline-none sm:text-sm pl-3 pr-10"
                  popperPlacement="bottom-start"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 focus:outline-none"
                  onClick={() => {
                    if (familyPassportExpiryDateRef.current?.setOpen) {
                      familyPassportExpiryDateRef.current.setOpen(true);
                    } else if (familyPassportExpiryDateRef.current?.input?.focus) {
                      familyPassportExpiryDateRef.current.input.focus();
                    }
                  }}
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </button>
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
