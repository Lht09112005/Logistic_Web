import { Request, Response } from 'express'
import { sendSuccess, sendError } from '../utils/response'
import { AuthRequest } from '../middleware/auth.middleware'
import {
  getUsers as getUsersService,
  getUserById as getUserByIdService,
  createUser as createUserService,
  updateUser as updateUserService,
  deleteUser as deleteUserService,
} from '../services/user.service'

// GET /api/users
export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20
    const search = req.query.search as string | undefined
    const role = req.query.role as string | undefined
    const isActive = req.query.isActive as string | undefined
    const authReq = req as AuthRequest

    const result = await getUsersService({
      page, limit, search, role,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      requesterRole: authReq.user?.role,
    })

    sendSuccess(res, result)
  } catch (error) {
    sendError(res, 'Lỗi lấy danh sách người dùng', 500, error)
  }
}

// GET /api/users/:id
export const getUserById = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getUserByIdService(req.params.id)
    sendSuccess(res, user)
  } catch (error: any) {
    const status = error.statusCode || 500
    sendError(res, error.message || 'Lỗi lấy thông tin người dùng', status, status === 500 ? error : undefined)
  }
}

// POST /api/users
export const createUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, role = 'STAFF', phone } = req.body
    const user = await createUserService({ name, email, password, role, phone })
    sendSuccess(res, user, 'Tạo người dùng thành công', 201)
  } catch (error: any) {
    const status = error.statusCode || 500
    sendError(res, error.message || 'Lỗi tạo người dùng', status, status === 500 ? error : undefined)
  }
}

// PUT /api/users/:id
export const updateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, role, phone, isActive } = req.body
    const user = await updateUserService(req.params.id, { name, email, password, role, phone, isActive })
    sendSuccess(res, user, 'Cập nhật người dùng thành công')
  } catch (error: any) {
    const status = error.statusCode || 500
    sendError(res, error.message || 'Lỗi cập nhật người dùng', status, status === 500 ? error : undefined)
  }
}

// DELETE /api/users/:id
export const deleteUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await deleteUserService(req.params.id, req.user!.userId)
    sendSuccess(res, null, 'Đã xóa người dùng thành công')
  } catch (error: any) {
    const status = error.statusCode || 500
    sendError(res, error.message || 'Lỗi xóa người dùng', status, status === 500 ? error : undefined)
  }
}
