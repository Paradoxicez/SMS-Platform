# Pinned Versions

All runtime versions used in the B2B CCTV Streaming Platform.
Updated: 2026-03-22

## Runtime

| Technology | Version | Type | Notes |
|-----------|---------|------|-------|
| Node.js | 22.x LTS | Runtime | Latest LTS |
| pnpm | 9.x | Package manager | |
| TypeScript | 5.x | Language | |

## Frameworks & Libraries

| Technology | Version | Package | Notes |
|-----------|---------|---------|-------|
| Turborepo | 2.x | turbo | Build system |
| Next.js | 15.x | next | Console web (stable, non-canary) |
| Hono | 4.x | hono | API framework |
| Drizzle ORM | 0.38.x | drizzle-orm | Database ORM |
| drizzle-kit | 0.31.x | drizzle-kit | Migration tooling |
| Zod | 3.x | zod | Schema validation |
| Tailwind CSS | 4.x | tailwindcss | Styling |
| shadcn/ui | latest | (components) | UI preset: --preset b2BWMmrjc |
| hls.js | 1.x | hls.js | HLS player |
| Leaflet | 1.9.x | leaflet | Map library |
| React | 19.x | react | UI framework |

## Infrastructure

| Technology | Version | Image/Binary | Notes |
|-----------|---------|-------------|-------|
| PostgreSQL | 17.x | postgres:17-alpine | Latest stable major |
| Redis | 7.x | redis:7-alpine | Cache/sessions/rate-limit |
| Keycloak | 26.x | quay.io/keycloak/keycloak:26.0 | OIDC/OAuth2 IAM |
| MediaMTX | 1.x | bluenviron/mediamtx:latest-ffmpeg | RTSP → HLS |

## Testing

| Technology | Version | Package | Notes |
|-----------|---------|---------|-------|
| Vitest | latest | vitest | Unit/integration tests |
| Playwright | latest | @playwright/test | E2E tests |
| k6 | latest | k6 (binary) | Load tests |

## Versioning Policy

- All versions pinned via `pnpm-lock.yaml`
- Container images pinned via tags in `docker-compose.yml`
- **STABLE LTS only** — no beta, rc, or canary releases
- Update quarterly or on security advisories
