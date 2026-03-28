# Research: Hybrid License System

## R1: Ed25519 Signing Library for Node.js

**Decision**: Use `@noble/ed25519` (by Paul Miller)

**Rationale**:
- Pure JavaScript, zero native dependencies → works in any Node.js environment without build tools
- Audited, widely used (150M+ downloads), MIT licensed
- Small bundle (~5KB), fast (sign: ~0.1ms, verify: ~0.2ms)
- No OpenSSL dependency — important for reproducible Docker builds

**Alternatives Considered**:
- `tweetnacl` — also pure JS, but less actively maintained and API is lower-level
- Node.js built-in `crypto.sign('ed25519')` — available since Node 16, but requires key format conversion (PEM/DER) which adds complexity
- `sodium-native` — fast but requires native compilation (problematic for Alpine Docker)

**Resolution**: @noble/ed25519 is the best fit for OSS-first, zero-native-dep requirements.

---

## R2: License Key Format

**Decision**: Base64url-encoded JSON payload + detached Ed25519 signature

**Format**:
```
BASE64URL( JSON.stringify({
  id: "LIC-2026-001",
  tenant: "Company ABC",
  plan: "pro",
  limits: { cameras: 100, projects: 10, users: 20, sites: 30, api_keys: 10, viewer_hours: 10000, retention_days: 30 },
  addons: ["recording"],
  issuedAt: "2026-03-26",
  expiresAt: "2027-03-26"
}) ) + "." + BASE64URL( signature )
```

**Rationale**:
- Two-part format (payload.signature) is easy to split and verify
- JSON payload is human-readable when decoded (helpful for debugging)
- Base64url (no padding) is URL-safe and clipboard-friendly
- Signature is detached — payload can be inspected without verification

**Alternatives Considered**:
- JWT (RFC 7519) — overkill for offline license, adds JWT library dependency
- Protobuf — compact but not human-readable, adds protobuf dependency
- Custom binary — compact but fragile and hard to debug

---

## R3: Plan Definitions Storage

**Decision**: Hardcoded in application code as a TypeScript constant

**Rationale**:
- Plan definitions are a business decision, not customer data — they should be version-controlled
- Prevents customers from modifying features by editing the database
- Changes to plan features ship with software updates (controlled rollout)
- Simple to test — no DB fixtures needed

**Structure**:
```typescript
const PLAN_DEFINITIONS: Record<PlanTier, PlanDefinition> = {
  free: { features: ["hls"], limits: { cameras: 3, ... } },
  starter: { features: ["hls", "stream_profiles", "embed", "api_access"], limits: { cameras: 50, ... } },
  pro: { features: ["hls", "webrtc", "embed", "api_access", "csv_import", "webhooks", "stream_profiles", "custom_profiles", "audit_log", "map_public", "forwarding"], limits: { cameras: 500, ... } },
  enterprise: { features: ["*"], limits: { cameras: Infinity, ... } },
};
```

**Alternatives Considered**:
- Store in DB (`subscription_plans` table) — already exists but exposes to customer modification in on-prem
- Store in license key — bloats key size and requires re-issuing key to change features

---

## R4: License Persistence Strategy

**Decision**: New `licenses` table in PostgreSQL

**Schema**:
- `id` (uuid, PK)
- `tenant_id` (uuid, FK → tenants)
- `license_key` (text) — full encoded key
- `license_id` (varchar) — decoded LIC-xxxx ID
- `plan` (varchar) — decoded plan tier
- `limits` (jsonb) — decoded limits
- `addons` (jsonb) — decoded addons array
- `issued_at` (timestamptz)
- `expires_at` (timestamptz)
- `activated_at` (timestamptz)
- `is_active` (boolean, default true) — false when replaced by newer key

**Rationale**:
- Survives restarts (unlike env vars)
- Queryable and auditable
- Supports license history (previous keys kept with `is_active=false`)
- Decoded fields stored for fast access without re-parsing

**Alternatives Considered**:
- File on disk (e.g., `/etc/sms-platform/license.key`) — less portable, permission issues
- Redis only — volatile, lost on Redis restart
- Env var only — current approach, already proven insufficient

---

## R5: Heartbeat Protocol

**Decision**: Simple HTTPS POST with JSON body, response is JSON

**Request**:
```json
POST https://license.vendor.com/api/v1/heartbeat
{
  "license_id": "LIC-2026-001",
  "camera_count": 47,
  "platform_version": "1.2.0",
  "timestamp": "2026-03-26T12:00:00Z"
}
```

**Response**:
```json
{ "status": "valid" }       // or
{ "status": "revoked", "reason": "License transferred" }
```

**Rationale**:
- Minimal payload — no sensitive data sent
- Simple status response — no complex protocol needed
- HTTPS for transport security
- 24-hour interval balances freshness with bandwidth

**Alternatives Considered**:
- WebSocket persistent connection — overkill for once-daily check
- gRPC — adds dependency, no benefit for simple request/response
- DNS-based validation (TXT record) — creative but fragile and hard to debug

---

## R6: Grace Period Implementation

**Decision**: Enforce at middleware level using license expiry timestamp

**Logic**:
```
if (not expired)           → ACTIVE: all features work
if (expired < 30 days ago) → GRACE: all features work + warning banner
if (expired >= 30 days)    → READ_ONLY: block new cameras/sessions, allow existing streams
```

**Rationale**:
- Middleware check runs on every authenticated request — minimal code needed
- Warning banner is a frontend-only concern (check license status on page load)
- Existing streams are Data Plane (not affected by Control Plane license check per Constitution Principle II)

**Alternatives Considered**:
- Cron job that disables features at expiry — more complex, race conditions
- Gradual feature removal (remove one feature per week) — confusing for customers
