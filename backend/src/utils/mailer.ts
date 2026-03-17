/**
 * Mailer utility — thin wrapper around nodemailer.
 * Reads SMTP config from environment variables.
 * All methods are fire-and-forget safe (won't throw if env vars are missing).
 */

import nodemailer from 'nodemailer';

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const from = process.env.EMAIL_FROM || 'noreply@hrms.com';

  if (!host || !user || !pass) {
    return null; // SMTP not configured
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return { transporter, from };
}

export interface MailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType?: string;
  }>;
}

/**
 * Send an email. Returns true on success, false if SMTP is not configured or send fails.
 */
export async function sendMail(options: MailOptions): Promise<boolean> {
  const transport = createTransport();
  if (!transport) {
    console.warn('[mailer] SMTP not configured — skipping email to', options.to);
    return false;
  }

  try {
    await transport.transporter.sendMail({
      from: transport.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      attachments: options.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType || 'application/octet-stream',
      })),
    });
    return true;
  } catch (err) {
    console.error('[mailer] Failed to send email to', options.to, err);
    return false;
  }
}

/**
 * Send payslip email with attached PDF.
 */
export async function sendPayslipEmail(params: {
  toEmail: string;
  employeeName: string;
  month: string;
  year: number;
  pdfBuffer: Buffer;
}): Promise<boolean> {
  const { toEmail, employeeName, month, year, pdfBuffer } = params;
  const subject = `Your Payslip for ${month} ${year}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">Payslip — ${month} ${year}</h2>
      <p>Dear ${employeeName},</p>
      <p>Please find your payslip for <strong>${month} ${year}</strong> attached to this email.</p>
      <p>If you have any queries regarding your payslip, please contact the HR department.</p>
      <br/>
      <p style="color: #6b7280; font-size: 12px;">
        This is an auto-generated email from the HRMS system. Please do not reply to this email.
      </p>
    </div>
  `;

  return sendMail({
    to: toEmail,
    subject,
    html,
    text: `Dear ${employeeName}, your payslip for ${month} ${year} is attached.`,
    attachments: [
      {
        filename: `Payslip_${month}_${year}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });
}
