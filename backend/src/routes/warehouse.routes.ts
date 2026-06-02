import { Router } from 'express'
import { authenticate, authorize } from '../middleware/auth.middleware'
import {
  getWarehouses, getWarehouseById, createWarehouse,
  updateWarehouse, deleteWarehouse,
} from '../controllers/warehouse.controller'

const router = Router()

router.use(authenticate)

// DRIVER cannot access warehouse management at all
router.get('/', authorize('ADMIN', 'MANAGER', 'STAFF'), getWarehouses)
router.get('/:id', authorize('ADMIN', 'MANAGER', 'STAFF'), getWarehouseById)

// Only ADMIN can create/delete warehouses
router.post('/', authorize('ADMIN'), createWarehouse)
router.put('/:id', authorize('ADMIN', 'MANAGER'), updateWarehouse)
router.delete('/:id', authorize('ADMIN'), deleteWarehouse)

export default router
