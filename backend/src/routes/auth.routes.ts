import { Router } from 'express'
import { authenticate } from '../middleware/auth.middleware'
import { register, login, refreshToken, logout, getMe, updateMe, forgotPassword, resetPassword, getDrivers } from '../controllers/auth.controller'
import { validateRegister, validateLogin, validateForgotPassword, validateResetPassword, validateUpdateMe } from '../middleware/validation.middleware'

const router = Router()

router.post('/register', validateRegister, register)
router.post('/login', validateLogin, login)
router.post('/refresh', refreshToken)
router.post('/logout', authenticate, logout)
router.get('/me', authenticate, getMe)
router.put('/me', authenticate, validateUpdateMe, updateMe)
router.get('/drivers', authenticate, getDrivers)

// Forgot / Reset password (no auth required)
router.post('/forgot-password', validateForgotPassword, forgotPassword)
router.post('/reset-password', validateResetPassword, resetPassword)

export default router
