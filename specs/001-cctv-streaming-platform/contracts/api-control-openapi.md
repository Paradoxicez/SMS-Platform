# API Contract: api-control (Control Plane REST API)

**Base URL**: `/api/v1`
**Auth**: Bearer token (Keycloak OIDC) for UI users, `X-API-Key` header for programmatic access
**Content-Type**: `application/json`
**Framework**: Hono + @hono/zod-validator + hono-openapi

## Standard Response Envelope

### Success
```json
{
  "data": { ... },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2026-03-22T10:30:00Z"
  }
}
```

### Paginated
```json
{
  "data": [ ... ],
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2026-03-22T10:30:00Z",
    "pagination": {
      "page": 1,
      "per_page": 25,
      "total": 142,
      "total_pages": 6
    }
  }
}
```

### Error
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable description",
    "details": { ... }
  },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2026-03-22T10:30:00Z"
  }
}
```

## Rate Limit Headers (all responses)

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1711100460
```

## Endpoints

### Tenants
- `POST /tenants` — Create tenant (Platform Admin)
- `GET /tenants/{id}` — Get tenant (Admin)
- `PATCH /tenants/{id}` — Update tenant (Admin)

### Projects
- `POST /projects` — Create project (Admin, Operator)
- `GET /projects` — List projects (All)
- `GET /projects/{id}` — Get project (All)
- `PATCH /projects/{id}` — Update project (Admin, Operator)
- `DELETE /projects/{id}` — Delete project (Admin)

### Sites
- `POST /projects/{projectId}/sites` — Create site (Admin, Operator)
- `GET /projects/{projectId}/sites` — List sites (All)
- `GET /sites/{id}` — Get site (All)
- `PATCH /sites/{id}` — Update site (Admin, Operator)
- `DELETE /sites/{id}` — Delete site (Admin)

### Cameras
- `POST /sites/{siteId}/cameras` — Onboard camera (Admin, Operator)
- `GET /cameras` — List cameras with filters (All)
- `GET /cameras/{id}` — Get camera (All)
- `PATCH /cameras/{id}` — Update camera (Admin, Operator)
- `DELETE /cameras/{id}` — Delete camera (Admin, Operator)
- `GET /cameras/{id}/status` — Real-time health (All)
- `POST /cameras/{id}/start` — Start stream (Admin, Operator)
- `POST /cameras/{id}/stop` — Stop stream (Admin, Operator)
- `POST /cameras/bulk` — Bulk operations (Admin, Operator)

### Playback Sessions
- `POST /playback/sessions` — Issue session (Admin, Operator, Developer)
- `POST /playback/sessions/batch` — Issue multiple sessions (Admin, Operator, Developer)
- `POST /playback/sessions/{id}/refresh` — Extend TTL (Admin, Operator, Developer)
- `POST /playback/sessions/{id}/revoke` — Revoke session (Admin, Operator, Developer)

### Policies
- `POST /policies` — Create policy (Admin, Operator)
- `GET /policies` — List policies (Admin, Operator, Developer)
- `GET /policies/{id}` — Get policy (Admin, Operator, Developer)
- `PATCH /policies/{id}` — Update policy (Admin, Operator)
- `DELETE /policies/{id}` — Delete policy (Admin)

### Map (Public)
- `GET /map/cameras?project_key={key}` — Get map pins (Public, scoped by project key)

### Audit
- `GET /audit/events` — Search events (Admin, Operator)
- `POST /audit/events/export` — Export to CSV/JSON (Admin)

### Health / Ops
- `GET /health` — Health check (Public)
- `GET /ready` — Readiness check (Public)
- `GET /metrics` — Prometheus metrics (Internal)

## Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| UNAUTHORIZED | 401 | Missing or invalid authentication |
| FORBIDDEN | 403 | Insufficient role permissions |
| NOT_FOUND | 404 | Resource not found or tenant mismatch |
| CONFLICT | 409 | Optimistic concurrency conflict |
| VALIDATION_ERROR | 422 | Request validation failed |
| CAMERA_OFFLINE | 422 | Cannot create session for offline camera |
| RATE_LIMITED | 429 | Rate limit exceeded |
| PLAYBACK_SESSION_EXPIRED | 403 | Session token expired |
| PLAYBACK_ORIGIN_DENIED | 403 | Origin not in allowlist |
| PLAYBACK_QUOTA_EXCEEDED | 403 | Viewer-hours/egress quota exceeded |
| INTERNAL_ERROR | 500 | Unexpected error |
