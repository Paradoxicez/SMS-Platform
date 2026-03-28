# Quickstart: B2B CCTV Streaming Platform

## Prerequisites

- Node.js 22.x LTS
- pnpm 9.x
- Docker & Docker Compose (for PostgreSQL, Redis, Keycloak, MediaMTX)
- A test RTSP source (or use MediaMTX's test stream generator)

## 1. Clone & Install

```bash
git clone <repo-url> && cd sms-app
pnpm install
```

## 2. Start Infrastructure

```bash
docker compose up -d
# Starts: PostgreSQL 17, Redis 7, Keycloak 26, MediaMTX 1.x
```

## 3. Run Migrations

```bash
pnpm --filter api-control db:migrate
```

## 4. Seed Development Data

```bash
pnpm --filter api-control db:seed
# Creates: demo tenant, admin user, sample project/site
```

## 5. Start Development Servers

```bash
pnpm dev
# Starts all apps via Turborepo:
#   console-web  → http://localhost:3000
#   api-control  → http://localhost:3001
#   data-plane   → http://localhost:3002
```

## 6. Login to Console

1. Open http://localhost:3000
2. Login via Keycloak (demo@example.com / demo123)
3. You should see the dashboard with zero cameras

## 7. Onboard a Test Camera

### Option A: Via Console UI
1. Navigate to Cameras → Add Camera
2. Enter RTSP URL: `rtsp://localhost:8554/test`
3. Camera should transition to "online" within 30 seconds

### Option B: Via API
```bash
curl -X POST http://localhost:3001/api/v1/sites/{siteId}/cameras \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Camera",
    "rtsp_url": "rtsp://localhost:8554/test",
    "lat": 13.7563,
    "lng": 100.5018
  }'
```

## 8. Request a Playback Session

```bash
curl -X POST http://localhost:3001/api/v1/playback/sessions \
  -H "X-API-Key: {api_key}" \
  -H "Content-Type: application/json" \
  -d '{
    "camera_id": "{camera_id}",
    "ttl": 120
  }'
```

Response includes a `playback_url` — open it in any HLS-compatible
player (e.g., hls.js demo page) to verify live playback.

## 9. Verify Audit Log

```bash
curl http://localhost:3001/api/v1/audit/events \
  -H "Authorization: Bearer {token}"
```

Should show `session.issued` event for the playback session created above.

## Validation Checklist

- [ ] `pnpm install` succeeds without errors
- [ ] `pnpm dev` starts all three apps
- [ ] Console login works via Keycloak
- [ ] Camera onboarding produces "online" status
- [ ] Playback session returns signed URL
- [ ] HLS playback works in browser
- [ ] Audit log contains the session event
- [ ] `pnpm lint` and `pnpm typecheck` pass
