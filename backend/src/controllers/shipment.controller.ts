import { Request, Response } from 'express'
import { prisma } from '../config/database'
import { sendSuccess, sendError } from '../utils/response'
import { AuthRequest } from '../middleware/auth.middleware'

// GET /api/shipments
export const getShipments = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20', status, driverId, search } = req.query

    const pageNum = parseInt(page as string)
    const limitNum = parseInt(limit as string)

    const where: Record<string, unknown> = {}
    if (status) {
      const statusValues = (status as string).split(',').filter(Boolean)
      if (statusValues.length === 1) {
        where.status = statusValues[0]
      } else {
        where.status = { in: statusValues }
      }
    }
    if (driverId) where.driverId = driverId
    if (search) {
      where.OR = [
        { shipmentCode: { contains: search, mode: 'insensitive' } },
        { originAddress: { contains: search, mode: 'insensitive' } },
        { destinationAddress: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [shipments, total] = await Promise.all([
      prisma.shipment.findMany({
        where,
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          driver: { select: { id: true, name: true, phone: true, avatar: true } },
          createdBy: { select: { id: true, name: true } },
          items: { include: { product: { select: { id: true, name: true, unit: true } } } },
          checkpoints: { orderBy: { sequence: 'asc' } },
          _count: { select: { items: true, checkpoints: true } },
        },
      }),
      prisma.shipment.count({ where }),
    ])

    sendSuccess(res, shipments, 'Lấy danh sách vận chuyển thành công', 200, {
      total, page: pageNum, limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    })
  } catch (error) {
    sendError(res, 'Lỗi lấy danh sách vận chuyển', 500, error)
  }
}

// GET /api/shipments/:id
export const getShipmentById = async (req: Request, res: Response): Promise<void> => {
  try {
    const shipment = await prisma.shipment.findUnique({
      where: { id: req.params.id },
      include: {
        driver: { select: { id: true, name: true, phone: true, avatar: true } },
        createdBy: { select: { id: true, name: true } },
        originWarehouse: { select: { id: true, name: true, code: true, address: true } },
        destinationWarehouse: { select: { id: true, name: true, code: true, address: true } },
        items: {
          include: { product: { select: { id: true, name: true, sku: true, unit: true, weight: true } } },
        },
        checkpoints: { orderBy: { sequence: 'asc' } },
        trackingHistory: { orderBy: { recordedAt: 'desc' }, take: 50 },
      },
    })

    if (!shipment) {
      sendError(res, 'Không tìm thấy vận đơn', 404)
      return
    }

    sendSuccess(res, shipment)
  } catch (error) {
    sendError(res, 'Lỗi lấy vận đơn', 500, error)
  }
}

// POST /api/shipments
export const createShipment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      driverId, vehicleNumber, vehicleType,
      originWarehouseId, destinationWarehouseId,
      originAddress, destinationAddress,
      originLat, originLng, destinationLat, destinationLng,
      estimatedArrival, items = [], checkpoints = [], notes,
    } = req.body

    // Generate shipment code
    const count = await prisma.shipment.count()
    const shipmentCode = `SHP-${String(count + 1).padStart(6, '0')}`

    const shipment = await prisma.shipment.create({
      data: {
        shipmentCode,
        driverId,
        createdById: req.user!.userId,
        vehicleNumber,
        vehicleType,
        originWarehouseId,
        destinationWarehouseId,
        originAddress,
        destinationAddress,
        originLat,
        originLng,
        destinationLat,
        destinationLng,
        currentLat: originLat,
        currentLng: originLng,
        estimatedArrival: estimatedArrival ? new Date(estimatedArrival) : undefined,
        notes,
        items: {
          create: items.map((item: { productId: string; quantity: number; weight?: number; notes?: string }) => ({
            productId: item.productId,
            quantity: item.quantity,
            weight: item.weight,
            notes: item.notes,
          })),
        },
        checkpoints: {
          create: checkpoints.map((cp: { name: string; address: string; latitude?: number; longitude?: number; sequence: number; estimatedAt?: string }, idx: number) => ({
            name: cp.name,
            address: cp.address,
            latitude: cp.latitude,
            longitude: cp.longitude,
            sequence: cp.sequence || idx + 1,
            estimatedAt: cp.estimatedAt ? new Date(cp.estimatedAt) : undefined,
          })),
        },
      },
      include: {
        driver: { select: { id: true, name: true, phone: true } },
        items: { include: { product: { select: { id: true, name: true } } } },
        checkpoints: { orderBy: { sequence: 'asc' } },
      },
    })

    sendSuccess(res, shipment, 'Tạo vận đơn thành công', 201)
  } catch (error) {
    sendError(res, 'Lỗi tạo vận đơn', 500, error)
  }
}

// PUT /api/shipments/:id
export const updateShipment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, currentLat, currentLng, vehicleNumber, estimatedArrival, notes, checkpoints } = req.body

    const updateData: Record<string, unknown> = {}
    if (status) updateData.status = status
    if (vehicleNumber) updateData.vehicleNumber = vehicleNumber
    if (estimatedArrival) updateData.estimatedArrival = new Date(estimatedArrival)
    if (notes !== undefined) updateData.notes = notes

    if (currentLat !== undefined && currentLng !== undefined) {
      updateData.currentLat = currentLat
      updateData.currentLng = currentLng

      // Add to tracking history
      await prisma.trackingHistory.create({
        data: {
          shipmentId: req.params.id,
          latitude: currentLat,
          longitude: currentLng,
          status: status || undefined,
          description: status ? `Trạng thái: ${status}` : 'Cập nhật vị trí',
        },
      })
    }

    if (status === 'IN_TRANSIT') updateData.startedAt = new Date()
    if (status === 'DELIVERED') updateData.actualArrival = new Date()

    // Handle checkpoint updates (driver confirms arrival at a checkpoint)
    if (checkpoints && Array.isArray(checkpoints)) {
      for (const cp of checkpoints) {
        if (cp.id) {
          const updateCpData: Record<string, unknown> = {}
          if (cp.isCompleted !== undefined) updateCpData.isCompleted = cp.isCompleted
          if (cp.isCompleted && cp.arrivedAt) {
            updateCpData.arrivedAt = new Date(cp.arrivedAt)
          } else if (cp.isCompleted) {
            updateCpData.arrivedAt = new Date()
          }
          if (Object.keys(updateCpData).length > 0) {
            await prisma.shipmentCheckpoint.update({
              where: { id: cp.id },
              data: updateCpData,
            })
          }
        }
      }
    }

    const shipment = await prisma.shipment.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        driver: { select: { id: true, name: true, phone: true } },
        checkpoints: { orderBy: { sequence: 'asc' } },
      },
    })

    sendSuccess(res, shipment, 'Cập nhật vận đơn thành công')
  } catch (error: unknown) {
    if ((error as { code?: string }).code === 'P2025') {
      sendError(res, 'Không tìm thấy vận đơn', 404)
      return
    }
    sendError(res, 'Lỗi cập nhật vận đơn', 500, error)
  }
}

// POST /api/shipments/:id/receive
export const receiveShipment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const shipment = await prisma.shipment.findUnique({
      where: { id: req.params.id },
      include: {
        items: { include: { product: true } },
        destinationWarehouse: true,
      },
    })

    if (!shipment) {
      sendError(res, 'Không tìm thấy vận đơn', 404)
      return
    }

    // If already delivered, return success without changes
    if (shipment.status === 'DELIVERED') {
      sendSuccess(res, { shipment, inventoryItems: [] }, 'Vận đơn đã được tiếp nhận trước đó')
      return
    }

    if (shipment.status !== 'DELIVERING' && shipment.status !== 'IN_TRANSIT') {
      sendError(res, 'Vận đơn chưa đến kho đích', 400)
      return
    }

    if (!shipment.destinationWarehouseId) {
      sendError(res, 'Vận đơn không có kho đích', 400)
      return
    }

    // For each item in the shipment, create or update inventory
    const inventoryResults = []
    for (const item of shipment.items) {
      const existingInventory = await prisma.inventoryItem.findFirst({
        where: {
          productId: item.productId,
          warehouseId: shipment.destinationWarehouseId!,
        },
      })

      if (existingInventory) {
        const updated = await prisma.inventoryItem.update({
          where: { id: existingInventory.id },
          data: { quantity: existingInventory.quantity + item.quantity },
        })
        inventoryResults.push(updated)
      } else {
        const created = await prisma.inventoryItem.create({
          data: {
            productId: item.productId,
            warehouseId: shipment.destinationWarehouseId!,
            quantity: item.quantity,
          },
        })
        inventoryResults.push(created)
      }
    }

    // Update shipment status to DELIVERED
    const updated = await prisma.shipment.update({
      where: { id: req.params.id },
      data: { status: 'DELIVERED', actualArrival: new Date() },
      include: {
        driver: { select: { id: true, name: true, phone: true } },
        checkpoints: { orderBy: { sequence: 'asc' } },
      },
    })

    sendSuccess(res, { shipment: updated, inventoryItems: inventoryResults }, 'Tiếp nhận hàng vào kho thành công')
  } catch (error) {
    sendError(res, 'Lỗi tiếp nhận hàng', 500, error)
  }
}

// PUT /api/shipments/:id/approve
export const approveShipment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const shipment = await prisma.shipment.findUnique({
      where: { id: req.params.id },
      include: {
        originWarehouse: { select: { id: true, managerId: true } },
        items: true,
      },
    })

    if (!shipment) {
      sendError(res, 'Không tìm thấy vận đơn', 404)
      return
    }

    if (shipment.status !== 'PENDING') {
      sendError(res, 'Chỉ có thể duyệt vận đơn đang ở trạng thái chờ', 400)
      return
    }

    // Only the manager of the source warehouse can approve
    const userId = req.user!.userId
    const userRole = req.user!.role
    if (userRole !== 'ADMIN') {
      if (!shipment.originWarehouse || shipment.originWarehouse.managerId !== userId) {
        sendError(res, 'Bạn không có quyền duyệt vận đơn này. Chỉ quản lý kho nguồn mới có thể duyệt.', 403)
        return
      }
    }

    // Reserve inventory from source warehouse
    if (shipment.originWarehouseId && shipment.items.length > 0) {
      for (const item of shipment.items) {
        const inventoryItems = await prisma.inventoryItem.findMany({
          where: {
            productId: item.productId,
            warehouseId: shipment.originWarehouseId,
            quantity: { gte: item.quantity },
          },
          orderBy: { quantity: 'desc' },
        })

        const totalAvailable = inventoryItems.reduce((sum, inv) => sum + inv.quantity, 0)
        if (totalAvailable < item.quantity) {
          sendError(res, `Kho nguồn không đủ hàng: ${item.productId}. Yêu cầu ${item.quantity}, chỉ còn ${totalAvailable}`, 400)
          return
        }

        // Reserve from the first matching inventory item
        let remaining = item.quantity
        for (const inv of inventoryItems) {
          if (remaining <= 0) break
          const toReserve = Math.min(remaining, inv.quantity)
          await prisma.inventoryItem.update({
            where: { id: inv.id },
            data: { reservedQty: inv.reservedQty + toReserve },
          })
          remaining -= toReserve
        }
      }
    }

    const updated = await prisma.shipment.update({
      where: { id: req.params.id },
      data: { status: 'CONFIRMED' },
      include: {
        driver: { select: { id: true, name: true, phone: true } },
        checkpoints: { orderBy: { sequence: 'asc' } },
      },
    })

    sendSuccess(res, updated, 'Đã duyệt vận đơn thành công')
  } catch (error) {
    sendError(res, 'Lỗi duyệt vận đơn', 500, error)
  }
}

// PUT /api/shipments/:id/reject
export const rejectShipment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { reason } = req.body

    if (!reason || reason.trim() === '') {
      sendError(res, 'Vui lòng cung cấp lý do từ chối', 400)
      return
    }

    const shipment = await prisma.shipment.findUnique({
      where: { id: req.params.id },
      include: {
        originWarehouse: { select: { id: true, managerId: true } },
      },
    })

    if (!shipment) {
      sendError(res, 'Không tìm thấy vận đơn', 404)
      return
    }

    if (shipment.status !== 'PENDING') {
      sendError(res, 'Chỉ có thể từ chối vận đơn đang ở trạng thái chờ', 400)
      return
    }

    const userId = req.user!.userId
    const userRole = req.user!.role
    if (userRole !== 'ADMIN') {
      if (!shipment.originWarehouse || shipment.originWarehouse.managerId !== userId) {
        sendError(res, 'Bạn không có quyền từ chối vận đơn này', 403)
        return
      }
    }

    const updated = await prisma.shipment.update({
      where: { id: req.params.id },
      data: { status: 'CANCELLED', rejectionReason: reason },
      include: {
        driver: { select: { id: true, name: true, phone: true } },
        checkpoints: { orderBy: { sequence: 'asc' } },
      },
    })

    sendSuccess(res, updated, 'Đã từ chối vận đơn')
  } catch (error) {
    sendError(res, 'Lỗi từ chối vận đơn', 500, error)
  }
}

// PUT /api/shipments/:id/loading
export const startLoadingShipment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const shipment = await prisma.shipment.findUnique({
      where: { id: req.params.id },
      include: {
        originWarehouse: { select: { id: true, managerId: true } },
        items: true,
      },
    })

    if (!shipment) {
      sendError(res, 'Không tìm thấy vận đơn', 404)
      return
    }

    if (shipment.status !== 'CONFIRMED') {
      sendError(res, 'Chỉ có thể xếp hàng cho vận đơn đã duyệt', 400)
      return
    }

    // Deduct inventory from source warehouse (release reservedQty, deduct quantity)
    if (shipment.originWarehouseId && shipment.items.length > 0) {
      for (const item of shipment.items) {
        let remaining = item.quantity
        const inventoryItems = await prisma.inventoryItem.findMany({
          where: {
            productId: item.productId,
            warehouseId: shipment.originWarehouseId,
            reservedQty: { gte: 1 },
          },
          orderBy: { reservedQty: 'desc' },
        })

        for (const inv of inventoryItems) {
          if (remaining <= 0) break
          const toDeduct = Math.min(remaining, inv.reservedQty, inv.quantity)
          await prisma.inventoryItem.update({
            where: { id: inv.id },
            data: {
              quantity: inv.quantity - toDeduct,
              reservedQty: inv.reservedQty - toDeduct,
            },
          })
          remaining -= toDeduct
        }
      }
    }

    const updated = await prisma.shipment.update({
      where: { id: req.params.id },
      data: { status: 'LOADING' },
    })

    sendSuccess(res, updated, 'Đã bắt đầu xếp hàng')
  } catch (error) {
    sendError(res, 'Lỗi xếp hàng', 500, error)
  }
}

// GET /api/shipments/stats
export const getShipmentStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [total, inTransit, delivered, pending, failed] = await Promise.all([
      prisma.shipment.count(),
      prisma.shipment.count({ where: { status: 'IN_TRANSIT' } }),
      prisma.shipment.count({ where: { status: 'DELIVERED' } }),
      prisma.shipment.count({ where: { status: 'PENDING' } }),
      prisma.shipment.count({ where: { status: 'FAILED' } }),
    ])

    // Count PENDING shipments where current user is the manager of the source warehouse
    let pendingForCurrentUser = 0
    if (req.user) {
      const userWarehouses = await prisma.warehouse.findMany({
        where: { managerId: req.user.userId },
        select: { id: true },
      })
      const warehouseIds = userWarehouses.map((wh) => wh.id)
      if (warehouseIds.length > 0) {
        pendingForCurrentUser = await prisma.shipment.count({
          where: {
            status: 'PENDING',
            originWarehouseId: { in: warehouseIds },
          },
        })
      }
    }

    sendSuccess(res, { total, inTransit, delivered, pending, failed, pendingForCurrentUser })
  } catch (error) {
    sendError(res, 'Lỗi lấy thống kê', 500, error)
  }
}
