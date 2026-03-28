# Quickstart: Hybrid License System

## For Vendors (Generating License Keys)

### 1. Generate Ed25519 Key Pair (one-time)

```bash
pnpm license:keygen
# Output:
# ✓ Key pair generated
# Private key: keys/license.private.key (keep secret!)
# Public key:  keys/license.public.key (embed in app)
```

### 2. Generate a License Key

```bash
pnpm license:generate \
  --tenant "Company ABC" \
  --plan pro \
  --cameras 100 \
  --addons recording ai \
  --expires 2027-03-26
```

Addons can be space-separated (`--addons recording ai`) or comma-separated (`--addons recording,ai`).

### 3. Send Key to Customer

Copy the output license key string and send it to the customer.

### 4. Upgrade / Renew

Generate a new key with updated plan/limits and send it to the customer.
They activate it over the existing one — no restart needed.

---

## For Customers (On-Prem)

### 1. Deploy the Platform

```bash
cd docker
cp .env.example .env  # Edit with your settings
docker compose -f docker-compose.prod.yml up -d
```

### 2. Activate License

1. Open `http://your-server:3000` in browser
2. Log in with admin account
3. Go to **Settings > License**
4. Paste the license key
5. Click **Activate**

### 3. Verify

- License status shows "Active"
- Plan name, camera limit, and features are displayed
- Try adding a camera — should work within limits

---

## Quick Verification

```bash
# Check license status via API
curl http://localhost:3001/api/v1/license/status

# Expected: { "data": { "valid": true, "status": "active", "plan": "pro", ... } }
```

## Upgrade a License

1. Receive a new license key from the vendor
2. Go to **Settings > License**
3. Paste the new key and click **Activate**
4. New limits and features take effect immediately (no restart)

Or via API:
```bash
curl -X POST http://localhost:3001/api/v1/license/activate \
  -H "Content-Type: application/json" \
  -d '{ "key": "NEW_LICENSE_KEY" }'
```

## Online Heartbeat (Optional)

If your deployment has internet access, add to `.env`:

```env
LICENSE_HEARTBEAT_URL=https://license.vendor.com/api/heartbeat
```

The platform will validate the license every 24 hours and cache the result for 72 hours. If the server is unreachable, the platform continues normally.

Remove or leave empty to run fully offline.

## Trial Mode (No License)

Without a license key, the platform runs in trial mode:
- 3 cameras max
- HLS only (no WebRTC)
- No API access, embed, recording, or webhooks
- Full platform UI accessible (features show upgrade prompts)
