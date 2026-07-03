# ============================================
# Production Dockerfile — Backend Server
# ============================================

# Step 1: Build stage
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Copy lock and root package configs
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/

# Install build dependencies
RUN npm ci

# Copy shared & server sources
COPY packages/shared ./packages/shared
COPY packages/server ./packages/server

# Build TypeScript
RUN npm run build:shared
RUN ls -la packages/shared/dist
RUN npm run build:server

# Step 2: Runner stage
FROM node:20-alpine AS runner

WORKDIR /usr/src/app

ENV NODE_ENV=production

# Copy root package configs
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/

# Install only production dependencies
RUN npm ci --only=production

# Copy compiled JS files from builder
COPY --from=builder /usr/src/app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /usr/src/app/packages/server/dist ./packages/server/dist
COPY --from=builder /usr/src/app/packages/server/src/db/migrations ./packages/server/dist/db/migrations

EXPOSE 3001

CMD ["npm", "run", "start", "-w", "packages/server"]
