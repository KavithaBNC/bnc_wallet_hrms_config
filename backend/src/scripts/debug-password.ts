import { configPrisma } from '../utils/config-prisma';
import { prisma } from '../utils/prisma';
import bcrypt from 'bcryptjs';

async function main() {
  // Search for exact email
  const user = await configPrisma.users.findFirst({
    where: { email: { equals: 'bnc.01@gmail.com', mode: 'insensitive' } },
    select: { id: true, email: true, password: true, encrypted_password: true, is_active: true, company_id: true },
  });

  // Check HRMS DB for this user
  const hrmsUser = await prisma.user.findFirst({
    where: { email: { equals: 'bnc.01@gmail.com', mode: 'insensitive' } },
    select: { id: true, email: true, role: true, isActive: true, configuratorUserId: true, configuratorCompanyId: true, organizationId: true },
  });
  console.log('\nHRMS User:', JSON.stringify(hrmsUser, null, 2));

  // Also search Config DB for users in BNC Motors (company 14)
  const bncUsers = await configPrisma.users.findMany({
    where: { company_id: 14 },
    select: { id: true, email: true, is_active: true },
    take: 10,
  });
  console.log('\nConfig DB users in BNC Motors (company 14):', bncUsers.length);
  for (const u of bncUsers) {
    console.log('  -', u.id, u.email, 'active:', u.is_active);
  }

  // Also check company 4 (BNC, code 001)
  const bnc4Users = await configPrisma.users.findMany({
    where: { company_id: 4 },
    select: { id: true, email: true, is_active: true },
    take: 10,
  });
  console.log('\nConfig DB users in BNC (company 4):', bnc4Users.length);
  for (const u of bnc4Users) {
    console.log('  -', u.id, u.email, 'active:', u.is_active);
  }
  console.log('User found:', !!user);
  if (!user) {
    console.log('User not found!');
    process.exit(1);
  }
  console.log('  id:', user.id);
  console.log('  email:', user.email);
  console.log('  is_active:', user.is_active);
  console.log('  company_id:', user.company_id);
  console.log('  password (first 30):', user.password?.substring(0, 30));
  console.log('  encrypted_password (first 30):', user.encrypted_password?.substring(0, 30));
  console.log('  password length:', user.password?.length);
  console.log('  encrypted_password length:', user.encrypted_password?.length);

  const storedHash = user.encrypted_password || user.password;
  if (!storedHash) {
    console.log('No password stored!');
    process.exit(1);
  }

  const isBcrypt = storedHash.startsWith('$2');
  console.log('  is bcrypt hash:', isBcrypt);

  if (isBcrypt) {
    const isValid = await bcrypt.compare('4D07y12ZkZ', storedHash);
    console.log('  bcrypt.compare("4D07y12ZkZ"):', isValid);
  } else {
    console.log('  plain text match:', storedHash === '4D07y12ZkZ');
    // Try with Django/pbkdf2 style
    console.log('  hash prefix:', storedHash.substring(0, 50));
  }

  process.exit(0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
