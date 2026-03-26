/**
 * Routes for CRUD operations on the Configurator (Bnc_Configurator) database.
 * Departments, sub-departments, cost centres are stored in the external Configurator DB.
 * All routes require authentication — the user's stored configuratorAccessToken is used.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middlewares/auth';
import { prisma } from '../utils/prisma';
import { config } from '../config/config';
import { configuratorService } from '../services/configurator.service';
import { AppError } from '../middlewares/errorHandler';

const router = Router();

/**
 * Helper: get the logged-in user's configuratorAccessToken and resolve company_id.
 * Resolution chain:
 *   1. request body/query company_id
 *   2. user's employee → organization → configuratorCompanyId (from Prisma)
 *   3. localStorage-stored configuratorCompanyId (sent as header)
 *   4. config default (CONFIGURATOR_DEFAULT_COMPANY_ID from .env)
 */
async function getConfigContext(req: Request) {
  if (!req.user) throw new AppError('Not authenticated', 401);

  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: { configuratorAccessToken: true },
  });

  if (!user?.configuratorAccessToken) {
    throw new AppError('No Configurator session. Please log in again.', 401);
  }

  // company_id resolution chain
  let companyId = Number(req.body?.company_id || req.query?.company_id) || 0;

  if (!companyId) {
    // Try from user's organization
    const employee = await prisma.employee.findFirst({
      where: { userId: req.user.userId },
      select: { organization: { select: { configuratorCompanyId: true } } },
    });
    companyId = employee?.organization?.configuratorCompanyId || 0;
  }

  if (!companyId) {
    // Try from X-Configurator-Company-Id header (frontend sends from localStorage)
    const headerVal = req.headers['x-configurator-company-id'];
    if (headerVal) companyId = Number(headerVal) || 0;
  }

  if (!companyId) {
    // Fallback to .env default
    companyId = Number(config.configuratorDefaultCompanyId) || 0;
    if (companyId) {
      // Using default company_id from config
    }
  }

  if (!companyId) {
    throw new AppError('Could not determine company_id. Ensure your organization is linked.', 400);
  }

  return { token: user.configuratorAccessToken, companyId };
}

// ─── USERS ──────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/configurator-data/users
 * Fetch users from Configurator DB, excluding the logged-in user.
 */
router.get('/users', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Not authenticated', 401);

    const dbUser = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { id: true, configuratorAccessToken: true, configuratorRefreshToken: true },
    });
    if (!dbUser?.configuratorAccessToken) {
      throw new AppError('No Configurator session. Please log in again.', 401);
    }

    // Resolve companyId
    let companyId = 0;
    const employee = await prisma.employee.findFirst({
      where: { userId: req.user.userId },
      select: { configuratorUserId: true, organization: { select: { configuratorCompanyId: true } } },
    });
    companyId = employee?.organization?.configuratorCompanyId || Number(config.configuratorDefaultCompanyId) || 0;
    if (!companyId) throw new AppError('Could not determine company_id', 400);

    // Try fetching users; if 401, refresh token and retry
    let users: any[] = [];
    try {
      users = await configuratorService.getUsers(dbUser.configuratorAccessToken, { companyId });
    } catch (err: any) {
      if (err?.statusCode === 401 || err?.message?.includes('401') || err?.message?.includes('expired')) {
        if (dbUser.configuratorRefreshToken) {
          try {
            const refreshed = await configuratorService.refreshToken(dbUser.configuratorRefreshToken);
            await prisma.user.update({
              where: { id: dbUser.id },
              data: {
                configuratorAccessToken: refreshed.access_token,
                configuratorRefreshToken: refreshed.refresh_token,
              },
            });
            users = await configuratorService.getUsers(refreshed.access_token, { companyId });
          } catch (refreshErr) {
            console.error('[GET /configurator-data/users] Token refresh failed:', refreshErr);
            throw new AppError('Configurator session expired. Please log in again.', 401);
          }
        } else {
          throw new AppError('Configurator session expired. Please log in again.', 401);
        }
      } else {
        throw err;
      }
    }

    // Exclude logged-in user
    const excludeId = employee?.configuratorUserId ?? null;
    const filtered = excludeId != null
      ? users.filter((u: any) => u.user_id !== excludeId)
      : users;

    return res.json({ status: 'success', data: filtered });
  } catch (error) {
    console.error('[GET /configurator-data/users] Error:', error instanceof Error ? error.message : error);
    return next(error);
  }
});

// ─── DEPARTMENTS ────────────────────────────────────────────────────────────

/**
 * GET /api/v1/configurator-data/departments?company_id=X
 * Fetch departments from Configurator DB for the given company.
 */
router.get('/departments', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, companyId } = await getConfigContext(req);
    // Fetch departments
    const departments = await configuratorService.getDepartments(token, { companyId });
    // departments fetched
    return res.json({
      status: 'success',
      data: departments.filter((d: any) => d.is_active !== false),
    });
  } catch (error) {
    console.error('[GET /departments] Error');
    return next(error);
  }
});

/**
 * POST /api/v1/configurator-data/departments
 * Create a department in Configurator DB.
 * Body: { name, company_id? }
 */
router.post('/departments', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) throw new AppError('Department name is required', 400);

    const { token, companyId } = await getConfigContext(req);
    console.log('[POST /departments] Creating:', name.trim());
    const result = await configuratorService.createDepartment(token, {
      name: name.trim(),
      company_id: companyId,
      is_active: true,
    });
    return res.status(201).json({ status: 'success', data: result });
  } catch (error) {
    return next(error);
  }
});

// ─── SUB-DEPARTMENTS ────────────────────────────────────────────────────────

/**
 * GET /api/v1/configurator-data/sub-departments?company_id=X&department_id=Y
 * Fetch sub-departments from Configurator DB.
 */
router.get('/sub-departments', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, companyId } = await getConfigContext(req);
    const departmentId = req.query.department_id ? Number(req.query.department_id) : undefined;
    const subDepartments = await configuratorService.getSubDepartments(token, { companyId, departmentId });
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
 * Create a sub-department in Configurator DB.
 * Body: { name, department_id?, company_id? }
 */
router.post('/sub-departments', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, department_id } = req.body;
    if (!name?.trim()) throw new AppError('Sub-department name is required', 400);

    const { token, companyId } = await getConfigContext(req);
    console.log('[POST /sub-departments] Creating:', name.trim());
    const result = await configuratorService.createSubDepartment(token, {
      name: name.trim(),
      company_id: companyId,
      is_active: true,
      department_id: department_id ? Number(department_id) : undefined,
    });
    return res.status(201).json({ status: 'success', data: result });
  } catch (error) {
    return next(error);
  }
});

// ─── COST CENTRES ───────────────────────────────────────────────────────────

/**
 * GET /api/v1/configurator-data/cost-centres?company_id=X
 * Fetch cost centres from Configurator DB.
 */
router.get('/cost-centres', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, companyId } = await getConfigContext(req);
    const costCentres = await configuratorService.getCostCentres(token, companyId);
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
 * Create a cost centre in Configurator DB.
 * Body: { name, code?, company_id? }
 */
router.post('/cost-centres', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, code } = req.body;
    if (!name?.trim()) throw new AppError('Cost centre name is required', 400);

    const { token, companyId } = await getConfigContext(req);
    const costCentreCode = code?.trim() || name.trim().toUpperCase().replace(/\s+/g, '_');
    const result = await configuratorService.createCostCentre(token, {
      name: name.trim(),
      code: costCentreCode,
      company_id: companyId,
    });
    return res.status(201).json({ status: 'success', data: result });
  } catch (error) {
    return next(error);
  }
});

export default router;
