
import { hashPassword, comparePassword, generateToken } from '../utils/password';
import { prisma } from '../utils/prisma';
import { generateTokenPair, verifyToken, JwtPayload } from '../utils/jwt';
import { emailService } from './email.service';
import { AppError } from '../middlewares/errorHandler';
import {
  RegisterInput,
  LoginInput,
  ForgotPasswordInput,
  ResetPasswordInput,
} from '../utils/validation';
import { userHasPermission } from '../utils/permission-cache';

export class AuthService {
  private isDatabaseConnectivityError(error: unknown): boolean {
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
  }

  /**
   * Register a new user
   */
  async register(data: RegisterInput) {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new AppError('Email already registered', 400);
    }

    // Hash password
    const passwordHash = await hashPassword(data.password);

    // Generate email verification token
    const emailVerificationToken = generateToken();

    // Handle organization - use existing or default
    // Note: Only HRMS_ADMIN (SUPER_ADMIN) can create organizations via separate endpoint
    let organization;
    
    if (data.organizationId) {
      // Use existing organization
      organization = await prisma.organization.findUnique({
        where: { id: data.organizationId },
      });

      if (!organization) {
        throw new AppError('Organization not found', 404);
      }
    } else {
      // Fallback: Get or create default organization (for backward compatibility)
      const defaultOrgId = '00000000-0000-0000-0000-000000000001';
      organization = await prisma.organization.findUnique({
        where: { id: defaultOrgId },
      });

      if (!organization) {
        // Create default organization if it doesn't exist
        organization = await prisma.organization.create({
          data: {
            id: defaultOrgId,
            name: 'BNC Technologies',
            legalName: 'BNC Technologies Pvt Ltd',
            industry: 'Information Technology',
            sizeRange: '51-200',
            timezone: 'Asia/Kolkata',
            currency: 'INR',
            fiscalYearStart: new Date('2026-04-01'),
            address: {},
            settings: {},
          },
        });
      }
    }

    // Determine user role - use provided role or default to EMPLOYEE
    // Note: ORG_ADMIN can only be created by HRMS_ADMIN via separate endpoint
    const userRole = data.role || 'EMPLOYEE';

    // Create user
    // NOTE: Email verification is commented out for testing - users are auto-verified
    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        role: userRole,
        organizationId: organization.id,
        emailVerificationToken,
        isEmailVerified: true, // Auto-verify for testing (was: false)
      },
    });

    // Generate employee code
    const employeeCount = await prisma.employee.count({
      where: { organizationId: organization.id },
    });
    const employeeCode = `EMP${(employeeCount + 1).toString().padStart(5, '0')}`;

    // Create employee record (basic info)
    await prisma.employee.create({
      data: {
        organizationId: organization.id,
        employeeCode,
        userId: user.id,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        employeeStatus: 'ACTIVE',
        dateOfJoining: new Date(),
      },
    });

    // Send verification email - COMMENTED OUT FOR TESTING
    // await emailService.sendVerificationEmail(data.email, emailVerificationToken);

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
    };
  }

  /**
   * Login user
   */
  async login(data: LoginInput) {
    // Normalize email (trim) and find with case-insensitive match (PostgreSQL is case-sensitive by default)
    const emailInput = (data.email || '').trim();
    if (!emailInput) {
      throw new AppError('Invalid email or password', 401);
    }
    // Find user by email (case-insensitive so Admin@hrms.com and admin@hrms.com both work)
    const user = await prisma.user.findFirst({
      where: {
        email: { equals: emailInput, mode: 'insensitive' },
      },
      include: {
        employee: {
          select: {
            id: true,
            organizationId: true,
            firstName: true,
            lastName: true,
            profilePictureUrl: true,
            employeeStatus: true,
          },
        },
      },
    });

    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    // Check if user is active
    if (!user.isActive) {
      throw new AppError('Your account has been deactivated', 401);
    }

    // Block login if employee is separated (status !== ACTIVE)
    if (user.employee?.employeeStatus && user.employee.employeeStatus !== 'ACTIVE') {
      throw new AppError('Your employment has been separated. You cannot log in.', 401);
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / (1000 * 60)
      );
      throw new AppError(
        `Account is locked. Please try again in ${minutesLeft} minutes`,
        401
      );
    }

    // Verify password
    const isPasswordValid = await comparePassword(data.password, user.passwordHash);

    if (!isPasswordValid) {
      // Increment login attempts
      const loginAttempts = user.loginAttempts + 1;
      const updateData: any = { loginAttempts };

      // Lock account after 5 failed attempts
      if (loginAttempts >= 5) {
        updateData.lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // Lock for 30 minutes
        updateData.loginAttempts = 0;
      }

      await prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });

      throw new AppError('Invalid email or password', 401);
    }

    // Generate tokens
    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const tokens = generateTokenPair(payload);

    // Update user: reset login attempts, set refresh token, update last login
    await prisma.user.update({
      where: { id: user.id },
      data: {
        loginAttempts: 0,
        lockedUntil: null,
        refreshToken: tokens.refreshToken,
        lastLoginAt: new Date(),
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        employee: user.employee,
      },
      tokens,
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string) {
    try {
      // Verify refresh token
      const decoded = verifyToken(refreshToken);

      // Find user and verify refresh token matches
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
      });

      if (!user || user.refreshToken !== refreshToken) {
        throw new AppError('Invalid refresh token', 401);
      }

      if (!user.isActive) {
        throw new AppError('Your account has been deactivated', 401);
      }

      // Generate new tokens
      const payload: JwtPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
      };

      const tokens = generateTokenPair(payload);

      // Update refresh token
      await prisma.user.update({
        where: { id: user.id },
        data: { refreshToken: tokens.refreshToken },
      });

      return tokens;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      if (this.isDatabaseConnectivityError(error)) {
        throw new AppError('Authentication service temporarily unavailable. Please try again.', 503);
      }
      throw new AppError('Invalid or expired refresh token', 401);
    }
  }

  /**
   * Verify email
   */
  async verifyEmail(token: string) {
    const user = await prisma.user.findFirst({
      where: { emailVerificationToken: token },
      include: {
        employee: {
          select: {
            firstName: true,
          },
        },
      },
    });

    if (!user) {
      throw new AppError('Invalid or expired verification token', 400);
    }

    if (user.isEmailVerified) {
      throw new AppError('Email already verified', 400);
    }

    // Update user
    await prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        emailVerificationToken: null,
      },
    });

    // Send welcome email
    if (user.employee) {
      await emailService.sendWelcomeEmail(user.email, user.employee.firstName);
    }

    return { message: 'Email verified successfully' };
  }

  /**
   * Request password reset
   */
  async forgotPassword(data: ForgotPasswordInput) {
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    // Don't reveal if email exists or not (security)
    if (!user) {
      return { message: 'If the email exists, a reset link has been sent' };
    }

    // Generate reset token
    const resetToken = generateToken();
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Save token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires,
      },
    });

    // Send reset email
    await emailService.sendPasswordResetEmail(data.email, resetToken);

    return { message: 'If the email exists, a reset link has been sent' };
  }

  /**
   * Reset password
   */
  async resetPassword(data: ResetPasswordInput) {
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: data.token,
        passwordResetExpires: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      throw new AppError('Invalid or expired reset token', 400);
    }

    // Hash new password
    const passwordHash = await hashPassword(data.newPassword);

    // Update user
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
        refreshToken: null, // Invalidate all sessions
      },
    });

    // Send confirmation email
    await emailService.sendPasswordChangedEmail(user.email);

    return { message: 'Password reset successfully' };
  }

  /**
   * Logout user
   */
  async logout(userId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        refreshToken: null,
        configuratorAccessToken: null,
        configuratorRefreshToken: null,
      },
    });

    return { message: 'Logged out successfully' };
  }

  /**
   * Get current user profile
   */
  async getCurrentUser(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        isEmailVerified: true,
        isActive: true,
        createdAt: true,
        organizationId: true,
        employee: {
          select: {
            id: true,
            organizationId: true,
            employeeCode: true,
            firstName: true,
            middleName: true,
            lastName: true,
            phone: true,
            dateOfBirth: true,
            gender: true,
            profilePictureUrl: true,
            paygroup: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
            department: {
              select: {
                id: true,
                name: true,
              },
            },
            position: {
              select: {
                id: true,
                title: true,
              },
            },
            organization: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Log warning if user has org admin role but no employee record
    if (user.role === 'ORG_ADMIN' && !user.employee) {
      console.warn(`⚠️  ORG_ADMIN user ${user.email} (${userId}) does not have an employee record`);
      // Don't throw error, but log warning - the frontend will handle this
    }

    return user;
  }

  /**
   * Admin reset password for employee
   * Requires can_edit permission on /employees
   */
  async adminResetPassword(
    adminUserId: string,
    employeeId: string,
    newPassword: string
  ) {
    // Get admin user
    const admin = await prisma.user.findUnique({
      where: { id: adminUserId },
      select: { id: true },
    });

    if (!admin) {
      throw new AppError('Admin user not found', 404);
    }

    // Check if admin has permission to edit employees
    if (!userHasPermission(adminUserId, '/employees', 'can_edit')) {
      throw new AppError('You do not have permission to reset passwords', 403);
    }

    // Get employee
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { user: true },
    });

    if (!employee || !employee.user) {
      throw new AppError('Employee not found or has no user account', 404);
    }

    // Verify admin belongs to the same organization (unless they have org-wide access)
    if (!userHasPermission(adminUserId, '/organizations', 'can_edit')) {
      const adminEmployee = await prisma.employee.findUnique({
        where: { userId: adminUserId },
      });

      if (!adminEmployee || adminEmployee.organizationId !== employee.organizationId) {
        throw new AppError('You can only reset passwords for employees in your organization', 403);
      }
    }

    // Hash new password
    const passwordHash = await hashPassword(newPassword);

    // Update user password
    await prisma.user.update({
      where: { id: employee.userId },
      data: {
        passwordHash,
        refreshToken: null, // Invalidate all sessions
      },
    });

    return {
      message: 'Password reset successfully',
      email: employee.email,
    };
  }

  /**
   * Change password
   */
  async changePassword(userId: string, data: { currentPassword: string; newPassword: string }) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Verify current password
    const isPasswordValid = await comparePassword(data.currentPassword, user.passwordHash);

    if (!isPasswordValid) {
      throw new AppError('Current password is incorrect', 400);
    }

    // Hash new password
    const passwordHash = await hashPassword(data.newPassword);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        refreshToken: null, // Invalidate all sessions
      },
    });

    // Send confirmation email (commented out for testing)
    // await emailService.sendPasswordChangedEmail(user.email);

    return { message: 'Password changed successfully' };
  }

  /**
   * Sync password_hash in HRMS DB after Configurator password reset.
   * Stores the encrypted_password returned by Configurator directly as password_hash
   * (same logic as employee create flow).
   */
  async syncPasswordHash(userId: string, encryptedPassword: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: encryptedPassword },
    });
    return { message: 'Password hash synced' };
  }

  /**
   * Update profile
   */
  async updateProfile(userId: string, data: { firstName?: string; lastName?: string; phone?: string }) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { employee: true },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (!user.employee) {
      throw new AppError('Employee record not found', 404);
    }

    // Update employee record
    const updateData: any = {};
    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.phone !== undefined) updateData.phone = data.phone;

    await prisma.employee.update({
      where: { id: user.employee.id },
      data: updateData,
    });

    // Get updated user
    const updatedUser = await this.getCurrentUser(userId);

    return updatedUser;
  }
}

export const authService = new AuthService();
