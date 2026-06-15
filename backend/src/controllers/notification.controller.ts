import { Request, Response, NextFunction } from 'express'
import { sendSuccess } from '../utils/response'
import { AuthRequest } from '../middleware/auth.middleware'
import {
  getNotifications as getNotificationsService,
  markAsRead as markAsReadService,
  markAllAsRead as markAllAsReadService,
} from '../services/notification.service'

// GET /api/notifications
export const getNotifications = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { limit = '20', page = '1' } = req.query

    const result = await getNotificationsService({
      userId: req.user!.userId,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    })

    sendSuccess(res, result.notifications, 'Lấy danh sách thông báo thành công', 200, result.meta)
  } catch (error) {
    next(error)
  }
}

// PUT /api/notifications/:id/read
export const markAsRead = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const updated = await markAsReadService(req.params.id, req.user!.userId)
    sendSuccess(res, updated, 'Đã đánh dấu đọc thông báo')
  } catch (error) {
    next(error)
  }
}

// PUT /api/notifications/read-all
export const markAllAsRead = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    await markAllAsReadService(req.user!.userId)
    sendSuccess(res, null, 'Đã đánh dấu đọc tất cả thông báo')
  } catch (error) {
    next(error)
  }
}

