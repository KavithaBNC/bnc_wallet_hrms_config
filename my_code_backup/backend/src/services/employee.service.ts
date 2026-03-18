
import { AppError } from '../middlewares/errorHandler';
import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { configuratorService } from './configurator.service';
import {
  CreateEmployeeInput,
  UpdateEmployeeInput,
  QueryEmployeesInput,
  RejoinEmployeeInput,
} from '../utils/employee.validation';
import { hashPassword } from '../utils/password';
import { config } from '../config/config';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
   * Create new employee.
   * When org has Config link: creates user in Config DB, stores in HRMS employee + user.
   * Resolves departmentId/costCentreId when they are Config ids (numeric string).
   */
  async create(data: CreateEmployeeInput, createdByUserId?: string) {
    console.log('[employeeService.create] Received Payload:', JSON.stringify({
      email: data.email,
      firstName: data.firstName,
      configuratorUserId: data.configuratorUserId,
      configuratorRoleId: data.configuratorRoleId,
      configuratorCompanyId: data.configuratorCompanyId,
      departmentConfiguratorId: data.departmentConfiguratorId,
      costCentreConfiguratorId: data.costCentreConfiguratorId,
      subDepartmentConfiguratorId: data.subDepartmentConfiguratorId,
    }));

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
      if (createdByUserId && createdByUserId !== existingUser.id) {
        throw new AppError('Email belongs to a different user account', 400);
      }
    }

    // Resolve departmentId when it's Config id (numeric string)
    let resolvedDepartmentId: string | null = null;
    let departmentConfiguratorId: number | null = null;
    if (data.departmentId) {
      if (UUID_REGEX.test(data.departmentId)) {
        const department = await prisma.department.findUnique({
          where: { id: data.departmentId },
        });
        if (!department || department.organizationId !== data.organizationId) {
          throw new AppError('Department not found or does not belong to this organization', 404);
        }
        resolvedDepartmentId = data.departmentId;
        departmentConfiguratorId = department.configuratorDepartmentId ?? null;
      } else {
        const configId = parseInt(data.departmentId, 10);
        const hrmsDept = await prisma.department.findFirst({
          where: { organizationId: data.organizationId, configuratorDepartmentId: configId },
        });
        if (!hrmsDept) {
          throw new AppError(
            'Department from Config not found in HRMS. Run sync:config-to-hrms to sync departments first.',
            404
          );
        }
        resolvedDepartmentId = hrmsDept.id;
        departmentConfiguratorId = configId;
      }
    }

    // Resolve costCentreId when it's Config id (numeric string)
    let resolvedCostCentreId: string | null = null;
    let costCentreConfiguratorId: number | null = null;
    if (data.costCentreId) {
      if (UUID_REGEX.test(data.costCentreId)) {
        const cc = await prisma.costCentre.findUnique({
          where: { id: data.costCentreId },
        });
        if (!cc || cc.organizationId !== data.organizationId) {
          throw new AppError('Cost centre not found or does not belong to this organization', 404);
        }
        resolvedCostCentreId = data.costCentreId;
        costCentreConfiguratorId = cc.configuratorCostCentreId ?? null;
      } else {
        const configId = parseInt(data.costCentreId, 10);
        const hrmsCc = await prisma.costCentre.findFirst({
          where: { organizationId: data.organizationId, configuratorCostCentreId: configId },
        });
        if (!hrmsCc) {
          throw new AppError(
            'Cost centre from Config not found in HRMS. Run sync:config-to-hrms to sync cost centres first.',
            404
          );
        }
        resolvedCostCentreId = hrmsCc.id;
        costCentreConfiguratorId = configId;
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

    // Create user account if not provided (existingUser = user with that email, no employee)
    let userAccountId = existingUser?.id;
    // Use configuratorUserId from frontend (already created via /api/v1/users/add) if provided
    let configuratorUserId: number | null = data.configuratorUserId ?? null;
    if (!userAccountId) {
      // Check if user already exists (should have been caught above, but double-check)
      const checkUser = await prisma.user.findUnique({
        where: { email: data.email },
      });

      if (checkUser) {
        userAccountId = checkUser.id;
        if (userRole !== 'EMPLOYEE' && checkUser.role !== 'SUPER_ADMIN' && checkUser.role !== 'ORG_ADMIN') {
          await prisma.user.update({
            where: { id: userAccountId },
            data: { role: userRole },
          });
        }
      } else {
        // Use encrypted_password from Configurator (passed by frontend) if available
        let passwordHash: string = data.encryptedPassword ?? await hashPassword(`Temp@${Math.random().toString(36).slice(-8)}`);

        // Only call Configurator API from backend if frontend didn't already create the user
        if (configuratorUserId == null) {
          const orgForConfig = await prisma.organization.findUnique({
            where: { id: data.organizationId },
            select: { configuratorCompanyId: true },
          });
          if (orgForConfig?.configuratorCompanyId != null && createdByUserId) {
            const tokenUser = await prisma.user.findUnique({
              where: { id: createdByUserId },
              select: { configuratorAccessToken: true },
            });
            if (tokenUser?.configuratorAccessToken) {
              try {
                // Resolve reporting manager's configuratorUserId for manager_id field
                let managerConfiguratorUserId: number | null = null;
                if (data.reportingManagerId) {
                  const managerEmp = await prisma.employee.findUnique({
                    where: { id: data.reportingManagerId },
                    select: { configuratorUserId: true },
                  });
                  managerConfiguratorUserId = managerEmp?.configuratorUserId ?? null;
                }
                const rawPassword = `Temp@${Math.random().toString(36).slice(-8)}`;
                const configUser = await configuratorService.createUser(tokenUser.configuratorAccessToken, {
                  email: data.email,
                  first_name: data.firstName,
                  last_name: data.lastName ?? 'N/A',
                  phone: data.phone ?? '',
                  company_id: orgForConfig.configuratorCompanyId,
                  project_id: config.configuratorHrmsProjectId || 0,
                  role_id: data.configuratorRoleId ?? 0,
                  cost_centre_id: data.costCentreConfiguratorId ?? 0,
                  department_id: data.departmentConfiguratorId ?? 0,
                  sub_department_id: data.subDepartmentConfiguratorId ?? 0,
                  password: rawPassword,
                  manager_id: managerConfiguratorUserId,
                });
                configuratorUserId = configUser.id;
                // Use encrypted_password from Configurator as the stored passwordHash
                if (configUser.encrypted_password) {
                  passwordHash = configUser.encrypted_password;
                }
              } catch (err: any) {
                console.warn('Config user create failed:', err?.response?.status, err?.response?.data ?? err?.message);
              }
            } else {
              console.warn('[EmployeeService] No configuratorAccessToken for user', createdByUserId, '— cannot create Configurator user');
            }
          }
        }

        const user = await prisma.user.create({
          data: {
            email: data.email,
            passwordHash,
            role: userRole,
            organizationId: data.organizationId,
            isActive: true,
            isEmailVerified: false,
            ...(configuratorUserId != null && { configuratorUserId }),
            ...(data.configuratorRoleId != null && { configuratorRoleId: data.configuratorRoleId }),
            ...(data.configuratorCompanyId != null && { configuratorCompanyId: data.configuratorCompanyId }),
          },
        });

        userAccountId = user.id;
      }
    }

    // Create employee record (exclude fields used only for Config API / User table, not Employee table)
    const { employeeCode: _, departmentId: __, costCentreId: ___, configuratorRoleId: _roleId, configuratorCompanyId: _companyId, configuratorUserId: _configUserId, encryptedPassword: _encPwd, ...employeeData } = data;

    const createPayload = (code: string) => ({
      ...employeeData,
      employeeCode: code,
      userId: userAccountId,
      configuratorUserId: configuratorUserId ?? undefined,
      departmentId: resolvedDepartmentId ?? undefined,
      costCentreId: resolvedCostCentreId ?? undefined,
      departmentConfiguratorId: departmentConfiguratorId ?? data.departmentConfiguratorId ?? undefined,
      costCentreConfiguratorId: costCentreConfiguratorId ?? data.costCentreConfiguratorId ?? undefined,
      subDepartmentConfiguratorId: data.subDepartmentConfiguratorId ?? undefined,
      configuratorCompanyId: data.configuratorCompanyId ?? undefined,
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
      costCentre: { select: { id: true, name: true, code: true } },
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

    return { ...employee };
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
        costCentre: { select: { id: true, name: true, code: true } },
        position: { select: { id: true, title: true, code: true } },
        reportingManager: {
          select: { id: true, employeeCode: true, firstName: true, lastName: true, email: true },
        },
        user: { select: { id: true, email: true, role: true, isActive: true, isEmailVerified: true } },
      },
    });

    return { ...employee };
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
        costCentre: { select: { id: true, name: true, code: true } },
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
        costCentre: { select: { id: true, name: true, code: true } },
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
        costCentre: {
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
   * Update employee. Same procedure as create: resolve Config ids, sync to Config user when name/email changes.
   */
  async update(id: string, data: UpdateEmployeeInput, updatedByUserId?: string) {
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

      // Update HRMS user email
      await prisma.user.update({
        where: { id: existing.userId },
        data: { email: data.email },
      });
    }

    // Resolve departmentId when it's Config id (numeric string)
    let resolvedDepartmentId: string | null | undefined = undefined;
    let departmentConfiguratorId: number | null | undefined = undefined;
    if (data.departmentId !== undefined) {
      if (!data.departmentId) {
        resolvedDepartmentId = null;
        departmentConfiguratorId = null;
      } else if (UUID_REGEX.test(data.departmentId)) {
        const department = await prisma.department.findUnique({
          where: { id: data.departmentId },
        });
        if (!department || department.organizationId !== existing.organizationId) {
          throw new AppError('Department not found or does not belong to this organization', 404);
        }
        resolvedDepartmentId = data.departmentId;
        departmentConfiguratorId = department.configuratorDepartmentId ?? null;
      } else {
        const configId = parseInt(data.departmentId, 10);
        const hrmsDept = await prisma.department.findFirst({
          where: { organizationId: existing.organizationId, configuratorDepartmentId: configId },
        });
        if (!hrmsDept) {
          throw new AppError(
            'Department from Config not found in HRMS. Run sync:config-to-hrms to sync departments first.',
            404
          );
        }
        resolvedDepartmentId = hrmsDept.id;
        departmentConfiguratorId = configId;
      }
    }

    // Resolve costCentreId when it's Config id (numeric string)
    let resolvedCostCentreId: string | null | undefined = undefined;
    let costCentreConfiguratorId: number | null | undefined = undefined;
    if (data.costCentreId !== undefined) {
      if (!data.costCentreId) {
        resolvedCostCentreId = null;
        costCentreConfiguratorId = null;
      } else if (UUID_REGEX.test(data.costCentreId)) {
        const cc = await prisma.costCentre.findUnique({
          where: { id: data.costCentreId },
        });
        if (!cc || cc.organizationId !== existing.organizationId) {
          throw new AppError('Cost centre not found or does not belong to this organization', 404);
        }
        resolvedCostCentreId = data.costCentreId;
        costCentreConfiguratorId = cc.configuratorCostCentreId ?? null;
      } else {
        const configId = parseInt(data.costCentreId, 10);
        const hrmsCc = await prisma.costCentre.findFirst({
          where: { organizationId: existing.organizationId, configuratorCostCentreId: configId },
        });
        if (!hrmsCc) {
          throw new AppError(
            'Cost centre from Config not found in HRMS. Run sync:config-to-hrms to sync cost centres first.',
            404
          );
        }
        resolvedCostCentreId = hrmsCc.id;
        costCentreConfiguratorId = configId;
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

    // Extract role and configuratorRoleId from data (for User / Config, not Employee)
    const { role, departmentId: _deptId, costCentreId: _ccId, configuratorRoleId: _configRoleId, ...employeeData } = data;

    // Update Config user (PUT /api/v1/users/{user_id}) when any relevant field changes
    const userForConfig = existing.userId ? await prisma.user.findUnique({
      where: { id: existing.userId },
      select: { configuratorUserId: true, isActive: true },
    }) : null;
    const configFieldsChanged = data.email != null || data.firstName != null || data.lastName != null ||
      data.phone != null || data.configuratorRoleId != null || data.departmentConfiguratorId != null ||
      data.costCentreConfiguratorId != null || data.subDepartmentConfiguratorId != null ||
      data.reportingManagerId !== undefined;
    if (userForConfig?.configuratorUserId != null && updatedByUserId && configFieldsChanged) {
      const tokenUser = await prisma.user.findUnique({
        where: { id: updatedByUserId },
        select: { configuratorAccessToken: true },
      });
      const orgForConfig = await prisma.organization.findUnique({
        where: { id: existing.organizationId },
        select: { configuratorCompanyId: true },
      });
      if (tokenUser?.configuratorAccessToken && orgForConfig?.configuratorCompanyId != null) {
        try {
          // Resolve reporting manager's configuratorUserId for manager_id field
          let managerConfiguratorUserId: number | null = null;
          if (data.reportingManagerId) {
            const managerEmp = await prisma.employee.findUnique({
              where: { id: data.reportingManagerId },
              select: { configuratorUserId: true },
            });
            managerConfiguratorUserId = managerEmp?.configuratorUserId ?? null;
          }
          await configuratorService.updateUser(tokenUser.configuratorAccessToken, userForConfig.configuratorUserId, {
            email: data.email ?? existing.email,
            first_name: data.firstName ?? existing.firstName,
            last_name: data.lastName ?? existing.lastName,
            phone: data.phone ?? existing.phone ?? '',
            company_id: orgForConfig.configuratorCompanyId,
            role_id: data.configuratorRoleId ?? 0,
            is_active: userForConfig.isActive ?? true,
            department_id: data.departmentConfiguratorId ?? null,
            cost_centre_id: data.costCentreConfiguratorId ?? null,
            sub_department_id: data.subDepartmentConfiguratorId ?? null,
            manager_id: managerConfiguratorUserId,
          });
        } catch (err: any) {
          console.warn('Config user update (PUT) failed:', err?.message);
        }
      }
    }

    // Extract role from data (it's for User, not Employee)

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
      ...(resolvedDepartmentId !== undefined && { departmentId: resolvedDepartmentId }),
      ...(departmentConfiguratorId !== undefined && { departmentConfiguratorId: departmentConfiguratorId }),
      ...(costCentreConfiguratorId !== undefined && { costCentreConfiguratorId: costCentreConfiguratorId }),
      ...(data.subDepartmentConfiguratorId !== undefined && { subDepartmentConfiguratorId: data.subDepartmentConfiguratorId }),
      positionId: employeeData.positionId ?? undefined,
      reportingManagerId: employeeData.reportingManagerId ?? undefined,
      entityId: employeeData.entityId ?? undefined,
      locationId: employeeData.locationId ?? undefined,
      ...(resolvedCostCentreId !== undefined && { costCentreId: resolvedCostCentreId }),
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
   * 1. Calls Configurator DELETE /api/v1/users/ { user_id }
   * 2. Sets configurator_active_status = false on both employees and users tables
   * 3. Sets deletedAt, employeeStatus = TERMINATED on employees table
   * 4. Sets isActive = false on users table
   */
  async delete(id: string, requestingUserId?: string) {
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
        user: { select: { id: true, configuratorUserId: true, configuratorAccessToken: true } },
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

    // Step 1: Call Configurator delete API if we have a configuratorUserId
    const configuratorUserId = employee.configuratorUserId ?? employee.user?.configuratorUserId;
    if (configuratorUserId) {
      try {
        // Get the requesting user's Configurator token for the API call
        let accessToken: string | null = null;
        if (requestingUserId) {
          const reqUser = await prisma.user.findUnique({
            where: { id: requestingUserId },
            select: { configuratorAccessToken: true },
          });
          accessToken = reqUser?.configuratorAccessToken ?? null;
        }
        if (!accessToken) {
          // Fall back to the employee's own token
          accessToken = employee.user?.configuratorAccessToken ?? null;
        }
        if (accessToken) {
          await configuratorService.deleteUser(accessToken, configuratorUserId);
        }
      } catch (err) {
        // Log but don't block the HRMS soft-delete if Configurator call fails
        console.error('[employeeService.delete] Configurator deleteUser failed:', err);
      }
    }

    // Step 2: Soft delete employee record + set configurator_active_status = false
    await prisma.employee.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        employeeStatus: 'TERMINATED',
        faceEncoding: Prisma.JsonNull,
        configuratorActiveStatus: false,
      },
    });

    // Step 3: Deactivate user account + set configurator_active_status = false
    await prisma.user.update({
      where: { id: employee.userId },
      data: {
        isActive: false,
        configuratorActiveStatus: false,
      },
    });

    return { message: 'Employee deleted successfully' };
  }

  /**
   * Delete employee by Configurator user_id (soft delete)
   * Looks up the HRMS employee via configuratorUserId, then runs the full delete flow.
   */
  async deleteByConfiguratorUserId(configuratorUserId: number, requestingUserId?: string) {
    const employee = await prisma.employee.findFirst({
      where: {
        configuratorUserId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!employee) {
      // Employee not in HRMS — still update users table by configuratorUserId
      await prisma.user.updateMany({
        where: { configuratorUserId },
        data: {
          isActive: false,
          configuratorActiveStatus: false,
        },
      });
      // Also call Configurator delete API
      if (requestingUserId) {
        const reqUser = await prisma.user.findUnique({
          where: { id: requestingUserId },
          select: { configuratorAccessToken: true },
        });
        if (reqUser?.configuratorAccessToken) {
          try {
            await configuratorService.deleteUser(reqUser.configuratorAccessToken, configuratorUserId);
          } catch (err) {
            console.error('[employeeService.deleteByConfiguratorUserId] Configurator deleteUser failed:', err);
          }
        }
      }
      return { message: 'User deactivated successfully' };
    }

    return this.delete(employee.id, requestingUserId);
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
