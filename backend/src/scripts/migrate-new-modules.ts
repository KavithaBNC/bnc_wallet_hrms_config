/**
 * Migration Script: Add Loan, AuditLog, ComplianceReportRecord tables
 * and extend FnfSettlement with new deduction columns.
 *
 * Run with: npx ts-node -r tsconfig-paths/register src/scripts/migrate-new-modules.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting migration: new modules...\n');

  // ----------------------------------------------------------------
  // 1. FnfSettlement — Add missing deduction columns (if table exists)
  // ----------------------------------------------------------------
  console.log('[1/5] Checking fnf_settlements table...');
  const fnfExists = await prisma.$queryRawUnsafe<{exists: boolean}[]>(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'fnf_settlements'
    ) AS exists;
  `);
  if ((fnfExists as any)[0]?.exists) {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE fnf_settlements
        ADD COLUMN IF NOT EXISTS compensation_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS tds_adjustment DECIMAL(15,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS excess_leave_recovery DECIMAL(15,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS insurance_recovery DECIMAL(15,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS travel_recovery DECIMAL(15,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS loan_advance_recovery DECIMAL(15,2) NOT NULL DEFAULT 0;
    `);
    console.log('  ✓ fnf_settlements columns added\n');
  } else {
    console.log('  ℹ fnf_settlements table not found — will be created by db push\n');
  }

  // ----------------------------------------------------------------
  // 2. Create LoanType and LoanStatus enums
  // ----------------------------------------------------------------
  console.log('[2/5] Creating enums...');
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      CREATE TYPE "LoanType" AS ENUM ('SALARY_ADVANCE', 'PERSONAL_LOAN', 'TRAVEL_ADVANCE', 'INSURANCE_ADVANCE', 'OTHER');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      CREATE TYPE "LoanStatus" AS ENUM ('PENDING', 'APPROVED', 'ACTIVE', 'CLOSED', 'REJECTED', 'WRITTEN_OFF');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);
  console.log('  ✓ Enums created\n');

  // ----------------------------------------------------------------
  // 3. Create employee_loans table
  // ----------------------------------------------------------------
  console.log('[3/5] Creating employee_loans table...');
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS employee_loans (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      loan_type "LoanType" NOT NULL,
      loan_amount DECIMAL(15,2) NOT NULL,
      disbursed_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
      pending_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
      emi_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
      total_emis INT NOT NULL DEFAULT 0,
      paid_emis INT NOT NULL DEFAULT 0,
      interest_rate DECIMAL(5,2),
      start_date DATE NOT NULL,
      end_date DATE,
      disbursed_date DATE,
      reason TEXT,
      approved_by UUID,
      approved_at TIMESTAMPTZ,
      status "LoanStatus" NOT NULL DEFAULT 'PENDING',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_employee_loans_org ON employee_loans(organization_id);`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_employee_loans_emp ON employee_loans(employee_id);`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_employee_loans_status ON employee_loans(status);`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS loan_repayments (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      loan_id UUID NOT NULL REFERENCES employee_loans(id) ON DELETE CASCADE,
      payroll_cycle_id UUID,
      amount DECIMAL(15,2) NOT NULL,
      principal_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
      interest_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
      repayment_date DATE NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_loan_repayments_loan ON loan_repayments(loan_id);`);
  console.log('  ✓ employee_loans and loan_repayments tables created\n');

  // ----------------------------------------------------------------
  // 4. Create audit_logs table
  // ----------------------------------------------------------------
  console.log('[4/5] Creating audit_logs table...');
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      entity_type VARCHAR(50) NOT NULL,
      entity_id UUID NOT NULL,
      action VARCHAR(30) NOT NULL,
      previous_value JSONB,
      new_value JSONB,
      changed_by UUID,
      changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ip_address VARCHAR(45),
      remarks TEXT
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_audit_logs_org ON audit_logs(organization_id);`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_at ON audit_logs(changed_at);`);
  console.log('  ✓ audit_logs table created\n');

  // ----------------------------------------------------------------
  // 5. Create compliance_report_records table
  // ----------------------------------------------------------------
  console.log('[5/5] Creating compliance_report_records table...');
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS compliance_report_records (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      report_type VARCHAR(50) NOT NULL,
      payroll_cycle_id UUID,
      financial_year VARCHAR(10) NOT NULL,
      month INT,
      report_data JSONB,
      file_url VARCHAR(500),
      generated_by UUID,
      generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      status VARCHAR(20) NOT NULL DEFAULT 'GENERATED',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_compliance_records_org ON compliance_report_records(organization_id);`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_compliance_records_type_fy ON compliance_report_records(report_type, financial_year);`);
  console.log('  ✓ compliance_report_records table created\n');

  console.log('Migration completed successfully.');
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
