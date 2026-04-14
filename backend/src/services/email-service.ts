/**
 * Email Service
 * ─────────────
 * Nodemailer transporter setup + sendResetEmail function.
 */

import nodemailer from "nodemailer";

// ── Transporter ────────────────────────────────────────────────────────

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM_ADDRESS = process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@comicmind.app";

// ── Send Reset Email ───────────────────────────────────────────────────

export async function sendResetEmail(
  email: string,
  token: string,
): Promise<void> {
  const baseUrl = process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
  const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

  const mailOptions = {
    from: FROM_ADDRESS,
    to: email,
    subject: "ComicMind - Password Reset",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6366f1;">ComicMind Password Reset</h2>
        <p>You requested a password reset. Click the button below to set a new password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" 
             style="background-color: #6366f1; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 6px; font-weight: bold;">
            Reset Password
          </a>
        </div>
        <p style="color: #666; font-size: 14px;">
          This link expires in 45 minutes. If you didn't request this reset, 
          you can safely ignore this email.
        </p>
        <p style="color: #999; font-size: 12px;">
          If the button doesn't work, copy and paste this URL into your browser:<br/>
          <a href="${resetUrl}">${resetUrl}</a>
        </p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`[email] Reset email sent to ${email}`);
  } catch (error) {
    console.error("[email] Failed to send reset email:", error);
    throw new Error("Failed to send reset email");
  }
}
