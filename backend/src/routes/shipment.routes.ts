import { Router } from 'express'
import { authenticate, authorize } from '../middleware/auth.middleware'
import {
  getShipments, getShipmentById, createShipment,
  updateShipment, getShipmentStats, receiveShipment,
} from '../controllers/shipment.controller'

const router = Router()

router.use(authenticate)

router.get('/stats', getShipmentStats)
router.get('/', getShipments)
router.get('/:id', getShipmentById)
router.post('/', authorize('ADMIN', 'MANAGER'), createShipment)
router.put('/:id', authorize('ADMIN', 'MANAGER', 'STAFF', 'DRIVER'), updateShipment)
router.post('/:id/receive', authorize('ADMIN', 'MANAGER', 'STAFF'), receiveShipment)

export default router
