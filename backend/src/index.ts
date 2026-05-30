import express from 'express'
import http from 'http'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { Server } from 'socket.io'
import dotenv from 'dotenv'

import authRoutes from './routes/auth.routes'
import userRoutes from './routes/user.routes'
import productRoutes from './routes/product.routes'
import inventoryRoutes from './routes/inventory.routes'
import shipmentRoutes from './routes/shipment.routes'
import warehouseRoutes from './routes/warehouse.routes'

dotenv.config()

const app = express()
const server = http.createServer(app)

// Socket.io gateway - Realtime bidirectional communication
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
})

// Middleware
app.use(helmet())
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}))
app.use(morgan('dev'))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/products', productRoutes)
app.use('/api/inventory', inventoryRoutes)
app.use('/api/shipments', shipmentRoutes)
app.use('/api/warehouses', warehouseRoutes)

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() })
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

    // Also emit global update for dashboard live tracking
    io.emit('shipment:position', payload)
  })

  // Checkpoint arrival
  socket.on('checkpoint:arrived', (data: { shipmentId: string; checkpointId: string }) => {
    io.to(`shipment:${data.shipmentId}`).emit('checkpoint:completed', data)
  })

  // Stock alert broadcast
  socket.on('stock:alert', (alert: unknown) => {
    io.emit('alert:new', alert)
  })

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`)
  })
})

// Export io for use in controllers
export { io }

const PORT = process.env.PORT || 5000

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`📡 Socket.io ready`)
})

export default app
