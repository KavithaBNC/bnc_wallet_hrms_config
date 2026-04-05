import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import type { ConfiguratorRoleModuleWithPage } from '../services/configurator.service';
import { configAuthService } from '../services/config-auth.service';
import { configModulesService, type ConfigRoleModuleWithPage } from '../services/config-modules.service';
import { AppError } from '../middlewares/errorHandler';
import { generateTokenPair, JwtPayload } from '../utils/jwt';
import { prisma } from '../utils/prisma';
import { UserRole } from '@prisma/client';
import { config } from '../config/config';
import { setUserPermissions, clearUserPermissions, type ModulePermissions } from '../utils/permission-cache';

/**
 * Normalize a Configurator role code/name to a valid Prisma UserRole enum value.
 * Valid roles are read dynamically from the Prisma-generated UserRole enum.
 * Configurator may return codes like 'HRMS001_SUPER_ADMIN', 'HRMS_ORG_ADMIN', etc.
 * Strategy: uppercase + strip prefix → match against Prisma UserRole values.
 */
function normalizeToHrmsRole(code: string | undefined | null): UserRole | undefined {
  if (!code) return undefined;
  const upper = code.trim().toUpperCase().replace(/\s+/g, '_');
  const validRoles = Object.values(UserRole);
  // Direct match
  if (validRoles.includes(upper as UserRole)) return upper as UserRole;
  // Suffix match: strip any prefix (e.g., HRMS001_HR_MANAGER → HR_MANAGER)
  for (const role of validRoles) {
    if (upper.endsWith('_' + role)) return role;
  }
  return undefined;
}

/**
 * Map Configurator module name → frontend sidebar path.
 * Used to resolve paths for modules returned by the my-modules API.
 * Key: lowercase module name, Value: sidebar path.
 */
const MODULE_NAME_TO_PATH: Record<string, string> = {
  'dashboard': '/dashboard',
  'department': '/departments',
  'departmentmasters': '/department-masters',
  'department masters': '/department-masters',
  'employees': '/employees',
  'positions': '/positions',
  'position': '/positions',
  'core hr': '/core-hr',
  'overview': '/core-hr/overview',
  'component creation': '/core-hr/compound-creation',
  'rules engine': '/core-hr/rules-engine',
  'variable input': '/core-hr/variable-input',
  'event configuration': '/event-configuration',
  'attendance components': '/event-configuration/attendance-components',
  'approval workflow': '/event-configuration/approval-workflow',
  'workflow mapping': '/event-configuration/workflow-mapping',
  'rights allocation': '/event-configuration/rights-allocation',
  'rule setting': '/event-configuration/rule-setting',
  'auto credit setting': '/event-configuration/auto-credit-setting',
  'encashment / carry forward': '/event-configuration/encashment-carry-forward',
  'hr activities': '/hr-activities',
  'validation process': '/hr-activities/validation-process',
  'others configuration': '/others-configuration',
  'validation process rule': '/others-configuration/validation-process-rule',
  'attendance lock': '/others-configuration/attendance-lock',
  'post to payroll': '/hr-activities/post-to-payroll',
  'post to payroll setup': '/others-configuration/post-to-payroll',
  'attendance': '/attendance',
  'excess time request': '/attendance/my-requests/excess-time-request',
  'excess time approval': '/attendance/excess-time-approval',
  'attendance policy': '/attendance-policy',
  'late & others': '/attendance-policy/late-and-others',
  'week of assign': '/attendance-policy/week-of-assign',
  'holiday assign': '/attendance-policy/holiday-assign',
  'excess time conversion': '/attendance-policy/excess-time-conversion',
  'ot usage rule': '/attendance-policy/ot-usage-rule',
  'event': '/leave',
  'event apply': '/attendance/apply-event',
  'event request': '/event/requests',
  'event approval': '/leave/approvals',
  'event balance entry': '/event/balance-entry',
  'time attendance': '/time-attendance',
  'shift master': '/time-attendance/shift-master',
  'shift assign': '/time-attendance/shift-assign',
  'associate shift change': '/time-attendance/associate-shift-change',
  'payroll': '/payroll',
  'payroll master': '/payroll-master',
  'employee separation': '/payroll/employee-separation',
  'employee rejoin': '/payroll/employee-rejoin',
  'salary structure': '/salary-structures',
  'employee salary': '/employee-salaries',
  'hr audit settings': '/hr-audit-settings',
  'employee master approval': '/employee-master-approval',
  'esop': '/esop',
  'add esop': '/esop/add',
  'transaction': '/transaction',
  'increment': '/transaction/transfer-promotions',
  'transfer and promotion entry': '/transaction/transfer-promotion-entry',
  'emp code transfer': '/transaction/emp-code-transfer',
  'pay group transfer': '/transaction/paygroup-transfer',
  'organization management': '/organizations',
  'module permission': '/permissions',
  'user module': '/user-module',
  // ESOP sub-pages
  'esop dashboard': '/esop/dashboard',
  'esop pools': '/esop/pools',
  'esop grants': '/esop/grants',
  'vesting schedules': '/esop/vesting-schedules',
  'vesting plans': '/esop/vesting-plans',
  'exercise requests': '/esop/exercise-requests',
  'esop ledger': '/esop/ledger',
  'my holdings': '/esop/my-holdings',
  // Statutory Compliance
  'statutory': '/statutory',
  'statutory compliance': '/statutory',
  'epf': '/statutory/epf',
  'esic': '/statutory/esic',
  'professional tax': '/statutory/professional-tax',
  'tds': '/statutory/tds',
  'tds / income tax': '/statutory/tds',
  // Reports
  'reports': '/reports',
  'payroll register': '/reports/payroll-register',
  'epf report': '/reports/epf',
  'esic report': '/reports/esic',
  'professional tax report': '/reports/professional-tax',
  'tds working': '/reports/tds-working',
  'form 16': '/reports/form16',
  'form16': '/reports/form16',
  'fnf settlement report': '/reports/fnf-settlement',
  // Payroll sub-pages
  'payroll dashboard': '/payroll/dashboard',
  'run payroll': '/payroll/run',
  'payroll history': '/payroll/history',
  'fnf settlement': '/payroll/fnf-settlement',
  'loans': '/payroll/loans',
  // Other missing
  'salary templates': '/salary-templates',
  'department_masters': '/department-masters',
  // Config DB page_name paths (start with /) that need remapping
  '/event': '/leave',
  '/event/apply-event': '/leave/apply-event',
  '/event/requests': '/leave/requests',
  '/event/approvals': '/leave/approvals',
  '/event/balance-entry': '/leave/balance-entry',
  '/event/excess-time-request': '/leave/excess-time-request',
  '/event/excess-time-approval': '/leave/excess-time-approval',
  '/payroll-master/employee-separation': '/payroll/employee-separation',
  '/payroll-master/fnf-settlement': '/payroll/fnf-settlement',
  '/payroll-master/loans': '/payroll/loans',
  '/payroll-master/employee-rejoin': '/payroll/employee-rejoin',
  '/event-configuration/leave-type': '/event-configuration/attendance-components',
  '/event-configuration/leave-types': '/event-configuration/attendance-components',
};

/** Map raw role-module-permission rows to frontend-friendly module objects */
function mapRoleModulesToFrontend(roleModules: (ConfiguratorRoleModuleWithPage | ConfigRoleModuleWithPage)[]) {
  return roleModules
    .filter((m) => m.is_enabled)
    .map((m) => {
      const pageName = (m.page_name || '').trim();
      const lastSegment = pageName.split('/').filter(Boolean).pop() || '';
      const label = lastSegment
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      return {
        id: m.id,
        module_id: m.module_id,
        name: label || `Module ${m.module_id}`,
        code: pageName.replace(/\//g, '_').replace(/^_/, '').toUpperCase() || `MODULE_${m.module_id}`,
        path: pageName,
        page_name: pageName,
        page_name_mobile: m.page_name_mobile || '',
        is_enabled: m.is_enabled,
        can_view: m.can_view === true,
        can_add: m.can_add === true,
        can_edit: m.can_edit === true,
        can_delete: m.can_delete === true,
        role_id: m.role_id,
        company_id: m.company_id,
        project_id: m.project_id,
      };
    });
}

export class AuthController {
  /**
   * Register a new user
   * POST /api/v1/auth/register
   */
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await authService.register(req.body);

      return res.status(201).json({
        status: 'success',
        message: 'Registration successful. Please check your email to verify your account.',
        data: { user },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Configurator login - authenticate via Configurator API, sync with HRMS, return HRMS tokens + modules
   * Falls back to local HRMS login when Configurator is unavailable (5xx, connection error, DB error)
   * POST /api/v1/auth/configurator/login
   * Body: { username, password, company_id }
   */
  async configuratorLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const { username, password, company_name_or_code, company_id: bodyCompanyId } = req.body;

      // ── Step 1: Company verification ──
      // If only company_name_or_code is provided (no username/password),
      // verify company exists. Try Configurator API first, fall back to local DB.
      if (company_name_or_code && !username && !password) {
        console.log('[configuratorLogin] Step 1 — verifying company');

        // Try Config DB directly first
        let verifyResult: any = null;
        try {
          verifyResult = await configAuthService.verifyCompany(company_name_or_code);
          console.log('[configuratorLogin] Company verified via Config DB:', verifyResult?.success);
        } catch (err: any) {
          console.log('[configuratorLogin] Config DB verify failed, falling back to local DB:', err.message);
        }

        // If Config DB returned success, use that
        if (verifyResult?.success === true) {
          return res.status(200).json(verifyResult);
        }

        // Fallback: look up company in local HRMS database (organizations table)
        // Match by name (case-insensitive)
        const localOrg = await prisma.organization.findFirst({
          where: {
            name: { equals: company_name_or_code, mode: 'insensitive' },
          },
          select: { id: true, name: true, configuratorCompanyId: true },
        });

        if (localOrg) {
          console.log('[configuratorLogin] Company found in local DB');
          return res.status(200).json({
            success: true,
            step: 1,
            message: 'Company verified',
            company: {
              id: localOrg.configuratorCompanyId || config.configuratorDefaultCompanyId,
              name: localOrg.name,
            },
          });
        }

        // Also try matching as a code/partial match
        const localOrgByPartial = await prisma.organization.findFirst({
          where: {
            name: { contains: company_name_or_code, mode: 'insensitive' },
          },
          select: { id: true, name: true, configuratorCompanyId: true },
        });

        if (localOrgByPartial) {
          console.log('[configuratorLogin] Company found by partial match');
          return res.status(200).json({
            success: true,
            step: 1,
            message: 'Company verified',
            company: {
              id: localOrgByPartial.configuratorCompanyId || config.configuratorDefaultCompanyId,
              name: localOrgByPartial.name,
            },
          });
        }

        // If Configurator had a specific error message, use it
        const errMsg = verifyResult?.message || verifyResult?.detail;
        return res.status(404).json({
          success: false,
          message: typeof errMsg === 'string' ? errMsg : 'Company not found. Please check the name or code.',
          company: null,
        });
      }

      // ── Step 2: Full login ──
      if (!username) {
        throw new AppError('Username (email) is required', 400);
      }
      if (!password) {
        throw new AppError('Password is required', 400);
      }

      // company_name_or_code is the primary identifier; company_id is optional but required by some API endpoints
      let company_id = bodyCompanyId || undefined;
      // If company_id not provided but company_name_or_code is, resolve it from local DB
      if (!company_id && company_name_or_code) {
        const localOrg = await prisma.organization.findFirst({
          where: { name: { equals: company_name_or_code, mode: 'insensitive' } },
          select: { configuratorCompanyId: true },
        });
        if (localOrg?.configuratorCompanyId) {
          company_id = localOrg.configuratorCompanyId;
        }
      }
      // Final fallback: use default from config only when no company_name_or_code is provided
      // (avoids sending mismatched company_id when company_name_or_code already identifies the company)
      if (!company_id && !company_name_or_code && config.configuratorDefaultCompanyId) {
        company_id = config.configuratorDefaultCompanyId;
      }
      console.log('[configuratorLogin] Step 2 login —', username, 'company_id:', company_id, 'company_name:', company_name_or_code);
      // Direct Config DB login (no RAG API)
      const configLoginRes = await configAuthService.login(username, password, company_id, company_name_or_code);

      const configuratorUserId = configLoginRes.user.id;
      const email = configLoginRes.user.email || username;
      const resolvedCompanyId = configLoginRes.company?.id ?? company_id;
      console.log('[configuratorLogin] Login OK via Config DB — company_id:', resolvedCompanyId);
      const configRoles = configLoginRes.roles ?? [];
      const primaryConfigRole = configRoles[0];
      // Also check user_project_roles for HRMS project
      const hrmsProjectRoles = await configAuthService.getUserProjectRoles(
        configuratorUserId,
        config.configuratorHrmsProjectId,
        resolvedCompanyId ?? config.configuratorDefaultCompanyId
      );
      const hrmsConfigProject: { role_id: number; role_code?: string; role_name?: string } | undefined = hrmsProjectRoles.length > 0
        ? { role_id: hrmsProjectRoles[0].role_id }
        : undefined;
      // Build a compat loginRes object for downstream code
      const loginRes = {
        access_token: '', // No longer needed — direct DB access
        refresh_token: '',
        user: configLoginRes.user,
        company: configLoginRes.company,
        user_role_id: configLoginRes.user.role_id?.[0],
      };

      // Prefer email lookup (from token) - it's the actual logged-in user
      let hrmsUser = await prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        include: {
          employee: {
            select: {
              id: true,
              organizationId: true,
              firstName: true,
              lastName: true,
              profilePictureUrl: true,
              employeeStatus: true,
              employeeCode: true,
              department: { select: { name: true } },
              position: { select: { title: true } },
              organization: { select: { id: true, name: true } },
            },
          },
        },
      });

      if (hrmsUser) {
        const updates: { configuratorUserId?: number; role?: import('@prisma/client').UserRole } = {};
        if (configuratorUserId != null && hrmsUser.configuratorUserId !== configuratorUserId) {
          updates.configuratorUserId = configuratorUserId;
        }
        let roleCode: string | undefined = primaryConfigRole?.code || hrmsConfigProject?.role_code;
        if (!roleCode) {
          const roleId = primaryConfigRole?.id ?? hrmsConfigProject?.role_id ?? (loginRes as any).user_role_id;
          if (typeof roleId === 'number') {
            const roleRes = await configAuthService.getUserRole(roleId);
            roleCode = roleRes?.code || roleRes?.name;
          }
        }
        let normalizedRoleCode = normalizeToHrmsRole(roleCode);
        // Fallback: try role name if code didn't match
        if (!normalizedRoleCode) {
          const roleName = primaryConfigRole?.name || hrmsConfigProject?.role_name;
          if (roleName) normalizedRoleCode = normalizeToHrmsRole(roleName);
        }
        if (normalizedRoleCode && hrmsUser.role !== normalizedRoleCode) {
          updates.role = normalizedRoleCode;
        }
        if (Object.keys(updates).length > 0) {
          await prisma.user.update({
            where: { id: hrmsUser.id },
            data: updates,
          });
          if (updates.role) (hrmsUser as any).role = updates.role;
        }

        // If employee not linked via userId, look up by configuratorUserId
        if (!hrmsUser.employee && configuratorUserId != null) {
          const empByConfigId = await prisma.employee.findFirst({
            where: { configuratorUserId, deletedAt: null },
            select: {
              id: true,
              organizationId: true,
              firstName: true,
              lastName: true,
              profilePictureUrl: true,
              employeeStatus: true,
              employeeCode: true,
              department: { select: { name: true } },
              position: { select: { title: true } },
              organization: { select: { id: true, name: true } },
            },
          });
          if (empByConfigId) {
            (hrmsUser as any).employee = empByConfigId;
          }
        }
      }

      if (!hrmsUser) {
        let org = resolvedCompanyId
          ? await prisma.organization.findFirst({ where: { configuratorCompanyId: resolvedCompanyId } })
          : null;
        // Auto-create organization if not found
        if (!org && resolvedCompanyId) {
          const companyName = loginRes.company?.name || company_name_or_code || `Company_${resolvedCompanyId}`;
          org = await prisma.organization.create({
            data: {
              name: companyName,
              legalName: companyName,
              configuratorCompanyId: resolvedCompanyId,
            },
          });
          console.log('[configuratorLogin] Auto-created organization:', companyName, 'for company_id:', resolvedCompanyId);
        }
        if (!org) {
          throw new AppError(
            `Organization for company ${resolvedCompanyId || company_name_or_code} not found in HRMS. Please sync company first.`,
            404
          );
        }
        const existingUser = await prisma.user.findFirst({
          where: { email: { equals: email, mode: 'insensitive' } },
        });
        if (existingUser) {
          await prisma.user.update({
            where: { id: existingUser.id },
            data: { configuratorUserId },
          });
          hrmsUser = await prisma.user.findUnique({
            where: { id: existingUser.id },
            include: {
              employee: {
                select: {
                  id: true,
                  organizationId: true,
                  firstName: true,
                  lastName: true,
                  profilePictureUrl: true,
                  employeeStatus: true,
                  employeeCode: true,
                  department: { select: { name: true } },
                  position: { select: { title: true } },
                  organization: { select: { id: true, name: true } },
                },
              },
            },
          })!;
        } else {
          if (!config.configuratorPlaceholderPasswordHash) {
            throw new AppError(
              'CONFIGURATOR_PLACEHOLDER_PASSWORD_HASH must be set in .env for auto-creating users',
              500
            );
          }
          let configRole: string | undefined = primaryConfigRole?.code || hrmsConfigProject?.role_code;
          if (!configRole) {
            const roleId = primaryConfigRole?.id ?? hrmsConfigProject?.role_id ?? (loginRes as any).user_role_id ?? (loginRes.user as any)?.role_id;
            if (typeof roleId === 'number') {
              // Direct Config DB access — no token needed
              const roleRes = await configAuthService.getUserRole(roleId);
              configRole = roleRes?.code || roleRes?.name;
            }
          }
          let normalizedConfigRole = normalizeToHrmsRole(configRole);
          // Fallback: try role name if code didn't match
          if (!normalizedConfigRole) {
            const roleName = primaryConfigRole?.name || hrmsConfigProject?.role_name;
            if (roleName) normalizedConfigRole = normalizeToHrmsRole(roleName);
          }
          if (!normalizedConfigRole) {
            throw new AppError(
              'User has no role assigned. Assign a role in Configurator and try again.',
              403
            );
          }
          configRole = normalizedConfigRole;
          const nameParts = email.split('@')[0].split(/[._]/);
          const firstName = nameParts[0] || 'User';
          const lastName = nameParts.slice(1).join(' ') || ' ';
          const prefix = org.employeeIdPrefix || 'EMP';
          const nextNum = (org.employeeIdNextNumber ?? 0) + 1;
          const employeeCode = `${prefix}${nextNum.toString().padStart(2, '0')}`;

          const newUser = await prisma.$transaction(async (tx) => {
            // Clear stale configurator_user_id before create (unique constraint)
            if (configuratorUserId != null) {
              await tx.$executeRaw`UPDATE users SET configurator_user_id = NULL WHERE configurator_user_id = ${configuratorUserId}`;
              await tx.$executeRaw`UPDATE employees SET configurator_user_id = NULL WHERE configurator_user_id = ${configuratorUserId}`;
            }
            return tx.user.create({
              data: {
                email,
                passwordHash: config.configuratorPlaceholderPasswordHash,
                role: configRole as any,
                organizationId: org.id,
                configuratorUserId: configuratorUserId ?? undefined,
                isEmailVerified: true,
              },
            });
          });
          await prisma.organization.update({
            where: { id: org.id },
            data: { employeeIdNextNumber: nextNum },
          });
          await prisma.employee.create({
            data: {
              organizationId: org.id,
              userId: newUser.id,
              employeeCode,
              firstName,
              lastName,
              email,
              dateOfJoining: new Date(),
              employeeStatus: 'ACTIVE',
              configuratorUserId: configuratorUserId ?? undefined,
            },
          });
          hrmsUser = await prisma.user.findUnique({
            where: { id: newUser.id },
            include: {
              employee: {
                select: {
                  id: true,
                  organizationId: true,
                  firstName: true,
                  lastName: true,
                  profilePictureUrl: true,
                  employeeStatus: true,
                  employeeCode: true,
                  department: { select: { name: true } },
                  position: { select: { title: true } },
                  organization: { select: { id: true, name: true } },
                },
              },
            },
          })!;
        }
      }

      if (!hrmsUser) {
        throw new AppError('Failed to resolve or create HRMS user', 500);
      }

      if (!hrmsUser.isActive) {
        throw new AppError('Your account has been deactivated', 401);
      }
      if (hrmsUser.employee?.employeeStatus && hrmsUser.employee.employeeStatus !== 'ACTIVE') {
        throw new AppError('Your employment has been separated. You cannot log in.', 401);
      }

      // Resolve role: normalize Configurator role code → valid HRMS UserRole
      const rawRole = (hrmsUser as any).role as string;
      const roleFromConfig = normalizeToHrmsRole(rawRole) ?? rawRole;

      // ── Load modules from Config DB ──────────────────────────────────────────
      // role_id   → Config DB users.role_id[0]  (Int[] column)
      // company_id → Config DB users.company_id
      // project_id → env CONFIGURATOR_HRMS_PROJECT_ID (=2)
      // Query: role_module_permissions WHERE role_id=X AND project_id=2 AND company_id=Y
      // ─────────────────────────────────────────────────────────────────────────
      const userRoleIdArr = configLoginRes.user.role_id; // Int[] from users.role_id
      const primaryRoleId: number | undefined =
        Array.isArray(userRoleIdArr) && userRoleIdArr.length > 0 ? userRoleIdArr[0] : undefined;
      // company_id comes from the logged-in user's own record in Config DB — never hardcoded
      const loginCompanyId: number =
        configLoginRes.user.company_id ?? resolvedCompanyId ?? 0;
      const projectId: number = config.configuratorHrmsProjectId; // CONFIGURATOR_HRMS_PROJECT_ID=2

      console.log('[configuratorLogin] Module lookup — role_id:', primaryRoleId,
        'company_id:', loginCompanyId, 'project_id:', projectId);

      let modules: any[] = [];
      try {
        if (primaryRoleId != null && projectId > 0) {
          const roleModules = await configModulesService.getRoleModulesByProject(
            primaryRoleId, projectId, loginCompanyId
          );
          modules = mapRoleModulesToFrontend(roleModules);
          console.log('[configuratorLogin] Loaded', modules.length, 'modules');
        } else {
          console.warn('[configuratorLogin] Cannot load modules — role_id:', primaryRoleId,
            'project_id:', projectId, '. Check CONFIGURATOR_HRMS_PROJECT_ID in .env and users.role_id in Config DB.');
        }
      } catch (modErr: any) {
        console.warn('[configuratorLogin] Modules fetch failed:', modErr?.message);
      }

      // Build permission cache
      try {
        if (primaryRoleId != null && projectId > 0) {
          const roleModulesRaw = await configModulesService.getRoleModulesByProject(
            primaryRoleId, projectId, loginCompanyId
          );
          const permMap: Record<string, ModulePermissions> = {};
          for (const m of roleModulesRaw) {
            const pageName = (m.page_name || '').trim();
            const path = pageName.startsWith('/')
              ? (MODULE_NAME_TO_PATH[pageName.toLowerCase()] || pageName)
              : (MODULE_NAME_TO_PATH[pageName.toLowerCase()] || '');
            if (path) {
              permMap[path] = {
                is_enabled: m.is_enabled === true,
                can_view: m.can_view === true,
                can_add: m.can_add === true,
                can_edit: m.can_edit === true,
                can_delete: m.can_delete === true,
              };
            }
          }
          setUserPermissions(hrmsUser.id, permMap);
          console.log('[configuratorLogin] Permission cache set —', Object.keys(permMap).length, 'paths:', JSON.stringify(permMap));
        } else {
          setUserPermissions(hrmsUser.id, {});
        }
      } catch (cacheErr: any) {
        console.warn('[configuratorLogin] Permission cache build failed:', cacheErr?.message);
        setUserPermissions(hrmsUser.id, {});
      }

      const payload: JwtPayload = {
        userId: hrmsUser.id,
        email: hrmsUser.email,
        role: roleFromConfig,
      };
      const tokens = generateTokenPair(payload);

      await prisma.user.update({
        where: { id: hrmsUser.id },
        data: {
          refreshToken: tokens.refreshToken,
          configuratorAccessToken: loginRes.access_token,
          configuratorRefreshToken: loginRes.refresh_token,
          lastLoginAt: new Date(),
          loginAttempts: 0,
          lockedUntil: null,
        },
      });

      // Ensure Organization.configuratorCompanyId is set for Configurator DB operations
      if (resolvedCompanyId && hrmsUser.employee?.organizationId) {
        try {
          await prisma.organization.update({
            where: { id: hrmsUser.employee.organizationId },
            data: { configuratorCompanyId: resolvedCompanyId },
          });
        } catch (orgUpdateErr) {
          // May fail if another org already has this configuratorCompanyId (unique constraint)
          console.warn('[configuratorLogin] Could not update org configuratorCompanyId:', orgUpdateErr);
        }
      }

      // Build user response from Config DB users table (primary source)
      const userResponse = {
        id: configuratorUserId,                          // Config DB users.id
        hrms_user_id: hrmsUser.id,                       // HRMS users.id (for internal use)
        email: configLoginRes.user.email,
        first_name: configLoginRes.user.first_name,
        last_name: configLoginRes.user.last_name,
        role_id: configLoginRes.user.role_id,            // Int[] from Config DB users.role_id
        company_id: configLoginRes.user.company_id,      // Config DB users.company_id
        department_id: configLoginRes.user.department_id,
        cost_centre_id: configLoginRes.user.cost_centre_id,
        code: configLoginRes.user.code,                  // employee code stored in Config DB
        is_active: configLoginRes.user.is_active,
        role: roleFromConfig,                            // normalized HRMS role string
        // Include employee data so frontend can resolve organizationId (used by attendance, payroll, etc.)
        employee: hrmsUser.employee
          ? {
              id: hrmsUser.employee.id,
              organizationId: hrmsUser.employee.organizationId,
              firstName: hrmsUser.employee.firstName,
              lastName: hrmsUser.employee.lastName,
              employeeCode: hrmsUser.employee.employeeCode,
              employeeStatus: hrmsUser.employee.employeeStatus,
              organization: hrmsUser.employee.organization,
              department: hrmsUser.employee.department,
              position: hrmsUser.employee.position,
              profilePictureUrl: hrmsUser.employee.profilePictureUrl,
            }
          : null,
        organizationId: hrmsUser.employee?.organizationId ?? hrmsUser.organizationId ?? null,
      };

      return res.status(200).json({
        status: 'success',
        message: 'Login successful',
        data: {
          user: userResponse,
          tokens: {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
          },
          modules,
          configuratorCompanyId: resolvedCompanyId ?? null,
          configuratorProjectId: projectId ?? null,
          configuratorAccessToken: loginRes.access_token ?? null,
        },
      });
    } catch (error: any) {
      console.error('[configuratorLogin]', error?.message || error);
      if (error instanceof AppError) return next(error);
      return next(
        new AppError(
          error?.message || 'Login failed. Please try again.',
          error?.statusCode || 500
        )
      );
    }
  }

  /**
   * Get modules for logged-in user (requires Configurator Bearer token in header)
   * GET /api/v1/auth/configurator/modules
   * Header: Authorization: Bearer <configurator_access_token>
   */
  async getConfiguratorModules(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = req.query.project_id ? Number(req.query.project_id) : undefined;
      // Direct Config DB query — no token needed
      const modules = await configModulesService.getModules(projectId);

      return res.status(200).json({
        status: 'success',
        data: { modules },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Configurator token refresh — no longer needed with direct DB access.
   * Kept for backward compatibility; returns a no-op success response.
   * POST /api/v1/auth/configurator/refresh
   */
  async configuratorRefreshToken(_req: Request, res: Response, next: NextFunction) {
    try {
      // Direct Config DB access — token refresh is no longer needed
      return res.status(200).json({
        status: 'success',
        message: 'Token refresh is no longer required (direct DB access)',
        data: {
          access_token: 'direct-db',
          refresh_token: 'direct-db',
          token_type: 'bearer',
          user: null,
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Login user (HRMS DB - legacy)
   * POST /api/v1/auth/login
   */
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.login(req.body);

      return res.status(200).json({
        status: 'success',
        message: 'Login successful',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Refresh access token
   * POST /api/v1/auth/refresh-token
   */
  async refreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;
      const tokens = await authService.refreshToken(refreshToken);

      return res.status(200).json({
        status: 'success',
        message: 'Token refreshed successfully',
        data: { tokens },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Verify email
   * POST /api/v1/auth/verify-email
   */
  async verifyEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const { token } = req.body;
      const result = await authService.verifyEmail(token);

      return res.status(200).json({
        status: 'success',
        message: result.message,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Request password reset
   * POST /api/v1/auth/forgot-password
   */
  async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.forgotPassword(req.body);

      return res.status(200).json({
        status: 'success',
        message: result.message,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Reset password
   * POST /api/v1/auth/reset-password
   */
  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.resetPassword(req.body);

      return res.status(200).json({
        status: 'success',
        message: result.message,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Logout user
   * POST /api/v1/auth/logout
   */
  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Not authenticated', 401);
      }

      clearUserPermissions(req.user.userId);
      const result = await authService.logout(req.user.userId);

      return res.status(200).json({
        status: 'success',
        message: result.message,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get current user profile
   * GET /api/v1/auth/me
   */
  async getCurrentUser(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Not authenticated', 401);
      }

      const user = await authService.getCurrentUser(req.user.userId);

      return res.status(200).json({
        status: 'success',
        data: { user },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get assigned modules for current user from Config DB
   * GET /api/v1/auth/modules
   * Uses stored configurator token + role to call POST /api/v1/user-role-modules/project
   */
  async getMyModules(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Not authenticated', 401);
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: { role: true, configuratorRoleId: true },
      });

      if (!user) {
        return res.status(200).json({ status: 'success', data: { modules: [] } });
      }

      // Get role_id — prefer stored configuratorRoleId, then env fallback
      const roleId = user.configuratorRoleId ?? config.configuratorRoleIds[String(user.role)];

      if (roleId != null) {
        // Return only modules enabled for this role
        const roleModules = await configModulesService.getRoleModulesByProject(roleId);
        const modules = mapRoleModulesToFrontend(roleModules);
        return res.status(200).json({ status: 'success', data: { modules } });
      }

      // No role — fall back to all project modules
      const directModules = await configModulesService.getModules();
      const modules = directModules.map((m) => {
        const resolvedPath = m.page_name || MODULE_NAME_TO_PATH[(m.name || '').toLowerCase()] || '';
        return {
          id: m.id,
          module_id: m.id,
          name: m.name,
          code: m.code,
          path: resolvedPath,
          page_name: resolvedPath,
          is_active: m.is_active,
          is_enabled: true,
        };
      });
      return res.status(200).json({ status: 'success', data: { modules } });
    } catch (error) {
      return next(error);
    }
  }


  /**
   * Admin reset password for employee
   * POST /api/v1/auth/admin/reset-password/:employeeId
   */
  async adminResetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Not authenticated', 401);
      }

      const { employeeId } = req.params;
      const { newPassword } = req.body;

      if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({
          status: 'fail',
          message: 'Password must be at least 8 characters',
        });
      }

      const result = await authService.adminResetPassword(
        req.user.userId,
        employeeId,
        newPassword
      );

      return res.status(200).json({
        status: 'success',
        message: result.message,
        data: { email: result.email },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Change password
   * POST /api/v1/auth/change-password
   */
  async changePassword(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Not authenticated', 401);
      }

      const result = await authService.changePassword(req.user.userId, req.body);

      return res.status(200).json({
        status: 'success',
        message: result.message,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Sync password_hash in HRMS DB after Configurator password reset.
   * POST /api/v1/auth/sync-password-hash
   * Body: { encryptedPassword: string }  — the encrypted_password from Configurator reset response
   */
  async syncPasswordHash(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Not authenticated', 401);
      }
      const { encryptedPassword } = req.body;
      if (!encryptedPassword || typeof encryptedPassword !== 'string') {
        return res.status(400).json({ status: 'fail', message: 'encryptedPassword is required' });
      }
      await authService.syncPasswordHash(req.user.userId, encryptedPassword);
      return res.status(200).json({ status: 'success', message: 'Password updated successfully' });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Update profile
   * PUT /api/v1/auth/profile
   */
  async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Not authenticated', 401);
      }

      const user = await authService.updateProfile(req.user.userId, req.body);

      return res.status(200).json({
        status: 'success',
        message: 'Profile updated successfully',
        data: { user },
      });
    } catch (error) {
      return next(error);
    }
  }
}

export const authController = new AuthController();
