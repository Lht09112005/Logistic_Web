import { Router } from 'express'
import { authenticate, authorize } from '../middleware/auth.middleware'
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
} from '../controllers/user.controller'
import { validateCreateUser, validateUpdateUser } from '../middleware/validation.middleware'

const router = Router()

// Require authentication for all routes
router.use(authenticate)

// GET — ADMIN & MANAGER can view users (MANAGER can only see STAFF & DRIVER)
router.get('/', authorize('ADMIN', 'MANAGER'), getUsers)
router.get('/:id', authorize('ADMIN', 'MANAGER'), getUserById)

// Mutations — ADMIN only
router.post('/', authorize('ADMIN'), validateCreateUser, createUser)
router.put('/:id', authorize('ADMIN'), validateUpdateUser, updateUser)
router.delete('/:id', authorize('ADMIN'), deleteUser)

export default router
