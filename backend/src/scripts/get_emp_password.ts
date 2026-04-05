import { configPrisma } from '../utils/config-prisma';
import { prisma } from '../utils/prisma';

async function main() {
  const cfgUser = await configPrisma.users.findUnique({ where: { id: 2017 } });
  console.log('email:', cfgUser?.email, 'active:', cfgUser?.is_active, 'company_id:', cfgUser?.company_id);
  console.log('enc_pw_prefix:', String(cfgUser?.encrypted_password || '').substring(0,60));

  const emp = await prisma.employee.findFirst({
    where: { userId: 'ff722496-12b3-4fa4-8e1f-0e710e11c497' },
    select: { id: true, firstName: true, lastName: true, employeeCode: true }
  });
  console.log('Employee:', JSON.stringify(emp));
  await prisma.$disconnect();
  await configPrisma.$disconnect();
}
main().catch(e => { console.error(e.message); process.exit(1); });
