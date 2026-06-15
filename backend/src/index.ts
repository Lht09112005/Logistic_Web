// Load .env FIRST — before any module-level code that uses process.env
import './config/env'

import express, { Request, Response, NextFunction } from 'express'
import { prisma } from './config/database'
import http from 'http'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { Server } from 'socket.io'
import swaggerUi from 'swagger-ui-express'
import { sendError } from './utils/response'

import authRoutes from './routes/auth.routes'
import userRoutes from './routes/user.routes'
import productRoutes from './routes/product.routes'
import inventoryRoutes from './routes/inventory.routes'
import shipmentRoutes from './routes/shipment.routes'
import warehouseRoutes from './routes/warehouse.routes'
import notificationRoutes from './routes/notification.routes'
import { verifySMTPConnection } from './lib/email'
import { swaggerSpec } from './config/swagger'
import { apiLimiter, pollingLimiter, adminLimiter } from './middleware/rate-limiter.middleware'
import { cleanupExpiredTokens } from './services/token-blacklist.service'

const app = express()
const server = http.createServer(app)

// Socket.io gateway - Realtime bidirectional communication
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
})

// Trust proxy — required for rate limiter's default keyGenerator to get real client IP behind Render/Nginx
app.set('trust proxy', 1)

// Middleware
app.use(helmet())
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}))
app.use(morgan('dev'))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Apply general API rate limiter to all /api routes
app.use('/api', apiLimiter)

// Apply higher-limit polling limiter to frequently polled GET endpoints
app.use('/api/shipments', pollingLimiter)
app.use('/api/inventory', pollingLimiter)

// Apply stricter rate limiter to admin operations
app.use('/api/users', adminLimiter)
app.use('/api/warehouses', adminLimiter)

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/products', productRoutes)
app.use('/api/inventory', inventoryRoutes)
app.use('/api/shipments', shipmentRoutes)
app.use('/api/warehouses', warehouseRoutes)
app.use('/api/notifications', notificationRoutes)

// Swagger API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none } .swagger-ui .info .description p { font-size: 14px }',
  customSiteTitle: 'LogistiQ API Docs',
  customfavIcon: '',
}))

// JSON version of swagger spec
app.get('/api-docs.json', (_req, res) => {
  res.json(swaggerSpec)
})

// Health check
app.get('/health', async (_req, res) => {
  const dbUrl = process.env.DATABASE_URL || '';
  let dbHost = 'unknown';
  let maskedDbUrl = 'none';
  try {
    if (dbUrl) {
      maskedDbUrl = dbUrl.replace(/:[^:@]+@/, ':***@');
      // Simple parse host
      const match = dbUrl.match(/@([^/:]+)/);
      if (match) dbHost = match[1];
    }
  } catch (e) {}

  const smtpCheck = await verifySMTPConnection();

  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    commit: '2f738c4-health-diagnostics',
    databaseHost: dbHost,
    databaseUrlMasked: maskedDbUrl,
    smtp: {
      success: smtpCheck.success,
      error: smtpCheck.error || null,
      user: process.env.SMTP_USER || null,
      host: process.env.SMTP_HOST || null,
      port: process.env.SMTP_PORT || null
    }
  })
})

// Global Error Handler Middleware
app.use((err: any, req: Request, res: Response, next: NextFunction): void => {
  console.error('[GlobalErrorHandler]', err)
  const status = err.status || err.statusCode || 500
  const message = err.message || 'Đã xảy ra lỗi hệ thống!'
  sendError(res, message, status, process.env.NODE_ENV === 'development' ? err.stack : undefined)
})

// Socket.io - Realtime tracking
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`)

  // Driver joins their shipment room
  socket.on('join:shipment', (shipmentId: string) => {
    socket.join(`shipment:${shipmentId}`)
    console.log(`Socket ${socket.id} joined room: shipment:${shipmentId}`)
  })

  // Driver sends location update
  socket.on('location:update', async (data: {
    shipmentId: string
    latitude: number
    longitude: number
    speed?: number
    status?: string
  }) => {
    const payload = {
      shipmentId: data.shipmentId,
      latitude: data.latitude,
      longitude: data.longitude,
      speed: data.speed,
      status: data.status,
    }
    // Broadcast to all viewers of this shipment
    io.to(`shipment:${data.shipmentId}`).emit('location:updated', payload)
    io.to(`shipment:${data.shipmentId}`).emit('shipment:position', payload)
  })

  // Client joins warehouse room (for role-based filtering)
  socket.on('join:warehouse', (warehouseIds: string[]) => {
    if (!Array.isArray(warehouseIds)) return
    for (const whId of warehouseIds) {
      socket.join(`warehouse:${whId}`)
      console.log(`Socket ${socket.id} joined room: warehouse:${whId}`)
    }
  })

  // Client leaves warehouse room
  socket.on('leave:warehouse', (warehouseIds: string[]) => {
    if (!Array.isArray(warehouseIds)) return
    for (const whId of warehouseIds) {
      socket.leave(`warehouse:${whId}`)
    }
  })

  // Stock alert broadcast
  socket.on('stock:alert', (alert: unknown) => {
    io.emit('alert:new', alert)
  })

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`)
  })
})

// ─── Automatic cleanup of expired blacklisted tokens ───
// Chạy mỗi 60 phút để dọn dẹp token đã hết hạn
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000 // 1 giờ
setInterval(async () => {
  try {
    const count = await cleanupExpiredTokens()
    if (count > 0) {
      console.log(`[TokenBlacklist] Cleaned up ${count} expired token(s)`)
    }
  } catch (err) {
    console.error('[TokenBlacklist] Cleanup error:', err)
  }
}, CLEANUP_INTERVAL_MS)

// Export io for use in controllers
export { io }

const PORT = process.env.PORT || 5000

server.listen(PORT, async () => {
  console.log(`[Server] LogistiQ API running on port ${PORT}`)
  console.log(`[Socket] Socket.io ready`)

  // Run startup migration to fix all PostgreSQL custom enum columns
  try {
    console.log('[Migration] Checking and converting all enum columns to VARCHAR...')
    await prisma.$executeRawUnsafe(`
      DO $$
      DECLARE
          r RECORD;
      BEGIN
          FOR r IN 
              SELECT table_name, column_name, column_default
              FROM information_schema.columns 
              WHERE table_schema = 'public' 
                AND data_type = 'USER-DEFINED'
          LOOP
              RAISE NOTICE 'Converting %.% from enum to VARCHAR...', r.table_name, r.column_name;
              
              -- Drop default first
              EXECUTE format('ALTER TABLE %I ALTER COLUMN %I DROP DEFAULT', r.table_name, r.column_name);
              
              -- Alter column type
              EXECUTE format('ALTER TABLE %I ALTER COLUMN %I TYPE VARCHAR(50) USING %I::VARCHAR', r.table_name, r.column_name, r.column_name);
              
              -- Re-add default value if it had one
              IF r.column_default IS NOT NULL THEN
                  DECLARE
                      clean_default TEXT;
                  BEGIN
                      clean_default := split_part(r.column_default, '::', 1);
                      EXECUTE format('ALTER TABLE %I ALTER COLUMN %I SET DEFAULT %s', r.table_name, r.column_name, clean_default);
                  EXCEPTION WHEN OTHERS THEN
                      EXECUTE format('ALTER TABLE %I ALTER COLUMN %I SET DEFAULT %s', r.table_name, r.column_name, r.column_default);
                  END;
              END IF;
          END LOOP;
      END
      $$;
    `)
    console.log('[Migration] Database column types checked and updated successfully.')
  } catch (err) {
    console.error('[Migration] Error running startup migrations:', err)
  }
})

export default app
