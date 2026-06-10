import { Resend } from "resend";

// Shared mock send function — persists across jest.resetModules()
const mockSend = jest.fn().mockResolvedValue({ data: { id: "1" }, error: null });

jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}));

describe("sendPasswordResetEmail", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    // Reset env to clean state before each test
    process.env = { ...OLD_ENV };
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;
    process.env.FRONTEND_URL = "http://localhost:3000";

    // Clear the module registry so each import("../lib/email") is fresh
    jest.resetModules();

    mockSend.mockClear();
    (Resend as unknown as jest.Mock).mockClear();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it("should log a warning and return success when RESEND_API_KEY is not configured", async () => {
    // RESEND_API_KEY intentionally not set
    const warnSpy = jest.spyOn(console, "warn").mockImplementation();
    const logSpy = jest.spyOn(console, "log").mockImplementation();

    const { sendPasswordResetEmail } = await import("../lib/email");
    const result = await sendPasswordResetEmail("user@test.com", "Test User", "token123");

    expect(result).toEqual({ success: true });
    expect(warnSpy).toHaveBeenCalledWith(
      "[Email] RESEND_API_KEY not configured — skipping actual send"
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("[Email] Would send password reset to user@test.com with token: token123")
    );

    warnSpy.mockRestore();
    logSpy.mockRestore();
  });

  it("should call Resend API and return success when configured", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM_EMAIL = "noreply@logistiq.vn";
    mockSend.mockResolvedValue({ data: { id: "1" }, error: null });

    const { sendPasswordResetEmail } = await import("../lib/email");
    const result = await sendPasswordResetEmail("user@test.com", "Test User", "token123");

    expect(result).toEqual({ success: true });
    expect(mockSend).toHaveBeenCalledTimes(1);

    const callArg = mockSend.mock.calls[0][0];
    expect(callArg.from).toBe("noreply@logistiq.vn");
    expect(callArg.to).toBe("user@test.com");
    expect(callArg.subject).toContain("Đặt lại mật khẩu");
    expect(callArg.html).toContain("Test User");
    expect(callArg.html).toContain("http://localhost:3000/auth/reset-password?token=token123");
  });

  it("should return error when Resend API call fails", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM_EMAIL = "noreply@logistiq.vn";
    mockSend.mockResolvedValue({ data: null, error: { message: "Invalid domain" } });

    const { sendPasswordResetEmail } = await import("../lib/email");
    const result = await sendPasswordResetEmail("bad@test.com", "Test", "tok");

    expect(result).toEqual({ success: false, error: "Invalid domain" });
  });

  it("should return error when Resend throws an exception", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM_EMAIL = "noreply@logistiq.vn";
    mockSend.mockRejectedValue(new Error("Network error"));

    const { sendPasswordResetEmail } = await import("../lib/email");
    const result = await sendPasswordResetEmail("user@test.com", "Test", "tok");

    expect(result).toEqual({ success: false, error: "Network error" });
  });

  it("should generate correct reset URL with token", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM_EMAIL = "noreply@logistiq.vn";
    mockSend.mockResolvedValue({ data: { id: "1" }, error: null });

    const { sendPasswordResetEmail } = await import("../lib/email");
    await sendPasswordResetEmail("test@logistiq.vn", "Admin", "abc123token");

    const html = mockSend.mock.calls[0][0].html;
    expect(html).toContain("http://localhost:3000/auth/reset-password?token=abc123token");
    expect(html).toContain("Admin");
    expect(html).toContain("60 phút");
    expect(html).toContain("LogistiQ");
  });
});
