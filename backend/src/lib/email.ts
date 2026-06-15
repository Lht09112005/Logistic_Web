import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "465", 10);
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const FROM_EMAIL = process.env.SMTP_FROM_EMAIL || "noreply@logistiq.vn";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;

  if (!SMTP_USER || !SMTP_PASS) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  return transporter;
}

/**
 * Forward email request via Vercel HTTP API to bypass Render SMTP port blocking
 */
async function sendEmailViaVercel(to: string, subject: string, html: string): Promise<{ success: boolean; error?: string }> {
  try {
    const secret = process.env.INTERNAL_API_SECRET || "default_secret_key";
    console.log(`[Email] Forwarding email via Vercel HTTP API: ${FRONTEND_URL}/api/send-email`);
    
    const response = await fetch(`${FRONTEND_URL}/api/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ to, subject, html, secret }),
    });

    const data = (await response.json().catch(() => ({}))) as any;
    if (response.ok && data.success) {
      return { success: true };
    }
    return { success: false, error: data.error || `HTTP ${response.status}` };
  } catch (error: any) {
    console.error("[Email] Vercel HTTP API forwarding failed:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send a password reset email with a reset link
 */
export async function sendPasswordResetEmail(
  to: string,
  name: string,
  resetToken: string
): Promise<{ success: boolean; error?: string }> {
  const resetUrl = `${FRONTEND_URL}/auth/reset-password?token=${resetToken}`;
  const subject = "Đặt lại mật khẩu — LogistiQ";
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    </head>
    <body style="margin:0;padding:0;background-color:#0d1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0d1117;">
        <tr>
          <td align="center" style="padding:40px 20px;">
            <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#161b22;border-radius:16px;border:1px solid #30363d;">
              <tr>
                <td style="padding:40px 36px 20px;text-align:center;">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  <h1 style="color:#e6edf3;font-size:22px;font-weight:700;margin:16px 0 8px;font-family:'Plus Jakarta Sans',sans-serif;">
                    Đặt lại mật khẩu
                  </h1>
                  <p style="color:#8b949e;font-size:14px;line-height:1.6;margin:0 0 24px;">
                    Xin chào <strong style="color:#e6edf3;">${name}</strong>,<br />
                    Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản LogistiQ của mình.
                    Nhấn nút bên dưới để tiếp tục.
                  </p>
                  <a href="${resetUrl}"
                     style="display:inline-block;padding:14px 32px;border-radius:12px;background:linear-gradient(135deg,#f97316,#ea580c);color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">
                    Đặt lại mật khẩu
                  </a>
                  <p style="color:#8b949e;font-size:12px;line-height:1.5;margin:24px 0 0;">
                    Hoặc copy link này vào trình duyệt:<br />
                    <span style="color:#f97316;word-break:break-all;">${resetUrl}</span>
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding:20px 36px 32px;text-align:center;border-top:1px solid #30363d;">
                  <p style="color:#6e7681;font-size:11px;margin:0;">
                    Link này có hiệu lực trong <strong style="color:#8b949e;">60 phút</strong>.<br />
                    Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.
                  </p>
                  <p style="color:#6e7681;font-size:11px;margin:12px 0 0;">
                    © 2025 LogistiQ — Hệ thống quản lý logistics thông minh
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  if (process.env.NODE_ENV === "production" || process.env.SMTP_FORWARD === "true") {
    return sendEmailViaVercel(to, subject, html);
  }

  const transport = getTransporter();
  if (!transport) {
    console.warn("[Email] SMTP not configured — skipping actual send");
    console.log(`[Email] Would send password reset to ${to} with token: ${resetToken}`);
    return { success: true };
  }

  try {
    await transport.sendMail({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });
    return { success: true };
  } catch (error: any) {
    console.error("[Email] Error sending email:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Send a generic test email to verify configuration
 */
export async function sendTestEmail(to: string): Promise<{ success: boolean; error?: string }> {
  const subject = "LogistiQ — Kết nối email thành công";
  const html = `<p style="color:#333;">Email này xác nhận hệ thống email của LogistiQ đã được cấu hình thành công.</p>`;

  if (process.env.NODE_ENV === "production" || process.env.SMTP_FORWARD === "true") {
    return sendEmailViaVercel(to, subject, html);
  }

  const transport = getTransporter();
  if (!transport) {
    console.warn("[Email] SMTP not configured");
    return { success: false, error: "SMTP not configured" };
  }

  try {
    await transport.sendMail({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Verify SMTP connection configuration
 */
export async function verifySMTPConnection(): Promise<{ success: boolean; error?: string }> {
  if (process.env.NODE_ENV === "production" || process.env.SMTP_FORWARD === "true") {
    if (!process.env.FRONTEND_URL) {
      return { success: false, error: "FRONTEND_URL not configured on Render" };
    }
    return { success: true, error: "Using Vercel HTTP SMTP Forwarding (direct SMTP disabled on Render)" };
  }

  const transport = getTransporter();
  if (!transport) {
    return { success: false, error: "SMTP not configured (missing user/pass)" };
  }
  try {
    await transport.verify();
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
