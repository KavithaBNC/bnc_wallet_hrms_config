# Employee Excel Import Format

## How to Import

1. Go to **Employees** page
2. Select an **Organization** (required for non-Super Admin)
3. Click **Import Excel** button
4. Use `docs/employee_import_sample.xlsx` or **Download Sample Template**
5. Fill in the data (keep header row as-is)
6. Upload the file and click **Start Import**

## Sample File (49-Column Mass Upload Format)

- **Location:** `docs/employee_import_sample.xlsx`
- **Generate:** Run `node scripts/generate-employee-import-sample.js` from project root
- **Column order (do not interchange):**

| # | Column | # | Column | # | Column |
|---|--------|---|--------|---|--------|
| 1 | S.No | 18 | Official E-Mail Id | 35 | Marital Status |
| 2 | Paygroup | 19 | Permanent Address | 36 | Reporting Manager |
| 3 | Associate Code | 20 | Permanent City | 37 | Associate Notice Period Days |
| 4 | Associate Name | 21 | Permanent State | 38 | LWF Location |
| 5 | Gender | 22 | Permanent Pincode | 39 | Permanent District |
| 6 | Department | 23 | Permanent Phone | 40 | Current District |
| 7 | Designation | 24 | Current Address | 41 | Permanent mobile |
| 8 | Father Name | 25 | Current City | 42 | UAN Number |
| 9 | Blood Group | 26 | Current State | 43 | Adhaar Number |
| 10 | Date of Birth | 27 | Current Pincode | 44 | Tax Regime |
| 11 | Date of Joining | 28 | Current Phone | 45 | Sub Department |
| 12 | Cost Centre | 29 | Place of Tax Deduction | 46 | Alternate Saturday Off |
| 13 | Pan Card Number | 30 | PF Number | 47 | Compoff Applicable |
| 14 | Bank Name | 31 | ESI Number | 48 | Fixed Gross |
| 15 | Account No | 32 | Location | 49 | Vehicle Allowances |
| 16 | Bank IFSC Code | 33 | ESI Location | | |
| 17 | Permanent E-Mail Id | 34 | Ptax Location | | |

## Required Columns

| Column | Required | Example |
|--------|----------|---------|
| Associate Name (or firstName + lastName) | Yes | Murali Krishna |
| Official E-Mail Id or Permanent E-Mail Id | Yes | murali@bncmotors.com |
| Date of Joining | Yes | 2024-01-01 or 1/1/2024 |

## Lookup Mapping (Name must match org data)

| Excel Column | Maps To | Notes |
|--------------|---------|-------|
| Paygroup | paygroupId | Must match Paygroup name in organization |
| Department | departmentId | Must match Department name in organization |
| Designation | positionId | Must match Job Position title in organization |
| Reporting Manager | reportingManagerId | Must match existing employee name (firstName + lastName) |
| Cost Centre | costCentreId | Must match Cost Centre name or code in organization |

## Optional Columns (all map to DB)

| Excel Column | DB Location | Example |
|--------------|-------------|---------|
| Associate Code | employees.employee_code | BNC1001 |
| Official E-Mail Id, email | employees.official_email (primary → email) | murali@bncmotors.com |
| Permanent E-Mail Id, personal_email | employees.personal_email | murali.krishna@example.com |
| Permanent mobile, Permanent Phone | employees.phone | 9876543210 |
| Permanent Address, City, State, Pincode | address.street, city, state, postalCode | |
| Current Address, City, State, Pincode | address.presentAddress, presentCity, presentState, presentPincode | |
| Permanent District | address.permanentDistrict | Chennai |
| Current District | address.presentDistrict | Chennai |
| Place of Tax Deduction | employees.place_of_tax_deduction | METRO, NON_METRO |
| Location | employees.work_location | Chennai |
| PF Number, ESI Number, UAN Number | taxInformation | |
| Pan Card Number, Adhaar Number | taxInformation | |
| ESI Location, Ptax Location | taxInformation | |
| Tax Regime | taxInformation.taxRegime | New, Old |
| Bank Name, Account No, Bank IFSC Code | bankDetails | |
| Father Name, Blood Group, Sub Department | profileExtensions | |
| Associate Notice Period Days | profileExtensions.associateNoticePeriodDays | 30 |
| LWF Location | profileExtensions.lwfLocation | Chennai |
| Alternate Saturday Off | profileExtensions.alternateSaturdayOff | Yes |
| Compoff Applicable | profileExtensions.compoffApplicable | Yes |
| Fixed Gross, Vehicle Allowances | EmployeeSalary.components | Stored in salary table for payroll |

## Alternate Column Names (also accepted)

- empId, empCode, Associate Code → employeeCode
- mobile, mobileNumber, Permanent mobile → phone
- doj, joiningDate, Date of Joining → dateOfJoining
- departmentName, dept, Department → department
- Designation, position → designation
- Paygroup, PAY GROUP → paygroupId (lookup)
- Reporting Manager → reportingManagerId (lookup)
- PAN, Pan Card Number → panNumber
- Aadhar, Adhaar Number → aadhaarNumber
- UAN Number → uanNumber
- PF Number → pfNumber
- ESI Number → esiNumber
- accountNo, Account No → accountNumber
- Bank IFSC Code → ifscCode

## Notes

- **Paygroup**: Must match an existing paygroup name in the organization. Create paygroups first if needed.
- **Department**: Must match an existing department name in the organization. Create departments first if needed.
- **Designation**: Must match an existing Job Position title in the organization. Create positions first if needed.
- **Reporting Manager**: Must match an existing employee's full name (firstName + lastName) in the organization.
- **Associate Name**: Use full name; it will be split into firstName (first word) and lastName (rest).
- **Gender**: Use MALE, FEMALE, M, or F
- **Marital Status**: Use SINGLE, MARRIED, DIVORCED, or WIDOWED
- **Place of Tax Deduction**: Use M (metro) or N (non-metro), or METRO/NON_METRO
- **Marital Status**: Use M (married), S (single), or full words
- **Last Name**: If empty, Father Name is used. Last name is not mandatory when Father Name is provided.
- **Dates**: Supports many formats: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, DD-MMM-YYYY (e.g. 15-Jan-2024), Excel serial numbers
- Empty rows are skipped
- **Duplicates**: Rows with existing email or Associate Code are skipped (not inserted). No duplicate records in any table.
