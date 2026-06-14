import { Request, Response, NextFunction } from 'express'
import { verifyAccessToken } from '../config/jwt'
import { isBlacklisted } from '../services/token-blacklist.service'

export interface AuthRequest extends Request {
  user?: {
    userId: string
    email: string
    role: string
  }
}


export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Không có token xác thực' })
    return
  }

  const token = authHeader.substring(7)

  // Removed mock token bypass to enforce real JWT usage with valid database UUIDs.
  // Using 'mock-driver-id' as a userId causes Prisma to find 0 shipments.

  try {
    const payload = verifyAccessToken(token)

    // Check if token has been blacklisted (e.g., user logged out)
    try {
      const blacklisted = await isBlacklisted(token)
      if (blacklisted) {
        res.status(401).json({ success: false, message: 'Token đã bị thu hồi. Vui lòng đăng nhập lại.' })
        return
      }
    } catch {
      // Error checking blacklist — allow through but log warning
      console.warn('[Auth] Failed to check token blacklist, allowing request')
    }

    req.user = payload
    next()
  } catch {
    res.status(401).json({ success: false, message: 'Token không hợp lệ hoặc đã hết hạn' })
  }
}

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ success: false, message: 'Bạn không có quyền thực hiện thao tác này' })
      return
    }
    next()
  }
}
