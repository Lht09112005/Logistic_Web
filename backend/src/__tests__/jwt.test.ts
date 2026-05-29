import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  JwtPayload,
} from '../config/jwt';

describe('JWT Helpers Unit Tests', () => {
  const mockPayload: JwtPayload = {
    userId: 'mock-user-123',
    email: 'test@logistiq.vn',
    role: 'STAFF',
  };

  test('should generate a valid access token string', () => {
    const token = generateAccessToken(mockPayload);
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
  });

  test('should verify and decode access token correctly', () => {
    const token = generateAccessToken(mockPayload);
    const decoded = verifyAccessToken(token);
    expect(decoded.userId).toBe(mockPayload.userId);
    expect(decoded.email).toBe(mockPayload.email);
    expect(decoded.role).toBe(mockPayload.role);
  });

  test('should generate and verify refresh token correctly', () => {
    const token = generateRefreshToken(mockPayload);
    expect(typeof token).toBe('string');
    const decoded = verifyRefreshToken(token);
    expect(decoded.userId).toBe(mockPayload.userId);
  });

  test('should throw error when verifying an invalid token', () => {
    expect(() => {
      verifyAccessToken('invalid-token-string');
    }).toThrow();
  });
});
