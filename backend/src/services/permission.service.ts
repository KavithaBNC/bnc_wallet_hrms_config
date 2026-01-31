
import { AppError } from '../middlewares/errorHandler';
import { Permission } from '@prisma/client';
import { prisma } from '../utils/prisma';

export interface CreatePermissionInput {
  name: string;
  resource: string;
  action: string;
  description?: string;
  module?: string;
}

export interface UpdatePermissionInput {
  name?: string;
  resource?: string;
  action?: string;
  description?: string;
  module?: string;
}

export class PermissionService {
  /**
   * Create a new permission
   */
  async create(data: CreatePermissionInput): Promise<Permission> {
    // Check if permission with same name already exists
    const existing = await prisma.permission.findUnique({
      where: { name: data.name },
    });

    if (existing) {
      throw new AppError('Permission with this name already exists', 400);
    }

    return prisma.permission.create({
      data: {
        name: data.name,
        resource: data.resource,
        action: data.action,
        description: data.description,
        module: data.module,
      },
    });
  }

  /**
   * Get all permissions with filtering
   */
  async getAll(query: {
    resource?: string;
    action?: string;
    module?: string;
    page?: string;
    limit?: string;
  }) {
    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '50');
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.resource) {
      where.resource = query.resource;
    }

    if (query.action) {
      where.action = query.action;
    }

    if (query.module) {
      where.module = query.module;
    }

    const [permissions, total] = await Promise.all([
      prisma.permission.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      prisma.permission.count({ where }),
    ]);

    return {
      permissions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get permission by ID
   */
  async getById(id: string): Promise<Permission> {
    const permission = await prisma.permission.findUnique({
      where: { id },
    });

    if (!permission) {
      throw new AppError('Permission not found', 404);
    }

    return permission;
  }

  /**
   * Update permission
   */
  async update(id: string, data: UpdatePermissionInput): Promise<Permission> {
    const permission = await this.getById(id);

    // Check if name is being changed and if it conflicts
    if (data.name && data.name !== permission.name) {
      const existing = await prisma.permission.findUnique({
        where: { name: data.name },
      });

      if (existing) {
        throw new AppError('Permission with this name already exists', 400);
      }
    }

    return prisma.permission.update({
      where: { id },
      data,
    });
  }

  /**
   * Delete permission
   */
  async delete(id: string): Promise<void> {
    await this.getById(id);

    // Check if permission is assigned to any role
    const rolePermissionCount = await prisma.rolePermission.count({
      where: { permissionId: id },
    });

    if (rolePermissionCount > 0) {
      throw new AppError(
        'Cannot delete permission. It is assigned to one or more roles.',
        400
      );
    }

    await prisma.permission.delete({
      where: { id },
    });
  }

  /**
   * Get permissions by resource
   */
  async getByResource(resource: string): Promise<Permission[]> {
    return prisma.permission.findMany({
      where: { resource },
      orderBy: { action: 'asc' },
    });
  }

  /**
   * Get permissions by module
   */
  async getByModule(module: string): Promise<Permission[]> {
    return prisma.permission.findMany({
      where: { module },
      orderBy: { resource: 'asc', action: 'asc' },
    });
  }

  /**
   * Ensure all app-module permissions exist (read, create, update). Creates missing ones.
   * Sync with frontend APP_MODULES. Returns count of newly created permissions.
   */
  async syncAppModulePermissions(): Promise<{ created: number }> {
    const appModuleResources = [
      'dashboard',
      'employees',
      'departments',
      'positions',
      'attendance',
      'leaves',
      'payroll',
      'employee_separations',
      'employee_rejoin',
      'salary_structures',
      'employee_salaries',
      'hr_audit_settings',
      'employee_master_approval',
      'organizations',
      'permissions',
    ];
    const actions = ['read', 'create', 'update'] as const;
    const actionDescriptions: Record<string, string> = {
      read: 'View',
      create: 'Add',
      update: 'Edit',
    };
    let created = 0;
    for (const resource of appModuleResources) {
      for (const action of actions) {
        const name = `${resource}.${action}`;
        const existing = await prisma.permission.findUnique({ where: { name } });
        if (!existing) {
          await prisma.permission.create({
            data: {
              name,
              resource,
              action,
              description: `${actionDescriptions[action] || action} ${resource.replace(/_/g, ' ')}`,
              module: 'App Module',
            },
          });
          created++;
        }
      }
    }
    return { created };
  }
}

export const permissionService = new PermissionService();
