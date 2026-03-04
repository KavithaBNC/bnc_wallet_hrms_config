import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { configuratorService } from '../services/configurator.service';
import { AppError } from '../middlewares/errorHandler';
import { generateTokenPair, JwtPayload } from '../utils/jwt';
import { prisma } from '../utils/prisma';
import { config } from '../config/config';

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
   * POST /api/v1/auth/configurator/login
   * Body: { username, password, company_id }
   */
  async configuratorLogin(req: Request, res: Response, next: NextFunction) {
    try {
      let { username, password, company_id } = req.body;
      if (!company_id && config.configuratorDefaultCompanyId) {
        company_id = config.configuratorDefaultCompanyId;
      }
      if (!company_id) {
        throw new AppError('company_id is required. Set CONFIGURATOR_DEFAULT_COMPANY_ID in .env or pass in request.', 400);
      }
      const loginRes = await configuratorService.login({ username, password, company_id });

      const decoded = configuratorService.decodeToken(loginRes.access_token);
      const configuratorUserId = decoded?.sub ? parseInt(decoded.sub, 10) : null;
      const email = decoded?.email || username;
      const companyId = decoded?.company_id ?? company_id;

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

      if (hrmsUser && configuratorUserId != null && hrmsUser.configuratorUserId !== configuratorUserId) {
        await prisma.user.update({
          where: { id: hrmsUser.id },
          data: { configuratorUserId },
        });
      }

      if (!hrmsUser) {
        const org = await prisma.organization.findFirst({
          where: { configuratorCompanyId: company_id },
        });
        if (!org) {
          throw new AppError(
            `Organization for company ${company_id} not found in HRMS. Please sync company first.`,
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
          if (!config.configuratorDefaultRole) {
            throw new AppError(
              'CONFIGURATOR_DEFAULT_ROLE must be set in .env for auto-creating users',
              500
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
                role: config.configuratorDefaultRole as any,
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

      // Fetch user-assigned modules via /api/v1/user-role-modules/ (role_module_permissions)
      let modules: any[] = [];
      try {
        const roleId =
          loginRes.user?.roles?.[0]?.id ?? config.configuratorRoleIds[String(hrmsUser.role)];
        if (roleId != null && companyId != null) {
          modules = await configuratorService.getUserAssignedModules(
            loginRes.access_token,
            roleId,
            companyId
          );
        }
      } catch (modErr: any) {
        console.warn('Configurator modules fetch failed, returning empty:', modErr?.message);
      }

      const payload: JwtPayload = {
        userId: hrmsUser.id,
        email: hrmsUser.email,
        role: hrmsUser.role,
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

      const userResponse = {
        id: hrmsUser.id,
        email: hrmsUser.email,
        role: hrmsUser.role,
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
        },
      });
    } catch (error) {
      return next(error);
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
