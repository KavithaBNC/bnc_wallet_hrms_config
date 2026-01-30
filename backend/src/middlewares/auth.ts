import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '../utils/jwt';
import { AppError } from './errorHandler';
import { UserRole } from '@prisma/client';
import { prisma } from '../utils/prisma';

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
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('No token provided. Please authenticate.', 401);
    }

    const token = authHeader.split(' ')[1];

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
      next(error);
    } else {
      next(new AppError('Invalid or expired token.', 401));
    }
  }
};

/**
 * Middleware to check if user has required role(s)
 */
export const authorize = (...roles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('You must be logged in to access this resource.', 401));
    }

    if (!roles.includes(req.user.role as UserRole)) {
      return next(
        new AppError(
          `You do not have permission to access this resource. Required roles: ${roles.join(', ')}`,
          403
        )
      );
    }

    next();
  };
};

/**
 * Middleware for PUT /employees/:id
 * - SUPER_ADMIN, ORG_ADMIN, HR_MANAGER: can update any employee (no permission check).
 * - MANAGER, EMPLOYEE: can update only their own profile (tab-level permissions enforced by frontend/service).
 */
export const authorizeEmployeeUpdate = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return next(new AppError('You must be logged in to access this resource.', 401));
  }

  const role = req.user.role as UserRole;
  const allowedRoles: UserRole[] = ['SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'];

  if (allowedRoles.includes(role)) {
    return next();
  }

  // MANAGER and EMPLOYEE: allow only when updating their own employee record
  if (role === 'MANAGER' || role === 'EMPLOYEE') {
    const employeeId = req.params.id;
    const employee = await prisma.employee.findUnique({
      where: { userId: req.user.userId },
      select: { id: true },
    });
    if (employee && employee.id === employeeId) {
      return next();
    }
  }

  return next(
    new AppError(
      'You do not have permission to access this resource. Required roles: SUPER_ADMIN, ORG_ADMIN, HR_MANAGER, or you can only update your own profile.',
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

  if (req.user.userId !== resourceUserId && req.user.role !== 'SUPER_ADMIN') {
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
      const decoded = verifyToken(token);

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
        },
      });

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
