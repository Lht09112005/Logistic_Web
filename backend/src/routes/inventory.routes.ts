import { Router } from 'express'
import { authenticate, authorize } from '../middleware/auth.middleware'
import {
  getInventory, updateInventory, createInventory,
  getAlerts, resolveAlert,
} from '../controllers/inventory.controller'

const router = Router()

router.use(authenticate)

router.get('/', getInventory)
router.get('/alerts', getAlerts)
router.post('/', authorize('ADMIN', 'STAFF'), createInventory)
router.put('/alerts/:id/resolve', authorize('ADMIN', 'STAFF'), resolveAlert)
router.put('/:id', authorize('ADMIN', 'STAFF'), updateInventory)

export default router
