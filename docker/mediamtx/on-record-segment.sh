#!/bin/sh
# Called by MediaMTX when recording segment is created or completed
# Args: $1 = event type (start/end), $MTX_PATH, $MTX_RECORD_PATH are env vars from MediaMTX

EVENT_TYPE="$1"
API_URL="http://host.docker.internal:3001/internal/recording/event"
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

wget -q -O /dev/null \
  --header="Content-Type: application/json" \
  --header="X-Internal-Secret: dev-secret" \
  --post-data="{\"type\":\"${EVENT_TYPE}\",\"path\":\"${MTX_PATH}\",\"file_path\":\"${MTX_RECORD_PATH}\",\"start_time\":\"${TIMESTAMP}\"}" \
  "${API_URL}" 2>/dev/null || true
