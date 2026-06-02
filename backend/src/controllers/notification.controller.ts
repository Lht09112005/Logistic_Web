import { Request, Response } from 'express'
import { prisma } from '../config/database'
import { sendSuccess, sendError } from '../utils/response'
import { AuthRequest } from '../middleware/auth.middleware'

// GET /api/notifications
export const getNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId
    const { limit = '20', page = '1' } = req.query

    const pageNum = parseInt(page as string)
    const limitNum = parseInt(limit as string)

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      prisma.notification.count({ where: { userId } }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ])

    sendSuccess(res, notifications, 'Lấy danh sách thông báo thành công', 200, {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      unreadCount
    })
  } catch (error) {
    sendError(res, 'Lỗi lấy danh sách thông báo', 500, error)
  }
}

// PUT /api/notifications/:id/read
export const markAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const userId = req.user!.userId

    const notification = await prisma.notification.findFirst({
      where: { id, userId }
    })

    if (!notification) {
      sendError(res, 'Không tìm thấy thông báo', 404)
      return
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true }
    })

    sendSuccess(res, updated, 'Đã đánh dấu đọc thông báo')
  } catch (error) {
    sendError(res, 'Lỗi đánh dấu đọc thông báo', 500, error)
  }
}

// PUT /api/notifications/read-all
export const markAllAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId

    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true }
    })

    sendSuccess(res, null, 'Đã đánh dấu đọc tất cả thông báo')
  } catch (error) {
    sendError(res, 'Lỗi đánh dấu đọc thông báo', 500, error)
  }
}
