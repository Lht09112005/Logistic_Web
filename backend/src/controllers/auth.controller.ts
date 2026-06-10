import { randomBytes } from 'crypto'
import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { prisma } from '../config/database'
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../config/jwt'
import { sendSuccess, sendError } from '../utils/response'
import { AuthRequest } from '../middleware/auth.middleware'

// POST /api/auth/register
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, role = 'STAFF', phone } = req.body

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      sendError(res, 'Email đã được sử dụng', 409)
      return
    }

    const hashedPassword = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword, role, phone },
      select: { id: true, name: true, email: true, role: true, phone: true, createdAt: true },
    })

    const accessToken = generateAccessToken({ userId: user.id, email: user.email, role: user.role })
    const refreshToken = generateRefreshToken({ userId: user.id, email: user.email, role: user.role })

    await prisma.user.update({ where: { id: user.id }, data: { refreshToken } })

    sendSuccess(res, { user, accessToken, refreshToken }, 'Đăng ký thành công', 201)
  } catch (error) {
    sendError(res, 'Lỗi đăng ký', 500, error)
  }
}

// POST /api/auth/login
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !user.isActive) {
      sendError(res, 'Email hoặc mật khẩu không đúng', 401)
      return
    }

    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      sendError(res, 'Email hoặc mật khẩu không đúng', 401)
      return
    }

    const accessToken = generateAccessToken({ userId: user.id, email: user.email, role: user.role })
    const refreshToken = generateRefreshToken({ userId: user.id, email: user.email, role: user.role })

    await prisma.user.update({ where: { id: user.id }, data: { refreshToken } })

    // Fetch managed warehouses for the user
    const managedWarehouses = await prisma.warehouse.findMany({
      where: { managerId: user.id },
      select: { id: true, name: true, code: true, address: true, city: true, province: true },
    })

    // Fetch staffed warehouse for the user (STAFF role)
    const staffedWarehouses = await prisma.warehouse.findMany({
      where: { staffId: user.id },
      select: { id: true, name: true, code: true, address: true, city: true, province: true },
    })

    const { password: _, refreshToken: __, ...safeUser } = user

    sendSuccess(res, {
      user: { ...safeUser, managedWarehouses, staffedWarehouses },
      accessToken,
      refreshToken,
    }, 'Đăng nhập thành công')
  } catch (error) {
    sendError(res, 'Lỗi đăng nhập', 500, error)
  }
}

// POST /api/auth/refresh
export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken: token } = req.body
    if (!token) {
      sendError(res, 'Không có refresh token', 401)
      return
    }

    const payload = verifyRefreshToken(token)
    const user = await prisma.user.findUnique({ where: { id: payload.userId } })

    if (!user || user.refreshToken !== token) {
      sendError(res, 'Refresh token không hợp lệ', 401)
      return
    }

    const accessToken = generateAccessToken({ userId: user.id, email: user.email, role: user.role })
    const newRefreshToken = generateRefreshToken({ userId: user.id, email: user.email, role: user.role })

    await prisma.user.update({ where: { id: user.id }, data: { refreshToken: newRefreshToken } })

    sendSuccess(res, { accessToken, refreshToken: newRefreshToken }, 'Làm mới token thành công')
  } catch {
    sendError(res, 'Refresh token không hợp lệ hoặc hết hạn', 401)
  }
}

// POST /api/auth/logout
export const logout = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.user) {
      await prisma.user.update({
        where: { id: req.user.userId },
        data: { refreshToken: null },
      })
    }
    sendSuccess(res, null, 'Đăng xuất thành công')
  } catch (error) {
    sendError(res, 'Lỗi đăng xuất', 500, error)
  }
}

// GET /api/auth/me
export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true, name: true, email: true, role: true, phone: true, avatar: true, isActive: true, createdAt: true,
        managedWarehouses: {
          select: { id: true, name: true, code: true, address: true, city: true, province: true },
        },
        staffedWarehouses: {
          select: { id: true, name: true, code: true, address: true, city: true, province: true },
        },
      },
    })
    if (!user) {
      sendError(res, 'Không tìm thấy người dùng', 404)
      return
    }
    sendSuccess(res, user)
  } catch (error) {
    sendError(res, 'Lỗi lấy thông tin', 500, error)
  }
}

// PUT /api/auth/me
export const updateMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, email, phone, password } = req.body
    const userId = req.user!.userId

    // Validate required fields
    if (name !== undefined && !name.toString().trim()) {
      sendError(res, 'Họ tên không được để trống', 400)
      return
    }
    if (email !== undefined && !email.toString().trim()) {
      sendError(res, 'Email không được để trống', 400)
      return
    }

    // Check email uniqueness if changing
    if (email !== undefined) {
      const existing = await prisma.user.findFirst({
        where: { email, NOT: { id: userId } },
      })
      if (existing) {
        sendError(res, 'Email đã được sử dụng', 409)
        return
      }
    }

    // Build update payload — only include provided fields
    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name
    if (email !== undefined) data.email = email
    if (phone !== undefined) data.phone = phone
    if (password !== undefined) {
      if (password.length < 6) {
        sendError(res, 'Mật khẩu phải có ít nhất 6 ký tự', 400)
        return
      }
      data.password = await bcrypt.hash(password, 12)
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, name: true, email: true, role: true, phone: true, avatar: true, updatedAt: true },
    })

    sendSuccess(res, updated, 'Cập nhật thông tin thành công')
  } catch (error) {
    sendError(res, 'Lỗi cập nhật thông tin', 500, error)
  }
}

// POST /api/auth/forgot-password
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      sendError(res, 'Vui lòng nhập email', 400);
      return;
    }

    // Always return success to prevent email enumeration
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      sendSuccess(res, null, 'Nếu email tồn tại, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu');
      return;
    }

    // Generate reset token (valid for 60 minutes)
    const resetToken = randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 60 phút

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpiry },
    });

    // Send email (non-blocking — don't await to avoid timeout)
    const { sendPasswordResetEmail } = await import('../lib/email');
    sendPasswordResetEmail(user.email, user.name, resetToken).catch((err) => {
      console.error('[ForgotPassword] Failed to send email:', err);
    });

    sendSuccess(res, null, 'Nếu email tồn tại, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu');
  } catch (error) {
    console.error('[ForgotPassword] Error:', error);
    sendError(res, 'Có lỗi xảy ra. Vui lòng thử lại sau.', 500);
  }
};

// POST /api/auth/reset-password
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      sendError(res, 'Vui lòng cung cấp token và mật khẩu mới', 400);
      return;
    }

    if (password.length < 6) {
      sendError(res, 'Mật khẩu phải có ít nhất 6 ký tự', 400);
      return;
    }

    // Find user with valid reset token
    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gte: new Date() },
      },
    });

    if (!user) {
      sendError(res, 'Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn', 400);
      return;
    }

    // Hash new password and clear reset token
    const hashedPassword = await bcrypt.hash(password, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    // Invalidate all existing sessions by clearing refresh token
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: null },
    });

    sendSuccess(res, null, 'Mật khẩu đã được đặt lại thành công. Vui lòng đăng nhập lại.');
  } catch (error) {
    console.error('[ResetPassword] Error:', error);
    sendError(res, 'Có lỗi xảy ra. Vui lòng thử lại sau.', 500);
  }
};

// GET /api/auth/drivers
export const getDrivers = async (req: Request, res: Response): Promise<void> => {
  try {
    const drivers = await prisma.user.findMany({
      where: { role: 'DRIVER', isActive: true },
      select: { id: true, name: true, email: true, phone: true, avatar: true },
    })
    sendSuccess(res, drivers, 'Lấy danh sách tài xế thành công')
  } catch (error) {
    sendError(res, 'Lỗi lấy danh sách tài xế', 500, error)
  }
}
