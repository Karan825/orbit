FROM node:24-alpine AS builder

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@12.11.2 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/dashboard ./apps/dashboard

RUN pnpm install --frozen-lockfile --filter @urumi/dashboard...
RUN pnpm --filter @urumi/dashboard build

FROM node:24-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

USER node

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/dashboard ./apps/dashboard

WORKDIR /app/apps/dashboard
EXPOSE 3000

CMD ["./node_modules/.bin/next", "start", "-p", "3000"]
