import { Router } from 'express'
import { authenticate, authorize } from '../middleware/auth.middleware'
import {
  getShipments, getShipmentById, createShipment,
  updateShipment, getShipmentStats, receiveShipment,
  approveShipment, rejectShipment, startLoadingShipment,
} from '../controllers/shipment.controller'

const router = Router()

router.use(authenticate)

router.get('/stats', getShipmentStats)
router.get('/', getShipments)
router.get('/:id', getShipmentById)
router.post('/', authorize('ADMIN', 'MANAGER'), createShipment)
router.put('/:id', authorize('ADMIN', 'MANAGER', 'STAFF', 'DRIVER'), updateShipment)
router.put('/:id/approve', authorize('ADMIN', 'MANAGER'), approveShipment)
router.put('/:id/reject', authorize('ADMIN', 'MANAGER'), rejectShipment)
router.put('/:id/loading', authorize('ADMIN', 'MANAGER', 'STAFF'), startLoadingShipment)
router.post('/:id/receive', authorize('ADMIN', 'MANAGER', 'STAFF'), receiveShipment)

export default router
