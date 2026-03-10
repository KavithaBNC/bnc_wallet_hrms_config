/**
 * seed-mm-tech-vadivelan-attendance.ts
 * -------------------------------------
 * Seeds February 2026 attendance data for Vadivelan (mm00012) in MM Tech org.
 *
 * Creates:
 *  - AttendancePunch records (raw IN/OUT punches)
 *  - AttendanceRecord records (day-wise summary)
 *  - LeaveRequest records (1 SL + 1 EL, both APPROVED)
 *  - MonthlyAttendanceSummary for Feb 2026
 *
 * Run: cd backend && npx ts-node --transpile-only src/scripts/seed-mm-tech-vadivelan-attendance.ts
 */

import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// Convert IST date/time to UTC Date object
function ist(year: number, month: number, day: number, hour: number, minute: number): Date {
  const totalMinutes = hour * 60 + minute - 330; // subtract IST offset (5h 30m = 330 min)
  const utcHour = Math.floor(totalMinutes / 60);
  const utcMinute = totalMinutes % 60;
  return new Date(Date.UTC(year, month - 1, day, utcHour, utcMinute, 0, 0));
}

// Date-only (midnight IST → correct UTC date boundary)
function dateOnly(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

async function main() {
  console.log('🌱 Seed: Vadivelan Feb 2026 Attendance\n');

  // ── Find MM Tech org & Vadivelan ─────────────────────────────
  const org = await prisma.organization.findFirst({
    where: { name: { contains: 'MM Tech' } },
  });
  if (!org) { console.error('❌ MM Tech org not found'); process.exit(1); }
  console.log(`✓ Org: ${org.name} (${org.id})`);

  const vadivelan = await prisma.employee.findFirst({
    where: { organizationId: org.id, employeeCode: 'mm00012' },
    select: { id: true, firstName: true, lastName: true, shiftId: true },
  });
  if (!vadivelan) { console.error('❌ Vadivelan (mm00012) not found'); process.exit(1); }
  console.log(`✓ Employee: ${vadivelan.firstName} ${vadivelan.lastName} (${vadivelan.id})`);

  const ganeshan = await prisma.employee.findFirst({
    where: { organizationId: org.id, employeeCode: 'mm00011' },
    select: { id: true, firstName: true },
  });
  console.log(`✓ Approver: ${ganeshan?.firstName ?? 'not found'}`);

  // ── Find EL and SL leave types for MM Tech ───────────────────
  const leaveTypes = await prisma.leaveType.findMany({
    where: { organizationId: org.id },
  });
  const elType = leaveTypes.find(lt => lt.name === 'Earned Leave');
  const slType = leaveTypes.find(lt => lt.name === 'Sick Leave');

  if (!elType) { console.error('❌ EL leave type not found for MM Tech'); process.exit(1); }
  if (!slType) { console.error('❌ SL leave type not found for MM Tech'); process.exit(1); }
  console.log(`✓ EL: ${elType.id}  SL: ${slType.id}\n`);

  const empId = vadivelan.id;
  const shiftId = vadivelan.shiftId ?? null;

  // ── February 2026 attendance plan ────────────────────────────
  // Weekdays: Feb 2-6, 9-12, (13=SL), 16-18, 19(early), 20, (23=EL), 24-26(perm), 27(early)
  // Weekends: Feb 1,7,8,14,15,21,22,28

  type DayPlan =
    | { kind: 'work';        day: number; inH: number; inM: number; outH: number; outM: number; isEarly?: boolean; isLate?: boolean; lateMin?: number; earlyMin?: number }
    | { kind: 'leave';       day: number; leaveTypeId: string; reason: string }
    | { kind: 'permission';  day: number; permStart: string; permEnd: string; inH: number; inM: number; outH: number; outM: number }
    | { kind: 'weekend';     day: number };

  const plans: DayPlan[] = [
    // Week 1
    { kind: 'weekend',    day: 1  },
    { kind: 'work',       day: 2,  inH: 9,  inM: 0,  outH: 18, outM: 0  },
    { kind: 'work',       day: 3,  inH: 9,  inM: 5,  outH: 18, outM: 10 },
    { kind: 'work',       day: 4,  inH: 9,  inM: 0,  outH: 18, outM: 0  },
    { kind: 'work',       day: 5,  inH: 8,  inM: 55, outH: 18, outM: 5  },
    { kind: 'work',       day: 6,  inH: 9,  inM: 0,  outH: 18, outM: 0  },
    { kind: 'weekend',    day: 7  },
    // Week 2
    { kind: 'weekend',    day: 8  },
    { kind: 'permission', day: 9,  permStart: '09:00', permEnd: '11:00', inH: 11, inM: 0, outH: 18, outM: 30 },
    { kind: 'work',       day: 10, inH: 9,  inM: 0,  outH: 18, outM: 0  },
    { kind: 'work',       day: 11, inH: 9,  inM: 0,  outH: 18, outM: 0  },
    { kind: 'work',       day: 12, inH: 9,  inM: 10, outH: 18, outM: 0  },
    { kind: 'leave',      day: 13, leaveTypeId: slType.id, reason: 'Feeling unwell — sick leave' },
    { kind: 'weekend',    day: 14 },
    // Week 3
    { kind: 'weekend',    day: 15 },
    { kind: 'work',       day: 16, inH: 9,  inM: 0,  outH: 18, outM: 0  },
    { kind: 'work',       day: 17, inH: 9,  inM: 0,  outH: 18, outM: 0  },
    { kind: 'work',       day: 18, inH: 9,  inM: 0,  outH: 18, outM: 0  },
    { kind: 'work',       day: 19, inH: 9,  inM: 0,  outH: 17, outM: 0,  isEarly: true, earlyMin: 60 },
    { kind: 'work',       day: 20, inH: 9,  inM: 0,  outH: 18, outM: 0  },
    { kind: 'weekend',    day: 21 },
    // Week 4
    { kind: 'weekend',    day: 22 },
    { kind: 'leave',      day: 23, leaveTypeId: elType.id, reason: 'Personal work — earned leave' },
    { kind: 'work',       day: 24, inH: 9,  inM: 0,  outH: 18, outM: 0  },
    { kind: 'work',       day: 25, inH: 9,  inM: 0,  outH: 18, outM: 0  },
    { kind: 'permission', day: 26, permStart: '09:00', permEnd: '10:30', inH: 10, inM: 30, outH: 18, outM: 30 },
    { kind: 'work',       day: 27, inH: 9,  inM: 0,  outH: 16, outM: 30, isEarly: true, earlyMin: 90 },
    { kind: 'weekend',    day: 28 },
  ];

  let punchesCreated = 0;
  let recordsCreated = 0;
  let leavesCreated  = 0;

  // ── Clear any existing Feb 2026 data for Vadivelan ───────────
  console.log('--- Clearing existing Feb 2026 data ---');
  const feb2026Start = dateOnly(2026, 2, 1);
  const feb2026End   = dateOnly(2026, 2, 29); // Feb has 28 days in 2026 (non-leap)

  // Clear punches
  const deletedPunches = await prisma.attendancePunch.deleteMany({
    where: {
      employeeId: empId,
      punchTime: { gte: feb2026Start, lt: feb2026End },
    },
  });
  console.log(`  Deleted ${deletedPunches.count} existing punches`);

  // Clear attendance records
  const deletedRecords = await prisma.attendanceRecord.deleteMany({
    where: {
      employeeId: empId,
      date: { gte: feb2026Start, lt: feb2026End },
    },
  });
  console.log(`  Deleted ${deletedRecords.count} existing attendance records`);

  // Clear leave requests for Feb
  const deletedLeaves = await prisma.leaveRequest.deleteMany({
    where: {
      employeeId: empId,
      startDate: { gte: feb2026Start, lt: feb2026End },
    },
  });
  console.log(`  Deleted ${deletedLeaves.count} existing leave requests`);

  // Clear monthly summary
  await prisma.monthlyAttendanceSummary.deleteMany({
    where: { employeeId: empId, year: 2026, month: 2 },
  });
  console.log(`  Cleared monthly summary`);

  // ── Seed attendance data ──────────────────────────────────────
  console.log('\n--- Creating Attendance Data ---');

  for (const plan of plans) {
    const { day } = plan;

    if (plan.kind === 'weekend') {
      // Weekends — create AttendanceRecord as WEEKEND, no punches
      await prisma.attendanceRecord.create({
        data: {
          employeeId: empId,
          shiftId,
          date: dateOnly(2026, 2, day),
          status: 'WEEKEND',
          totalHours: new Prisma.Decimal(0),
          workHours:  new Prisma.Decimal(0),
        },
      });
      recordsCreated++;
      continue;
    }

    if (plan.kind === 'leave') {
      // Leave days — create approved LeaveRequest, attendance record = LEAVE
      const existing = await prisma.leaveRequest.findFirst({
        where: { employeeId: empId, startDate: dateOnly(2026, 2, day) },
      });
      if (!existing) {
        await prisma.leaveRequest.create({
          data: {
            employeeId: empId,
            leaveTypeId: plan.leaveTypeId,
            startDate: dateOnly(2026, 2, day),
            endDate:   dateOnly(2026, 2, day),
            totalDays: new Prisma.Decimal(1),
            reason:    plan.reason,
            status:    'APPROVED',
            reviewedBy: ganeshan?.id ?? empId,
            reviewedAt: ist(2026, 2, day - 1, 18, 0),
            reviewComments: 'Approved',
          },
        });
        leavesCreated++;
      }
      await prisma.attendanceRecord.create({
        data: {
          employeeId: empId,
          shiftId,
          date:       dateOnly(2026, 2, day),
          status:     'LEAVE',
          totalHours: new Prisma.Decimal(0),
          workHours:  new Prisma.Decimal(0),
        },
      });
      recordsCreated++;
      console.log(`  Feb ${day}: LEAVE`);
      continue;
    }

    if (plan.kind === 'permission') {
      // Permission days — create approved LeaveRequest (reason = [Permission HH:MM-HH:MM])
      // Then punch in late (after permission ends), out normal
      const permReason = `[Permission ${plan.permStart}-${plan.permEnd}] Late arrival permission`;
      const existing = await prisma.leaveRequest.findFirst({
        where: { employeeId: empId, startDate: dateOnly(2026, 2, day) },
      });
      if (!existing) {
        await prisma.leaveRequest.create({
          data: {
            employeeId: empId,
            leaveTypeId: elType.id, // using EL type for permission
            startDate:  dateOnly(2026, 2, day),
            endDate:    dateOnly(2026, 2, day),
            totalDays:  new Prisma.Decimal(0),
            reason:     permReason,
            status:     'APPROVED',
            reviewedBy: ganeshan?.id ?? empId,
            reviewedAt: ist(2026, 2, day - 1, 18, 0),
            reviewComments: 'Permission approved',
          },
        });
        leavesCreated++;
      }

      // Punches: in after permission ends, out normal
      const checkIn  = ist(2026, 2, day, plan.inH,  plan.inM);
      const checkOut = ist(2026, 2, day, plan.outH, plan.outM);
      const workMins = (checkOut.getTime() - checkIn.getTime()) / 60000;
      const workHrs  = workMins / 60;

      await prisma.attendancePunch.createMany({
        data: [
          { employeeId: empId, punchTime: checkIn,  status: 'IN',  punchSource: 'WEB' },
          { employeeId: empId, punchTime: checkOut, status: 'OUT', punchSource: 'WEB' },
        ],
      });
      punchesCreated += 2;

      await prisma.attendanceRecord.create({
        data: {
          employeeId: empId,
          shiftId,
          date:        dateOnly(2026, 2, day),
          checkIn,
          checkOut,
          totalHours:  new Prisma.Decimal(workHrs.toFixed(2)),
          workHours:   new Prisma.Decimal(workHrs.toFixed(2)),
          breakHours:  new Prisma.Decimal(0),
          overtimeHours: new Prisma.Decimal(0),
          status:      'PRESENT',
          checkInMethod: 'WEB',
          isLate:      false, // permission covers the lateness
          lateMinutes: 0,
          isEarly:     false,
          earlyMinutes: 0,
          isDeviation: false,
        },
      });
      recordsCreated++;
      console.log(`  Feb ${day}: PERMISSION (in ${plan.inH}:${String(plan.inM).padStart(2,'0')} IST, out ${plan.outH}:${String(plan.outM).padStart(2,'0')} IST)`);
      continue;
    }

    if (plan.kind === 'work') {
      const checkIn  = ist(2026, 2, day, plan.inH,  plan.inM);
      const checkOut = ist(2026, 2, day, plan.outH, plan.outM);
      const workMins = (checkOut.getTime() - checkIn.getTime()) / 60000;
      const workHrs  = workMins / 60;

      await prisma.attendancePunch.createMany({
        data: [
          { employeeId: empId, punchTime: checkIn,  status: 'IN',  punchSource: 'WEB' },
          { employeeId: empId, punchTime: checkOut, status: 'OUT', punchSource: 'WEB' },
        ],
      });
      punchesCreated += 2;

      const isEarly    = plan.isEarly ?? false;
      const earlyMin   = plan.earlyMin ?? 0;
      const shiftEndIST = ist(2026, 2, day, 18, 0);
      const earlyMinutes = isEarly
        ? Math.round((shiftEndIST.getTime() - checkOut.getTime()) / 60000)
        : 0;

      await prisma.attendanceRecord.create({
        data: {
          employeeId: empId,
          shiftId,
          date:         dateOnly(2026, 2, day),
          checkIn,
          checkOut,
          totalHours:   new Prisma.Decimal(workHrs.toFixed(2)),
          workHours:    new Prisma.Decimal(workHrs.toFixed(2)),
          breakHours:   new Prisma.Decimal(0),
          overtimeHours: new Prisma.Decimal(0),
          status:       'PRESENT',
          checkInMethod: 'WEB',
          isLate:       false,
          lateMinutes:  0,
          isEarly:      isEarly,
          earlyMinutes: isEarly ? earlyMinutes : 0,
          isDeviation:  isEarly,
        },
      });
      recordsCreated++;

      const tag = isEarly ? ` ⚡ early going (-${earlyMinutes}min)` : '';
      console.log(`  Feb ${day}: PRESENT ${plan.inH}:${String(plan.inM).padStart(2,'0')}-${plan.outH}:${String(plan.outM).padStart(2,'0')} IST (${workHrs.toFixed(1)}h)${tag}`);
    }
  }

  // ── Monthly Attendance Summary ────────────────────────────────
  console.log('\n--- Monthly Summary ---');

  const presentDays   = 17; // 20 working days - 2 leaves - 1 permission-day (still present)
  const leaveDays     = 2;  // Feb 13 (SL) + Feb 23 (EL)
  const weekendDays   = 8;  // Feb 1,7,8,14,15,21,22,28
  const totalWorkDays = 20;
  const paidDays      = presentDays + leaveDays; // 19

  const summary = await prisma.monthlyAttendanceSummary.create({
    data: {
      organizationId:  org.id,
      employeeId:      empId,
      year:            2026,
      month:           2,
      presentDays,
      absentDays:      0,
      leaveDays:       new Prisma.Decimal(leaveDays),
      lopDays:         new Prisma.Decimal(0),
      halfDays:        0,
      holidayDays:     0,
      weekendDays,
      overtimeHours:   new Prisma.Decimal(0),
      paidDays:        new Prisma.Decimal(paidDays),
      totalWorkingDays: totalWorkDays,
      status:          'DRAFT',
    },
  });
  console.log(`✅ Created monthly summary (id: ${summary.id})`);

  // Leave breakdown rows
  await prisma.monthlyAttendanceSummaryLeave.create({
    data: {
      summaryId:   summary.id,
      leaveTypeId: slType.id,
      days:        new Prisma.Decimal(1),
      isPaid:      true,
    },
  });
  await prisma.monthlyAttendanceSummaryLeave.create({
    data: {
      summaryId:   summary.id,
      leaveTypeId: elType.id,
      days:        new Prisma.Decimal(1),
      isPaid:      true,
    },
  });
  console.log(`  → SL: 1 day, EL: 1 day in breakdown`);

  // ── Summary ───────────────────────────────────────────────────
  console.log(`
✅ Done!
   Punches created:         ${punchesCreated}
   Attendance records:      ${recordsCreated}
   Leave requests created:  ${leavesCreated}
   Monthly summary:         DRAFT (year=2026, month=2)

Next steps:
  1. Go to Attendance → Vadivelan → February 2026 calendar
  2. You should see: 17 Present, 2 Leave (SL+EL), 2 Permission days, 2 Early Going days
  3. Monthly Details: EL=1, SL=1 leave days
`);
}

main()
  .catch(e => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
