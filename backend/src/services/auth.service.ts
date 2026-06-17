import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { prisma } from '../config/database'
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../config/jwt'
import { blacklistToken } from './token-blacklist.service'

interface AuthUserResult {
  id: string
  name: string
  email: string
  role: string
  phone?: string | null
  avatar?: string | null
  isActive: boolean
  createdAt: Date
  managedWarehouses?: unknown[]
  staffedWarehouses?: unknown[]
}

interface TokenPair {
  accessToken: string
  refreshToken: string
}

type AuthResult = {
  user: AuthUserResult
  tokens: TokenPair
}

export async function registerUser(
  name: string,
  email: string,
  password: string,
  role = 'STAFF',
  phone?: string
): Promise<AuthResult> {
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    throw Object.assign(new Error('Email đã được sử dụng'), { statusCode: 409 })
  }

  const hashedPassword = await bcrypt.hash(password, 12)
  const user = await prisma.user.create({
    data: { name, email, password: hashedPassword, role, phone },
    select: { id: true, name: true, email: true, role: true, phone: true, createdAt: true },
  })

  const accessToken = generateAccessToken({ userId: user.id, email: user.email, role: user.role })
  const refreshToken = generateRefreshToken({ userId: user.id, email: user.email, role: user.role })

  await prisma.user.update({ where: { id: user.id }, data: { refreshToken } })

  return {
    user: { ...user, isActive: true, avatar: null },
    tokens: { accessToken, refreshToken },
  }
}

export async function loginUser(
  email: string,
  password: string
): Promise<{ user: AuthUserResult; tokens: TokenPair }> {
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !user.isActive) {
    throw Object.assign(new Error('Email hoặc mật khẩu không đúng'), { statusCode: 401 })
  }

  const isMatch = await bcrypt.compare(password, user.password)
  if (!isMatch) {
    throw Object.assign(new Error('Email hoặc mật khẩu không đúng'), { statusCode: 401 })
  }

  const accessToken = generateAccessToken({ userId: user.id, email: user.email, role: user.role })
  const refreshToken = generateRefreshToken({ userId: user.id, email: user.email, role: user.role })

  await prisma.user.update({ where: { id: user.id }, data: { refreshToken } })

  // Fetch managed + staffed warehouses
  const [managedWarehouses, staffedWarehouses] = await Promise.all([
    prisma.warehouse.findMany({
      where: { managerId: user.id },
      select: { id: true, name: true, code: true, address: true, city: true, province: true },
    }),
    prisma.warehouse.findMany({
      where: { staffId: user.id },
      select: { id: true, name: true, code: true, address: true, city: true, province: true },
    }),
  ])

  const { password: _, refreshToken: __, resetToken, resetTokenExpiry, ...safeUser } = user

  return {
    user: { ...safeUser, managedWarehouses, staffedWarehouses },
    tokens: { accessToken, refreshToken },
  }
}

export async function refreshUserToken(token: string): Promise<TokenPair> {
  if (!token) {
    throw Object.assign(new Error('Không có refresh token'), { statusCode: 401 })
  }

  const payload = verifyRefreshToken(token)
  const user = await prisma.user.findUnique({ where: { id: payload.userId } })

  if (!user || user.refreshToken !== token) {
    throw Object.assign(new Error('Refresh token không hợp lệ'), { statusCode: 401 })
  }

  const accessToken = generateAccessToken({ userId: user.id, email: user.email, role: user.role })
  const newRefreshToken = generateRefreshToken({ userId: user.id, email: user.email, role: user.role })

  await prisma.user.update({ where: { id: user.id }, data: { refreshToken: newRefreshToken } })

  return { accessToken, refreshToken: newRefreshToken }
}

export async function logoutUser(userId: string, bearerToken?: string): Promise<void> {
  if (bearerToken) {
    blacklistToken(bearerToken).catch((err) =>
      console.error('[AuthService] Failed to blacklist token:', err)
    )
  }

  await prisma.user.update({
    where: { id: userId },
    data: { refreshToken: null },
  })
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, name: true, email: true, role: true, phone: true, avatar: true,
      isActive: true, createdAt: true,
      managedWarehouses: {
        select: { id: true, name: true, code: true, address: true, city: true, province: true },
      },
      staffedWarehouses: {
        select: { id: true, name: true, code: true, address: true, city: true, province: true },
      },
    },
  })

  if (!user) {
    throw Object.assign(new Error('Không tìm thấy người dùng'), { statusCode: 404 })
  }

  return user
}

export async function updateMe(
  userId: string,
  data: { name?: string; email?: string; phone?: string; password?: string; oldPassword?: string }
) {
  const updateData: Record<string, unknown> = {}

  if (data.name !== undefined) {
    if (!data.name.toString().trim()) {
      throw Object.assign(new Error('Họ tên không được để trống'), { statusCode: 400 })
    }
    updateData.name = data.name
  }

  if (data.email !== undefined) {
    if (!data.email.toString().trim()) {
      throw Object.assign(new Error('Email không được để trống'), { statusCode: 400 })
    }
    const existing = await prisma.user.findFirst({
      where: { email: data.email, NOT: { id: userId } },
    })
    if (existing) {
      throw Object.assign(new Error('Email đã được sử dụng'), { statusCode: 409 })
    }
    updateData.email = data.email
  }

  if (data.phone !== undefined) updateData.phone = data.phone

  if (data.password !== undefined) {
    // Require old password verification
    if (!data.oldPassword) {
      throw Object.assign(new Error('Vui lòng nhập mật khẩu hiện tại để xác nhận'), { statusCode: 400 })
    }
    if (data.password.length < 6) {
      throw Object.assign(new Error('Mật khẩu phải có ít nhất 6 ký tự'), { statusCode: 400 })
    }

    // Fetch current user to verify old password
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true },
    })
    if (!user) {
      throw Object.assign(new Error('Không tìm thấy người dùng'), { statusCode: 404 })
    }

    const isMatch = await bcrypt.compare(data.oldPassword, user.password)
    if (!isMatch) {
      throw Object.assign(new Error('Mật khẩu hiện tại không đúng'), { statusCode: 400 })
    }

    updateData.password = await bcrypt.hash(data.password, 12)
  }

  return prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: { id: true, name: true, email: true, role: true, phone: true, avatar: true, updatedAt: true },
  })
}

export async function forgotPassword(email: string): Promise<void> {
  if (!email) {
    throw Object.assign(new Error('Vui lòng nhập email'), { statusCode: 400 })
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    throw Object.assign(new Error('Email không tồn tại trong hệ thống'), { statusCode: 404 })
  }

  const resetToken = randomBytes(32).toString('hex')
  const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000)

  await prisma.user.update({
    where: { id: user.id },
    data: { resetToken, resetTokenExpiry },
  })

  // Non-blocking email send
  const { sendPasswordResetEmail } = await import('../lib/email')
  sendPasswordResetEmail(user.email, user.name, resetToken).catch((err) => {
    console.error('[ForgotPassword] Failed to send email:', err)
  })
}

export async function resetPassword(token: string, password: string): Promise<void> {
  if (!token || !password) {
    throw Object.assign(new Error('Vui lòng cung cấp token và mật khẩu mới'), { statusCode: 400 })
  }
  if (password.length < 6) {
    throw Object.assign(new Error('Mật khẩu phải có ít nhất 6 ký tự'), { statusCode: 400 })
  }

  const user = await prisma.user.findFirst({
    where: { resetToken: token, resetTokenExpiry: { gte: new Date() } },
  })

  if (!user) {
    throw Object.assign(new Error('Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn'), { statusCode: 400 })
  }

  const hashedPassword = await bcrypt.hash(password, 12)
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword, resetToken: null, resetTokenExpiry: null },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: null },
    }),
  ])
}

export async function getDrivers() {
  return prisma.user.findMany({
    where: { role: 'DRIVER', isActive: true },
    select: { id: true, name: true, email: true, phone: true, avatar: true },
  })
}
