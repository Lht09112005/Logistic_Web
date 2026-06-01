import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { prisma } from '../config/database'
import { sendSuccess, sendError } from '../utils/response'
import { AuthRequest } from '../middleware/auth.middleware'

// GET /api/users
export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20
    const skip = (page - 1) * limit
    const search = req.query.search as string | undefined
    const role = req.query.role as string | undefined
    const isActive = req.query.isActive as string | undefined

    const authReq = req as AuthRequest
    const requesterRole = authReq.user?.role

    const where: Record<string, unknown> = {}
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ]
    }
    // MANAGER can only see STAFF & DRIVER (not ADMIN or MANAGER)
    if (requesterRole === 'MANAGER') {
      where.role = { in: ['STAFF', 'DRIVER'] }
    } else if (role) {
      where.role = role
    }
    if (isActive !== undefined) where.isActive = isActive === 'true'

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          phone: true,
          avatar: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.user.count({ where }),
    ])

    sendSuccess(res, {
      data: users,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    sendError(res, 'Lỗi lấy danh sách người dùng', 500, error)
  }
}

// GET /api/users/:id
export const getUserById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true, name: true, email: true, role: true,
        phone: true, avatar: true, isActive: true,
        createdAt: true, updatedAt: true,
        _count: {
          select: {
            auditedInventory: true,
            managedWarehouses: true,
            drivenShipments: true,
            createdShipments: true,
          },
        },
      },
    })

    if (!user) {
      sendError(res, 'Không tìm thấy người dùng', 404)
      return
    }

    sendSuccess(res, user)
  } catch (error) {
    sendError(res, 'Lỗi lấy thông tin người dùng', 500, error)
  }
}

// POST /api/users
export const createUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, role = 'STAFF', phone } = req.body

    if (!name || !email || !password) {
      sendError(res, 'Vui lòng nhập đầy đủ họ tên, email và mật khẩu', 400)
      return
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      sendError(res, 'Email đã được sử dụng', 409)
      return
    }

    const hashedPassword = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword, role, phone },
      select: {
        id: true, name: true, email: true, role: true,
        phone: true, avatar: true, isActive: true, createdAt: true,
      },
    })

    sendSuccess(res, user, 'Tạo người dùng thành công', 201)
  } catch (error) {
    sendError(res, 'Lỗi tạo người dùng', 500, error)
  }
}

// PUT /api/users/:id
export const updateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const { name, email, password, role, phone, isActive } = req.body

    const existing = await prisma.user.findUnique({ where: { id } })
    if (!existing) {
      sendError(res, 'Không tìm thấy người dùng', 404)
      return
    }

    // Check email uniqueness if changing email
    if (email && email !== existing.email) {
      const emailTaken = await prisma.user.findUnique({ where: { email } })
      if (emailTaken) {
        sendError(res, 'Email đã được sử dụng', 409)
        return
      }
    }

    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name
    if (email !== undefined) data.email = email
    if (role !== undefined) data.role = role
    if (phone !== undefined) data.phone = phone
    if (isActive !== undefined) data.isActive = isActive
    if (password) {
      data.password = await bcrypt.hash(password, 12)
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true, name: true, email: true, role: true,
        phone: true, avatar: true, isActive: true,
        createdAt: true, updatedAt: true,
      },
    })

    sendSuccess(res, user, 'Cập nhật người dùng thành công')
  } catch (error) {
    sendError(res, 'Lỗi cập nhật người dùng', 500, error)
  }
}

// DELETE /api/users/:id
export const deleteUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    // Prevent deleting yourself
    if (req.user?.userId === id) {
      sendError(res, 'Bạn không thể xóa chính mình', 400)
      return
    }

    const existing = await prisma.user.findUnique({ where: { id } })
    if (!existing) {
      sendError(res, 'Không tìm thấy người dùng', 404)
      return
    }

    // Soft delete — deactivate instead of removing
    await prisma.user.update({
      where: { id },
      data: { isActive: false, refreshToken: null },
    })

    sendSuccess(res, null, 'Đã vô hiệu hóa người dùng')
  } catch (error) {
    sendError(res, 'Lỗi xóa người dùng', 500, error)
  }
}
