import "dotenv/config";
import { createServer } from "node:http";
import Redis from "ioredis";

console.log("data-plane-worker starting...");

const port = Number(process.env["PORT"] ?? 3003);
const REDIS_URL = process.env["REDIS_URL"] ?? "redis://localhost:6379";

// In-memory metrics
const metrics = {
  requestCount: 0,
  activeStreams: 0,
};

function checkRedis(): Promise<boolean> {
  return new Promise((resolve) => {
    const client = new Redis(REDIS_URL, { lazyConnect: true, connectTimeout: 2000 });
    client
      .ping()
      .then(() => {
        client.disconnect();
        resolve(true);
      })
      .catch(() => {
        client.disconnect();
        resolve(false);
      });
  });
}

const server = createServer(async (_req, res) => {
  metrics.requestCount++;

  // GET /health — liveness
  if (_req.url === "/health" && _req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        timestamp: new Date().toISOString(),
      }),
    );
    return;
  }

  // GET /ready — readiness (check Redis)
  if (_req.url === "/ready" && _req.method === "GET") {
    const redisOk = await checkRedis();
    const status = redisOk ? "ready" : "not_ready";
    const statusCode = redisOk ? 200 : 503;

    res.writeHead(statusCode, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status,
        checks: { redis: redisOk ? "ok" : "error" },
        timestamp: new Date().toISOString(),
      }),
    );
    return;
  }

  // GET /metrics — Prometheus format
  if (_req.url === "/metrics" && _req.method === "GET") {
    let output = "";
    output += "# HELP http_requests_total Total HTTP requests\n";
    output += "# TYPE http_requests_total counter\n";
    output += `http_requests_total ${metrics.requestCount}\n\n`;
    output += "# HELP active_streams Current active RTSP->HLS streams\n";
    output += "# TYPE active_streams gauge\n";
    output += `active_streams ${metrics.activeStreams}\n`;

    res.writeHead(200, {
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
    });
    res.end(output);
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
});

server.listen(port, () => {
  console.log(`data-plane-worker listening on http://localhost:${port}`);
});
