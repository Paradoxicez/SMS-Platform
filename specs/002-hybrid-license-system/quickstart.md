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
  --addons recording \
  --expires 2027-03-26
```

### 3. Send Key to Customer

Copy the output license key string and send it to the customer.

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

## Trial Mode (No License)

Without a license key, the platform runs in trial mode:
- 3 cameras max
- HLS only (no WebRTC)
- No API access, embed, recording, or webhooks
- Full platform UI accessible (features show upgrade prompts)
