/**
 * Map unmapped Leave-category Attendance Components to Leave Types.
 * - Creates Leave Types if they don't exist (Name = Event Name, Code = Short Name)
 * - Or updates Attendance Component to match existing Leave Type if name/code differ slightly
 *
 * Run: npm run map:unmapped-leave-components
 * Or:  ORGANIZATION_ID=<uuid> npm run map:unmapped-leave-components  (for specific org only)
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function nameKey(s: string | null): string {
  return (s ?? '').toLowerCase().trim();
}

async function main() {
  const orgId = process.env.ORGANIZATION_ID;

  const whereOrg = orgId ? { organizationId: orgId } : {};

  const [components, allLeaveTypes] = await Promise.all([
    prisma.attendanceComponent.findMany({
      where: { ...whereOrg, eventCategory: 'Leave' },
      select: { id: true, shortName: true, eventName: true, organizationId: true },
      orderBy: [{ shortName: 'asc' }],
    }),
    prisma.leaveType.findMany({
      where: { ...whereOrg, isActive: true },
      select: { id: true, name: true, code: true, organizationId: true },
    }),
  ]);

  const unmapped: typeof components = [];
  for (const c of components) {
    const en = nameKey(c.eventName);
    const sn = nameKey(c.shortName);
    const orgLeaveTypes = allLeaveTypes.filter((lt) => lt.organizationId === c.organizationId);
    const matched = orgLeaveTypes.find(
      (lt) =>
        (en && (nameKey(lt.name) === en || nameKey(lt.code) === en)) ||
        (sn && (nameKey(lt.code) === sn || nameKey(lt.name) === sn))
    );
    if (!matched) unmapped.push(c);
  }

  if (unmapped.length === 0) {
    console.log('All Leave-category Attendance Components are already mapped to Leave Types.');
    return;
  }

  console.log('=== UNMAPPED LEAVE COMPONENTS ===\n');
  for (const u of unmapped) {
    console.log(`  - ${u.eventName} (${u.shortName}) [org: ${u.organizationId}]`);
  }
  console.log('');

  const created: string[] = [];
  const updated: string[] = [];
  const skipped: string[] = [];

  for (const comp of unmapped) {
    const orgLeaveTypes = allLeaveTypes.filter((lt) => lt.organizationId === comp.organizationId);
    const codeExists = await prisma.leaveType.findFirst({
      where: { code: comp.shortName?.trim() || undefined },
    });
    const nameExistsInOrg = orgLeaveTypes.find(
      (lt) => nameKey(lt.name) === nameKey(comp.eventName) || nameKey(lt.code) === nameKey(comp.shortName)
    );

    if (nameExistsInOrg) {
      const lt = nameExistsInOrg;
      const needsUpdate =
        (comp.eventName && nameKey(comp.eventName) !== nameKey(lt.name)) ||
        (comp.shortName && nameKey(comp.shortName) !== nameKey(lt.code ?? ''));
      if (needsUpdate) {
        try {
          await prisma.attendanceComponent.update({
            where: { id: comp.id },
            data: {
              eventName: lt.name,
              shortName: lt.code || lt.name,
            },
          });
          updated.push(`${comp.eventName} → matched to ${lt.name} (${lt.code})`);
        } catch (e: any) {
          skipped.push(`${comp.eventName}: ${e?.message || 'update failed'}`);
        }
      } else {
        skipped.push(`${comp.eventName}: Leave Type exists but matching failed (possible case/whitespace)`);
      }
      continue;
    }

    const codeTakenByOtherOrg = codeExists && codeExists.organizationId !== comp.organizationId;
    const useNullCode = codeTakenByOtherOrg;

    try {
      const lt = await prisma.leaveType.create({
        data: {
          organizationId: comp.organizationId,
          name: comp.eventName?.trim() || comp.shortName || 'Leave',
          code: useNullCode ? null : (comp.shortName?.trim() || undefined),
          isPaid: true,
          isActive: true,
          // defaultDaysPerYear left NULL – admin must configure in Leave Management or Auto Credit Setting
        },
      });
      created.push(`${comp.eventName} (${comp.shortName}) → created Leave Type ${lt.name} [${lt.id}]`);
      allLeaveTypes.push({ id: lt.id, name: lt.name, code: lt.code, organizationId: lt.organizationId });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        skipped.push(
          `${comp.eventName}: Leave Type with code "${comp.shortName}" already exists. Run the script again - it may now match.`
        );
      } else {
        skipped.push(`${comp.eventName}: ${e?.message || 'create failed'}`);
      }
    }
  }

  console.log('=== RESULTS ===\n');
  if (created.length > 0) {
    console.log('Created Leave Types:');
    created.forEach((c) => console.log('  ✓', c));
    console.log('');
  }
  if (updated.length > 0) {
    console.log('Updated Attendance Components:');
    updated.forEach((u) => console.log('  ✓', u));
    console.log('');
  }
  if (skipped.length > 0) {
    console.log('Skipped (manual action may be needed):');
    skipped.forEach((s) => console.log('  ⚠', s));
    console.log('');
  }

  const stillUnmapped = await runUnmappedCheck(orgId);
  if (stillUnmapped.length > 0) {
    console.log('Still unmapped after script:');
    stillUnmapped.forEach((u) => console.log(`  - ${u.eventName} (${u.shortName})`));
    console.log('\nSee LEAVE_EVENT_MAPPING_GUIDE.md for manual mapping steps.');
    process.exit(1);
  }

  console.log('All Leave components are now mapped. Leave application should work without error.');
}

async function runUnmappedCheck(orgId?: string) {
  const whereOrg = orgId ? { organizationId: orgId } : {};
  const [components, leaveTypes] = await Promise.all([
    prisma.attendanceComponent.findMany({
      where: { ...whereOrg, eventCategory: 'Leave' },
      select: { id: true, shortName: true, eventName: true, organizationId: true },
    }),
    prisma.leaveType.findMany({
      where: { ...whereOrg, isActive: true },
      select: { id: true, name: true, code: true, organizationId: true },
    }),
  ]);
  const nk = (s: string | null) => (s ?? '').toLowerCase().trim();
  return components.filter((c) => {
    const orgLts = leaveTypes.filter((lt) => lt.organizationId === c.organizationId);
    const en = nk(c.eventName);
    const sn = nk(c.shortName);
    const matched = orgLts.find(
      (lt) =>
        (en && (nk(lt.name) === en || nk(lt.code) === en)) ||
        (sn && (nk(lt.code) === sn || nk(lt.name) === sn))
    );
    return !matched;
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
