#!/bin/bash
# Activate Enterprise license on a running SMS Platform instance
# Usage: bash activate-license.sh

API="${API_URL:-http://localhost:3001/api/v1}"
EMAIL="${ADMIN_EMAIL:-admin@root}"
PASS="${ADMIN_PASSWORD:-p@ssw0rd2026}"
KEY="eyJpZCI6IkxJQy0yMDI2LUVOVC0wMDEiLCJ0ZW5hbnQiOiJNYWdpY0hvdXNlIiwicGxhbiI6ImVudGVycHJpc2UiLCJsaW1pdHMiOnsiY2FtZXJhcyI6OTAwNzE5OTI1NDc0MDk5MSwicHJvamVjdHMiOjkwMDcxOTkyNTQ3NDA5OTEsInVzZXJzIjo5MDA3MTk5MjU0NzQwOTkxLCJzaXRlcyI6OTAwNzE5OTI1NDc0MDk5MSwiYXBpX2tleXMiOjkwMDcxOTkyNTQ3NDA5OTEsInZpZXdlcl9ob3VycyI6OTAwNzE5OTI1NDc0MDk5MSwicmV0ZW50aW9uX2RheXMiOjM2NX0sImFkZG9ucyI6WyJobHMiLCJ3ZWJydGMiLCJlbWJlZCIsImFwaV9hY2Nlc3MiLCJzdHJlYW1fcHJvZmlsZXMiLCJjdXN0b21fcHJvZmlsZXMiLCJjc3ZfaW1wb3J0Iiwid2ViaG9va3MiLCJyZWNvcmRpbmciLCJhdWRpdF9sb2ciLCJtYXBfcHVibGljIiwic3NvIiwibXVsdGlfZW5naW5lIl0sImlzc3VlZEF0IjoiMjAyNi0wNC0wMyIsImV4cGlyZXNBdCI6IjIwMzAtMDQtMDMifQ.BtOSupwPyI34_cPPHz42gMklWMot6x13hnCC3ULjOkDqjTFR4Ka-8137m6VnJT_yftSsFpTGlO9jAHl8PDD3CA"

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
