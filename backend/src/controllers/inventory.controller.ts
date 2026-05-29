import { Request, Response } from 'express'
import { prisma } from '../config/database'
import { sendSuccess, sendError } from '../utils/response'
import { AuthRequest } from '../middleware/auth.middleware'

// GET /api/inventory
export const getInventory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20', warehouseId, lowStock, search } = req.query

    const pageNum = parseInt(page as string)
    const limitNum = parseInt(limit as string)
    const skip = (pageNum - 1) * limitNum

    const where: Record<string, unknown> = {}
    if (warehouseId) where.warehouseId = warehouseId

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

    const alerts = await prisma.stockAlert.findMany({
      where,
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
      include: {
        product: { select: { id: true, name: true, sku: true, category: true, imageUrl: true } },
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
      include: { product: true },
    })

    if (!current) {
      sendError(res, 'Không tìm thấy bản ghi tồn kho', 404)
      return
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

    // Check for low stock and create alerts
    if (quantity < current.product.minStockLevel) {
      const severity = quantity === 0 ? 'CRITICAL' : quantity < current.product.minStockLevel / 2 ? 'HIGH' : 'MEDIUM'
      const alertType = quantity === 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK'

      await prisma.stockAlert.upsert({
        where: {
          // Custom composite - find existing unresolved alert
          id: (await prisma.stockAlert.findFirst({
            where: { productId: current.productId, isResolved: false, alertType },
          }))?.id || 'new-alert',
        },
        update: { currentQty: quantity, severity, updatedAt: new Date() },
        create: {
          productId: current.productId,
          alertType,
          severity,
          message: `${current.product.name} ${quantity === 0 ? 'đã hết hàng' : 'sắp hết hàng'} (còn ${quantity} ${current.product.unit})`,
          threshold: current.product.minStockLevel,
          currentQty: quantity,
        },
      })
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

    sendSuccess(res, item, 'Lấy chi tiết tồn kho thành công')
  } catch (error) {
    sendError(res, 'Lỗi lấy chi tiết tồn kho', 500, error)
  }
}
