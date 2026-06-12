import jwt from 'jsonwebtoken'

if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is missing in production!')
  } else {
    console.warn('Warning: JWT_SECRET is not defined, using unsafe fallback-secret!')
  }
}

if (!process.env.JWT_REFRESH_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_REFRESH_SECRET is missing in production!')
  } else {
    console.warn('Warning: JWT_REFRESH_SECRET is not defined, using unsafe fallback-refresh-secret!')
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret'
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret'

export interface JwtPayload {
  userId: string
  email: string
  role: string
}

export const generateAccessToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: (process.env.JWT_EXPIRES_IN || '15m') as any,
  })
}

export const generateRefreshToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as any,
  })
}

export const verifyAccessToken = (token: string): JwtPayload => {
  return jwt.verify(token, JWT_SECRET) as JwtPayload
}

export const verifyRefreshToken = (token: string): JwtPayload => {
  return jwt.verify(token, JWT_REFRESH_SECRET) as JwtPayload
}
