import { Request, Response } from 'express'
import { sendSuccess, sendError } from '../utils/response'
import { AuthRequest } from '../middleware/auth.middleware'
import {
  getWarehouses as getWarehousesService,
  getWarehouseById as getWarehouseByIdService,
  createWarehouse as createWarehouseService,
  updateWarehouse as updateWarehouseService,
  deleteWarehouse as deleteWarehouseService,
} from '../services/warehouse.service'

// GET /api/warehouses
export const getWarehouses = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, search, all } = req.query

    const warehouses = await getWarehousesService({
      status: status as string,
      search: search as string,
      all: all === 'true',
      role: req.user?.role,
      userId: req.user?.userId,
    })

    sendSuccess(res, warehouses, 'Lấy danh sách kho thành công')
  } catch (error) {
    sendError(res, 'Lỗi lấy danh sách kho', 500, error)
  }
}

// GET /api/warehouses/:id
export const getWarehouseById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const warehouse = await getWarehouseByIdService(req.params.id, req.user?.role, req.user?.userId)
    sendSuccess(res, warehouse)
  } catch (error: any) {
    const status = error.statusCode || 500
    sendError(res, error.message || 'Lỗi lấy thông tin kho', status, status === 500 ? error : undefined)
  }
}

// POST /api/warehouses
export const createWarehouse = async (req: Request, res: Response): Promise<void> => {
  try {
    const warehouse = await createWarehouseService(req.body)
    sendSuccess(res, warehouse, 'Tạo kho thành công', 201)
  } catch (error: any) {
    if (error.code === 'P2002') {
      sendError(res, 'Mã kho đã tồn tại', 409)
      return
    }
    sendError(res, 'Lỗi tạo kho', 500, error)
  }
}

// PUT /api/warehouses/:id
export const updateWarehouse = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const updated = await updateWarehouseService(req.params.id, req.body, req.user?.role, req.user?.userId)
    sendSuccess(res, updated, 'Cập nhật kho thành công')
  } catch (error: any) {
    const status = error.statusCode || 500
    sendError(res, error.message || 'Lỗi cập nhật kho', status, status === 500 ? error : undefined)
  }
}

// DELETE /api/warehouses/:id
export const deleteWarehouse = async (req: Request, res: Response): Promise<void> => {
  try {
    await deleteWarehouseService(req.params.id)
    sendSuccess(res, null, 'Đã vô hiệu hóa kho')
  } catch (error: any) {
    if (error.code === 'P2025') {
      sendError(res, 'Không tìm thấy kho', 404)
      return
    }
    sendError(res, 'Lỗi xóa kho', 500, error)
  }
}
