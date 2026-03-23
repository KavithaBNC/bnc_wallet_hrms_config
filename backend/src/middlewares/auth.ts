import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { verifyToken, JwtPayload } from '../utils/jwt';
import { AppError } from './errorHandler';
import { prisma } from '../utils/prisma';
import { config } from '../config/config';
import { userHasPermission } from '../utils/permission-cache';

const isDatabaseConnectivityError = (error: unknown): boolean => {
  const prismaErr = error as { code?: string; message?: string };
  const code = prismaErr?.code;
  const message = String(prismaErr?.message || '').toLowerCase();
  return (
    code === 'P1001' ||
    code === 'P1017' ||
    code === 'P2024' ||
    message.includes('connection pool') ||
    message.includes("can't reach database server") ||
    message.includes('server has closed the connection') ||
    message.includes('connectionreset')
  );
};

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Middleware to authenticate user using JWT
 */
export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  // Get token from Authorization header
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('No token provided. Please authenticate.', 401));
  }

  const token = authHeader.split(' ')[1];

  try {

    // Verify token
    const decoded = verifyToken(token);

    // Check if user exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    if (!user) {
      throw new AppError('User no longer exists.', 401);
    }

    if (!user.isActive) {
      throw new AppError('Your account has been deactivated.', 401);
    }

    // Attach user to request
    req.user = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
    if (isDatabaseConnectivityError(error)) {
      return next(new AppError('Database temporarily unavailable. Please try again.', 503));
    }

    // Fallback: try decoding as a Configurator API token
    try {
      const decoded = jwt.decode(token) as {
        sub?: string;
        email?: string;
        company_id?: number;
        exp?: number;
      } | null;

      if (!decoded || !decoded.exp || decoded.exp * 1000 < Date.now()) {
        throw new Error('Token expired or invalid');
      }

      const email = decoded.email;
      const configuratorUserId = decoded.sub ? parseInt(decoded.sub, 10) : null;

      if (!email && !configuratorUserId) {
        throw new Error('No identifiers in token');
      }

      // Look up HRMS user by email (primary) or configuratorUserId (fallback)
      let user = await prisma.user.findFirst({
        where: email
          ? { email: { equals: email, mode: 'insensitive' } }
          : { configuratorUserId: configuratorUserId! },
        select: { id: true, email: true, role: true, isActive: true },
      });

      // Auto-create HRMS user from Configurator token if not found
      if (!user && email) {
        try {
          // Find an organization linked to this company, or create one
          let org = decoded.company_id
            ? await prisma.organization.findFirst({ where: { configuratorCompanyId: decoded.company_id } })
            : await prisma.organization.findFirst();

          // If no org found, auto-create one from the Configurator company data
          if (!org && decoded.company_id) {
            try {
              const companyName = `Company_${decoded.company_id}`;
              org = await prisma.organization.create({
                data: {
                  name: companyName,
                  legalName: companyName,
                  configuratorCompanyId: decoded.company_id,
                },
              });
              console.log('[auth] Auto-created organization for company_id:', decoded.company_id);
            } catch {
              // Another concurrent request may have created the org — retry lookup
              org = await prisma.organization.findFirst({ where: { configuratorCompanyId: decoded.company_id } });
            }
          }

          if (org) {
            // Clear stale configurator_user_id before create (unique constraint)
            if (configuratorUserId != null) {
              await prisma.$executeRaw`UPDATE users SET configurator_user_id = NULL WHERE configurator_user_id = ${configuratorUserId}`;
              await prisma.$executeRaw`UPDATE employees SET configurator_user_id = NULL WHERE configurator_user_id = ${configuratorUserId}`;
            }
            const nameParts = email.split('@')[0].split(/[._]/);
            const firstName = nameParts[0] || 'User';
            const lastName = nameParts.slice(1).join(' ') || ' ';
            const prefix = (org as any).employeeIdPrefix || 'EMP';
            const nextNum = ((org as any).employeeIdNextNumber ?? 0) + 1;
            const employeeCode = `${prefix}${nextNum.toString().padStart(2, '0')}`;
            try {
              const newUser = await prisma.user.create({
                data: {
                  email,
                  passwordHash: config.configuratorPlaceholderPasswordHash,
                  role: 'SUPER_ADMIN' as any,
                  organizationId: org.id,
                  configuratorUserId: configuratorUserId ?? undefined,
                  isEmailVerified: true,
                },
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
              user = { id: newUser.id, email: newUser.email, role: newUser.role, isActive: true };
              console.log('[auth] Auto-created HRMS user from Configurator token:', email);
            } catch {
              // Another concurrent request may have created the user — retry lookup
              user = await prisma.user.findFirst({
                where: { email: { equals: email, mode: 'insensitive' } },
                select: { id: true, email: true, role: true, isActive: true },
              });
            }
          }
        } catch (autoCreateErr) {
          console.warn('[auth] Failed to auto-create HRMS user:', (autoCreateErr as any)?.message);
          // Retry user lookup — another concurrent request may have created it
          user = await prisma.user.findFirst({
            where: email
              ? { email: { equals: email, mode: 'insensitive' } }
              : { configuratorUserId: configuratorUserId! },
            select: { id: true, email: true, role: true, isActive: true },
          });
        }
      }

      if (!user) {
        throw new AppError('User not found in HRMS.', 401);
      }
      if (!user.isActive) {
        throw new AppError('Your account has been deactivated.', 401);
      }

      req.user = {
        userId: user.id,
        email: user.email,
        role: user.role,
      };

      next();
    } catch (fallbackError) {
      if (fallbackError instanceof AppError) return next(fallbackError);
      if (isDatabaseConnectivityError(fallbackError)) {
        return next(new AppError('Database temporarily unavailable. Please try again.', 503));
      }
      next(new AppError('Invalid or expired token.', 401));
    }
  }
};

/**
 * Middleware for PUT /employees/:id
 * Users with can_edit on /employees can update any employee.
 * Others can only update their own profile.
 */
export const authorizeEmployeeUpdate = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return next(new AppError('You must be logged in to access this resource.', 401));
  }

  // Users with edit permission can update any employee
  if (userHasPermission(req.user.userId, '/employees', 'can_edit')) {
    return next();
  }

  // Others: allow only when updating their own employee record
  const employeeId = req.params.id;
  const employee = await prisma.employee.findUnique({
    where: { userId: req.user.userId },
    select: { id: true },
  });
  if (employee && employee.id === employeeId) {
    return next();
  }

  return next(
    new AppError(
      'You do not have permission to update this employee. You can only update your own profile.',
      403
    )
  );
};

/**
 * Middleware to check if user is accessing their own resource
 */
export const authorizeOwner = (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) {
    return next(new AppError('You must be logged in to access this resource.', 401));
  }

  const resourceUserId = req.params.userId || req.params.id;

  const hasOrgAccess = userHasPermission(req.user.userId, '/organizations', 'can_edit');
  if (req.user.userId !== resourceUserId && !hasOrgAccess) {
    return next(
      new AppError('You do not have permission to access this resource.', 403)
    );
  }

  next();
};

/**
 * Optional authentication - attach user if token is valid, but don't fail if not
 */
export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      let user: { id: string; email: string; role: string; isActive: boolean } | null = null;

      // Try HRMS token first
      try {
        const decoded = verifyToken(token);
        user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: { id: true, email: true, role: true, isActive: true },
        });
      } catch {
        // Fallback: try Configurator token
        const decoded = jwt.decode(token) as { sub?: string; email?: string; exp?: number } | null;
        if (decoded?.email && decoded.exp && decoded.exp * 1000 >= Date.now()) {
          user = await prisma.user.findFirst({
            where: { email: { equals: decoded.email, mode: 'insensitive' } },
            select: { id: true, email: true, role: true, isActive: true },
          });
        }
      }

      if (user && user.isActive) {
        req.user = {
          userId: user.id,
          email: user.email,
          role: user.role,
        };
      }
    }

    next();
  } catch (error) {
    // Ignore errors for optional auth
    next();
  }
};
