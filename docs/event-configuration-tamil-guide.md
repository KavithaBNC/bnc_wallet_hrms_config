# Event Configuration - Tamil Guide

இந்த guide, HRMS-ல உள்ள **Event Configuration** module-ஐ எப்படிச் setup பண்ணணும், எந்த order-ல பண்ணணும், குறிப்பாக **Attendance Components** screen-ல உள்ள options என்ன அர்த்தம் என்பதைக் தெளிவாக explain பண்ணுகிறது.

---

## 1) Event Configuration என்ன?

**Event Configuration** என்பது organization-க்கான leave/attendance workflow-களின் policy control center.

இதுல:
- Leave types எப்படி behave பண்ணணும்
- Approval எப்படி flow ஆகணும்
- Auto credit எப்படி run ஆகணும்
- Encashment / carry-forward எப்படி செய்யணும்

எல்லாம் configure பண்ணலாம்.

---

## 2) முதலில் என்ன start பண்ணணும்? (Recommended Order)

1. **Attendance Components**
2. **Rights Allocation**
3. **Approval Workflow**
4. **Workflow Mapping**
5. **Rule Setting**
6. **Auto Credit Setting**
7. **Encashment/Carry Forward**

### ஏன் இந்த order?
- Attendance component தான் base definition.
- Approval workflow உருவாக்காமல் workflow mapping சரியாக complete ஆகாது.
- Auto credit/encashment rules பின்னாடி define பண்ணும்போது conflicts குறையும்.

---

## 3) Attendance Components - எப்படிப் பூர்த்தி பண்ணணும்

### Basic Fields

- **Short Name**: EL / CL / SL / LOP போன்ற code
- **Event Name**: Earned Leave / Casual Leave போன்ற full பெயர்
- **Description**: Optional
- **Event Category**: Leave / Onduty / Permission / Holiday / Present

---

## 4) Configuration Options - Field by Field

### Authorized
- **YES**: Approval தேவை (Manager/HR)
- **NO**: Direct apply

### Consider as work hours
- **YES**: Workday போல count ஆகும்
- **NO**: Work hours-ல் count ஆகாது

### Has balance
- **YES**: Leave balance track (credit/debit)
- **NO**: Balance check இல்லாமல் usage

### Credit from Over Time
- **YES**: OT-லிருந்து credit வரும் (Comp Off use case)
- **NO**: OT credit இல்லை

### Allow Balance Entry
- **YES**: Manual balance adjustment allowed
- **NO**: Manual entry இல்லை

### Allow Event Opening Rule
- **YES**: Opening balance rule apply
- **NO**: Opening rule இல்லாமல்

### Allow Auto Credit Rule
- **YES**: Auto credit setting rules apply ஆகும்
- **NO**: Auto credit இல்லை

### Allow Hourly
- **YES**: Half-day/hourly leave allowed
- **NO**: Full-day மட்டும்

### Allow Datewise
- **YES**: Specific individual dates தேர்வு செய்யலாம்
- **NO**: Continuous date range மட்டும்

### Allow WeekOff Selection
- **YES**: Week-off days-லும் leave apply/count செய்யலாம்
- **NO**: Week-off skip ஆகும்

### Allow Holiday Selection
- **YES**: Holidays-லும் leave apply/count
- **NO**: Holidays skip

### Applicable for Regularization
- **YES**: Attendance regularization-ல் இந்த event பயன்படுத்தலாம்
- **NO**: Regularization-க்கு கிடைக்காது

### Allow Different Leave Period
- **YES**: வேறு leave period handling allowed
- **NO**: தற்போதைய leave period மட்டும்

### Allow Event Change
- **YES**: Request type மாற்ற அனுமதி
- **NO**: Once submitted type fixed

### Validation Remarks Mandatory
- **YES**: Remarks compulsory
- **NO**: Optional remarks

---

## 5) Other Fields

### Priority
- Lower number => higher priority
- Empty விட்டாலும் பரவாயில்லை (basic setup-க்கு)

### Event Entry Form
- பொதுவாக `Default` அல்லது required form pattern select பண்ணலாம்

### Auto Credit Engine
- Auto credit logic engine select

### Encashment
- `Default`: Encashment rules follow ஆகும்
- `None`: Encashment disable

### Can't overlap with
- ஒரே நாளில் overlap ஆகக்கூடாத leave components select பண்ணலாம்
- Example: EL and CL same date overlap prevent

### Leave Deduction while in FandF
- Full & Final settlement-ல் leave deduction apply ஆகணுமா என்று control

### Send
- **Mail To On Entry**: Create/entry நேரத்தில் email notification
- **SMS To On Entry**: Create/entry நேரத்தில் SMS notification

---

## 6) Event Rules (DateWise Rule)

- `DateWise Rule` enabled பண்ணினா date-specific behavior future rules-க்கு enable ஆகும்.
- தற்போது rule framework ready; org policy based rule additions செய்யலாம்.

---

## 7) Practical Setup Examples

### EL (Earned Leave)
- Authorized: YES
- Consider as work hours: YES
- Has balance: YES
- Allow Auto Credit Rule: YES
- Allow Hourly: YES (policy-படி)
- Encashment: Default

### LOP (Loss Of Pay)
- Authorized: YES (or org policy)
- Consider as work hours: NO
- Has balance: NO
- Allow Auto Credit Rule: NO
- Encashment: None

### Comp Off
- Authorized: YES
- Has balance: YES
- Credit from Over Time: YES
- Allow Auto Credit Rule: NO

---

## 8) Safe Starting Template (If unsure)

புதிய org setup-க்கு ஆரம்பத்தில் இதைப் பயன்படுத்தலாம்:

- Authorized: YES
- Consider as work hours: YES (LOP மட்டும் NO)
- Has balance: YES (LOP மட்டும் NO)
- Allow Auto Credit Rule: EL/CLக்கு YES, LOPக்கு NO
- Allow Hourly: YES (company policy-படி fine-tune)
- WeekOff/Holiday selection: பொதுவாக NO
- Validation remarks mandatory: SL/LOPக்கு YES

பிறகு policy discussion முடிச்சு fine-tune பண்ணலாம்.

---

## 9) Quick Checklist Before Save

- [ ] Event Category சரியா?
- [ ] Has Balance / Auto Credit flags policy-க்கு பொருந்துதா?
- [ ] Overlap rules set பண்ணிட்டீங்களா?
- [ ] Required notifications on பண்ணிட்டீங்களா?
- [ ] Approval workflow + workflow mapping readyஆ?

---

## 10) Final Note

**Attendance Components setup சரியா இருந்தா தான்** Leave, Approval, Auto Credit, Balance deduction எல்லாமே stable-ஆ வேலை செய்யும்.
இது foundation module.

