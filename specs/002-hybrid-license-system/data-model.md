# Data Model: Hybrid License System

## Entity: licenses

Stores activated license keys with decoded fields for fast access.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | uuid | PK, auto-generated | Internal record ID |
| tenant_id | uuid | FK → tenants, NOT NULL | Owning tenant |
| license_key | text | NOT NULL | Full encoded license key string |
| license_id | varchar(50) | NOT NULL | Decoded license ID (e.g., "LIC-2026-001") |
| plan | varchar(20) | NOT NULL | Decoded plan tier (free/starter/pro/enterprise) |
| limits | jsonb | NOT NULL | Decoded hard limits object |
| addons | jsonb | NOT NULL, default [] | Decoded addons array |
| issued_at | timestamptz | NOT NULL | When the key was issued by vendor |
| expires_at | timestamptz | NOT NULL | When the key expires |
| activated_at | timestamptz | NOT NULL, default now() | When activated in this deployment |
| is_active | boolean | NOT NULL, default true | False when replaced by a newer key |

**Relationships**:
- belongs to `tenants` (many-to-one)
- Only one `is_active=true` record per tenant at any time

**Constraints**:
- When a new license is activated, all previous licenses for the tenant are set to `is_active=false`
- License key is stored verbatim for re-verification on startup

---

## Entity: Plan Definitions (in-code, not DB)

Defines what features and default limits each plan tier includes.

| Field | Type | Description |
|-------|------|-------------|
| tier | enum | free, starter, pro, enterprise |
| features | string[] | List of feature flags included in this plan |
| defaultLimits | object | Default hard limits (cameras, projects, users, etc.) |

**Feature flags** (canonical list):
- `hls` — HLS streaming
- `webrtc` — WebRTC low-latency streaming
- `embed` — iframe embed player
- `api_access` — External API access via API keys
- `stream_profiles` — Basic stream profiles
- `custom_profiles` — Custom stream profile creation
- `csv_import` — Bulk camera import via CSV
- `webhooks` — Webhook integrations
- `recording` — Per-camera recording with VOD
- `forwarding` — RTSP forwarding rules
- `audit_log` — Audit log access
- `map_public` — Public map view
- `ai` — AI/analytics integrations
- `sso` — SAML/OIDC SSO
- `multi_engine` — Multiple Stream Engine nodes

**Limits object**:
```
{
  cameras: number,
  projects: number,
  users: number,
  sites: number,
  api_keys: number,
  viewer_hours: number,    // per month
  retention_days: number   // recording retention
}
```

---

## Entity: License Key Payload (wire format)

The decoded structure inside a license key string.

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique license ID (e.g., "LIC-2026-001") |
| tenant | string | Customer/organization name |
| plan | string | Plan tier name |
| limits | object | Hard limits (overrides plan defaults) |
| addons | string[] | Additional features beyond plan base |
| issuedAt | ISO date string | Issue date |
| expiresAt | ISO date string | Expiry date |

**Wire format**: `BASE64URL(json_payload).BASE64URL(ed25519_signature)`

---

## State Transitions: License Status

```
                    activate valid key
  NO_LICENSE ──────────────────────────────► ACTIVE
       │                                       │
       │                                       │ time passes
       │                                       ▼
       │                              ┌──── EXPIRING ◄── warning at 30 days
       │                              │        │
       │                              │        │ expires
       │                              │        ▼
       │                              │     GRACE_PERIOD (30 days)
       │                              │        │
       │                              │        │ 30 days pass
       │                              │        ▼
       │                              │     READ_ONLY
       │                              │
       │    activate new key          │    activate new key
       └──────────────────────────────┘────────────────────► ACTIVE
```

States:
- **NO_LICENSE**: Fresh deployment, trial mode (Free plan)
- **ACTIVE**: Valid license, all plan features available
- **EXPIRING**: License expires within 30 days, warning shown
- **GRACE_PERIOD**: Expired but within 30 days, all features work + persistent warning
- **READ_ONLY**: Expired beyond grace, new actions blocked, existing streams continue

Any state can transition to ACTIVE by activating a valid key.
