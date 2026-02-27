# HRMS Portal 2026 - System Architecture Plan

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [System Architecture Overview](#system-architecture-overview)
3. [Technology Stack](#technology-stack)
4. [Database Schema](#database-schema)
5. [Module Breakdown](#module-breakdown)
6. [API Architecture](#api-architecture)
7. [AI/ML Components](#aiml-components)
8. [Security & Compliance](#security--compliance)
9. [Development Roadmap](#development-roadmap)

---

## Executive Summary

This document outlines the architecture for a comprehensive HRMS (Human Resource Management System) portal built for 2026, featuring:
- **Core HR & Payroll Management** with multi-jurisdiction compliance
- **AI-powered Applicant Tracking System (ATS)** with resume parsing and intelligent ranking
- **AI Chatbot** for employee self-service and HR queries
- Modern, scalable architecture using React.js, Node.js/Express, and PostgreSQL

---

## System Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT LAYER                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │   React.js Web Application (SPA)                     │   │
│  │   - Redux/Context API for State Management           │   │
│  │   - React Query for Server State                     │   │
│  │   - TailwindCSS/Material-UI for UI Components        │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↕ HTTPS/WebSocket
┌─────────────────────────────────────────────────────────────┐
│                   API GATEWAY LAYER                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │   Nginx/Express Gateway                              │   │
│  │   - Rate Limiting, Load Balancing                    │   │
│  │   - JWT Authentication & Authorization               │   │
│  │   - Request Logging & Monitoring                     │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                  APPLICATION LAYER                           │
│  ┌──────────────┬──────────────┬───────────────────────┐    │
│  │   Core HR    │   Payroll    │   ATS Service         │    │
│  │   Service    │   Service    │   (with AI)           │    │
│  │ (Express.js) │ (Express.js) │  (Express.js + ML)    │    │
│  └──────────────┴──────────────┴───────────────────────┘    │
│  ┌──────────────┬──────────────┬───────────────────────┐    │
│  │  Attendance  │   Document   │   AI Chatbot          │    │
│  │   Service    │   Service    │   Service             │    │
│  │ (Express.js) │ (Express.js) │  (Express.js + NLP)   │    │
│  └──────────────┴──────────────┴───────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                    DATA LAYER                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │   PostgreSQL Database (Primary)                      │   │
│  │   - Core HR Data, Payroll, ATS, Attendance           │   │
│  │   - TimescaleDB Extension for Time-Series Data       │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │   Redis Cache                                        │   │
│  │   - Session Management, Rate Limiting                │   │
│  │   - Real-time Data Caching                           │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │   S3-Compatible Object Storage (MinIO/AWS S3)        │   │
│  │   - Documents, Resumes, Profile Pictures             │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                 EXTERNAL SERVICES                            │
│  ┌──────────┬──────────┬──────────┬────────────────────┐    │
│  │ Email    │ SMS      │ Payment  │ AI/ML Services     │    │
│  │ Service  │ Service  │ Gateway  │ (OpenAI/Custom)    │    │
│  │(SendGrid)│ (Twilio) │(Stripe)  │                    │    │
│  └──────────┴──────────┴──────────┴────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Architectural Patterns
- **Modular Monolith**: Start with a modular monolithic architecture, with clear service boundaries that can be extracted to microservices later
- **RESTful API**: Primary API pattern with REST endpoints
- **Event-Driven**: Use events for asynchronous operations (emails, notifications, report generation)
- **CQRS Pattern**: Separate read and write operations for complex queries (reports, analytics)

---

## Technology Stack

### Frontend
- **Framework**: React.js 18+
- **State Management**: Redux Toolkit + React Query
- **UI Library**: Material-UI (MUI) or Tailwind CSS + HeadlessUI
- **Form Handling**: React Hook Form + Zod validation
- **Charts**: Recharts or Chart.js
- **Date/Time**: date-fns or Day.js
- **File Upload**: React Dropzone
- **Rich Text Editor**: Tiptap or Slate
- **Build Tool**: Vite or Next.js (if SSR needed)

### Backend
- **Runtime**: Node.js 20+
- **Framework**: Express.js
- **Language**: TypeScript
- **ORM**: Prisma or TypeORM
- **Validation**: Joi or Zod
- **Authentication**: JWT + Passport.js
- **File Upload**: Multer + Sharp (image processing)
- **PDF Generation**: Puppeteer or PDFKit
- **Excel**: ExcelJS
- **Email**: Nodemailer + Email Templates (MJML)
- **Scheduling**: node-cron or Bull Queue
- **WebSocket**: Socket.io (for real-time features)

### Database & Caching
- **Primary Database**: PostgreSQL 15+
- **Extensions**: TimescaleDB (time-series), pg_cron (scheduled jobs)
- **Cache**: Redis 7+
- **Search**: PostgreSQL Full-Text Search or Elasticsearch (optional)
- **File Storage**: AWS S3 or MinIO

### AI/ML Stack
- **NLP**: OpenAI GPT-4 API or Custom LLM
- **Resume Parsing**: Custom NLP model or commercial API (Affinda, Sovren)
- **Embedding**: OpenAI Embeddings or Sentence-Transformers
- **Vector DB**: pgvector extension for PostgreSQL
- **ML Framework**: TensorFlow.js or Python microservice (scikit-learn, spaCy)

### DevOps & Infrastructure
- **Containerization**: Docker + Docker Compose
- **CI/CD**: GitHub Actions or GitLab CI
- **Monitoring**: Prometheus + Grafana
- **Logging**: Winston + ELK Stack (Elasticsearch, Logstash, Kibana)
- **API Documentation**: Swagger/OpenAPI

---

## Database Schema

### Core HR Module

#### 1. organizations
```sql
- id (UUID, PK)
- name (VARCHAR, NOT NULL)
- legal_name (VARCHAR)
- industry (VARCHAR)
- size_range (ENUM: '1-10', '11-50', '51-200', '201-500', '500+')
- tax_id (VARCHAR, UNIQUE)
- registration_number (VARCHAR)
- website (VARCHAR)
- logo_url (VARCHAR)
- address (JSONB)
- timezone (VARCHAR)
- currency (VARCHAR, DEFAULT 'USD')
- fiscal_year_start (DATE)
- settings (JSONB)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

#### 2. departments
```sql
- id (UUID, PK)
- organization_id (UUID, FK -> organizations)
- name (VARCHAR, NOT NULL)
- code (VARCHAR, UNIQUE)
- description (TEXT)
- parent_department_id (UUID, FK -> departments, NULLABLE)
- manager_id (UUID, FK -> employees, NULLABLE)
- cost_center (VARCHAR)
- location (VARCHAR)
- is_active (BOOLEAN, DEFAULT TRUE)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

#### 3. job_positions
```sql
- id (UUID, PK)
- organization_id (UUID, FK -> organizations)
- title (VARCHAR, NOT NULL)
- code (VARCHAR, UNIQUE)
- department_id (UUID, FK -> departments)
- level (ENUM: 'ENTRY', 'JUNIOR', 'SENIOR', 'LEAD', 'MANAGER', 'DIRECTOR', 'VP', 'C_LEVEL')
- employment_type (ENUM: 'FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN')
- description (TEXT)
- requirements (JSONB)
- responsibilities (JSONB)
- salary_range_min (DECIMAL)
- salary_range_max (DECIMAL)
- is_active (BOOLEAN, DEFAULT TRUE)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

#### 4. employees
```sql
- id (UUID, PK)
- organization_id (UUID, FK -> organizations)
- employee_code (VARCHAR, UNIQUE, NOT NULL)
- user_id (UUID, FK -> users, UNIQUE)
- first_name (VARCHAR, NOT NULL)
- middle_name (VARCHAR)
- last_name (VARCHAR, NOT NULL)
- email (VARCHAR, UNIQUE, NOT NULL)
- personal_email (VARCHAR)
- phone (VARCHAR)
- date_of_birth (DATE)
- gender (ENUM: 'MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY')
- marital_status (ENUM: 'SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED')
- nationality (VARCHAR)
- profile_picture_url (VARCHAR)
-
- department_id (UUID, FK -> departments)
- position_id (UUID, FK -> job_positions)
- reporting_manager_id (UUID, FK -> employees, NULLABLE)
- work_location (VARCHAR)
- employment_type (ENUM)
- employee_status (ENUM: 'ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED', 'RESIGNED')
-
- date_of_joining (DATE, NOT NULL)
- probation_end_date (DATE)
- confirmation_date (DATE)
- date_of_leaving (DATE)
- termination_reason (TEXT)
-
- address (JSONB)
- emergency_contacts (JSONB)
- bank_details (JSONB, ENCRYPTED)
- tax_information (JSONB, ENCRYPTED)
- documents (JSONB)
-
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
- deleted_at (TIMESTAMP, NULLABLE)
```

#### 5. users (Authentication & Authorization)
```sql
- id (UUID, PK)
- email (VARCHAR, UNIQUE, NOT NULL)
- password_hash (VARCHAR, NOT NULL)
- role (ENUM: 'SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE')
- is_active (BOOLEAN, DEFAULT TRUE)
- is_email_verified (BOOLEAN, DEFAULT FALSE)
- email_verification_token (VARCHAR)
- password_reset_token (VARCHAR)
- password_reset_expires (TIMESTAMP)
- last_login_at (TIMESTAMP)
- login_attempts (INTEGER, DEFAULT 0)
- locked_until (TIMESTAMP)
- two_factor_enabled (BOOLEAN, DEFAULT FALSE)
- two_factor_secret (VARCHAR, ENCRYPTED)
- refresh_token (VARCHAR)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

#### 6. permissions
```sql
- id (UUID, PK)
- name (VARCHAR, UNIQUE, NOT NULL)
- resource (VARCHAR, NOT NULL)
- action (ENUM: 'CREATE', 'READ', 'UPDATE', 'DELETE', 'APPROVE')
- description (TEXT)
- created_at (TIMESTAMP)
```

#### 7. role_permissions
```sql
- id (UUID, PK)
- role (ENUM, FK)
- permission_id (UUID, FK -> permissions)
- created_at (TIMESTAMP)
- UNIQUE(role, permission_id)
```

### Payroll Module

#### 8. salary_structures
```sql
- id (UUID, PK)
- organization_id (UUID, FK -> organizations)
- name (VARCHAR, NOT NULL)
- description (TEXT)
- components (JSONB) -- [{name, type: 'EARNING/DEDUCTION', calculation_type, value, is_taxable, is_statutory}]
- is_active (BOOLEAN, DEFAULT TRUE)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

#### 9. employee_salary
```sql
- id (UUID, PK)
- employee_id (UUID, FK -> employees)
- salary_structure_id (UUID, FK -> salary_structures)
- effective_date (DATE, NOT NULL)
- basic_salary (DECIMAL, NOT NULL)
- gross_salary (DECIMAL, NOT NULL)
- net_salary (DECIMAL, NOT NULL)
- components (JSONB) -- Actual component values
- currency (VARCHAR, DEFAULT 'USD')
- payment_frequency (ENUM: 'MONTHLY', 'BI_WEEKLY', 'WEEKLY')
- bank_account_id (UUID, FK -> employee_bank_accounts)
- is_active (BOOLEAN, DEFAULT TRUE)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

#### 10. payroll_cycles
```sql
- id (UUID, PK)
- organization_id (UUID, FK -> organizations)
- name (VARCHAR, NOT NULL) -- e.g., "January 2026 Payroll"
- period_start (DATE, NOT NULL)
- period_end (DATE, NOT NULL)
- payment_date (DATE, NOT NULL)
- status (ENUM: 'DRAFT', 'PROCESSING', 'APPROVED', 'PAID', 'CANCELLED')
- total_employees (INTEGER)
- total_gross (DECIMAL)
- total_deductions (DECIMAL)
- total_net (DECIMAL)
- approved_by (UUID, FK -> users)
- approved_at (TIMESTAMP)
- processed_by (UUID, FK -> users)
- processed_at (TIMESTAMP)
- notes (TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

#### 11. payslips
```sql
- id (UUID, PK)
- payroll_cycle_id (UUID, FK -> payroll_cycles)
- employee_id (UUID, FK -> employees)
- employee_salary_id (UUID, FK -> employee_salary)
- period_start (DATE, NOT NULL)
- period_end (DATE, NOT NULL)
- payment_date (DATE, NOT NULL)
-
- basic_salary (DECIMAL)
- earnings (JSONB) -- [{component, amount, is_taxable}]
- deductions (JSONB) -- [{component, amount, type}]
- gross_salary (DECIMAL, NOT NULL)
- total_deductions (DECIMAL)
- net_salary (DECIMAL, NOT NULL)
-
- attendance_days (DECIMAL)
- paid_days (DECIMAL)
- unpaid_days (DECIMAL)
- overtime_hours (DECIMAL)
-
- tax_details (JSONB) -- Federal, state, local taxes
- statutory_deductions (JSONB) -- Social Security, Medicare, etc.
-
- status (ENUM: 'DRAFT', 'GENERATED', 'SENT', 'PAID', 'HOLD')
- pdf_url (VARCHAR)
- payment_method (ENUM: 'BANK_TRANSFER', 'CHECK', 'CASH')
- payment_reference (VARCHAR)
- payment_status (ENUM: 'PENDING', 'COMPLETED', 'FAILED')
-
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

#### 12. tax_configurations
```sql
- id (UUID, PK)
- organization_id (UUID, FK -> organizations)
- country (VARCHAR, NOT NULL)
- region (VARCHAR) -- State/Province
- tax_type (ENUM: 'INCOME_TAX', 'SOCIAL_SECURITY', 'MEDICARE', 'UNEMPLOYMENT', 'OTHER')
- name (VARCHAR, NOT NULL)
- calculation_rules (JSONB) -- Slabs, rates, exemptions
- effective_from (DATE, NOT NULL)
- effective_to (DATE)
- is_active (BOOLEAN, DEFAULT TRUE)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

#### 13. statutory_compliances
```sql
- id (UUID, PK)
- organization_id (UUID, FK -> organizations)
- country (VARCHAR, NOT NULL)
- compliance_type (VARCHAR, NOT NULL) -- e.g., 'PF', 'ESI', 'PT', '401k'
- name (VARCHAR, NOT NULL)
- description (TEXT)
- rules (JSONB)
- filing_frequency (ENUM: 'MONTHLY', 'QUARTERLY', 'ANNUALLY')
- next_due_date (DATE)
- is_mandatory (BOOLEAN, DEFAULT FALSE)
- is_active (BOOLEAN, DEFAULT TRUE)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

### Attendance & Leave Module

#### 14. attendance_records
```sql
- id (UUID, PK)
- employee_id (UUID, FK -> employees)
- date (DATE, NOT NULL)
- check_in (TIMESTAMP)
- check_out (TIMESTAMP)
- total_hours (DECIMAL)
- break_hours (DECIMAL)
- work_hours (DECIMAL)
- overtime_hours (DECIMAL)
- status (ENUM: 'PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE', 'HOLIDAY', 'WEEKEND')
- location (JSONB) -- GPS coordinates, IP address
- check_in_method (ENUM: 'MANUAL', 'BIOMETRIC', 'WEB', 'MOBILE', 'GEOFENCE')
- notes (TEXT)
- approved_by (UUID, FK -> users)
- approved_at (TIMESTAMP)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
- UNIQUE(employee_id, date)
```

#### 15. leave_types
```sql
- id (UUID, PK)
- organization_id (UUID, FK -> organizations)
- name (VARCHAR, NOT NULL) -- e.g., 'Annual Leave', 'Sick Leave'
- code (VARCHAR, UNIQUE)
- description (TEXT)
- is_paid (BOOLEAN, DEFAULT TRUE)
- default_days_per_year (DECIMAL)
- max_carry_forward (DECIMAL)
- max_consecutive_days (INTEGER)
- requires_document (BOOLEAN, DEFAULT FALSE)
- can_be_negative (BOOLEAN, DEFAULT FALSE)
- accrual_type (ENUM: 'MONTHLY', 'QUARTERLY', 'ANNUALLY', 'NONE')
- color_code (VARCHAR)
- is_active (BOOLEAN, DEFAULT TRUE)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

#### 16. employee_leave_balances
```sql
- id (UUID, PK)
- employee_id (UUID, FK -> employees)
- leave_type_id (UUID, FK -> leave_types)
- year (INTEGER, NOT NULL)
- opening_balance (DECIMAL, DEFAULT 0)
- accrued (DECIMAL, DEFAULT 0)
- used (DECIMAL, DEFAULT 0)
- carried_forward (DECIMAL, DEFAULT 0)
- available (DECIMAL, DEFAULT 0)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
- UNIQUE(employee_id, leave_type_id, year)
```

#### 17. leave_requests
```sql
- id (UUID, PK)
- employee_id (UUID, FK -> employees)
- leave_type_id (UUID, FK -> leave_types)
- start_date (DATE, NOT NULL)
- end_date (DATE, NOT NULL)
- total_days (DECIMAL, NOT NULL)
- reason (TEXT, NOT NULL)
- supporting_documents (JSONB)
- status (ENUM: 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')
- applied_on (TIMESTAMP, DEFAULT NOW())
- reviewed_by (UUID, FK -> users)
- reviewed_at (TIMESTAMP)
- review_comments (TEXT)
- cancellation_reason (TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

#### 18. holidays
```sql
- id (UUID, PK)
- organization_id (UUID, FK -> organizations)
- name (VARCHAR, NOT NULL)
- date (DATE, NOT NULL)
- is_optional (BOOLEAN, DEFAULT FALSE)
- applicable_locations (JSONB) -- Array of locations/offices
- description (TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

### ATS (Applicant Tracking System) Module

#### 19. job_openings
```sql
- id (UUID, PK)
- organization_id (UUID, FK -> organizations)
- position_id (UUID, FK -> job_positions)
- title (VARCHAR, NOT NULL)
- department_id (UUID, FK -> departments)
- hiring_manager_id (UUID, FK -> employees)
- recruiters (JSONB) -- Array of employee IDs
-
- employment_type (ENUM)
- job_type (ENUM: 'REMOTE', 'ONSITE', 'HYBRID')
- location (VARCHAR)
- experience_required (JSONB) -- {min, max} years
- salary_range (JSONB) -- {min, max, currency}
-
- description (TEXT, NOT NULL)
- requirements (JSONB)
- responsibilities (JSONB)
- skills_required (JSONB)
- qualifications (JSONB)
- benefits (JSONB)
-
- number_of_positions (INTEGER, DEFAULT 1)
- positions_filled (INTEGER, DEFAULT 0)
- status (ENUM: 'DRAFT', 'OPEN', 'ON_HOLD', 'CLOSED', 'CANCELLED')
-
- posting_date (DATE)
- application_deadline (DATE)
- target_closure_date (DATE)
-
- application_form_fields (JSONB)
- screening_questions (JSONB)
-
- internal_job (BOOLEAN, DEFAULT FALSE)
- is_confidential (BOOLEAN, DEFAULT FALSE)
-
- created_by (UUID, FK -> users)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

#### 20. candidates
```sql
- id (UUID, PK)
- first_name (VARCHAR, NOT NULL)
- last_name (VARCHAR, NOT NULL)
- email (VARCHAR, UNIQUE, NOT NULL)
- phone (VARCHAR)
- alternate_phone (VARCHAR)
- current_location (VARCHAR)
- preferred_locations (JSONB)
-
- current_company (VARCHAR)
- current_designation (VARCHAR)
- total_experience_years (DECIMAL)
- relevant_experience_years (DECIMAL)
- current_salary (DECIMAL)
- expected_salary (DECIMAL)
- notice_period (INTEGER) -- in days
-
- highest_qualification (VARCHAR)
- education (JSONB)
- certifications (JSONB)
- skills (JSONB)
-
- linkedin_url (VARCHAR)
- portfolio_url (VARCHAR)
- github_url (VARCHAR)
- other_profiles (JSONB)
-
- resume_url (VARCHAR)
- resume_parsed_data (JSONB)
- resume_embedding (VECTOR) -- For AI similarity search
-
- source (ENUM: 'CAREER_SITE', 'JOB_PORTAL', 'REFERRAL', 'LINKEDIN', 'AGENCY', 'WALK_IN', 'OTHER')
- source_details (JSONB)
- referred_by (UUID, FK -> employees, NULLABLE)
-
- tags (JSONB)
- notes (TEXT)
-
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

#### 21. applications
```sql
- id (UUID, PK)
- job_opening_id (UUID, FK -> job_openings)
- candidate_id (UUID, FK -> candidates)
- applied_date (TIMESTAMP, DEFAULT NOW())
-
- current_stage (ENUM: 'NEW', 'SCREENING', 'PHONE_SCREEN', 'ASSESSMENT', 'INTERVIEW_1', 'INTERVIEW_2', 'INTERVIEW_3', 'HR_ROUND', 'OFFER', 'HIRED', 'REJECTED', 'WITHDRAWN')
- status (ENUM: 'ACTIVE', 'ON_HOLD', 'REJECTED', 'HIRED', 'WITHDRAWN')
-
- cover_letter (TEXT)
- screening_answers (JSONB)
-
- ai_resume_score (DECIMAL) -- AI-generated resume match score (0-100)
- ai_skill_match (JSONB) -- {matched_skills, missing_skills, score}
- ai_experience_match (JSONB)
- ai_education_match (JSONB)
- ai_overall_ranking (INTEGER) -- Rank among all applicants
- ai_summary (TEXT) -- AI-generated candidate summary
- ai_recommendations (JSONB)
-
- overall_rating (DECIMAL) -- Average of all interview ratings
- recruiter_rating (DECIMAL)
- recruiter_notes (TEXT)
-
- rejection_reason (TEXT)
- rejection_date (TIMESTAMP)
- withdrawn_reason (TEXT)
- withdrawn_date (TIMESTAMP)
-
- assigned_to (UUID, FK -> employees) -- Assigned recruiter
-
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
- UNIQUE(job_opening_id, candidate_id)
```

#### 22. application_stages
```sql
- id (UUID, PK)
- application_id (UUID, FK -> applications)
- stage (ENUM, NOT NULL)
- status (ENUM: 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED')
- started_at (TIMESTAMP)
- completed_at (TIMESTAMP)
- notes (TEXT)
- created_at (TIMESTAMP)
```

#### 23. interviews
```sql
- id (UUID, PK)
- application_id (UUID, FK -> applications)
- job_opening_id (UUID, FK -> job_openings)
- candidate_id (UUID, FK -> candidates)
-
- round (INTEGER, NOT NULL)
- type (ENUM: 'PHONE', 'VIDEO', 'IN_PERSON', 'TECHNICAL', 'HR', 'CULTURAL_FIT', 'PANEL')
- title (VARCHAR, NOT NULL)
-
- scheduled_at (TIMESTAMP)
- duration_minutes (INTEGER)
- meeting_link (VARCHAR)
- location (VARCHAR)
-
- interviewers (JSONB) -- Array of employee IDs
- interview_panel (JSONB)
-
- status (ENUM: 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW')
-
- feedback (JSONB) -- [{interviewer_id, rating, comments, skills_assessed}]
- overall_rating (DECIMAL)
- recommendation (ENUM: 'STRONG_YES', 'YES', 'MAYBE', 'NO', 'STRONG_NO')
-
- cancellation_reason (TEXT)
- reschedule_count (INTEGER, DEFAULT 0)
-
- created_by (UUID, FK -> users)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

#### 24. offers
```sql
- id (UUID, PK)
- application_id (UUID, FK -> applications)
- candidate_id (UUID, FK -> candidates)
- job_opening_id (UUID, FK -> job_openings)
-
- offer_letter_url (VARCHAR)
- offered_position (VARCHAR, NOT NULL)
- offered_salary (DECIMAL, NOT NULL)
- salary_components (JSONB)
- benefits (JSONB)
- joining_bonus (DECIMAL)
- relocation_assistance (DECIMAL)
-
- offered_date (DATE, NOT NULL)
- valid_until (DATE, NOT NULL)
- expected_joining_date (DATE)
-
- status (ENUM: 'DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'REJECTED', 'NEGOTIATING', 'EXPIRED')
-
- accepted_date (TIMESTAMP)
- rejected_date (TIMESTAMP)
- rejection_reason (TEXT)
-
- negotiation_notes (TEXT)
-
- created_by (UUID, FK -> users)
- approved_by (UUID, FK -> users)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

### Performance Management Module

#### 25. performance_cycles
```sql
- id (UUID, PK)
- organization_id (UUID, FK -> organizations)
- name (VARCHAR, NOT NULL) -- e.g., "Annual Review 2026"
- type (ENUM: 'ANNUAL', 'HALF_YEARLY', 'QUARTERLY', 'PROBATION')
- period_start (DATE, NOT NULL)
- period_end (DATE, NOT NULL)
- review_start_date (DATE)
- review_end_date (DATE)
- status (ENUM: 'UPCOMING', 'ACTIVE', 'UNDER_REVIEW', 'COMPLETED', 'CANCELLED')
- template_id (UUID, FK -> review_templates)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

#### 26. performance_reviews
```sql
- id (UUID, PK)
- performance_cycle_id (UUID, FK -> performance_cycles)
- employee_id (UUID, FK -> employees)
- reviewer_id (UUID, FK -> employees)
- review_type (ENUM: 'SELF', 'MANAGER', 'PEER', '360')
-
- goals_data (JSONB)
- competencies_data (JSONB)
- overall_rating (DECIMAL)
- overall_comments (TEXT)
-
- strengths (TEXT)
- areas_of_improvement (TEXT)
- achievements (JSONB)
-
- status (ENUM: 'NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'ACKNOWLEDGED')
- submitted_at (TIMESTAMP)
- acknowledged_at (TIMESTAMP)
-
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

#### 27. goals
```sql
- id (UUID, PK)
- employee_id (UUID, FK -> employees)
- title (VARCHAR, NOT NULL)
- description (TEXT)
- goal_type (ENUM: 'INDIVIDUAL', 'TEAM', 'COMPANY')
- category (ENUM: 'PERFORMANCE', 'DEVELOPMENT', 'BEHAVIORAL')
- measurement_criteria (TEXT)
- target_value (VARCHAR)
- current_value (VARCHAR)
- progress_percentage (INTEGER, DEFAULT 0)
- start_date (DATE, NOT NULL)
- due_date (DATE, NOT NULL)
- status (ENUM: 'NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')
- priority (ENUM: 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL')
- assigned_by (UUID, FK -> employees)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

### Document Management Module

#### 28. documents
```sql
- id (UUID, PK)
- organization_id (UUID, FK -> organizations)
- name (VARCHAR, NOT NULL)
- document_type (ENUM: 'POLICY', 'HANDBOOK', 'CERTIFICATE', 'CONTRACT', 'OFFER_LETTER', 'PAYSLIP', 'FORM', 'OTHER')
- category (VARCHAR)
- description (TEXT)
- file_url (VARCHAR, NOT NULL)
- file_type (VARCHAR)
- file_size (BIGINT)
- version (INTEGER, DEFAULT 1)
-
- entity_type (ENUM: 'ORGANIZATION', 'EMPLOYEE', 'CANDIDATE', 'DEPARTMENT')
- entity_id (UUID)
-
- is_confidential (BOOLEAN, DEFAULT FALSE)
- requires_signature (BOOLEAN, DEFAULT FALSE)
-
- uploaded_by (UUID, FK -> users)
- valid_from (DATE)
- valid_until (DATE)
-
- tags (JSONB)
- metadata (JSONB)
-
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

#### 29. document_signatures
```sql
- id (UUID, PK)
- document_id (UUID, FK -> documents)
- signer_id (UUID, FK -> employees)
- signature_type (ENUM: 'DIGITAL', 'ELECTRONIC', 'PHYSICAL')
- signature_data (TEXT)
- ip_address (VARCHAR)
- signed_at (TIMESTAMP)
- status (ENUM: 'PENDING', 'SIGNED', 'DECLINED')
- created_at (TIMESTAMP)
```

### AI Chatbot Module

#### 30. chatbot_conversations
```sql
- id (UUID, PK)
- employee_id (UUID, FK -> employees)
- session_id (VARCHAR, NOT NULL)
- started_at (TIMESTAMP, DEFAULT NOW())
- ended_at (TIMESTAMP)
- status (ENUM: 'ACTIVE', 'CLOSED', 'ESCALATED')
- escalated_to (UUID, FK -> users)
- conversation_summary (TEXT)
- intent_history (JSONB)
- satisfaction_rating (INTEGER)
- created_at (TIMESTAMP)
```

#### 31. chatbot_messages
```sql
- id (UUID, PK)
- conversation_id (UUID, FK -> chatbot_conversations)
- sender_type (ENUM: 'USER', 'BOT')
- message (TEXT, NOT NULL)
- intent (VARCHAR) -- Detected intent
- entities (JSONB) -- Extracted entities
- confidence_score (DECIMAL)
- response_time_ms (INTEGER)
- suggested_actions (JSONB)
- metadata (JSONB)
- timestamp (TIMESTAMP, DEFAULT NOW())
```

#### 32. chatbot_knowledge_base
```sql
- id (UUID, PK)
- organization_id (UUID, FK -> organizations)
- category (VARCHAR, NOT NULL)
- question (TEXT, NOT NULL)
- answer (TEXT, NOT NULL)
- keywords (JSONB)
- embedding (VECTOR) -- For semantic search
- related_documents (JSONB)
- usage_count (INTEGER, DEFAULT 0)
- effectiveness_score (DECIMAL)
- is_active (BOOLEAN, DEFAULT TRUE)
- created_by (UUID, FK -> users)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

### Notifications & Audit Module

#### 33. notifications
```sql
- id (UUID, PK)
- user_id (UUID, FK -> users)
- type (ENUM: 'INFO', 'SUCCESS', 'WARNING', 'ERROR', 'REMINDER')
- category (VARCHAR) -- 'LEAVE', 'PAYROLL', 'ATTENDANCE', 'RECRUITMENT', etc.
- title (VARCHAR, NOT NULL)
- message (TEXT, NOT NULL)
- link (VARCHAR)
- is_read (BOOLEAN, DEFAULT FALSE)
- read_at (TIMESTAMP)
- priority (ENUM: 'LOW', 'NORMAL', 'HIGH', 'URGENT')
- delivery_channels (JSONB) -- ['IN_APP', 'EMAIL', 'SMS']
- sent_via (JSONB)
- created_at (TIMESTAMP)
```

#### 34. audit_logs
```sql
- id (UUID, PK)
- user_id (UUID, FK -> users)
- action (VARCHAR, NOT NULL) -- 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', etc.
- resource_type (VARCHAR, NOT NULL) -- Table/Entity name
- resource_id (UUID)
- changes (JSONB) -- Before and after values
- ip_address (VARCHAR)
- user_agent (TEXT)
- status (ENUM: 'SUCCESS', 'FAILURE')
- error_message (TEXT)
- timestamp (TIMESTAMP, DEFAULT NOW())
```

### Analytics & Reporting Module

#### 35. report_templates
```sql
- id (UUID, PK)
- organization_id (UUID, FK -> organizations)
- name (VARCHAR, NOT NULL)
- report_type (VARCHAR, NOT NULL)
- description (TEXT)
- query_definition (JSONB)
- parameters (JSONB)
- format (ENUM: 'PDF', 'EXCEL', 'CSV', 'HTML')
- schedule (JSONB) -- Cron expression
- recipients (JSONB)
- is_active (BOOLEAN, DEFAULT TRUE)
- created_by (UUID, FK -> users)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

#### 36. generated_reports
```sql
- id (UUID, PK)
- report_template_id (UUID, FK -> report_templates)
- generated_by (UUID, FK -> users)
- parameters_used (JSONB)
- file_url (VARCHAR)
- file_size (BIGINT)
- status (ENUM: 'GENERATING', 'COMPLETED', 'FAILED')
- error_message (TEXT)
- generated_at (TIMESTAMP, DEFAULT NOW())
```

---

## Module Breakdown

### 1. Authentication & Authorization Module
**Features:**
- JWT-based authentication
- Role-based access control (RBAC)
- Multi-tenant architecture support
- Two-factor authentication (2FA)
- Session management
- Password policies and reset
- OAuth integration (Google, Microsoft)
- API key management for integrations

### 2. Employee Management Module
**Features:**
- Employee profiles (personal, professional, emergency contacts)
- Organizational hierarchy visualization
- Department and team management
- Employee lifecycle (onboarding to exit)
- Document management per employee
- Custom fields support
- Employee directory with search
- Reporting structure and manager assignments
- Bulk import/export

### 3. Attendance & Time Tracking Module
**Features:**
- Multiple check-in methods (web, mobile, biometric integration)
- Geofencing for location-based attendance
- Shift management
- Overtime calculation
- Late/early departure tracking
- Attendance regularization requests
- Integration with leave module
- Real-time attendance dashboard
- Monthly attendance reports

### 4. Leave Management Module
**Features:**
- Multiple leave types (paid, unpaid, sick, casual, etc.)
- Leave balance tracking
- Leave accrual automation
- Leave request workflow (apply, approve, reject)
- Leave calendar view
- Carry forward and encashment rules
- Half-day and hour-based leaves
- Leave balance alerts
- Manager leave dashboard
- Team leave calendar

### 5. Payroll Management Module
**Features:**
- Configurable salary structures
- Multi-component salary (basic, HRA, allowances, etc.)
- Automated payroll processing
- Tax calculation engine (multi-jurisdiction support)
- Statutory compliance (Social Security, Medicare, PF, ESI, PT)
- Variable pay and bonus management
- Loan and advance deductions
- Reimbursements
- Payslip generation and distribution
- Bank file generation (NACHA, SEPA formats)
- Payroll reports and analytics
- Year-end tax forms (W-2, 1099, Form 16)

### 6. Applicant Tracking System (ATS) - AI Powered
**Features:**
- Job posting management
- Multi-channel job distribution
- Career site integration
- Candidate database
- **AI Resume Parser** (extract structured data from resumes)
- **AI-Powered Candidate Ranking** (match candidates to job requirements)
- **Semantic Search** (find candidates by skills, experience using embeddings)
- Application tracking through stages
- Interview scheduling (calendar integration)
- Collaborative hiring (feedback from multiple interviewers)
- Offer management
- Recruitment analytics (time-to-hire, source effectiveness)
- Candidate communication templates
- Referral management

### 7. AI Chatbot for Employee Self-Service
**Features:**
- **Natural Language Understanding** (intent recognition)
- **Context-aware conversations** (maintain conversation history)
- Common HR queries:
  - Leave balance inquiry
  - Apply for leave
  - Check attendance
  - View payslips
  - Update personal information
  - Company policy questions
  - Holiday list
  - Reimbursement status
- **Integration with knowledge base**
- **Sentiment analysis** for employee satisfaction
- **Automated ticket creation** for complex queries
- **Multi-language support**
- Available via web and mobile

### 8. Performance Management Module
**Features:**
- Goal setting and tracking (OKRs, SMART goals)
- Performance review cycles
- 360-degree feedback
- Self-assessment and manager assessment
- Competency matrix
- Performance improvement plans (PIP)
- Rating scales and normalization
- Performance analytics
- One-on-one meeting tracker
- Development plans

### 9. Document Management Module
**Features:**
- Centralized document repository
- Document versioning
- Digital signature support
- Template management
- Automatic document generation (offer letters, contracts)
- Document expiry tracking
- Secure document access (role-based)
- Document categories and tagging
- Search and filter

### 10. Onboarding Module
**Features:**
- Onboarding workflow automation
- Task assignment to new hires
- Document collection
- Asset allocation tracking
- Training assignment
- Onboarding checklist
- Welcome kit automation
- Buddy assignment
- Pre-boarding communication

### 11. Reports & Analytics Module
**Features:**
- Pre-built reports:
  - Headcount reports
  - Attrition analysis
  - Attendance reports
  - Payroll summaries
  - Recruitment metrics
  - Leave trend analysis
  - Compliance reports
- Custom report builder
- Scheduled reports (email delivery)
- Data export (Excel, CSV, PDF)
- Interactive dashboards
- KPI tracking
- Data visualization

### 12. Compliance & Audit Module
**Features:**
- Audit trail for all actions
- Compliance checklist
- Statutory report generation
- Data privacy compliance (GDPR, CCPA)
- User activity monitoring
- Data backup and recovery
- Role and permission audit

### 13. Notifications & Communication Module
**Features:**
- Multi-channel notifications (in-app, email, SMS)
- Event-driven notifications
- Notification preferences
- Announcement management
- Email templates
- SMS gateway integration
- Push notifications (mobile app)

### 14. Integration & API Module
**Features:**
- RESTful API
- Webhook support
- Third-party integrations:
  - Calendar (Google, Outlook)
  - SSO providers (Okta, Azure AD)
  - Payment gateways (Stripe, PayPal)
  - Job boards (LinkedIn, Indeed)
  - Background verification services
  - Biometric devices
- API documentation (Swagger)
- API rate limiting and security

---

## API Architecture

### API Design Principles
1. **RESTful Design**: Resource-based URLs, standard HTTP methods
2. **Versioning**: URL-based versioning (`/api/v1/`)
3. **Pagination**: Cursor-based pagination for large datasets
4. **Filtering & Sorting**: Query parameters for filtering and sorting
5. **Error Handling**: Consistent error response format
6. **Rate Limiting**: Per-user and per-IP rate limits
7. **HATEOAS**: Hypermedia links for discoverability (optional)

### API Structure

```
/api/v1/
├── /auth
│   ├── POST /register
│   ├── POST /login
│   ├── POST /logout
│   ├── POST /refresh-token
│   ├── POST /forgot-password
│   ├── POST /reset-password
│   └── POST /verify-email
│
├── /employees
│   ├── GET /employees
│   ├── POST /employees
│   ├── GET /employees/:id
│   ├── PUT /employees/:id
│   ├── PATCH /employees/:id
│   ├── DELETE /employees/:id
│   ├── GET /employees/:id/documents
│   ├── GET /employees/:id/payslips
│   └── GET /employees/:id/leave-balance
│
├── /attendance
│   ├── GET /attendance
│   ├── POST /attendance/check-in
│   ├── POST /attendance/check-out
│   ├── GET /attendance/:employeeId
│   └── PUT /attendance/:id
│
├── /leaves
│   ├── GET /leaves
│   ├── POST /leaves
│   ├── GET /leaves/:id
│   ├── PUT /leaves/:id
│   ├── POST /leaves/:id/approve
│   ├── POST /leaves/:id/reject
│   └── GET /leaves/balance/:employeeId
│
├── /payroll
│   ├── GET /payroll/cycles
│   ├── POST /payroll/cycles
│   ├── GET /payroll/cycles/:id
│   ├── POST /payroll/cycles/:id/process
│   ├── GET /payslips
│   ├── GET /payslips/:id
│   └── GET /payslips/:id/download
│
├── /recruitment
│   ├── GET /jobs
│   ├── POST /jobs
│   ├── GET /jobs/:id
│   ├── PUT /jobs/:id
│   ├── GET /candidates
│   ├── POST /candidates
│   ├── GET /candidates/:id
│   ├── POST /applications
│   ├── GET /applications/:id
│   ├── POST /applications/:id/ai-analyze (AI endpoint)
│   ├── POST /interviews
│   └── GET /interviews/:id
│
├── /chatbot
│   ├── POST /chatbot/message (Send message, get AI response)
│   ├── GET /chatbot/conversations
│   └── GET /chatbot/conversations/:id
│
├── /performance
│   ├── GET /performance/cycles
│   ├── GET /performance/reviews
│   ├── POST /performance/reviews
│   ├── GET /goals
│   └── POST /goals
│
├── /documents
│   ├── GET /documents
│   ├── POST /documents/upload
│   ├── GET /documents/:id
│   └── DELETE /documents/:id
│
├── /reports
│   ├── GET /reports/templates
│   ├── POST /reports/generate
│   └── GET /reports/:id/download
│
└── /notifications
    ├── GET /notifications
    ├── PUT /notifications/:id/read
    └── PUT /notifications/read-all
```

### Authentication Flow
```
1. User Login → POST /api/v1/auth/login
   Response: { accessToken, refreshToken }

2. Authenticated Request → Include header:
   Authorization: Bearer <accessToken>

3. Token Refresh → POST /api/v1/auth/refresh-token
   Body: { refreshToken }
   Response: { accessToken, refreshToken }
```

---

## AI/ML Components

### 1. AI Resume Parser
**Purpose**: Extract structured data from unstructured resumes (PDF, DOCX, TXT)

**Architecture:**
```
Resume Upload → Preprocessing → NLP Pipeline → Structured Data
     ↓              ↓               ↓               ↓
  PDF/DOCX → Text Extraction → Entity Recognition → Database
```

**Technologies:**
- Text extraction: pdf-parse, mammoth (for DOCX)
- NLP: OpenAI GPT-4 API or custom model (spaCy, Transformers)
- Entity recognition: Extract name, email, phone, education, experience, skills

**Implementation Approach:**
- Option 1: OpenAI GPT-4 with structured output
- Option 2: Commercial APIs (Affinda, Sovren, HireAbility)
- Option 3: Custom model using spaCy + rule-based extraction

### 2. AI Candidate Ranking System
**Purpose**: Automatically rank candidates based on job requirements

**Ranking Factors:**
1. **Skill Match** (40% weight)
   - Extract required skills from job description
   - Match with candidate skills
   - Use semantic similarity (embeddings)

2. **Experience Match** (30% weight)
   - Years of experience required vs candidate's experience
   - Relevant industry experience
   - Position level match

3. **Education Match** (15% weight)
   - Degree requirements
   - Institution reputation (optional)
   - Relevant certifications

4. **Location & Availability** (10% weight)
   - Location match
   - Notice period vs required joining date

5. **Additional Factors** (5% weight)
   - Cultural fit indicators
   - Career trajectory
   - Job stability

**Technologies:**
- Embeddings: OpenAI Embeddings API or Sentence-Transformers
- Vector DB: pgvector extension for PostgreSQL
- Scoring algorithm: Weighted scoring + ML model (optional)

**API Endpoint:**
```javascript
POST /api/v1/recruitment/applications/:id/ai-analyze
Response: {
  resumeScore: 85,
  skillMatch: { matched: [...], missing: [...], score: 90 },
  experienceMatch: { score: 80, analysis: "..." },
  educationMatch: { score: 85 },
  overallRanking: 12, // out of 150 applicants
  aiSummary: "Strong technical background with...",
  recommendations: ["Schedule technical interview", "Ask about X skill"]
}
```

### 3. AI Chatbot (NLP-based)
**Purpose**: Employee self-service for common HR queries

**Architecture:**
```
User Message → Intent Recognition → Entity Extraction → Action → Response
      ↓              ↓                     ↓              ↓          ↓
  "Leave balance" → INTENT: CHECK_LEAVE → None → Query DB → "You have 12 days"
```

**Core Capabilities:**
- Intent classification: Identify what user wants (check leave, apply leave, etc.)
- Entity extraction: Extract dates, leave types, etc.
- Context management: Maintain conversation state
- Action execution: Call appropriate APIs
- Natural language generation: Format responses

**Technologies:**
- NLP: OpenAI GPT-4 API (easiest) or Dialogflow or Rasa
- Conversation storage: Redis (session state) + PostgreSQL (history)
- Integration: WebSocket for real-time chat

**Supported Intents:**
- CHECK_LEAVE_BALANCE
- APPLY_LEAVE
- CHECK_ATTENDANCE
- VIEW_PAYSLIP
- UPDATE_PROFILE
- POLICY_QUERY
- HOLIDAY_LIST
- REIMBURSEMENT_STATUS
- RAISE_TICKET

**Sample Conversation:**
```
User: "How many leaves do I have?"
Bot: "You have 15 annual leaves remaining for 2026."

User: "I want to apply for leave from Jan 25 to Jan 27"
Bot: "Sure! You want to apply for leave from Jan 25 to Jan 27 (3 days).
      Which leave type? (Annual/Sick/Casual)"

User: "Annual"
Bot: "Your leave application has been submitted. You'll be notified
      once your manager reviews it."
```

### 4. Embedding-based Semantic Search
**Purpose**: Find candidates/documents using natural language queries

**Use Cases:**
- "Find frontend developers with 5+ years React experience"
- "Search for employees with Python and Machine Learning skills"
- "Find candidates who worked at Google or Microsoft"

**Implementation:**
```sql
-- Store embeddings in PostgreSQL with pgvector
CREATE EXTENSION vector;

ALTER TABLE candidates ADD COLUMN resume_embedding vector(1536);

-- Search query
SELECT id, first_name, last_name,
       1 - (resume_embedding <=> '[query_embedding]') as similarity
FROM candidates
ORDER BY resume_embedding <=> '[query_embedding]'
LIMIT 10;
```

---

## Security & Compliance

### Authentication & Authorization
- **JWT-based authentication** with short-lived access tokens (15 min) and refresh tokens (7 days)
- **Role-based access control (RBAC)** with granular permissions
- **Multi-factor authentication (MFA)** for sensitive operations
- **Password policies**: Minimum length, complexity, expiry
- **Session management**: Concurrent session control
- **API key authentication** for integrations

### Data Security
- **Encryption at rest**: Sensitive data (salary, bank details, tax info) encrypted
- **Encryption in transit**: HTTPS/TLS for all communications
- **Database encryption**: PostgreSQL encryption for sensitive columns
- **File encryption**: Documents stored in encrypted format
- **PII (Personally Identifiable Information) protection**

### Compliance
- **GDPR compliance**: Right to access, right to be forgotten, data portability
- **CCPA compliance**: California consumer privacy act
- **SOC 2 Type II**: Security controls and auditing
- **Data retention policies**: Automatic data purging
- **Audit logging**: All actions logged for compliance
- **Data backup**: Regular backups with point-in-time recovery

### Input Validation & Security
- **Input sanitization**: Prevent XSS, SQL injection
- **Rate limiting**: Prevent abuse and DDoS
- **CORS policies**: Restrict cross-origin requests
- **Content Security Policy (CSP)**
- **SQL injection prevention**: Use parameterized queries (Prisma/TypeORM)
- **File upload validation**: Type checking, size limits, virus scanning

### Payroll Compliance
- **Tax calculation**: Support for multiple jurisdictions (federal, state, local)
- **Statutory compliance**: Social Security, Medicare, Unemployment insurance
- **Payroll reports**: Quarterly and annual statutory reports
- **Audit trail**: All payroll changes logged
- **Bank file security**: Secure generation and transmission

---

## Development Roadmap

### Phase 0: Foundation & Setup (2 weeks)
**Goal**: Setup development environment and core infrastructure

**Tasks:**
1. **Project Setup**
   - Initialize Git repository
   - Setup monorepo structure (frontend, backend)
   - Configure ESLint, Prettier, Husky
   - Setup environment configuration (.env)

2. **Backend Foundation**
   - Initialize Node.js + Express.js project
   - Setup TypeScript configuration
   - Configure PostgreSQL connection
   - Setup Prisma ORM (schema, migrations)
   - Create base folder structure (routes, controllers, services, models)
   - Implement error handling middleware
   - Setup logging (Winston)
   - Configure CORS and security middleware

3. **Frontend Foundation**
   - Initialize React.js project (Vite or CRA)
   - Setup routing (React Router)
   - Configure state management (Redux Toolkit)
   - Setup API client (Axios + React Query)
   - Create base folder structure (components, pages, hooks, utils)
   - Setup UI library (Material-UI or Tailwind)
   - Implement theme configuration

4. **Database Setup**
   - Design core database schema
   - Create initial migrations
   - Setup database seeding scripts
   - Configure connection pooling

5. **DevOps Setup**
   - Docker configuration (Dockerfile, docker-compose.yml)
   - Setup local development environment
   - Configure hot reload for frontend and backend

**Deliverables:**
- Working development environment
- Basic project structure
- Database connected and migrations running
- Frontend and backend communicating

---

### Phase 1: Authentication & User Management (2 weeks)
**Goal**: Implement secure authentication system

**Backend Tasks:**
1. Implement user registration
2. Implement login with JWT
3. Implement refresh token mechanism
4. Implement password reset flow
5. Implement email verification
6. Create role and permission system
7. Implement RBAC middleware
8. Create user management APIs

**Frontend Tasks:**
1. Create login page
2. Create registration page
3. Create forgot password flow
4. Implement protected routes
5. Create authentication context/redux slice
6. Implement token refresh logic
7. Create user profile page
8. Create user management interface (for admins)

**Deliverables:**
- Complete authentication system
- User registration and login working
- Role-based access control implemented
- User management dashboard

---

### Phase 2: Core HR - Employee Management (3 weeks)
**Goal**: Build employee management system

**Backend Tasks:**
1. Create employee CRUD APIs
2. Create department CRUD APIs
3. Create position/designation CRUD APIs
4. Implement organizational hierarchy
5. Create employee document APIs
6. Implement employee search and filters
7. Create bulk import/export functionality
8. Implement data validation

**Frontend Tasks:**
1. Create employee listing page with search/filter
2. Create employee detail page
3. Create employee add/edit forms
4. Create department management interface
5. Create position management interface
6. Create organizational hierarchy view
7. Create employee document management
8. Create bulk import interface
9. Create employee directory

**Deliverables:**
- Employee management module
- Department and position management
- Organizational hierarchy visualization
- Employee directory with search

---

### Phase 3: Attendance & Leave Management (3 weeks)
**Goal**: Track attendance and manage leaves

**Backend Tasks:**
1. Create attendance check-in/check-out APIs
2. Implement attendance records management
3. Create leave types configuration
4. Create leave balance calculation logic
5. Create leave request workflow APIs
6. Create leave approval/rejection logic
7. Create holiday management APIs
8. Implement attendance reports
9. Create leave accrual automation

**Frontend Tasks:**
1. Create attendance dashboard
2. Create attendance marking interface
3. Create attendance history view
4. Create leave application form
5. Create leave approval interface (for managers)
6. Create leave calendar view
7. Create team leave dashboard
8. Create holiday calendar
9. Create attendance and leave reports

**Deliverables:**
- Attendance tracking system
- Leave management system
- Leave balance calculation
- Manager approval workflow
- Attendance and leave reports

---

### Phase 4: Payroll Management (4 weeks)
**Goal**: Automate payroll processing with compliance

**Backend Tasks:**
1. Create salary structure configuration
2. Create employee salary assignment
3. Implement tax calculation engine
4. Create statutory compliance rules
5. Implement payroll cycle management
6. Create payroll processing logic
7. Create payslip generation
8. Implement bank file generation
9. Create payroll reports
10. Implement payroll approval workflow

**Frontend Tasks:**
1. Create salary structure builder
2. Create employee salary management
3. Create payroll cycle management interface
4. Create payroll processing dashboard
5. Create payslip viewer (employee)
6. Create payroll approval interface
7. Create payroll reports and analytics
8. Create tax configuration interface

**Deliverables:**
- Salary structure management
- Automated payroll processing
- Tax calculation with compliance
- Payslip generation and distribution
- Bank file generation
- Payroll reports

---

### Phase 5: ATS with AI (4 weeks)
**Goal**: Build applicant tracking system with AI-powered features

**Backend Tasks:**
1. Create job opening CRUD APIs
2. Create candidate CRUD APIs
3. Create application management APIs
4. **Implement AI resume parser**
5. **Implement AI candidate ranking algorithm**
6. Create interview scheduling APIs
7. Create offer management APIs
8. Implement recruitment pipeline
9. Create recruitment analytics
10. Setup email templates for candidate communication

**Frontend Tasks:**
1. Create job posting interface
2. Create candidate database
3. Create application tracking board (Kanban)
4. Create candidate profile with AI insights
5. Create interview scheduling interface
6. Create offer management interface
7. Create recruitment dashboard
8. Create career site (public job board)
9. Implement AI-powered candidate search

**AI/ML Tasks:**
1. Implement resume parsing (OpenAI or custom)
2. Create skill extraction algorithm
3. Implement candidate-job matching algorithm
4. Create ranking system
5. Setup vector embeddings for semantic search
6. Create AI insights and recommendations

**Deliverables:**
- Complete ATS module
- AI-powered resume parsing
- Intelligent candidate ranking
- Interview management
- Offer management
- Recruitment analytics

---

### Phase 6: AI Chatbot for Self-Service (3 weeks)
**Goal**: Implement AI chatbot for employee queries

**Backend Tasks:**
1. Design chatbot architecture
2. Implement intent recognition (OpenAI or Dialogflow)
3. Create entity extraction logic
4. Implement conversation context management
5. Create action handlers for each intent
6. Integrate with existing APIs (leave, attendance, payroll)
7. Create knowledge base management
8. Implement fallback to human support
9. Setup WebSocket for real-time chat

**Frontend Tasks:**
1. Create chatbot UI component
2. Implement chat interface
3. Create conversation history
4. Create knowledge base management interface (admin)
5. Add chatbot to employee dashboard
6. Create mobile-responsive chat interface

**AI/ML Tasks:**
1. Train/configure intent classification
2. Setup entity recognition
3. Create conversation flows
4. Implement response generation
5. Setup embeddings for knowledge base search
6. Implement sentiment analysis (optional)

**Deliverables:**
- Working AI chatbot
- Intent recognition for common HR queries
- Integration with core modules
- Knowledge base management
- Chat history and analytics

---

### Phase 7: Performance Management (2 weeks)
**Goal**: Enable performance reviews and goal tracking

**Backend Tasks:**
1. Create performance cycle APIs
2. Create goal management APIs
3. Create review template configuration
4. Implement performance review workflow
5. Create 360-degree feedback logic
6. Implement rating calculation
7. Create performance reports

**Frontend Tasks:**
1. Create performance cycle management
2. Create goal setting interface
3. Create review forms
4. Create 360-degree feedback interface
5. Create performance dashboard
6. Create manager review interface
7. Create performance analytics

**Deliverables:**
- Performance review system
- Goal management (OKRs)
- 360-degree feedback
- Performance analytics

---

### Phase 8: Document Management & Onboarding (2 weeks)
**Goal**: Manage documents and automate onboarding

**Backend Tasks:**
1. Create document upload/download APIs
2. Implement document versioning
3. Create document access control
4. Implement digital signature
5. Create onboarding workflow APIs
6. Implement task assignment logic
7. Create document templates

**Frontend Tasks:**
1. Create document repository interface
2. Create document viewer
3. Create digital signature interface
4. Create onboarding workflow builder
5. Create new hire onboarding portal
6. Create onboarding checklist interface

**Deliverables:**
- Document management system
- Digital signature support
- Onboarding automation
- Template management

---

### Phase 9: Reports, Analytics & Admin Panel (2 weeks)
**Goal**: Create comprehensive reporting and admin tools

**Backend Tasks:**
1. Create report template engine
2. Implement custom report builder
3. Create scheduled reports
4. Implement data export (Excel, PDF, CSV)
5. Create analytics APIs
6. Implement system configuration APIs

**Frontend Tasks:**
1. Create reports dashboard
2. Create custom report builder
3. Create data visualization (charts, graphs)
4. Create analytics dashboards
5. Create admin configuration panel
6. Create system settings interface
7. Create audit log viewer

**Deliverables:**
- Pre-built reports
- Custom report builder
- Interactive dashboards
- Admin configuration panel
- Audit logs

---

### Phase 10: Testing, Optimization & Deployment (3 weeks)
**Goal**: Test thoroughly, optimize performance, and deploy

**Tasks:**
1. **Testing**
   - Unit tests (Jest, Mocha)
   - Integration tests
   - E2E tests (Cypress, Playwright)
   - Load testing (Artillery, k6)
   - Security testing

2. **Optimization**
   - Database query optimization
   - Implement caching (Redis)
   - Frontend performance optimization
   - API response time optimization
   - Image optimization

3. **Documentation**
   - API documentation (Swagger)
   - User manual
   - Admin guide
   - Developer documentation

4. **Deployment**
   - Setup production environment
   - Configure CI/CD pipeline
   - Setup monitoring (Prometheus, Grafana)
   - Setup error tracking (Sentry)
   - Deploy to production

**Deliverables:**
- Fully tested application
- Optimized performance
- Complete documentation
- Production deployment
- Monitoring and alerting setup

---

## Total Timeline: 30 weeks (~7 months)

### Post-Launch Enhancements (Future)
1. **Mobile App** (React Native or Flutter)
2. **Advanced Analytics** (Predictive analytics, ML insights)
3. **Learning Management System (LMS)**
4. **Expense Management**
5. **Travel Management**
6. **Benefits Administration**
7. **Compensation Planning**
8. **Succession Planning**
9. **Employee Engagement Surveys**
10. **Shift Management & Scheduling**

---

## Success Metrics

### Technical Metrics
- API response time < 200ms (p95)
- Database query time < 100ms (p95)
- 99.9% uptime
- Zero data breaches
- Code coverage > 80%

### Business Metrics
- Time to process payroll: < 2 hours
- Time to hire: < 30 days
- Employee self-service adoption: > 80%
- Chatbot resolution rate: > 70%
- User satisfaction: > 4.5/5

---

## Next Steps

1. **Review and approve this architecture plan**
2. **Setup development environment (Phase 0)**
3. **Begin Phase 1: Authentication & User Management**
4. **Regular sprint reviews and adjustments**

---

**Document Version**: 1.0
**Date**: January 23, 2026
**Status**: Pending Approval
