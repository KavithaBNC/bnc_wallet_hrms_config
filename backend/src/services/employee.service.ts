
import { AppError } from '../middlewares/errorHandler';
import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { configPrisma } from '../utils/config-prisma';
import { configUsersService } from './config-users.service';
import { configAuthService } from './config-auth.service';
import { configOrgDataService } from './config-org-data.service';
import {
  CreateEmployeeInput,
  UpdateEmployeeInput,
  QueryEmployeesInput,
  RejoinEmployeeInput,
} from '../utils/employee.validation';
import { hashPassword } from '../utils/password';
import { config } from '../config/config';
import { emailService } from './email.service';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Enrich employee records with department/subDepartment/costCentre names from Config DB.
 * Replaces the HRMS department/costCentre FK joins with Config DB lookups.
 */
async function enrichWithConfigOrgData(employees: any[], organizationId?: string): Promise<void> {
  if (!employees.length) return;
  // Get configuratorCompanyId from organization
  const orgId = organizationId || employees[0]?.organizationId;
  if (!orgId) return;
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { configuratorCompanyId: true },
  });
  if (!org?.configuratorCompanyId) return;

  const companyId = org.configuratorCompanyId;

  // Collect unique configurator IDs
  const deptIds = new Set<number>();
  const subDeptIds = new Set<number>();
  const ccIds = new Set<number>();
  for (const emp of employees) {
    if (emp.departmentConfiguratorId) deptIds.add(emp.departmentConfiguratorId);
    if (emp.subDepartmentConfiguratorId) subDeptIds.add(emp.subDepartmentConfiguratorId);
    if (emp.costCentreConfiguratorId) ccIds.add(emp.costCentreConfiguratorId);
  }

  // Batch fetch from Config DB
  const [depts, subDepts, ccs] = await Promise.all([
    deptIds.size > 0 ? configOrgDataService.getDepartments(companyId) : [],
    subDeptIds.size > 0 ? configOrgDataService.getSubDepartments(companyId) : [],
    ccIds.size > 0 ? configOrgDataService.getCostCentres(companyId) : [],
  ]);

  const deptMap = new Map(depts.map((d: any) => [d.id, { id: d.id, name: d.name, code: d.code }]));
  const subDeptMap = new Map(subDepts.map((s: any) => [s.id, { id: s.id, name: s.name }]));
  const ccMap = new Map(ccs.map((c: any) => [c.id, { id: c.id, name: c.name, code: c.code }]));

  // Enrich each employee
  for (const emp of employees) {
    if (emp.departmentConfiguratorId && deptMap.has(emp.departmentConfiguratorId)) {
      emp.department = deptMap.get(emp.departmentConfiguratorId);
    }
    if (emp.subDepartmentConfiguratorId && subDeptMap.has(emp.subDepartmentConfiguratorId)) {
      emp.subDepartment = subDeptMap.get(emp.subDepartmentConfiguratorId);
    }
    if (emp.costCentreConfiguratorId && ccMap.has(emp.costCentreConfiguratorId)) {
      emp.costCentre = ccMap.get(emp.costCentreConfiguratorId);
    }
  }

  // Bulk import / free-text designation: show profileExtensions.designation when no JobPosition link
  for (const emp of employees) {
    const ext = emp.profileExtensions as Record<string, unknown> | null | undefined;
    const des =
      ext && typeof ext.designation === 'string' && ext.designation.trim() ? ext.designation.trim() : '';
    if (des && !(emp.position && (emp.position as { title?: string }).title)) {
      emp.position = {
        id: (emp.position as { id?: string } | null)?.id ?? null,
        title: des,
        code: (emp.position as { code?: string } | null)?.code ?? null,
        level: (emp.position as { level?: string } | null)?.level ?? null,
      };
    }
  }
}

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

    // Use raw query to find MAX numeric suffix efficiently instead of loading ALL employees
    const escapedPrefix = effectivePrefix.replace(/'/g, "''");
    const prefixLen = effectivePrefix.length;
    let maxNumber = 0;

    try {
      if (effectivePrefix) {
        // Find max number from codes matching PREFIX + digits pattern
        const result = await prisma.$queryRawUnsafe<{ max_num: number | null }[]>(
          `SELECT MAX(CAST(SUBSTRING("employeeCode", ${prefixLen + 1}) AS INTEGER)) as max_num
           FROM "Employee"
           WHERE "organizationId" = $1
             AND "employeeCode" LIKE $2
             AND SUBSTRING("employeeCode", ${prefixLen + 1}) ~ '^[0-9]+$'`,
          organizationId,
          `${escapedPrefix}%`
        );
        maxNumber = result[0]?.max_num ?? 0;
      } else {
        // No prefix: find max from purely numeric codes
        const result = await prisma.$queryRawUnsafe<{ max_num: number | null }[]>(
          `SELECT MAX(CAST("employeeCode" AS INTEGER)) as max_num
           FROM "Employee"
           WHERE "organizationId" = $1
             AND "employeeCode" ~ '^[0-9]+$'`,
          organizationId
        );
        maxNumber = result[0]?.max_num ?? 0;
      }
    } catch {
      // Fallback: if raw query fails, use a limited findMany approach
      const employees = await prisma.employee.findMany({
        where: {
          organizationId,
          ...(effectivePrefix ? { employeeCode: { startsWith: effectivePrefix } } : {}),
        },
        select: { employeeCode: true },
        orderBy: { employeeCode: 'desc' },
        take: 100,
      });
      const regex = effectivePrefix
        ? new RegExp(`^${effectivePrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)$`)
        : /^(\d+)$/;
      for (const emp of employees) {
        const match = emp.employeeCode.match(regex);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNumber && num <= 999999) maxNumber = num;
        }
      }
    }

    let nextNumber = maxNumber > 0 ? maxNumber + 1 : 1;
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
   * Lightweight list for searchable dropdown (reporting manager, etc.)
   */
  async list(organizationId: string, search?: string) {
    const where: any = { organizationId, employeeStatus: 'ACTIVE' };
    const searchTerm = (search || '').trim();
    if (searchTerm) {
      where.OR = [
        { firstName: { contains: searchTerm, mode: 'insensitive' } },
        { lastName: { contains: searchTerm, mode: 'insensitive' } },
        { employeeCode: { contains: searchTerm, mode: 'insensitive' } },
        { email: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }
    return prisma.employee.findMany({
      where,
      orderBy: { firstName: 'asc' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeCode: true,
        email: true,
      },
    });
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

    // Resolve departmentId — Config numeric ID stored directly, no HRMS department table
    let resolvedDepartmentId: string | null = null;
    let departmentConfiguratorId: number | null = null;
    if (data.departmentId) {
      if (UUID_REGEX.test(data.departmentId)) {
        resolvedDepartmentId = data.departmentId;
      } else {
        departmentConfiguratorId = parseInt(data.departmentId, 10);
      }
    }

    // Resolve costCentreId — Config numeric ID stored directly, no HRMS cost centre table
    let resolvedCostCentreId: string | null = null;
    let costCentreConfiguratorId: number | null = null;
    if (data.costCentreId) {
      if (UUID_REGEX.test(data.costCentreId)) {
        resolvedCostCentreId = data.costCentreId;
      } else {
        costCentreConfiguratorId = parseInt(data.costCentreId, 10);
      }
    }

    // Determine user role: prefer Config DB role_type, fallback to position title
    let userRole: 'EMPLOYEE' | 'HR_MANAGER' | 'MANAGER' | 'SUPER_ADMIN' | 'ORG_ADMIN' = 'EMPLOYEE';
    if (data.configuratorRoleId) {
      // Map from Config DB roles table role_type
      try {
        const roleRes = await configAuthService.getUserRole(data.configuratorRoleId);
        if (roleRes) {
          const roleType = (roleRes.role_type || '').trim().toUpperCase().replace(/\s+/g, '_');
          const roleTypeMap: Record<string, string> = {
            'EMPLOYEE': 'EMPLOYEE',
            'MANAGER': 'MANAGER',
            'HR_ADMIN': 'HR_MANAGER',
            'HR_MANAGER': 'HR_MANAGER',
            'SUPER_ADMIN': 'SUPER_ADMIN',
            'ORG_ADMIN': 'ORG_ADMIN',
          };
          const mapped = roleTypeMap[roleType];
          if (mapped) userRole = mapped as any;
        }
      } catch (err: any) {
        console.warn('Failed to map Config DB role_type during create:', err?.message);
      }
    } else if (data.positionId) {
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

      // Fallback: map position title to user role
      const title = position.title.toLowerCase();
      if (title.includes('hr admin') || title.includes('hr manager') || title.includes('hr administrator') ||
          title.includes('human resources manager') || title.includes('human resource manager')) {
        userRole = 'HR_MANAGER';
      } else if (title.includes('manager') && !title.includes('hr')) {
        userRole = 'MANAGER';
      } else if (title.includes('team lead') || title.includes('team leader') || title.includes('lead')) {
        userRole = 'MANAGER';
      }
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
        // Track raw password for welcome email and response
        let rawTempPassword = data.rawTemporaryPassword || `Temp@${Math.random().toString(36).slice(-8)}`;
        let passwordHash: string = data.encryptedPassword ?? await hashPassword(rawTempPassword);

        // Only call Configurator API from backend if frontend didn't already create the user
        if (configuratorUserId == null) {
          const orgForConfig = await prisma.organization.findUnique({
            where: { id: data.organizationId },
            select: { configuratorCompanyId: true },
          });
          if (orgForConfig?.configuratorCompanyId != null && createdByUserId) {
            try {
              // Direct Config DB access — no token needed
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
              // Resolve creator's configuratorUserId for created_by field
              let creatorConfigId: number | null = null;
              if (createdByUserId) {
                const creatorUser = await prisma.user.findUnique({
                  where: { id: createdByUserId },
                  select: { configuratorUserId: true, email: true },
                });
                creatorConfigId = creatorUser?.configuratorUserId ?? null;
              }
              const configUser = await configUsersService.createUser({
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
                code: employeeCode,
                created_by: creatorConfigId,
              });
              configuratorUserId = configUser.id;
              // Store the Config company ID on employee
              if (!data.configuratorCompanyId) {
                data.configuratorCompanyId = orgForConfig.configuratorCompanyId;
              }
              // Use encrypted_password from Config DB as the stored passwordHash
              if (configUser.encrypted_password) {
                passwordHash = configUser.encrypted_password;
              }
            } catch (err: any) {
              console.warn('Config user create failed:', err?.message);
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

    // Resolve reportingManagerConfiguratorUserId to HRMS employee ID if provided
    if (!data.reportingManagerId && data.reportingManagerConfiguratorUserId) {
      const managerEmp = await prisma.employee.findFirst({
        where: { configuratorUserId: data.reportingManagerConfiguratorUserId, organizationId: data.organizationId, deletedAt: null },
        select: { id: true },
      });
      if (managerEmp) {
        data.reportingManagerId = managerEmp.id;
      }
    }

    // Create employee record (exclude fields used only for Config API / User table, not Employee table)
    const { employeeCode: _, departmentId: __, costCentreId: ___, configuratorRoleId: _roleId, configuratorCompanyId: _companyId, configuratorUserId: _configUserId, encryptedPassword: _encPwd, rawTemporaryPassword: _rawPwd, reportingManagerConfiguratorUserId: _rmConfigId, ...employeeData } = data;

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
      branchConfiguratorId: data.branchConfiguratorId ?? undefined,
      workLocation: data.workLocation ?? undefined,
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

    // Sync employee code back to Config DB users.code
    // This handles the case where frontend pre-created the Config user (no code yet)
    // or backend auto-generated the code after Config user was created
    const finalConfigUserId = configuratorUserId ?? (employee as any).configuratorUserId ?? null;
    if (finalConfigUserId) {
      try {
        await configUsersService.updateUser(finalConfigUserId, { code: employee.employeeCode });
      } catch (err: any) {
        console.warn('[employee.create] Failed to sync employeeCode to Config DB users.code:', err?.message);
      }
    }

    // Send welcome email with credentials (fire-and-forget)
    const empEmail = employee.officialEmail || employee.email;
    const empName = employee.firstName || 'Employee';
    const tempPwd = (data as any).rawTemporaryPassword || '';
    if (empEmail && tempPwd) {
      emailService.sendEmployeeCredentialsEmail(empEmail, empName, empEmail, tempPwd).catch(() => {});
    }

    return { ...employee, temporaryPassword: tempPwd || undefined };
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

    // Enrich department/subDepartment/costCentre names from Config DB
    await enrichWithConfigOrgData(employees, query.organizationId || rbac?.organizationId);

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
            configuratorRoleId: true,
            configuratorUserId: true,
          },
        },
      },
    });

    if (!employee) {
      throw new AppError('Employee not found', 404);
    }

    // Enrich department/subDepartment/costCentre names from Config DB
    await enrichWithConfigOrgData([employee], employee.organizationId);

    const profileExtensions = (employee as { profileExtensions?: { academicQualifications?: unknown[]; previousEmployments?: unknown[]; familyMembers?: unknown[] } }).profileExtensions;
    return {
      ...employee,
      academicQualifications: Array.isArray(profileExtensions?.academicQualifications) ? profileExtensions.academicQualifications : [],
      previousEmployments: Array.isArray(profileExtensions?.previousEmployments) ? profileExtensions.previousEmployments : [],
      familyMembers: Array.isArray(profileExtensions?.familyMembers) ? profileExtensions.familyMembers : [],
    };
  }

  /**
   * Find employee by Configurator user_id.
   * Returns full employee data (same shape as getById) or null if not found.
   */
  async getByConfiguratorUserId(configuratorUserId: number) {
    const employee = await prisma.employee.findFirst({
      where: {
        configuratorUserId,
        deletedAt: null,
      },
      include: {
        organization: { select: { id: true, name: true } },
        paygroup: { select: { id: true, name: true, code: true } },
        department: { select: { id: true, name: true, code: true } },
        costCentre: { select: { id: true, name: true, code: true } },
        position: { select: { id: true, title: true, code: true, level: true, employmentType: true } },
        reportingManager: {
          select: {
            id: true, employeeCode: true, firstName: true, lastName: true, email: true,
            position: { select: { title: true } },
          },
        },
        entity: { select: { id: true, name: true, code: true } },
        location: { select: { id: true, name: true, code: true, entityId: true } },
        subordinates: {
          where: { deletedAt: null },
          select: {
            id: true, employeeCode: true, firstName: true, lastName: true, email: true,
            employeeStatus: true, position: { select: { title: true } },
          },
        },
        user: {
          select: { id: true, email: true, role: true, isActive: true, isEmailVerified: true, lastLoginAt: true, configuratorRoleId: true, configuratorUserId: true },
        },
      },
    });

    if (!employee) return null;

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

    // Resolve departmentId — Config numeric ID stored directly, no HRMS department table
    let resolvedDepartmentId: string | null | undefined = undefined;
    let departmentConfiguratorId: number | null | undefined = undefined;
    if (data.departmentId !== undefined) {
      if (!data.departmentId) {
        resolvedDepartmentId = null;
        departmentConfiguratorId = null;
      } else if (UUID_REGEX.test(data.departmentId)) {
        resolvedDepartmentId = data.departmentId;
      } else {
        departmentConfiguratorId = parseInt(data.departmentId, 10);
      }
    }

    // Resolve costCentreId — Config numeric ID stored directly, no HRMS cost centre table
    let resolvedCostCentreId: string | null | undefined = undefined;
    let costCentreConfiguratorId: number | null | undefined = undefined;
    if (data.costCentreId !== undefined) {
      if (!data.costCentreId) {
        resolvedCostCentreId = null;
        costCentreConfiguratorId = null;
      } else if (UUID_REGEX.test(data.costCentreId)) {
        resolvedCostCentreId = data.costCentreId;
      } else {
        costCentreConfiguratorId = parseInt(data.costCentreId, 10);
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

    // Resolve reportingManagerConfiguratorUserId to HRMS employee ID if no reportingManagerId given
    const rmConfigUserId = (data as any).reportingManagerConfiguratorUserId as number | undefined;
    if (!data.reportingManagerId && rmConfigUserId) {
      const managerEmp = await prisma.employee.findFirst({
        where: { configuratorUserId: rmConfigUserId, organizationId: existing.organizationId, deletedAt: null },
        select: { id: true },
      });
      if (managerEmp) {
        data.reportingManagerId = managerEmp.id;
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

    // Extract fields that are NOT Employee table columns before spreading into update payload
    const {
      role,
      departmentId: _deptId,
      costCentreId: _ccId,
      configuratorRoleId: _configRoleId,
      configuratorCompanyId: _companyId,
      ...employeeData
    } = data;
    // Also strip extra fields that may come from the frontend but aren't in the Employee model
    delete (employeeData as any).configuratorUserId;
    delete (employeeData as any).encryptedPassword;
    delete (employeeData as any).rawTemporaryPassword;
    delete (employeeData as any).reportingManagerConfiguratorUserId;
    delete (employeeData as any).organizationId;

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
      const orgForConfig = await prisma.organization.findUnique({
        where: { id: existing.organizationId },
        select: { configuratorCompanyId: true },
      });
      if (orgForConfig?.configuratorCompanyId != null) {
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
          // Direct Config DB access — no token needed
          // Only send fields that are explicitly changed (undefined = don't touch)
          const configUpdatePayload: any = {
            email: data.email ?? existing.email,
            first_name: data.firstName ?? existing.firstName,
            last_name: data.lastName ?? existing.lastName,
            phone: data.phone ?? existing.phone ?? '',
            company_id: orgForConfig.configuratorCompanyId,
            is_active: userForConfig.isActive ?? true,
          };
          // Only update manager_id if reporting manager was explicitly changed
          if (data.reportingManagerId !== undefined) {
            configUpdatePayload.manager_id = managerConfiguratorUserId;
          }
          if (data.configuratorRoleId != null) configUpdatePayload.role_id = data.configuratorRoleId;
          if (data.departmentConfiguratorId !== undefined) configUpdatePayload.department_id = data.departmentConfiguratorId;
          if (data.costCentreConfiguratorId !== undefined) configUpdatePayload.cost_centre_id = data.costCentreConfiguratorId;
          if (data.subDepartmentConfiguratorId !== undefined) configUpdatePayload.sub_department_id = data.subDepartmentConfiguratorId;
          await configUsersService.updateUser(userForConfig.configuratorUserId, configUpdatePayload);
        } catch (err: any) {
          console.warn('Config user update (PUT) failed:', err?.message);
        }
      }
    }

    // Resolve HRMS role: use explicit role from request, or map from Config DB role_type
    let resolvedRole = role;
    if (!resolvedRole && data.configuratorRoleId && existing.userId) {
      // Fetch role from Config DB roles table and use role_type for mapping
      try {
        const roleRes = await configAuthService.getUserRole(data.configuratorRoleId);
        if (roleRes) {
          const roleType = (roleRes.role_type || '').trim().toUpperCase().replace(/\s+/g, '_');
          // Map Config DB role_type to HRMS UserRole enum
          const roleTypeMap: Record<string, string> = {
            'EMPLOYEE': 'EMPLOYEE',
            'MANAGER': 'MANAGER',
            'HR_ADMIN': 'HR_MANAGER',
            'HR_MANAGER': 'HR_MANAGER',
            'SUPER_ADMIN': 'SUPER_ADMIN',
            'ORG_ADMIN': 'ORG_ADMIN',
          };
          const mapped = roleTypeMap[roleType];
          if (mapped) {
            const { UserRole } = await import('@prisma/client');
            const validRoles = Object.values(UserRole);
            if (validRoles.includes(mapped as any)) {
              resolvedRole = mapped as any;
            }
          }
        }
      } catch (err: any) {
        console.warn('Failed to fetch Config DB role for role_type mapping:', err?.message);
      }
    }

    // Update user role if resolved (only ORG_ADMIN and HR_MANAGER can do this)
    if (resolvedRole && existing.userId) {
      await prisma.user.update({
        where: { id: existing.userId },
        data: { role: resolvedRole },
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
      ...(data.branchConfiguratorId !== undefined && { branchConfiguratorId: data.branchConfiguratorId }),
      ...(data.workLocation !== undefined && { workLocation: data.workLocation }),
      positionId: employeeData.positionId ?? undefined,
      reportingManagerId: data.reportingManagerId ?? undefined,
      entityId: employeeData.entityId ?? undefined,
      ...(data.configuratorCompanyId != null && { configuratorCompanyId: data.configuratorCompanyId }),
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
  async delete(id: string, _requestingUserId?: string) {
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
        // Direct Config DB access — no token needed
        await configUsersService.deleteUser(configuratorUserId);
      } catch (err) {
        // Log but don't block the HRMS soft-delete if Configurator call fails
        console.error('[employeeService.delete] Config DB deleteUser failed:', err);
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
      // Direct Config DB access — no token needed
      try {
        await configUsersService.deleteUser(configuratorUserId);
      } catch (err) {
        console.error('[employeeService.deleteByConfiguratorUserId] Config DB deleteUser failed:', err);
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
  private async hasCircularReference(employeeId: string, managerId: string, depth: number = 0): Promise<boolean> {
    if (depth > 20) return false; // Prevent infinite recursion in deep hierarchies

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

    return this.hasCircularReference(employeeId, manager.reportingManagerId, depth + 1);
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
      take: 500,
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
        departmentConfiguratorId: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // For employees missing HRMS department, look up Config DB department name
    const missingDeptConfigIds = employees
      .filter((e) => !e.department?.name && e.departmentConfiguratorId)
      .map((e) => e.departmentConfiguratorId as number);
    let configDeptMap = new Map<number, string>();
    if (missingDeptConfigIds.length > 0) {
      try {
        const configDepts = await configPrisma.departments.findMany({
          where: { id: { in: missingDeptConfigIds } },
          select: { id: true, name: true },
        });
        configDeptMap = new Map(configDepts.map((d: any) => [d.id, d.name]));
      } catch { /* Config DB unavailable — ignore */ }
    }

    return employees.map((emp) => {
      const deptName = emp.department?.name
        || (emp.departmentConfiguratorId ? configDeptMap.get(emp.departmentConfiguratorId) : null)
        || 'N/A';
      return {
        id: emp.id,
        employeeCode: emp.employeeCode,
        name: `${emp.firstName} ${emp.lastName}`,
        email: emp.email,
        employeeStatus: emp.employeeStatus,
        organizationName: emp.organization?.name ?? null,
        department: deptName,
        position: emp.position?.title || 'N/A',
        role: emp.user?.role || 'N/A',
        isActive: emp.user?.isActive ?? false,
        isEmailVerified: emp.user?.isEmailVerified ?? false,
        accountCreated: emp.user?.createdAt || null,
      };
    });
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
