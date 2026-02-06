
import { AppError } from '../middlewares/errorHandler';
import { prisma } from '../utils/prisma';
import { CreateOrganizationInput, UpdateOrganizationInput } from '../utils/organization.validation';
import { CreateOrgAdminInput } from '../utils/validation';
import { hashPassword } from '../utils/password';

/**
 * Derive a short employee-code prefix from organization name (e.g. "BNC Motors" -> "BNC").
 * Used when creating an org so employee codes are per-organization by default.
 */
function deriveEmployeeIdPrefixFromName(name: string): string {
  const sanitized = (name || '')
    .trim()
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .toUpperCase();
  const firstWord = sanitized.split(/\s+/)[0] || '';
  if (firstWord.length >= 2 && firstWord.length <= 10) return firstWord;
  if (firstWord.length > 10) return firstWord.slice(0, 8);
  if (sanitized.length >= 2) return sanitized.slice(0, 4).replace(/\s/g, '');
  return 'EMP';
}

export class OrganizationService {
  /**
   * Create new organization.
   * Employee codes for this org are enabled by default: prefix from org name (or provided)
   * and starting number 1, so new employees get codes like BNC1, BNC2 for "BNC Motors".
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

    // If prefix left empty → suffix-only codes starting at 1000 (1000, 1001, 1002, …).
    // If prefix provided → prefix + number (e.g. BNC1, BNC2).
    const prefixProvided = data.employeeIdPrefix != null && String(data.employeeIdPrefix).trim() !== '';

    const prefix = prefixProvided
      ? (data.employeeIdPrefix?.trim() || deriveEmployeeIdPrefixFromName(data.name) || 'EMP')
      : null;
    const startingNumber = prefixProvided
      ? (data.employeeIdStartingNumber ?? 1)
      : (data.employeeIdStartingNumber ?? 1000); // empty prefix → suffix only, start at 1000

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
        employeeIdNextNumber: startingNumber,
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

    const { employeeIdStartingNumber, employeeIdPrefix, ...rest } = data;
    const updateData: Record<string, unknown> = {
      ...rest,
      fiscalYearStart: data.fiscalYearStart ? new Date(data.fiscalYearStart) : undefined,
    };
    if (employeeIdPrefix !== undefined) {
      updateData.employeeIdPrefix = employeeIdPrefix;
    }
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

  /**
   * Get biometric devices for an organization (devices whose company belongs to this org).
   */
  async getDevicesForOrganization(organizationId: string) {
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!organization) {
      throw new AppError('Organization not found', 404);
    }
    const devices = await prisma.biometricDevice.findMany({
      where: {
        company: {
          organizationId,
        },
      },
      include: {
        company: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return devices;
  }

  /**
   * Add a biometric device to an organization.
   * Uses or creates the org's company (one company per org).
   */
  async addDeviceToOrganization(
    organizationId: string,
    data: { serialNumber: string; name?: string }
  ) {
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!organization) {
      throw new AppError('Organization not found', 404);
    }
    const serialNumber = (data.serialNumber || '').trim();
    if (!serialNumber) {
      throw new AppError('Serial number is required', 400);
    }
    const existing = await prisma.biometricDevice.findUnique({
      where: { serialNumber },
    });
    if (existing) {
      throw new AppError(
        `A device with serial number "${serialNumber}" is already registered to another organization/company.`,
        400
      );
    }
    let company = await prisma.company.findFirst({
      where: { organizationId },
    });
    if (!company) {
      company = await prisma.company.create({
        data: {
          name: `${organization.name} Company`,
          organizationId,
        },
      });
    }
    const device = await prisma.biometricDevice.create({
      data: {
        companyId: company.id,
        serialNumber,
        name: (data.name || '').trim() || `Device ${serialNumber.slice(-6)}`,
        isActive: true,
      },
      include: {
        company: { select: { id: true, name: true } },
      },
    });
    return device;
  }
}

export const organizationService = new OrganizationService();
