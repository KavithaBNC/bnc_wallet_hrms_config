import { prisma } from '../utils/prisma';

const REQ_IDS = [
  '1376b756-3813-4a43-888a-ebeabbda502a',
  'b3bc8548-14ad-43e1-b87e-a13d8d1bb032',
  'e97e0b1f-7fde-494c-b7ae-8b02410db261',
  '0bf9e3eb-10f2-414a-b7b8-6c575fe9feb1',
  '1558ea89-4ac0-4b3f-9a77-6003a6915196'
];

async function main() {
  for (const id of REQ_IDS) {
    const req = await prisma.leaveRequest.findUnique({ where: { id }, select: { id: true, status: true, leaveType: { select: { name: true } } } });
    if (!req) { console.log('NOT FOUND:', id); continue; }
    if (req.status !== 'PENDING') { console.log('SKIP (not pending):', req.leaveType?.name, req.status); continue; }
    await prisma.leaveRequest.update({
      where: { id },
      data: { status: 'APPROVED', reviewedAt: new Date(), reviewComments: 'Approved via test script' }
    });
    console.log('APPROVED:', req.leaveType?.name, id);
  }
  await prisma.$disconnect();
}
main().catch(e => { console.error(e.message); process.exit(1); });
