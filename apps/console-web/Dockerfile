# Stage 1: Build
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace root files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ packages/
COPY apps/console-web/ apps/console-web/

RUN pnpm install --frozen-lockfile

WORKDIR /app/apps/console-web
RUN pnpm build

# Stage 2: Production
FROM node:22-alpine AS production

RUN addgroup -g 1001 -S nodejs && adduser -S -u 1001 -G nodejs nodejs

WORKDIR /app

COPY --from=builder --chown=nodejs:nodejs /app/apps/console-web/.next/standalone ./
COPY --from=builder --chown=nodejs:nodejs /app/apps/console-web/.next/static apps/console-web/.next/static

ENV NODE_ENV=production
EXPOSE 3000

USER nodejs
CMD ["node", "apps/console-web/server.js"]
