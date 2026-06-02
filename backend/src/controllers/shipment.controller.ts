import { Request, Response } from 'express'
import { prisma } from '../config/database'
import { sendSuccess, sendError } from '../utils/response'
import { AuthRequest } from '../middleware/auth.middleware'
import { io } from '../index'

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

    // Build search OR condition (may be combined with role filter later)
    let searchOr: Record<string, unknown>[] | null = null
    if (search) {
      searchOr = [
        { shipmentCode: { contains: search, mode: 'insensitive' } },
        { originAddress: { contains: search, mode: 'insensitive' } },
        { destinationAddress: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Role-based filtering
    const userRole = (req as AuthRequest).user?.role
    const userId = (req as AuthRequest).user?.userId

    if (userRole === 'DRIVER') {
      // DRIVER can only see shipments assigned to them
      if (!userId) {
        where.id = 'none'
      } else {
        where.driverId = userId
      }
      if (searchOr) where.OR = searchOr
    } else if (userRole === 'MANAGER' || userRole === 'STAFF') {
      const roleField = userRole === 'MANAGER' ? 'managerId' : 'staffId'
      const whIds = (await prisma.warehouse.findMany({
        where: { [roleField]: userId },
        select: { id: true },
      })).map(w => w.id)

      if (whIds.length > 0) {
        const roleOr = [
          { originWarehouseId: { in: whIds } },
          { destinationWarehouseId: { in: whIds } },
        ]
        // Combine with search if present
        if (searchOr) {
          where.AND = [{ OR: searchOr }, { OR: roleOr }]
        } else {
          where.OR = roleOr
        }
      } else {
        where.id = 'none'
      }
    } else if (searchOr) {
      where.OR = searchOr
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

    // DRIVER can only view their own shipments
    const authReq = req as AuthRequest
    if (authReq.user?.role === 'DRIVER' && shipment.driverId !== authReq.user.userId) {
      sendError(res, 'Bạn không có quyền xem vận đơn này', 403)
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

    const missingFields: string[] = []
    if (!driverId) missingFields.push('Tài xế')
    if (!vehicleType) missingFields.push('Loại phương tiện')
    if (!vehicleNumber) missingFields.push('Biển số xe')
    if (!estimatedArrival) missingFields.push('Ngày giao dự kiến')

    if (missingFields.length > 0) {
      sendError(res, `Vui lòng nhập các thông tin bắt buộc: ${missingFields.join(', ')}.`, 400)
      return
    }

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

    // --- CREATE NOTIFICATIONS ---
    // Notify all ADMIN users
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } })
    for (const admin of admins) {
      const notif = await prisma.notification.create({
        data: {
          userId: admin.id,
          title: 'Vận đơn mới cần duyệt',
          message: `Vận đơn ${shipmentCode} vừa được tạo và đang chờ duyệt.`,
          type: 'INFO',
          link: `/dashboard/shipments/${shipment.id}`,
        }
      })
      // Emit socket event to the specific user
      import('../index').then(({ io }) => {
        io.emit(`notification:${admin.id}`, notif)
      })
    }
    


    sendSuccess(res, shipment, 'Tạo vận đơn thành công', 201)
  } catch (error) {
    sendError(res, 'Lỗi tạo vận đơn', 500, error)
  }
}

// PUT /api/shipments/:id
export const updateShipment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, currentLat, currentLng, vehicleNumber, estimatedArrival, notes, checkpoints } = req.body
    const userId = req.user!.userId
    const userRole = req.user!.role

    // Fetch existing shipment to enforce access rules
    const existing = await prisma.shipment.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        driverId: true,
        destinationWarehouseId: true,
        shipmentCode: true,
        destinationWarehouse: { select: { id: true, name: true, managerId: true, staffId: true } },
      },
    })

    if (!existing) {
      sendError(res, 'Không tìm thấy vận đơn', 404)
      return
    }

    // DRIVER can only update their own assigned shipment
    if (userRole === 'DRIVER' && existing.driverId !== userId) {
      sendError(res, 'Bạn không có quyền cập nhật vận đơn này', 403)
      return
    }

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
    const completedCheckpoints: { id: string; name: string }[] = []
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
            const updatedCp = await prisma.shipmentCheckpoint.update({
              where: { id: cp.id },
              data: updateCpData,
            })
            if (cp.isCompleted) {
              completedCheckpoints.push({ id: updatedCp.id, name: updatedCp.name })
            }
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

    // Emit realtime notifications for completed checkpoints
    // Notifies MANAGER and STAFF of the destination warehouse
    if (completedCheckpoints.length > 0 && existing.destinationWarehouseId) {
      for (const cp of completedCheckpoints) {
        const payload = {
          shipmentId: existing.id,
          shipmentCode: existing.shipmentCode,
          checkpointId: cp.id,
          checkpointName: cp.name,
          destinationWarehouseId: existing.destinationWarehouseId,
          destinationWarehouseName: existing.destinationWarehouse?.name,
          timestamp: new Date().toISOString(),
        }
        // Broadcast to shipment room (anyone tracking this shipment)
        io.to(`shipment:${existing.id}`).emit('checkpoint:completed', payload)
        // Broadcast globally so STAFF/MANAGER of destination warehouse can react
        io.emit('shipment:checkpoint_update', payload)
      }
    }

    // Also broadcast position update
    if (currentLat !== undefined && currentLng !== undefined) {
      io.emit('shipment:position', {
        shipmentId: existing.id,
        latitude: currentLat,
        longitude: currentLng,
        status,
      })
    }

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
        include: { product: true },
      })

      if (existingInventory) {
        const newQty = existingInventory.quantity + item.quantity
        const updated = await prisma.inventoryItem.update({
          where: { id: existingInventory.id },
          data: { quantity: newQty },
        })
        inventoryResults.push(updated)
        
        if (newQty >= existingInventory.product.minStockLevel) {
          await prisma.stockAlert.updateMany({
            where: { productId: item.productId, warehouseId: shipment.destinationWarehouseId!, isResolved: false },
            data: { isResolved: true, resolvedAt: new Date() },
          })
        }
      } else {
        const product = await prisma.product.findUnique({ where: { id: item.productId } })
        const created = await prisma.inventoryItem.create({
          data: {
            productId: item.productId,
            warehouseId: shipment.destinationWarehouseId!,
            quantity: item.quantity,
          },
        })
        inventoryResults.push(created)
        
        if (product && item.quantity >= product.minStockLevel) {
          await prisma.stockAlert.updateMany({
            where: { productId: item.productId, warehouseId: shipment.destinationWarehouseId!, isResolved: false },
            data: { isResolved: true, resolvedAt: new Date() },
          })
        }
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

    // Validate required fields before approving
    const missingFields: string[] = []
    if (!shipment.driverId) missingFields.push('Tài xế')
    if (!shipment.vehicleType) missingFields.push('Loại phương tiện')
    if (!shipment.vehicleNumber) missingFields.push('Biển số xe')
    if (!shipment.estimatedArrival) missingFields.push('Ngày giao dự kiến')

    if (missingFields.length > 0) {
      sendError(res, `Vui lòng cập nhật các thông tin bắt buộc trước khi duyệt: ${missingFields.join(', ')}.`, 400)
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
        // Calculate available quantity by subtracting reserved quantity
        const inventoryItems = await prisma.inventoryItem.findMany({
          where: {
            productId: item.productId,
            warehouseId: shipment.originWarehouseId,
            quantity: { gt: 0 },
          },
          orderBy: { quantity: 'desc' },
        })

        const totalAvailable = inventoryItems.reduce((sum, inv) => sum + (inv.quantity - inv.reservedQty), 0)
        if (totalAvailable < item.quantity) {
          sendError(res, `Kho nguồn không đủ hàng hoặc đã được giữ chỗ cho đơn khác. Yêu cầu ${item.quantity}, khả dụng ${totalAvailable}`, 400)
          return
        }

        // Reserve from the matching inventory items (only considering available = qty - reserved)
        let remaining = item.quantity
        for (const inv of inventoryItems) {
          if (remaining <= 0) break
          const availableInInv = inv.quantity - inv.reservedQty
          if (availableInInv <= 0) continue

          const toReserve = Math.min(remaining, availableInInv)
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

    // --- CREATE NOTIFICATION ---
    // Notify the creator that the shipment was approved
    if (shipment.createdById !== req.user!.userId) {
      const notif = await prisma.notification.create({
        data: {
          userId: shipment.createdById,
          title: 'Vận đơn đã được duyệt',
          message: `Vận đơn ${shipment.shipmentCode} đã được duyệt và chuyển sang trạng thái chờ xếp hàng.`,
          type: 'SUCCESS',
          link: `/dashboard/shipments/${shipment.id}`,
        }
      })
      import('../index').then(({ io }) => {
        io.emit(`notification:${shipment.createdById}`, notif)
      })
    }

    // Notify Driver that the shipment is approved and they are assigned
    if (shipment.driverId) {
      const notif = await prisma.notification.create({
        data: {
          userId: shipment.driverId,
          title: 'Được phân công chuyến xe mới',
          message: `Bạn được phân công vận chuyển mã ${shipment.shipmentCode}.`,
          type: 'INFO',
          link: `/dashboard/shipments/${shipment.id}`,
        }
      })
      import('../index').then(({ io }) => {
        io.emit(`notification:${shipment.driverId}`, notif)
      })
    }

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

    // --- CREATE NOTIFICATION ---
    if (shipment.createdById !== req.user!.userId) {
      const notif = await prisma.notification.create({
        data: {
          userId: shipment.createdById,
          title: 'Vận đơn bị từ chối',
          message: `Vận đơn ${shipment.shipmentCode} đã bị từ chối. Lý do: ${reason}`,
          type: 'ERROR',
          link: `/dashboard/shipments/${shipment.id}`,
        }
      })
      import('../index').then(({ io }) => {
        io.emit(`notification:${shipment.createdById}`, notif)
      })
    }

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
    // Role-based warehouse filtering for stats
    const userRole = req.user?.role
    const userId = req.user?.userId
    let roleWhere: Record<string, unknown> = {}

    if (userRole === 'MANAGER' || userRole === 'STAFF') {
      const roleField = userRole === 'MANAGER' ? 'managerId' : 'staffId'
      const whIds = (await prisma.warehouse.findMany({
        where: { [roleField]: userId },
        select: { id: true },
      })).map(w => w.id)

      if (whIds.length > 0) {
        roleWhere = {
          OR: [
            { originWarehouseId: { in: whIds } },
            { destinationWarehouseId: { in: whIds } },
          ],
        }
      } else {
        roleWhere = { id: 'none' }
      }
    }

    const baseWhere = { ...roleWhere }
    const [total, inTransit, delivered, pending, failed] = await Promise.all([
      prisma.shipment.count({ where: baseWhere }),
      prisma.shipment.count({ where: { ...baseWhere, status: 'IN_TRANSIT' } }),
      prisma.shipment.count({ where: { ...baseWhere, status: 'DELIVERED' } }),
      prisma.shipment.count({ where: { ...baseWhere, status: 'PENDING' } }),
      prisma.shipment.count({ where: { ...baseWhere, status: 'FAILED' } }),
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
