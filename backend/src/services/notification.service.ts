import { prisma } from '../config/database'

interface NotificationQuery {
  userId: string
  page?: number
  limit?: number
}

export async function getNotifications(query: NotificationQuery) {
  const page = query.page || 1
  const limit = query.limit || 20

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: query.userId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.notification.count({ where: { userId: query.userId } }),
    prisma.notification.count({ where: { userId: query.userId, isRead: false } }),
  ])

  return { notifications, meta: { total, page, limit, totalPages: Math.ceil(total / limit), unreadCount } }
}

export async function markAsRead(id: string, userId: string) {
  const notification = await prisma.notification.findFirst({ where: { id, userId } })
  if (!notification) {
    throw Object.assign(new Error('Không tìm thấy thông báo'), { statusCode: 404 })
  }

  return prisma.notification.update({ where: { id }, data: { isRead: true } })
}

export async function markAllAsRead(userId: string) {
  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  })
}
