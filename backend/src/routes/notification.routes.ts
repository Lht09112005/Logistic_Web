import { Router } from 'express'
import { getNotifications, markAsRead, markAllAsRead } from '../controllers/notification.controller'
import { authenticate } from '../middleware/auth.middleware'

const router = Router()

// All notification routes require authentication
router.use(authenticate)

router.get('/', getNotifications)
router.put('/read-all', markAllAsRead)
router.put('/:id/read', markAsRead)

export default router
