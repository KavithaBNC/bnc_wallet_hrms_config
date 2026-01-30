/**
 * Employee form modules – same order and ids as EmployeeForm tabs.
 * Used by HR Audit Settings and EmployeeForm for permission-driven view/edit.
 */
export type EmployeeModuleId =
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
  | 'newFields';

export interface EmployeeModuleDef {
  id: EmployeeModuleId;
  name: string;
  expandable?: boolean;
}

export const EMPLOYEE_MODULES: EmployeeModuleDef[] = [
  { id: 'company', name: 'Company Details', expandable: true },
  { id: 'personal', name: 'Personal Info', expandable: false },
  { id: 'statutory', name: 'Statutory Details', expandable: true },
  { id: 'bank', name: 'Bank Details', expandable: true },
  { id: 'salary', name: 'Salary Details', expandable: true },
  { id: 'assets', name: 'Assets', expandable: false },
  { id: 'academic', name: 'Academic Qualification', expandable: false },
  { id: 'previousEmployment', name: 'Previous Employment', expandable: false },
  { id: 'family', name: 'Family Details', expandable: false },
  { id: 'others', name: 'Others', expandable: false },
  { id: 'newFields', name: 'New Fields', expandable: false },
];
