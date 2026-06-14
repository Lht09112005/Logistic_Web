import { prisma } from '../config/database'

interface WarehouseQuery {
  status?: string
  search?: string
  all?: boolean
  role?: string
  userId?: string
}

export async function getWarehouses(query: WarehouseQuery) {
  const where: Record<string, unknown> = {}

  if (query.role === 'MANAGER' && query.all !== true) {
    where.managerId = query.userId
  }
  if (query.role === 'STAFF' && query.all !== true) {
    where.staffId = query.userId
  }
  if (query.status) where.status = query.status
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' as const } },
      { code: { contains: query.search, mode: 'insensitive' as const } },
      { city: { contains: query.search, mode: 'insensitive' as const } },
    ]
  }

  return prisma.warehouse.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      manager: { select: { id: true, name: true, email: true } },
      staff: { select: { id: true, name: true, email: true } },
      _count: { select: { inventory: true, zones: true } },
    },
  })
}

export async function getWarehouseById(id: string, role?: string, userId?: string) {
  const warehouse = await prisma.warehouse.findUnique({
    where: { id },
    include: {
      manager: { select: { id: true, name: true, email: true, phone: true } },
      staff: { select: { id: true, name: true, email: true, phone: true } },
      zones: true,
      inventory: {
        take: 20,
        include: {
          product: { select: { id: true, name: true, sku: true, category: true, unit: true, minStockLevel: true } },
        },
      },
      _count: { select: { inventory: true } },
    },
  })

  if (!warehouse) {
    throw Object.assign(new Error('Không tìm thấy kho'), { statusCode: 404 })
  }

  if (role === 'MANAGER' && warehouse.managerId !== userId) {
    throw Object.assign(new Error('Bạn không có quyền xem kho này'), { statusCode: 403 })
  }
  if (role === 'STAFF' && warehouse.staffId !== userId) {
    throw Object.assign(new Error('Bạn không có quyền xem kho này'), { statusCode: 403 })
  }

  return warehouse
}

interface ZoneInput {
  name: string
  description?: string
  capacity: number
}

export async function createWarehouse(data: {
  name: string
  code: string
  address: string
  city: string
  province?: string
  country?: string
  latitude?: number
  longitude?: number
  totalArea?: number
  capacity?: number
  managerId?: string
  description?: string
  zones?: ZoneInput[]
}) {
  const warehouse = await prisma.warehouse.create({
    data: {
      name: data.name,
      code: data.code,
      address: data.address,
      city: data.city,
      province: data.province || '',
      country: data.country || 'Vietnam',
      latitude: data.latitude,
      longitude: data.longitude,
      totalArea: data.totalArea ?? 0,
      capacity: data.capacity ?? 0,
      managerId: data.managerId,
      description: data.description,
      zones: data.zones?.length
        ? { create: data.zones.map(z => ({ name: z.name, description: z.description, capacity: z.capacity })) }
        : undefined,
    },
    include: {
      manager: { select: { id: true, name: true } },
      staff: { select: { id: true, name: true } },
      zones: true,
    },
  })

  return warehouse
}

export async function updateWarehouse(id: string, data: Record<string, unknown>, role?: string, userId?: string) {
  const existing = await prisma.warehouse.findUnique({
    where: { id },
    select: { id: true, managerId: true },
  })

  if (!existing) {
    throw Object.assign(new Error('Không tìm thấy kho'), { statusCode: 404 })
  }

  if (role === 'MANAGER' && existing.managerId !== userId) {
    throw Object.assign(new Error('Bạn không có quyền cập nhật kho này'), { statusCode: 403 })
  }

  return prisma.warehouse.update({
    where: { id },
    data,
    include: {
      manager: { select: { id: true, name: true, email: true } },
      staff: { select: { id: true, name: true, email: true } },
      _count: { select: { inventory: true, zones: true } },
    },
  })
}

export async function deleteWarehouse(id: string) {
  await prisma.warehouse.update({
    where: { id },
    data: { status: 'INACTIVE' },
  })
}
