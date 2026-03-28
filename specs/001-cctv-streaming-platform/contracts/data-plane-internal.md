# Internal Contract: data-plane-worker ↔ api-control

**Protocol**: REST (Hono) + Redis Pub/Sub
**Auth**: Internal shared secret (not exposed externally)

## REST Endpoints (api-control → data-plane-worker)

### Camera Assignment
- `POST /internal/cameras/{id}/assign` — Assign camera to ingest node
- `POST /internal/cameras/{id}/unassign` — Remove camera from ingest node
- `GET /internal/nodes` — List active ingest nodes and capacity

### Configuration Sync
- `POST /internal/cameras/{id}/config` — Push updated RTSP config
- `GET /internal/cameras` — List all assigned cameras with config

## Redis Pub/Sub Channels (data-plane-worker → api-control)

### camera:health:updates
Published every 5 seconds per camera:
```json
{
  "camera_id": "cam_abc123",
  "status": "online",
  "codec": "H.264",
  "resolution": "1920x1080",
  "bitrate_kbps": 3500,
  "last_segment_at": "2026-03-22T10:30:00Z",
  "ingest_node_id": "node-01"
}
```

### camera:health:state_change
Published on state transitions:
```json
{
  "camera_id": "cam_abc123",
  "previous_status": "online",
  "new_status": "reconnecting",
  "reason": "rtsp_timeout",
  "timestamp": "2026-03-22T10:30:05Z"
}
```

## MediaMTX Control API Integration

data-plane-worker manages MediaMTX instances via their REST API:

- `GET http://mediamtx:9997/v3/paths/list` — List active paths
- `POST http://mediamtx:9997/v3/config/paths/add/{name}` — Add camera path
- `POST http://mediamtx:9997/v3/config/paths/delete/{name}` — Remove camera path
- `GET http://mediamtx:9997/v3/config/global/get` — Get global config
