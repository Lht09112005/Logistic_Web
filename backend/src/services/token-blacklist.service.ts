import { createHash } from 'crypto'
import { prisma } from '../config/database'

/**
 * Token Blacklist Service
 *
 * Chiến lược:
 * - Lưu hash của access token + thời gian hết hạn của token
 * - Dùng SHA-256 hash để lưu trữ an toàn (không lưu token plain text)
 * - Khi logout, blacklist token hiện tại
 * - Mỗi access token có TTL 15 phút, không cần cleanup quá thường xuyên
 * - Cleanup tự động mỗi giờ (gọi từ index.ts)
 */

/**
 * Tạo SHA-256 hash từ token string
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * Giải mã JWT để lấy thời gian hết hạn (exp claim)
 * Trả về Date object tương ứng với exp.
 */
function getTokenExpiry(token: string): Date | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf-8')
    )
    // exp là Unix timestamp (seconds)
    if (payload.exp && typeof payload.exp === 'number') {
      return new Date(payload.exp * 1000)
    }
    // Fallback: nếu không có exp, mặc định 15 phút
    return new Date(Date.now() + 15 * 60 * 1000)
  } catch {
    return new Date(Date.now() + 15 * 60 * 1000)
  }
}

/**
 * Blacklist một access token.
 * Token sẽ bị từ chối cho đến khi hết hạn tự nhiên.
 */
export async function blacklistToken(token: string): Promise<void> {
  const tokenHash = hashToken(token)
  const expiresAt = getTokenExpiry(token)

  if (!expiresAt) return

  // Upsert — nếu token đã được blacklist trước đó thì không thêm lại
  await prisma.tokenBlacklist.upsert({
    where: { tokenHash },
    update: { expiresAt }, // Cập nhật expiry nếu token đã tồn tại
    create: { tokenHash, expiresAt },
  })
}

/**
 * Kiểm tra xem token có đang bị blacklist không.
 * Đồng thời tự động xóa entry nếu token đã hết hạn (lazy cleanup).
 */
export async function isBlacklisted(token: string): Promise<boolean> {
  const tokenHash = hashToken(token)

  const entry = await prisma.tokenBlacklist.findUnique({
    where: { tokenHash },
  })

  if (!entry) return false

  // Lazy cleanup: nếu token đã hết hạn thì xóa khỏi DB và trả về false
  if (entry.expiresAt < new Date()) {
    await prisma.tokenBlacklist.delete({
      where: { id: entry.id },
    })
    return false
  }

  return true
}

/**
 * Cleanup tất cả các token đã hết hạn trong DB.
 * Trả về số lượng token đã xóa.
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const result = await prisma.tokenBlacklist.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  })
  return result.count
}
