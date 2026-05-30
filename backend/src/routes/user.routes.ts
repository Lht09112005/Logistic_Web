import { Router } from 'express'
import { authenticate, authorize } from '../middleware/auth.middleware'
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
} from '../controllers/user.controller'

const router = Router()

// All user management routes require authentication + ADMIN role
router.use(authenticate)
router.use(authorize('ADMIN'))

router.get('/', getUsers)
router.get('/:id', getUserById)
router.post('/', createUser)
router.put('/:id', updateUser)
router.delete('/:id', deleteUser)

export default router
