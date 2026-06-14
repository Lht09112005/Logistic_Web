import { Request, Response } from 'express'
import { sendSuccess, sendError } from '../utils/response'
import { AuthRequest } from '../middleware/auth.middleware'
import {
  getNotifications as getNotificationsService,
  markAsRead as markAsReadService,
  markAllAsRead as markAllAsReadService,
} from '../services/notification.service'

// GET /api/notifications
export const getNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { limit = '20', page = '1' } = req.query

    const result = await getNotificationsService({
      userId: req.user!.userId,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    })

    sendSuccess(res, result.notifications, 'Lấy danh sách thông báo thành công', 200, result.meta)
  } catch (error) {
    sendError(res, 'Lỗi lấy danh sách thông báo', 500, error)
  }
}

// PUT /api/notifications/:id/read
export const markAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const updated = await markAsReadService(req.params.id, req.user!.userId)
    sendSuccess(res, updated, 'Đã đánh dấu đọc thông báo')
  } catch (error: any) {
    const status = error.statusCode || 500
    sendError(res, error.message || 'Lỗi đánh dấu đọc thông báo', status, status === 500 ? error : undefined)
  }
}

// PUT /api/notifications/read-all
export const markAllAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await markAllAsReadService(req.user!.userId)
    sendSuccess(res, null, 'Đã đánh dấu đọc tất cả thông báo')
  } catch (error) {
    sendError(res, 'Lỗi đánh dấu đọc thông báo', 500, error)
  }
}
