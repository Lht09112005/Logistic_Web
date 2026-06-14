import express from 'express'
import http from 'http'

describe('Rate Limiter Middleware', () => {
  const OLD_ENV = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...OLD_ENV }
  })

  afterAll(() => {
    process.env = OLD_ENV
  })

  // ─── Configuration Tests ─────────────────────────────────

  describe('Configuration', () => {
    it('should export all 5 rate limiters', () => {
      const { authLimiter, strictLimiter, apiLimiter, pollingLimiter, adminLimiter } = require('../middleware/rate-limiter.middleware')
      expect(authLimiter).toBeDefined()
      expect(strictLimiter).toBeDefined()
      expect(apiLimiter).toBeDefined()
      expect(pollingLimiter).toBeDefined()
      expect(adminLimiter).toBeDefined()
      expect(typeof authLimiter).toBe('function')
      expect(typeof strictLimiter).toBe('function')
      expect(typeof apiLimiter).toBe('function')
      expect(typeof pollingLimiter).toBe('function')
      expect(typeof adminLimiter).toBe('function')
    })

    it('should block based on env-var-configured authLimiter max', (done) => {
      process.env.RATE_LIMIT_AUTH_MAX = '2'
      jest.resetModules()
      const { authLimiter } = require('../middleware/rate-limiter.middleware')

      const app = express()
      app.set('trust proxy', 1)
      app.post('/api/auth/login', authLimiter, (_req: any, res: any) => {
        res.json({ success: true, message: 'OK' })
      })

      const server = app.listen(0, () => {
        const addr = server.address()
        const port = typeof addr === 'object' && addr ? addr.port : 0
        const url = `http://localhost:${port}/api/auth/login`
        const options = { method: 'POST', hostname: 'localhost', port, path: '/api/auth/login' }

        let callCount = 0

        function makeRequest(callback: (statusCode: number, body: any) => void) {
          const req = http.request(options, (res) => {
            let data = ''
            res.on('data', (chunk: string) => { data += chunk })
            res.on('end', () => {
              callback(res.statusCode || 0, JSON.parse(data))
            })
          })
          req.end()
        }

        // Request 1 — should succeed
        makeRequest((status, body) => {
          expect(status).toBe(200)
          expect(body.success).toBe(true)
          callCount++

          // Request 2 — should succeed (within limit of 2)
          makeRequest((status2, body2) => {
            expect(status2).toBe(200)
            expect(body2.success).toBe(true)
            callCount++

            // Request 3 — should be blocked (exceeds limit of 2)
            makeRequest((status3, body3) => {
              expect(status3).toBe(429)
              expect(body3.success).toBe(false)
              expect(body3.message).toContain('Quá nhiều yêu cầu')
              callCount++

              expect(callCount).toBe(3)
              server.close(() => done())
            })
          })
        })
      })
    })

    it('should use custom env values for strictLimiter and apiLimiter', () => {
      process.env.RATE_LIMIT_STRICT_MAX = '3'
      process.env.RATE_LIMIT_API_MAX = '55'
      jest.resetModules()

      // Just verify they load without error with custom env values
      const { strictLimiter, apiLimiter } = require('../middleware/rate-limiter.middleware')
      expect(strictLimiter).toBeDefined()
      expect(apiLimiter).toBeDefined()
    })
  })

  // ─── Integration Tests ─────────────────────────────────

  describe('Integration', () => {
    it('should respond with 429 rate-limit message format', (done) => {
      const rateLimit = require('express-rate-limit').default
      const testLimiter = rateLimit({
        windowMs: 60 * 1000,
        max: 1,
        standardHeaders: true,
        legacyHeaders: false,
        message: { success: false, message: 'Quá nhiều yêu cầu. Vui lòng thử lại sau 15 phút.' },
      })

      const app = express()
      app.set('trust proxy', 1)
      app.get('/test', testLimiter, (_req: any, res: any) => {
        res.json({ success: true })
      })

      const server = app.listen(0, () => {
        const addr = server.address()
        const port = typeof addr === 'object' && addr ? addr.port : 0
        const url = `http://localhost:${port}/test`

        // First request (sequential)
        http.get(url, (res1) => {
          let data1 = ''
          res1.on('data', (chunk) => { data1 += chunk })
          res1.on('end', () => {
            expect(res1.statusCode).toBe(200)
            expect(JSON.parse(data1).success).toBe(true)

            // Second request (sequential — only after first completes)
            http.get(url, (res2) => {
              let data2 = ''
              res2.on('data', (chunk) => { data2 += chunk })
              res2.on('end', () => {
                expect(res2.statusCode).toBe(429)
                const body2 = JSON.parse(data2)
                expect(body2.success).toBe(false)
                expect(body2.message).toContain('Quá nhiều yêu cầu')
                server.close(() => done())
              })
            })
          })
        })
      })
    })

    it('should allow requests within the limit', (done) => {
      const rateLimit = require('express-rate-limit').default
      const testLimiter = rateLimit({
        windowMs: 60 * 1000,
        max: 5,
        standardHeaders: true,
        legacyHeaders: false,
      })

      const app = express()
      app.set('trust proxy', 1)
      app.get('/test', testLimiter, (_req: any, res: any) => {
        res.json({ success: true })
      })

      const server = app.listen(0, () => {
        const addr = server.address()
        const port = typeof addr === 'object' && addr ? addr.port : 0
        const url = `http://localhost:${port}/test`
        let completed = 0

        function makeSequentialRequest(count: number) {
          if (count >= 5) {
            expect(completed).toBe(5)
            server.close(() => done())
            return
          }
          http.get(url, (res) => {
            let data = ''
            res.on('data', (chunk) => { data += chunk })
            res.on('end', () => {
              expect(res.statusCode).toBe(200)
              completed++
              makeSequentialRequest(count + 1)
            })
          })
        }

        makeSequentialRequest(0)
      })
    })
  })
})
