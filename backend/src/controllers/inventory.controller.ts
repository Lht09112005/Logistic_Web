import { Request, Response, NextFunction } from 'express'
import { sendSuccess } from '../utils/response'
import { AuthRequest } from '../middleware/auth.middleware'
import {
  getInventory as getInventoryService,
  getInventoryById as getInventoryByIdService,
  createInventory as createInventoryService,
  updateInventory as updateInventoryService,
  getAlerts as getAlertsService,
  resolveAlert as resolveAlertService,
} from '../services/inventory.service'

// GET /api/inventory
export const getInventory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = '1', limit = '20', warehouseId, lowStock, search, productId } = req.query
    const authUser = (req as AuthRequest).user

    const result = await getInventoryService({
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      warehouseId: warehouseId as string,
      productId: productId as string,
      lowStock: lowStock === 'true',
      search: search as string,
      role: authUser?.role,
      userId: authUser?.userId,
    })

    sendSuccess(res, result.items, 'Lấy tồn kho thành công', 200, {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    })
  } catch (error) {
    next(error)
  }
}

// GET /api/inventory/alerts
export const getAlerts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { isResolved = 'false', severity } = req.query
    const authUser = (req as AuthRequest).user

    const alerts = await getAlertsService(
      isResolved === 'true',
      severity as string,
      authUser?.role,
      authUser?.userId
    )

    sendSuccess(res, alerts, 'Lấy cảnh báo thành công')
  } catch (error) {
    next(error)
  }
}

// PUT /api/inventory/:id
export const updateInventory = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { quantity, rack, shelf, zoneId, notes } = req.body

    const updated = await updateInventoryService(
      req.params.id,
      { quantity, rack, shelf, zoneId, notes, auditedById: req.user?.userId },
      req.user?.role,
      req.user?.userId
    )

    sendSuccess(res, updated, 'Cập nhật tồn kho thành công')
  } catch (error) {
    next(error)
  }
}

// POST /api/inventory
export const createInventory = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { productId, warehouseId, zoneId, rack, shelf, quantity, notes } = req.body

    const item = await createInventoryService(
      { productId, warehouseId, zoneId, rack, shelf, quantity, notes, auditedById: req.user?.userId },
      req.user?.role,
      req.user?.userId
    )

    sendSuccess(res, item, 'Thêm vào tồn kho thành công', 201)
  } catch (error) {
    next(error)
  }
}

// PUT /api/inventory/alerts/:id/resolve
export const resolveAlert = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const alert = await resolveAlertService(req.params.id)
    sendSuccess(res, alert, 'Đã xử lý cảnh báo')
  } catch (error) {
    next(error)
  }
}

// GET /api/inventory/:id
export const getInventoryById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authUser = (req as AuthRequest).user
    const item = await getInventoryByIdService(req.params.id, authUser?.role, authUser?.userId)
    sendSuccess(res, item, 'Lấy chi tiết tồn kho thành công')
  } catch (error) {
    next(error)
  }
}

