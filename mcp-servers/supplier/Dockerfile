FROM node:24-alpine AS builder

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@12.11.2 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY mcp-servers/supplier ./mcp-servers/supplier

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @urumi/mcp-supplier build

FROM node:24-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3003

USER node

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/mcp-servers/supplier ./mcp-servers/supplier

WORKDIR /app/mcp-servers/supplier
EXPOSE 3003

CMD ["node", "dist/main.js"]
