import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { validate } from '../middlewares/validate';
import { authenticate, authorize } from '../middlewares/auth';
import {
  registerSchema,
  configuratorLoginSchema,
  configuratorRefreshSchema,
  refreshTokenSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  updateProfileSchema,
} from '../utils/validation';

const router = Router();

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post(
  '/register',
  validate(registerSchema),
  authController.register.bind(authController)
);

/**
 * @route   POST /api/v1/auth/login
 * @desc    DISABLED — login must go through Configurator (/auth/configurator/login).
 *          Kept as a clear error so clients using the old endpoint get a helpful message.
 * @access  Public
 */
router.post('/login', (_req, res) => {
  return res.status(410).json({
    status: 'fail',
    message: 'This login endpoint is disabled. Use /api/v1/auth/configurator/login instead.',
  });
});

/**
 * @route   POST /api/v1/auth/configurator/login
 * @desc    Login via Configurator API - returns tokens + assigned modules
 * @access  Public
 * @body    { username, password, company_id }
 */
router.post(
  '/configurator/login',
  validate(configuratorLoginSchema),
  authController.configuratorLogin.bind(authController)
);

/**
 * @route   GET /api/v1/auth/configurator/modules
 * @desc    Get modules for user (pass Configurator Bearer token in Authorization header)
 * @access  Public (token in header)
 * @query   project_id (optional)
 */
router.get(
  '/configurator/modules',
  authController.getConfiguratorModules.bind(authController)
);

/**
 * @route   POST /api/v1/auth/configurator/refresh
 * @desc    Refresh Configurator token
 * @access  Public
 * @body    { refresh_token }
 */
router.post(
  '/configurator/refresh',
  validate(configuratorRefreshSchema),
  authController.configuratorRefreshToken.bind(authController)
);

/**
 * @route   POST /api/v1/auth/refresh-token
 * @desc    Refresh access token
 * @access  Public
 */
router.post(
  '/refresh-token',
  validate(refreshTokenSchema),
  authController.refreshToken.bind(authController)
);

/**
 * @route   POST /api/v1/auth/verify-email
 * @desc    Verify email address
 * @access  Public
 */
router.post(
  '/verify-email',
  validate(verifyEmailSchema),
  authController.verifyEmail.bind(authController)
);

/**
 * @route   POST /api/v1/auth/forgot-password
 * @desc    Request password reset
 * @access  Public
 */
router.post(
  '/forgot-password',
  validate(forgotPasswordSchema),
  authController.forgotPassword.bind(authController)
);

/**
 * @route   POST /api/v1/auth/reset-password
 * @desc    Reset password with token
 * @access  Public
 */
router.post(
  '/reset-password',
  validate(resetPasswordSchema),
  authController.resetPassword.bind(authController)
);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', authenticate, authController.logout.bind(authController));

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', authenticate, authController.getCurrentUser.bind(authController));

/**
 * @route   GET /api/v1/auth/modules
 * @desc    Get assigned modules for current user from Config DB
 * @access  Private
 */
router.get('/modules', authenticate, authController.getMyModules.bind(authController));

/**
 * @route   POST /api/v1/auth/admin/reset-password/:employeeId
 * @desc    Admin reset password for employee
 * @access  Private (SUPER_ADMIN, ORG_ADMIN, HR_MANAGER)
 */
router.post(
  '/admin/reset-password/:employeeId',
  authenticate,
  authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'),
  authController.adminResetPassword.bind(authController)
);

/**
 * @route   POST /api/v1/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.post(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  authController.changePassword.bind(authController)
);

/**
 * @route   POST /api/v1/auth/sync-password-hash
 * @desc    Update password_hash in HRMS DB after Configurator password reset
 * @access  Private
 */
router.post(
  '/sync-password-hash',
  authenticate,
  authController.syncPasswordHash.bind(authController)
);

/**
 * @route   PUT /api/v1/auth/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put(
  '/profile',
  authenticate,
  validate(updateProfileSchema),
  authController.updateProfile.bind(authController)
);

export default router;
