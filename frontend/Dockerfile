# ============================================================
# Dockerfile — LogistiQ Frontend (Next.js)
# ============================================================
# Build stage
FROM node:20-alpine AS builder

# Build-time ARGs for NEXT_PUBLIC_* env vars (baked into JS bundle)
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SOCKET_URL

WORKDIR /app

# Install dependencies (dev deps needed for build)
COPY package*.json ./
RUN npm ci

# Build Next.js app
COPY . .
RUN npm run build

# ============================================================
# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install only production dependencies (smaller image)
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built output + public assets
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/postcss.config.mjs ./

# Next.js `next start` needs node_modules for the `next` CLI
# (we already installed production deps above)

# Expose Next.js port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# Start Next.js
CMD ["npm", "run", "start"]
