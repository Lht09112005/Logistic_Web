import { Router } from 'express'
import { authenticate, authorize } from '../middleware/auth.middleware'
import {
  getProducts, getProductById, createProduct,
  updateProduct, deleteProduct, getProductByQR,
} from '../controllers/product.controller'
import { validateCreateProduct, validateUpdateProduct } from '../middleware/validation.middleware'

const router = Router()

router.use(authenticate)

router.get('/', getProducts)
router.get('/by-qr/:qrCode', getProductByQR)
router.get('/:id', getProductById)
router.post('/', authorize('ADMIN', 'MANAGER'), validateCreateProduct, createProduct)
router.put('/:id', authorize('ADMIN', 'MANAGER'), validateUpdateProduct, updateProduct)
router.delete('/:id', authorize('ADMIN'), deleteProduct)

export default router
