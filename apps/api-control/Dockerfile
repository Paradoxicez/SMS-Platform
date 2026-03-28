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

WORKDIR /app

COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder /app/packages/ packages/
COPY --from=builder /app/apps/api-control/package.json apps/api-control/
COPY --from=builder /app/apps/api-control/dist/ apps/api-control/dist/

RUN pnpm install --frozen-lockfile --prod

ENV NODE_ENV=production
EXPOSE 3001

WORKDIR /app/apps/api-control
CMD ["node", "dist/index.js"]
