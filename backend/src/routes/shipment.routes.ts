import { Router } from 'express'
import { authenticate, authorize } from '../middleware/auth.middleware'
import {
  getShipments, getShipmentById, createShipment,
  updateShipment, getShipmentStats, receiveShipment,
  approveShipment, rejectShipment, startLoadingShipment,
} from '../controllers/shipment.controller'
import { validateCreateShipment } from '../middleware/validation.middleware'

const router = Router()

router.use(authenticate)

router.get('/stats', getShipmentStats)
// All roles can list shipments — controller filters by role
// DRIVER sees only their own; MANAGER/STAFF see only their warehouse's; ADMIN sees all
router.get('/', getShipments)
router.get('/:id', getShipmentById)

// Only ADMIN/MANAGER can create shipments
router.post('/', authorize('ADMIN', 'MANAGER'), validateCreateShipment, createShipment)

// DRIVER can update (checkpoint ticks + status on their own shipments only — enforced in controller)
router.put('/:id', authorize('ADMIN', 'MANAGER', 'STAFF', 'DRIVER'), updateShipment)

// Approve/Reject: ADMIN and MANAGER of origin warehouse only
router.put('/:id/approve', authorize('ADMIN', 'MANAGER'), approveShipment)
router.put('/:id/reject', authorize('ADMIN', 'MANAGER'), rejectShipment)

// Loading: ADMIN, MANAGER, STAFF (not DRIVER — warehouse staff handles loading)
router.put('/:id/loading', authorize('ADMIN', 'MANAGER', 'STAFF'), startLoadingShipment)

// Receive: ADMIN, MANAGER, STAFF of destination warehouse (not DRIVER)
router.post('/:id/receive', authorize('ADMIN', 'MANAGER', 'STAFF'), receiveShipment)

export default router
