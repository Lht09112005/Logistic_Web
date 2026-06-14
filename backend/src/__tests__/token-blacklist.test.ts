import { createHash } from 'crypto'

// Mock Prisma
const mockPrisma = {
  tokenBlacklist: {
    upsert: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
}

jest.mock('../config/database', () => ({
  prisma: mockPrisma,
  __esModule: true,
  default: mockPrisma,
}))

// Helper to generate a valid JWT-like token for testing
function makeTestToken(exp?: number): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(
    JSON.stringify({ userId: 'test', role: 'ADMIN', ...(exp ? { exp } : {}) })
  ).toString('base64url')
  const signature = 'fake-signature'
  return `${header}.${payload}.${signature}`
}

describe('TokenBlacklist Service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  // ─── blacklistToken ─────────────────────────────────

  describe('blacklistToken', () => {
    it('should upsert token hash with expiry from JWT exp claim', async () => {
      const futureExp = Math.floor((Date.now() + 3600000) / 1000) // 1 hour from now
      const token = makeTestToken(futureExp)

      const { blacklistToken } = await import('../services/token-blacklist.service')
      await blacklistToken(token)

      const tokenHash = createHash('sha256').update(token).digest('hex')
      expect(mockPrisma.tokenBlacklist.upsert).toHaveBeenCalledWith({
        where: { tokenHash },
        update: { expiresAt: expect.any(Date) },
        create: { tokenHash, expiresAt: expect.any(Date) },
      })
    })

    it('should not upsert when token has no valid expiry', async () => {
      const token = 'not-a-valid-jwt'

      const { blacklistToken } = await import('../services/token-blacklist.service')
      await blacklistToken(token)

      expect(mockPrisma.tokenBlacklist.upsert).not.toHaveBeenCalled()
    })

    it('should upsert with fallback 15-min expiry when JWT has no exp claim', async () => {
      const token = makeTestToken() // no exp
      const now = Date.now()

      const { blacklistToken } = await import('../services/token-blacklist.service')
      await blacklistToken(token)

      const upsertCall = mockPrisma.tokenBlacklist.upsert.mock.calls[0][0]
      expect(upsertCall.create.expiresAt.getTime()).toBeGreaterThanOrEqual(now + 14 * 60 * 1000)
      expect(upsertCall.create.expiresAt.getTime()).toBeLessThanOrEqual(now + 16 * 60 * 1000)
    })
  })

  // ─── isBlacklisted ─────────────────────────────────

  describe('isBlacklisted', () => {
    it('should return false when token is not in blacklist', async () => {
      mockPrisma.tokenBlacklist.findUnique.mockResolvedValue(null)

      const { isBlacklisted } = await import('../services/token-blacklist.service')
      const result = await isBlacklisted('some-token')

      expect(result).toBe(false)
    })

    it('should return true when token is in blacklist and not expired', async () => {
      const futureDate = new Date(Date.now() + 3600000)
      mockPrisma.tokenBlacklist.findUnique.mockResolvedValue({
        id: 'entry-1',
        tokenHash: 'hash',
        expiresAt: futureDate,
      })

      const { isBlacklisted } = await import('../services/token-blacklist.service')
      const result = await isBlacklisted('some-token')

      expect(result).toBe(true)
      expect(mockPrisma.tokenBlacklist.delete).not.toHaveBeenCalled()
    })

    it('should perform lazy cleanup and return false when token is expired', async () => {
      const expiredDate = new Date(Date.now() - 3600000) // 1 hour ago
      mockPrisma.tokenBlacklist.findUnique.mockResolvedValue({
        id: 'entry-1',
        tokenHash: 'hash',
        expiresAt: expiredDate,
      })

      const { isBlacklisted } = await import('../services/token-blacklist.service')
      const result = await isBlacklisted('some-token')

      expect(result).toBe(false)
      expect(mockPrisma.tokenBlacklist.delete).toHaveBeenCalledWith({
        where: { id: 'entry-1' },
      })
    })
  })

  // ─── cleanupExpiredTokens ─────────────────────────────────

  describe('cleanupExpiredTokens', () => {
    it('should delete expired tokens and return count', async () => {
      mockPrisma.tokenBlacklist.deleteMany.mockResolvedValue({ count: 3 })

      const { cleanupExpiredTokens } = await import('../services/token-blacklist.service')
      const count = await cleanupExpiredTokens()

      expect(count).toBe(3)
      expect(mockPrisma.tokenBlacklist.deleteMany).toHaveBeenCalledWith({
        where: { expiresAt: { lt: expect.any(Date) } },
      })
    })

    it('should return 0 when no expired tokens', async () => {
      mockPrisma.tokenBlacklist.deleteMany.mockResolvedValue({ count: 0 })

      const { cleanupExpiredTokens } = await import('../services/token-blacklist.service')
      const count = await cleanupExpiredTokens()

      expect(count).toBe(0)
    })
  })
})
