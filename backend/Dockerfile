# ============================================================
# Dockerfile — LogistiQ Backend (Express + Prisma + Socket.io)
# ============================================================
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (layer caching)
COPY package*.json ./
RUN apk add --no-cache openssl && npm ci --include=dev

# Generate Prisma client
COPY prisma ./prisma
RUN npx prisma generate

# Build TypeScript
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ============================================================
# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install only production dependencies
COPY package*.json ./
RUN apk add --no-cache openssl && npm ci --omit=dev && npm cache clean --force

# Copy Prisma schema & generate client for production
COPY prisma ./prisma
RUN npx prisma generate

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist

# Expose API port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/health || exit 1

# Start server
CMD ["node", "dist/index.js"]
