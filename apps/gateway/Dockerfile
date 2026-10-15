# Multi-stage build for Urumi MCP Gateway
FROM node:24-alpine AS builder

WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@12.11.2 --activate

# Copy root monorepo files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./

# Copy apps and packages
COPY apps/gateway ./apps/gateway

# Install dependencies and build
RUN pnpm install --frozen-lockfile --filter @urumi/gateway...
RUN pnpm --filter @urumi/gateway build

# Production runtime stage
FROM node:24-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

# Security: Run as non-root user
USER node

# Copy built distribution and node_modules preserving monorepo layout
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/gateway ./apps/gateway

WORKDIR /app/apps/gateway
EXPOSE 4000

CMD ["node", "dist/main.js"]
