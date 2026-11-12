import nodemailer from 'nodemailer';

interface EmailResult {
  success: boolean;
  messageId?: string;
  previewCode?: string;
  error?: string;
}

export async function sendPasswordResetEmail(
  toEmail: string,
  code: string,
  displayName?: string
): Promise<EmailResult> {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || '"LEVEL UP Support" <support@levelup.app>';

  // Check if SMTP is configured
  if (host && user && pass) {
    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass }
      });

      const info = await transporter.sendMail({
        from,
        to: toEmail,
        subject: `Your LEVEL UP Verification Code: ${code}`,
        text: `Hello ${displayName || 'Scholar'},\n\nYour 6-digit password reset verification code is: ${code}\n\nThis code will expire in 15 minutes. If you did not request this, please ignore this email.\n\n— The LEVEL UP Team`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e2e8f0; border-radius: 20px; background-color: #ffffff; color: #1e293b;">
            <div style="text-align: center; margin-bottom: 24px;">
              <div style="display: inline-block; width: 48px; height: 48px; border-radius: 14px; background: linear-gradient(135deg, #059669, #34d399); color: #ffffff; line-height: 48px; font-weight: 900; font-size: 24px;">▲</div>
              <h1 style="font-size: 22px; font-weight: 800; margin: 12px 0 4px 0; color: #0f172a;">LEVEL UP</h1>
              <p style="font-size: 13px; color: #64748b; margin: 0;">Password Reset Verification</p>
            </div>
            <p style="font-size: 14px; line-height: 1.6; color: #334155; margin-bottom: 16px;">
              Hello <strong>${displayName || 'Scholar'}</strong>,
            </p>
            <p style="font-size: 14px; line-height: 1.6; color: #334155; margin-bottom: 20px;">
              We received a request to reset your password. Use the verification code below to complete the reset:
            </p>
            <div style="background-color: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 14px; padding: 20px; text-align: center; margin-bottom: 24px;">
              <span style="font-family: monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #059669;">
                ${code}
              </span>
            </div>
            <p style="font-size: 12px; line-height: 1.5; color: #64748b; margin-bottom: 24px;">
              ⏱️ This code expires in <strong>15 minutes</strong>. If you did not request this password change, no action is needed; your account remains secure.
            </p>
            <hr style="border: none; border-top: 1px solid #f1f5f9; margin-bottom: 16px;" />
            <p style="font-size: 11px; text-align: center; color: #94a3b8; margin: 0;">
              LEVEL UP • Personal Productivity & Study Management Headquarters
            </p>
          </div>
        `
      });

      console.log(`[Email] Password reset email sent to ${toEmail}: messageId=${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (err: any) {
      console.error(`[Email] Failed to send email via SMTP to ${toEmail}:`, err.message);
      // Fallback to preview code so user is not blocked
      return { success: true, previewCode: code, error: err.message };
    }
  }

  // If no SMTP configured, log code clearly to console and provide preview code
  console.log('========================================================================');
  console.log(`[PASSWORD RESET VERIFICATION CODE]`);
  console.log(`To: ${toEmail}`);
  console.log(`Code: ${code}`);
  console.log(`Expires in: 15 minutes`);
  console.log('========================================================================');

  return {
    success: true,
    previewCode: code
  };
}
