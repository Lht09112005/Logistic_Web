import rateLimit from 'express-rate-limit'

/**
 * Rate Limiter Middleware
 *
 * Chiến lược:
 * - Auth endpoints (login, register): 10 requests / 15 phút — ngăn brute force
 * - Auth refresh/forgot/reset: 5 requests / 15 phút — bảo vệ token & password
 * - General API: 500 requests / 15 phút — đủ cho polling dashboard
 * - Admin operations: 50 requests / 15 phút
 * - Polling GET endpoints: 200 requests / 15 phút — shipments, inventory, alerts
 */

const WINDOW_MS = 15 * 60 * 1000 // 15 phút

/**
 * Strict rate limiter cho auth endpoints nhạy cảm
 * - POST /api/auth/login
 * - POST /api/auth/register
 */
export const authLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: parseInt(process.env.RATE_LIMIT_AUTH_MAX || '10', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Quá nhiều yêu cầu. Vui lòng thử lại sau 15 phút.',
  },
})

/**
 * Ultra-strict limiter cho refresh token & password operations
 * - POST /api/auth/refresh
 * - POST /api/auth/forgot-password
 * - POST /api/auth/reset-password
 */
export const strictLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: parseInt(process.env.RATE_LIMIT_STRICT_MAX || '5', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Quá nhiều yêu cầu. Vui lòng thử lại sau 15 phút.',
  },
})

/**
 * General API rate limiter — bảo vệ tổng thể cho /api
 * - 500 requests / 15 phút (configurable via env)
 * - Đủ cho dashboard polling (stats + alerts + warehouses ~12 req/min ~180 req/15min)
 */
export const apiLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: parseInt(process.env.RATE_LIMIT_API_MAX || '500', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.',
  },
})

/**
 * Higher limit cho polling GET endpoints (shipments list, inventory, alerts)
 * - 300 requests / 15 phút
 * - Áp dụng riêng cho các route được poll thường xuyên từ dashboard
 */
export const pollingLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: parseInt(process.env.RATE_LIMIT_POLLING_MAX || '300', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.',
  },
})

/**
 * Stricter limiter for admin operations (user management, warehouse create/delete)
 * - 50 requests / 15 phút
 */
export const adminLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Quá nhiều yêu cầu quản trị. Vui lòng thử lại sau.',
  },
})
