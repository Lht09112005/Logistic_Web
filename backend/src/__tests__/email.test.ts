// Shared mock sendMail function — persists across jest.resetModules()
const mockSendMail = jest.fn().mockResolvedValue({ accepted: ["user@test.com"], rejected: [] });

jest.mock("nodemailer", () => ({
  createTransport: jest.fn().mockImplementation(() => ({
    sendMail: mockSendMail,
  })),
}));

describe("sendPasswordResetEmail", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    // Reset env to clean state before each test
    process.env = { ...OLD_ENV };
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.SMTP_FROM_EMAIL;
    process.env.FRONTEND_URL = "http://localhost:3000";

    // Clear the module registry so each import("../lib/email") is fresh
    jest.resetModules();

    mockSendMail.mockClear();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it("should log a warning and return success when SMTP is not configured", async () => {
    // SMTP_USER / SMTP_PASS intentionally not set
    const warnSpy = jest.spyOn(console, "warn").mockImplementation();
    const logSpy = jest.spyOn(console, "log").mockImplementation();

    const { sendPasswordResetEmail } = await import("../lib/email");
    const result = await sendPasswordResetEmail("user@test.com", "Test User", "token123");

    expect(result).toEqual({ success: true });
    expect(warnSpy).toHaveBeenCalledWith(
      "[Email] SMTP not configured — skipping actual send"
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("[Email] Would send password reset to user@test.com with token: token123")
    );

    warnSpy.mockRestore();
    logSpy.mockRestore();
  });

  it("should call Nodemailer and return success when configured", async () => {
    process.env.SMTP_USER = "test@gmail.com";
    process.env.SMTP_PASS = "test-app-password";
    process.env.SMTP_FROM_EMAIL = "noreply@logistiq.vn";
    mockSendMail.mockResolvedValue({ accepted: ["user@test.com"], rejected: [] });

    const { sendPasswordResetEmail } = await import("../lib/email");
    const result = await sendPasswordResetEmail("user@test.com", "Test User", "token123");

    expect(result).toEqual({ success: true });
    expect(mockSendMail).toHaveBeenCalledTimes(1);

    const callArg = mockSendMail.mock.calls[0][0];
    expect(callArg.from).toBe("noreply@logistiq.vn");
    expect(callArg.to).toBe("user@test.com");
    expect(callArg.subject).toContain("Đặt lại mật khẩu");
    expect(callArg.html).toContain("Test User");
    expect(callArg.html).toContain("http://localhost:3000/auth/reset-password?token=token123");
  });

  it("should return error when Nodemailer send fails", async () => {
    process.env.SMTP_USER = "test@gmail.com";
    process.env.SMTP_PASS = "test-app-password";
    process.env.SMTP_FROM_EMAIL = "noreply@logistiq.vn";
    mockSendMail.mockRejectedValue(new Error("Invalid login"));

    const { sendPasswordResetEmail } = await import("../lib/email");
    const result = await sendPasswordResetEmail("bad@test.com", "Test", "tok");

    expect(result).toEqual({ success: false, error: "Invalid login" });
  });

  it("should generate correct reset URL with token", async () => {
    process.env.SMTP_USER = "test@gmail.com";
    process.env.SMTP_PASS = "test-app-password";
    process.env.SMTP_FROM_EMAIL = "noreply@logistiq.vn";
    mockSendMail.mockResolvedValue({ accepted: ["test@logistiq.vn"], rejected: [] });

    const { sendPasswordResetEmail } = await import("../lib/email");
    await sendPasswordResetEmail("test@logistiq.vn", "Admin", "abc123token");

    const html = mockSendMail.mock.calls[0][0].html;
    expect(html).toContain("http://localhost:3000/auth/reset-password?token=abc123token");
    expect(html).toContain("Admin");
    expect(html).toContain("60 phút");
    expect(html).toContain("LogistiQ");
  });
});
