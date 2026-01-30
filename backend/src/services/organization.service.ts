
import { AppError } from '../middlewares/errorHandler';
import { prisma } from '../utils/prisma';
import { CreateOrganizationInput, UpdateOrganizationInput } from '../utils/organization.validation';
import { CreateOrgAdminInput } from '../utils/validation';
import { hashPassword } from '../utils/password';

export class OrganizationService {
  /**
   * Create new organization
   */
  async create(data: CreateOrganizationInput) {
    // Check if taxId is unique (if provided)
    if (data.taxId) {
      const existing = await prisma.organization.findUnique({
        where: { taxId: data.taxId },
      });

      if (existing) {
        throw new AppError('Tax ID already exists', 400);
      }
    }

    const prefix = data.employeeIdPrefix?.trim() || (data.employeeIdStartingNumber != null ? 'EMP' : null);
    const startingNumber = data.employeeIdStartingNumber ?? 1;
    const useOrgEmployeeId = Boolean(prefix && (data.employeeIdPrefix != null || data.employeeIdStartingNumber != null));
    const organization = await prisma.organization.create({
      data: {
        name: data.name,
        legalName: data.legalName,
        industry: data.industry,
        sizeRange: data.sizeRange,
        taxId: data.taxId,
        registrationNumber: data.registrationNumber,
        website: data.website,
        address: data.address || {},
        timezone: data.timezone || 'UTC',
        currency: data.currency || 'USD',
        fiscalYearStart: data.fiscalYearStart ? new Date(data.fiscalYearStart) : undefined,
        settings: data.settings || {},
        employeeIdPrefix: prefix,
        employeeIdNextNumber: useOrgEmployeeId ? startingNumber : null,
      },
    });

    return organization;
  }

  /**
   * Get all organizations (for Super Admin)
   */
  async getAll(page: number = 1, limit: number = 20, search?: string) {
    const skip = (page - 1) * limit;

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { legalName: { contains: search, mode: 'insensitive' as const } },
            { industry: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [organizations, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              employees: true,
              departments: true,
            },
          },
        },
      }),
      prisma.organization.count({ where }),
    ]);

    return {
      organizations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get organization by ID
   */
  async getById(id: string) {
    const organization = await prisma.organization.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            departments: true,
            employees: true,
            jobPositions: true,
          },
        },
      },
    });

    if (!organization) {
      throw new AppError('Organization not found', 404);
    }

    return organization;
  }

  /**
   * Update organization
   */
  async update(id: string, data: UpdateOrganizationInput) {
    // Check if organization exists
    const existing = await prisma.organization.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppError('Organization not found', 404);
    }

    // Check if taxId is unique (if provided and changed)
    if (data.taxId && data.taxId !== existing.taxId) {
      const duplicate = await prisma.organization.findUnique({
        where: { taxId: data.taxId },
      });

      if (duplicate) {
        throw new AppError('Tax ID already exists', 400);
      }
    }

    const { employeeIdStartingNumber, ...rest } = data;
    const updateData: Record<string, unknown> = {
      ...rest,
      fiscalYearStart: data.fiscalYearStart ? new Date(data.fiscalYearStart) : undefined,
    };
    if (employeeIdStartingNumber !== undefined) {
      updateData.employeeIdNextNumber = employeeIdStartingNumber;
    }
    const updated = await prisma.organization.update({
      where: { id },
      data: updateData as Parameters<typeof prisma.organization.update>[0]['data'],
    });

    return updated;
  }

  /**
   * Update organization logo
   */
  async updateLogo(id: string, logoUrl: string) {
    const organization = await prisma.organization.findUnique({
      where: { id },
    });

    if (!organization) {
      throw new AppError('Organization not found', 404);
    }

    const updated = await prisma.organization.update({
      where: { id },
      data: { logoUrl },
    });

    return updated;
  }

  /**
   * Get organization statistics
   */
  async getStatistics(id: string) {
    const organization = await prisma.organization.findUnique({
      where: { id },
    });

    if (!organization) {
      throw new AppError('Organization not found', 404);
    }

    const [
      totalEmployees,
      activeEmployees,
      totalDepartments,
      totalPositions,
      recentHires,
    ] = await Promise.all([
      prisma.employee.count({
        where: { organizationId: id },
      }),
      prisma.employee.count({
        where: {
          organizationId: id,
          employeeStatus: 'ACTIVE',
        },
      }),
      prisma.department.count({
        where: { organizationId: id },
      }),
      prisma.jobPosition.count({
        where: { organizationId: id },
      }),
      prisma.employee.count({
        where: {
          organizationId: id,
          dateOfJoining: {
            gte: new Date(new Date().setMonth(new Date().getMonth() - 3)), // Last 3 months
          },
        },
      }),
    ]);

    return {
      totalEmployees,
      activeEmployees,
      totalDepartments,
      totalPositions,
      recentHires,
    };
  }

  /**
   * Create organization admin user
   * Only HRMS_ADMIN (SUPER_ADMIN) can create ORG_ADMIN users
   */
  async createAdmin(organizationId: string, data: CreateOrgAdminInput) {
    // Verify organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new AppError('Organization not found', 404);
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
      include: { employee: true },
    });

    if (existingUser) {
      // If user exists but doesn't have employee record, create it
      if (!existingUser.employee) {
        console.log(`⚠️  User ${data.email} exists but has no employee record. Creating employee record...`);
        
        // Generate unique employee code
        let employeeCode = `EMP${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        let codeExists = await prisma.employee.findUnique({
          where: { employeeCode },
        });
        
        while (codeExists) {
          employeeCode = `EMP${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          codeExists = await prisma.employee.findUnique({
            where: { employeeCode },
          });
        }

        // Create employee record
        const employee = await prisma.employee.create({
          data: {
            organizationId,
            employeeCode,
            userId: existingUser.id,
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            employeeStatus: 'ACTIVE',
            dateOfJoining: new Date(),
          },
        });

        return {
          user: {
            id: existingUser.id,
            email: existingUser.email,
            role: existingUser.role,
          },
          employee: {
            id: employee.id,
            employeeCode: employee.employeeCode,
            firstName: employee.firstName,
            lastName: employee.lastName,
          },
          organization: {
            id: organization.id,
            name: organization.name,
          },
        };
      }
      
      throw new AppError('User with this email already exists', 400);
    }

    // Use transaction to ensure both user and employee are created together
    return await prisma.$transaction(async (tx) => {
      // Hash password
      const passwordHash = await hashPassword(data.password);

      // Create user with ORG_ADMIN role
      const user = await tx.user.create({
        data: {
          email: data.email,
          passwordHash,
          role: 'ORG_ADMIN',
          organizationId: organizationId,
          isEmailVerified: true, // Auto-verify for org admin
          isActive: true,
        },
      });

      // Generate unique employee code
      let employeeCode = `EMP${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      let codeExists = await tx.employee.findUnique({
        where: { employeeCode },
      });
      
      while (codeExists) {
        employeeCode = `EMP${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        codeExists = await tx.employee.findUnique({
          where: { employeeCode },
        });
      }

      // Create employee record
      const employee = await tx.employee.create({
        data: {
          organizationId,
          employeeCode,
          userId: user.id,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          employeeStatus: 'ACTIVE',
          dateOfJoining: new Date(),
        },
      });

      console.log(`✅ Created ORG_ADMIN: ${user.email} with employee record (Org: ${organization.name})`);

      return {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
        employee: {
          id: employee.id,
          employeeCode: employee.employeeCode,
          firstName: employee.firstName,
          lastName: employee.lastName,
        },
        organization: {
          id: organization.id,
          name: organization.name,
        },
      };
    });
  }
}

export const organizationService = new OrganizationService();
