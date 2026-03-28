import { Hono } from "hono";
import { requireRole } from "../middleware/rbac";
import {
  getConfig,
  updateConfig,
  getConfigHistory,
  listPaths,
  syncConfigToStreamEngine,
} from "../services/mediamtx-config";
import type { AppEnv } from "../types";

const mediamtxRouter = new Hono<AppEnv>();

// GET /mediamtx/config — get config from DB (admin only)
mediamtxRouter.get("/mediamtx/config", requireRole("admin"), async (c) => {
  const tenantId = c.get("tenantId") as string;
  const result = await getConfig(tenantId);

  return c.json({
    data: result,
    meta: {
      request_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    },
  });
});

// PATCH /mediamtx/config — update config: DB + push to MediaMTX (admin only)
mediamtxRouter.patch("/mediamtx/config", requireRole("admin"), async (c) => {
  const tenantId = c.get("tenantId") as string;
  const userId = c.get("userId") as string | undefined;
  const body = await c.req.json<{
    config: Record<string, unknown>;
    version: number;
    reason?: string;
  }>();

  const sourceIp = c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip");

  const result = await updateConfig(
    tenantId,
    body.config,
    body.version,
    userId,
    body.reason,
    sourceIp
  );

  return c.json({
    data: result,
    meta: {
      request_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    },
  });
});

// GET /mediamtx/config/history — config change history (admin only)
mediamtxRouter.get(
  "/mediamtx/config/history",
  requireRole("admin"),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const limit = Number(c.req.query("limit") ?? "20");
    const history = await getConfigHistory(tenantId, limit);

    return c.json({
      data: history,
      meta: {
        request_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    });
  }
);

// POST /mediamtx/config/sync — force sync DB config to MediaMTX (admin only)
mediamtxRouter.post(
  "/mediamtx/config/sync",
  requireRole("admin"),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const result = await syncConfigToStreamEngine(tenantId);

    return c.json({
      data: result,
      meta: {
        request_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    });
  }
);

// GET /mediamtx/paths — list active paths from live MediaMTX (admin only)
mediamtxRouter.get("/mediamtx/paths", requireRole("admin"), async (c) => {
  const paths = await listPaths();

  return c.json({
    data: paths,
    meta: {
      request_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    },
  });
});

// GET /mediamtx/logs — stream MediaMTX logs via SSE (admin only)
mediamtxRouter.get("/mediamtx/logs", requireRole("admin"), async (c) => {
  const { spawn } = await import("child_process");
  const containerName = process.env["MEDIAMTX_CONTAINER"] ?? "sms-mediamtx";

  c.header("Content-Type", "text/event-stream");
  c.header("Cache-Control", "no-cache");
  c.header("Connection", "keep-alive");

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  // Stream docker logs
  const child = spawn("docker", ["logs", "-f", "--tail", "50", containerName]);

  function sendLine(line: string) {
    const trimmed = line.trim();
    if (!trimmed) return;
    writer.write(encoder.encode(`data: ${JSON.stringify({ message: trimmed, timestamp: new Date().toISOString() })}\n\n`)).catch(() => {});
  }

  child.stdout.on("data", (data: Buffer) => {
    data.toString().split("\n").forEach(sendLine);
  });
  child.stderr.on("data", (data: Buffer) => {
    data.toString().split("\n").forEach(sendLine);
  });
  child.on("close", () => {
    writer.close().catch(() => {});
  });

  // Clean up on client disconnect
  c.req.raw.signal.addEventListener("abort", () => {
    child.kill();
    writer.close().catch(() => {});
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
});

export { mediamtxRouter };
