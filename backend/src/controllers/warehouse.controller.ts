import { Request, Response, NextFunction } from 'express'
import { sendSuccess } from '../utils/response'
import { AuthRequest } from '../middleware/auth.middleware'
import {
  getWarehouses as getWarehousesService,
  getWarehouseById as getWarehouseByIdService,
  createWarehouse as createWarehouseService,
  updateWarehouse as updateWarehouseService,
  deleteWarehouse as deleteWarehouseService,
} from '../services/warehouse.service'

// GET /api/warehouses
export const getWarehouses = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
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
    next(error)
  }
}

// GET /api/warehouses/:id
export const getWarehouseById = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const warehouse = await getWarehouseByIdService(req.params.id, req.user?.role, req.user?.userId)
    sendSuccess(res, warehouse)
  } catch (error) {
    next(error)
  }
}

// POST /api/warehouses
export const createWarehouse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const warehouse = await createWarehouseService(req.body)
    sendSuccess(res, warehouse, 'Tạo kho thành công', 201)
  } catch (error: any) {
    if (error.code === 'P2002') {
      next(Object.assign(error, { statusCode: 409, message: 'Mã kho đã tồn tại' }))
    } else {
      next(error)
    }
  }
}

// PUT /api/warehouses/:id
export const updateWarehouse = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const updated = await updateWarehouseService(req.params.id, req.body, req.user?.role, req.user?.userId)
    sendSuccess(res, updated, 'Cập nhật kho thành công')
  } catch (error) {
    next(error)
  }
}

// DELETE /api/warehouses/:id
export const deleteWarehouse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await deleteWarehouseService(req.params.id)
    sendSuccess(res, null, 'Đã vô hiệu hóa kho')
  } catch (error: any) {
    if (error.code === 'P2025') {
      next(Object.assign(error, { statusCode: 404, message: 'Không tìm thấy kho' }))
    } else {
      next(error)
    }
  }
}

