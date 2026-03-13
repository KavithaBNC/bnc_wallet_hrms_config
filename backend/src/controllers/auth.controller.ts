import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { configuratorService, type ConfiguratorRoleModuleWithPage } from '../services/configurator.service';
import { AppError } from '../middlewares/errorHandler';
import { generateTokenPair, JwtPayload } from '../utils/jwt';
import { prisma } from '../utils/prisma';
import { config } from '../config/config';

/**
 * Map Configurator module name → frontend sidebar path.
 * Used to resolve paths for modules returned by the my-modules API.
 * Key: lowercase module name, Value: sidebar path.
 */
const MODULE_NAME_TO_PATH: Record<string, string> = {
  'dashboard': '/dashboard',
  'department': '/departments',
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
};

/** Map raw role-module-permission rows to frontend-friendly module objects */
function mapRoleModulesToFrontend(roleModules: ConfiguratorRoleModuleWithPage[]) {
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

        // Try Configurator API first
        let verifyResult: any = null;
        try {
          verifyResult = await configuratorService.verifyCompany(company_name_or_code);
          console.log('[configuratorLogin] Company verified:', verifyResult?.success);
        } catch (err: any) {
          console.log('[configuratorLogin] Configurator verify failed, falling back to local DB:', err.message);
        }

        // If Configurator returned success, use that
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
      const loginRes = await configuratorService.login({ username, password, company_name_or_code, company_id });

      const decoded = configuratorService.decodeToken(loginRes.access_token);
      const configuratorUserId = decoded?.sub ? parseInt(decoded.sub, 10) : null;
      const email = decoded?.email || username;
      // Extract company_id from API response (preferred) or request body or token
      const resolvedCompanyId = loginRes.company?.id ?? company_id ?? decoded?.company_id;
      console.log('[configuratorLogin] Login OK — company_id:', resolvedCompanyId);
      const configRoles = loginRes.user?.roles ?? [];
      const primaryConfigRole = configRoles[0];

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
        let roleCode: string | undefined = primaryConfigRole?.code;
        if (!roleCode && typeof (loginRes as any).user_role_id === 'number') {
          const roleRes = await configuratorService.getUserRole(loginRes.access_token, (loginRes as any).user_role_id);
          roleCode = roleRes?.code;
        }
        if (roleCode && hrmsUser.role !== roleCode) {
          updates.role = roleCode as import('@prisma/client').UserRole;
        }
        if (Object.keys(updates).length > 0) {
          await prisma.user.update({
            where: { id: hrmsUser.id },
            data: updates,
          });
          if (updates.role) (hrmsUser as any).role = updates.role;
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
          let configRole: string | undefined = primaryConfigRole?.code;
          if (!configRole) {
            const roleId = primaryConfigRole?.id ?? (loginRes as any).user_role_id ?? (loginRes.user as any)?.role_id;
            if (typeof roleId === 'number') {
              const roleRes = await configuratorService.getUserRole(loginRes.access_token, roleId);
              configRole = roleRes?.code;
            }
          }
          if (!configRole) {
            throw new AppError(
              'User has no role assigned. Assign a role in Configurator and try again.',
              403
            );
          }
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

      // Resolve role: prefer Configurator role, fall back to HRMS user role
      const roleFromConfig = (hrmsUser as any).role as string;

      // Fetch modules for the logged-in user.
      // Priority: 1) my-modules API (user's assigned modules), 2) role-module permissions, 3) empty
      let modules: any[] = [];
      try {
        // Try direct my-modules endpoint first (returns user's modules for the HRMS project)
        const directModules = await configuratorService.getModules(loginRes.access_token);
        if (directModules.length > 0) {
          console.log('[configuratorLogin] Got', directModules.length, 'modules from my-modules API');
          modules = directModules.map((m) => {
            // Resolve path: use page_name if set, otherwise look up by module name
            const resolvedPath = m.page_name || m.path || MODULE_NAME_TO_PATH[(m.name || '').toLowerCase()] || '';
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
        } else {
          // Fallback: role-module permissions
          const roleId =
            loginRes.user?.roles?.[0]?.id ?? config.configuratorRoleIds[String(hrmsUser.role)];
          if (roleId != null) {
            const roleModules = await configuratorService.getRoleModulesByProject(
              loginRes.access_token,
              roleId
            );
            modules = mapRoleModulesToFrontend(roleModules);
          }
        }
      } catch (modErr: any) {
        console.warn('[configuratorLogin] Modules fetch failed, returning empty:', modErr?.message);
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

      const userResponse = {
        id: hrmsUser.id,
        email: hrmsUser.email,
        role: roleFromConfig,
        isEmailVerified: hrmsUser.isEmailVerified,
        employee: hrmsUser.employee,
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
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new AppError('Authorization header with Bearer token is required', 401);
      }
      const token = authHeader.split(' ')[1];
      const projectId = req.query.project_id ? Number(req.query.project_id) : undefined;
      const modules = await configuratorService.getModules(token, projectId);

      return res.status(200).json({
        status: 'success',
        data: { modules },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Configurator token refresh
   * POST /api/v1/auth/configurator/refresh
   */
  async configuratorRefreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      const { refresh_token } = req.body;
      const resData = await configuratorService.refreshToken(refresh_token);

      return res.status(200).json({
        status: 'success',
        message: 'Token refreshed successfully',
        data: {
          access_token: resData.access_token,
          refresh_token: resData.refresh_token,
          token_type: resData.token_type || 'bearer',
          user: resData.user,
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
        select: {
          role: true,
          configuratorAccessToken: true,
        },
      });

      if (!user || !user.configuratorAccessToken) {
        return res.status(200).json({ status: 'success', data: { modules: [] } });
      }

      // Try my-modules API first (user's assigned modules)
      const directModules = await configuratorService.getModules(user.configuratorAccessToken);
      if (directModules.length > 0) {
        const modules = directModules.map((m) => {
          const resolvedPath = m.page_name || m.path || MODULE_NAME_TO_PATH[(m.name || '').toLowerCase()] || '';
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
      }

      // Fallback: role-module permissions
      const roleId = config.configuratorRoleIds[String(user.role)];
      if (roleId == null) {
        return res.status(200).json({ status: 'success', data: { modules: [] } });
      }

      const roleModules = await configuratorService.getRoleModulesByProject(
        user.configuratorAccessToken,
        roleId
      );

      const modules = mapRoleModulesToFrontend(roleModules);

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
