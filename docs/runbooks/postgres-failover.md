# Runbook: PostgreSQL Failover

## Trigger
PostgreSQL primary becomes unreachable, or the `/ready` endpoint on api-control reports `db: error`.

## Severity
P0 — All API operations depending on the database will fail.

## Triage Steps

1. **Check PostgreSQL status**
   ```bash
   docker exec postgres pg_isready -U postgres
   docker logs postgres --tail 100
   ```

2. **Check disk space**
   ```bash
   docker exec postgres df -h /var/lib/postgresql/data
   ```
   PostgreSQL will shut down if disk is full.

3. **Check connection count**
   ```bash
   docker exec postgres psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"
   ```
   If at max_connections, new connections will be refused.

4. **Check for long-running queries or locks**
   ```bash
   docker exec postgres psql -U postgres -c "
     SELECT pid, now() - pg_stat_activity.query_start AS duration, query
     FROM pg_stat_activity
     WHERE state != 'idle'
     ORDER BY duration DESC LIMIT 10;
   "
   ```

## Resolution

### Scenario: PostgreSQL process crashed

1. Restart the container:
   ```bash
   docker restart postgres
   ```
2. Verify recovery:
   ```bash
   docker exec postgres pg_isready -U postgres
   ```

### Scenario: Disk full

1. Free space by removing old WAL files or expanding the volume.
2. If using Docker volumes:
   ```bash
   docker system prune --volumes  # WARNING: removes unused volumes
   ```

### Scenario: Max connections exhausted

1. Terminate idle connections:
   ```bash
   docker exec postgres psql -U postgres -c "
     SELECT pg_terminate_backend(pid)
     FROM pg_stat_activity
     WHERE state = 'idle'
     AND query_start < now() - interval '10 minutes';
   "
   ```
2. Consider increasing `max_connections` or adding a connection pooler (PgBouncer).

### Scenario: Corrupt data (emergency)

1. Stop all application services.
2. Attempt recovery from latest backup.
3. If no backup, attempt `pg_resetwal` as last resort (data loss risk).

## Post-Incident

- Verify api-control `/ready` returns `db: ok`.
- Run a test query to confirm read/write works.
- Review WAL archiving and backup schedule.
- Ensure automated backups are running and tested.
