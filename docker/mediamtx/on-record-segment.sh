#!/bin/sh
EVENT_TYPE="$1"
API_URL="http://host.docker.internal:3001/internal/recording/event"
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
FILE_PATH="${MTX_SEGMENT_PATH:-${MTX_RECORD_PATH:-unknown}}"
echo "on-record-segment: type=${EVENT_TYPE} path=${MTX_PATH} file=${FILE_PATH}" >&2
wget -q -O /dev/null --header="Content-Type: application/json" --header="X-Internal-Secret: dev-secret" --post-data="{\"type\":\"${EVENT_TYPE}\",\"path\":\"${MTX_PATH}\",\"file_path\":\"${FILE_PATH}\",\"start_time\":\"${TIMESTAMP}\"}" "${API_URL}" 2>/dev/null || true
