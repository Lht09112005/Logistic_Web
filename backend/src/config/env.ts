// MUST be imported first to load .env before any other module-level code runs
import dotenv from 'dotenv'
dotenv.config()

// Strict validation of required environment variables
const requiredEnv = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET']
const missingEnv = requiredEnv.filter((envVar) => !process.env[envVar])

if (missingEnv.length > 0) {
  console.error('\x1b[31m%s\x1b[0m', `[Env Error] Missing required environment variables: ${missingEnv.join(', ')}`)
  process.exit(1)
}

