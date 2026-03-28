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
  licenseActivations: 0,
  licenseActivationErrors: 0,
  heartbeatSuccesses: 0,
  heartbeatFailures: 0,
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

export function recordLicenseActivation(success: boolean): void {
  if (success) {
    metrics.licenseActivations++;
  } else {
    metrics.licenseActivationErrors++;
  }
}

export function recordHeartbeat(success: boolean): void {
  if (success) {
    metrics.heartbeatSuccesses++;
  } else {
    metrics.heartbeatFailures++;
  }
}

// License status for gauge — set externally by license service
let licenseStatusGauge = "none";
let licenseDaysRemaining = 0;
let licensePlan = "none";

export function setLicenseMetrics(status: string, daysRemaining: number, plan: string): void {
  licenseStatusGauge = status;
  licenseDaysRemaining = daysRemaining;
  licensePlan = plan;
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
  output += `active_sessions ${metrics.activeSessions}\n\n`;

  // License metrics
  output += "# HELP license_activations_total Total license activation attempts\n";
  output += "# TYPE license_activations_total counter\n";
  output += `license_activations_total{result="success"} ${metrics.licenseActivations}\n`;
  output += `license_activations_total{result="error"} ${metrics.licenseActivationErrors}\n\n`;

  output += "# HELP license_heartbeat_total Total heartbeat requests\n";
  output += "# TYPE license_heartbeat_total counter\n";
  output += `license_heartbeat_total{result="success"} ${metrics.heartbeatSuccesses}\n`;
  output += `license_heartbeat_total{result="failure"} ${metrics.heartbeatFailures}\n\n`;

  output += "# HELP license_status Current license status (1=active, 0=other)\n";
  output += "# TYPE license_status gauge\n";
  output += `license_status{status="${licenseStatusGauge}",plan="${licensePlan}"} ${licenseStatusGauge === "active" ? 1 : 0}\n\n`;

  output += "# HELP license_days_remaining Days until license expiry\n";
  output += "# TYPE license_days_remaining gauge\n";
  output += `license_days_remaining ${licenseDaysRemaining}\n`;

  return new Response(output, {
    status: 200,
    headers: { "Content-Type": "text/plain; version=0.0.4; charset=utf-8" },
  });
});

export { healthRouter };
