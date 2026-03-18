/**
 * Add face_encoding column to employees (fixes "column does not exist" on employee list).
 * Usage: npm run migrate:face-encoding
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Adding face_encoding column to employees...');
  await prisma.$executeRawUnsafe(`
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS face_encoding JSONB;
  `);
  console.log('Done. employees.face_encoding exists.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
