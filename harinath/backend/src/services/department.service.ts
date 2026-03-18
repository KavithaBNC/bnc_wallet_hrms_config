import { AppError } from '../middlewares/errorHandler';
import { prisma } from '../utils/prisma';
import { configuratorService } from './configurator.service';
import {
  CreateDepartmentInput,
  UpdateDepartmentInput,
  QueryDepartmentsInput,
} from '../utils/department.validation';

export type ConfigSyncContext = { accessToken: string; companyId: number };

export class DepartmentService {
  /**
   * Create new department. Optionally sync to Config DB when configSync provided.
   */
  async create(data: CreateDepartmentInput, configSync?: ConfigSyncContext) {
    // Check if code is unique (if provided)
    if (data.code) {
      const existing = await prisma.department.findUnique({
        where: { code: data.code },
      });

      if (existing) {
        throw new AppError('Department code already exists', 400);
      }
    }

    // Check if parent department exists (if provided)
    if (data.parentDepartmentId) {
      const parent = await prisma.department.findUnique({
        where: { id: data.parentDepartmentId },
      });

      if (!parent) {
        throw new AppError('Parent department not found', 404);
      }

      // Check if parent belongs to same organization
      if (parent.organizationId !== data.organizationId) {
        throw new AppError('Parent department must belong to the same organization', 400);
      }
    }

    // Check if manager exists (if provided)
    if (data.managerId) {
      const manager = await prisma.employee.findUnique({
        where: { id: data.managerId },
      });

      if (!manager) {
        throw new AppError('Manager not found', 404);
      }

      if (manager.organizationId !== data.organizationId) {
        throw new AppError('Manager must belong to the same organization', 400);
      }
    }

    let configuratorDepartmentId: number | undefined;
    if (configSync) {
      try {
        const [manager, costCentre] = await Promise.all([
          data.managerId
            ? prisma.employee.findUnique({
                where: { id: data.managerId },
                select: { configuratorUserId: true },
              })
            : null,
          data.costCenter
            ? prisma.costCentre.findFirst({
                where: { organizationId: data.organizationId, code: data.costCenter },
                select: { configuratorCostCentreId: true },
              })
            : null,
        ]);
        const configDept = await configuratorService.createDepartment(configSync.accessToken, {
          name: data.name,
          code: data.code ?? undefined,
          company_id: configSync.companyId,
          cost_centre_id: (costCentre as any)?.configuratorCostCentreId ?? undefined,
          cost_centre_name: data.costCenter ?? undefined,
          description: data.description ?? undefined,
          manager_id: (manager as any)?.configuratorUserId ?? undefined,
          location: data.location ?? undefined,
        });
        configuratorDepartmentId = configDept.id;
      } catch (err: any) {
        console.warn('Config department create failed:', err?.message);
      }
    }

    const department = await prisma.department.create({
      data: {
        ...data,
        ...(configuratorDepartmentId != null && { configuratorDepartmentId }),
      },
      include: {
        organization: {
          select: { id: true, name: true, configuratorCompanyId: true },
        },
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            configuratorUserId: true,
          },
        },
        parentDepartment: {
          select: { id: true, name: true, configuratorDepartmentId: true },
        },
      },
    });

    return department;
  }

  /**
   * Get all departments. Config only - when org linked + token: Config API. Else: no data.
   * Never uses HRMS departments for list/dropdown.
   */
  async getAll(query: QueryDepartmentsInput, userId?: string) {
    if (query.organizationId && userId) {
      const org = await prisma.organization.findUnique({
        where: { id: query.organizationId },
        select: { configuratorCompanyId: true },
      });
      if (org?.configuratorCompanyId != null) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { configuratorAccessToken: true },
        });
        if (user?.configuratorAccessToken) {
          const configList = await configuratorService.getDepartments(user.configuratorAccessToken, {
            companyId: org.configuratorCompanyId,
          });
          const departments = configList.map((d: any) => ({
            id: String(typeof d === 'object' ? d.id : d),
            name: typeof d === 'object' ? (d.name ?? d.Name ?? '') : String(d),
            code: typeof d === 'object' ? (d.code ?? d.Code ?? '') : undefined,
          }));
          const total = departments.length;
          const limit = parseInt(query.limit || '100');
          const page = parseInt(query.page || '1');
          const skip = (page - 1) * limit;
          const paginated = departments.slice(skip, skip + limit);
          return {
            departments: paginated,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
          };
        }
      }
      // Config not available (org not linked or no token) → no data
      return { departments: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 0 } };
    }

    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '20');
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.organizationId) {
      where.organizationId = query.organizationId;
    }

    if (query.parentDepartmentId !== undefined) {
      where.parentDepartmentId = query.parentDepartmentId || null;
    }

    if (query.isActive) {
      where.isActive = query.isActive === 'true';
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const listView = query.listView === 'true';
    const include: any = listView
      ? {
          manager: { select: { id: true, firstName: true, lastName: true, email: true } },
          _count: { select: { employees: true, subDepartments: true } },
        }
      : {
          organization: { select: { id: true, name: true } },
          manager: { select: { id: true, firstName: true, lastName: true, email: true } },
          parentDepartment: { select: { id: true, name: true } },
          _count: { select: { employees: true, subDepartments: true } },
        };

    const [departments, total] = await Promise.all([
      prisma.department.findMany({
        where,
        include,
        skip,
        take: limit,
        orderBy: {
          [query.sortBy || 'name']: query.sortOrder || 'asc',
        },
      }),
      prisma.department.count({ where }),
    ]);

    return {
      departments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get department by ID
   */
  async getById(id: string) {
    const department = await prisma.department.findUnique({
      where: { id },
      include: {
        organization: {
          select: { id: true, name: true },
        },
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            employeeCode: true,
          },
        },
        parentDepartment: {
          select: { id: true, name: true, code: true },
        },
        subDepartments: {
          select: {
            id: true,
            name: true,
            code: true,
            isActive: true,
            _count: {
              select: { employees: true },
            },
          },
        },
        _count: {
          select: {
            employees: true,
            subDepartments: true,
            jobPositions: true,
          },
        },
      },
    });

    if (!department) {
      throw new AppError('Department not found', 404);
    }

    return department;
  }

  /**
   * Update department
   */
  async update(id: string, data: UpdateDepartmentInput) {
    const existing = await prisma.department.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppError('Department not found', 404);
    }

    // Check if code is unique (if provided and changed)
    if (data.code && data.code !== existing.code) {
      const duplicate = await prisma.department.findUnique({
        where: { code: data.code },
      });

      if (duplicate) {
        throw new AppError('Department code already exists', 400);
      }
    }

    // Check if parent department exists and prevent circular reference
    if (data.parentDepartmentId !== undefined) {
      if (data.parentDepartmentId) {
        const parent = await prisma.department.findUnique({
          where: { id: data.parentDepartmentId },
        });

        if (!parent) {
          throw new AppError('Parent department not found', 404);
        }

        // Prevent setting self as parent
        if (data.parentDepartmentId === id) {
          throw new AppError('Department cannot be its own parent', 400);
        }

        // Prevent circular reference by checking if the new parent is a descendant
        const isDescendant = await this.isDescendant(id, data.parentDepartmentId);
        if (isDescendant) {
          throw new AppError('Cannot set a descendant department as parent (circular reference)', 400);
        }
      }
    }

    // Check if manager exists (if provided)
    if (data.managerId) {
      const manager = await prisma.employee.findUnique({
        where: { id: data.managerId },
      });

      if (!manager) {
        throw new AppError('Manager not found', 404);
      }
    }

    const updated = await prisma.department.update({
      where: { id },
      data,
      include: {
        organization: {
          select: { id: true, name: true },
        },
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        parentDepartment: {
          select: { id: true, name: true },
        },
      },
    });

    return updated;
  }

  /**
   * Delete department
   */
  async delete(id: string) {
    const department = await prisma.department.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            employees: true,
            subDepartments: true,
          },
        },
      },
    });

    if (!department) {
      throw new AppError('Department not found', 404);
    }

    // Check if department has employees
    if (department._count.employees > 0) {
      throw new AppError(
        `Cannot delete department with ${department._count.employees} employee(s). Please reassign employees first.`,
        400
      );
    }

    // Check if department has sub-departments
    if (department._count.subDepartments > 0) {
      throw new AppError(
        `Cannot delete department with ${department._count.subDepartments} sub-department(s). Please delete or reassign sub-departments first.`,
        400
      );
    }

    await prisma.department.delete({
      where: { id },
    });

    return { message: 'Department deleted successfully' };
  }

  /**
   * Get department hierarchy (tree structure)
   */
  async getHierarchy(organizationId: string) {
    // Get all departments for the organization
    const departments = await prisma.department.findMany({
      where: { organizationId },
      include: {
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: { employees: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Build tree structure
    const buildTree = (parentId: string | null = null): any[] => {
      return departments
        .filter((dept) => dept.parentDepartmentId === parentId)
        .map((dept) => ({
          ...dept,
          children: buildTree(dept.id),
        }));
    };

    return buildTree();
  }

  /**
   * Check if department A is a descendant of department B
   */
  private async isDescendant(ancestorId: string, descendantId: string): Promise<boolean> {
    const descendant = await prisma.department.findUnique({
      where: { id: descendantId },
      select: { parentDepartmentId: true },
    });

    if (!descendant || !descendant.parentDepartmentId) {
      return false;
    }

    if (descendant.parentDepartmentId === ancestorId) {
      return true;
    }

    return this.isDescendant(ancestorId, descendant.parentDepartmentId);
  }
}

export const departmentService = new DepartmentService();
