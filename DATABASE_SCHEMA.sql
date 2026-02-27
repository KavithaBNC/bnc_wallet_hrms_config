-- HRMS Portal 2026 - Database Schema
-- PostgreSQL 15+ with Extensions: pgvector, TimescaleDB (optional)

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector"; -- For AI embeddings
CREATE EXTENSION IF NOT EXISTS "pg_cron"; -- For scheduled jobs (optional)

-- ============================================================================
-- CORE HR MODULE
-- ============================================================================

-- Organizations (Multi-tenant support)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255),
    industry VARCHAR(100),
    size_range VARCHAR(20) CHECK (size_range IN ('1-10', '11-50', '51-200', '201-500', '500+')),
    tax_id VARCHAR(50) UNIQUE,
    registration_number VARCHAR(100),
    website VARCHAR(255),
    logo_url VARCHAR(500),
    address JSONB,
    timezone VARCHAR(50) DEFAULT 'UTC',
    currency VARCHAR(3) DEFAULT 'USD',
    fiscal_year_start DATE,
    settings JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users (Authentication)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE')),
    is_active BOOLEAN DEFAULT TRUE,
    is_email_verified BOOLEAN DEFAULT FALSE,
    email_verification_token VARCHAR(255),
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMP,
    last_login_at TIMESTAMP,
    login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    two_factor_secret VARCHAR(255),
    refresh_token TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Permissions
CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    resource VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL CHECK (action IN ('CREATE', 'READ', 'UPDATE', 'DELETE', 'APPROVE')),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Role Permissions (Many-to-Many)
CREATE TABLE role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role VARCHAR(50) NOT NULL,
    permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(role, permission_id)
);

-- Departments
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE,
    description TEXT,
    parent_department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    manager_id UUID, -- Will be FK to employees after it's created
    cost_center VARCHAR(50),
    location VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Job Positions
CREATE TABLE job_positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    level VARCHAR(50) CHECK (level IN ('ENTRY', 'JUNIOR', 'SENIOR', 'LEAD', 'MANAGER', 'DIRECTOR', 'VP', 'C_LEVEL')),
    employment_type VARCHAR(50) CHECK (employment_type IN ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN')),
    description TEXT,
    requirements JSONB,
    responsibilities JSONB,
    salary_range_min DECIMAL(15, 2),
    salary_range_max DECIMAL(15, 2),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Employees
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    employee_code VARCHAR(50) UNIQUE NOT NULL,
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,

    -- Personal Information
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    personal_email VARCHAR(255),
    phone VARCHAR(20),
    date_of_birth DATE,
    gender VARCHAR(30) CHECK (gender IN ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY')),
    marital_status VARCHAR(20) CHECK (marital_status IN ('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED')),
    nationality VARCHAR(100),
    profile_picture_url VARCHAR(500),

    -- Employment Information
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    position_id UUID REFERENCES job_positions(id) ON DELETE SET NULL,
    reporting_manager_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    work_location VARCHAR(255),
    employment_type VARCHAR(50) CHECK (employment_type IN ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN')),
    employee_status VARCHAR(50) DEFAULT 'ACTIVE' CHECK (employee_status IN ('ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED', 'RESIGNED')),

    -- Dates
    date_of_joining DATE NOT NULL,
    probation_end_date DATE,
    confirmation_date DATE,
    date_of_leaving DATE,
    termination_reason TEXT,

    -- Additional Information (JSONB for flexibility)
    address JSONB,
    emergency_contacts JSONB,
    bank_details JSONB, -- Should be encrypted
    tax_information JSONB, -- Should be encrypted
    documents JSONB,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP -- Soft delete
);

-- Add foreign key to departments for manager_id
ALTER TABLE departments ADD CONSTRAINT fk_departments_manager
    FOREIGN KEY (manager_id) REFERENCES employees(id) ON DELETE SET NULL;

-- ============================================================================
-- PAYROLL MODULE
-- ============================================================================

-- Salary Structures
CREATE TABLE salary_structures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    components JSONB, -- Array of {name, type, calculation_type, value, is_taxable, is_statutory}
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Employee Bank Accounts
CREATE TABLE employee_bank_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    bank_name VARCHAR(255) NOT NULL,
    account_number VARCHAR(50) NOT NULL, -- Should be encrypted
    routing_number VARCHAR(50),
    account_type VARCHAR(20) CHECK (account_type IN ('CHECKING', 'SAVINGS')),
    is_primary BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Employee Salary
CREATE TABLE employee_salary (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    salary_structure_id UUID REFERENCES salary_structures(id) ON DELETE SET NULL,
    effective_date DATE NOT NULL,
    basic_salary DECIMAL(15, 2) NOT NULL,
    gross_salary DECIMAL(15, 2) NOT NULL,
    net_salary DECIMAL(15, 2) NOT NULL,
    components JSONB, -- Actual component values
    currency VARCHAR(3) DEFAULT 'USD',
    payment_frequency VARCHAR(20) CHECK (payment_frequency IN ('MONTHLY', 'BI_WEEKLY', 'WEEKLY')),
    bank_account_id UUID REFERENCES employee_bank_accounts(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payroll Cycles
CREATE TABLE payroll_cycles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    payment_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PROCESSING', 'APPROVED', 'PAID', 'CANCELLED')),
    total_employees INTEGER,
    total_gross DECIMAL(15, 2),
    total_deductions DECIMAL(15, 2),
    total_net DECIMAL(15, 2),
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP,
    processed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    processed_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payslips
CREATE TABLE payslips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payroll_cycle_id UUID REFERENCES payroll_cycles(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    employee_salary_id UUID REFERENCES employee_salary(id) ON DELETE SET NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    payment_date DATE NOT NULL,

    -- Salary Components
    basic_salary DECIMAL(15, 2),
    earnings JSONB, -- [{component, amount, is_taxable}]
    deductions JSONB, -- [{component, amount, type}]
    gross_salary DECIMAL(15, 2) NOT NULL,
    total_deductions DECIMAL(15, 2),
    net_salary DECIMAL(15, 2) NOT NULL,

    -- Attendance
    attendance_days DECIMAL(5, 2),
    paid_days DECIMAL(5, 2),
    unpaid_days DECIMAL(5, 2),
    overtime_hours DECIMAL(8, 2),

    -- Tax and Statutory
    tax_details JSONB,
    statutory_deductions JSONB,

    -- Payment
    status VARCHAR(50) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'GENERATED', 'SENT', 'PAID', 'HOLD')),
    pdf_url VARCHAR(500),
    payment_method VARCHAR(50) CHECK (payment_method IN ('BANK_TRANSFER', 'CHECK', 'CASH')),
    payment_reference VARCHAR(100),
    payment_status VARCHAR(50) CHECK (payment_status IN ('PENDING', 'COMPLETED', 'FAILED')),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tax Configurations
CREATE TABLE tax_configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    country VARCHAR(100) NOT NULL,
    region VARCHAR(100),
    tax_type VARCHAR(50) CHECK (tax_type IN ('INCOME_TAX', 'SOCIAL_SECURITY', 'MEDICARE', 'UNEMPLOYMENT', 'OTHER')),
    name VARCHAR(255) NOT NULL,
    calculation_rules JSONB, -- Slabs, rates, exemptions
    effective_from DATE NOT NULL,
    effective_to DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Statutory Compliances
CREATE TABLE statutory_compliances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    country VARCHAR(100) NOT NULL,
    compliance_type VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    rules JSONB,
    filing_frequency VARCHAR(50) CHECK (filing_frequency IN ('MONTHLY', 'QUARTERLY', 'ANNUALLY')),
    next_due_date DATE,
    is_mandatory BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- ATTENDANCE & LEAVE MODULE
-- ============================================================================

-- Attendance Records
CREATE TABLE attendance_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    check_in TIMESTAMP,
    check_out TIMESTAMP,
    total_hours DECIMAL(5, 2),
    break_hours DECIMAL(5, 2),
    work_hours DECIMAL(5, 2),
    overtime_hours DECIMAL(5, 2),
    status VARCHAR(50) CHECK (status IN ('PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE', 'HOLIDAY', 'WEEKEND')),
    location JSONB, -- GPS, IP address
    check_in_method VARCHAR(50) CHECK (check_in_method IN ('MANUAL', 'BIOMETRIC', 'WEB', 'MOBILE', 'GEOFENCE')),
    notes TEXT,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, date)
);

-- Leave Types
CREATE TABLE leave_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) UNIQUE,
    description TEXT,
    is_paid BOOLEAN DEFAULT TRUE,
    default_days_per_year DECIMAL(5, 2),
    max_carry_forward DECIMAL(5, 2),
    max_consecutive_days INTEGER,
    requires_document BOOLEAN DEFAULT FALSE,
    can_be_negative BOOLEAN DEFAULT FALSE,
    accrual_type VARCHAR(50) CHECK (accrual_type IN ('MONTHLY', 'QUARTERLY', 'ANNUALLY', 'NONE')),
    color_code VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Employee Leave Balances
CREATE TABLE employee_leave_balances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    leave_type_id UUID REFERENCES leave_types(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    opening_balance DECIMAL(5, 2) DEFAULT 0,
    accrued DECIMAL(5, 2) DEFAULT 0,
    used DECIMAL(5, 2) DEFAULT 0,
    carried_forward DECIMAL(5, 2) DEFAULT 0,
    available DECIMAL(5, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, leave_type_id, year)
);

-- Leave Requests
CREATE TABLE leave_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    leave_type_id UUID REFERENCES leave_types(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days DECIMAL(5, 2) NOT NULL,
    reason TEXT NOT NULL,
    supporting_documents JSONB,
    status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
    applied_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP,
    review_comments TEXT,
    cancellation_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Holidays
CREATE TABLE holidays (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    is_optional BOOLEAN DEFAULT FALSE,
    applicable_locations JSONB,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- ATS (APPLICANT TRACKING SYSTEM) MODULE
-- ============================================================================

-- Job Openings
CREATE TABLE job_openings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    position_id UUID REFERENCES job_positions(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    hiring_manager_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    recruiters JSONB, -- Array of employee IDs

    employment_type VARCHAR(50) CHECK (employment_type IN ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN')),
    job_type VARCHAR(50) CHECK (job_type IN ('REMOTE', 'ONSITE', 'HYBRID')),
    location VARCHAR(255),
    experience_required JSONB, -- {min, max}
    salary_range JSONB, -- {min, max, currency}

    description TEXT NOT NULL,
    requirements JSONB,
    responsibilities JSONB,
    skills_required JSONB,
    qualifications JSONB,
    benefits JSONB,

    number_of_positions INTEGER DEFAULT 1,
    positions_filled INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'OPEN', 'ON_HOLD', 'CLOSED', 'CANCELLED')),

    posting_date DATE,
    application_deadline DATE,
    target_closure_date DATE,

    application_form_fields JSONB,
    screening_questions JSONB,

    internal_job BOOLEAN DEFAULT FALSE,
    is_confidential BOOLEAN DEFAULT FALSE,

    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Candidates
CREATE TABLE candidates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    alternate_phone VARCHAR(20),
    current_location VARCHAR(255),
    preferred_locations JSONB,

    -- Professional Info
    current_company VARCHAR(255),
    current_designation VARCHAR(255),
    total_experience_years DECIMAL(5, 2),
    relevant_experience_years DECIMAL(5, 2),
    current_salary DECIMAL(15, 2),
    expected_salary DECIMAL(15, 2),
    notice_period INTEGER, -- in days

    -- Education
    highest_qualification VARCHAR(255),
    education JSONB,
    certifications JSONB,
    skills JSONB,

    -- Online Profiles
    linkedin_url VARCHAR(500),
    portfolio_url VARCHAR(500),
    github_url VARCHAR(500),
    other_profiles JSONB,

    -- Resume
    resume_url VARCHAR(500),
    resume_parsed_data JSONB,
    resume_embedding VECTOR(1536), -- For AI similarity search (OpenAI ada-002 dimension)

    -- Source
    source VARCHAR(50) CHECK (source IN ('CAREER_SITE', 'JOB_PORTAL', 'REFERRAL', 'LINKEDIN', 'AGENCY', 'WALK_IN', 'OTHER')),
    source_details JSONB,
    referred_by UUID REFERENCES employees(id) ON DELETE SET NULL,

    tags JSONB,
    notes TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Applications
CREATE TABLE applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_opening_id UUID REFERENCES job_openings(id) ON DELETE CASCADE,
    candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
    applied_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    current_stage VARCHAR(50) DEFAULT 'NEW' CHECK (current_stage IN ('NEW', 'SCREENING', 'PHONE_SCREEN', 'ASSESSMENT', 'INTERVIEW_1', 'INTERVIEW_2', 'INTERVIEW_3', 'HR_ROUND', 'OFFER', 'HIRED', 'REJECTED', 'WITHDRAWN')),
    status VARCHAR(50) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ON_HOLD', 'REJECTED', 'HIRED', 'WITHDRAWN')),

    cover_letter TEXT,
    screening_answers JSONB,

    -- AI-powered insights
    ai_resume_score DECIMAL(5, 2), -- 0-100
    ai_skill_match JSONB, -- {matched_skills, missing_skills, score}
    ai_experience_match JSONB,
    ai_education_match JSONB,
    ai_overall_ranking INTEGER,
    ai_summary TEXT,
    ai_recommendations JSONB,

    overall_rating DECIMAL(3, 2),
    recruiter_rating DECIMAL(3, 2),
    recruiter_notes TEXT,

    rejection_reason TEXT,
    rejection_date TIMESTAMP,
    withdrawn_reason TEXT,
    withdrawn_date TIMESTAMP,

    assigned_to UUID REFERENCES employees(id) ON DELETE SET NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(job_opening_id, candidate_id)
);

-- Application Stages
CREATE TABLE application_stages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
    stage VARCHAR(50) NOT NULL,
    status VARCHAR(50) CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED')),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Interviews
CREATE TABLE interviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
    job_opening_id UUID REFERENCES job_openings(id) ON DELETE CASCADE,
    candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,

    round INTEGER NOT NULL,
    type VARCHAR(50) CHECK (type IN ('PHONE', 'VIDEO', 'IN_PERSON', 'TECHNICAL', 'HR', 'CULTURAL_FIT', 'PANEL')),
    title VARCHAR(255) NOT NULL,

    scheduled_at TIMESTAMP,
    duration_minutes INTEGER,
    meeting_link VARCHAR(500),
    location VARCHAR(255),

    interviewers JSONB, -- Array of employee IDs
    interview_panel JSONB,

    status VARCHAR(50) DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW')),

    feedback JSONB, -- [{interviewer_id, rating, comments, skills_assessed}]
    overall_rating DECIMAL(3, 2),
    recommendation VARCHAR(50) CHECK (recommendation IN ('STRONG_YES', 'YES', 'MAYBE', 'NO', 'STRONG_NO')),

    cancellation_reason TEXT,
    reschedule_count INTEGER DEFAULT 0,

    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Offers
CREATE TABLE offers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
    candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
    job_opening_id UUID REFERENCES job_openings(id) ON DELETE CASCADE,

    offer_letter_url VARCHAR(500),
    offered_position VARCHAR(255) NOT NULL,
    offered_salary DECIMAL(15, 2) NOT NULL,
    salary_components JSONB,
    benefits JSONB,
    joining_bonus DECIMAL(15, 2),
    relocation_assistance DECIMAL(15, 2),

    offered_date DATE NOT NULL,
    valid_until DATE NOT NULL,
    expected_joining_date DATE,

    status VARCHAR(50) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'REJECTED', 'NEGOTIATING', 'EXPIRED')),

    accepted_date TIMESTAMP,
    rejected_date TIMESTAMP,
    rejection_reason TEXT,

    negotiation_notes TEXT,

    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- PERFORMANCE MANAGEMENT MODULE
-- ============================================================================

-- Review Templates
CREATE TABLE review_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    template_data JSONB, -- Questions, competencies, rating scales
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Performance Cycles
CREATE TABLE performance_cycles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) CHECK (type IN ('ANNUAL', 'HALF_YEARLY', 'QUARTERLY', 'PROBATION')),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    review_start_date DATE,
    review_end_date DATE,
    status VARCHAR(50) DEFAULT 'UPCOMING' CHECK (status IN ('UPCOMING', 'ACTIVE', 'UNDER_REVIEW', 'COMPLETED', 'CANCELLED')),
    template_id UUID REFERENCES review_templates(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Performance Reviews
CREATE TABLE performance_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    performance_cycle_id UUID REFERENCES performance_cycles(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    reviewer_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    review_type VARCHAR(50) CHECK (review_type IN ('SELF', 'MANAGER', 'PEER', '360')),

    goals_data JSONB,
    competencies_data JSONB,
    overall_rating DECIMAL(3, 2),
    overall_comments TEXT,

    strengths TEXT,
    areas_of_improvement TEXT,
    achievements JSONB,

    status VARCHAR(50) DEFAULT 'NOT_STARTED' CHECK (status IN ('NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'ACKNOWLEDGED')),
    submitted_at TIMESTAMP,
    acknowledged_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Goals
CREATE TABLE goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    goal_type VARCHAR(50) CHECK (goal_type IN ('INDIVIDUAL', 'TEAM', 'COMPANY')),
    category VARCHAR(50) CHECK (category IN ('PERFORMANCE', 'DEVELOPMENT', 'BEHAVIORAL')),
    measurement_criteria TEXT,
    target_value VARCHAR(100),
    current_value VARCHAR(100),
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    start_date DATE NOT NULL,
    due_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'NOT_STARTED' CHECK (status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    priority VARCHAR(50) CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    assigned_by UUID REFERENCES employees(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- DOCUMENT MANAGEMENT MODULE
-- ============================================================================

-- Documents
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    document_type VARCHAR(50) CHECK (document_type IN ('POLICY', 'HANDBOOK', 'CERTIFICATE', 'CONTRACT', 'OFFER_LETTER', 'PAYSLIP', 'FORM', 'OTHER')),
    category VARCHAR(100),
    description TEXT,
    file_url VARCHAR(500) NOT NULL,
    file_type VARCHAR(50),
    file_size BIGINT,
    version INTEGER DEFAULT 1,

    entity_type VARCHAR(50) CHECK (entity_type IN ('ORGANIZATION', 'EMPLOYEE', 'CANDIDATE', 'DEPARTMENT')),
    entity_id UUID,

    is_confidential BOOLEAN DEFAULT FALSE,
    requires_signature BOOLEAN DEFAULT FALSE,

    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    valid_from DATE,
    valid_until DATE,

    tags JSONB,
    metadata JSONB,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Document Signatures
CREATE TABLE document_signatures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    signer_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    signature_type VARCHAR(50) CHECK (signature_type IN ('DIGITAL', 'ELECTRONIC', 'PHYSICAL')),
    signature_data TEXT,
    ip_address VARCHAR(50),
    signed_at TIMESTAMP,
    status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SIGNED', 'DECLINED')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- AI CHATBOT MODULE
-- ============================================================================

-- Chatbot Conversations
CREATE TABLE chatbot_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    session_id VARCHAR(255) NOT NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    status VARCHAR(50) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CLOSED', 'ESCALATED')),
    escalated_to UUID REFERENCES users(id) ON DELETE SET NULL,
    conversation_summary TEXT,
    intent_history JSONB,
    satisfaction_rating INTEGER CHECK (satisfaction_rating >= 1 AND satisfaction_rating <= 5),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chatbot Messages
CREATE TABLE chatbot_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES chatbot_conversations(id) ON DELETE CASCADE,
    sender_type VARCHAR(10) CHECK (sender_type IN ('USER', 'BOT')),
    message TEXT NOT NULL,
    intent VARCHAR(100),
    entities JSONB,
    confidence_score DECIMAL(5, 4),
    response_time_ms INTEGER,
    suggested_actions JSONB,
    metadata JSONB,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chatbot Knowledge Base
CREATE TABLE chatbot_knowledge_base (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    keywords JSONB,
    embedding VECTOR(1536), -- For semantic search
    related_documents JSONB,
    usage_count INTEGER DEFAULT 0,
    effectiveness_score DECIMAL(3, 2),
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- NOTIFICATIONS & AUDIT MODULE
-- ============================================================================

-- Notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) CHECK (type IN ('INFO', 'SUCCESS', 'WARNING', 'ERROR', 'REMINDER')),
    category VARCHAR(50),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    link VARCHAR(500),
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    priority VARCHAR(50) CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
    delivery_channels JSONB, -- ['IN_APP', 'EMAIL', 'SMS']
    sent_via JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit Logs
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id UUID,
    changes JSONB, -- Before and after values
    ip_address VARCHAR(50),
    user_agent TEXT,
    status VARCHAR(50) CHECK (status IN ('SUCCESS', 'FAILURE')),
    error_message TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- ANALYTICS & REPORTING MODULE
-- ============================================================================

-- Report Templates
CREATE TABLE report_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    report_type VARCHAR(100) NOT NULL,
    description TEXT,
    query_definition JSONB,
    parameters JSONB,
    format VARCHAR(20) CHECK (format IN ('PDF', 'EXCEL', 'CSV', 'HTML')),
    schedule JSONB, -- Cron expression
    recipients JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Generated Reports
CREATE TABLE generated_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_template_id UUID REFERENCES report_templates(id) ON DELETE SET NULL,
    generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    parameters_used JSONB,
    file_url VARCHAR(500),
    file_size BIGINT,
    status VARCHAR(50) CHECK (status IN ('GENERATING', 'COMPLETED', 'FAILED')),
    error_message TEXT,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_active ON users(is_active);

-- Employees
CREATE INDEX idx_employees_organization_id ON employees(organization_id);
CREATE INDEX idx_employees_employee_code ON employees(employee_code);
CREATE INDEX idx_employees_email ON employees(email);
CREATE INDEX idx_employees_department_id ON employees(department_id);
CREATE INDEX idx_employees_position_id ON employees(position_id);
CREATE INDEX idx_employees_reporting_manager_id ON employees(reporting_manager_id);
CREATE INDEX idx_employees_employee_status ON employees(employee_status);
CREATE INDEX idx_employees_date_of_joining ON employees(date_of_joining);

-- Attendance
CREATE INDEX idx_attendance_employee_id ON attendance_records(employee_id);
CREATE INDEX idx_attendance_date ON attendance_records(date);
CREATE INDEX idx_attendance_status ON attendance_records(status);

-- Leave Requests
CREATE INDEX idx_leave_requests_employee_id ON leave_requests(employee_id);
CREATE INDEX idx_leave_requests_status ON leave_requests(status);
CREATE INDEX idx_leave_requests_dates ON leave_requests(start_date, end_date);

-- Payslips
CREATE INDEX idx_payslips_employee_id ON payslips(employee_id);
CREATE INDEX idx_payslips_payroll_cycle_id ON payslips(payroll_cycle_id);
CREATE INDEX idx_payslips_period ON payslips(period_start, period_end);

-- Applications
CREATE INDEX idx_applications_job_opening_id ON applications(job_opening_id);
CREATE INDEX idx_applications_candidate_id ON applications(candidate_id);
CREATE INDEX idx_applications_status ON applications(status);
CREATE INDEX idx_applications_current_stage ON applications(current_stage);

-- Candidates
CREATE INDEX idx_candidates_email ON candidates(email);
CREATE INDEX idx_candidates_skills ON candidates USING GIN (skills);

-- Vector similarity search indexes
CREATE INDEX idx_candidates_resume_embedding ON candidates USING ivfflat (resume_embedding vector_cosine_ops);
CREATE INDEX idx_chatbot_kb_embedding ON chatbot_knowledge_base USING ivfflat (embedding vector_cosine_ops);

-- Notifications
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- Audit Logs
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);

-- ============================================================================
-- TRIGGERS FOR AUTOMATIC TIMESTAMP UPDATES
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables with updated_at column
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON departments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_job_positions_updated_at BEFORE UPDATE ON job_positions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add similar triggers for other tables as needed

-- ============================================================================
-- SEED DATA (Optional - for development/testing)
-- ============================================================================

-- Insert default permissions
INSERT INTO permissions (name, resource, action, description) VALUES
    ('create_employee', 'employees', 'CREATE', 'Create new employees'),
    ('read_employee', 'employees', 'READ', 'View employee details'),
    ('update_employee', 'employees', 'UPDATE', 'Update employee information'),
    ('delete_employee', 'employees', 'DELETE', 'Delete employees'),
    ('approve_leave', 'leaves', 'APPROVE', 'Approve leave requests'),
    ('process_payroll', 'payroll', 'CREATE', 'Process payroll'),
    ('view_payroll', 'payroll', 'READ', 'View payroll information');

-- Insert role permissions (example for HR_MANAGER)
INSERT INTO role_permissions (role, permission_id)
SELECT 'HR_MANAGER', id FROM permissions WHERE resource IN ('employees', 'leaves', 'payroll');

-- Add more seed data as needed for development

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
