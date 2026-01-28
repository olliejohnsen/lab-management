# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build Next.js application
RUN npm run build

# Remove development dependencies
RUN npm prune --production

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

# Set environment to production
ENV NODE_ENV=production

# Copy necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/start-server.js ./start-server.js

# Create data directory for SQLite
RUN mkdir -p /data

# Expose ports (3000 for Next.js, 3001 for WebSocket)
EXPOSE 3000 3001

# Set DATABASE_URL to use /data volume
ENV DATABASE_URL="file:/data/app.db"

# Start the application (running as root to avoid permission issues)
CMD ["sh", "-c", "rm -f /data/app.db && npx prisma migrate deploy && npx prisma db seed && npx tsx start-server.js"]
