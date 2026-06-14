import bcrypt from 'bcryptjs'
import { prisma } from '../config/database'

interface UserQuery {
  page?: number
  limit?: number
  search?: string
  role?: string
  isActive?: boolean
  requesterRole?: string
}

export async function getUsers(query: UserQuery) {
  const page = query.page || 1
  const limit = query.limit || 20
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = {}

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' as const } },
      { email: { contains: query.search, mode: 'insensitive' as const } },
      { phone: { contains: query.search, mode: 'insensitive' as const } },
    ]
  }

  if (query.requesterRole === 'MANAGER') {
    where.role = { in: ['STAFF', 'DRIVER'] }
  } else if (query.role) {
    where.role = query.role
  }

  if (query.isActive !== undefined) where.isActive = query.isActive

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, email: true, role: true,
        phone: true, avatar: true, isActive: true,
        createdAt: true, updatedAt: true,
      },
    }),
    prisma.user.count({ where }),
  ])

  return { data: users, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } }
}

export async function getUserById(id: string) {
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
    throw Object.assign(new Error('Không tìm thấy người dùng'), { statusCode: 404 })
  }

  return user
}

export async function createUser(data: {
  name: string
  email: string
  password: string
  role?: string
  phone?: string
}) {
  if (!data.name || !data.email || !data.password) {
    throw Object.assign(new Error('Vui lòng nhập đầy đủ họ tên, email và mật khẩu'), { statusCode: 400 })
  }

  const existing = await prisma.user.findUnique({ where: { email: data.email } })
  if (existing) {
    throw Object.assign(new Error('Email đã được sử dụng'), { statusCode: 409 })
  }

  const hashedPassword = await bcrypt.hash(data.password, 12)
  return prisma.user.create({
    data: { name: data.name, email: data.email, password: hashedPassword, role: data.role || 'STAFF', phone: data.phone },
    select: { id: true, name: true, email: true, role: true, phone: true, avatar: true, isActive: true, createdAt: true },
  })
}

export async function updateUser(id: string, data: {
  name?: string
  email?: string
  password?: string
  role?: string
  phone?: string
  isActive?: boolean
}) {
  const existing = await prisma.user.findUnique({ where: { id } })
  if (!existing) {
    throw Object.assign(new Error('Không tìm thấy người dùng'), { statusCode: 404 })
  }

  if (data.email && data.email !== existing.email) {
    const emailTaken = await prisma.user.findUnique({ where: { email: data.email } })
    if (emailTaken) {
      throw Object.assign(new Error('Email đã được sử dụng'), { statusCode: 409 })
    }
  }

  const updateData: Record<string, unknown> = {}
  if (data.name !== undefined) updateData.name = data.name
  if (data.email !== undefined) updateData.email = data.email
  if (data.role !== undefined) updateData.role = data.role
  if (data.phone !== undefined) updateData.phone = data.phone
  if (data.isActive !== undefined) updateData.isActive = data.isActive
  if (data.password) updateData.password = await bcrypt.hash(data.password, 12)

  return prisma.user.update({
    where: { id },
    data: updateData,
    select: { id: true, name: true, email: true, role: true, phone: true, avatar: true, isActive: true, createdAt: true, updatedAt: true },
  })
}

export async function deleteUser(id: string, actorId: string) {
  if (actorId === id) {
    throw Object.assign(new Error('Bạn không thể xóa chính mình'), { statusCode: 400 })
  }

  const existing = await prisma.user.findUnique({ where: { id } })
  if (!existing) {
    throw Object.assign(new Error('Không tìm thấy người dùng'), { statusCode: 404 })
  }

  await prisma.$transaction([
    prisma.warehouse.updateMany({ where: { managerId: id }, data: { managerId: null } }),
    prisma.warehouse.updateMany({ where: { staffId: id }, data: { staffId: null } }),
    prisma.inventoryItem.updateMany({ where: { auditedById: id }, data: { auditedById: null } }),
    prisma.shipment.updateMany({ where: { driverId: id }, data: { driverId: null } }),
    prisma.shipment.updateMany({ where: { createdById: id }, data: { createdById: actorId } }),
    prisma.user.delete({ where: { id } }),
  ])
}
