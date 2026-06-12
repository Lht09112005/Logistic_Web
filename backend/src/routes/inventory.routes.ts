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
router.post('/', authorize('ADMIN', 'MANAGER'), validateCreateInventory, createInventory)
router.put('/alerts/:id/resolve', authorize('ADMIN', 'MANAGER'), resolveAlert)
router.put('/:id', authorize('ADMIN', 'MANAGER'), validateUpdateInventory, updateInventory)

export default router
