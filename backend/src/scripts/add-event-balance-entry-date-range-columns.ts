/**
 * Add from_date and to_date columns to employee_leave_balances
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function applyMigration() {
  try {
    const columns = await prisma.$queryRawUnsafe<{ column_name: string }[]>(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'employee_leave_balances'
    `);
    const names = new Set(columns.map((c) => c.column_name));

    if (!names.has('from_date')) {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "employee_leave_balances"
        ADD COLUMN IF NOT EXISTS "from_date" DATE;
      `);
      console.log('Added employee_leave_balances.from_date');
    } else {
      console.log('employee_leave_balances.from_date already exists');
    }

    if (!names.has('to_date')) {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "employee_leave_balances"
        ADD COLUMN IF NOT EXISTS "to_date" DATE;
      `);
      console.log('Added employee_leave_balances.to_date');
    } else {
      console.log('employee_leave_balances.to_date already exists');
    }

    console.log('Event balance entry date range migration completed');
  } catch (error) {
    console.error('Failed to apply event balance entry date range migration', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
