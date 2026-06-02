import { Request, Response } from 'express'
import { prisma } from '../config/database'
import { sendSuccess, sendError } from '../utils/response'
import { AuthRequest } from '../middleware/auth.middleware'

// GET /api/inventory
export const getInventory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20', warehouseId, lowStock, search, productId } = req.query

    const pageNum = parseInt(page as string)
    const limitNum = parseInt(limit as string)
    const skip = (pageNum - 1) * limitNum

    const where: Record<string, unknown> = {}
    if (warehouseId) where.warehouseId = warehouseId
    if (productId) where.productId = productId

    // Role-based warehouse filtering
    if ((req as AuthRequest).user?.role === 'MANAGER') {
      const managedWarehouses = await prisma.warehouse.findMany({
        where: { managerId: (req as AuthRequest).user!.userId },
        select: { id: true },
      })
      const managedIds = managedWarehouses.map((w) => w.id)
      if (managedIds.length > 0) {
        where.warehouseId = { in: managedIds }
      } else {
        where.id = 'none'
      }
    } else if ((req as AuthRequest).user?.role === 'STAFF') {
      const staffWarehouses = await prisma.warehouse.findMany({
        where: { staffId: (req as AuthRequest).user!.userId },
        select: { id: true },
      })
      const staffIds = staffWarehouses.map((w) => w.id)
      if (staffIds.length > 0) {
        where.warehouseId = { in: staffIds }
      } else {
        where.id = 'none'
      }
    }

    if (lowStock === 'true') {
      where.product = { isActive: true }
      // Will filter in JS for quantity < minStockLevel
    }

    if (search) {
      where.product = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
        ],
      }
    }

    const [items, total] = await Promise.all([
      prisma.inventoryItem.findMany({
        where,
        skip,
        take: limitNum,
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

    let filtered = items
    if (lowStock === 'true') {
      filtered = items.filter((item: any) => item.quantity < item.product.minStockLevel)
    }

    sendSuccess(res, filtered, 'Lấy tồn kho thành công', 200, {
      total, page: pageNum, limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    })
  } catch (error) {
    sendError(res, 'Lỗi lấy tồn kho', 500, error)
  }
}

// GET /api/inventory/alerts
export const getAlerts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { isResolved = 'false', severity } = req.query

    const where: Record<string, unknown> = {
      isResolved: isResolved === 'true',
    }
    if (severity) where.severity = severity

    // Role-based warehouse filtering
    if ((req as AuthRequest).user?.role === 'MANAGER') {
      const managedWarehouses = await prisma.warehouse.findMany({
        where: { managerId: (req as AuthRequest).user!.userId },
        select: { id: true },
      })
      const managedIds = managedWarehouses.map((w) => w.id)
      if (managedIds.length > 0) {
        where.warehouseId = { in: managedIds }
      } else {
        where.id = 'none'
      }
    } else if ((req as AuthRequest).user?.role === 'STAFF') {
      const staffWarehouses = await prisma.warehouse.findMany({
        where: { staffId: (req as AuthRequest).user!.userId },
        select: { id: true },
      })
      const staffIds = staffWarehouses.map((w) => w.id)
      if (staffIds.length > 0) {
        where.warehouseId = { in: staffIds }
      } else {
        where.id = 'none'
      }
    }

    const alerts = await prisma.stockAlert.findMany({
      where,
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
      include: {
        product: { select: { id: true, name: true, sku: true, category: true, imageUrl: true } },
        warehouse: { select: { id: true, name: true, code: true, city: true } },
      },
    })

    sendSuccess(res, alerts, 'Lấy cảnh báo thành công')
  } catch (error) {
    sendError(res, 'Lỗi lấy cảnh báo', 500, error)
  }
}

// PUT /api/inventory/:id
export const updateInventory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { quantity, rack, shelf, zoneId, notes } = req.body

    const current = await prisma.inventoryItem.findUnique({
      where: { id: req.params.id },
      include: { product: true, warehouse: { select: { id: true, name: true } } },
    })

    if (!current) {
      sendError(res, 'Không tìm thấy bản ghi tồn kho', 404)
      return
    }

    // MANAGER/STAFF can only update inventory in their assigned warehouses
    if (req.user?.role === 'MANAGER' || req.user?.role === 'STAFF') {
      const roleField = req.user.role === 'MANAGER' ? 'managerId' : 'staffId'
      const wh = await prisma.warehouse.findFirst({
        where: { id: current.warehouseId, [roleField]: req.user.userId },
        select: { id: true },
      })
      if (!wh) {
        sendError(res, 'Bạn không có quyền cập nhật tồn kho này', 403)
        return
      }
    }

    const updated = await prisma.inventoryItem.update({
      where: { id: req.params.id },
      data: {
        quantity,
        rack,
        shelf,
        zoneId,
        notes,
        lastAuditAt: new Date(),
        auditedById: req.user?.userId,
      },
      include: {
        product: true,
        warehouse: true,
      },
    })

    // Check for alerts based on new quantity
    const existingAlerts = await prisma.stockAlert.findMany({
      where: { productId: current.productId, warehouseId: current.warehouseId, isResolved: false },
    })

    if (quantity >= current.product.minStockLevel) {
      // Resolve any existing alerts if stock is healthy
      if (existingAlerts.length > 0) {
        await prisma.stockAlert.updateMany({
          where: { id: { in: existingAlerts.map(a => a.id) } },
          data: { isResolved: true, resolvedAt: new Date() },
        })
      }
    } else {
      // Stock is low or out, create or update alert
      const severity = quantity === 0 ? 'CRITICAL' : quantity < current.product.minStockLevel / 2 ? 'HIGH' : 'MEDIUM'
      const alertType = quantity === 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK'
      const warehouseName = current.warehouse?.name || 'Unknown'
      const message = `${current.product.name} ${quantity === 0 ? 'đã hết hàng' : 'sắp hết hàng'} tại ${warehouseName} (còn ${quantity} ${current.product.unit})`

      const existingAlert = existingAlerts[0]
      if (existingAlert) {
        await prisma.stockAlert.update({
          where: { id: existingAlert.id },
          data: { currentQty: quantity, severity, alertType, message, updatedAt: new Date() },
        })
        // Resolve any duplicate alerts
        if (existingAlerts.length > 1) {
          await prisma.stockAlert.updateMany({
            where: { id: { in: existingAlerts.slice(1).map(a => a.id) } },
            data: { isResolved: true, resolvedAt: new Date() },
          })
        }
      } else {
        await prisma.stockAlert.create({
          data: {
            productId: current.productId,
            warehouseId: current.warehouseId,
            alertType,
            severity,
            message,
            threshold: current.product.minStockLevel,
            currentQty: quantity,
          },
        })
      }
    }

    sendSuccess(res, updated, 'Cập nhật tồn kho thành công')
  } catch (error) {
    sendError(res, 'Lỗi cập nhật tồn kho', 500, error)
  }
}

// POST /api/inventory
export const createInventory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { productId, warehouseId, zoneId, rack, shelf, quantity, notes } = req.body

    // MANAGER/STAFF can only add inventory to their assigned warehouses
    if (req.user?.role === 'MANAGER' || req.user?.role === 'STAFF') {
      const roleField = req.user.role === 'MANAGER' ? 'managerId' : 'staffId'
      const wh = await prisma.warehouse.findFirst({
        where: { id: warehouseId, [roleField]: req.user.userId },
        select: { id: true },
      })
      if (!wh) {
        sendError(res, 'Bạn không có quyền thêm tồn kho vào kho này', 403)
        return
      }
    }

    const item = await prisma.inventoryItem.create({
      data: {
        productId, warehouseId, zoneId, rack, shelf,
        quantity: quantity || 0, notes,
        lastAuditAt: new Date(),
        auditedById: req.user?.userId,
      },
      include: {
        product: { select: { id: true, name: true, sku: true, unit: true } },
        warehouse: { select: { id: true, name: true, code: true } },
      },
    })

    sendSuccess(res, item, 'Thêm vào tồn kho thành công', 201)
  } catch (error: unknown) {
    if ((error as { code?: string }).code === 'P2002') {
      sendError(res, 'Sản phẩm đã tồn tại ở vị trí này', 409)
      return
    }
    sendError(res, 'Lỗi thêm tồn kho', 500, error)
  }
}

// PUT /api/inventory/alerts/:id/resolve
export const resolveAlert = async (req: Request, res: Response): Promise<void> => {
  try {
    const alert = await prisma.stockAlert.update({
      where: { id: req.params.id },
      data: { isResolved: true, resolvedAt: new Date() },
    })
    sendSuccess(res, alert, 'Đã xử lý cảnh báo')
  } catch {
    sendError(res, 'Không tìm thấy cảnh báo', 404)
  }
}

// GET /api/inventory/:id
export const getInventoryById = async (req: Request, res: Response): Promise<void> => {
  try {
    const item = await prisma.inventoryItem.findUnique({
      where: { id: req.params.id },
      include: {
        product: { select: { id: true, name: true, sku: true, category: true, unit: true, minStockLevel: true, imageUrl: true, qrCode: true } },
        warehouse: { select: { id: true, name: true, code: true, city: true } },
        zone: true,
        auditedBy: { select: { id: true, name: true } },
      },
    })

    if (!item) {
      sendError(res, 'Không tìm thấy bản ghi tồn kho', 404)
      return
    }

    // Role-based access: MANAGER/STAFF can only view inventory from their assigned warehouses
    const authReq = req as AuthRequest
    if (authReq.user?.role === 'MANAGER' || authReq.user?.role === 'STAFF') {
      const roleField = authReq.user.role === 'MANAGER' ? 'managerId' : 'staffId'
      const wh = await prisma.warehouse.findFirst({
        where: { id: item.warehouseId, [roleField]: authReq.user.userId },
        select: { id: true },
      })
      if (!wh) {
        sendError(res, 'Bạn không có quyền xem tồn kho này', 403)
        return
      }
    }

    sendSuccess(res, item, 'Lấy chi tiết tồn kho thành công')
  } catch (error) {
    sendError(res, 'Lỗi lấy chi tiết tồn kho', 500, error)
  }
}
