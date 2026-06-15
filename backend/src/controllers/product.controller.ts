import { Request, Response, NextFunction } from 'express'
import { sendSuccess } from '../utils/response'
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
export const getProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
    next(error)
  }
}

// GET /api/products/:id
export const getProductById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const product = await getProductByIdService(req.params.id)
    sendSuccess(res, product)
  } catch (error) {
    next(error)
  }
}

// POST /api/products
export const createProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const product = await createProductService(req.body)
    sendSuccess(res, product, 'Tạo sản phẩm thành công', 201)
  } catch (error) {
    next(error)
  }
}

// PUT /api/products/:id
export const updateProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const product = await updateProductService(req.params.id, req.body)
    sendSuccess(res, product, 'Cập nhật sản phẩm thành công')
  } catch (error) {
    next(error)
  }
}

// DELETE /api/products/:id
export const deleteProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await deleteProductService(req.params.id)
    sendSuccess(res, null, 'Xóa sản phẩm thành công')
  } catch (error) {
    next(error)
  }
}

// GET /api/products/by-qr/:qrCode
export const getProductByQR = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const product = await getProductByQRService(req.params.qrCode)
    sendSuccess(res, product)
  } catch (error) {
    next(error)
  }
}

// GET /api/products/by-barcode/:barcode
export const getProductByBarcode = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const product = await getProductByBarcodeService(req.params.barcode)
    sendSuccess(res, product)
  } catch (error) {
    next(error)
  }
}

