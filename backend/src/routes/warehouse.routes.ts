import { Router } from 'express'
import { authenticate, authorize } from '../middleware/auth.middleware'
import {
  getWarehouses, getWarehouseById, createWarehouse,
  updateWarehouse, deleteWarehouse,
} from '../controllers/warehouse.controller'

const router = Router()

router.use(authenticate)

router.get('/', getWarehouses)
router.get('/:id', getWarehouseById)
router.post('/', authorize('ADMIN', 'MANAGER'), createWarehouse)
router.put('/:id', authorize('ADMIN', 'MANAGER'), updateWarehouse)
router.delete('/:id', authorize('ADMIN', 'MANAGER'), deleteWarehouse)

export default router
