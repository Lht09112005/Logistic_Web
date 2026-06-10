import { Router } from 'express'
import { authenticate } from '../middleware/auth.middleware'
import { register, login, refreshToken, logout, getMe, updateMe, forgotPassword, resetPassword, getDrivers } from '../controllers/auth.controller'

const router = Router()

router.post('/register', register)
router.post('/login', login)
router.post('/refresh', refreshToken)
router.post('/logout', authenticate, logout)
router.get('/me', authenticate, getMe)
router.put('/me', authenticate, updateMe)
router.get('/drivers', authenticate, getDrivers)

// Forgot / Reset password (no auth required)
router.post('/forgot-password', forgotPassword)
router.post('/reset-password', resetPassword)

export default router
