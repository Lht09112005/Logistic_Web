import { Router } from 'express'
import { authenticate, authorize } from '../middleware/auth.middleware'
import {
  getInventory, updateInventory, createInventory,
  getAlerts, resolveAlert, getInventoryById,
} from '../controllers/inventory.controller'
import { validateCreateInventory, validateUpdateInventory } from '../middleware/validation.middleware'

const router = Router()

router.use(authenticate)

// DRIVER cannot access inventory at all
router.get('/', authorize('ADMIN', 'MANAGER', 'STAFF'), getInventory)
router.get('/alerts', authorize('ADMIN', 'MANAGER', 'STAFF'), getAlerts)
router.get('/:id', authorize('ADMIN', 'MANAGER', 'STAFF'), getInventoryById)
// STAFF được phép tạo và cập nhật tồn kho (service layer đã kiểm tra quyền theo warehouse)
router.post('/', authorize('ADMIN', 'MANAGER', 'STAFF'), validateCreateInventory, createInventory)
router.put('/alerts/:id/resolve', authorize('ADMIN', 'MANAGER'), resolveAlert)
router.put('/:id', authorize('ADMIN', 'MANAGER', 'STAFF'), validateUpdateInventory, updateInventory)

export default router
