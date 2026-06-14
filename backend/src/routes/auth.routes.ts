import { Router } from 'express'
import { authenticate } from '../middleware/auth.middleware'
import { register, login, refreshToken, logout, getMe, updateMe, forgotPassword, resetPassword, getDrivers } from '../controllers/auth.controller'
import { validateRegister, validateLogin, validateForgotPassword, validateResetPassword, validateUpdateMe } from '../middleware/validation.middleware'
import { authLimiter, strictLimiter } from '../middleware/rate-limiter.middleware'

const router = Router()

// Apply strict rate limiters to sensitive auth endpoints
router.post('/register', authLimiter, validateRegister, register)
router.post('/login', authLimiter, validateLogin, login)
router.post('/refresh', strictLimiter, refreshToken)
router.post('/logout', authenticate, logout)
router.get('/me', authenticate, getMe)
router.put('/me', authenticate, validateUpdateMe, updateMe)
router.get('/drivers', authenticate, getDrivers)

// Forgot / Reset password (no auth required, strict rate limiting)
router.post('/forgot-password', strictLimiter, validateForgotPassword, forgotPassword)
router.post('/reset-password', strictLimiter, validateResetPassword, resetPassword)

export default router
