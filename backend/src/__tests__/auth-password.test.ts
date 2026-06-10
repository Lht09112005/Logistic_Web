import { Request, Response } from "express";
import bcrypt from "bcryptjs";

// Mock Prisma
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
};

jest.mock("../config/database", () => ({
  prisma: mockPrisma,
  __esModule: true,
  default: mockPrisma,
}));

// Mock email module — must return a Promise (with .catch) since controller does sendPasswordResetEmail(...).catch(...)
jest.mock("../lib/email", () => ({
  sendPasswordResetEmail: jest.fn().mockResolvedValue({ success: true }),
}));

// Mock bcrypt
jest.mock("bcryptjs", () => ({
  hash: jest.fn(),
  compare: jest.fn(),
  genSalt: jest.fn(),
}));

describe("Forgot & Reset Password Controllers", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    mockResponse = {
      status: statusMock as unknown as Response["status"],
      json: jsonMock,
    } as Partial<Response>;

    jest.clearAllMocks();
  });

  // ─── Forgot Password ─────────────────────────────────

  describe("forgotPassword", () => {
    it("should return 400 if email is not provided", async () => {
      mockRequest = { body: {} };

      const { forgotPassword } = await import("../controllers/auth.controller");
      await forgotPassword(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, message: "Vui lòng nhập email" })
      );
    });

    it("should return success even if user does not exist (prevent enumeration)", async () => {
      mockRequest = { body: { email: "nonexistent@test.com" } };
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const { forgotPassword } = await import("../controllers/auth.controller");
      await forgotPassword(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Nếu email tồn tại, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu",
        })
      );
    });

    it("should generate reset token, store in DB, and trigger email sending", async () => {
      const fakeUser = { id: "user-1", email: "admin@logistiq.vn", name: "Admin" };
      mockRequest = { body: { email: "admin@logistiq.vn" } };
      mockPrisma.user.findUnique.mockResolvedValue(fakeUser);
      mockPrisma.user.update.mockResolvedValue(fakeUser);

      const { forgotPassword } = await import("../controllers/auth.controller");
      await forgotPassword(mockRequest as Request, mockResponse as Response);

      // Verify token was stored in DB
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "user-1" },
          data: expect.objectContaining({
            resetToken: expect.any(String),
            resetTokenExpiry: expect.any(Date),
          }),
        })
      );

      // Verify response
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Nếu email tồn tại, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu",
        })
      );
    });

    it("should handle internal server error gracefully", async () => {
      mockRequest = { body: { email: "admin@logistiq.vn" } };
      mockPrisma.user.findUnique.mockRejectedValue(new Error("DB error"));

      const { forgotPassword } = await import("../controllers/auth.controller");
      await forgotPassword(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, message: "Có lỗi xảy ra. Vui lòng thử lại sau." })
      );
    });
  });

  // ─── Reset Password ─────────────────────────────────

  describe("resetPassword", () => {
    it("should return 400 if token or password is missing", async () => {
      mockRequest = { body: {} };

      const { resetPassword } = await import("../controllers/auth.controller");
      await resetPassword(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Vui lòng cung cấp token và mật khẩu mới",
        })
      );
    });

    it("should return 400 if password is too short", async () => {
      mockRequest = { body: { token: "valid-token", password: "12345" } };

      const { resetPassword } = await import("../controllers/auth.controller");
      await resetPassword(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Mật khẩu phải có ít nhất 6 ký tự",
        })
      );
    });

    it("should return 400 if token is invalid or expired", async () => {
      mockRequest = { body: { token: "bad-token", password: "newpassword123" } };
      mockPrisma.user.findFirst.mockResolvedValue(null);

      const { resetPassword } = await import("../controllers/auth.controller");
      await resetPassword(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn",
        })
      );
    });

    it("should hash password, update user, clear tokens, and return success", async () => {
      const fakeUser = { id: "user-1", email: "admin@logistiq.vn", name: "Admin" };
      mockRequest = { body: { token: "valid-token", password: "newpassword123" } };
      mockPrisma.user.findFirst.mockResolvedValue(fakeUser);
      (bcrypt.hash as jest.Mock).mockResolvedValue("hashed-password");
      mockPrisma.user.update.mockResolvedValue(fakeUser);

      const { resetPassword } = await import("../controllers/auth.controller");
      await resetPassword(mockRequest as Request, mockResponse as Response);

      // Verify password was hashed
      expect(bcrypt.hash).toHaveBeenCalledWith("newpassword123", 12);

      // Verify user was updated with new password and cleared tokens
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "user-1" },
          data: expect.objectContaining({
            password: "hashed-password",
            resetToken: null,
            resetTokenExpiry: null,
          }),
        })
      );

      // Verify refresh token was also cleared
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "user-1" },
          data: { refreshToken: null },
        })
      );

      // Verify success response
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Mật khẩu đã được đặt lại thành công. Vui lòng đăng nhập lại.",
        })
      );
    });

    it("should handle internal server error gracefully", async () => {
      mockRequest = { body: { token: "valid", password: "newpassword123" } };
      mockPrisma.user.findFirst.mockRejectedValue(new Error("DB error"));

      const { resetPassword } = await import("../controllers/auth.controller");
      await resetPassword(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, message: "Có lỗi xảy ra. Vui lòng thử lại sau." })
      );
    });
  });
});
