/**
 * Add Employee Rejoin columns to the employees table.
 * Run: npx ts-node -r tsconfig-paths/register src/scripts/add-employee-rejoin-columns.ts
 */
import { prisma } from '../utils/prisma';

async function main() {
  console.log('Adding employee rejoin columns (is_rejoin, previous_employee_id, previous_employee_code)...');

  await prisma.$executeRawUnsafe(`
    ALTER TABLE employees
      ADD COLUMN IF NOT EXISTS is_rejoin BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS previous_employee_id UUID REFERENCES employees(id),
      ADD COLUMN IF NOT EXISTS previous_employee_code VARCHAR(50);
  `);

  console.log('Done. Columns added (or already existed).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
