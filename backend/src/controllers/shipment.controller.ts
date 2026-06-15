import { Request, Response, NextFunction } from 'express'
import { sendSuccess } from '../utils/response'
import { AuthRequest } from '../middleware/auth.middleware'
import {
  getShipments as getShipmentsService,
  getShipmentById as getShipmentByIdService,
  createShipment as createShipmentService,
  updateShipment as updateShipmentService,
  receiveShipment as receiveShipmentService,
  approveShipment as approveShipmentService,
  rejectShipment as rejectShipmentService,
  startLoadingShipment as startLoadingShipmentService,
  getShipmentStats as getShipmentStatsService,
} from '../services/shipment.service'

// GET /api/shipments
export const getShipments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = '1', limit = '20', status, driverId, search } = req.query
    const authUser = (req as AuthRequest).user

    const result = await getShipmentsService({
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      status: status as string,
      driverId: driverId as string,
      search: search as string,
      role: authUser?.role,
      userId: authUser?.userId,
    })

    sendSuccess(res, result.shipments, 'Lấy danh sách vận chuyển thành công', 200, {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    })
  } catch (error) {
    next(error)
  }
}

// GET /api/shipments/:id
export const getShipmentById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authUser = (req as AuthRequest).user
    const shipment = await getShipmentByIdService(req.params.id, authUser?.role, authUser?.userId)
    sendSuccess(res, shipment)
  } catch (error) {
    next(error)
  }
}

// POST /api/shipments
export const createShipment = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      driverId, vehicleNumber, vehicleType,
      originWarehouseId, destinationWarehouseId,
      originAddress, destinationAddress,
      originLat, originLng, destinationLat, destinationLng,
      estimatedArrival, items = [], checkpoints = [], notes,
    } = req.body

    const shipment = await createShipmentService({
      driverId, vehicleNumber, vehicleType,
      originWarehouseId, destinationWarehouseId,
      originAddress, destinationAddress,
      originLat, originLng, destinationLat, destinationLng,
      estimatedArrival, items, checkpoints, notes,
      createdById: req.user!.userId,
    })

    sendSuccess(res, shipment, 'Tạo vận đơn thành công', 201)
  } catch (error) {
    next(error)
  }
}

// PUT /api/shipments/:id
export const updateShipment = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, currentLat, currentLng, vehicleNumber, estimatedArrival, notes, checkpoints } = req.body

    const shipment = await updateShipmentService(
      req.params.id,
      { status, currentLat, currentLng, vehicleNumber, estimatedArrival, notes, checkpoints },
      req.user!.userId,
      req.user!.role
    )

    sendSuccess(res, shipment, 'Cập nhật vận đơn thành công')
  } catch (error) {
    next(error)
  }
}

// POST /api/shipments/:id/receive
export const receiveShipment = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await receiveShipmentService(req.params.id)
    const message = result.inventoryItems.length === 0
      ? 'Vận đơn đã được tiếp nhận trước đó'
      : 'Tiếp nhận hàng vào kho thành công'
    sendSuccess(res, result, message)
  } catch (error) {
    next(error)
  }
}

// PUT /api/shipments/:id/approve
export const approveShipment = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const updated = await approveShipmentService(req.params.id, req.user!.userId, req.user!.role)
    sendSuccess(res, updated, 'Đã duyệt vận đơn thành công')
  } catch (error) {
    next(error)
  }
}

// PUT /api/shipments/:id/reject
export const rejectShipment = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { reason } = req.body
    const updated = await rejectShipmentService(req.params.id, reason, req.user!.userId, req.user!.role)
    sendSuccess(res, updated, 'Đã từ chối vận đơn')
  } catch (error) {
    next(error)
  }
}

// PUT /api/shipments/:id/loading
export const startLoadingShipment = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const updated = await startLoadingShipmentService(req.params.id)
    sendSuccess(res, updated, 'Đã bắt đầu xếp hàng')
  } catch (error) {
    next(error)
  }
}

// GET /api/shipments/stats
export const getShipmentStats = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const stats = await getShipmentStatsService(req.user?.role, req.user?.userId)
    sendSuccess(res, stats)
  } catch (error) {
    next(error)
  }
}

