# Research: B2B CCTV Streaming Platform

**Date**: 2026-03-22
**Branch**: `001-cctv-streaming-platform`

## R1: REST API Framework

**Decision**: Hono + @hono/zod-validator + hono-openapi

**Rationale**: Hono is ultrafast, TypeScript-first, Web Standards-based,
and runs on Node.js. Built-in Zod validator middleware provides type-safe
request validation using the same Zod schemas from `/packages/types`.
hono-openapi auto-generates OpenAPI 3.1 specs from Zod schemas.

**Alternatives considered**:
- Fastify: Strong contender, but Hono's Zod-native validation and
  type-safe RPC client (for SDK generation) give it an edge for this
  monorepo where `/packages/sdk` needs typed clients.
- Express.js: Too old, no TypeScript-first support, worse performance.
- NestJS: Over-engineered for an API-only service.

## R2: ORM / Database Layer

**Decision**: Drizzle ORM + drizzle-kit (migrations)

**Rationale**: Drizzle is lightweight (~7.4kb), TypeScript-first, supports
PostgreSQL natively, has built-in RLS (Row-Level Security) support via
`.enableRLS()` and `pgPolicy()`, and generates migrations via
`drizzle-kit generate`. Schema definitions in TypeScript align with the
monorepo's `/packages/types` Zod schemas.

**Alternatives considered**:
- Prisma: Heavier runtime, no native RLS support, separate schema
  language (not TypeScript).
- Kysely: Type-safe query builder but no migration tooling built-in.
- Raw SQL + node-postgres: Too low-level for rapid MVP development.

## R3: Streaming Ingest + HLS Packaging

**Decision**: MediaMTX

**Rationale**: MediaMTX is a zero-dependency, single-binary media server
that handles RTSP proxy → HLS conversion natively. Key capabilities:
- RTSP pull from cameras via path configuration
  (`source: rtsp://ip:port/stream`)
- Built-in HLS server with configurable segment duration (1s) and
  partial segments (200ms for LL-HLS)
- Control API on port 9997 for dynamic path management
  (add/remove cameras at runtime)
- Prometheus metrics endpoint on port 9998
- Authentication support (internal users, JWT, webhook)
- `runOnReady` / `runOnPublish` hooks for thumbnail extraction
- `sourceOnDemand` mode to only pull RTSP when viewers connect
  (saves bandwidth for idle cameras)

This eliminates the need for a separate FFmpeg packaging step for MVP.
MediaMTX handles RTSP → HLS repackage/copy in a single process.

**Alternatives considered**:
- SRS (Simple RTMP Server): Powerful but more complex configuration,
  primarily RTMP-focused (RTSP support via FFmpeg sidecar).
- Custom FFmpeg pipeline: Maximum flexibility but requires building
  orchestration, health monitoring, and segment serving from scratch.

## R4: Thumbnail Generation

**Decision**: FFmpeg via MediaMTX `runOnReady` hook + cron job

**Rationale**: MediaMTX's `runOnReady` hook triggers when a stream
becomes available. A lightweight FFmpeg command extracts a keyframe
every 5 seconds and writes to a shared thumbnail directory. This avoids
a separate thumbnail service for MVP.

Command pattern:
```bash
ffmpeg -i rtsp://localhost:8554/{path} -vf "fps=1/5" -frames:v 1 \
  -y /thumbnails/{path}/latest.jpg
```

Post-MVP: Replace with a dedicated thumbnail worker for better
resource isolation.

## R5: Session Token Signing

**Decision**: HMAC-SHA256 signed tokens stored in Redis

**Rationale**: Lightweight, no JWT library dependency for token
validation at the origin. Token is an opaque ID (jti) stored in Redis
with metadata (camera_id, allowed_origins, expires_at). Origin validates
by Redis lookup — O(1) and compatible with revocation (delete key).

**Alternatives considered**:
- JWT: Self-contained but revocation requires a blocklist (negating
  the stateless advantage). Redis lookup is simpler.
- Paseto: Better than JWT but unnecessary complexity for this use case.

## R6: Internal Communication (data-plane-worker ↔ api-control)

**Decision**: REST (Hono) + Redis Pub/Sub for real-time health events

**Rationale**:
- REST for configuration sync (camera assignments, policy changes)
- Redis Pub/Sub for real-time health state updates from ingest nodes
  (low latency, already have Redis in stack)
- Avoids adding gRPC/protobuf complexity for MVP

**Alternatives considered**:
- gRPC: Better for high-frequency RPC, but adds protobuf toolchain.
- Message queue (RabbitMQ/NATS): Overkill for MVP; Redis Pub/Sub
  sufficient for 500–1000 cameras reporting every 5 seconds.

## R7: Map Tile Provider

**Decision**: Leaflet + OpenStreetMap tiles (OSS-first)

**Rationale**: Constitution Principle I (Open-Source First) mandates
OSS preference. Leaflet is the most widely-used OSS map library.
OpenStreetMap tiles are free for moderate usage. Google Maps can be
added as an optional provider post-MVP.

## R8: Frontend Framework

**Decision**: Next.js (latest stable) for `/apps/console-web`

**Rationale**: Constitution mandates Next.js for console-web. App Router
with Server Components for initial page loads, Client Components for
interactive elements (DataTable, Map, Player). shadcn/ui is Next.js
native.

## R9: HLS Player

**Decision**: hls.js (OSS)

**Rationale**: hls.js is the standard OSS HLS player library for
browsers. Lightweight, well-maintained, supports LL-HLS. No proprietary
dependencies.

## R10: Version Pins (as of 2026-03-22)

| Technology | Version | Notes |
|-----------|---------|-------|
| Node.js | 22.x LTS | Latest LTS |
| pnpm | 9.x | Latest stable |
| Turborepo | 2.x | Latest stable |
| Next.js | 15.x | Latest stable (non-canary) |
| Hono | 4.x | Latest stable |
| Drizzle ORM | 0.38.x | Latest stable |
| drizzle-kit | 0.31.x | Latest stable |
| PostgreSQL | 17.x | Latest stable major |
| Redis | 7.x | Latest stable |
| MediaMTX | 1.x | Latest stable |
| Keycloak | 26.x | Latest stable |
| hls.js | 1.x | Latest stable |
| Leaflet | 1.9.x | Latest stable |
| Zod | 3.x | Latest stable |
| Tailwind CSS | 4.x | Latest stable |
| TypeScript | 5.x | Latest stable |
