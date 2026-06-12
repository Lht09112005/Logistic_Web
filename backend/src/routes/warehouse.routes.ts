import { Router } from 'express'
import { authenticate, authorize } from '../middleware/auth.middleware'
import {
  getWarehouses, getWarehouseById, createWarehouse,
  updateWarehouse, deleteWarehouse,
} from '../controllers/warehouse.controller'
import { validateCreateWarehouse, validateUpdateWarehouse } from '../middleware/validation.middleware'

const router = Router()

router.use(authenticate)

// DRIVER cannot access warehouse management at all
router.get('/', authorize('ADMIN', 'MANAGER', 'STAFF'), getWarehouses)
router.get('/:id', authorize('ADMIN', 'MANAGER', 'STAFF'), getWarehouseById)

// Only ADMIN can create/delete warehouses
router.post('/', authorize('ADMIN'), validateCreateWarehouse, createWarehouse)
router.put('/:id', authorize('ADMIN', 'MANAGER'), validateUpdateWarehouse, updateWarehouse)
router.delete('/:id', authorize('ADMIN'), deleteWarehouse)

export default router
