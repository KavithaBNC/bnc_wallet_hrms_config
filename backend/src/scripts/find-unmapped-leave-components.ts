/**
 * Find Attendance Components (Event Types) with category "Leave" that are NOT linked to any Leave Type.
 * Run: npx ts-node -r tsconfig-paths/register src/scripts/find-unmapped-leave-components.ts
 * Or:  npx tsx src/scripts/find-unmapped-leave-components.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function nameKey(s: string | null): string {
  return (s ?? '').toLowerCase().trim();
}

async function main() {
  const orgId = process.env.ORGANIZATION_ID;
  if (!orgId) {
    console.log('Usage: ORGANIZATION_ID=<your-org-uuid> npx ts-node src/scripts/find-unmapped-leave-components.ts');
    console.log('Or run without env to check all organizations.\n');
  }

  const whereOrg = orgId ? { organizationId: orgId } : {};

  const [components, leaveTypes] = await Promise.all([
    prisma.attendanceComponent.findMany({
      where: { ...whereOrg, eventCategory: 'Leave' },
      select: { id: true, shortName: true, eventName: true, organizationId: true },
      orderBy: [{ shortName: 'asc' }],
    }),
    prisma.leaveType.findMany({
      where: { ...whereOrg, isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: [{ name: 'asc' }],
    }),
  ]);

  const unmapped: Array<{ id: string; shortName: string; eventName: string; orgId: string }> = [];

  for (const c of components) {
    const en = nameKey(c.eventName);
    const sn = nameKey(c.shortName);
    const matched = leaveTypes.find(
      (lt) =>
        (en && (nameKey(lt.name) === en || nameKey(lt.code) === en)) ||
        (sn && (nameKey(lt.code) === sn || nameKey(lt.name) === sn))
    );
    if (!matched) {
      unmapped.push({
        id: c.id,
        shortName: c.shortName,
        eventName: c.eventName,
        orgId: c.organizationId,
      });
    }
  }

  if (unmapped.length === 0) {
    console.log('All Leave-category Attendance Components are linked to a Leave Type.');
    console.log('If you still see the error, ensure you selected a Leave Type from the dropdown when it appears.');
    process.exit(0);
  }

  console.log('=== UNMAPPED LEAVE EVENT TYPES ===\n');
  console.log('These Attendance Components (Event Types) have category "Leave" but are NOT linked to any Leave Type:\n');

  for (const u of unmapped) {
    console.log(`  Event: "${u.eventName}" (Short Name: ${u.shortName})`);
    console.log(`  ID: ${u.id}`);
    console.log('');
  }

  console.log('--- Fix options ---');
  console.log('1. Edit the Attendance Component in Event Configuration → Attendance Components');
  console.log('   so that Short Name or Event Name matches an existing Leave Type\'s Code or Name.');
  console.log('');
  console.log('2. Create a new Leave Type (e.g. from Leave Management) with matching name/code,');
  console.log('   then the system will auto-link.');
  console.log('');
  console.log('3. When applying leave, select a Leave Type from the "Leave Type" dropdown that');
  console.log('   appears below Type when the event has no mapping.');

  process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
