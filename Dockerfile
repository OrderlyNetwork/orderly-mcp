# Multi-stage build for production
FROM node:24-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./

# Copy build scripts before installing (needed for prepare script)
COPY scripts/build.js scripts/build.js

# Install dependencies
RUN yarn install --frozen-lockfile --ignore-scripts

# Copy source code
COPY . .

# Build the project
RUN yarn build

# Production stage
FROM node:24-alpine AS production

WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./

# Install production dependencies only
RUN yarn install --production --frozen-lockfile

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Run HTTP server (stateless mode)
CMD ["node", "dist/http-server.js"]
