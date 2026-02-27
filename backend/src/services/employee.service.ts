
import { AppError } from '../middlewares/errorHandler';
import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import {
  CreateEmployeeInput,
  UpdateEmployeeInput,
  QueryEmployeesInput,
  RejoinEmployeeInput,
} from '../utils/employee.validation';
import { hashPassword } from '../utils/password';

export class EmployeeService {
  /**
   * Reserve next employee code from organization settings.
   * - If org has prefix + nextNumber: code = PREFIX + NUMBER (e.g. BNC1, BNC2).
   * - If org has nextNumber but no prefix (empty): code = NUMBER only (e.g. 1000, 1001).
   * - If org has no nextNumber: returns null (fallback to generateEmployeeCode).
   */
  private async reserveNextEmployeeCode(organizationId: string): Promise<string | null> {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { employeeIdPrefix: true, employeeIdNextNumber: true },
    });
    if (org?.employeeIdNextNumber == null) {
      return null;
    }
    const prefix = org.employeeIdPrefix?.trim() ?? '';
    return prisma.$transaction(async (tx) => {
      const row = await tx.organization.findUnique({
        where: { id: organizationId },
        select: { employeeIdNextNumber: true },
      });
      if (!row || row.employeeIdNextNumber == null) return null;
      const code = prefix === '' ? String(row.employeeIdNextNumber) : `${prefix}${row.employeeIdNextNumber}`;
      await tx.organization.update({
        where: { id: organizationId },
        data: { employeeIdNextNumber: row.employeeIdNextNumber + 1 },
      });
      return code;
    });
  }

  /**
   * Generate unique employee code with given prefix (fallback when org has no nextNumber set).
   * No padding: prefix '' → 3000, 3001; prefix 'BNC' → BNC3000, BNC3001 (matches reserve path).
   */
  private async generateEmployeeCodeWithPrefix(organizationId: string, prefix: string): Promise<string> {
    const effectivePrefix = (prefix ?? '').trim();
    const employees = await prisma.employee.findMany({
      where: {
        organizationId,
        ...(effectivePrefix ? { employeeCode: { startsWith: effectivePrefix } } : {}),
      },
      select: { employeeCode: true },
    });
    const regex = effectivePrefix
      ? new RegExp(`^${effectivePrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)$`)
      : /^(\d+)$/;
    const numbers = employees
      .map((emp) => {
        const match = emp.employeeCode.match(regex);
        if (match) {
          const num = parseInt(match[1], 10);
          return num > 0 && num <= 999999 ? num : 0;
        }
        return 0;
      })
      .filter((num) => num > 0);
    let nextNumber = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
    if (nextNumber > 999999) {
      return `${effectivePrefix || 'EMP'}${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    }
    const employeeCode = effectivePrefix ? `${effectivePrefix}${nextNumber}` : String(nextNumber);
    const existing = await prisma.employee.findUnique({ where: { employeeCode } });
    if (existing) {
      nextNumber++;
      if (nextNumber > 999999) {
        return `${effectivePrefix || 'EMP'}${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      }
      return effectivePrefix ? `${effectivePrefix}${nextNumber}` : String(nextNumber);
    }
    return employeeCode;
  }

  /**
   * Generate unique employee code (fallback when org has no prefix/nextNumber)
   * Format: EMP00001, EMP00002, etc.
   */
  private async generateEmployeeCode(organizationId: string): Promise<string> {
    return this.generateEmployeeCodeWithPrefix(organizationId, 'EMP');
  }

  /**
   * Create new employee
   */
  async create(data: CreateEmployeeInput, userId?: string) {
    // Generate employee code if not provided
    let employeeCode: string;
    
    if (data.employeeCode) {
      // User provided code - check if it's unique and not retired
      employeeCode = data.employeeCode.trim();
      const existingCode = await prisma.employee.findUnique({
        where: { employeeCode },
      });
      if (existingCode) {
        throw new AppError('Employee code already exists', 400);
      }
      const isRetired = await prisma.retiredEmployeeCode.findUnique({
        where: {
          organizationId_code: { organizationId: data.organizationId, code: employeeCode },
        },
      });
      if (isRetired) {
        throw new AppError('This employee code was previously assigned and cannot be reused', 400);
      }
    } else {
      // Try org-level prefix + next number first; else fallback to legacy EMP00001 format
      let generatedCode: string | null | undefined = await this.reserveNextEmployeeCode(data.organizationId);
      if (generatedCode) {
        const existingByCode = await prisma.employee.findUnique({
          where: { employeeCode: generatedCode },
        });
        const isRetired = await prisma.retiredEmployeeCode.findUnique({
          where: { organizationId_code: { organizationId: data.organizationId, code: generatedCode } },
        });
        if (existingByCode || isRetired) generatedCode = null; // already used or retired, fall through to get a different code
      }
      if (!generatedCode) {
        // Org has no next number set (or reserved code was taken). Use org's prefix if set; else EMP.
        const orgForPrefix = await prisma.organization.findUnique({
          where: { id: data.organizationId },
          select: { employeeIdPrefix: true },
        });
        const fallbackPrefix = orgForPrefix?.employeeIdPrefix?.trim() ?? 'EMP';
        let attempts = 0;
        const maxAttempts = 10;
        while (attempts < maxAttempts) {
          generatedCode = await this.generateEmployeeCodeWithPrefix(data.organizationId, fallbackPrefix);
          const existingCode = await prisma.employee.findUnique({
            where: { employeeCode: generatedCode },
          });
          const retiredCode = await prisma.retiredEmployeeCode.findUnique({
            where: { organizationId_code: { organizationId: data.organizationId, code: generatedCode } },
          });
          if (!existingCode && !retiredCode) break;
          attempts++;
          if (attempts >= maxAttempts) {
            generatedCode = `EMP${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
            const finalCheck = await prisma.employee.findUnique({
              where: { employeeCode: generatedCode },
            });
            const finalRetired = await prisma.retiredEmployeeCode.findUnique({
              where: { organizationId_code: { organizationId: data.organizationId, code: generatedCode } },
            });
            if (!finalCheck && !finalRetired) break;
            throw new AppError('Failed to generate unique employee code after multiple attempts', 500);
          }
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      }
      if (!generatedCode) {
        throw new AppError('Failed to generate employee code', 500);
      }
      employeeCode = generatedCode;
    }

    // Check if email already exists as an employee
    const existingEmployee = await prisma.employee.findUnique({
      where: { email: data.email },
      include: { user: true },
    });

    if (existingEmployee) {
      throw new AppError('An employee with this email already exists', 400);
    }

    // Check if organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: data.organizationId },
    });

    if (!organization) {
      throw new AppError('Organization not found', 404);
    }

    // Check if a user with this email already exists (but no employee record)
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
      include: { employee: true },
    });

    if (existingUser) {
      if (existingUser.employee) {
        throw new AppError('A user with this email already has an employee record', 400);
      }
      // User exists but no employee record - we'll link the employee to this user
      if (userId && userId !== existingUser.id) {
        throw new AppError('Email belongs to a different user account', 400);
      }
      // Use the existing user's ID
      if (!userId) {
        userId = existingUser.id;
      }
    }

    // Check if department exists (if provided)
    if (data.departmentId) {
      const department = await prisma.department.findUnique({
        where: { id: data.departmentId },
      });

      if (!department) {
        throw new AppError('Department not found', 404);
      }

      if (department.organizationId !== data.organizationId) {
        throw new AppError('Department must belong to the same organization', 400);
      }
    }

    // Check if position exists (if provided) and determine user role
    let userRole: 'EMPLOYEE' | 'HR_MANAGER' | 'MANAGER' = 'EMPLOYEE';
    if (data.positionId) {
      const position = await prisma.jobPosition.findUnique({
        where: { id: data.positionId },
        select: { title: true, organizationId: true },
      });

      if (!position) {
        throw new AppError('Position not found', 404);
      }

      if (position.organizationId !== data.organizationId) {
        throw new AppError('Position must belong to the same organization', 400);
      }

      // Map position title to user role
      const title = position.title.toLowerCase();
      if (title.includes('hr admin') || title.includes('hr manager') || title.includes('hr administrator') || 
          title.includes('human resources manager') || title.includes('human resource manager')) {
        userRole = 'HR_MANAGER';
      } else if (title.includes('manager') && !title.includes('hr')) {
        userRole = 'MANAGER';
      } else if (title.includes('team lead') || title.includes('team leader') || title.includes('lead')) {
        userRole = 'MANAGER'; // Team leads should be managers to see their team
      }
      // Default to EMPLOYEE for other positions
    }

    // Check if reporting manager exists (if provided)
    if (data.reportingManagerId) {
      const manager = await prisma.employee.findUnique({
        where: { id: data.reportingManagerId },
      });

      if (!manager) {
        throw new AppError('Reporting manager not found', 404);
      }

      if (manager.organizationId !== data.organizationId) {
        throw new AppError('Reporting manager must belong to the same organization', 400);
      }
    }

    // Create user account if userId not provided
    let userAccountId = userId;
    let temporaryPassword: string | null = null;
    if (!userAccountId) {
      // Check if user already exists (should have been caught above, but double-check)
      const checkUser = await prisma.user.findUnique({
        where: { email: data.email },
      });

      if (checkUser) {
        // User exists - use it (this handles the case where existingUser was found above)
        userAccountId = checkUser.id;
        
        // Update user role if it's determined by position (unless user is SUPER_ADMIN or ORG_ADMIN)
        if (userRole !== 'EMPLOYEE' && checkUser.role !== 'SUPER_ADMIN' && checkUser.role !== 'ORG_ADMIN') {
          await prisma.user.update({
            where: { id: userAccountId },
            data: { role: userRole },
          });
        }
      } else {
        // Generate default password (should be changed on first login)
        temporaryPassword = `Temp@${Math.random().toString(36).slice(-8)}`;
        const passwordHash = await hashPassword(temporaryPassword);

        const user = await prisma.user.create({
          data: {
            email: data.email,
            passwordHash,
            role: userRole,
            organizationId: data.organizationId,
            isActive: true,
            isEmailVerified: false,
          },
        });

        userAccountId = user.id;
        // TODO: Send welcome email with temporary password
      }
    }

    // Create employee record
    // Exclude employeeCode from data spread since we're setting it explicitly
    const { employeeCode: _, ...employeeData } = data;

    const createPayload = (code: string) => ({
      ...employeeData,
      employeeCode: code,
      userId: userAccountId,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
      dateOfJoining: new Date(data.dateOfJoining),
      probationEndDate: data.probationEndDate ? new Date(data.probationEndDate) : null,
      confirmationDate: data.confirmationDate ? new Date(data.confirmationDate) : null,
      dateOfLeaving: data.dateOfLeaving ? new Date(data.dateOfLeaving) : null,
      faceEncoding: data.faceEncoding != null ? (data.faceEncoding as object) : undefined,
      profileExtensions: data.profileExtensions != null ? (data.profileExtensions as Prisma.InputJsonValue) : undefined,
    });

    const include = {
      organization: { select: { id: true, name: true } },
      paygroup: { select: { id: true, name: true, code: true } },
      department: { select: { id: true, name: true, code: true } },
      position: { select: { id: true, title: true, code: true } },
      reportingManager: {
        select: { id: true, employeeCode: true, firstName: true, lastName: true, email: true },
      },
      user: {
        select: { id: true, email: true, role: true, isActive: true, isEmailVerified: true },
      },
    };

    let employee;
    try {
      employee = await prisma.employee.create({
        data: createPayload(employeeCode),
        include,
      });
    } catch (err: unknown) {
      const isUniqueEmployeeCode =
        err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === 'P2002' &&
        err && typeof err === 'object' && 'meta' in err &&
        (err as { meta?: { target?: string[] } }).meta?.target?.includes('employee_code');
      if (isUniqueEmployeeCode) {
        const fallbackCode = `EMP${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const exists = await prisma.employee.findUnique({ where: { employeeCode: fallbackCode } });
        if (exists) {
          throw new AppError('Employee code already exists. Please use a different code or leave it blank to auto-generate.', 400);
        }
        employee = await prisma.employee.create({
          data: createPayload(fallbackCode),
          include,
        });
      } else {
        throw err;
      }
    }

    // Return employee with temporary password if it was created
    return {
      ...employee,
      temporaryPassword, // Include temporary password in response (only when new user was created)
    };
  }

  /**
   * Rejoin: create a NEW employee record from a separated (resigned/terminated) employee.
   * Old record is unchanged. New record gets new employee code, new user (newLoginEmail), ACTIVE status.
   * @param allowedOrganizationId - If set (non-SUPER_ADMIN), previous employee must belong to this org.
   */
  async rejoin(data: RejoinEmployeeInput, allowedOrganizationId?: string) {
    const { previousEmployeeId, newJoiningDate, newLoginEmail } = data;

    const previous = await prisma.employee.findUnique({
      where: { id: previousEmployeeId },
      include: {
        user: { select: { id: true, role: true } },
        organization: { select: { id: true, employeeIdPrefix: true, employeeIdNextNumber: true } },
        department: true,
        position: true,
      },
    });

    if (!previous) {
      throw new AppError('Previous employee record not found', 404);
    }

    if (allowedOrganizationId && previous.organizationId !== allowedOrganizationId) {
      throw new AppError('You can only rejoin employees from your organization', 403);
    }

    const allowedStatuses = ['RESIGNED', 'TERMINATED'];
    if (!allowedStatuses.includes(previous.employeeStatus)) {
      throw new AppError(
        `Employee must be Resigned or Terminated to rejoin. Current status: ${previous.employeeStatus}`,
        400
      );
    }

    const existingByEmail = await prisma.employee.findUnique({
      where: { email: newLoginEmail },
    });
    if (existingByEmail) {
      throw new AppError('An employee with this login email already exists', 400);
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: newLoginEmail },
    });
    if (existingUser) {
      throw new AppError('A user with this email already exists. Use a different login email for the rejoin.', 400);
    }

    let employeeCode: string;
    const generatedCode = await this.reserveNextEmployeeCode(previous.organizationId);
    if (generatedCode) {
      employeeCode = generatedCode;
    } else {
      let attempts = 0;
      const maxAttempts = 10;
      let generated: string | null = null;
      while (attempts < maxAttempts) {
        const code = await this.generateEmployeeCode(previous.organizationId);
        const exists = await prisma.employee.findUnique({ where: { employeeCode: code } });
        if (!exists) {
          generated = code;
          break;
        }
        attempts++;
        await new Promise((r) => setTimeout(r, 10));
      }
      employeeCode = generated ?? `EMP${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    }

    let userRole: 'EMPLOYEE' | 'HR_MANAGER' | 'MANAGER' = 'EMPLOYEE';
    if (previous.positionId) {
      const position = await prisma.jobPosition.findUnique({
        where: { id: previous.positionId },
        select: { title: true },
      });
      if (position) {
        const title = position.title.toLowerCase();
        if (title.includes('hr admin') || title.includes('hr manager') || title.includes('hr administrator')) {
          userRole = 'HR_MANAGER';
        } else if (title.includes('manager') && !title.includes('hr')) {
          userRole = 'MANAGER';
        } else if (title.includes('team lead') || title.includes('team leader')) {
          userRole = 'MANAGER';
        }
      }
    }

    const temporaryPassword = `Temp@${Math.random().toString(36).slice(-8)}`;
    const passwordHash = await hashPassword(temporaryPassword);

    const newUser = await prisma.user.create({
      data: {
        email: newLoginEmail,
        passwordHash,
        role: userRole,
        organizationId: previous.organizationId,
        isActive: true,
        isEmailVerified: false,
      },
    });

    const newJoiningDateObj = new Date(newJoiningDate);

    // Prisma create expects undefined (not null) for optional JSON; copy non-null as-is
    const jsonOrUndef = (v: unknown) => (v == null ? undefined : v);

    const employee = await prisma.employee.create({
      data: {
        organizationId: previous.organizationId,
        paygroupId: previous.paygroupId,
        firstName: previous.firstName,
        middleName: previous.middleName,
        lastName: previous.lastName,
        personalEmail: previous.personalEmail,
        phone: previous.phone,
        officialEmail: previous.officialEmail,
        officialMobile: previous.officialMobile,
        dateOfBirth: previous.dateOfBirth,
        gender: previous.gender,
        maritalStatus: previous.maritalStatus,
        nationality: previous.nationality,
        profilePictureUrl: previous.profilePictureUrl,
        departmentId: previous.departmentId,
        positionId: previous.positionId,
        reportingManagerId: previous.reportingManagerId,
        shiftId: previous.shiftId,
        workLocation: previous.workLocation,
        locationId: previous.locationId,
        costCentreId: previous.costCentreId,
        grade: previous.grade,
        placeOfTaxDeduction: previous.placeOfTaxDeduction,
        jobResponsibility: previous.jobResponsibility,
        employmentType: previous.employmentType,
        probationEndDate: previous.probationEndDate,
        confirmationDate: previous.confirmationDate,
        address: jsonOrUndef(previous.address) as Prisma.InputJsonValue | undefined,
        emergencyContacts: jsonOrUndef(previous.emergencyContacts) as Prisma.InputJsonValue | undefined,
        bankDetails: jsonOrUndef(previous.bankDetails) as Prisma.InputJsonValue | undefined,
        taxInformation: jsonOrUndef(previous.taxInformation) as Prisma.InputJsonValue | undefined,
        documents: jsonOrUndef(previous.documents) as Prisma.InputJsonValue | undefined,
        entityId: previous.entityId,
        profileExtensions: jsonOrUndef(previous.profileExtensions) as Prisma.InputJsonValue | undefined,
        userId: newUser.id,
        employeeCode,
        email: newLoginEmail,
        dateOfJoining: newJoiningDateObj,
        employeeStatus: 'ACTIVE',
        dateOfLeaving: null,
        terminationReason: null,
        is_rejoin: true,
        previousEmployeeId: previous.id,
        previousEmployeeCode: previous.employeeCode,
      },
      include: {
        organization: { select: { id: true, name: true } },
        paygroup: { select: { id: true, name: true, code: true } },
        department: { select: { id: true, name: true, code: true } },
        position: { select: { id: true, title: true, code: true } },
        reportingManager: {
          select: { id: true, employeeCode: true, firstName: true, lastName: true, email: true },
        },
        user: { select: { id: true, email: true, role: true, isActive: true, isEmailVerified: true } },
      },
    });

    return { ...employee, temporaryPassword };
  }

  /**
   * Get all employees with filtering and pagination
   * Supports RBAC field-level filtering for performance
   * @param query - Query parameters including RBAC context
   * @param selectFields - Fields to select (RBAC optimized)
   * @param rbacContext - RBAC context from middleware (optional, can be passed via query)
   */
  async getAll(query: QueryEmployeesInput & { rbacContext?: any }, selectFields?: any) {
    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '20');
    const skip = (page - 1) * limit;
    const rbac = query.rbacContext;

    const where: Prisma.EmployeeWhereInput = {
      deletedAt: null, // Exclude soft-deleted employees
    };

    // RBAC: Apply organization-level filtering
    // For HR_MANAGER and ORG_ADMIN (canViewAll=true), show all employees in their organization
    // For other roles, also filter by organization
    if (rbac?.organizationId) {
      where.organizationId = rbac.organizationId;
    } else if (query.organizationId) {
      // Fallback to query parameter if RBAC context doesn't have organizationId
      where.organizationId = query.organizationId;
    }

    // RBAC: MANAGER visibility — only reporting employees + manager's own profile (so they can edit self)
    // HR Admin, Org Admin, Super Admin see all employees in the org
    if (rbac?.restrictToReports === true && query.managerEmployeeId) {
      where.AND = where.AND || [];
      (where.AND as object[]).push({
        OR: [
          { reportingManagerId: query.managerEmployeeId },
          { id: query.managerEmployeeId },
        ],
      });
    }

    // RBAC: EMPLOYEE can only see their own data (self-service)
    if (query.employeeId && rbac?.organizationId && !rbac?.canViewAll) {
      // For EMPLOYEE role, only return their own record
      where.id = query.employeeId;
      where.organizationId = rbac.organizationId;
    }

    if (query.departmentId) {
      where.departmentId = query.departmentId;
    }

    // RBAC: MANAGER with restrictToDepartment can only see their department
    // BUT: Only apply if restrictToReports is false OR if manager has no direct reports
    // This ensures managers with direct reports see them regardless of department
    if (
      rbac?.restrictToDepartment === true &&
      query.managerDepartmentId &&
      !(rbac?.restrictToReports === true && query.managerEmployeeId)
    ) {
      // Only apply department filter if NOT filtering by direct reports
      where.departmentId = query.managerDepartmentId;
    }

    if (query.positionId) {
      where.positionId = query.positionId;
    }

    if (query.entityId) {
      where.entityId = query.entityId;
    }

    if (query.paygroupId) {
      where.paygroupId = query.paygroupId;
    }

    if (query.reportingManagerId) {
      where.reportingManagerId = query.reportingManagerId;
    }

    if (query.employmentType) {
      where.employmentType = query.employmentType;
    }

    // Default to ACTIVE so main list shows only active employees; SEPARATED = resigned/terminated; ALL = no filter
    if (query.employeeStatus === 'SEPARATED') {
      where.employeeStatus = { in: ['RESIGNED', 'TERMINATED'] };
    } else if (query.employeeStatus && query.employeeStatus !== 'ALL') {
      where.employeeStatus = query.employeeStatus;
    } else if (!query.employeeStatus) {
      where.employeeStatus = 'ACTIVE';
    }
    // when employeeStatus === 'ALL', no status filter applied

    if (query.gender) {
      where.gender = query.gender;
    }

    if (query.search) {
      where.OR = [
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { employeeCode: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    // Build query with optional field selection for RBAC optimization
    const queryConfig: any = {
      where,
      skip,
      take: limit,
      orderBy: {
        [query.sortBy || 'firstName']: query.sortOrder || 'asc',
      },
    };

    const listView = (query as QueryEmployeesInput & { listView?: string }).listView === 'true';

    // List view: minimal relations (department, position, organization, entity, location, paygroup, shift, reportingManager)
    if (listView) {
      queryConfig.include = {
        department: { select: { id: true, name: true } },
        position: { select: { id: true, title: true, level: true } },
        organization: { select: { id: true, name: true } },
        entity: { select: { id: true, name: true, code: true } },
        location: { select: { id: true, name: true, code: true } },
        paygroup: { select: { id: true, name: true, code: true } },
        shift: { select: { id: true, name: true, code: true } },
        reportingManager: { select: { id: true, employeeCode: true, firstName: true, lastName: true, email: true } },
      };
    } else if (selectFields) {
      // Use select if provided (RBAC optimization)
      queryConfig.select = {
        ...selectFields,
        organization: { select: { id: true, name: true } },
        department: { select: { id: true, name: true, code: true } },
        position: { select: { id: true, title: true, code: true, level: true } },
      };
      if (selectFields.reportingManagerId) {
        queryConfig.select.reportingManager = {
          select: { id: true, employeeCode: true, firstName: true, lastName: true, email: true },
        };
      }
    } else {
      queryConfig.include = {
        organization: { select: { id: true, name: true } },
        department: { select: { id: true, name: true, code: true } },
        position: { select: { id: true, title: true, code: true, level: true } },
        paygroup: { select: { id: true, name: true, code: true } },
        shift: { select: { id: true, name: true, code: true } },
        reportingManager: {
          select: { id: true, employeeCode: true, firstName: true, lastName: true, email: true },
        },
      };
    }

    const [employees, total] = await Promise.all([
      prisma.employee.findMany(queryConfig),
      prisma.employee.count({ where }),
    ]);

    return {
      employees,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get employee by ID
   */
  async getById(id: string) {
    const employee = await prisma.employee.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        organization: {
          select: { id: true, name: true },
        },
        paygroup: {
          select: { id: true, name: true, code: true },
        },
        department: {
          select: { id: true, name: true, code: true },
        },
        position: {
          select: {
            id: true,
            title: true,
            code: true,
            level: true,
            employmentType: true,
          },
        },
        reportingManager: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            email: true,
            position: {
              select: { title: true },
            },
          },
        },
        entity: {
          select: { id: true, name: true, code: true },
        },
        location: {
          select: { id: true, name: true, code: true, entityId: true },
        },
        subordinates: {
          where: { deletedAt: null },
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            email: true,
            employeeStatus: true,
            position: {
              select: { title: true },
            },
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
            isEmailVerified: true,
            lastLoginAt: true,
          },
        },
      },
    });

    if (!employee) {
      throw new AppError('Employee not found', 404);
    }

    const profileExtensions = (employee as { profileExtensions?: { academicQualifications?: unknown[]; previousEmployments?: unknown[]; familyMembers?: unknown[] } }).profileExtensions;
    return {
      ...employee,
      academicQualifications: Array.isArray(profileExtensions?.academicQualifications) ? profileExtensions.academicQualifications : [],
      previousEmployments: Array.isArray(profileExtensions?.previousEmployments) ? profileExtensions.previousEmployments : [],
      familyMembers: Array.isArray(profileExtensions?.familyMembers) ? profileExtensions.familyMembers : [],
    };
  }

  /**
   * Update profile extensions (academicQualifications, previousEmployments, familyMembers).
   * Used when approving employee change requests. Merges with existing so only provided arrays are replaced.
   */
  async updateProfileExtensions(
    id: string,
    data: { academicQualifications?: unknown[]; previousEmployments?: unknown[]; familyMembers?: unknown[] }
  ) {
    const existing = await prisma.employee.findFirst({
      where: { id, deletedAt: null },
      select: { profileExtensions: true },
    });
    if (!existing) throw new AppError('Employee not found', 404);

    const current = (existing.profileExtensions as { academicQualifications?: unknown[]; previousEmployments?: unknown[]; familyMembers?: unknown[] } | null) || {};
    const payload = {
      academicQualifications: Array.isArray(data.academicQualifications) ? data.academicQualifications : current.academicQualifications,
      previousEmployments: Array.isArray(data.previousEmployments) ? data.previousEmployments : current.previousEmployments,
      familyMembers: Array.isArray(data.familyMembers) ? data.familyMembers : current.familyMembers,
    };
    if (!Array.isArray(payload.academicQualifications)) payload.academicQualifications = [];
    if (!Array.isArray(payload.previousEmployments)) payload.previousEmployments = [];
    if (!Array.isArray(payload.familyMembers)) payload.familyMembers = [];

    await prisma.employee.update({
      where: { id },
      data: { profileExtensions: payload as object },
    });
  }

  /**
   * Update employee
   */
  async update(id: string, data: UpdateEmployeeInput) {
    const existing = await prisma.employee.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!existing) {
      throw new AppError('Employee not found', 404);
    }

    // Check if employee code is unique and not retired (if changed)
    if (data.employeeCode && data.employeeCode !== existing.employeeCode) {
      const duplicate = await prisma.employee.findUnique({
        where: { employeeCode: data.employeeCode },
      });
      if (duplicate) {
        throw new AppError('Employee code already exists', 400);
      }
      const isRetired = await prisma.retiredEmployeeCode.findUnique({
        where: {
          organizationId_code: { organizationId: existing.organizationId, code: data.employeeCode.trim() },
        },
      });
      if (isRetired) {
        throw new AppError('This employee code was previously assigned and cannot be reused', 400);
      }
    }

    // When changing code, retire the old code so it is never assigned to anyone else
    if (data.employeeCode && data.employeeCode.trim() !== existing.employeeCode) {
      const oldCode = existing.employeeCode.trim();
      if (oldCode) {
        await prisma.retiredEmployeeCode.upsert({
          where: {
            organizationId_code: { organizationId: existing.organizationId, code: oldCode },
          },
          create: { organizationId: existing.organizationId, code: oldCode },
          update: {},
        });
      }
    }

    // Check if email is unique (if changed)
    if (data.email && data.email !== existing.email) {
      const duplicate = await prisma.employee.findUnique({
        where: { email: data.email },
      });

      if (duplicate) {
        throw new AppError('Email already exists', 400);
      }

      // Update user email as well
      await prisma.user.update({
        where: { id: existing.userId },
        data: { email: data.email },
      });
    }

    // Check if department exists (if provided)
    if (data.departmentId !== undefined && data.departmentId) {
      const department = await prisma.department.findUnique({
        where: { id: data.departmentId },
      });

      if (!department) {
        throw new AppError('Department not found', 404);
      }

      if (department.organizationId !== existing.organizationId) {
        throw new AppError('Department must belong to the same organization', 400);
      }
    }

    // Check if position exists (if provided)
    if (data.positionId !== undefined && data.positionId) {
      const position = await prisma.jobPosition.findUnique({
        where: { id: data.positionId },
      });

      if (!position) {
        throw new AppError('Position not found', 404);
      }

      if (position.organizationId !== existing.organizationId) {
        throw new AppError('Position must belong to the same organization', 400);
      }
    }

    // Check if reporting manager exists (if provided)
    if (data.reportingManagerId !== undefined && data.reportingManagerId) {
      const manager = await prisma.employee.findUnique({
        where: { id: data.reportingManagerId },
      });

      if (!manager) {
        throw new AppError('Reporting manager not found', 404);
      }

      if (manager.organizationId !== existing.organizationId) {
        throw new AppError('Reporting manager must belong to the same organization', 400);
      }

      // Prevent setting self as manager
      if (data.reportingManagerId === id) {
        throw new AppError('Employee cannot be their own manager', 400);
      }

      // Prevent circular reference
      const isCircular = await this.hasCircularReference(id, data.reportingManagerId);
      if (isCircular) {
        throw new AppError('Cannot set manager (circular reference detected)', 400);
      }
    }

    // Extract role from data (it's for User, not Employee)
    const { role, ...employeeData } = data;

    // Update user role if provided (only ORG_ADMIN and HR_MANAGER can do this)
    if (role && existing.userId) {
      await prisma.user.update({
        where: { id: existing.userId },
        data: { role },
      });
    }

    // Update employee (without role field). Use Unchecked type so relation IDs (paygroupId, etc.) are accepted.
    // Prisma Json fields require Prisma.JsonNull to set null, not plain null.
    const updatePayload: Prisma.EmployeeUncheckedUpdateInput = {
      ...employeeData,
      dateOfBirth: employeeData.dateOfBirth ? new Date(employeeData.dateOfBirth) : undefined,
      dateOfJoining: employeeData.dateOfJoining ? new Date(employeeData.dateOfJoining) : undefined,
      probationEndDate: employeeData.probationEndDate ? new Date(employeeData.probationEndDate) : undefined,
      confirmationDate: employeeData.confirmationDate ? new Date(employeeData.confirmationDate) : undefined,
      dateOfLeaving: employeeData.dateOfLeaving ? new Date(employeeData.dateOfLeaving) : undefined,
      paygroupId: employeeData.paygroupId ?? undefined,
      departmentId: employeeData.departmentId ?? undefined,
      positionId: employeeData.positionId ?? undefined,
      reportingManagerId: employeeData.reportingManagerId ?? undefined,
      entityId: employeeData.entityId ?? undefined,
      locationId: employeeData.locationId ?? undefined,
      costCentreId: employeeData.costCentreId ?? undefined,
      faceEncoding:
        employeeData.faceEncoding === null
          ? Prisma.JsonNull
          : (employeeData.faceEncoding ?? undefined),
      profileExtensions: employeeData.profileExtensions != null ? (employeeData.profileExtensions as Prisma.InputJsonValue) : undefined,
    };
    const updated = await prisma.employee.update({
      where: { id },
      data: updatePayload,
      include: {
        organization: {
          select: { id: true, name: true },
        },
        department: {
          select: { id: true, name: true, code: true },
        },
        position: {
          select: { id: true, title: true, code: true },
        },
        reportingManager: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return updated;
  }

  /**
   * Delete employee (soft delete)
   */
  async delete(id: string) {
    const employee = await prisma.employee.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        subordinates: {
          where: { deletedAt: null },
        },
        managedDepartments: true,
      },
    });

    if (!employee) {
      throw new AppError('Employee not found', 404);
    }

    // Check if employee has subordinates
    if (employee.subordinates.length > 0) {
      throw new AppError(
        `Cannot delete employee with ${employee.subordinates.length} subordinate(s). Please reassign subordinates first.`,
        400
      );
    }

    // Check if employee manages any departments
    if (employee.managedDepartments.length > 0) {
      throw new AppError(
        `Cannot delete employee who manages ${employee.managedDepartments.length} department(s). Please reassign department manager first.`,
        400
      );
    }

    // Soft delete: clear face encoding so "Face already registered" does not show if record is viewed later
    await prisma.employee.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        employeeStatus: 'TERMINATED',
        faceEncoding: Prisma.JsonNull,
      },
    });

    // Deactivate user account
    await prisma.user.update({
      where: { id: employee.userId },
      data: { isActive: false },
    });

    return { message: 'Employee deleted successfully' };
  }

  /**
   * Get employee hierarchy (reporting structure)
   */
  async getHierarchy(id: string) {
    const employee = await this.getById(id);

    // Get all subordinates recursively
    const buildTree = async (empId: string, level: number = 0): Promise<any> => {
      const emp = await prisma.employee.findFirst({
        where: {
          id: empId,
          deletedAt: null,
        },
        include: {
          position: {
            select: { title: true, level: true },
          },
          department: {
            select: { name: true },
          },
          subordinates: {
            where: { deletedAt: null },
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
              email: true,
              employeeStatus: true,
            },
          },
        },
      });

      if (!emp) return null;

      const children = await Promise.all(
        emp.subordinates.map((sub) => buildTree(sub.id, level + 1))
      );

      return {
        id: emp.id,
        employeeCode: emp.employeeCode,
        firstName: emp.firstName,
        lastName: emp.lastName,
        email: emp.email,
        position: emp.position,
        department: emp.department,
        employeeStatus: emp.employeeStatus,
        level,
        children: children.filter((c) => c !== null),
      };
    };

    const tree = await buildTree(id);

    return {
      employee,
      hierarchy: tree,
    };
  }

  /**
   * Check for circular reference in reporting hierarchy
   */
  private async hasCircularReference(employeeId: string, managerId: string): Promise<boolean> {
    const manager = await prisma.employee.findUnique({
      where: { id: managerId },
      select: { reportingManagerId: true },
    });

    if (!manager || !manager.reportingManagerId) {
      return false;
    }

    if (manager.reportingManagerId === employeeId) {
      return true;
    }

    return this.hasCircularReference(employeeId, manager.reportingManagerId);
  }

  /**
   * Get employee credentials for ORG_ADMIN / HR_MANAGER (one org) or SUPER_ADMIN (all orgs when organizationId omitted).
   * Returns list of employees with their emails and ability to reset passwords.
   */
  async getEmployeeCredentials(organizationId?: string) {
    const where: { deletedAt: null; organizationId?: string } = { deletedAt: null };
    if (organizationId) {
      where.organizationId = organizationId;
    }

    const employees = await prisma.employee.findMany({
      where,
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        email: true,
        employeeStatus: true,
        organizationId: true,
        organization: { select: { name: true } },
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
            isEmailVerified: true,
            createdAt: true,
          },
        },
        department: {
          select: {
            name: true,
          },
        },
        position: {
          select: {
            title: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return employees.map((emp) => ({
      id: emp.id,
      employeeCode: emp.employeeCode,
      name: `${emp.firstName} ${emp.lastName}`,
      email: emp.email,
      employeeStatus: emp.employeeStatus,
      organizationName: emp.organization?.name ?? null,
      department: emp.department?.name || 'N/A',
      position: emp.position?.title || 'N/A',
      role: emp.user?.role || 'N/A',
      isActive: emp.user?.isActive ?? false,
      isEmailVerified: emp.user?.isEmailVerified ?? false,
      accountCreated: emp.user?.createdAt || null,
    }));
  }

  /**
   * Get employee statistics
   */
  async getStatistics(organizationId: string) {
    const [
      totalEmployees,
      activeEmployees,
      employeesByDepartment,
      employeesByPosition,
      employeesByStatus,
      employeesByType,
      recentHires,
      upcomingProbationEnds,
    ] = await Promise.all([
      prisma.employee.count({
        where: {
          organizationId,
          deletedAt: null,
        },
      }),
      prisma.employee.count({
        where: {
          organizationId,
          deletedAt: null,
          employeeStatus: 'ACTIVE',
        },
      }),
      prisma.employee.groupBy({
        by: ['departmentId'],
        where: {
          organizationId,
          deletedAt: null,
        },
        _count: true,
      }),
      prisma.employee.groupBy({
        by: ['positionId'],
        where: {
          organizationId,
          deletedAt: null,
        },
        _count: true,
      }),
      prisma.employee.groupBy({
        by: ['employeeStatus'],
        where: {
          organizationId,
          deletedAt: null,
        },
        _count: true,
      }),
      prisma.employee.groupBy({
        by: ['employmentType'],
        where: {
          organizationId,
          deletedAt: null,
        },
        _count: true,
      }),
      prisma.employee.count({
        where: {
          organizationId,
          deletedAt: null,
          dateOfJoining: {
            gte: new Date(new Date().setMonth(new Date().getMonth() - 1)), // Last month
          },
        },
      }),
      prisma.employee.count({
        where: {
          organizationId,
          deletedAt: null,
          probationEndDate: {
            gte: new Date(),
            lte: new Date(new Date().setMonth(new Date().getMonth() + 1)), // Next month
          },
        },
      }),
    ]);

    return {
      totalEmployees,
      activeEmployees,
      employeesByDepartment,
      employeesByPosition,
      employeesByStatus,
      employeesByType,
      recentHires,
      upcomingProbationEnds,
    };
  }
}

export const employeeService = new EmployeeService();
