import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { redis } from "../lib/redis";

const healthRouter = new Hono();

// In-memory metrics counters
const metrics = {
  requestCount: 0,
  requestDurationSum: 0,
  requestDurationBuckets: new Map<string, number>(),
  activeSessions: 0,
};

const BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

/**
 * Increment request metrics — call this from the logger middleware.
 */
export function recordRequestMetrics(durationSec: number): void {
  metrics.requestCount++;
  metrics.requestDurationSum += durationSec;

  for (const bucket of BUCKETS) {
    if (durationSec <= bucket) {
      const key = String(bucket);
      metrics.requestDurationBuckets.set(
        key,
        (metrics.requestDurationBuckets.get(key) ?? 0) + 1,
      );
    }
  }
}

export function setActiveSessions(count: number): void {
  metrics.activeSessions = count;
}

// T115: GET /health — simple liveness check
healthRouter.get("/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// T116 + T283: GET /ready — readiness check (DB + Redis + MediaMTX)
healthRouter.get("/ready", async (c) => {
  const checks: Record<string, string> = {};

  // Check DB
  try {
    await db.execute(sql`SELECT 1`);
    checks.db = "ok";
  } catch {
    checks.db = "error";
  }

  // Check Redis
  try {
    await redis.ping();
    checks.redis = "ok";
  } catch {
    checks.redis = "error";
  }

  // Check MediaMTX
  try {
    const mtxUrl = process.env["MEDIAMTX_API_URL"] ?? "http://localhost:9997";
    const res = await fetch(`${mtxUrl}/v3/paths/list`, {
      signal: AbortSignal.timeout(3000),
    });
    checks.mediamtx = res.ok ? "ok" : "error";
  } catch {
    checks.mediamtx = "error";
  }

  const allOk = Object.values(checks).every((v) => v === "ok");

  return c.json(
    {
      status: allOk ? "ready" : "not_ready",
      checks,
      timestamp: new Date().toISOString(),
    },
    allOk ? 200 : 503,
  );
});

// T117: GET /metrics — Prometheus-format metrics
healthRouter.get("/metrics", (c) => {
  let output = "";

  // Request count
  output += "# HELP http_requests_total Total number of HTTP requests\n";
  output += "# TYPE http_requests_total counter\n";
  output += `http_requests_total ${metrics.requestCount}\n\n`;

  // Request duration histogram
  output += "# HELP http_request_duration_seconds HTTP request duration in seconds\n";
  output += "# TYPE http_request_duration_seconds histogram\n";

  let cumulativeCount = 0;
  for (const bucket of BUCKETS) {
    const key = String(bucket);
    cumulativeCount += metrics.requestDurationBuckets.get(key) ?? 0;
    output += `http_request_duration_seconds_bucket{le="${bucket}"} ${cumulativeCount}\n`;
  }
  output += `http_request_duration_seconds_bucket{le="+Inf"} ${metrics.requestCount}\n`;
  output += `http_request_duration_seconds_sum ${metrics.requestDurationSum}\n`;
  output += `http_request_duration_seconds_count ${metrics.requestCount}\n\n`;

  // Active sessions gauge
  output += "# HELP active_sessions Current number of active playback sessions\n";
  output += "# TYPE active_sessions gauge\n";
  output += `active_sessions ${metrics.activeSessions}\n`;

  return new Response(output, {
    status: 200,
    headers: { "Content-Type": "text/plain; version=0.0.4; charset=utf-8" },
  });
});

export { healthRouter };
