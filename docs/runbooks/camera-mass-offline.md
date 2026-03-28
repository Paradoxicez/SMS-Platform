# Runbook: Camera Mass Offline

## Trigger
Multiple cameras (>10% of fleet) transition to `offline` status within a 5-minute window.

## Severity
P1 — Service degradation for affected tenants.

## Triage Steps

1. **Check data-plane-worker health**
   ```bash
   curl http://data-plane-worker:3002/ready
   ```
   If not ready, check Redis connectivity and worker logs.

2. **Check MediaMTX cluster**
   ```bash
   curl http://mediamtx:9997/v3/paths/list
   ```
   If unreachable or returning errors, MediaMTX may have crashed or run out of resources.

3. **Check network connectivity**
   - Verify the network between data-plane-workers and the camera network/VPN.
   - Check firewall rules for RTSP (port 554/8554) egress.

4. **Inspect Redis health stream**
   ```bash
   redis-cli XRANGE camera:health:stream - + COUNT 100
   ```
   Look for a pattern of cameras going offline from the same site or subnet.

5. **Check for resource exhaustion**
   ```bash
   # On data-plane-worker nodes
   docker stats
   # Check CPU/memory usage
   ```

6. **Review audit logs**
   - Query audit events for `camera.status_changed` events in the affected window.
   - Check if a bulk operation (stop_all) was recently executed.

## Resolution

- If MediaMTX is down: Restart MediaMTX service. Cameras should auto-reconnect.
- If data-plane-worker is down: Restart worker. Trigger re-assignment of cameras.
- If network issue: Coordinate with network/infra team for firewall or VPN fix.
- If resource exhaustion: Scale up data-plane-worker instances or increase resource limits.

## Post-Incident

- Verify all cameras transition back to `online` or `connecting`.
- Review camera health metrics for the past 24h.
- Update alerting thresholds if needed.
