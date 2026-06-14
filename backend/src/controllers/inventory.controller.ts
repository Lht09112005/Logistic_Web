import { Request, Response } from 'express'
import { sendSuccess, sendError } from '../utils/response'
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
export const getInventory = async (req: Request, res: Response): Promise<void> => {
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
    sendError(res, 'Lỗi lấy tồn kho', 500, error)
  }
}

// GET /api/inventory/alerts
export const getAlerts = async (req: Request, res: Response): Promise<void> => {
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
    sendError(res, 'Lỗi lấy cảnh báo', 500, error)
  }
}

// PUT /api/inventory/:id
export const updateInventory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { quantity, rack, shelf, zoneId, notes } = req.body

    const updated = await updateInventoryService(
      req.params.id,
      { quantity, rack, shelf, zoneId, notes, auditedById: req.user?.userId },
      req.user?.role,
      req.user?.userId
    )

    sendSuccess(res, updated, 'Cập nhật tồn kho thành công')
  } catch (error: any) {
    const status = error.statusCode || 500
    sendError(res, error.message || 'Lỗi cập nhật tồn kho', status, status === 500 ? error : undefined)
  }
}

// POST /api/inventory
export const createInventory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { productId, warehouseId, zoneId, rack, shelf, quantity, notes } = req.body

    const item = await createInventoryService(
      { productId, warehouseId, zoneId, rack, shelf, quantity, notes, auditedById: req.user?.userId },
      req.user?.role,
      req.user?.userId
    )

    sendSuccess(res, item, 'Thêm vào tồn kho thành công', 201)
  } catch (error: any) {
    const status = error.statusCode || 500
    sendError(res, error.message || 'Lỗi thêm tồn kho', status, status === 500 ? error : undefined)
  }
}

// PUT /api/inventory/alerts/:id/resolve
export const resolveAlert = async (req: Request, res: Response): Promise<void> => {
  try {
    const alert = await resolveAlertService(req.params.id)
    sendSuccess(res, alert, 'Đã xử lý cảnh báo')
  } catch (error: any) {
    const status = error.statusCode || 500
    sendError(res, error.message || 'Không tìm thấy cảnh báo', status, status === 500 ? error : undefined)
  }
}

// GET /api/inventory/:id
export const getInventoryById = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = (req as AuthRequest).user
    const item = await getInventoryByIdService(req.params.id, authUser?.role, authUser?.userId)
    sendSuccess(res, item, 'Lấy chi tiết tồn kho thành công')
  } catch (error: any) {
    const status = error.statusCode || 500
    sendError(res, error.message || 'Lỗi lấy chi tiết tồn kho', status, status === 500 ? error : undefined)
  }
}
