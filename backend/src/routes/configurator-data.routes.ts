/**
 * Routes for CRUD operations on the Config DB (Nemi_Config).
 * All calls use direct Prisma access — no RAG API tokens needed.
 * Frontend calls these instead of calling the RAG API directly.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middlewares/auth';
import { prisma } from '../utils/prisma';
import { configPrisma } from '../utils/config-prisma';
import { config } from '../config/config';
import { configOrgDataService } from '../services/config-org-data.service';
import { configUsersService } from '../services/config-users.service';
import { configAuthService } from '../services/config-auth.service';
import { configModulesService } from '../services/config-modules.service';
import { getDataScope } from '../utils/data-scope';
import { AppError } from '../middlewares/errorHandler';

const router = Router();

/**
 * Helper: resolve company_id from request → employee org → env default.
 */
async function resolveCompanyId(req: Request): Promise<number> {
  if (!req.user) throw new AppError('Not authenticated', 401);

  // 1. Explicit query/body param
  let companyId = Number(req.body?.company_id || req.query?.company_id) || 0;

  // 2. From employee → organization.configuratorCompanyId (HRMS DB)
  if (!companyId) {
    const employee = await prisma.employee.findFirst({
      where: { userId: req.user.userId },
      select: { organization: { select: { configuratorCompanyId: true } } },
    });
    companyId = employee?.organization?.configuratorCompanyId || 0;
  }

  // 3. From HRMS users.configuratorCompanyId (set at login)
  if (!companyId) {
    const hrmsUser = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { configuratorCompanyId: true, configuratorUserId: true },
    });
    companyId = hrmsUser?.configuratorCompanyId || 0;

    // 4. From Config DB users.company_id via configuratorUserId
    if (!companyId && hrmsUser?.configuratorUserId) {
      const configUser = await configPrisma.users.findUnique({
        where: { id: hrmsUser.configuratorUserId },
        select: { company_id: true },
      });
      companyId = configUser?.company_id || 0;
    }
  }

  // 5. Header fallback
  if (!companyId) {
    const headerVal = req.headers['x-configurator-company-id'];
    if (headerVal) companyId = Number(headerVal) || 0;
  }

  if (!companyId) {
    throw new AppError('Could not determine company_id. Ensure your organization is linked.', 400);
  }

  return companyId;
}

// ─── COMPANY VERIFY ──────────────────────────────────────────────────────────

/**
 * POST /api/v1/configurator-data/verify-company
 * Verify company exists in Config DB (replaces RAG POST /api/v1/auth/login step-1)
 */
router.post('/verify-company', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { company_name_or_code } = req.body;
    if (!company_name_or_code?.trim()) {
      throw new AppError('company_name_or_code is required', 400);
    }
    const result = await configAuthService.verifyCompany(company_name_or_code.trim());
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

// ─── USERS ──────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/configurator-data/users
 * List all Config DB users for the company (active + inactive).
 * Query: ?inactive=true for inactive users only.
 */
router.get('/users', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Not authenticated', 401);

    const companyId = await resolveCompanyId(req);
    const employee = await prisma.employee.findFirst({
      where: { userId: req.user.userId },
      select: { id: true, configuratorUserId: true },
    });

    const users = await configUsersService.getUsers(companyId);

    const inactive = req.query.inactive === 'true';
    let filtered = inactive
      ? users.filter((u: any) => !u.is_active)
      : users;

    // RBAC: Scope data based on permission level
    const scope = getDataScope(req.user.userId, '/employees');
    const configUserId = employee?.configuratorUserId ?? null;
    console.log('[configurator-data/users] RBAC scope:', scope, '| configUserId:', configUserId);

    if (scope === 'self' && configUserId != null) {
      // Employee role: see only own record
      filtered = filtered.filter((u: any) => u.id === configUserId);
    } else if (scope === 'team' && employee?.id) {
      // Manager role: see only direct reports + self
      const reportees = await prisma.employee.findMany({
        where: { reportingManagerId: employee.id, deletedAt: null },
        select: { configuratorUserId: true },
      });
      const allowedConfigIds = new Set<number>(
        reportees.map((r) => r.configuratorUserId).filter((id): id is number => id != null)
      );
      // Include manager's own record
      if (configUserId != null) allowedConfigIds.add(configUserId);
      filtered = filtered.filter((u: any) => allowedConfigIds.has(u.id));
    } else {
      // HR/Admin (org scope): see all, exclude self
      if (configUserId != null) {
        filtered = filtered.filter((u: any) => u.id !== configUserId);
      }
    }

    // Enrich with HRMS employee data for sub_department/cost_centre/paygroup/entity.
    const allConfigIds = (filtered as any[]).map((u: any) => u.id as number);

    let hrmsMap = new Map<number, any>();
    if (allConfigIds.length > 0) {
      const hrmsEmployees = await prisma.employee.findMany({
        where: { configuratorUserId: { in: allConfigIds } },
        select: {
          configuratorUserId: true,
          subDepartmentConfiguratorId: true,
          costCentreConfiguratorId: true,
          departmentConfiguratorId: true,
          paygroup: { select: { id: true, name: true, code: true } },
          entity: { select: { id: true, name: true, code: true } },
        },
      });
      hrmsMap = new Map(hrmsEmployees.filter((e) => e.configuratorUserId != null).map((e) => [e.configuratorUserId as number, e]));

      // Collect any extra sub_dept / cc IDs that are missing from Config user data
      const extraSubDeptIds = new Set<number>();
      const extraCcIds = new Set<number>();
      for (const u of filtered as any[]) {
        const hrms = hrmsMap.get(u.id);
        if (hrms) {
          if (!u.sub_department_id && hrms.subDepartmentConfiguratorId) {
            extraSubDeptIds.add(hrms.subDepartmentConfiguratorId);
          }
          if (!u.cost_centre_id && hrms.costCentreConfiguratorId) {
            extraCcIds.add(hrms.costCentreConfiguratorId);
          }
        }
      }

      // Batch fetch the extra names from Config DB
      const [extraSubDepts, extraCcs] = await Promise.all([
        extraSubDeptIds.size > 0
          ? configPrisma.sub_departments.findMany({ where: { id: { in: Array.from(extraSubDeptIds) } }, select: { id: true, name: true, code: true } })
          : [],
        extraCcIds.size > 0
          ? configPrisma.cost_centres.findMany({ where: { id: { in: Array.from(extraCcIds) } }, select: { id: true, name: true, code: true } })
          : [],
      ]);
      const extraSubDeptMap = new Map(extraSubDepts.map((s: any) => [s.id, s]));
      const extraCcMap = new Map(extraCcs.map((c: any) => [c.id, c]));

      // Merge HRMS data into Config user objects
      for (const u of filtered as any[]) {
        const hrms = hrmsMap.get(u.id);
        if (!hrms) continue;
        if (!u.sub_department && hrms.subDepartmentConfiguratorId) {
          u.sub_department = extraSubDeptMap.get(hrms.subDepartmentConfiguratorId) ?? null;
          if (!u.sub_department_id) u.sub_department_id = hrms.subDepartmentConfiguratorId;
        }
        if (!u.cost_centre && hrms.costCentreConfiguratorId) {
          u.cost_centre = extraCcMap.get(hrms.costCentreConfiguratorId) ?? null;
          if (!u.cost_centre_id) u.cost_centre_id = hrms.costCentreConfiguratorId;
        }
        if (!u.department && hrms.departmentConfiguratorId) {
          if (!u.department_id) u.department_id = hrms.departmentConfiguratorId;
        }
      }
    }

    // Normalize to ConfigUser shape expected by frontend
    const normalized = (filtered as any[]).map((u: any) => {
      const hrms = hrmsMap.get(u.id);
      return {
        user_id: u.id,
        id: u.id,
        full_name: [u.first_name, u.last_name].filter(Boolean).join(' '),
        first_name: u.first_name,
        last_name: u.last_name,
        email: u.email,
        phone: u.phone,
        code: u.code,
        password: u.password ?? null,
        is_active: u.is_active,
        role_id: Array.isArray(u.role_id) ? u.role_id[0] : u.role_id,
        department_id: u.department_id,
        sub_department_id: u.sub_department_id,
        cost_centre_id: u.cost_centre_id,
        manager_id: u.manager_id,
        department: u.department ?? null,
        sub_department: u.sub_department ?? null,
        cost_centre: u.cost_centre ?? null,
        project_role: u.project_role ?? null,
        reporting_manager: u.reporting_manager ?? null,
        paygroup: hrms?.paygroup ?? null,
        entity: hrms?.entity ?? null,
      };
    });

    return res.json({ status: 'success', data: normalized });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/v1/configurator-data/users
 * Create a new user in Config DB.
 */
router.post('/users', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = req.body;
    if (!data.email?.trim()) throw new AppError('Email is required', 400);

    // Use company_id from body, or resolve from authenticated user
    let companyId = Number(data.company_id) || 0;
    if (!companyId) {
      companyId = await resolveCompanyId(req);
    }

    const user = await configUsersService.createUser({
      email: data.email.trim(),
      first_name: data.first_name ?? '',
      last_name: data.last_name ?? '',
      phone: data.phone ?? '',
      company_id: companyId,
      project_id: data.project_id ? Number(data.project_id) : undefined,
      role_id: data.role_id ? Number(data.role_id) : undefined,
      cost_centre_id: data.cost_centre_id ? Number(data.cost_centre_id) : undefined,
      department_id: data.department_id ? Number(data.department_id) : undefined,
      sub_department_id: data.sub_department_id ? Number(data.sub_department_id) : undefined,
      password: data.password ?? `Temp@${Math.random().toString(36).slice(-8)}`,
      manager_id: data.manager_id != null ? Number(data.manager_id) : undefined,
      code: data.code ?? undefined,
    });

    return res.status(201).json({ status: 'success', data: user });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/v1/configurator-data/users/:userId
 * Get single Config DB user by ID.
 */
router.get('/users/:userId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = Number(req.params.userId);
    if (!userId) throw new AppError('Invalid user ID', 400);

    const user = await configPrisma.users.findUnique({
      where: { id: userId },
    });
    if (!user) throw new AppError('User not found', 404);

    return res.json({ status: 'success', data: user });
  } catch (error) {
    return next(error);
  }
});

/**
 * PUT /api/v1/configurator-data/users/:userId
 * Update Config DB user.
 */
router.put('/users/:userId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = Number(req.params.userId);
    if (!userId) throw new AppError('Invalid user ID', 400);

    const updated = await configUsersService.updateUser(userId, req.body);
    return res.json({ status: 'success', data: updated });
  } catch (error) {
    return next(error);
  }
});

/**
 * DELETE /api/v1/configurator-data/users/:userId
 * Soft-delete (deactivate) Config DB user.
 */
router.delete('/users/:userId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = Number(req.params.userId);
    if (!userId) throw new AppError('Invalid user ID', 400);

    await configPrisma.users.update({
      where: { id: userId },
      data: { is_active: false, deleted_at: new Date() },
    });
    return res.json({ status: 'success', message: 'User deactivated' });
  } catch (error) {
    return next(error);
  }
});

// ─── DEPARTMENTS ────────────────────────────────────────────────────────────

/**
 * GET /api/v1/configurator-data/departments
 */
router.get('/departments', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = await resolveCompanyId(req);
    const departments = await configOrgDataService.getDepartments(companyId);
    return res.json({
      status: 'success',
      data: departments.filter((d: any) => d.is_active !== false),
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/v1/configurator-data/departments
 */
router.post('/departments', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, cost_centre_id } = req.body;
    if (!name?.trim()) throw new AppError('Department name is required', 400);

    const companyId = await resolveCompanyId(req);
    const result = await configOrgDataService.createDepartment({
      name: name.trim(),
      company_id: companyId,
      is_active: true,
      cost_centre_id: cost_centre_id ? Number(cost_centre_id) : undefined,
    });
    return res.status(201).json({ status: 'success', data: result });
  } catch (error) {
    return next(error);
  }
});

/**
 * PUT /api/v1/configurator-data/departments/:id
 */
router.put('/departments/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deptId = Number(req.params.id);
    if (!deptId) throw new AppError('Invalid department ID', 400);

    const { name, cost_centre_id } = req.body;
    if (!name?.trim()) throw new AppError('Department name is required', 400);

    const updated = await configPrisma.departments.update({
      where: { id: deptId },
      data: {
        name: name.trim(),
        ...(cost_centre_id != null && { cost_centre_id: Number(cost_centre_id) }),
      },
    });
    return res.json({ status: 'success', data: updated });
  } catch (error) {
    return next(error);
  }
});

/**
 * DELETE /api/v1/configurator-data/departments/:id
 */
router.delete('/departments/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deptId = Number(req.params.id);
    if (!deptId) throw new AppError('Invalid department ID', 400);

    await configPrisma.departments.update({
      where: { id: deptId },
      data: { is_active: false },
    });
    return res.json({ status: 'success', message: 'Department deactivated' });
  } catch (error) {
    return next(error);
  }
});

// ─── SUB-DEPARTMENTS ────────────────────────────────────────────────────────

/**
 * GET /api/v1/configurator-data/sub-departments
 */
router.get('/sub-departments', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = await resolveCompanyId(req);
    const departmentId = req.query.department_id ? Number(req.query.department_id) : undefined;
    const subDepartments = await configOrgDataService.getSubDepartments(companyId, departmentId);
    return res.json({
      status: 'success',
      data: subDepartments.filter((s: any) => s.is_active !== false),
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/v1/configurator-data/sub-departments
 */
router.post('/sub-departments', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, department_id, costcenter_id } = req.body;
    if (!name?.trim()) throw new AppError('Sub-department name is required', 400);

    const companyId = await resolveCompanyId(req);
    const result = await configOrgDataService.createSubDepartment({
      name: name.trim(),
      company_id: companyId,
      is_active: true,
      department_id: department_id ? Number(department_id) : undefined,
      costcenter_id: costcenter_id ? String(costcenter_id) : undefined,
    });
    return res.status(201).json({ status: 'success', data: result });
  } catch (error) {
    return next(error);
  }
});

/**
 * PUT /api/v1/configurator-data/sub-departments/:id
 */
router.put('/sub-departments/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const subDeptId = Number(req.params.id);
    if (!subDeptId) throw new AppError('Invalid sub-department ID', 400);

    const { name, department_id, costcenter_id } = req.body;
    if (!name?.trim()) throw new AppError('Sub-department name is required', 400);

    const updated = await configPrisma.sub_departments.update({
      where: { id: subDeptId },
      data: {
        name: name.trim(),
        ...(department_id != null && { department_id: Number(department_id) }),
        ...(costcenter_id != null && { cost_centre_id: Number(costcenter_id) }),
      },
    });
    return res.json({ status: 'success', data: updated });
  } catch (error) {
    return next(error);
  }
});

/**
 * DELETE /api/v1/configurator-data/sub-departments/:id
 */
router.delete('/sub-departments/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const subDeptId = Number(req.params.id);
    if (!subDeptId) throw new AppError('Invalid sub-department ID', 400);

    await configPrisma.sub_departments.update({
      where: { id: subDeptId },
      data: { is_active: false },
    });
    return res.json({ status: 'success', message: 'Sub-department deactivated' });
  } catch (error) {
    return next(error);
  }
});

// ─── COST CENTRES ───────────────────────────────────────────────────────────

/**
 * GET /api/v1/configurator-data/cost-centres
 */
router.get('/cost-centres', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = await resolveCompanyId(req);
    const costCentres = await configOrgDataService.getCostCentres(companyId);
    return res.json({
      status: 'success',
      data: costCentres.filter((c: any) => c.is_active !== false),
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/v1/configurator-data/cost-centres
 */
router.post('/cost-centres', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, code } = req.body;
    if (!name?.trim()) throw new AppError('Cost centre name is required', 400);

    const companyId = await resolveCompanyId(req);
    const costCentreCode = code?.trim() || name.trim().toUpperCase().replace(/\s+/g, '_');
    const result = await configOrgDataService.createCostCentre({
      name: name.trim(),
      code: costCentreCode,
      company_id: companyId,
    });
    return res.status(201).json({ status: 'success', data: result });
  } catch (error) {
    return next(error);
  }
});

/**
 * PUT /api/v1/configurator-data/cost-centres/:id
 */
router.put('/cost-centres/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ccId = Number(req.params.id);
    if (!ccId) throw new AppError('Invalid cost centre ID', 400);

    const { name, code } = req.body;
    if (!name?.trim()) throw new AppError('Cost centre name is required', 400);

    const updated = await configPrisma.cost_centres.update({
      where: { id: ccId },
      data: {
        name: name.trim(),
        ...(code?.trim() && { code: code.trim() }),
      },
    });
    return res.json({ status: 'success', data: updated });
  } catch (error) {
    return next(error);
  }
});

/**
 * DELETE /api/v1/configurator-data/cost-centres/:id
 */
router.delete('/cost-centres/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ccId = Number(req.params.id);
    if (!ccId) throw new AppError('Invalid cost centre ID', 400);

    await configPrisma.cost_centres.update({
      where: { id: ccId },
      data: { is_active: false },
    });
    return res.json({ status: 'success', message: 'Cost centre deactivated' });
  } catch (error) {
    return next(error);
  }
});

// ─── ROLES ───────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/configurator-data/roles
 * List all roles for the company (replaces RAG POST /api/v1/user-roles/get)
 */
router.get('/roles', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = await resolveCompanyId(req);
    const roles = await configAuthService.getUserRoles(companyId);
    return res.json({ status: 'success', data: roles });
  } catch (error) {
    return next(error);
  }
});

// ─── ROLE-MODULE PERMISSIONS ─────────────────────────────────────────────────

/**
 * GET /api/v1/configurator-data/role-modules?role_id=X
 * Get module permissions for a role (replaces RAG POST /api/v1/user-role-modules/project)
 */
router.get('/role-modules', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const roleId = Number(req.query.role_id);
    if (!roleId) throw new AppError('role_id is required', 400);

    const modules = await configModulesService.getRoleModulesByProject(roleId);
    return res.json({ status: 'success', data: modules });
  } catch (error) {
    return next(error);
  }
});

/**
 * PUT /api/v1/configurator-data/role-modules
 * Save module permissions for a role (replaces RAG POST /api/v1/user-role-modules/)
 * Body: { role_id, modules: [{ module_id, is_enabled, can_view, can_add, can_edit, can_delete }] }
 */
router.put('/role-modules', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role_id, modules } = req.body;
    if (!role_id) throw new AppError('role_id is required', 400);
    if (!Array.isArray(modules)) throw new AppError('modules must be an array', 400);

    const companyId = await resolveCompanyId(req);
    const projectId = Number(config.configuratorHrmsProjectId) || 0;

    // Update or create each module permission
    const results = await Promise.all(
      modules.map(async (m: any) => {
        const existing = await configPrisma.role_module_permissions.findFirst({
          where: { role_id: Number(role_id), module_id: Number(m.module_id), company_id: companyId },
        });
        const permData = {
          is_enabled: m.is_enabled ?? false,
          can_view: m.can_view ?? false,
          can_add: m.can_add ?? false,
          can_edit: m.can_edit ?? false,
          can_delete: m.can_delete ?? false,
        };
        if (existing) {
          return configPrisma.role_module_permissions.update({ where: { id: existing.id }, data: permData });
        }
        return configPrisma.role_module_permissions.create({
          data: { role_id: Number(role_id), module_id: Number(m.module_id), company_id: companyId, project_id: projectId, ...permData },
        });
      })
    );

    return res.json({ status: 'success', data: results });
  } catch (error) {
    return next(error);
  }
});

// ─── BRANCHES ────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/configurator-data/branches
 */
router.get('/branches', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = await resolveCompanyId(req);
    const branches = await configPrisma.branches.findMany({
      where: { company_id: companyId, status: 'active', is_deleted: false },
      select: { id: true, branch_name: true, code: true, company_id: true, status: true },
      orderBy: { branch_name: 'asc' },
    });
    // branches.id is BigInt — convert to Number; use branch_name as display name
    const serialized = branches.map((b) => ({
      id: Number(b.id),
      name: b.branch_name,
      code: b.code,
      company_id: b.company_id,
      status: b.status,
    }));
    return res.json({ status: 'success', data: serialized });
  } catch (error) {
    return next(error);
  }
});

export default router;
