import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function seedLeaveData() {
  console.log('🌱 Seeding Leave Management Data...\n');

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

    // Create Leave Types
    console.log('\n📋 Creating Leave Types...');
    const leaveTypes = [
      {
        name: 'Annual Leave',
        code: 'AL',
        description: 'Annual vacation leave',
        isPaid: true,
        defaultDaysPerYear: 20,
        maxCarryForward: 5,
        maxConsecutiveDays: 15,
        requiresDocument: false,
        requiresApproval: true,
        canBeNegative: false,
        accrualType: 'MONTHLY' as const,
        colorCode: '#3B82F6',
        isActive: true,
      },
      {
        name: 'Sick Leave',
        code: 'SL',
        description: 'Medical leave for illness',
        isPaid: true,
        defaultDaysPerYear: 10,
        maxCarryForward: 0,
        maxConsecutiveDays: 5,
        requiresDocument: true,
        requiresApproval: true,
        canBeNegative: false,
        accrualType: 'MONTHLY' as const,
        colorCode: '#EF4444',
        isActive: true,
      },
      {
        name: 'Casual Leave',
        code: 'CL',
        description: 'Casual leave for personal reasons',
        isPaid: true,
        defaultDaysPerYear: 12,
        maxCarryForward: 0,
        maxConsecutiveDays: 3,
        requiresDocument: false,
        requiresApproval: true,
        canBeNegative: false,
        accrualType: 'MONTHLY' as const,
        colorCode: '#10B981',
        isActive: true,
      },
      {
        name: 'Maternity Leave',
        code: 'ML',
        description: 'Maternity leave for female employees',
        isPaid: true,
        defaultDaysPerYear: 180,
        maxCarryForward: 0,
        maxConsecutiveDays: 180,
        requiresDocument: true,
        requiresApproval: true,
        canBeNegative: false,
        accrualType: 'NONE' as const,
        colorCode: '#F59E0B',
        isActive: true,
      },
      {
        name: 'Paternity Leave',
        code: 'PL',
        description: 'Paternity leave for male employees',
        isPaid: true,
        defaultDaysPerYear: 15,
        maxCarryForward: 0,
        maxConsecutiveDays: 15,
        requiresDocument: true,
        requiresApproval: true,
        canBeNegative: false,
        accrualType: 'NONE' as const,
        colorCode: '#8B5CF6',
        isActive: true,
      },
    ];

    const createdLeaveTypes = [];
    for (const lt of leaveTypes) {
      const existing = await prisma.leaveType.findUnique({
        where: { code: lt.code },
      });

      if (!existing) {
        const leaveType = await prisma.leaveType.create({
          data: {
            organizationId: org.id,
            ...lt,
            defaultDaysPerYear: lt.defaultDaysPerYear
              ? new Prisma.Decimal(lt.defaultDaysPerYear)
              : null,
            maxCarryForward: lt.maxCarryForward
              ? new Prisma.Decimal(lt.maxCarryForward)
              : null,
          },
        });
        createdLeaveTypes.push(leaveType);
        console.log(`  ✅ Created: ${leaveType.name} (${leaveType.code})`);
      } else {
        createdLeaveTypes.push(existing);
        console.log(`  ⏭️  Already exists: ${existing.name} (${existing.code})`);
      }
    }

    // Create Leave Policies
    console.log('\n📜 Creating Leave Policies...');
    
    // Annual Leave Policy
    const annualLeaveType = createdLeaveTypes.find(lt => lt.code === 'AL');
    if (annualLeaveType) {
      const annualPolicy = await prisma.leavePolicy.upsert({
        where: {
          id: '00000000-0000-0000-0000-000000000001',
        },
        update: {},
        create: {
          id: '00000000-0000-0000-0000-000000000001',
          organizationId: org.id,
          leaveTypeId: annualLeaveType.id,
          name: 'Annual Leave Policy',
          description: 'Standard annual leave policy',
          minServiceMonths: 0,
          accrualType: 'MONTHLY',
          accrualRate: new Prisma.Decimal(1.67), // 20 days / 12 months
          prorateOnJoining: true,
          prorateOnLeaving: true,
          allowCarryForward: true,
          maxCarryForwardDays: new Prisma.Decimal(5),
          carryForwardExpiryMonths: 3,
          requiresApproval: true,
          minDaysPerRequest: new Prisma.Decimal(0.5),
          maxDaysPerRequest: new Prisma.Decimal(15),
          advanceNoticeDays: 7,
          isActive: true,
        },
      });
      console.log(`  ✅ Created: ${annualPolicy.name}`);
    }

    // Create Sample Holidays
    console.log('\n🎉 Creating Sample Holidays...');
    const holidays = [
      {
        name: 'New Year',
        date: new Date('2026-01-01'),
        isOptional: false,
        description: 'New Year Day',
      },
      {
        name: 'Republic Day',
        date: new Date('2026-01-26'),
        isOptional: false,
        description: 'Republic Day of India',
      },
      {
        name: 'Independence Day',
        date: new Date('2026-08-15'),
        isOptional: false,
        description: 'Independence Day of India',
      },
      {
        name: 'Gandhi Jayanti',
        date: new Date('2026-10-02'),
        isOptional: false,
        description: 'Gandhi Jayanti',
      },
      {
        name: 'Diwali',
        date: new Date('2026-10-20'),
        isOptional: false,
        description: 'Diwali Festival',
      },
    ];

    for (const holiday of holidays) {
      const existing = await prisma.holiday.findFirst({
        where: {
          organizationId: org.id,
          date: holiday.date,
        },
      });

      if (!existing) {
        await prisma.holiday.create({
          data: {
            organizationId: org.id,
            ...holiday,
          },
        });
        console.log(`  ✅ Created: ${holiday.name} (${holiday.date.toISOString().split('T')[0]})`);
      } else {
        console.log(`  ⏭️  Already exists: ${holiday.name}`);
      }
    }

    console.log('\n✅ Leave Management seed data created successfully!');
    console.log(`\n📊 Summary:`);
    console.log(`   - Leave Types: ${createdLeaveTypes.length}`);
    console.log(`   - Leave Policies: 1`);
    console.log(`   - Holidays: ${holidays.length}`);
    console.log(`\n💡 You can now test leave management features!`);

  } catch (error: any) {
    console.error('❌ Error seeding leave data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedLeaveData();
