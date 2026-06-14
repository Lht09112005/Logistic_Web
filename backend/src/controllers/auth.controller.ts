import { Request, Response } from 'express'
import { sendSuccess, sendError } from '../utils/response'
import { AuthRequest } from '../middleware/auth.middleware'
import {
  registerUser,
  loginUser,
  refreshUserToken,
  logoutUser,
  getMe as getMeService,
  updateMe as updateMeService,
  forgotPassword as forgotPasswordService,
  resetPassword as resetPasswordService,
  getDrivers as getDriversService,
} from '../services/auth.service'

// POST /api/auth/register
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, role = 'STAFF', phone } = req.body
    const result = await registerUser(name, email, password, role, phone)
    sendSuccess(res, result, 'Đăng ký thành công', 201)
  } catch (error: any) {
    const status = error.statusCode || 500
    sendError(res, error.message || 'Lỗi đăng ký', status, status === 500 ? error : undefined)
  }
}

// POST /api/auth/login
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body
    const result = await loginUser(email, password)
    sendSuccess(res, result, 'Đăng nhập thành công')
  } catch (error: any) {
    const status = error.statusCode || 500
    sendError(res, error.message || 'Lỗi đăng nhập', status, status === 500 ? error : undefined)
  }
}

// POST /api/auth/refresh
export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken: token } = req.body
    const tokens = await refreshUserToken(token)
    sendSuccess(res, tokens, 'Làm mới token thành công')
  } catch {
    sendError(res, 'Refresh token không hợp lệ hoặc hết hạn', 401)
  }
}

// POST /api/auth/logout
export const logout = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined

    if (req.user) {
      await logoutUser(req.user.userId, bearerToken)
    }
    sendSuccess(res, null, 'Đăng xuất thành công')
  } catch (error) {
    sendError(res, 'Lỗi đăng xuất', 500, error)
  }
}

// GET /api/auth/me
export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await getMeService(req.user!.userId)
    sendSuccess(res, user)
  } catch (error: any) {
    const status = error.statusCode || 500
    sendError(res, error.message || 'Lỗi lấy thông tin', status, status === 500 ? error : undefined)
  }
}

// PUT /api/auth/me
export const updateMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, email, phone, password } = req.body
    const updated = await updateMeService(req.user!.userId, { name, email, phone, password })
    sendSuccess(res, updated, 'Cập nhật thông tin thành công')
  } catch (error: any) {
    const status = error.statusCode || 500
    sendError(res, error.message || 'Lỗi cập nhật thông tin', status, status === 500 ? error : undefined)
  }
}

// POST /api/auth/forgot-password
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body
    await forgotPasswordService(email)
    sendSuccess(res, null, 'Nếu email tồn tại, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu')
  } catch (error: any) {
    const status = error.statusCode || 500
    sendError(res, error.message || 'Có lỗi xảy ra. Vui lòng thử lại sau.', status, status === 500 ? error : undefined)
  }
}

// POST /api/auth/reset-password
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, password } = req.body
    await resetPasswordService(token, password)
    sendSuccess(res, null, 'Mật khẩu đã được đặt lại thành công. Vui lòng đăng nhập lại.')
  } catch (error: any) {
    const status = error.statusCode || 500
    sendError(res, error.message || 'Có lỗi xảy ra. Vui lòng thử lại sau.', status, status === 500 ? error : undefined)
  }
}

// GET /api/auth/drivers
export const getDrivers = async (req: Request, res: Response): Promise<void> => {
  try {
    const drivers = await getDriversService()
    sendSuccess(res, drivers, 'Lấy danh sách tài xế thành công')
  } catch (error) {
    sendError(res, 'Lỗi lấy danh sách tài xế', 500, error)
  }
}
