import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function seedAttendanceData() {
  console.log('🌱 Seeding Attendance Management Data...\n');

  try {
    // Get or create default organization
    let org = await prisma.organization.findFirst({
      orderBy: { createdAt: 'asc' },
    });

    if (!org) {
      org = await prisma.organization.create({
        data: {
          id: '00000000-0000-0000-0000-000000000001',
          name: 'BNC Technologies',
          legalName: 'BNC Technologies Pvt Ltd',
          industry: 'Information Technology',
          sizeRange: '51-200',
          timezone: 'Asia/Kolkata',
          currency: 'INR',
          fiscalYearStart: new Date('2026-04-01'),
          address: {},
          settings: {},
        },
      });
      console.log('✅ Created default organization');
    }

    // Create Shifts
    console.log('\n⏰ Creating Shifts...');
    const shifts = [
      {
        name: 'Morning Shift',
        code: 'MORN',
        description: 'Standard morning shift (9 AM - 6 PM)',
        startTime: '09:00',
        endTime: '18:00',
        breakDuration: 60, // 1 hour lunch break
        isFlexible: false,
        gracePeriod: 15, // 15 minutes grace period
        earlyLeaveAllowed: false,
        overtimeEnabled: true,
        overtimeThreshold: new Prisma.Decimal(8.0),
        geofenceEnabled: false, // Disabled by default
        isActive: true,
      },
      {
        name: 'Evening Shift',
        code: 'EVEN',
        description: 'Evening shift (2 PM - 11 PM)',
        startTime: '14:00',
        endTime: '23:00',
        breakDuration: 60,
        isFlexible: false,
        gracePeriod: 15,
        earlyLeaveAllowed: false,
        overtimeEnabled: true,
        overtimeThreshold: new Prisma.Decimal(8.0),
        geofenceEnabled: false,
        isActive: true,
      },
      {
        name: 'Night Shift',
        code: 'NIGHT',
        description: 'Night shift (10 PM - 7 AM)',
        startTime: '22:00',
        endTime: '07:00',
        breakDuration: 60,
        isFlexible: false,
        gracePeriod: 15,
        earlyLeaveAllowed: false,
        overtimeEnabled: true,
        overtimeThreshold: new Prisma.Decimal(8.0),
        geofenceEnabled: false,
        isActive: true,
      },
      {
        name: 'Flexible Shift',
        code: 'FLEX',
        description: 'Flexible working hours',
        startTime: '09:00',
        endTime: '18:00',
        breakDuration: 60,
        isFlexible: true,
        gracePeriod: 30,
        earlyLeaveAllowed: true,
        overtimeEnabled: true,
        overtimeThreshold: new Prisma.Decimal(8.0),
        geofenceEnabled: false,
        isActive: true,
      },
    ];

    const createdShifts = [];
    for (const shift of shifts) {
      // Calculate work hours
      const [startHour, startMin] = shift.startTime.split(':').map(Number);
      const [endHour, endMin] = shift.endTime.split(':').map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      const totalMinutes = endMinutes > startMinutes 
        ? endMinutes - startMinutes 
        : (24 * 60) - startMinutes + endMinutes; // Handle overnight shifts
      const workHours = (totalMinutes - shift.breakDuration) / 60;

      const existing = await prisma.shift.findUnique({
        where: { organizationId_code: { organizationId: org.id, code: shift.code } },
      });

      if (!existing) {
        const created = await prisma.shift.create({
          data: {
            organizationId: org.id,
            ...shift,
            workHours: new Prisma.Decimal(workHours),
          },
        });
        createdShifts.push(created);
        console.log(`  ✅ Created: ${created.name} (${created.code}) - ${created.startTime} to ${created.endTime}`);
      } else {
        createdShifts.push(existing);
        console.log(`  ⏭️  Already exists: ${existing.name} (${existing.code})`);
      }
    }

    console.log('\n✅ Attendance Management seed data created successfully!');
    console.log(`\n📊 Summary:`);
    console.log(`   - Shifts: ${createdShifts.length}`);
    console.log(`\n💡 You can now:`);
    console.log(`   1. Assign shifts to employees`);
    console.log(`   2. Test check-in/check-out functionality`);
    console.log(`   3. Test attendance regularization`);

  } catch (error: any) {
    console.error('❌ Error seeding attendance data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedAttendanceData();
