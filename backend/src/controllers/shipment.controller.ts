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
    if (status) where.status = status
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
    const { status, currentLat, currentLng, vehicleNumber, estimatedArrival, notes } = req.body

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

// GET /api/shipments/stats
export const getShipmentStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [total, inTransit, delivered, pending, failed] = await Promise.all([
      prisma.shipment.count(),
      prisma.shipment.count({ where: { status: 'IN_TRANSIT' } }),
      prisma.shipment.count({ where: { status: 'DELIVERED' } }),
      prisma.shipment.count({ where: { status: 'PENDING' } }),
      prisma.shipment.count({ where: { status: 'FAILED' } }),
    ])

    sendSuccess(res, { total, inTransit, delivered, pending, failed })
  } catch (error) {
    sendError(res, 'Lỗi lấy thống kê', 500, error)
  }
}
