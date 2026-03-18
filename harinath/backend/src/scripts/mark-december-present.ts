/**
 * Script to mark Saravanan and Mani as present for all days in December
 * This is for testing payroll processing
 */

import { prisma } from '../utils/prisma';
import { AttendanceStatus } from '@prisma/client';

async function markDecemberPresent() {
  try {
    console.log('🔍 Finding employees: Saravanan and Mani...\n');

    // Find employees by first name (case-insensitive)
    const employees = await prisma.employee.findMany({
      where: {
        OR: [
          { firstName: { contains: 'Saravanan', mode: 'insensitive' } },
          { firstName: { contains: 'Mani', mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeCode: true,
        organizationId: true,
        shiftId: true,
      },
    });

    if (employees.length === 0) {
      console.log('❌ No employees found with names "Saravanan" or "Mani"');
      console.log('\n💡 Available employees:');
      const allEmployees = await prisma.employee.findMany({
        take: 10,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeCode: true,
        },
      });
      allEmployees.forEach((emp) => {
        console.log(`   - ${emp.firstName} ${emp.lastName} (${emp.employeeCode})`);
      });
      return;
    }

    console.log(`✅ Found ${employees.length} employee(s):`);
    employees.forEach((emp) => {
      console.log(`   - ${emp.firstName} ${emp.lastName} (${emp.employeeCode})`);
    });

    // December 2025 dates
    const year = 2025;
    const month = 11; // December (0-indexed, so 11 = December)
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0); // Last day of December

    console.log(`\n📅 Creating attendance records for December ${year}...`);
    console.log(`   Period: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}\n`);

    let totalCreated = 0;
    let totalUpdated = 0;

    for (const employee of employees) {
      console.log(`\n👤 Processing: ${employee.firstName} ${employee.lastName}`);

      // Get employee's shift for default check-in/check-out times
      let shift = null;
      if (employee.shiftId) {
        shift = await prisma.shift.findUnique({
          where: { id: employee.shiftId },
        });
      }

      // If no shift, get default shift (Morning Shift)
      if (!shift) {
        shift = await prisma.shift.findFirst({
          where: {
            organizationId: employee.organizationId,
            code: 'MORN',
          },
        });
      }

      // Default times if no shift found
      const defaultCheckIn = new Date(startDate);
      defaultCheckIn.setHours(9, 0, 0, 0); // 9:00 AM
      const defaultCheckOut = new Date(startDate);
      defaultCheckOut.setHours(18, 0, 0, 0); // 6:00 PM

      let created = 0;
      let updated = 0;

      // Create attendance for each day in December
      for (let day = 1; day <= endDate.getDate(); day++) {
        const date = new Date(year, month, day);
        date.setHours(0, 0, 0, 0);

        // Skip weekends (Saturday = 6, Sunday = 0)
        const dayOfWeek = date.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          continue; // Skip weekends
        }

        // Calculate check-in and check-out times
        let checkIn: Date | null = null;
        let checkOut: Date | null = null;

        if (shift) {
          const [startHour, startMin] = shift.startTime.split(':').map(Number);
          const [endHour, endMin] = shift.endTime.split(':').map(Number);

          checkIn = new Date(date);
          checkIn.setHours(startHour, startMin, 0, 0);

          checkOut = new Date(date);
          checkOut.setHours(endHour, endMin, 0, 0);

          // Handle overnight shifts
          if (endHour < startHour) {
            checkOut.setDate(checkOut.getDate() + 1);
          }
        } else {
          checkIn = new Date(defaultCheckIn);
          checkIn.setDate(day);
          checkOut = new Date(defaultCheckOut);
          checkOut.setDate(day);
        }

        // Calculate work hours (8 hours default)
        const workHours = shift ? Number(shift.workHours) : 8;

        try {
          const attendance = await prisma.attendanceRecord.upsert({
            where: {
              employeeId_date: {
                employeeId: employee.id,
                date: date,
              },
            },
            create: {
              employeeId: employee.id,
              shiftId: shift?.id || null,
              date: date,
              checkIn: checkIn,
              checkOut: checkOut,
              status: AttendanceStatus.PRESENT,
              workHours: workHours,
              totalHours: workHours,
              breakHours: shift && shift.breakDuration ? shift.breakDuration / 60 : 1, // Convert minutes to hours
            },
            update: {
              checkIn: checkIn,
              checkOut: checkOut,
              status: AttendanceStatus.PRESENT,
              workHours: workHours,
              totalHours: workHours,
              breakHours: shift && shift.breakDuration ? shift.breakDuration / 60 : 1,
            },
          });

          if (attendance.createdAt.getTime() === attendance.updatedAt.getTime()) {
            created++;
          } else {
            updated++;
          }
        } catch (error: any) {
          console.error(`   ⚠️  Error for ${date.toLocaleDateString()}: ${error.message}`);
        }
      }

      console.log(`   ✅ Created: ${created} records`);
      console.log(`   🔄 Updated: ${updated} records`);
      totalCreated += created;
      totalUpdated += updated;
    }

    console.log(`\n✅ Completed!`);
    console.log(`   Total created: ${totalCreated}`);
    console.log(`   Total updated: ${totalUpdated}`);
    console.log(`\n💡 You can now test payroll processing for December ${year}!`);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

markDecemberPresent()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
