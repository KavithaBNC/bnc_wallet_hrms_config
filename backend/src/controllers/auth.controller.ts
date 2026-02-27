import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { AppError } from '../middlewares/errorHandler';

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
   * Login user
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
