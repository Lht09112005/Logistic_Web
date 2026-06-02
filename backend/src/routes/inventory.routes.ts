import { Router } from 'express'
import { authenticate, authorize } from '../middleware/auth.middleware'
import {
  getInventory, updateInventory, createInventory,
  getAlerts, resolveAlert, getInventoryById,
} from '../controllers/inventory.controller'

const router = Router()

router.use(authenticate)

// DRIVER cannot access inventory at all
router.get('/', authorize('ADMIN', 'MANAGER', 'STAFF'), getInventory)
router.get('/alerts', authorize('ADMIN', 'MANAGER', 'STAFF'), getAlerts)
router.get('/:id', authorize('ADMIN', 'MANAGER', 'STAFF'), getInventoryById)
router.post('/', authorize('ADMIN', 'MANAGER', 'STAFF'), createInventory)
router.put('/alerts/:id/resolve', authorize('ADMIN', 'MANAGER', 'STAFF'), resolveAlert)
router.put('/:id', authorize('ADMIN', 'MANAGER', 'STAFF'), updateInventory)

export default router
