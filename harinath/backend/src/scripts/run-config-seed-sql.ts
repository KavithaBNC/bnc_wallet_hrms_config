/**
 * Run Config DB seed SQL via Node.js (no psql required)
 * scripts/check-config-db-before-seed.sql + seed-hrms-modules-company-59-v2.sql
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const CONFIG_DB_URL =
  process.env.CONFIG_DB_URL ||
  'postgresql://postgres:Bncdb2026@bnc-db.czjz5u62pd3z.ap-south-1.rds.amazonaws.com:5432/Bnc_Configurator?schema=public&sslmode=require';

const SCRIPTS_DIR = path.resolve(__dirname, '../../../scripts');

async function main() {
  const pg = await import('pg');
  const client = new pg.Client({ connectionString: CONFIG_DB_URL });

  try {
    await client.connect();
    console.log('Connected to Config DB\n');

    // 1. Check
    console.log('[1/2] Checking Config DB...');
    const checkSql = fs.readFileSync(
      path.join(SCRIPTS_DIR, 'check-config-db-before-seed.sql'),
      'utf8'
    );
    await client.query(checkSql);
    console.log('Check done.\n');

    // 2. Seed
    console.log('[2/2] Seeding HRMS modules...');
    const seedSql = fs.readFileSync(
      path.join(SCRIPTS_DIR, 'seed-hrms-modules-company-59-v2.sql'),
      'utf8'
    );
    await client.query(seedSql);
    console.log('Done. HRMS modules seeded to Config DB.');
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
