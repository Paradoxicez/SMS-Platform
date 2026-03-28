# License API Contract

## POST /api/v1/license/activate

Activate a license key for the current tenant.

**Auth**: Required (admin role)

**Request**:
```json
{
  "key": "eyJpZCI6IkxJQy0yMDI2LTAwMSIs..."
}
```

**Response 200**:
```json
{
  "data": {
    "valid": true,
    "status": "active",
    "license_id": "LIC-2026-001",
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
    "features": ["hls", "webrtc", "embed", "api_access", "recording"],
    "addons": ["recording"],
    "expires_at": "2027-03-26T00:00:00Z",
    "days_remaining": 365
  }
}
```

**Response 422** (invalid key):
```json
{
  "error": {
    "code": "INVALID_LICENSE",
    "message": "Invalid license key signature"
  }
}
```

**Response 422** (expired):
```json
{
  "error": {
    "code": "LICENSE_EXPIRED",
    "message": "License has expired. Contact your vendor for renewal."
  }
}
```

---

## GET /api/v1/license/status

Get current license status.

**Auth**: Required (any authenticated user)

**Response 200**:
```json
{
  "data": {
    "valid": true,
    "status": "active",
    "license_id": "LIC-2026-001",
    "tenant": "Company ABC",
    "plan": "pro",
    "limits": { ... },
    "features": ["hls", "webrtc", ...],
    "addons": ["recording"],
    "expires_at": "2027-03-26T00:00:00Z",
    "days_remaining": 365,
    "is_on_prem": true
  }
}
```

**Status values**: `active`, `expiring`, `grace_period`, `read_only`, `trial`, `invalid`, `none`

---

## CLI: generate-license

```bash
pnpm license:generate \
  --tenant "Company ABC" \
  --plan pro \
  --cameras 100 \
  --projects 10 \
  --users 20 \
  --addons recording ai \
  --expires 2027-03-26

# Output:
# ✓ License generated
# ID:       LIC-2026-001
# Tenant:   Company ABC
# Plan:     pro
# Cameras:  100
# Addons:   recording, ai
# Expires:  2027-03-26
#
# License Key:
# eyJpZCI6IkxJQy0yMDI2LTAwMSIs...
```

**Flags**:
| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--tenant` | Yes | — | Customer name |
| `--plan` | Yes | — | Plan tier (free/starter/pro/enterprise) |
| `--cameras` | No | Plan default | Max cameras |
| `--projects` | No | Plan default | Max projects |
| `--users` | No | Plan default | Max users |
| `--addons` | No | (none) | Addon names (space-separated or comma-separated) |
| `--expires` | No | +1 year | Expiry date (YYYY-MM-DD) |
| `--private-key` | No | `keys/license.private.key` | Path to Ed25519 private key |

---

## Heartbeat API (Vendor-side, for reference)

### POST {LICENSE_HEARTBEAT_URL}

**Request** (from on-prem deployment):
```json
{
  "license_id": "LIC-2026-001",
  "camera_count": 47,
  "platform_version": "1.2.0",
  "timestamp": "2026-03-26T12:00:00Z"
}
```

**Response**:
```json
{ "status": "valid" }
```
or
```json
{ "status": "revoked", "reason": "License transferred to new deployment" }
```
