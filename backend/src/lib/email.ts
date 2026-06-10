import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "noreply@logistiq.vn";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

/**
 * Send a password reset email with a reset link
 */
export async function sendPasswordResetEmail(
  to: string,
  name: string,
  resetToken: string
): Promise<{ success: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    console.warn("[Email] RESEND_API_KEY not configured — skipping actual send");
    console.log(`[Email] Would send password reset to ${to} with token: ${resetToken}`);
    return { success: true }; // Graceful fallback in development
  }

  try {
    const resend = new Resend(RESEND_API_KEY);
    const resetUrl = `${FRONTEND_URL}/auth/reset-password?token=${resetToken}`;

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: "Đặt lại mật khẩu — LogistiQ",
      html: `
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
      `,
    });

    if (error) {
      console.error("[Email] Failed to send:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error("[Email] Error sending email:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Send a generic test email to verify Resend configuration
 */
export async function sendTestEmail(to: string): Promise<{ success: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    console.warn("[Email] RESEND_API_KEY not configured");
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  try {
    const resend = new Resend(RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: "LogistiQ — Kết nối email thành công",
      html: `<p style="color:#333;">Email này xác nhận hệ thống email của LogistiQ đã được cấu hình thành công.</p>`,
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
