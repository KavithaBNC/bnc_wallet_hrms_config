# Validation Process Rule - வழிகாட்டி (Tamil Guide)

> Attendance-ல் Late, Early Leave போன்ற விதிகளை தானியங்கி முறையில் கையாள இந்த Validation Process Rule பயன்படுகிறது.

---

## 🚀 Quick Setup - 5 நிமிடத்தில் Rule Create பண்ணுங்க!

> இந்த section-ல exact step-by-step எப்படி set பண்றதுன்னு இருக்கு.
> Permission + Leave (Auto Dynamic) + LOP fallback — 3 actions போதும்!

### Step 1: Rule Form திறக்க

```
Left Menu → HR Activities → Validation Process → "+ Add" button click
```

### Step 2: Basic Fields நிரப்புங்க

```
┌─────────────────────────────────────────────────┐
│ Display Name *    : Late Deduction Rule         │
│ Effective Date *  : 2026-02-19  (இன்றைய தேதி)  │
│ Shift             : All shifts (காலியா விடுங்க) │
│ Priority          : 1                           │
│ Paygroup *        : உங்க paygroup select        │
│ Department        : All (காலியா விடுங்க)         │
│ Associate         : காலியா விடுங்க (all-க்கு)    │
│ Remarks           : Late validation rule        │
└─────────────────────────────────────────────────┘
```

### Step 3: Validation Options

```
┌─────────────────────────────────────────────────┐
│ Auto Correct      : NO                          │
│ Correct After days: (காலி)                      │
│ Primary Action    : NO                          │
│ Has Limit         : YES  ← ⭐ இது ON பண்ணுங்க  │
└─────────────────────────────────────────────────┘
```

### Step 4: Validation Rule Limits

"+ Add" click பண்ணி ஒரு row add பண்ணுங்க:

```
┌──────────────┬─────────────┬──────────┬─────────────────────┬──────────────────────┐
│ Periodicity  │ Max Minutes │ No Of    │ Apply After Every   │ Deduct As Per        │
│              │             │ Count    │ Count               │ Priority             │
├──────────────┼─────────────┼──────────┼─────────────────────┼──────────────────────┤
│ Monthly      │ 15          │ 2        │ (unchecked)         │ Action1              │
└──────────────┴─────────────┴──────────┴─────────────────────┴──────────────────────┘

விளக்கம்:
  Max Minutes = 15  → மாதம் 15 min வரை grace (optional)
  No Of Count = 2   → Permission monthly 2 முறை மட்டும்
  Deduct As Per Priority = Action1 → Permission exhausted ஆனா Half Day Leave-க்கு fallback
```

### Step 5: Actions - 3 Actions Create பண்ணுங்க

**Action0 — Permission (0-2 hr late)**
```
┌─────────────────────────────────────────────────┐
│ Name             : Permission                    │
│ Min Minutes      : 0                             │
│ Max Minutes      : 120                           │
│ Condition        : ALL                           │
│ Correction Method: Permission                    │
│ Auto Apply       : YES                           │
│ Event Type       : (Select event)                │
│ Day Type         : Auto                          │
│ Days             : Auto  ← அப்படியே விடுங்க      │
└─────────────────────────────────────────────────┘
```

**Action1 — Half Day Leave (2-4 hr late)**
"+" button click பண்ணி புதிய action add:
```
┌─────────────────────────────────────────────────┐
│ Name             : Half Day Leave                │
│ Min Minutes      : 121                           │
│ Max Minutes      : 240                           │
│ Condition        : ALL                           │
│ Correction Method: Apply Event                   │
│ Auto Apply       : YES                           │
│ Event Type       : (உங்க Leave event select)     │
│ Day Type         : Auto                          │
│ Days             : "Auto" click → 0.5 type       │
│                    ⭐ Manual mode-ல 0.5 enter    │
└─────────────────────────────────────────────────┘
```

**Action2 — Dynamic Leave (4+ hr late)**
"+" button click பண்ணி இன்னொரு action add:
```
┌─────────────────────────────────────────────────┐
│ Name             : Leave                         │
│ Min Minutes      : 241                           │
│ Max Minutes      : (காலி - empty விடுங்க!)       │
│ Condition        : ALL                           │
│ Correction Method: Apply Event                   │
│ Auto Apply       : YES                           │
│ Event Type       : (உங்க Leave event select)     │
│ Day Type         : Auto                          │
│ Days             : Auto  ← ⭐ Auto-வே விடுங்க!   │
│                                                   │
│  Auto = system dynamically calculate பண்ணும்:     │
│  totalHours ÷ 8 = days (0.5 unit round up)       │
│                                                   │
│  4hr → 0.5 day    12hr → 1.5 days                │
│  8hr → 1 day      15hr → 2 days                  │
│  24hr → 3 days    32hr → 4 days                  │
└─────────────────────────────────────────────────┘
```

### Step 6: Save

```
Page bottom-ல "Save" button click → Rule saved! ✅
```

### Step 7: Late Deductions Calculate பண்ண

```
HR Activities → Validation Process → "Late Deductions" tab click
  ├── Pay Group select
  ├── From Date: 2026-02-01
  ├── To Date: 2026-02-28
  └── "Calculate Late Deductions" button click

System output:
  Employee  │ Late Count │ Total Hr │ Deduction Type │ Days
  Rajan     │ 5          │ 15 hr    │ Leave          │ 2.0
  Kumar     │ 3          │ 3 hr     │ Leave          │ 0.5
  Priya     │ 2          │ 1.5 hr   │ Permission     │ -
  Mani      │ 8          │ 24 hr    │ Leave          │ 3.0
```

### Employee Grid (Late) – Monthly Total Logic

> **Employee Grid** tab-ல் HR employees select பண்ணி rule apply பண்ணும்போது, **மாத total late minutes** use பண்ணப்படும் (per-day அல்ல).

| மாத Total Late | Action |
|----------------|--------|
| ≤ 2 hr (120 min) | Permission |
| 2–4 hr (120–240 min) | Half day EL |
| > 4 hr (240+ min) | Full day EL |

**எடுத்துக்காட்டு:** Lisha Feb-ல் 3 நாட்கள் late (50+60+55 = 165 min total) → ஒரு Half day EL மட்டும் apply ஆகும் (per-day அல்ல).

---

## 📋 பொதுவான புலங்கள் (Basic Fields)

### 1. Display Name (காட்சிப் பெயர்) `*கட்டாயம்`

**என்ன:** இந்த Rule-க்கு ஒரு பெயர் கொடுக்க வேண்டும்.

**எடுத்துக்காட்டு:**
- `Worker Late Rule`
- `Manager Late Policy`
- `Factory Staff Late`

**எப்படி செட் செய்வது:**
> Text box-ல் பெயரை type செய்யுங்கள். இது உங்கள் rule list-ல் எளிதாக கண்டுபிடிக்க உதவும்.

---

### 2. Effective Date (நடைமுறைக்கு வரும் தேதி) `*கட்டாயம்`

**என்ன:** இந்த Rule எந்த தேதி முதல் பொருந்தும் என்பதை குறிக்கிறது.

**எடுத்துக்காட்டு:** `19-02-2026`

**எப்படி செட் செய்வது:**
> Calendar icon-ஐ click செய்து தேதியை தேர்வு செய்யுங்கள். இந்த தேதிக்கு முன்பு இந்த rule வேலை செய்யாது.

**முக்கிய குறிப்பு:**
- இன்றைய தேதி default-ஆக வரும்
- எதிர்காலத்தில் நடைமுறைக்கு வர வேண்டும் என்றால் அந்த தேதியை கொடுக்கலாம்

---

### 3. Shift (ஷிப்ட்)

**என்ன:** இந்த Rule எந்த Shift-க்கு பொருந்தும் என்பதை தேர்வு செய்யலாம்.

**எப்படி செட் செய்வது:**
> Dropdown-ல் ஒன்று அல்லது பல Shift-களை தேர்வு செய்யுங்கள்.

| Setting | விளக்கம் |
|---------|----------|
| எதுவும் தேர்வு செய்யவில்லை | எல்லா Shift-களுக்கும் பொருந்தும் (All Shifts) |
| General Shift | General Shift ஊழியர்களுக்கு மட்டும் பொருந்தும் |
| Night Shift, Morning Shift | இரண்டு Shift ஊழியர்களுக்கும் பொருந்தும் |

---

### 4. Priority (முன்னுரிமை)

**என்ன:** ஒரு ஊழியருக்கு பல Rule-கள் பொருந்தும்போது, எந்த Rule முதலில் வேலை செய்ய வேண்டும் என்பதை தீர்மானிக்கிறது.

**எப்படி செட் செய்வது:**
> எண்ணை type செய்யுங்கள் அல்லது (Auto) விட்டுவிடுங்கள்.

| Priority எண் | அர்த்தம் |
|--------------|----------|
| `1` | மிக உயர்ந்த முன்னுரிமை (முதலில் apply ஆகும்) |
| `2` | இரண்டாவது முன்னுரிமை |
| `(Auto)` | System தானாக set செய்யும் |

**முக்கிய குறிப்பு:** குறைந்த எண் = அதிக முன்னுரிமை. Rule `1` முதலில் check ஆகும், பிறகு `2`, `3` என்ற வரிசையில்.

---

### 5. Paygroup (சம்பள குழு) `*கட்டாயம்`

**என்ன:** இந்த Rule எந்த Paygroup ஊழியர்களுக்கு பொருந்தும் என்பதை குறிக்கிறது.

**எப்படி செட் செய்வது:**
> Dropdown-ல் ஒன்று அல்லது பல Paygroup-களை தேர்வு செய்யுங்கள். குறைந்தது ஒரு Paygroup கட்டாயம்.

**எடுத்துக்காட்டு:**
- `Monthly Salary` - மாத சம்பளம் பெறுபவர்கள்
- `Daily Wages` - தினசரி கூலி பெறுபவர்கள்

---

### 6. Department (துறை)

**என்ன:** இந்த Rule எந்த Department ஊழியர்களுக்கு பொருந்தும் என்பதை குறிக்கிறது.

**எப்படி செட் செய்வது:**
> Dropdown-ல் department-களை தேர்வு செய்யுங்கள்.

| Setting | விளக்கம் |
|---------|----------|
| எதுவும் தேர்வு செய்யவில்லை | எல்லா Department-களுக்கும் பொருந்தும் |
| Production | Production department-க்கு மட்டும் |

---

### 7. Associate (ஊழியர்)

**என்ன:** குறிப்பிட்ட ஊழியர்களுக்கு மட்டும் இந்த Rule-ஐ பொருத்த.

**எப்படி செட் செய்வது:**
> Search box-ல் ஊழியரின் பெயர் அல்லது Employee Code type செய்து தேர்வு செய்யுங்கள்.

**முக்கிய குறிப்பு:** Associate தேர்வு செய்தால் அது மிக உயர்ந்த முன்னுரிமை பெறும் (Score 4). அதாவது Department/Paygroup level rule-களை விட இது முதலில் apply ஆகும்.

---

### 8. Remarks (குறிப்புகள்)

**என்ன:** இந்த Rule பற்றிய கூடுதல் குறிப்புகள்.

**எடுத்துக்காட்டு:** `Factory workers-க்கான late policy - 2026 Feb முதல் நடைமுறை`

---

## ⚙️ Validation Options (சரிபார்ப்பு விருப்பங்கள்)

### 9. Auto Correct (தானியங்கி திருத்தம்)

**என்ன:** Late/violation-ஐ system தானாக திருத்தம் செய்ய வேண்டுமா?

| மதிப்பு | விளக்கம் |
|---------|----------|
| **NO** (சிவப்பு) | HR/Manager கைமுறையாக திருத்த வேண்டும் |
| **YES** (பச்சை) | System தானாக திருத்தம் செய்யும் |

**எப்போது YES வைக்கணும்:**
- Late-க்கு தானாக Leave கழிக்க வேண்டும் என்றால்
- Manual intervention தேவையில்லை என்றால்

---

### 10. Correct After Days (எத்தனை நாள் கழித்து திருத்தம்)

**என்ன:** Auto Correct = YES எனில், எத்தனை நாள் கழித்து system தானாக திருத்தம் செய்ய வேண்டும்.

**எடுத்துக்காட்டு:**

| மதிப்பு | விளக்கம் |
|---------|----------|
| `1` | 1 நாள் கழித்து auto correct ஆகும் |
| `3` | 3 நாட்கள் கழித்து auto correct ஆகும் |
| `0.5` | அரை நாள் கழித்து (Decimal ஆகவும் கொடுக்கலாம்) |

---

### 11. Primary Action (முதன்மை நடவடிக்கை)

**என்ன:** இந்த Rule-ன் action-ஐ முதன்மை நடவடிக்கையாக கருத வேண்டுமா.

| மதிப்பு | விளக்கம் |
|---------|----------|
| **NO** | இது துணை/இரண்டாம் நிலை action |
| **YES** | இது முதன்மை action - முதலில் இது apply ஆகும் |

---

### 12. Has Limit (வரம்பு உண்டா)

**என்ன:** இந்த Rule-க்கு Late எண்ணிக்கை/நிமிட வரம்பு உண்டா?

| மதிப்பு | விளக்கம் |
|---------|----------|
| **NO** | வரம்பு இல்லை - ஒவ்வொரு Late-க்கும் action apply ஆகும் |
| **YES** | வரம்புக்கு மேல் போனால் மட்டும் action apply ஆகும் |

**எப்போது YES வைக்கணும்:**
- "மாதத்தில் 3 Late-க்கு மேல் போனால் மட்டும் Leave கழி" என்ற policy இருந்தால்

---

### 13. Reminder Action (நினைவூட்டல்)

**என்ன:** Late/violation நடந்தால் reminder அனுப்ப. (UI placeholder - backend இன்னும் implement ஆகவில்லை)

**எதிர்காலத்தில்:**
- N நாட்கள்/எண்ணிக்கைக்குப் பிறகு notification அனுப்புதல்
- Manager/HR-க்கு alert அனுப்புதல்

---

## 📊 Validation Rule Limits (சரிபார்ப்பு வரம்புகள்)

> "Has Limit = YES" எனில் இந்த section-ல் வரம்புகளை configure செய்யுங்கள்.

### 14. Periodicity (காலக்கட்டம்)

**என்ன:** வரம்பை எந்த காலக்கட்டத்தில் கணக்கிட வேண்டும்.

| மதிப்பு | விளக்கம் |
|---------|----------|
| **Daily** | ஒரு நாளுக்கு (இன்று மட்டும்) |
| **Weekly** | ஒரு வாரத்தில் (திங்கள் - ஞாயிறு) |
| **Monthly** | ஒரு மாதத்தில் (1 முதல் 30/31 வரை) |

**எடுத்துக்காட்டு:** Monthly + Count 3 = "மாதத்தில் 3 Late-க்கு மேல் போனால் action apply"

---

### 15. Max Minutes (அதிகபட்ச நிமிடங்கள்)

**என்ன:** எத்தனை நிமிடம் Late வரை அனுமதி.

**எடுத்துக்காட்டு:**

| மதிப்பு | விளக்கம் |
|---------|----------|
| `15` | 15 நிமிட Late வரை action apply ஆகாது |
| `30` | 30 நிமிட Late-க்கு மேல் போனால் action apply ஆகும் |

---

### 16. No Of Count (எண்ணிக்கை)

**என்ன:** காலக்கட்டத்தில் எத்தனை முறை Late வர அனுமதி.

**எடுத்துக்காட்டு:**

| மதிப்பு | விளக்கம் |
|---------|----------|
| `3` | மாதத்தில் 3 Late வரை OK, 4வது Late-க்கு action apply |
| `5` | மாதத்தில் 5 Late வரை OK |

---

### 17. Apply After Every Count (ஒவ்வொரு எண்ணிக்கைக்கும் பிறகு apply செய்)

**என்ன:** வரம்பு கடந்த பிறகு ஒவ்வொரு Late-க்கும் action apply செய்ய வேண்டுமா?

| Setting | விளக்கம் |
|---------|----------|
| ✅ Checked | 3 count limit-க்கு மேல் 4வது, 5வது, 6வது... ஒவ்வொன்றுக்கும் action apply ஆகும் |
| ☐ Unchecked | வரம்பு கடக்கும் போது ஒரே ஒரு முறை மட்டும் action apply ஆகும் |

---

### 18. Deduct As Per Priority (முன்னுரிமை படி கழி)

**என்ன:** பல Action-கள் இருக்கும்போது, எந்த Action-ன்படி கழிக்க வேண்டும்.

| மதிப்பு | விளக்கம் |
|---------|----------|
| **Action0** | முதல் Action-ன் படி கழிக்கும் |
| **Action1** | இரண்டாவது Action-ன் படி கழிக்கும் |
| **Action2** | மூன்றாவது Action-ன் படி கழிக்கும் |

---

## 🎯 Action Configuration (நடவடிக்கை அமைப்பு)

> ஒரு Rule-ல் பல Action-களை சேர்க்கலாம் (Action0, Action1, Action2...).

### 19. Action Name (நடவடிக்கையின் பெயர்)

**என்ன:** Action-க்கான பெயர் (header-ல் உள்ள நீல பட்டியில் edit செய்யலாம்).

**Default:** `Action0`, `Action1`, `Action2`...

---

### 20. Condition (நிபந்தனை)

**என்ன:** இந்த Action எப்போது apply ஆகும்.

| மதிப்பு | விளக்கம் |
|---------|----------|
| **ALL** (சிவப்பு) | எல்லா பொருத்தமான records-க்கும் apply ஆகும் |
| **Selected** (பச்சை) | தேர்வு செய்யப்பட்ட records-க்கு மட்டும் apply ஆகும் |

---

### 21. Correction Method (திருத்த முறை)

**என்ன:** Late/Violation-ஐ எப்படி சரி செய்ய வேண்டும்.

| மதிப்பு | விளக்கம் | எப்போது பயன்படுத்தணும் |
|---------|----------|----------------------|
| **Apply Event** | ஒரு Attendance Event-ஐ apply செய்யும் | Late event, Half-day event mark செய்ய |
| **Auto** | System தானாக தீர்மானிக்கும் | System-க்கு விட்டுவிட |
| **Leave** | Leave கழிக்கும் | Late-க்கு Leave balance-ல் இருந்து கழிக்க |
| **LOP** (Loss of Pay) | சம்பளத்தில் கழிக்கும் | Leave balance இல்லாத போது சம்பள கழிப்பு |
| **CompOff** (Compensatory Off) | CompOff-ல் சரி செய்யும் | Extra வேலை செய்த நாள் adjust செய்ய |

---

### 22. Event Type (நிகழ்வு வகை)

**என்ன:** Correction Method = "Apply Event" எனில், எந்த Attendance Event-ஐ apply செய்ய வேண்டும்.

**எப்படி செட் செய்வது:**
> Dropdown-ல் உங்கள் organization-ல் உள்ள Attendance Component-களில் ஒன்றை தேர்வு செய்யுங்கள்.

**எடுத்துக்காட்டு:** `Late Arrival`, `Half Day`, `Early Leave`

**குறிப்பு:** Correction Method "Apply Event" ஆக இருக்கும்போது மட்டும் இது கட்டாயம்.

---

### 23. Auto Apply (தானியங்கி apply)

**என்ன:** இந்த Action-ஐ system தானாக apply செய்ய வேண்டுமா.

| மதிப்பு | விளக்கம் |
|---------|----------|
| **NO** (சிவப்பு) | HR/Manager approval-க்குப் பிறகு manually apply ஆகும் |
| **YES** (பச்சை) | System தானாக apply செய்யும் - manual intervention தேவையில்லை |

---

### 24. Day Type (நாள் வகை)

**என்ன:** Action-ஐ apply செய்யும்போது நாள் கணக்கீடு எப்படி.

| மதிப்பு | விளக்கம் |
|---------|----------|
| **Auto** (பச்சை) | System தானாக நாள் கணக்கிடும் (Late நிமிடங்களின் அடிப்படையில்) |
| **Manual** (சிவப்பு) | நீங்கள் நாள் மதிப்பை கொடுக்க வேண்டும் |

---

### 25. Days (நாட்கள்)

**என்ன:** எத்தனை நாள் கழிக்க/apply செய்ய வேண்டும்.

| மதிப்பு | விளக்கம் |
|---------|----------|
| **Auto** (பச்சை) | System தானாக கணக்கிடும் |
| **Manual** (சிவப்பு) | நீங்களே மதிப்பு கொடுக்கணும் (எ.கா. `0.5` = அரை நாள், `1` = ஒரு நாள்) |

**எடுத்துக்காட்டு:** ஒரு Late-க்கு அரை நாள் Leave கழிக்க → Days = Manual, Days Value = `0.5`

---

## 🏗️ Rule Matching - எந்த Rule பொருந்தும்? (Score System)

ஒரு ஊழியருக்கு பல Rule-கள் இருக்கும்போது, system இந்த score அடிப்படையில் சரியான rule-ஐ தேர்வு செய்யும்:

| Score | Match வகை | விளக்கம் |
|-------|-----------|----------|
| **4** (மிக உயர்வு) | Employee ID match | குறிப்பிட்ட ஊழியருக்கான rule |
| **3** | Paygroup + Department | Paygroup மற்றும் Department இரண்டும் match |
| **2** | Paygroup அல்லது Department | ஏதாவது ஒன்று match |
| **1** | Shift match | Shift மட்டும் match |
| **0** (மிக குறைவு) | Organization-wide | எந்த filter-ம் இல்லை - எல்லாருக்கும் பொருந்தும் |

**உயர்ந்த score உள்ள rule முதலில் apply ஆகும்.**

---

## 📝 முழு எடுத்துக்காட்டு: Factory Worker Late Policy

### Scenario
> "Factory Worker-கள் மாதத்தில் 3 முறை 15 நிமிடம் வரை Late வரலாம். 4வது Late-லிருந்து ஒவ்வொரு Late-க்கும் அரை நாள் Leave கழிக்க வேண்டும்."

### படிப்படியாக Setup

**Step 1 - Basic Fields:**

| Field | Value |
|-------|-------|
| Display Name | `Factory Worker Late Rule` |
| Effective Date | `19-02-2026` |
| Shift | General Shift |
| Priority | `1` |
| Paygroup | `Daily Wages` |
| Department | `Production` |
| Remarks | `Factory late policy - 2026 முதல்` |

**Step 2 - Validation Options:**

| Field | Value |
|-------|-------|
| Auto Correct | **YES** |
| Correct After Days | `1` |
| Primary Action | **YES** |
| Has Limit | **YES** |

**Step 3 - Validation Rule Limits:**

| Periodicity | Max Minutes | No Of Count | Apply After Every Count | Deduct As Per Priority |
|-------------|-------------|-------------|------------------------|----------------------|
| Monthly | 15 | 3 | ✅ Checked | Action0 |

**Step 4 - Action Configuration:**

| Field | Value |
|-------|-------|
| Action Name | `Action0` |
| Condition | `ALL` |
| Correction Method | `Leave` |
| Auto Apply | `YES` |
| Day Type | `Manual` |
| Days | `Manual` |
| Days Value | `0.5` |

### இது எப்படி வேலை செய்யும்

```
ஊழியர் "Rajan" - Production department, Daily Wages paygroup

Feb 1  - 9:10 AM வந்தார் (10 நிமிட Late) → Count 1/3 → ✅ அனுமதி (வரம்புக்குள்)
Feb 5  - 9:20 AM வந்தார் (20 நிமிட Late) → Count 2/3 → ✅ அனுமதி (வரம்புக்குள்)
Feb 12 - 9:08 AM வந்தார் (8 நிமிட Late)  → Count 3/3 → ✅ அனுமதி (வரம்புக்குள்)
Feb 18 - 9:25 AM வந்தார் (25 நிமிட Late) → Count 4/3 → ❌ வரம்பு தாண்டியது!
         → System தானாக 0.5 நாள் Leave கழிக்கும் (Auto Apply = YES)
Feb 22 - 9:15 AM வந்தார் (15 நிமிட Late) → Count 5/3 → ❌ வரம்பு தாண்டியது!
         → மீண்டும் 0.5 நாள் Leave கழிக்கும் (Apply After Every Count = ✅)
```

---

## 📝 எடுத்துக்காட்டு 2: Office Staff - LOP Policy

### Scenario
> "Office staff மாதத்தில் 2 Late-க்கு மேல் வந்தால், LOP (Loss of Pay) கழிக்க வேண்டும்."

**Basic Fields:**

| Field | Value |
|-------|-------|
| Display Name | `Office Staff LOP Rule` |
| Effective Date | `01-03-2026` |
| Paygroup | `Monthly Salary` |
| Department | All departments |
| Has Limit | **YES** |

**Limits:**

| Periodicity | Max Minutes | No Of Count | Apply After Every Count | Deduct As Per Priority |
|-------------|-------------|-------------|------------------------|----------------------|
| Monthly | — | 2 | ✅ | Action0 |

**Action:**

| Field | Value |
|-------|-------|
| Correction Method | `LOP` |
| Auto Apply | `NO` (HR approval தேவை) |
| Day Type | `Manual` |
| Days Value | `1` (ஒரு நாள் LOP) |

---

## 📝 எடுத்துக்காட்டு 3: குறிப்பிட்ட ஊழியருக்கான Rule

### Scenario
> "Saravanan-க்கு Late-க்கு CompOff கழிக்க வேண்டும்."

**Basic Fields:**

| Field | Value |
|-------|-------|
| Display Name | `Saravanan Special Rule` |
| Associate | `Saravanan` (Search செய்து தேர்வு) |
| Paygroup | `Monthly Salary` |
| Has Limit | **NO** (ஒவ்வொரு Late-க்கும் apply) |

**Action:**

| Field | Value |
|-------|-------|
| Correction Method | `CompOff` |
| Auto Apply | `YES` |
| Days | `Auto` |

> Associate-ஆக Saravanan-ஐ தேர்வு செய்ததால், இது Score 4 பெறும். வேறு எந்த organization/department level rule-ஐ விடவும் இது முதலில் apply ஆகும்.

---

## 🎯 Tiered Late Policy Setup (நிமிட அடிப்படையில் படிநிலை Late Policy)

> **NEW FEATURE**: ஒவ்வொரு Action-ல் இப்போது **Min Minutes** மற்றும் **Max Minutes** கொடுக்கலாம்.
> இதன் மூலம் "எத்தனை நிமிடம் Late" என்பதின் அடிப்படையில் வேறுபட்ட action-களை apply செய்யலாம்.
> Permission-க்கு monthly limit வைத்து, exhausted ஆனால் automatically Half Day-க்கு fall back ஆகும்.

### Real-World Scenario: படிநிலை Late Policy + Permission Exhaustion

```
Company Policy:
┌──────────────────────────────────────────────────────────────────┐
│  0 - 2 hr late   →  2hr Permission FULL BLOCK cut               │
│  2 - 4 hr late   →  Half Day Leave (0.5 day)                    │
│  4+ hr late      →  Full Day Leave (1 day)                      │
│                                                                  │
│  Monthly Permission Limit = 2                                    │
│  Permission exhausted → Half Day Leave-க்கு fall back            │
│  Leave balance இல்லன்னா → LOP                                   │
└──────────────────────────────────────────────────────────────────┘
```

### படிப்படியாக Setup - ஒரே Rule-ல் 4 Actions + Limit

**Step 1 - Basic Fields நிரப்புங்கள்:**

| Field | Value | விளக்கம் |
|-------|-------|----------|
| Display Name | `Late Tiered Policy` | பெயர் |
| Effective Date | `19-02-2026` | இன்று முதல் |
| Shift | காலியா விடுங்க | எல்லா Shift-க்கும் |
| Priority | `1` | முதல் முன்னுரிமை |
| Paygroup | உங்க paygroup select பண்ணுங்க | **கட்டாயம்** |
| Department | காலியா விடுங்க | எல்லா dept-க்கும் |

**Step 2 - Validation Options:**

| Field | Value | விளக்கம் |
|-------|-------|----------|
| Auto Correct | **YES** | தானாக apply ஆகும் |
| Correct After Days | `1` | 1 நாள் கழித்து |
| Primary Action | **YES** | முதன்மை action |
| Has Limit | **YES** | Permission-க்கு monthly limit உண்டு |

**Step 3 - Validation Rule Limits (Permission Monthly Limit):**

"+ Add" button click செய்து இந்த limit add பண்ணுங்கள்:

| Periodicity | Max Minutes | No Of Count | Apply After Every Count | Deduct As Per Priority |
|-------------|-------------|-------------|------------------------|----------------------|
| **Monthly** | (காலி) | **2** | ✅ Checked | **Action1** |

> **விளக்கம்:** மாதத்தில் 2 Permission வரை OK. 2 Permission-ம் use ஆன பிறகு,
> Permission range (0-2hr) late வந்தாலும் **Action1 (Half Day Leave)** apply ஆகும்.

**Step 4 - 4 Action Blocks Create பண்ணுங்கள்:**

"+" button-ஐ press செய்து 4 Actions add பண்ணுங்கள்:

---

#### Action0: Permission (0-2 hr Late) — FULL 2hr BLOCK

| Field | Value | விளக்கம் |
|-------|-------|----------|
| **Min Minutes** | `0` | 0 நிமிடத்தில் இருந்து |
| **Max Minutes** | `120` | 120 நிமிடம் (2 மணி நேரம்) வரை |
| Condition | `ALL` | எல்லாருக்கும் |
| Correction Method | **Permission** | Permission-ஆக mark ஆகும் |
| Auto Apply | **YES** | தானாக apply |
| Day Type | `Manual` | நாம் value கொடுப்போம் |
| Days | `Manual` | Fixed block |
| Days Value | `2` | **எப்போதும் 2hr full block cut** |

> 💡 Late 45 min ஆனாலும், 1hr 30min ஆனாலும் → **2hr Permission FULL BLOCK** cut ஆகும்.
> மாதத்தில் 2 முறை மட்டும் இது apply ஆகும் (Limit: Monthly count = 2).

---

#### Action1: Half Day Leave (2-4 hr Late)

| Field | Value | விளக்கம் |
|-------|-------|----------|
| **Min Minutes** | `121` | 121 நிமிடத்தில் இருந்து (2hr தாண்டி) |
| **Max Minutes** | `240` | 240 நிமிடம் (4 மணி நேரம்) வரை |
| Condition | `ALL` | எல்லாருக்கும் |
| Correction Method | **Leave** | Leave கழிக்கும் |
| Auto Apply | **YES** | தானாக apply |
| Day Type | `Manual` | நாம் value கொடுப்போம் |
| Days | `Manual` | |
| Days Value | `0.5` | **அரை நாள் Leave** |

> 💡 2-4 hr late → Half Day Leave. Permission exhausted ஆனா 0-2hr late-க்கும் இதே action apply ஆகும்.

---

#### Action2: Full Day Leave (4+ hr Late)

| Field | Value | விளக்கம் |
|-------|-------|----------|
| **Min Minutes** | `241` | 241 நிமிடத்தில் இருந்து (4hr தாண்டி) |
| **Max Minutes** | காலியா விடுங்க | வரம்பு இல்லை |
| Condition | `ALL` | எல்லாருக்கும் |
| Correction Method | **Leave** | Leave கழிக்கும் |
| Auto Apply | **YES** | தானாக apply |
| Day Type | `Manual` | நாம் value கொடுப்போம் |
| Days | `Manual` | |
| Days Value | `1` | **1 முழு நாள் Leave** |

> 💡 4 மணி நேரத்துக்கு மேல் Late → Full Day Leave கழியும்

---

#### Action3: LOP (Leave Balance இல்லன்னா)

| Field | Value | விளக்கம் |
|-------|-------|----------|
| **Min Minutes** | `121` | 2hr மேல் late-க்கு |
| **Max Minutes** | காலியா விடுங்க | வரம்பு இல்லை |
| Condition | `ALL` | எல்லாருக்கும் |
| Correction Method | **LOP** | Loss of Pay கழிக்கும் |
| Auto Apply | **NO** | HR manual-ஆ approve பண்ணணும் |
| Day Type | `Auto` | System கணக்கிடும் |
| Days | `Auto` | |

> 💡 Leave balance இல்லாத ஊழியர்களுக்கு LOP. HR approval தேவை.

---

**Step 5 - Save பண்ணுங்கள்!**

### இது எப்படி வேலை செய்யும்

```
ஊழியர் "Rajan" - Shift: General (9:00 AM - 6:00 PM)
Monthly Permission Limit: 2

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Feb 3  - 10:30 AM வந்தார் (90 min Late = 1.5 hr)
  → Action0 match (0–120 min)
  → Permission used: 1/2
  → 2hr Permission FULL BLOCK cut ✅
  → Excess stay: 1:30 hr காட்டும் (6:00 PM வரை இருந்தார்)

Feb 10 - 10:00 AM வந்தார் (60 min Late = 1 hr)
  → Action0 match (0–120 min)
  → Permission used: 2/2
  → 2hr Permission FULL BLOCK cut ✅
  → Permission EXHAUSTED இனி! 🚨

Feb 17 - 10:45 AM வந்தார் (105 min Late = 1hr 45min)
  → Action0 match (0–120 min) → Permission...
  → BUT Permission exhausted (2/2 used)!
  → FALL BACK → Action1 (Half Day Leave)
  → 0.5 நாள் Leave cut ✅

Feb 20 - 12:30 PM வந்தார் (210 min Late = 3.5 hr)
  → Action1 match (121–240 min)
  → 0.5 நாள் Leave cut (Half Day) ✅

Feb 25 - 3:00 PM வந்தார் (360 min Late = 6 hr)
  → Action2 match (241+ min)
  → 1 நாள் Leave cut (Full Day) ✅
  → Leave balance இல்லன்னா → LOP apply ஆகும்
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Permission Exhaustion Flow Diagram

```
Late detected
    │
    ▼
┌─────────────────────┐
│ எத்தனை நிமிடம் Late?│
└─────────┬───────────┘
          │
    ┌─────┴──────────────────────────┐
    │             │                  │
  0-120 min    121-240 min       241+ min
    │             │                  │
    ▼             ▼                  ▼
┌──────────┐ ┌──────────┐    ┌──────────┐
│Permission│ │Half Day  │    │Full Day  │
│(2hr block)│ │(0.5 day) │    │(1 day)   │
└────┬─────┘ └──────────┘    └──────────┘
     │
     ▼
┌────────────────────────┐
│Monthly limit check:    │
│Permission used < 2?    │
└────┬──────────┬────────┘
     │          │
   YES ✅     NO ❌ (exhausted)
     │          │
     ▼          ▼
┌──────────┐ ┌──────────┐
│Permission│ │Half Day  │ ← Fall back (Deduct As Per Priority = Action1)
│apply ✅  │ │Leave ✅  │
└──────────┘ └────┬─────┘
                  │
                  ▼
            ┌──────────┐
            │Leave     │
            │balance?  │
            └──┬────┬──┘
             YES   NO
              │     │
              ▼     ▼
          ┌──────┐┌───┐
          │Leave ││LOP│
          │cut ✅││ ✅│
          └──────┘└───┘
```

### Configuration Summary Table

| Action | Min Min | Max Min | Method | Days | விளக்கம் |
|--------|---------|---------|--------|------|----------|
| Action0 | 0 | 120 | Permission | 2 (hr block) | 0-2 hr → 2hr Permission |
| Action1 | 121 | 240 | Leave | 0.5 (half day) | 2-4 hr → Half Day |
| Action2 | 241 | (empty) | Leave | 1 (full day) | 4+ hr → Full Day |
| Action3 | 121 | (empty) | LOP | Auto | Leave இல்லன்னா LOP |

| Limit | Periodicity | Count | Deduct As Per Priority |
|-------|-------------|-------|----------------------|
| Permission limit | Monthly | 2 | Action1 (Half Day) |

---

## 📊 Late Deductions Tab - எப்படி Use பண்றது

> **NEW**: Validation Process page-ல் புதிய **"Late Deductions"** tab add ஆகியுள்ளது.
> இது date range-க்கான TOTAL late hours-ஐ employee-wise aggregate பண்ணி, tier rule apply பண்ணி deduction காட்டும்.

### எப்படி Use பண்றது

```
Step 1: HR Activities → Validation Process → "Late Deductions" tab click

Step 2: Filters select பண்ணுங்க
  ├── Pay Group: உங்க paygroup select (அல்லது All)
  ├── From Date: மாத தொடக்கம் (e.g. 2026-02-01)
  └── To Date: மாத முடிவு (e.g. 2026-02-28)

Step 3: "Calculate Late Deductions" button click

Step 4: System காட்டும்:
  ┌──────────────────────────────────────────────────────────────┐
  │  Summary Cards:                                             │
  │  [Employees with Late: 5] [Total Late Count: 20] [Hours: 38]│
  │                                                              │
  │  Employee Table:                                             │
  │  # │ Code  │ Name     │ Count │ Total Hr │ Action  │ Type   │ Days │
  │  1 │ EMP01 │ Rajan    │ 5     │ 12 hr    │ Action3 │ Leave  │ 1.5  │
  │  2 │ EMP02 │ Saravanan│ 7     │ 8 hr     │ Action2 │ Leave  │ 1    │
  │  3 │ EMP03 │ Kumar    │ 3     │ 4 hr     │ Action1 │ Leave  │ 0.5  │
  │  4 │ EMP04 │ Priya    │ 2     │ 1.5 hr   │ Action0 │ Perm.  │ 2hr  │
  │  5 │ EMP05 │ Mani     │ 3     │ 6 hr     │ Action2 │ Leave  │ 1    │
  └──────────────────────────────────────────────────────────────┘
```

### முக்கிய விஷயம்: Aggregated Calculation

```
❌ தினம் தினம் separately deduction இல்ல!
✅ TOTAL late hours for the ENTIRE PERIOD → then tier apply

எடுத்துக்காட்டு - Employee "Rajan", Feb 1-28:
  Feb 3  - 1.5 hr late
  Feb 7  - 2 hr late
  Feb 10 - 3 hr late
  Feb 14 - 2.5 hr late
  Feb 17 - 3 hr late
  ─────────────────────
  Total: 5 count, 12 hr late

  12 hr → Action3 tier (8+ hr) → 1.5 days Leave deduction
  (NOT 5 separate deductions!)
```

---

## ⚠️ முக்கிய குறிப்புகள்

1. **Paygroup கட்டாயம்** - ஒரு Rule-க்கு குறைந்தது ஒரு Paygroup தேர்வு செய்ய வேண்டும்.

2. **Monthly மட்டும் fully supported** - தற்போது Monthly periodicity limit checking முழுமையாக வேலை செய்கிறது. Daily/Weekly எதிர்காலத்தில் implement ஆகும்.

3. **Reminder Section** - இது UI placeholder மட்டுமே. Backend integration இன்னும் வரவில்லை.

4. **Validation Grouping** - தற்போது `Late` validation-க்கு மட்டும் இந்த rule வேலை செய்கிறது.

5. **Multiple Actions** - ஒரு Rule-ல் பல Action-களை (Action0, Action1, Action2) add செய்து, sort order மூலம் வரிசைப்படுத்தலாம்.

6. **Delete/Edit** - Rule list page-ல் இருந்து ஏற்கனவே உள்ள Rule-களை edit/delete செய்யலாம்.

7. **Access** - ORG_ADMIN, HR_MANAGER roles மட்டுமே Rule-களை create/update செய்ய முடியும். Delete-க்கு ORG_ADMIN/SUPER_ADMIN தேவை.

---

## 🔀 Navigation (வழிகாட்டி)

1. **Rule List Page:** Left menu → Validation Process → Rule list காணலாம்
2. **Add Rule:** "Add" button click → Form page-க்கு செல்லும்
3. **Edit Rule:** List-ல் rule-ஐ click → Edit form திறக்கும்
4. **Delete Rule:** List-ல் Delete button → Confirmation → Delete ஆகும்

---

## 📞 Help

சந்தேகம் இருந்தால்:
- `Correction Method` தேர்வு செய்வதில் குழப்பம் → **Leave** என்பது பொதுவான choice
- `Auto Apply` YES/NO → முதலில் **NO** வைத்து test செய்யுங்கள், பிறகு YES-க்கு மாற்றுங்கள்
- Multiple Rules → **Priority** number சரியாக கொடுங்கள் (குறைந்த எண் = முதலில் apply)
