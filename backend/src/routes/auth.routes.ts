import { Router } from 'express'
import { authenticate } from '../middleware/auth.middleware'
import { register, login, refreshToken, logout, getMe } from '../controllers/auth.controller'

const router = Router()

router.post('/register', register)
router.post('/login', login)
router.post('/refresh', refreshToken)
router.post('/logout', authenticate, logout)
router.get('/me', authenticate, getMe)

export default router
