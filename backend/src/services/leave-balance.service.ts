import { AppError } from '../middlewares/errorHandler';
import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { QueryLeaveBalanceInput } from '../utils/leave.validation';
import {
  readEntitlementDaysForEmployeeYear,
  isAutoCreditApplicableToEmployee,
  doesAutoCreditSettingMatchLeaveType,
} from '../utils/auto-credit-entitlement';
import {
  getLeaveTypeIdsWithBalance,
  getLeaveTypeIdsWithAutoCreditAllowed,
} from '../utils/event-config';

export class LeaveBalanceService {
  private readonly hrEntryRequiredLeaveNameKeys = [
    'paternityleave',
    'marriageleave',
    'bereavementleave',
  ];

  private parseDateOnlyInput(value: string, field: 'fromDate' | 'toDate'): Date {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) {
      throw new AppError(`${field} must be in YYYY-MM-DD format`, 400);
    }
    const yyyy = Number(match[1]);
    const mm = Number(match[2]);
    const dd = Number(match[3]);
    const parsed = new Date(Date.UTC(yyyy, mm - 1, dd));
    if (
      parsed.getUTCFullYear() !== yyyy ||
      parsed.getUTCMonth() + 1 !== mm ||
      parsed.getUTCDate() !== dd
    ) {
      throw new AppError(`${field} must be a valid calendar date`, 400);
    }
    return parsed;
  }

  private normalizeKey(value: string | null | undefined): string {
    return (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  private isCarryForwardEligibleLeaveType(leaveType: {
    name?: string | null;
    code?: string | null;
  }): boolean {
    const code = (leaveType.code || '').trim().toUpperCase();
    const nameKey = this.normalizeKey(leaveType.name);
    return code === 'EL' || code === 'SL' || nameKey === 'earnedleave' || nameKey === 'sickleave';
  }

  private isForcedZeroOpeningLeaveType(leaveType: {
    name?: string | null;
    code?: string | null;
  }): boolean {
    void leaveType;
    return false;
  }

  private isHrEntryRequiredLeaveType(leaveType: {
    name?: string | null;
    code?: string | null;
  }): boolean {
    const nameKey = this.normalizeKey(leaveType.name);
    const codeKey = this.normalizeKey(leaveType.code);
    return this.hrEntryRequiredLeaveNameKeys.some((k) => nameKey.includes(k) || codeKey === k);
  }

  private async syncExistingAutoCreditBalances(params: {
    employee: {
      id: string;
      organizationId: string;
      paygroupId: string | null;
      departmentId: string | null;
      employeeCode: string;
      dateOfJoining: Date | null;
    };
    year: number;
    balances: Array<{
      id: string;
      employeeId: string;
      leaveTypeId: string;
      openingBalance: Prisma.Decimal;
      accrued: Prisma.Decimal;
      used: Prisma.Decimal;
      carriedForward: Prisma.Decimal;
      available: Prisma.Decimal;
      leaveType: {
        id: string;
        name: string;
        code: string | null;
        isPaid: boolean;
        defaultDaysPerYear: Prisma.Decimal | null;
        maxCarryForward: Prisma.Decimal | null;
        accrualType: string | null;
      };
    }>;
  }) {
    const { employee, year, balances } = params;
    if (balances.length === 0) return balances;

    const [autoCreditSettings, leaveTypeIdsWithAutoCreditAllowed] = await Promise.all([
      prisma.autoCreditSetting.findMany({
        where: {
          organizationId: employee.organizationId,
          effectiveDate: { lte: new Date(year, 11, 31) },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date(year, 0, 1) } }],
        },
        orderBy: [{ priority: 'asc' }, { effectiveDate: 'desc' }, { createdAt: 'desc' }],
        select: {
          eventType: true,
          displayName: true,
          paygroupId: true,
          departmentId: true,
          associate: true,
          autoCreditRule: true,
        },
      }),
      getLeaveTypeIdsWithAutoCreditAllowed(employee.organizationId),
    ]);

    const applicableSettings = autoCreditSettings.filter((s) =>
      isAutoCreditApplicableToEmployee(s, employee)
    );
    const dec = (n: number) => new Prisma.Decimal(n);

    const synced = await Promise.all(
      balances.map(async (bal) => {
        const carry = Number(bal.carriedForward ?? 0);
        const carryForwardAllowed = this.isCarryForwardEligibleLeaveType(bal.leaveType);
        const normalizedCarry = carryForwardAllowed ? Math.max(0, carry) : 0;
        const opening = Number(bal.openingBalance ?? 0);
        const accrued = Number(bal.accrued ?? 0);
        const used = Number(bal.used ?? 0);
        const forceZeroOpening = this.isForcedZeroOpeningLeaveType(bal.leaveType);
        const normalizedOpening = forceZeroOpening ? 0 : opening;
        const normalizedAccrued = forceZeroOpening ? 0 : accrued;

        if (!leaveTypeIdsWithAutoCreditAllowed.has(bal.leaveTypeId)) {
          const hasNoChange =
            Math.abs(carry - normalizedCarry) <= 0.0001 &&
            Math.abs(opening - normalizedOpening) <= 0.0001 &&
            Math.abs(accrued - normalizedAccrued) <= 0.0001;
          if (hasNoChange) return bal;
          const available = Math.max(0, normalizedOpening + normalizedCarry - used);
          const updated = await prisma.employeeLeaveBalance.update({
            where: { id: bal.id },
            data: {
              openingBalance: dec(normalizedOpening),
              accrued: dec(normalizedAccrued),
              carriedForward: dec(normalizedCarry),
              available: dec(available),
            },
            include: {
              leaveType: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  isPaid: true,
                  defaultDaysPerYear: true,
                  maxCarryForward: true,
                  accrualType: true,
                },
              },
            },
          });
          return updated;
        }

        let entitlement: number | null = null;
        for (const s of applicableSettings) {
          if (!doesAutoCreditSettingMatchLeaveType(s, bal.leaveType)) continue;
          const n = readEntitlementDaysForEmployeeYear(
            s.autoCreditRule,
            employee.dateOfJoining,
            year
          );
          if (n != null) {
            entitlement = n;
            break;
          }
        }
        if (entitlement == null && !forceZeroOpening) return bal;
        const effectiveEntitlement = forceZeroOpening ? 0 : (entitlement ?? opening);

        const changed =
          Math.abs(opening - effectiveEntitlement) > 0.0001 ||
          Math.abs(accrued - effectiveEntitlement) > 0.0001 ||
          Math.abs(carry - normalizedCarry) > 0.0001;
        if (!changed) return bal;

        const available = Math.max(0, effectiveEntitlement + normalizedCarry - used);
        const updated = await prisma.employeeLeaveBalance.update({
          where: { id: bal.id },
          data: {
            openingBalance: dec(effectiveEntitlement),
            accrued: dec(effectiveEntitlement),
            carriedForward: dec(normalizedCarry),
            available: dec(available),
          },
          include: {
            leaveType: {
              select: {
                id: true,
                name: true,
                code: true,
                isPaid: true,
                defaultDaysPerYear: true,
                maxCarryForward: true,
                accrualType: true,
              },
            },
          },
        });
        return updated;
      })
    );

    return synced;
  }

  /**
   * Get leave balance for employee. When creating new balances, entitlement is taken only from
   * Auto Credit / Rule settings that match the employee's department and paygroup.
   */
  async getBalance(query: QueryLeaveBalanceInput) {
    const { employeeId, year, leaveTypeId } = query;
    const currentYear = year ? parseInt(year) : new Date().getFullYear();

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        organizationId: true,
        paygroupId: true,
        departmentId: true,
        employeeCode: true,
        dateOfJoining: true,
      },
    });

    if (!employee) {
      throw new AppError('Employee not found', 404);
    }

    const where: Prisma.EmployeeLeaveBalanceWhereInput = {
      employeeId,
      year: currentYear,
    };

    if (leaveTypeId) {
      where.leaveTypeId = leaveTypeId;
    }

    const [leaveTypes, autoCreditSettings, leaveTypeIdsWithBalance, leaveTypeIdsWithAutoCreditAllowed, existingYearBalances] =
      await Promise.all([
        prisma.leaveType.findMany({
          where: { organizationId: employee.organizationId, isActive: true },
        }),
        prisma.autoCreditSetting.findMany({
          where: {
            organizationId: employee.organizationId,
            effectiveDate: { lte: new Date(currentYear, 11, 31) },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date(currentYear, 0, 1) } }],
          },
          orderBy: [{ priority: 'asc' }, { effectiveDate: 'desc' }, { createdAt: 'desc' }],
          select: {
            eventType: true,
            displayName: true,
            paygroupId: true,
            departmentId: true,
            associate: true,
            autoCreditRule: true,
          },
        }),
        getLeaveTypeIdsWithBalance(employee.organizationId),
        getLeaveTypeIdsWithAutoCreditAllowed(employee.organizationId),
        prisma.employeeLeaveBalance.findMany({
          where: { employeeId, year: currentYear },
          include: {
            leaveType: {
              select: {
                id: true,
                name: true,
                code: true,
                isPaid: true,
                defaultDaysPerYear: true,
                maxCarryForward: true,
                accrualType: true,
              },
            },
          },
          orderBy: {
            leaveType: {
              name: 'asc',
            },
          },
        }),
      ]);

    // Maintain balance only for leave types mapped to Leave components with hasBalance = true.
    const leaveTypesToCreateBalance = leaveTypes.filter((lt) => leaveTypeIdsWithBalance.has(lt.id));
    const existingLeaveTypeIds = new Set(existingYearBalances.map((b) => b.leaveTypeId));
    const missingLeaveTypes = leaveTypesToCreateBalance.filter((lt) => !existingLeaveTypeIds.has(lt.id));

    if (missingLeaveTypes.length > 0) {
      const applicableSettings = autoCreditSettings.filter((s) =>
        isAutoCreditApplicableToEmployee(s, employee)
      );

      const leaveTypeIdsWithAutoCreditInOrg = new Set<string>();
      for (const s of autoCreditSettings) {
        for (const lt of leaveTypes) {
          if (doesAutoCreditSettingMatchLeaveType(s, lt)) {
            leaveTypeIdsWithAutoCreditInOrg.add(lt.id);
          }
        }
      }

      // Only use auto credit entitlement for leave types whose event config has allowAutoCreditRule = true
      const entitlementByLeaveTypeId = new Map<string, number>();
      for (const lt of missingLeaveTypes) {
        if (!leaveTypeIdsWithAutoCreditAllowed.has(lt.id)) {
          const defaultDays = lt.defaultDaysPerYear ? Number(lt.defaultDaysPerYear) : 0;
          entitlementByLeaveTypeId.set(lt.id, defaultDays);
          continue;
        }
        for (const s of applicableSettings) {
          const n = readEntitlementDaysForEmployeeYear(
            s.autoCreditRule,
            employee.dateOfJoining,
            currentYear
          );
          if (n == null) continue;
          if (doesAutoCreditSettingMatchLeaveType(s, lt)) {
            entitlementByLeaveTypeId.set(lt.id, n);
            break;
          }
        }
      }

      await Promise.all(
        missingLeaveTypes.map(async (leaveType) => {
          const entitlement = entitlementByLeaveTypeId.get(leaveType.id);
          const hasAutoCreditInOrg = leaveTypeIdsWithAutoCreditInOrg.has(leaveType.id);
          const forceZeroOpening = this.isForcedZeroOpeningLeaveType(leaveType);
          const hrEntryRequired = this.isHrEntryRequiredLeaveType(leaveType);
          const days =
            forceZeroOpening || hrEntryRequired
              ? 0
              : entitlement != null
              ? entitlement
              : hasAutoCreditInOrg
                ? 0
                : leaveType.defaultDaysPerYear
                  ? Number(leaveType.defaultDaysPerYear)
                  : 0;
          const previousYearBalance = await prisma.employeeLeaveBalance.findUnique({
            where: {
              employeeId_leaveTypeId_year: {
                employeeId,
                leaveTypeId: leaveType.id,
                year: currentYear - 1,
              },
            },
            select: { available: true },
          });
          const carryForwardAllowed = this.isCarryForwardEligibleLeaveType(leaveType);
          const previousAvailable = carryForwardAllowed
            ? Math.max(0, Number(previousYearBalance?.available ?? 0))
            : 0;
          const maxCarryForward = carryForwardAllowed && leaveType.maxCarryForward != null
            ? Math.max(0, Number(leaveType.maxCarryForward))
            : null;
          const carryForward = carryForwardAllowed
            ? (maxCarryForward != null ? Math.min(previousAvailable, maxCarryForward) : previousAvailable)
            : 0;
          const available = Math.max(0, days + carryForward);
          const dec = (n: number) => new Prisma.Decimal(n);
          await prisma.employeeLeaveBalance.create({
            data: {
              employeeId,
              leaveTypeId: leaveType.id,
              year: currentYear,
              openingBalance: dec(days),
              accrued: dec(days),
              carriedForward: dec(carryForward),
              available: dec(available),
            },
          });
        })
      );
    }

    const balances = await prisma.employeeLeaveBalance.findMany({
      where,
      include: {
        leaveType: {
          select: {
            id: true,
            name: true,
            code: true,
            isPaid: true,
            defaultDaysPerYear: true,
            maxCarryForward: true,
            accrualType: true,
          },
        },
      },
      orderBy: {
        leaveType: {
          name: 'asc',
        },
      },
    });

    const syncedBalances = await this.syncExistingAutoCreditBalances({
      employee,
      year: currentYear,
      balances,
    });

    return {
      year: currentYear,
      employeeId,
      balances: syncedBalances,
    };
  }

  /**
   * Get leave calendar (all approved leaves for date range)
   */
  async getCalendar(organizationId: string, startDate: Date, endDate: Date, departmentId?: string) {
    const where: Prisma.LeaveRequestWhereInput = {
      status: 'APPROVED',
      employee: {
        organizationId,
        ...(departmentId && { departmentId }),
      },
      OR: [
        {
          AND: [
            { startDate: { lte: endDate } },
            { endDate: { gte: startDate } },
          ],
        },
      ],
    };

    const leaveRequests = await prisma.leaveRequest.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            employeeCode: true,
            department: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        leaveType: {
          select: {
            id: true,
            name: true,
            code: true,
            colorCode: true,
          },
        },
      },
      orderBy: {
        startDate: 'asc',
      },
    });

    return {
      startDate,
      endDate,
      leaveRequests,
    };
  }

  /**
   * Event Balance Entry list: returns one row per active employee for a leave type/year.
   * UI can edit opening days (manual override) for HR operations.
   */
  async getBalanceEntries(query: {
    organizationId: string;
    leaveTypeId: string;
    year: number;
  }) {
    const { organizationId, leaveTypeId, year } = query;

    const [leaveType, balances, leaveTypeIdsWithAutoCreditAllowed] = await Promise.all([
      prisma.leaveType.findFirst({
        where: { id: leaveTypeId, organizationId, isActive: true },
        select: { id: true, name: true, code: true },
      }),
      prisma.employeeLeaveBalance.findMany({
        where: { leaveTypeId, year, employee: { organizationId } },
        select: {
          id: true,
          employeeId: true,
          fromDate: true,
          toDate: true,
          openingBalance: true,
          used: true,
          available: true,
          carriedForward: true,
          accrued: true,
          createdAt: true,
          updatedAt: true,
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeCode: true,
            },
          },
        },
        orderBy: [{ employee: { firstName: 'asc' } }, { employee: { employeeCode: 'asc' } }],
      }),
      getLeaveTypeIdsWithAutoCreditAllowed(organizationId),
    ]);

    if (!leaveType) {
      throw new AppError('Leave type not found for organization', 404);
    }

    const forceZeroOpening = this.isForcedZeroOpeningLeaveType(leaveType);
    if (forceZeroOpening) {
      await prisma.employeeLeaveBalance.updateMany({
        where: { leaveTypeId, year, employee: { organizationId } },
        data: {
          openingBalance: new Prisma.Decimal(0),
          accrued: new Prisma.Decimal(0),
          carriedForward: new Prisma.Decimal(0),
          available: new Prisma.Decimal(0),
        },
      });
    }

    const fromDate = `${year}-01-01`;
    const toDate = `${year}-12-31`;
    const autoCreditEnabledForSelectedLeaveType = leaveTypeIdsWithAutoCreditAllowed.has(leaveTypeId);
    const entries = forceZeroOpening
      ? []
      : balances
          .filter((bal) => {
            // For auto-credit leave types, hide system-created rows and show manual edits only.
            // For non-auto-credit types (e.g., Marriage Leave), show entered rows normally.
            if (!autoCreditEnabledForSelectedLeaveType) return true;
            return new Date(bal.updatedAt).getTime() > new Date(bal.createdAt).getTime();
          })
          .map((bal) => {
            const openingDays = Number(bal.openingBalance ?? 0);
            const usedDays = Number(bal.used ?? 0);
            const availableDays = Number(bal.available ?? 0);
            return {
              employeeId: bal.employee.id,
              associate: `${bal.employee.firstName} ${bal.employee.lastName || ''}`.trim(),
              employeeCode: bal.employee.employeeCode,
              fromDate: bal.fromDate || fromDate,
              toDate: bal.toDate || toDate,
              openingDays,
              usedDays,
              availableDays,
              remarks: leaveType.name,
            };
          })
          .filter((row) => row.openingDays > 0 || row.usedDays > 0 || row.availableDays > 0);

    return {
      organizationId,
      leaveType,
      year,
      entries,
    };
  }

  /**
   * Event Balance Entry upsert: set opening days for employee/leaveType/year.
   */
  async upsertBalanceEntry(data: {
    organizationId: string;
    employeeId: string;
    leaveTypeId: string;
    year: number;
    openingDays: number;
    fromDate?: string;
    toDate?: string;
  }) {
    const { organizationId, employeeId, leaveTypeId, year, openingDays, fromDate, toDate } = data;

    const [employee, leaveType] = await Promise.all([
      prisma.employee.findFirst({
        where: { id: employeeId, organizationId },
        select: { id: true },
      }),
      prisma.leaveType.findFirst({
        where: { id: leaveTypeId, organizationId, isActive: true },
        select: { id: true, name: true, code: true },
      }),
    ]);

    if (!employee) throw new AppError('Employee not found in organization', 404);
    if (!leaveType) throw new AppError('Leave type not found in organization', 404);
    if (!Number.isFinite(openingDays) || openingDays < 0) {
      throw new AppError('Opening days must be a non-negative number', 400);
    }

    const parsedFromDate = this.parseDateOnlyInput(fromDate || `${year}-01-01`, 'fromDate');
    const parsedToDate = this.parseDateOnlyInput(toDate || `${year}-12-31`, 'toDate');
    if (parsedToDate < parsedFromDate) {
      throw new AppError('toDate must be on or after fromDate', 400);
    }
    if (parsedFromDate.getUTCFullYear() !== year || parsedToDate.getUTCFullYear() !== year) {
      throw new AppError('fromDate and toDate must be within the selected year', 400);
    }

    const effectiveOpeningDays = this.isForcedZeroOpeningLeaveType(leaveType) ? 0 : openingDays;

    const existing = await prisma.employeeLeaveBalance.findUnique({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId,
          leaveTypeId,
          year,
        },
      },
    });

    const dec = (n: number) => new Prisma.Decimal(n);

    if (!existing) {
      const created = await prisma.employeeLeaveBalance.create({
        data: {
          employeeId,
          leaveTypeId,
          year,
          fromDate: parsedFromDate,
          toDate: parsedToDate,
          openingBalance: dec(effectiveOpeningDays),
          accrued: dec(effectiveOpeningDays),
          used: dec(0),
          carriedForward: dec(0),
          available: dec(effectiveOpeningDays),
        },
      });
      const marked = await prisma.employeeLeaveBalance.update({
        where: { id: created.id },
        // Touch row so manual-only filters can reliably identify this as user-entered.
        data: { available: dec(effectiveOpeningDays) },
      });
      return { balance: marked };
    }

    const used = Number(existing.used ?? 0);
    const carry = Number(existing.carriedForward ?? 0);
    const effectiveCarry = this.isForcedZeroOpeningLeaveType(leaveType) ? 0 : carry;
    const nextAvailable = Math.max(0, effectiveOpeningDays + effectiveCarry - used);
    const updated = await prisma.employeeLeaveBalance.update({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId,
          leaveTypeId,
          year,
        },
      },
      data: {
        fromDate: parsedFromDate,
        toDate: parsedToDate,
        openingBalance: dec(effectiveOpeningDays),
        accrued: dec(effectiveOpeningDays),
        carriedForward: dec(effectiveCarry),
        available: dec(nextAvailable),
      },
    });

    return { balance: updated };
  }
}

export const leaveBalanceService = new LeaveBalanceService();
