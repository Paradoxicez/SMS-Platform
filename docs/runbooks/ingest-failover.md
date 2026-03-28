# Runbook: Ingest Node Failover

## Trigger
A data-plane-worker node fails health checks or becomes unresponsive.

## Severity
P1 — Active camera streams on the failed node will be interrupted.

## Triage Steps

1. **Identify the failed node**
   ```bash
   # Check health of all worker nodes
   curl http://data-plane-worker-1:3002/health
   curl http://data-plane-worker-2:3002/health
   ```

2. **Check container/process status**
   ```bash
   docker ps --filter name=data-plane-worker
   docker logs data-plane-worker-1 --tail 100
   ```

3. **Check Redis for assigned cameras**
   ```bash
   redis-cli SMEMBERS worker:assignments:<worker-id>
   ```
   This shows which cameras were being handled by the failed node.

4. **Check resource usage**
   ```bash
   docker stats data-plane-worker-1
   ```
   Look for OOM kills, CPU saturation, or file descriptor exhaustion.

## Resolution

1. **Restart the failed node**
   ```bash
   docker restart data-plane-worker-1
   ```

2. **If restart fails, reassign cameras**
   - The api-control service can reassign cameras to healthy workers.
   - For each camera assigned to the failed worker:
     ```bash
     curl -X POST http://api-control:3001/internal/cameras/<camera-id>/reassign \
       -H "X-Internal-Secret: <secret>" \
       -H "Content-Type: application/json"
     ```

3. **If persistent failure, scale horizontally**
   ```bash
   docker compose up -d --scale data-plane-worker=3
   ```

## Post-Incident

- Verify all cameras previously assigned to the failed node are reassigned and streaming.
- Review worker logs for root cause (OOM, network partition, etc.).
- Adjust resource limits or add monitoring for early detection.
