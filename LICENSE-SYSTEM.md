# License System

## Overview

The platform uses a **Hybrid License** model that supports both offline and online validation.

```
License Key contains:
├── plan        → base feature set (free/starter/pro/enterprise)
├── limits      → hard limits (cameras, users, projects)
├── addons      → extra features purchased separately
├── expiresAt   → expiry date
└── signature   → Ed25519 signature (tamper-proof)
```

## How It Works

### Validation Flow

```
App startup
    │
    ├─ Read LICENSE_KEY from DB (or env)
    │
    ├─ Verify signature with public key (embedded in app)
    │   ├─ FAIL → show "Invalid license" + limited mode
    │   └─ PASS ↓
    │
    ├─ Check expiry
    │   ├─ EXPIRED > 30 days → show "License expired"
    │   ├─ EXPIRED < 30 days → show warning (grace period)
    │   └─ VALID ↓
    │
    ├─ Extract plan + limits + addons
    │
    ├─ Online heartbeat (if internet available)
    │   ├─ Send: license ID, camera count, version
    │   ├─ Receive: revocation status, feature updates
    │   └─ Cache result for 72 hours
    │
    └─ Apply features + limits to tenant
```

### Feature Resolution

```
Effective features = plan base features + addons from key

Example:
  Key: { plan: "pro", addons: ["recording"] }

  Pro base features: hls, webrtc, embed, api_access, csv_import,
                     webhooks, stream_profiles, audit_log, map_public
  + Addon:           recording

  Result: all of the above + recording
```

## Plans & Features

| Feature | Free | Starter | Pro | Enterprise |
|---------|------|---------|-----|------------|
| **Limits** | | | | |
| Cameras | 3 | 50 | 500 | Unlimited |
| Projects | 1 | 3 | 10 | Unlimited |
| Users | 2 | 5 | 20 | Unlimited |
| Sites | 1 | 5 | 30 | Unlimited |
| API Keys | 0 | 2 | 10 | Unlimited |
| Retention | 0 days | 7 days | 30 days | 90 days |
| Viewer Hours/mo | 100 | 1,000 | 10,000 | Unlimited |
| **Streaming** | | | | |
| HLS | Yes | Yes | Yes | Yes |
| WebRTC | - | - | Yes | Yes |
| Stream Profiles | - | Yes | Yes | Yes |
| Custom Profiles | - | - | Yes | Yes |
| **Integration** | | | | |
| Embed (iframe) | - | Yes | Yes | Yes |
| API Access | - | Yes | Yes | Yes |
| CSV Import | - | - | Yes | Yes |
| Webhooks | - | - | Yes | Yes |
| Forwarding (RTSP) | - | - | Yes | Yes |
| AI Integrations | - | - | - | Yes |
| **Data** | | | | |
| Recording/VOD | - | - | Yes | Yes |
| Audit Log | 7 days | 30 days | 90 days | 365 days |
| Public Map | - | - | Yes | Yes |
| **Admin** | | | | |
| SSO | - | - | - | Yes |
| Multi-Engine | - | - | - | Yes |

## License Key Structure

```json
{
  "id": "LIC-2026-001",
  "tenant": "Company ABC",
  "plan": "pro",
  "limits": {
    "cameras": 100,
    "projects": 10,
    "users": 20,
    "sites": 30,
    "api_keys": 10,
    "viewer_hours": 10000,
    "retention_days": 30
  },
  "addons": ["recording"],
  "issuedAt": "2026-03-26",
  "expiresAt": "2027-03-26",
  "signature": "base64-ed25519-signature"
}
```

The key is base64url-encoded and provided to the customer as a single string.

## Setup (One-Time)

### Generate Ed25519 Key Pair

Before generating any license keys, create the signing key pair:

```bash
pnpm license:keygen

# Output:
# ✓ Ed25519 key pair generated
#   Private key: keys/license.private.key  (keep secret — never commit!)
#   Public key:  keys/license.public.key   (embed in app)
```

- The **private key** stays with the vendor only — used to sign license keys
- The **public key** is embedded in the application — used to verify signatures
- Both files are excluded from git via `.gitignore` (`*.key`)

## Generating a License Key

```bash
pnpm license:generate \
  --tenant "Company ABC" \
  --plan pro \
  --cameras 100 \
  --addons recording ai \
  --expires 2027-03-26
```

### CLI Flags

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--tenant <name>` | Yes | — | Customer/organization name |
| `--plan <tier>` | Yes | — | Plan tier: `free`, `starter`, `pro`, `enterprise` |
| `--cameras <n>` | No | Plan default | Max cameras |
| `--projects <n>` | No | Plan default | Max projects |
| `--users <n>` | No | Plan default | Max users |
| `--sites <n>` | No | Plan default | Max sites |
| `--api-keys <n>` | No | Plan default | Max API keys |
| `--viewer-hours <n>` | No | Plan default | Viewer hours quota |
| `--retention-days <n>` | No | Plan default | Recording retention days |
| `--addons <names...>` | No | (none) | Addon names (space or comma-separated) |
| `--expires <date>` | No | +1 year | Expiry date (YYYY-MM-DD) |
| `--private-key <path>` | No | `keys/license.private.key` | Path to private key |

### Examples

```bash
# Minimal: use all plan defaults
pnpm license:generate --tenant "Acme Corp" --plan starter

# Custom limits with addons (space-separated)
pnpm license:generate --tenant "Acme Corp" --plan starter \
  --cameras 80 --addons recording webhooks

# Custom limits with addons (comma-separated)
pnpm license:generate --tenant "Acme Corp" --plan pro \
  --cameras 200 --addons recording,ai,sso --expires 2028-01-01

# Enterprise with all defaults (unlimited)
pnpm license:generate --tenant "Big Corp" --plan enterprise
```

## Activating a License (On-Prem)

### Via Console UI

1. Go to **Settings > License**
2. Paste the license key
3. Click **Activate**
4. Status shows: Active, features unlocked

### Via API

```bash
curl -X POST http://localhost:3001/api/v1/license/activate \
  -H "Content-Type: application/json" \
  -d '{ "key": "eyJpZCI6IkxJQy0yMDI2LTAwMSIs..." }'
```

### Via Environment Variable

```env
# apps/api-control/.env
DEPLOYMENT_MODE=onprem
LICENSE_KEY=eyJpZCI6IkxJQy0yMDI2LTAwMSIs...
```

## Checking License Status

```bash
curl http://localhost:3001/api/v1/license/status
```

```json
{
  "data": {
    "valid": true,
    "status": "active",
    "tenant": "Company ABC",
    "plan": "pro",
    "max_cameras": 100,
    "features": ["hls", "webrtc", "embed", "recording", "..."],
    "expires_at": "2027-03-26",
    "is_on_prem": true
  }
}
```

## Upgrading / Replacing a License Key

When a customer upgrades their plan, purchases more cameras, or renews an expiring license, the vendor generates a new key and the customer activates it — **no restart required**.

### Upgrade Flow

```
1. Vendor generates new key:
   pnpm license:generate --tenant "Company ABC" --plan pro --cameras 500

2. Customer activates in Settings > License (or via API)

3. Old license is deactivated, new one takes effect immediately
```

### Via Console UI

1. Go to **Settings > License**
2. Paste the new license key (replaces existing)
3. Click **Activate**
4. Limits and features update immediately

### Via API

```bash
# Same endpoint as initial activation — replaces existing license
curl -X POST http://localhost:3001/api/v1/license/activate \
  -H "Content-Type: application/json" \
  -d '{ "key": "NEW_LICENSE_KEY_HERE" }'
```

### What Happens on Upgrade

- Previous license is deactivated in the database
- New license limits apply immediately (e.g., cameras: 50 → 500)
- New features are unlocked instantly
- Downgrade is also supported (features/limits may decrease)
- Existing streams continue uninterrupted
- Audit log records the change

## Online Heartbeat (Optional)

For deployments with internet access, the platform can periodically validate the license with the vendor's server. This enables license revocation and deployment telemetry.

### Configuration

Set the `LICENSE_HEARTBEAT_URL` environment variable:

```env
# .env
LICENSE_HEARTBEAT_URL=https://license.your-vendor.com/api/heartbeat
```

- **Empty or unset** = heartbeat disabled (fully offline mode)
- When set, the platform sends a POST every **24 hours**

### What Gets Sent

```json
{
  "license_id": "LIC-2026-001",
  "camera_count": 47,
  "platform_version": "1.2.0",
  "timestamp": "2026-03-28T12:00:00Z"
}
```

### What Gets Returned

```json
{ "status": "valid" }
```
or
```json
{ "status": "revoked", "reason": "License transferred to new deployment" }
```

### Offline Tolerance

- Successful heartbeat responses are **cached for 72 hours**
- If the server is unreachable, the platform continues operating normally using the cache
- If the cache expires (>72h offline), a warning is logged but the platform is **not blocked**
- If the response is `"revoked"`, the platform enters the same grace period flow as an expired license

## Environment Variables Reference

All license-related env vars (see `.env.example` for a complete template):

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DEPLOYMENT_MODE` | Yes (on-prem) | (cloud) | Set to `onprem` to enable license checking |
| `LICENSE_KEY` | No | — | Fallback license key (DB takes precedence) |
| `LICENSE_PUBLIC_KEY` | No | — | Hex-encoded public key (alternative to file) |
| `LICENSE_HEARTBEAT_URL` | No | — | Vendor heartbeat URL (empty = disabled) |

## Expiry & Grace Period

```
License lifecycle:

  Active          Grace Period (30 days)       Disabled
  ──────────────────┼───────────────────────────┼──────────
                 Expiry                    Expiry + 30d
                 Date

  Active:       All features work normally
  Grace Period: Warning banner shown, all features still work
  Disabled:     Read-only mode, no new cameras/sessions
```

## Feature Gating in Code

Features are checked at two levels:

### 1. Middleware (API routes)

```typescript
// Check if tenant can add more cameras
app.post("/cameras", requireCameraSlot(), async (c) => { ... });

// Check if feature is enabled
app.post("/webhooks", requireFeature("webhooks"), async (c) => { ... });
```

### 2. Frontend (UI visibility)

```typescript
// Hide UI elements for features not in plan
{plan.features.includes("embed") && (
  <Button>Generate Embed Code</Button>
)}

// Show upgrade prompt when limit reached
{cameras.length >= plan.limits.cameras && (
  <UpgradePrompt feature="cameras" />
)}
```

## On-Prem vs SaaS

| | On-Prem | SaaS |
|---|---|---|
| License source | License key (file/env) | Subscription plan (DB) |
| Feature control | Key determines plan + addons | Plan selected at signup |
| Billing | Offline (invoice/PO) | Online (Stripe/payment) |
| Updates | Manual (docker pull) | Automatic |
| Default plan | Enterprise (if no key) | Free |
| `DEPLOYMENT_MODE` | `onprem` | not set (cloud) |

## Addon System

Addons are features sold separately on top of a base plan:

| Addon | Description | Available on |
|-------|-------------|--------------|
| `recording` | Per-camera recording with VOD playback | Starter+ |
| `ai` | AI/analytics integration hooks | Pro+ |
| `sso` | SAML/OIDC SSO integration | Pro+ |
| `multi_engine` | Multiple Stream Engine nodes | Pro+ |
| `white_label` | Remove branding, custom domain | Enterprise |

Addons are encoded in the license key. Changing addons requires issuing a new key.

## Security

- **Signature**: Ed25519 (asymmetric) — private key stays with us, public key embedded in app
- **Tampering**: Modifying any field invalidates the signature
- **Sharing**: License key is tied to tenant name (visible in UI)
- **Revocation**: Online heartbeat checks revocation list (offline: grace period only)
- **Decompilation**: Public key exposure is safe — cannot forge signatures without private key
