# Stage 1: Build
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace root files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ packages/
COPY apps/api-control/ apps/api-control/

RUN pnpm install --frozen-lockfile

WORKDIR /app/apps/api-control
RUN pnpm build

# Stage 2: Production
FROM node:22-alpine AS production

RUN corepack enable && corepack prepare pnpm@latest --activate

RUN addgroup -g 1001 -S nodejs && adduser -S -u 1001 -G nodejs nodejs

WORKDIR /app

COPY --from=builder --chown=nodejs:nodejs /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder --chown=nodejs:nodejs /app/packages/ packages/
COPY --from=builder --chown=nodejs:nodejs /app/apps/api-control/package.json apps/api-control/
COPY --from=builder --chown=nodejs:nodejs /app/apps/api-control/dist/ apps/api-control/dist/
COPY --from=builder --chown=nodejs:nodejs /app/apps/api-control/src/db/migrations/ apps/api-control/dist/migrations/

RUN pnpm install --frozen-lockfile --prod

ENV NODE_ENV=production
EXPOSE 3001

USER nodejs
WORKDIR /app/apps/api-control
CMD ["node", "dist/entrypoint.js"]
