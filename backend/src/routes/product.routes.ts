import { Router } from 'express'
import { authenticate, authorize } from '../middleware/auth.middleware'
import {
  getProducts, getProductById, createProduct,
  updateProduct, deleteProduct, getProductByQR, getProductByBarcode,
} from '../controllers/product.controller'
import { validateCreateProduct, validateUpdateProduct } from '../middleware/validation.middleware'

const router = Router()

router.use(authenticate)

router.get('/', getProducts)
router.get('/by-qr/:qrCode', getProductByQR)
router.get('/by-barcode/:barcode', getProductByBarcode)
router.get('/:id', getProductById)
// Cho phép STAFF tạo sản phẩm mới khi quét mã vạch/QR từ form kiểm kho
router.post('/', authorize('ADMIN', 'MANAGER', 'STAFF'), validateCreateProduct, createProduct)
router.put('/:id', authorize('ADMIN', 'MANAGER'), validateUpdateProduct, updateProduct)
router.delete('/:id', authorize('ADMIN'), deleteProduct)

export default router
