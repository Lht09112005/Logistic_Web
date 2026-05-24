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
router.post('/', authorize('ADMIN'), createWarehouse)
router.put('/:id', authorize('ADMIN'), updateWarehouse)
router.delete('/:id', authorize('ADMIN'), deleteWarehouse)

export default router
