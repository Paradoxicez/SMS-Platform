#!/bin/sh
EVENT_TYPE="$1"
API_URL="http://host.docker.internal:3001/internal/recording/event"
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
FILE_PATH="${MTX_SEGMENT_PATH:-${MTX_RECORD_PATH:-unknown}}"
echo "on-record-segment: type=${EVENT_TYPE} path=${MTX_PATH} file=${FILE_PATH}" >&2

# Get file size for recording_end events
FILE_SIZE=0
if [ "$EVENT_TYPE" = "recording_end" ] && [ -f "$FILE_PATH" ]; then
  FILE_SIZE=$(stat -c %s "$FILE_PATH" 2>/dev/null || echo 0)

  # Generate thumbnail from the middle of the segment
  THUMB_DIR=$(dirname "$FILE_PATH")
  THUMB_PATH="${THUMB_DIR}/thumbnail.jpg"
  ffmpeg -y -i "$FILE_PATH" -vf "select=eq(n\,150)" -frames:v 1 -q:v 5 "$THUMB_PATH" >/dev/null 2>&1 \
    || ffmpeg -y -i "$FILE_PATH" -frames:v 1 -q:v 5 "$THUMB_PATH" >/dev/null 2>&1 \
    || true
fi

wget -q -O /dev/null \
  --header="Content-Type: application/json" \
  --header="X-Internal-Secret: dev-secret" \
  --post-data="{\"type\":\"${EVENT_TYPE}\",\"path\":\"${MTX_PATH}\",\"file_path\":\"${FILE_PATH}\",\"start_time\":\"${TIMESTAMP}\",\"end_time\":\"${TIMESTAMP}\",\"file_size\":${FILE_SIZE}}" \
  "${API_URL}" 2>/dev/null || true
