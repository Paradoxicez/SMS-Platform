# Stage 1: Build
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace root files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ packages/
COPY apps/data-plane-worker/ apps/data-plane-worker/

RUN pnpm install --frozen-lockfile

WORKDIR /app/apps/data-plane-worker
RUN pnpm build

# Stage 2: Production
FROM node:22-alpine AS production

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder /app/packages/ packages/
COPY --from=builder /app/apps/data-plane-worker/package.json apps/data-plane-worker/
COPY --from=builder /app/apps/data-plane-worker/dist/ apps/data-plane-worker/dist/

RUN pnpm install --frozen-lockfile --prod

ENV NODE_ENV=production
EXPOSE 3002

WORKDIR /app/apps/data-plane-worker
CMD ["node", "dist/index.js"]
