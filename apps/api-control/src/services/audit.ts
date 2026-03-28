import { eq, and, gte, lte, count, desc } from "drizzle-orm";
import { db, withTenantContext } from "../db/client";
import { auditEvents } from "../db/schema/audit-events";

interface AuditEventParams {
  tenantId: string;
  actorType: "user" | "api_client" | "system";
  actorId?: string;
  eventType: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  sourceIp?: string;
}

/**
 * T051: Audit event service
 *
 * Logs an audit event by inserting into the audit_events table.
 * Fire-and-forget: the insert is not awaited in the request path.
 * Errors are caught and logged to avoid affecting the main request.
 */
export function logAuditEvent(params: AuditEventParams): void {
  // Use setImmediate to defer the insert outside the current request tick
  setImmediate(() => {
    db.insert(auditEvents)
      .values({
        tenantId: params.tenantId,
        actorType: params.actorType,
        actorId: params.actorId ?? null,
        eventType: params.eventType,
        resourceType: params.resourceType ?? null,
        resourceId: params.resourceId ?? null,
        details: params.details ?? null,
        sourceIp: params.sourceIp ?? null,
      })
      .execute()
      .catch((err) => {
        console.error(
          JSON.stringify({
            level: "error",
            service: "audit",
            message: "Failed to log audit event",
            eventType: params.eventType,
            error: err instanceof Error ? err.message : String(err),
            timestamp: new Date().toISOString(),
          }),
        );
      });
  });
}

/**
 * T102: Query audit events with filters
 */
export interface AuditQueryFilters {
  from?: string;
  to?: string;
  eventType?: string;
  actorId?: string;
  cameraId?: string;
  sessionId?: string;
  sourceIp?: string;
  page?: number;
  perPage?: number;
}

export async function queryAuditEvents(
  tenantId: string,
  filters: AuditQueryFilters,
) {
  const page = filters.page ?? 1;
  const perPage = filters.perPage ?? 50;
  const offset = (page - 1) * perPage;

  const result = await withTenantContext(tenantId, async (tx) => {
    const conditions = [eq(auditEvents.tenantId, tenantId)];

    if (filters.from) {
      conditions.push(gte(auditEvents.timestamp, new Date(filters.from)));
    }
    if (filters.to) {
      conditions.push(lte(auditEvents.timestamp, new Date(filters.to)));
    }
    if (filters.eventType) {
      eq(auditEvents.eventType, filters.eventType);
      conditions.push(eq(auditEvents.eventType, filters.eventType));
    }
    if (filters.actorId) {
      conditions.push(eq(auditEvents.actorId, filters.actorId));
    }
    if (filters.cameraId) {
      conditions.push(eq(auditEvents.resourceId, filters.cameraId));
    }
    if (filters.sessionId) {
      conditions.push(eq(auditEvents.resourceId, filters.sessionId));
    }
    if (filters.sourceIp) {
      conditions.push(eq(auditEvents.sourceIp, filters.sourceIp));
    }

    const whereClause = and(...conditions);

    const [items, totalResult] = await Promise.all([
      tx
        .select()
        .from(auditEvents)
        .where(whereClause)
        .limit(perPage)
        .offset(offset)
        .orderBy(desc(auditEvents.timestamp)),
      tx.select({ count: count() }).from(auditEvents).where(whereClause),
    ]);

    return { items, total: totalResult[0]?.count ?? 0 };
  });

  return {
    items: result.items,
    total: result.total,
    page,
    perPage,
    totalPages: Math.ceil(result.total / perPage),
  };
}

/**
 * T102: Export audit events as CSV or JSON
 */
export async function exportAuditEvents(
  tenantId: string,
  filters: AuditQueryFilters,
  format: "csv" | "json",
): Promise<string> {
  // Fetch all matching events (no pagination for export)
  const allFilters = { ...filters, page: 1, perPage: 10000 };
  const result = await queryAuditEvents(tenantId, allFilters);

  if (format === "json") {
    return JSON.stringify(result.items, null, 2);
  }

  // CSV format
  const headers = [
    "id",
    "timestamp",
    "actor_type",
    "actor_id",
    "event_type",
    "resource_type",
    "resource_id",
    "source_ip",
    "details",
  ];
  const rows = result.items.map((e) =>
    [
      e.id,
      e.timestamp?.toISOString() ?? "",
      e.actorType,
      e.actorId ?? "",
      e.eventType,
      e.resourceType ?? "",
      e.resourceId ?? "",
      e.sourceIp ?? "",
      e.details ? JSON.stringify(e.details).replace(/"/g, '""') : "",
    ]
      .map((v) => `"${v}"`)
      .join(","),
  );

  return [headers.join(","), ...rows].join("\n");
}
