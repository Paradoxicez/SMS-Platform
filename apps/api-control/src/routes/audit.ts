import { Hono } from "hono";
import { requireRole } from "../middleware/rbac";
import { requireFeature } from "../middleware/feature-gate";
import {
  queryAuditEvents,
  exportAuditEvents,
  type AuditQueryFilters,
} from "../services/audit";
import type { AppEnv } from "../types";

const auditRouter = new Hono<AppEnv>();

// All audit routes require the "audit_log" feature
auditRouter.use("/audit/*", requireFeature("audit_log"));

// GET /audit/events — search events with query params
auditRouter.get(
  "/audit/events",
  requireRole("admin", "operator"),
  async (c) => {
    const tenantId = c.get("tenantId") as string;

    const filters: AuditQueryFilters = {
      eventType: c.req.query("event_type"),
      actorId: c.req.query("actor_id"),
      cameraId: c.req.query("camera_id"),
      sessionId: c.req.query("session_id"),
      from: c.req.query("from"),
      to: c.req.query("to"),
      sourceIp: c.req.query("source_ip"),
      page: parseInt(c.req.query("page") ?? "1", 10),
      perPage: parseInt(c.req.query("per_page") ?? "50", 10),
    };

    const result = await queryAuditEvents(tenantId, filters);

    return c.json({
      data: result.items,
      meta: {
        request_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
      pagination: {
        page: result.page,
        per_page: result.perPage,
        total: result.total,
        total_pages: result.totalPages,
      },
    });
  },
);

// POST /audit/events/export — export filtered events as CSV or JSON
auditRouter.post(
  "/audit/events/export",
  requireRole("admin"),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const body = await c.req.json();

    const { format = "json", ...filterParams } = body as {
      format?: "csv" | "json";
      event_type?: string;
      actor_id?: string;
      camera_id?: string;
      session_id?: string;
      from?: string;
      to?: string;
    };

    const filters: AuditQueryFilters = {
      eventType: filterParams.event_type,
      actorId: filterParams.actor_id,
      cameraId: filterParams.camera_id,
      sessionId: filterParams.session_id,
      from: filterParams.from,
      to: filterParams.to,
    };

    const data = await exportAuditEvents(tenantId, filters, format);

    const contentType =
      format === "csv" ? "text/csv" : "application/json";
    const filename =
      format === "csv" ? "audit-events.csv" : "audit-events.json";

    return new Response(data, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  },
);

export { auditRouter };
