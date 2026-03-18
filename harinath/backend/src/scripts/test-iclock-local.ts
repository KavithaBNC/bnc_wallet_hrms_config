/**
 * One-command local test for /iclock/cdata.
 * 1. GET handshake
 * 2. POST sample punch (USERID=EMP001, SERIALNO=CQZ7224460246)
 * 3. Print latest attendance_logs row from DB
 *
 * Run: npm run test:iclock  (or npx ts-node -r tsconfig-paths/register src/scripts/test-iclock-local.ts)
 * Prerequisite: Backend running on http://localhost:5000
 */
import { prisma } from '../utils/prisma';

const BASE = process.env.ICLOCK_TEST_URL || 'http://localhost:5000';
const CDATA = `${BASE}/iclock/cdata`;
const SERIAL = process.env.BIOMETRIC_DEVICE_SERIAL || 'CQZ7224460246';

function formatTimestamp(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${y}${m}${day}${h}${min}${s}`;
}

async function main() {
  console.log('Testing /iclock/cdata at', CDATA);
  console.log('');

  // 1. GET handshake
  try {
    const getRes = await fetch(CDATA);
    const getBody = await getRes.text();
    console.log('1. GET /iclock/cdata');
    console.log('   Status:', getRes.status, getRes.statusText);
    console.log('   Body:', getBody.trim() || '(empty)');
    console.log(getRes.status === 200 && getBody.trim() === 'OK' ? '   OK' : '   UNEXPECTED');
  } catch (e) {
    console.error('1. GET failed:', e instanceof Error ? e.message : e);
    console.log('   Is the backend running? npm run dev');
    process.exit(1);
  }
  console.log('');

  // 2. POST sample punch
  const timestamp = formatTimestamp(new Date());
  const postBody = new URLSearchParams({
    USERID: 'EMP001',
    TIMESTAMP: timestamp,
    STATUS: '0',
    SERIALNO: SERIAL,
  }).toString();

  try {
    const postRes = await fetch(CDATA, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: postBody,
    });
    const postResBody = await postRes.text();
    console.log('2. POST /iclock/cdata');
    console.log('   Status:', postRes.status, postRes.statusText);
    console.log('   Body:', postResBody.trim() || '(empty)');
    console.log('   Sent: USERID=EMP001, TIMESTAMP=' + timestamp + ', STATUS=0, SERIALNO=' + SERIAL);
    console.log(postRes.status === 200 ? '   OK' : '   UNEXPECTED');
  } catch (e) {
    console.error('2. POST failed:', e instanceof Error ? e.message : e);
    process.exit(1);
  }
  console.log('');

  // 3. Latest attendance_logs row
  try {
    const latest = await prisma.attendanceLog.findFirst({
      orderBy: { createdAt: 'desc' },
      include: { device: { select: { serialNumber: true, name: true } } },
    });
    if (latest) {
      console.log('3. Latest attendance_logs row');
      console.log('   id:', latest.id);
      console.log('   user_id:', latest.userId);
      console.log('   punch_timestamp:', latest.punchTimestamp);
      console.log('   status:', latest.status);
      console.log('   device:', latest.device?.serialNumber, latest.device?.name ?? '');
      console.log('   employee_id:', latest.employeeId ?? '(not resolved)');
    } else {
      console.log('3. No attendance_logs rows yet (or device serial not in devices table)');
    }
  } catch (e) {
    console.error('3. DB check failed:', e instanceof Error ? e.message : e);
  } finally {
    await prisma.$disconnect();
  }

  console.log('');
  console.log('Done.');
}

main();
