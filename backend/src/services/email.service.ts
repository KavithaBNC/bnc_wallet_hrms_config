import nodemailer from 'nodemailer';
import { config } from '../config/config';
import { logger } from '../utils/logger';

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPassword,
      },
    });
  }

  /**
   * Send email verification
   */
  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const verificationUrl = `${config.frontendUrl}/verify-email?token=${token}`;

    try {
      await this.transporter.sendMail({
        from: config.emailFrom,
        to: email,
        subject: 'Verify Your Email - HRMS Portal',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Welcome to HRMS Portal 2026!</h2>
            <p>Thank you for registering. Please verify your email address by clicking the button below:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}"
                 style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Verify Email
              </a>
            </div>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
            <p style="color: #999; font-size: 12px; margin-top: 30px;">
              This link will expire in 24 hours. If you didn't create an account, please ignore this email.
            </p>
          </div>
        `,
      });

      logger.info(`Verification email sent to ${email}`);
    } catch (error) {
      logger.error('Error sending verification email:', error);
      throw new Error('Failed to send verification email');
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const resetUrl = `${config.frontendUrl}/reset-password?token=${token}`;

    try {
      await this.transporter.sendMail({
        from: config.emailFrom,
        to: email,
        subject: 'Password Reset Request - HRMS Portal',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Password Reset Request</h2>
            <p>We received a request to reset your password. Click the button below to proceed:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}"
                 style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Reset Password
              </a>
            </div>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666;">${resetUrl}</p>
            <p style="color: #999; font-size: 12px; margin-top: 30px;">
              This link will expire in 1 hour. If you didn't request a password reset, please ignore this email.
            </p>
          </div>
        `,
      });

      logger.info(`Password reset email sent to ${email}`);
    } catch (error) {
      logger.error('Error sending password reset email:', error);
      throw new Error('Failed to send password reset email');
    }
  }

  /**
   * Send welcome email (after email verification)
   */
  async sendWelcomeEmail(email: string, firstName: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: config.emailFrom,
        to: email,
        subject: 'Welcome to HRMS Portal 2026!',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Welcome ${firstName}!</h2>
            <p>Your email has been verified successfully. You can now access all features of HRMS Portal.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${config.frontendUrl}/dashboard"
                 style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Go to Dashboard
              </a>
            </div>
            <p>If you have any questions, please don't hesitate to contact our support team.</p>
          </div>
        `,
      });

      logger.info(`Welcome email sent to ${email}`);
    } catch (error) {
      logger.error('Error sending welcome email:', error);
      // Don't throw error for welcome email
    }
  }

  /**
   * Send welcome email with login credentials to a newly created employee.
   * Fire-and-forget — errors are logged but don't block employee creation.
   */
  async sendEmployeeCredentialsEmail(
    toEmail: string,
    firstName: string,
    loginEmail: string,
    temporaryPassword: string,
  ): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: config.emailFrom,
        to: toEmail,
        subject: 'Welcome to HRMS - Your Login Credentials',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
            <div style="background: linear-gradient(135deg, #f97316, #ea580c); padding: 24px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Welcome to HRMS!</h1>
            </div>
            <div style="padding: 32px 24px;">
              <p style="font-size: 16px; color: #374151;">Hi <strong>${firstName}</strong>,</p>
              <p style="font-size: 15px; color: #4b5563;">Congratulations! Your employee account has been successfully created. You can now log in to the HRMS Portal using the credentials below.</p>

              <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 24px 0;">
                <h3 style="margin: 0 0 12px 0; color: #111827; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Your Login Credentials</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 100px;">Email</td>
                    <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${loginEmail}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Password</td>
                    <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600; font-family: monospace; background: #fef3c7; padding: 4px 8px; border-radius: 4px;">${temporaryPassword}</td>
                  </tr>
                </table>
              </div>

              <div style="text-align: center; margin: 24px 0;">
                <a href="${config.frontendUrl || 'http://localhost:3000'}/login"
                   style="background-color: #f97316; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; font-size: 15px;">
                  Login Now
                </a>
              </div>

              <p style="font-size: 13px; color: #9ca3af; margin-top: 24px;">Please change your password after your first login for security purposes.</p>
            </div>
            <div style="background: #f3f4f6; padding: 16px 24px; text-align: center;">
              <p style="font-size: 12px; color: #9ca3af; margin: 0;">This is an automated message from HRMS. Please do not reply.</p>
            </div>
          </div>
        `,
      });
      logger.info(`Employee credentials email sent to ${toEmail}`);
    } catch (error) {
      logger.error('Error sending employee credentials email:', error);
      // Fire-and-forget — don't throw
    }
  }

  /**
   * Send password changed confirmation email
   */
  async sendPasswordChangedEmail(email: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: config.emailFrom,
        to: email,
        subject: 'Password Changed - HRMS Portal',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Password Changed Successfully</h2>
            <p>Your password has been changed successfully.</p>
            <p>If you didn't make this change, please contact our support team immediately.</p>
            <div style="color: #999; font-size: 12px; margin-top: 30px;">
              <p>Date: ${new Date().toLocaleString()}</p>
            </div>
          </div>
        `,
      });

      logger.info(`Password changed email sent to ${email}`);
    } catch (error) {
      logger.error('Error sending password changed email:', error);
      // Don't throw error for notification email
    }
  }

  /**
   * Send leave request submitted notification
   */
  async sendLeaveRequestSubmittedEmail(
    employeeEmail: string,
    employeeName: string,
    leaveType: string,
    startDate: string,
    endDate: string,
    totalDays: number
  ): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: config.emailFrom,
        to: employeeEmail,
        subject: 'Leave Request Submitted - HRMS Portal',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Leave Request Submitted</h2>
            <p>Hi ${employeeName},</p>
            <p>Your leave request has been submitted successfully and is pending approval.</p>
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Leave Type:</strong> ${leaveType}</p>
              <p><strong>Start Date:</strong> ${startDate}</p>
              <p><strong>End Date:</strong> ${endDate}</p>
              <p><strong>Total Days:</strong> ${totalDays}</p>
            </div>
            <p>You will be notified once your manager reviews the request.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${config.frontendUrl}/leaves/requests"
                 style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                View Leave Requests
              </a>
            </div>
          </div>
        `,
      });

      logger.info(`Leave request submitted email sent to ${employeeEmail}`);
    } catch (error) {
      logger.error('Error sending leave request submitted email:', error);
      // Don't throw error for notification email
    }
  }

  /**
   * Send leave request approval notification to manager
   */
  async sendLeaveRequestPendingEmail(
    managerEmail: string,
    managerName: string,
    employeeName: string,
    leaveType: string,
    startDate: string,
    endDate: string,
    requestId: string
  ): Promise<void> {
    const approvalUrl = `${config.frontendUrl}/leaves/requests/${requestId}`;

    try {
      await this.transporter.sendMail({
        from: config.emailFrom,
        to: managerEmail,
        subject: `Leave Request Pending Approval - ${employeeName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Leave Request Pending Approval</h2>
            <p>Hi ${managerName},</p>
            <p><strong>${employeeName}</strong> has submitted a leave request that requires your approval.</p>
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Employee:</strong> ${employeeName}</p>
              <p><strong>Leave Type:</strong> ${leaveType}</p>
              <p><strong>Start Date:</strong> ${startDate}</p>
              <p><strong>End Date:</strong> ${endDate}</p>
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${approvalUrl}"
                 style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Review Request
              </a>
            </div>
          </div>
        `,
      });

      logger.info(`Leave request pending email sent to ${managerEmail}`);
    } catch (error) {
      logger.error('Error sending leave request pending email:', error);
      // Don't throw error for notification email
    }
  }

  /**
   * Send leave request approved notification
   */
  async sendLeaveRequestApprovedEmail(
    employeeEmail: string,
    employeeName: string,
    leaveType: string,
    startDate: string,
    endDate: string,
    reviewComments?: string
  ): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: config.emailFrom,
        to: employeeEmail,
        subject: 'Leave Request Approved - HRMS Portal',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #10b981;">Leave Request Approved ✅</h2>
            <p>Hi ${employeeName},</p>
            <p>Your leave request has been <strong style="color: #10b981;">approved</strong>!</p>
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Leave Type:</strong> ${leaveType}</p>
              <p><strong>Start Date:</strong> ${startDate}</p>
              <p><strong>End Date:</strong> ${endDate}</p>
              ${reviewComments ? `<p><strong>Comments:</strong> ${reviewComments}</p>` : ''}
            </div>
            <p>Enjoy your time off!</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${config.frontendUrl}/leaves/requests"
                 style="background-color: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                View Leave Requests
              </a>
            </div>
          </div>
        `,
      });

      logger.info(`Leave request approved email sent to ${employeeEmail}`);
    } catch (error) {
      logger.error('Error sending leave request approved email:', error);
      // Don't throw error for notification email
    }
  }

  /**
   * Send leave request rejected notification
   */
  async sendLeaveRequestRejectedEmail(
    employeeEmail: string,
    employeeName: string,
    leaveType: string,
    startDate: string,
    endDate: string,
    reviewComments: string
  ): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: config.emailFrom,
        to: employeeEmail,
        subject: 'Leave Request Rejected - HRMS Portal',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #ef4444;">Leave Request Rejected</h2>
            <p>Hi ${employeeName},</p>
            <p>Unfortunately, your leave request has been <strong style="color: #ef4444;">rejected</strong>.</p>
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Leave Type:</strong> ${leaveType}</p>
              <p><strong>Start Date:</strong> ${startDate}</p>
              <p><strong>End Date:</strong> ${endDate}</p>
              <p><strong>Reason:</strong> ${reviewComments}</p>
            </div>
            <p>If you have any questions, please contact your manager.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${config.frontendUrl}/leaves/requests"
                 style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                View Leave Requests
              </a>
            </div>
          </div>
        `,
      });

      logger.info(`Leave request rejected email sent to ${employeeEmail}`);
    } catch (error) {
      logger.error('Error sending leave request rejected email:', error);
      // Don't throw error for notification email
    }
  }
}

export const emailService = new EmailService();
