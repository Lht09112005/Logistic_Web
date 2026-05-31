import { Request, Response, NextFunction } from 'express'
import { verifyAccessToken } from '../config/jwt'

export interface AuthRequest extends Request {
  user?: {
    userId: string
    email: string
    role: string
  }
}

export const authenticate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Không có token xác thực' })
    return
  }

  const token = authHeader.substring(7)
  try {
    const payload = verifyAccessToken(token)
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
