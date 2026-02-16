# Attendance Component - Configuration Options (தமிழ் விளக்கம்)

இந்த document, **Attendance Components** screen-ல் வரும் ஒவ்வொரு option-க்கும் எளிய தமிழ் விளக்கம் தருகிறது.

---

## 1) Authorized
- **அர்த்தம்**: இந்த event-ஐ பயன்படுத்த user-க்கு explicit authorization தேவைப்படுமா?
- **YES**: HR/Manager approval அல்லது special permission இருந்தால் மட்டும் பயன்படுத்த வேண்டும் என்றால்.
- **NO**: பொதுவாக எல்லாரும் apply செய்யலாம்.

## 2) Consider as work hours
- **அர்த்தம்**: இந்த event time/work entry, net work hours-ல் count ஆகுமா?
- **YES**: வேலை நேரமாக கருத வேண்டிய event (உதா: சில On Duty types).
- **NO**: வேலை நேரத்தில் சேர்க்க வேண்டாம்.

## 3) Has balance
- **அர்த்தம்**: இந்த event-க்கு leave மாதிரி opening/credit/used/balance maintain பண்ண வேண்டுமா?
- **YES**: Leave, Comp Off மாதிரி balance-based events.
- **NO**: one-time entries / balance இல்லாத events.

## 4) Credit from Over Time
- **அர்த்தம்**: OT (Over Time) அடிப்படையில் இந்த event-க்கு credit auto உருவாகுமா?
- **YES**: OT convert செய்து Comp Off / credit events தரும்போது.
- **NO**: OT-க்கு link இல்லாத event.

## 5) Allow Balance Entry
- **அர்த்தம்**: manual-ஆ opening/adjust balance entry செய்ய அனுமதி தருமா?
- **YES**: initial migration / correction-க்கு.
- **NO**: முழுக்க system-driven balance மட்டும் வேண்டுமெனில்.

## 6) Allow Event Opening Rule
- **அர்த்தம்**: event opening condition/rule configure செய்யலாமா?
- **YES**: “எந்த தேதி முதல் open” போன்ற கட்டுப்பாடு வேண்டும்.
- **NO**: opening rule தேவையில்லை.

## 7) Allow Auto Credit Rule
- **அர்த்தம்**: periodic/condition-based auto credit rule enable செய்யலாமா?
- **YES**: மாதந்தோறும்/வருடந்தோறும் credit auto வேண்டுமெனில்.
- **NO**: manual credit மட்டுமே.

## 8) Allow Hourly
- **அர்த்தம்**: event-ஐ days மட்டும் இல்லாமல் hours-ஆகவும் apply செய்யலாமா?
- **YES**: Permission/Short leave போன்ற hourly use cases.
- **NO**: full-day/half-day மட்டும்.

## 9) Allow Datewise
- **அர்த்தம்**: date-wise split/detail entry அனுமதிக்குமா?
- **YES**: நாள் வாரியாக பதிவு செய்ய வேண்டிய events.
- **NO**: aggregate மட்டும் போதுமெனில்.

## 10) Allow WeekOff Selection
- **அர்த்தம்**: Week Off நாளை தேர்வு செய்து இந்த event apply செய்யலாமா?
- **YES**: Week off-க்கும் பொருந்தும் event.
- **NO**: workday மட்டுமே.

## 11) Allow Holiday Selection
- **அர்த்தம்**: Holiday நாளை தேர்வு செய்து apply செய்யலாமா?
- **YES**: holiday-ல் பயன்படுத்தக்கூடிய event.
- **NO**: holiday-க்கு பொருந்தாத event.

## 12) Applicable for Regularization
- **அர்த்தம்**: Attendance regularization flow-ல் இந்த event பயன்படுத்தப்படுமா?
- **YES**: regularizationக்கு valid event.
- **NO**: regularization-க்கு வேண்டாம்.

## 13) Allow Different Leave Period
- **அர்த்தம்**: default leave period-ஐ விட வேறு period select செய்யலாமா?
- **YES**: custom leave cycle தேவையான போது.
- **NO**: ஒரே leave period கட்டுப்பாடு.

## 14) Allow Event Change
- **அர்த்தம்**: submit ஆன event type-ஐ பிறகு மாற்ற அனுமதிக்குமா?
- **YES**: correction/edit flexibility வேண்டும்.
- **NO**: audit strictness வேண்டும்.

## 15) Validation Remarks Mandatory
- **அர்த்தம்**: submit செய்யும்போது remarks கட்டாயமா?
- **YES**: reason capture mandatory.
- **NO**: optional remarks.

## 16) Priority
- **அர்த்தம்**: processing order / display order.
- **குறைந்த number** = higher priority (பொதுவாக).
- Rule conflicts வந்தால் priority பயன்படும்.

## 17) Event Entry Form
- **அர்த்தம்**: event apply செய்ய பயன்படுத்தும் form type/layout.
- உதா: day-based form, hourly form, custom form.
- சரியான form select செய்தால் data entry error குறையும்.

## 18) Auto Credit Engine
- **அர்த்தம்**: auto credit logic எந்த engine/method மூலம் ஓட வேண்டும்.
- Rule-based / scheduler-based strategy select செய்ய பயன்படும்.

## 19) Encashment
- **அர்த்தம்**: unused balance encash (cash conversion) செய்யலாமா?
- **Default**: system default policy follow.
- organization payroll policyக்கு ஏற்ப set செய்ய வேண்டும்.

## 20) Can't overlap with
- **அர்த்தம்**: இந்த event-உடன் overlap ஆகக்கூடாத events list.
- உதா: Leave + On Duty same time இருக்கக்கூடாது.
- conflict preventionக்கான முக்கிய setting.

## 21) Leave Deduction while in FandF
- **அர்த்தம்**: Full & Final settlement நேரத்தில் இந்த event balance deduct செய்ய வேண்டுமா?
- **YES**: F&F policy-ல் deduct required என்றால்.
- **NO**: deduct செய்ய வேண்டாம்.

## 22) Send - Mail To On Entry
- **அர்த்தம்**: event entry நேரத்தில் email notification அனுப்ப வேண்டுமா?
- **YES**: approver/employee notification automation.
- **NO**: email வேண்டாம்.

## 23) Send - SMS To On Entry
- **அர்த்தம்**: event entry நேரத்தில் SMS notification அனுப்ப வேண்டுமா?
- **YES**: urgent alert/approval flows.
- **NO**: SMS வேண்டாம்.

---

## Event Rules

## 24) DateWise Rule (Enabled / Disabled)
- **அர்த்தம்**: ஒரு date-க்கு ஒரு rule என்ற வகையில் granular validation போடலாமா?
- **Enabled**:
  - குறிப்பிட்ட தேதிகளில் மட்டும் apply செய்ய rules போடலாம்.
  - seasonal / month-end / special date controlsக்கு உதவும்.
- **Disabled**:
  - பொதுவான rule மட்டும் apply ஆகும்.

---

## Quick Recommendation (Practical)

- **Leave-like components**:  
  `Has balance = YES`, `Allow Auto Credit Rule = YES/NO (policy-based)`, `Encashment = policy-based`

- **Permission/Hourly components**:  
  `Allow Hourly = YES`, `Has balance = NO or YES` (policyப்படி)

- **Comp Off style components**:  
  `Credit from Over Time = YES`, `Has balance = YES`, `Allow WeekOff/Holiday Selection = YES` (தேவைப்பட்டால்)

- **Strict governance வேண்டுமெனில்**:  
  `Validation Remarks Mandatory = YES`, `Allow Event Change = NO`, `Can't overlap with = properly configure`

---

இந்த settings அனைத்தையும் business policy-க்கு align பண்ணி set பண்ணினா, attendance/event flows consistent-ஆ வேலை செய்யும்.
