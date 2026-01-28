import React, { useEffect, useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { useEmployeeStore } from '../../store/employeeStore';
import { useDepartmentStore } from '../../store/departmentStore';
import { usePositionStore } from '../../store/positionStore';
import employeeService, { Employee, Gender, MaritalStatus, EmployeeStatus } from '../../services/employee.service';
import api from '../../services/api';
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

  const [currentTab, setCurrentTab] = useState<'company' | 'personal' | 'employment' | 'contact'>(
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
    positionId: employee?.positionId || '',
    locationId: (employee as any)?.locationId || '',
    costCentreId: (employee as any)?.costCentreId || '',
    managerId: employee?.reportingManagerId || '',
    grade: (employee as any)?.grade || '',
    placeOfTaxDeduction: (employee as any)?.placeOfTaxDeduction || '',
    jobResponsibility: (employee as any)?.jobResponsibility || '',
    // Personal (login email required for create)
    email: employee?.email || '',
    phoneNumber: employee?.phone || '',
    maritalStatus: employee?.maritalStatus || '',
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
        setCostCentres(data.data?.costCentres ?? []);
      } catch {
        setCostCentres([]);
      }
    };
    fetchLocations();
    fetchCostCentres();
  }, [organizationId, fetchDepartments, fetchPositions, employee?.id]);

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
      setCurrentTab('contact');
    }
  };

  const handleBack = () => {
    if (currentTab === 'contact') setCurrentTab('employment');
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
        costCentreId: formData.costCentreId && formData.costCentreId.trim() ? formData.costCentreId : null,
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
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {(initialPaygroupId || (employee as any)?.paygroupId || (employee as any)?.paygroup) && (
            <button
              type="button"
              onClick={() => setCurrentTab('company')}
              className={`${
                currentTab === 'company'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-black'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Company Details
            </button>
          )}
          <button
            type="button"
            onClick={() => setCurrentTab('personal')}
            className={`${
              currentTab === 'personal'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-black'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Personal Info
          </button>
          <button
            type="button"
            onClick={() => setCurrentTab('employment')}
            className={`${
              currentTab === 'employment'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-black'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Employment
          </button>
          <button
            type="button"
            onClick={() => setCurrentTab('contact')}
            className={`${
              currentTab === 'contact'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-black'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Contact & Address
          </button>
        </nav>
      </div>

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
                className={`mt-1 block w-full h-10 bg-white text-black rounded-md border shadow-sm sm:text-sm ${errors.firstName ? 'border-red-500' : 'border-gray-300'}`} />
              {errors.firstName && <p className="mt-1 text-sm text-red-600">{errors.firstName}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Middle Name</label>
              <input type="text" name="middleName" value={formData.middleName} onChange={handleChange} placeholder="Middle Name"
                className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-gray-300 shadow-sm sm:text-sm" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Last Name <span className="text-red-500">*</span></label>
              <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} placeholder="Last Name"
                className={`mt-1 block w-full h-10 bg-white text-black rounded-md border shadow-sm sm:text-sm ${errors.lastName ? 'border-red-500' : 'border-gray-300'}`} />
              {errors.lastName && <p className="mt-1 text-sm text-red-600">{errors.lastName}</p>}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Gender <span className="text-red-500">*</span></label>
              <select name="gender" value={formData.gender} onChange={handleChange}
                className={`mt-1 block w-full h-10 bg-white text-black rounded-md border shadow-sm sm:text-sm ${errors.gender ? 'border-red-500' : 'border-gray-300'}`}>
                <option value="">-- Select --</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
              {errors.gender && <p className="mt-1 text-sm text-red-600">{errors.gender}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Date Of Birth <span className="text-red-500">*</span>
              </label>
              <div className="relative mt-1">
                <DatePicker
                  selected={formData.dateOfBirth ? new Date(formData.dateOfBirth) : null}
                  onChange={(date: Date | null) => {
                    const value = date ? date.toISOString().slice(0, 10) : '';
                    setFormData((prev) => ({ ...prev, dateOfBirth: value }));
                    if (errors.dateOfBirth) {
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next.dateOfBirth;
                        return next;
                      });
                    }
                  }}
                  dateFormat="dd-MM-yyyy"
                  placeholderText="Select date"
                  className={`block w-full h-10 bg-white text-black rounded-md border shadow-sm sm:text-sm pl-3 pr-10 ${
                    errors.dateOfBirth ? 'border-red-500' : 'border-gray-300'
                  }`}
                  popperPlacement="bottom-start"
                />
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
              </div>
              {errors.dateOfBirth && <p className="mt-1 text-sm text-red-600">{errors.dateOfBirth}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Date Of Joining <span className="text-red-500">*</span>
              </label>
              <div className="relative mt-1">
                <DatePicker
                  selected={formData.joiningDate ? new Date(formData.joiningDate) : null}
                  onChange={(date: Date | null) => {
                    const value = date ? date.toISOString().slice(0, 10) : '';
                    setFormData((prev) => ({ ...prev, joiningDate: value }));
                    if (errors.joiningDate) {
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next.joiningDate;
                        return next;
                      });
                    }
                  }}
                  dateFormat="dd-MM-yyyy"
                  placeholderText="Select date"
                  className={`block w-full h-10 bg-white text-black rounded-md border shadow-sm sm:text-sm pl-3 pr-10 ${
                    errors.joiningDate ? 'border-red-500' : 'border-gray-300'
                  }`}
                  popperPlacement="bottom-start"
                />
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
              </div>
              {errors.joiningDate && <p className="mt-1 text-sm text-red-600">{errors.joiningDate}</p>}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Official Email</label>
              <input type="email" name="officialEmail" value={formData.officialEmail} onChange={handleChange} placeholder="Official Email"
                className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-gray-300 shadow-sm sm:text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Official Mobile</label>
              <input type="tel" name="officialMobile" value={formData.officialMobile} onChange={handleChange} placeholder="Official Mobile"
                className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-gray-300 shadow-sm sm:text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Department <span className="text-red-500">*</span></label>
              <div className="flex gap-2">
                <select name="departmentId" value={formData.departmentId} onChange={handleChange}
                  className={`flex-1 mt-1 block w-full h-10 bg-white text-black rounded-md border shadow-sm sm:text-sm ${errors.departmentId ? 'border-red-500' : 'border-gray-300'}`}>
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
              <label className="block text-sm font-medium text-gray-700">Designation <span className="text-red-500">*</span></label>
              <div className="flex gap-2">
                <select name="positionId" value={formData.positionId} onChange={handleChange}
                  className={`flex-1 mt-1 block w-full h-10 bg-white text-black rounded-md border shadow-sm sm:text-sm ${errors.positionId ? 'border-red-500' : 'border-gray-300'}`}>
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
                className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-gray-300 shadow-sm sm:text-sm">
                <option value="">Location</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Grade</label>
              <input type="text" name="grade" value={formData.grade} onChange={handleChange} placeholder="Grade"
                className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-gray-300 shadow-sm sm:text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Cost Centre</label>
              <select name="costCentreId" value={formData.costCentreId} onChange={handleChange}
                className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-gray-300 shadow-sm sm:text-sm">
                <option value="">Cost Centre</option>
                {costCentres.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Place of Tax Deduction <span className="text-red-500">*</span></label>
              <select name="placeOfTaxDeduction" value={formData.placeOfTaxDeduction} onChange={handleChange}
                className={`mt-1 block w-full h-10 bg-white text-black rounded-md border shadow-sm sm:text-sm ${errors.placeOfTaxDeduction ? 'border-red-500' : 'border-gray-300'}`}>
                <option value="">-- Select --</option>
                <option value="METRO">Metro</option>
                <option value="NON_METRO">Non-Metro</option>
              </select>
              {errors.placeOfTaxDeduction && <p className="mt-1 text-sm text-red-600">{errors.placeOfTaxDeduction}</p>}
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Reporting Manager</label>
              <select name="managerId" value={formData.managerId} onChange={handleChange}
                className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-gray-300 shadow-sm sm:text-sm">
                <option value="">Reporting Manager</option>
                {availableManagers.map((m) => (
                  <option key={m.id} value={m.id}>{m.firstName} {m.lastName} ({m.employeeCode})</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Job Responsibility</label>
            <textarea name="jobResponsibility" value={formData.jobResponsibility} onChange={handleChange} rows={3} placeholder="Job Responsibility"
              className="mt-1 block w-full bg-white text-black rounded-md border border-gray-300 shadow-sm sm:text-sm" />
          </div>
        </div>
      )}

      {/* Personal Information Tab */}
      {currentTab === 'personal' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* First Name */}
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                First Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                className={`mt-1 block w-full h-10 bg-white text-black rounded-md border shadow-sm sm:text-sm ${
                  errors.firstName
                    ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500'
                    : 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                }`}
              />
              {errors.firstName && <p className="mt-1 text-sm text-red-600">{errors.firstName}</p>}
            </div>

            {/* Last Name */}
            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                Last Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                className={`mt-1 block w-full h-10 bg-white text-black rounded-md border shadow-sm sm:text-sm ${
                  errors.lastName
                    ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500'
                    : 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                }`}
              />
              {errors.lastName && <p className="mt-1 text-sm text-red-600">{errors.lastName}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className={`mt-1 block w-full h-10 bg-white text-black rounded-md border shadow-sm sm:text-sm ${
                  errors.email
                    ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500'
                    : 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                }`}
              />
              {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
            </div>

            {/* Phone Number */}
            <div>
              <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700">
                Phone Number <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                id="phoneNumber"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleChange}
                className={`mt-1 block w-full h-10 bg-white text-black rounded-md border shadow-sm sm:text-sm ${
                  errors.phoneNumber
                    ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500'
                    : 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                }`}
              />
              {errors.phoneNumber && <p className="mt-1 text-sm text-red-600">{errors.phoneNumber}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Date of Birth */}
            <div>
              <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700">
                Date of Birth <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  id="dateOfBirth"
                  name="dateOfBirth"
                  value={formData.dateOfBirth}
                  onChange={handleChange}
                  className={`mt-1 block w-full h-10 bg-white text-black rounded-md border shadow-sm sm:text-sm pl-10 pr-3 ${
                    errors.dateOfBirth
                      ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500'
                      : 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                  }`}
                />
                <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              {errors.dateOfBirth && <p className="mt-1 text-sm text-red-600">{errors.dateOfBirth}</p>}
            </div>

            {/* Gender */}
            <div>
              <label htmlFor="gender" className="block text-sm font-medium text-gray-700">
                Gender <span className="text-red-500">*</span>
              </label>
              <select
                id="gender"
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                className={`mt-1 block w-full h-10 bg-white text-black rounded-md border shadow-sm sm:text-sm ${
                  errors.gender
                    ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500'
                    : 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                }`}
              >
                <option value="">Select</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
                <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
              </select>
              {errors.gender && <p className="mt-1 text-sm text-red-600">{errors.gender}</p>}
            </div>

            {/* Marital Status */}
            <div>
              <label htmlFor="maritalStatus" className="block text-sm font-medium text-gray-700">
                Marital Status
              </label>
              <select
                id="maritalStatus"
                name="maritalStatus"
                value={formData.maritalStatus}
                onChange={handleChange}
              className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value="">Select</option>
                <option value="SINGLE">Single</option>
                <option value="MARRIED">Married</option>
                <option value="DIVORCED">Divorced</option>
                <option value="WIDOWED">Widowed</option>
              </select>
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
                    : 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
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
                    : 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
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
                  className={`mt-1 block w-full h-10 bg-white text-black rounded-md border shadow-sm sm:text-sm pl-10 pr-3 ${
                    errors.joiningDate
                      ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500'
                      : 'border-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                  }`}
                />
                <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
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

      {/* Contact & Address Tab */}
      {currentTab === 'contact' && (
        <div className="space-y-6">
          {/* Address Section */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Address</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="addressLine1" className="block text-sm font-medium text-gray-700">
                  Address Line 1
                </label>
                <input
                  type="text"
                  id="addressLine1"
                  name="addressLine1"
                  value={formData.addressLine1}
                  onChange={handleChange}
                  className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>

              <div>
                <label htmlFor="addressLine2" className="block text-sm font-medium text-gray-700">
                  Address Line 2
                </label>
                <input
                  type="text"
                  id="addressLine2"
                  name="addressLine2"
                  value={formData.addressLine2}
                  onChange={handleChange}
                  className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="city" className="block text-sm font-medium text-gray-700">
                    City
                  </label>
                  <input
                    type="text"
                    id="city"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="state" className="block text-sm font-medium text-gray-700">
                    State/Province
                  </label>
                  <input
                    type="text"
                    id="state"
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="postalCode" className="block text-sm font-medium text-gray-700">
                    Postal Code
                  </label>
                  <input
                    type="text"
                    id="postalCode"
                    name="postalCode"
                    value={formData.postalCode}
                    onChange={handleChange}
                    className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="country" className="block text-sm font-medium text-gray-700">
                  Country
                </label>
                <input
                  type="text"
                  id="country"
                  name="country"
                  value={formData.country}
                  onChange={handleChange}
                  className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>
          </div>

          {/* Emergency Contact Section */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Emergency Contact</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="emergencyContactName" className="block text-sm font-medium text-gray-700">
                  Contact Name
                </label>
                <input
                  type="text"
                  id="emergencyContactName"
                  name="emergencyContactName"
                  value={formData.emergencyContactName}
                  onChange={handleChange}
                  className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="emergencyContactRelationship" className="block text-sm font-medium text-gray-700">
                    Relationship
                  </label>
                  <input
                    type="text"
                    id="emergencyContactRelationship"
                    name="emergencyContactRelationship"
                    value={formData.emergencyContactRelationship}
                    onChange={handleChange}
                    placeholder="e.g., Spouse, Parent, Sibling"
                    className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="emergencyContactPhone" className="block text-sm font-medium text-gray-700">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    id="emergencyContactPhone"
                    name="emergencyContactPhone"
                    value={formData.emergencyContactPhone}
                    onChange={handleChange}
                    className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
              </div>
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
          {currentTab === 'contact' ? (
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
  </>
  );
};

export default EmployeeForm;
