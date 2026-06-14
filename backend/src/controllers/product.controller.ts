import { Request, Response } from 'express'
import { sendSuccess, sendError } from '../utils/response'
import {
  getProducts as getProductsService,
  getProductById as getProductByIdService,
  createProduct as createProductService,
  updateProduct as updateProductService,
  deleteProduct as deleteProductService,
  getProductByQR as getProductByQRService,
  getProductByBarcode as getProductByBarcodeService,
} from '../services/product.service'

// GET /api/products
export const getProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20', search, category, isActive } = req.query

    const result = await getProductsService({
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      search: search as string,
      category: category as string,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    })

    sendSuccess(res, result.products, 'Lấy danh sách sản phẩm thành công', 200, {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    })
  } catch (error) {
    sendError(res, 'Lỗi lấy danh sách sản phẩm', 500, error)
  }
}

// GET /api/products/:id
export const getProductById = async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await getProductByIdService(req.params.id)
    sendSuccess(res, product)
  } catch (error: any) {
    const status = error.statusCode || 500
    sendError(res, error.message || 'Lỗi lấy sản phẩm', status, status === 500 ? error : undefined)
  }
}

// POST /api/products
export const createProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await createProductService(req.body)
    sendSuccess(res, product, 'Tạo sản phẩm thành công', 201)
  } catch (error: any) {
    const status = error.statusCode || 500
    sendError(res, error.message || 'Lỗi tạo sản phẩm', status, status === 500 ? error : undefined)
  }
}

// PUT /api/products/:id
export const updateProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await updateProductService(req.params.id, req.body)
    sendSuccess(res, product, 'Cập nhật sản phẩm thành công')
  } catch (error: any) {
    const status = error.statusCode || 500
    sendError(res, error.message || 'Lỗi cập nhật sản phẩm', status, status === 500 ? error : undefined)
  }
}

// DELETE /api/products/:id
export const deleteProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    await deleteProductService(req.params.id)
    sendSuccess(res, null, 'Xóa sản phẩm thành công')
  } catch (error: any) {
    const status = error.statusCode || 500
    sendError(res, error.message || 'Lỗi xóa sản phẩm', status, status === 500 ? error : undefined)
  }
}

// GET /api/products/by-qr/:qrCode
export const getProductByQR = async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await getProductByQRService(req.params.qrCode)
    sendSuccess(res, product)
  } catch (error: any) {
    const status = error.statusCode || 500
    sendError(res, error.message || 'Lỗi tìm kiếm theo QR', status, status === 500 ? error : undefined)
  }
}

// GET /api/products/by-barcode/:barcode
export const getProductByBarcode = async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await getProductByBarcodeService(req.params.barcode)
    sendSuccess(res, product)
  } catch (error: any) {
    const status = error.statusCode || 500
    sendError(res, error.message || 'Lỗi tìm kiếm theo mã vạch', status, status === 500 ? error : undefined)
  }
}
