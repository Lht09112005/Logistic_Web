import { Request, Response } from 'express'
import { prisma } from '../config/database'
import { sendSuccess, sendError } from '../utils/response'
import { v4 as uuidv4 } from 'uuid'

// GET /api/products
export const getProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      page = '1', limit = '20', search, category, isActive,
    } = req.query

    const pageNum = parseInt(page as string)
    const limitNum = parseInt(limit as string)
    const skip = (pageNum - 1) * limitNum

    const where: Record<string, unknown> = {}
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { sku: { contains: search as string, mode: 'insensitive' } },
      ]
    }
    if (category) where.category = category
    if (isActive !== undefined) where.isActive = isActive === 'true'

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { inventory: true } },
        },
      }),
      prisma.product.count({ where }),
    ])

    sendSuccess(res, products, 'Lấy danh sách sản phẩm thành công', 200, {
      total, page: pageNum, limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    })
  } catch (error) {
    sendError(res, 'Lỗi lấy danh sách sản phẩm', 500, error)
  }
}

// GET /api/products/:id
export const getProductById = async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: {
        inventory: {
          include: {
            warehouse: { select: { id: true, name: true, code: true } },
            zone: true,
          },
        },
        alerts: { where: { isResolved: false }, orderBy: { createdAt: 'desc' } },
      },
    })

    if (!product) {
      sendError(res, 'Không tìm thấy sản phẩm', 404)
      return
    }

    sendSuccess(res, product)
  } catch (error) {
    sendError(res, 'Lỗi lấy sản phẩm', 500, error)
  }
}

// POST /api/products
export const createProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name, sku, barcode, category, description, unit,
      weight, length, width, height, imageUrl,
      minStockLevel, maxStockLevel, costPrice, sellPrice,
    } = req.body

    // Generate QR code data
    const qrCode = `LOGISTIQ-${uuidv4().substring(0, 8).toUpperCase()}`

    const product = await prisma.product.create({
      data: {
        name, sku, barcode, category, description, unit,
        weight, length, width, height, imageUrl, qrCode,
        minStockLevel: minStockLevel || 10,
        maxStockLevel, costPrice, sellPrice,
      },
    })

    sendSuccess(res, product, 'Tạo sản phẩm thành công', 201)
  } catch (error: unknown) {
    if ((error as { code?: string }).code === 'P2002') {
      sendError(res, 'SKU hoặc barcode đã tồn tại', 409)
      return
    }
    sendError(res, 'Lỗi tạo sản phẩm', 500, error)
  }
}

// PUT /api/products/:id
export const updateProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: req.body,
    })
    sendSuccess(res, product, 'Cập nhật sản phẩm thành công')
  } catch (error: unknown) {
    if ((error as { code?: string }).code === 'P2025') {
      sendError(res, 'Không tìm thấy sản phẩm', 404)
      return
    }
    sendError(res, 'Lỗi cập nhật sản phẩm', 500, error)
  }
}

// DELETE /api/products/:id
export const deleteProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    await prisma.product.update({
      where: { id: req.params.id },
      data: { isActive: false },
    })
    sendSuccess(res, null, 'Xóa sản phẩm thành công')
  } catch (error: unknown) {
    if ((error as { code?: string }).code === 'P2025') {
      sendError(res, 'Không tìm thấy sản phẩm', 404)
      return
    }
    sendError(res, 'Lỗi xóa sản phẩm', 500, error)
  }
}

// GET /api/products/by-qr/:qrCode
export const getProductByQR = async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await prisma.product.findFirst({
      where: { qrCode: req.params.qrCode },
      include: {
        inventory: {
          include: { warehouse: { select: { id: true, name: true, code: true } } },
        },
      },
    })

    if (!product) {
      sendError(res, 'Không tìm thấy sản phẩm với QR này', 404)
      return
    }

    sendSuccess(res, product)
  } catch (error) {
    sendError(res, 'Lỗi tìm kiếm theo QR', 500, error)
  }
}
