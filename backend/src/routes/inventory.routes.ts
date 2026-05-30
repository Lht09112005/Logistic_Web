import { Router } from 'express'
import { authenticate, authorize } from '../middleware/auth.middleware'
import {
  getInventory, updateInventory, createInventory,
  getAlerts, resolveAlert, getInventoryById,
} from '../controllers/inventory.controller'

const router = Router()

router.use(authenticate)

router.get('/', getInventory)
router.get('/alerts', getAlerts)
router.get('/:id', getInventoryById)
router.post('/', authorize('ADMIN', 'MANAGER', 'STAFF'), createInventory)
router.put('/alerts/:id/resolve', authorize('ADMIN', 'MANAGER', 'STAFF'), resolveAlert)
router.put('/:id', authorize('ADMIN', 'MANAGER', 'STAFF'), updateInventory)

export default router
