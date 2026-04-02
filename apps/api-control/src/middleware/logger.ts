import { createMiddleware } from "hono/factory";
import { recordRequestMetrics } from "../routes/health";
import type { AppEnv } from "../types";

/**
 * T118: Structured JSON logging middleware
 *
 * Logs every request: method, path, status, duration_ms, request_id.
 */
export const loggerMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const requestId = crypto.randomUUID();
  c.set("requestId", requestId);
  c.header("X-Request-ID", requestId);

  const start = performance.now();

  await next();

  const durationMs = performance.now() - start;
  const durationSec = durationMs / 1000;

  // Record metrics for the /metrics endpoint
  recordRequestMetrics(durationSec);

  const logEntry = {
    level: "info",
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    duration_ms: Math.round(durationMs * 100) / 100,
    request_id: requestId,
    timestamp: new Date().toISOString(),
  };

  process.stdout.write(JSON.stringify(logEntry) + "\n");
});
