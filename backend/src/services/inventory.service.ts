import { prisma } from '../config/database'

interface InventoryQuery {
  page?: number
  limit?: number
  warehouseId?: string
  productId?: string
  lowStock?: boolean
  search?: string
  role?: string
  userId?: string
}

/**
 * Helper: resolve warehouse IDs accessible by the user based on role.
 * Uses indexed fields (managerId, staffId) for fast lookups.
 */
async function getUserWarehouseIds(role: string | undefined, userId: string | undefined): Promise<string[] | null> {
  if (role === 'MANAGER') {
    return (await prisma.warehouse.findMany({
      where: { managerId: userId },
      select: { id: true },
    })).map(w => w.id)
  }
  if (role === 'STAFF') {
    return (await prisma.warehouse.findMany({
      where: { staffId: userId },
      select: { id: true },
    })).map(w => w.id)
  }
  return null // ADMIN — no filter
}

export async function getInventory(query: InventoryQuery) {
  const page = query.page || 1
  const limit = query.limit || 20
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = {}

  if (query.warehouseId) where.warehouseId = query.warehouseId
  if (query.productId) where.productId = query.productId

  // Role-based filtering
  const whIds = await getUserWarehouseIds(query.role, query.userId)
  if (whIds !== null) {
    where.warehouseId = whIds.length > 0 ? { in: whIds } : 'none'
  }

  // Build product conditions (merged with search)
  const productWhere: Record<string, unknown> = {}
  if (query.search) {
    productWhere.OR = [
      { name: { contains: query.search, mode: 'insensitive' as const } },
      { sku: { contains: query.search, mode: 'insensitive' as const } },
    ]
  }
  if (query.lowStock) {
    productWhere.isActive = true
  }
  if (Object.keys(productWhere).length > 0) {
    where.product = productWhere
  }

  const [items, total] = await Promise.all([
    prisma.inventoryItem.findMany({
      where,
      skip,
      take: limit,
      orderBy: { updatedAt: 'desc' },
      include: {
        product: { select: { id: true, name: true, sku: true, category: true, unit: true, minStockLevel: true, imageUrl: true, qrCode: true } },
        warehouse: { select: { id: true, name: true, code: true, city: true } },
        zone: true,
        auditedBy: { select: { id: true, name: true } },
      },
    }),
    prisma.inventoryItem.count({ where }),
  ])

  // Low-stock JS filter (Prisma can't compare quantity with product.minStockLevel in WHERE)
  let filtered = items
  if (query.lowStock) {
    filtered = items.filter((item: any) => item.quantity < item.product.minStockLevel)
  }

  return { items: filtered, total, page, limit, totalPages: Math.ceil(total / limit) }
}

export async function getInventoryById(id: string, role?: string, userId?: string) {
  const item = await prisma.inventoryItem.findUnique({
    where: { id },
    include: {
      product: { select: { id: true, name: true, sku: true, category: true, unit: true, minStockLevel: true, imageUrl: true, qrCode: true } },
      warehouse: { select: { id: true, name: true, code: true, city: true } },
      zone: true,
      auditedBy: { select: { id: true, name: true } },
    },
  })

  if (!item) {
    throw Object.assign(new Error('Không tìm thấy bản ghi tồn kho'), { statusCode: 404 })
  }

  // Role-based access check
  if (role === 'MANAGER' || role === 'STAFF') {
    const roleField = role === 'MANAGER' ? 'managerId' : 'staffId'
    const wh = await prisma.warehouse.findFirst({
      where: { id: item.warehouseId, [roleField]: userId },
      select: { id: true },
    })
    if (!wh) {
      throw Object.assign(new Error('Bạn không có quyền xem tồn kho này'), { statusCode: 403 })
    }
  }

  return item
}

export async function createInventory(data: {
  productId: string
  warehouseId: string
  zoneId?: string
  rack?: string
  shelf?: string
  quantity: number
  notes?: string
  auditedById?: string
}, role?: string, userId?: string) {
  // Role-based access check
  if (role === 'MANAGER' || role === 'STAFF') {
    const roleField = role === 'MANAGER' ? 'managerId' : 'staffId'
    const wh = await prisma.warehouse.findFirst({
      where: { id: data.warehouseId, [roleField]: userId },
      select: { id: true },
    })
    if (!wh) {
      throw Object.assign(new Error('Bạn không có quyền thêm tồn kho vào kho này'), { statusCode: 403 })
    }
  }

  try {
    return await prisma.inventoryItem.create({
      data: {
        productId: data.productId,
        warehouseId: data.warehouseId,
        zoneId: data.zoneId,
        rack: data.rack,
        shelf: data.shelf,
        quantity: data.quantity || 0,
        notes: data.notes,
        lastAuditAt: new Date(),
        auditedById: data.auditedById,
      },
      include: {
        product: { select: { id: true, name: true, sku: true, unit: true } },
        warehouse: { select: { id: true, name: true, code: true } },
      },
    })
  } catch (error: unknown) {
    if ((error as { code?: string }).code === 'P2002') {
      throw Object.assign(new Error('Sản phẩm đã tồn tại ở vị trí này'), { statusCode: 409 })
    }
    throw error
  }
}

export async function updateInventory(id: string, data: {
  quantity: number
  rack?: string
  shelf?: string
  zoneId?: string
  notes?: string
  auditedById?: string
}, role?: string, userId?: string) {
  const current = await prisma.inventoryItem.findUnique({
    where: { id },
    include: { product: true, warehouse: { select: { id: true, name: true } } },
  })

  if (!current) {
    throw Object.assign(new Error('Không tìm thấy bản ghi tồn kho'), { statusCode: 404 })
  }

  // Role-based access check
  if (role === 'MANAGER' || role === 'STAFF') {
    const roleField = role === 'MANAGER' ? 'managerId' : 'staffId'
    const wh = await prisma.warehouse.findFirst({
      where: { id: current.warehouseId, [roleField]: userId },
      select: { id: true },
    })
    if (!wh) {
      throw Object.assign(new Error('Bạn không có quyền cập nhật tồn kho này'), { statusCode: 403 })
    }
  }

  // Update inventory
  const updated = await prisma.inventoryItem.update({
    where: { id },
    data: {
      quantity: data.quantity,
      rack: data.rack,
      shelf: data.shelf,
      zoneId: data.zoneId,
      notes: data.notes,
      lastAuditAt: new Date(),
      auditedById: data.auditedById,
    },
    include: { product: true, warehouse: true },
  })

  // Auto-manage stock alerts
  await manageStockAlerts(current.productId, current.warehouseId, data.quantity, current.product, current.warehouse?.name)

  return updated
}

async function manageStockAlerts(
  productId: string,
  warehouseId: string,
  newQuantity: number,
  product: { name: string; unit: string; minStockLevel: number },
  warehouseName?: string
) {
  const existingAlerts = await prisma.stockAlert.findMany({
    where: { productId, warehouseId, isResolved: false },
  })

  if (newQuantity >= product.minStockLevel) {
    // Stock healthy — resolve alerts
    if (existingAlerts.length > 0) {
      await prisma.stockAlert.updateMany({
        where: { id: { in: existingAlerts.map(a => a.id) } },
        data: { isResolved: true, resolvedAt: new Date() },
      })
    }
  } else {
    // Low stock — create or update alert
    const severity = newQuantity === 0 ? 'CRITICAL' : newQuantity < product.minStockLevel / 2 ? 'HIGH' : 'MEDIUM'
    const alertType = newQuantity === 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK'
    const name = warehouseName || 'Unknown'
    const message = `${product.name} ${newQuantity === 0 ? 'đã hết hàng' : 'sắp hết hàng'} tại ${name} (còn ${newQuantity} ${product.unit})`

    if (existingAlerts.length > 0) {
      await prisma.stockAlert.update({
        where: { id: existingAlerts[0].id },
        data: { currentQty: newQuantity, severity, alertType, message, updatedAt: new Date() },
      })
      // Resolve duplicates
      if (existingAlerts.length > 1) {
        await prisma.stockAlert.updateMany({
          where: { id: { in: existingAlerts.slice(1).map(a => a.id) } },
          data: { isResolved: true, resolvedAt: new Date() },
        })
      }
    } else {
      await prisma.stockAlert.create({
        data: { productId, warehouseId, alertType, severity, message, threshold: product.minStockLevel, currentQty: newQuantity },
      })
    }
  }
}

export async function getAlerts(
  isResolved: boolean,
  severity?: string,
  role?: string,
  userId?: string
) {
  const where: Record<string, unknown> = { isResolved }

  if (severity) where.severity = severity

  const whIds = await getUserWarehouseIds(role, userId)
  if (whIds !== null) {
    where.warehouseId = whIds.length > 0 ? { in: whIds } : 'none'
  }

  return prisma.stockAlert.findMany({
    where,
    orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
    include: {
      product: { select: { id: true, name: true, sku: true, category: true, imageUrl: true } },
      warehouse: { select: { id: true, name: true, code: true, city: true } },
    },
  })
}

export async function resolveAlert(id: string) {
  try {
    return await prisma.stockAlert.update({
      where: { id },
      data: { isResolved: true, resolvedAt: new Date() },
    })
  } catch {
    throw Object.assign(new Error('Không tìm thấy cảnh báo'), { statusCode: 404 })
  }
}
