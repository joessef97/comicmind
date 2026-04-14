import nodemailer from "nodemailer";

// Support both Gmail shortcut and full SMTP config
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT;
const SMTP_USER = process.env.SMTP_USER || EMAIL_USER;
const SMTP_PASS = process.env.SMTP_PASS || EMAIL_PASS;
const SMTP_SECURE = process.env.SMTP_SECURE;
const SMTP_FROM = process.env.SMTP_FROM || process.env.EMAIL_FROM;

const FRONTEND_URL = process.env.FRONTEND_URL || process.env.APP_URL || "http://localhost:5000";

let transporter: nodemailer.Transporter | null = null;

if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  // Full SMTP configuration (also picks up EMAIL_USER/EMAIL_PASS as fallback)
  const port = Number(SMTP_PORT) || 587;
  const secure = SMTP_SECURE ? SMTP_SECURE === "true" : port === 465;

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  transporter.verify().then(() => {
    console.log(`Email service ready (SMTP: ${SMTP_HOST}:${port})`);
  }).catch((err) => {
    console.error("Email service error:", err.message);
  });
} else if (EMAIL_USER && EMAIL_PASS) {
  // Gmail shortcut (no SMTP_HOST set)
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
  });

  transporter.verify().then(() => {
    console.log("Email service ready (Gmail)");
  }).catch((err) => {
    console.error("Email service error:", err.message);
  });
} else {
  console.warn("EMAIL_USER and EMAIL_PASS not set. Password reset emails will be logged to console.");
}

const fromAddress = SMTP_FROM || (EMAIL_USER ? `"ComicMind" <${EMAIL_USER}>` : '"ComicMind" <noreply@comicmind.app>');

export async function sendResetEmail(toEmail: string, resetToken: string): Promise<void> {
  const resetUrl = `${FRONTEND_URL}/reset-password?token=${resetToken}&email=${encodeURIComponent(toEmail)}`;

  const mailOptions = {
    from: fromAddress,
    to: toEmail,
    subject: "Reset Your ComicMind Password",
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; background: #0f1115; color: #ffffff; padding: 40px; border-radius: 16px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #a855f7; font-size: 28px; margin: 0;">ComicMind</h1>
          <p style="color: #9ca3af; font-size: 14px; margin-top: 8px;">AI-Powered Comic Creation</p>
        </div>
        
        <div style="background: #161920; border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 30px; margin-bottom: 20px;">
          <h2 style="color: #ffffff; font-size: 20px; margin: 0 0 16px 0;">Password Reset Request</h2>
          <p style="color: #9ca3af; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0;">
            We received a request to reset your password. Click the button below to create a new password. 
            This link will expire in <strong style="color: #ffffff;">45 minutes</strong>.
          </p>
          
          <div style="text-align: center; margin: 24px 0;">
            <a href="${resetUrl}" 
               style="display: inline-block; background: linear-gradient(to right, #a855f7, #d946ef); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: bold; font-size: 16px;">
              Reset Password
            </a>
          </div>
          
          <p style="color: #6b7280; font-size: 12px; line-height: 1.6; margin: 24px 0 0 0;">
            If the button doesn't work, copy and paste this link into your browser:<br/>
            <a href="${resetUrl}" style="color: #a855f7; word-break: break-all;">${resetUrl}</a>
          </p>
        </div>
        
        <p style="color: #6b7280; font-size: 12px; text-align: center; margin: 0;">
          If you didn't request a password reset, you can safely ignore this email.
        </p>
      </div>
    `,
  };

  if (transporter) {
    await transporter.sendMail(mailOptions);
    console.log(`Password reset email sent to ${toEmail}`);
  } else {
    // Fallback: log the reset link to console for development
    console.log("=== PASSWORD RESET (no email configured) ===");
    console.log(`Email: ${toEmail}`);
    console.log(`Reset URL: ${resetUrl}`);
    console.log("============================================");
  }
}
