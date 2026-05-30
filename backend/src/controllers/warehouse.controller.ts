import { Request, Response } from 'express'
import { prisma } from '../config/database'
import { sendSuccess, sendError } from '../utils/response'
import { AuthRequest } from '../middleware/auth.middleware'

// GET /api/warehouses
export const getWarehouses = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, search } = req.query

    const where: Record<string, unknown> = {}

    // MANAGER only sees warehouses they are assigned to manage
    if (req.user?.role === 'MANAGER') {
      where.managerId = req.user.userId
    }

    if (status) where.status = status
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
      ]
    }

    const warehouses = await prisma.warehouse.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        manager: { select: { id: true, name: true, email: true } },
        _count: { select: { inventory: true, zones: true } },
      },
    })

    sendSuccess(res, warehouses, 'Lấy danh sách kho thành công')
  } catch (error) {
    sendError(res, 'Lỗi lấy danh sách kho', 500, error)
  }
}

// GET /api/warehouses/:id
export const getWarehouseById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const warehouse = await prisma.warehouse.findUnique({
      where: { id: req.params.id },
      include: {
        manager: { select: { id: true, name: true, email: true, phone: true } },
        zones: true,
        inventory: {
          take: 20,
          include: {
            product: { select: { id: true, name: true, sku: true, category: true, unit: true, minStockLevel: true } },
          },
        },
        _count: { select: { inventory: true } },
      },
    })

    if (!warehouse) {
      sendError(res, 'Không tìm thấy kho', 404)
      return
    }

    // MANAGER can only view detail of their own warehouse
    if (req.user?.role === 'MANAGER' && warehouse.managerId !== req.user.userId) {
      sendError(res, 'Bạn không có quyền xem kho này', 403)
      return
    }

    sendSuccess(res, warehouse)
  } catch (error) {
    sendError(res, 'Lỗi lấy thông tin kho', 500, error)
  }
}

// POST /api/warehouses
export const createWarehouse = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name, code, address, city, province, country,
      latitude, longitude, totalArea, capacity, managerId,
      description, zones = [],
    } = req.body

    const warehouse = await prisma.warehouse.create({
      data: {
        name, code, address, city,
        province: province || '',
        country: country || 'Vietnam',
        latitude, longitude, totalArea, capacity,
        managerId, description,
        zones: {
          create: zones.map((z: { name: string; description?: string; capacity: number }) => ({
            name: z.name,
            description: z.description,
            capacity: z.capacity,
          })),
        },
      },
      include: {
        manager: { select: { id: true, name: true } },
        zones: true,
      },
    })

    sendSuccess(res, warehouse, 'Tạo kho thành công', 201)
  } catch (error: unknown) {
    if ((error as { code?: string }).code === 'P2002') {
      sendError(res, 'Mã kho đã tồn tại', 409)
      return
    }
    sendError(res, 'Lỗi tạo kho', 500, error)
  }
}

// PUT /api/warehouses/:id
export const updateWarehouse = async (req: Request, res: Response): Promise<void> => {
  try {
    const warehouse = await prisma.warehouse.update({
      where: { id: req.params.id },
      data: req.body,
      include: { manager: { select: { id: true, name: true } } },
    })
    sendSuccess(res, warehouse, 'Cập nhật kho thành công')
  } catch (error: unknown) {
    if ((error as { code?: string }).code === 'P2025') {
      sendError(res, 'Không tìm thấy kho', 404)
      return
    }
    sendError(res, 'Lỗi cập nhật kho', 500, error)
  }
}

// DELETE /api/warehouses/:id
export const deleteWarehouse = async (req: Request, res: Response): Promise<void> => {
  try {
    await prisma.warehouse.update({
      where: { id: req.params.id },
      data: { status: 'INACTIVE' },
    })
    sendSuccess(res, null, 'Đã vô hiệu hóa kho')
  } catch (error: unknown) {
    if ((error as { code?: string }).code === 'P2025') {
      sendError(res, 'Không tìm thấy kho', 404)
      return
    }
    sendError(res, 'Lỗi xóa kho', 500, error)
  }
}
