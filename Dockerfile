# Use Node.js LTS version
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (we need drizzle-kit for migrations)
RUN npm ci && \
    npm cache clean --force

# Build stage
FROM base AS builder
WORKDIR /app

# Copy package files and install all dependencies (including dev)
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build the application
# This will build both frontend (vite) and backend (esbuild) for production
RUN chmod +x build-docker.sh && ./build-docker.sh

# Production stage
FROM base AS runner
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=5000

# Install PostgreSQL client for database operations
RUN apk add --no-cache postgresql-client bash

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

# Create storage directory for contract files
RUN mkdir -p /app/storage/contracts && \
    chown -R appuser:nodejs /app/storage

# Copy built application from builder
COPY --from=builder --chown=appuser:nodejs /app/dist ./dist
COPY --from=builder --chown=appuser:nodejs /app/package*.json ./
COPY --from=builder --chown=appuser:nodejs /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder --chown=appuser:nodejs /app/shared ./shared

# Copy migrations directory
COPY --from=builder --chown=appuser:nodejs /app/migrations ./migrations
RUN chmod +x /app/migrations/run-migrations.sh

# Copy scripts directory for seeding
COPY --from=builder --chown=appuser:nodejs /app/scripts ./scripts

# Copy server directory for seed script database access
COPY --from=builder --chown=appuser:nodejs /app/server ./server

# Copy init script and make it executable
COPY --from=builder --chown=appuser:nodejs /app/init-db.sh ./init-db.sh
RUN chmod +x /app/init-db.sh

# Copy production dependencies from deps stage
COPY --from=deps --chown=appuser:nodejs /app/node_modules ./node_modules

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application using production.js
# Note: docker-compose.yml overrides this CMD to run init-db.sh first
CMD ["node", "dist/production.js"]
