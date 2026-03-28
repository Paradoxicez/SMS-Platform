# Runbook: Playback Session Key Rotation

## Trigger
Scheduled rotation (recommended: quarterly) or suspected key compromise.

## Severity
P2 (scheduled) / P0 (compromise).

## Overview

Playback sessions use signed tokens that include camera IDs and expiration times. The signing key must be rotated periodically or immediately if compromised.

## Steps

### 1. Generate a new signing key

```bash
# Generate a new 256-bit key
openssl rand -hex 32
```

### 2. Update the environment variable

Update `PLAYBACK_SIGNING_KEY` in the production environment:

```bash
# For docker-compose
# Edit .env file or docker-compose.prod.yml
PLAYBACK_SIGNING_KEY=<new-key-value>
```

### 3. Deploy with dual-key support (zero-downtime)

During rotation, both old and new keys should be accepted for validation:

1. Set the new key as `PLAYBACK_SIGNING_KEY`.
2. Set the old key as `PLAYBACK_SIGNING_KEY_PREVIOUS`.
3. Deploy api-control with both keys configured.
4. The service will sign new tokens with the new key but accept tokens signed with either key.

```bash
docker compose -f docker/docker-compose.prod.yml up -d api-control
```

### 4. Wait for old tokens to expire

All existing playback sessions have a TTL (default: 1 hour, max: 24 hours). Wait at least 24 hours for all old sessions to expire.

### 5. Remove the old key

After the expiration window:
1. Remove `PLAYBACK_SIGNING_KEY_PREVIOUS` from the environment.
2. Redeploy api-control.

```bash
docker compose -f docker/docker-compose.prod.yml up -d api-control
```

### 6. Verify

- Create a new playback session and confirm it works.
- Confirm old tokens are no longer accepted (if any remain).

## If Key Is Compromised

1. **Immediately** rotate the key following steps 1-3 above.
2. Revoke all active playback sessions:
   ```sql
   UPDATE playback_sessions
   SET status = 'revoked', revoked_at = NOW()
   WHERE status = 'active';
   ```
3. Notify affected tenants.
4. Review audit logs for unauthorized session creation.
5. Investigate how the key was leaked and remediate.

## Post-Rotation

- Verify new sessions can be created and used for playback.
- Confirm audit logs show `session.issued` events with the new key.
- Update the rotation schedule in your calendar/ticketing system.
