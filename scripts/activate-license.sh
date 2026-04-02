#!/bin/bash
# Activate Pro license on a running SMS Platform instance
# Usage: bash activate-license.sh

API="http://localhost:3001/api/v1"
EMAIL="${ADMIN_EMAIL:-admin@root}"
PASS="${ADMIN_PASSWORD:-p@ssw0rd2026}"
KEY="eyJpZCI6IkxJQy0yMDI2LUM5NUU3MiIsInRlbmFudCI6Ik1hZ2ljSG91c2UiLCJwbGFuIjoicHJvIiwibGltaXRzIjp7ImNhbWVyYXMiOjEwMCwicHJvamVjdHMiOjEwLCJ1c2VycyI6MjAsInNpdGVzIjozMCwiYXBpX2tleXMiOjEwLCJ2aWV3ZXJfaG91cnMiOjEwMDAwLCJyZXRlbnRpb25fZGF5cyI6MzB9LCJhZGRvbnMiOlsicmVjb3JkaW5nIiwid2VicnRjIiwiZW1iZWQiLCJhcGlfYWNjZXNzIiwid2ViaG9va3MiLCJhdWRpdF9sb2ciLCJtYXBfcHVibGljIiwiY3VzdG9tX3Byb2ZpbGVzIiwiY3N2X2ltcG9ydCJdLCJpc3N1ZWRBdCI6IjIwMjYtMDQtMDIiLCJleHBpcmVzQXQiOiIyMDI3LTA0LTAzIn0.zvQOeTNgcqfy-yvP4fU-yKQhP2VpxWQJ0fGbnGsgW2_8HdMIORhP3pK6WmtwkVPCxSBtx3BuRyEHaQyh9RzLCQ"

echo "Logging in as $EMAIL..."
TOKEN=$(curl -s -X POST "$API/auth/login" -H "Content-Type: application/json" -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "ERROR: Login failed"
  exit 1
fi
echo "Login OK"

echo "Activating license..."
curl -s -X POST "$API/license/activate" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"key\":\"$KEY\"}"
echo ""
echo "Done."
