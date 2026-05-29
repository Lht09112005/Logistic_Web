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

    const { password: _, refreshToken: __, ...safeUser } = user

    sendSuccess(res, { user: safeUser, accessToken, refreshToken }, 'Đăng nhập thành công')
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
      select: { id: true, name: true, email: true, role: true, phone: true, avatar: true, isActive: true, createdAt: true },
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
