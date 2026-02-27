# Leave & Permission UAT Test Cases

இந்த checklist-ஐ employee/manager flow validate பண்ண direct-ஆ use பண்ணலாம்.

## Test Data (Before Start)

- Employee user: `<employee_email>`
- Manager user: `<manager_email>`
- Organization: `<org_name_or_id>`
- Leave type: `Earned Leave` (or active leave type)
- Permission type: `Permission`
- Permission rule example: `2 times / month`, `120 mins each`

---

## TC-01: Employee Leave Apply (Positive)

- **Module:** Employee self-service
- **Precondition:** Leave type active, employeeக்கு apply rights enabled
- **Steps:**
  1. Employee login
  2. Leave apply page open
  3. Leave type select
  4. Future date select
  5. Valid reason enter
  6. Submit
- **Expected:**
  - Request created successfully
  - Status = `Pending`
  - Request history-ல் entry வர வேண்டும்

## TC-02: Manager Leave Approve (Positive)

- **Module:** Approval inbox
- **Precondition:** TC-01 request pending
- **Steps:**
  1. Manager login
  2. Pending leave requests open
  3. TC-01 request approve
- **Expected:**
  - Approve success message
  - Status = `Approved`
  - Employee view-ல் status update ஆக வேண்டும்

## TC-03: Leave Calendar Reflection (Positive)

- **Module:** Leave calendar / attendance calendar
- **Precondition:** TC-02 approved
- **Steps:**
  1. Calendar open (employee/manager)
  2. Applied date check
- **Expected:**
  - அந்த date-ல் leave reflect ஆக வேண்டும்
  - Type and date mismatch இருக்கக்கூடாது

## TC-04: Permission Apply (Positive)

- **Module:** Employee self-service
- **Precondition:** Permission component + rights + workflow active
- **Steps:**
  1. Employee login
  2. Permission apply
  3. Minutes enter (<= configured max)
  4. Submit
- **Expected:**
  - Request created
  - Status = `Pending`

## TC-05: Manager Permission Approve (Positive)

- **Module:** Approval inbox
- **Precondition:** TC-04 pending
- **Steps:**
  1. Manager login
  2. Pending permission request approve
- **Expected:**
  - Status = `Approved`
  - Employee history-ல் reflect ஆக வேண்டும்

## TC-06: Permission Limit Validation (Negative)

- **Module:** Employee self-service
- **Precondition:** Monthly limit configured (e.g., 2 times)
- **Steps:**
  1. Same month-ல் limit வரை permission submit
  2. One more extra request submit
- **Expected:**
  - Extra request block ஆக வேண்டும்
  - Clear validation message வர வேண்டும்

## TC-07: Permission Duration Validation (Negative)

- **Module:** Employee self-service
- **Precondition:** Max minutes configured (e.g., 120)
- **Steps:**
  1. Permission request-ல் max-ஐ விட அதிக minutes enter
  2. Submit
- **Expected:**
  - Submit fail ஆக வேண்டும்
  - Max limit message காண வேண்டும்

## TC-08: Overlap Validation (Negative)

- **Module:** Employee self-service
- **Precondition:** Existing approved/pending leave on same date/time
- **Steps:**
  1. Same date/time range-க்கு another leave/permission apply
- **Expected:**
  - Conflict validation
  - Duplicate/overlap request create ஆகக்கூடாது

## TC-09: Unauthorized Approval Attempt (Negative)

- **Module:** Approval security
- **Precondition:** Request pending
- **Steps:**
  1. Non-assigned user (other employee/manager) login
  2. Request approve attempt
- **Expected:**
  - Access denied (403/authorization message)
  - Status unchanged

## TC-10: Cancel Pending Request (Positive/Control)

- **Module:** Employee self-service
- **Precondition:** Pending leave/permission exists
- **Steps:**
  1. Employee cancel request
- **Expected:**
  - Status = `Cancelled`
  - Manager inbox-ல் actionable item remove/disabled

---

## Quick Sign-off Checklist

- [ ] Leave apply works
- [ ] Permission apply works
- [ ] Manager approval works
- [ ] Calendar reflects approved requests
- [ ] Monthly count limit enforced
- [ ] Max minutes limit enforced
- [ ] Overlap blocked
- [ ] Unauthorized approval blocked

---

## Optional Automation Command

Backend API flow quick test:

`npx ts-node -r tsconfig-paths/register src/scripts/test-employee-manager-leave-flow.ts`

