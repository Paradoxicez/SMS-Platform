import { eq, and } from "drizzle-orm";
import { db } from "../db/client";
import { forwardingRules } from "../db/schema";
import { logAuditEvent } from "./audit";
import { mediamtxFetch } from "../lib/mediamtx-fetch";

export interface ForwardingRule {
  id: string;
  cameraId: string;
  cameraName: string | null;
  tenantId: string;
  targetUrl: string;
  status: string;
  createdAt: Date;
}

/**
 * Add a forwarding rule: save to DB + configure MediaMTX path hook.
 */
export async function addRule(
  cameraId: string,
  cameraName: string,
  tenantId: string,
  targetUrl: string,
  userId?: string,
  sourceIp?: string,
): Promise<ForwardingRule> {
  // Insert into DB
  const [rule] = await db
    .insert(forwardingRules)
    .values({
      tenantId,
      cameraId,
      cameraName,
      targetUrl,
      status: "active",
    })
    .returning();

  // Configure MediaMTX to forward via runOnReady FFmpeg hook
  const pathName = `cam-${cameraId}`;
  const runOnReady = buildForwardingCommand(pathName, targetUrl);

  try {
    const res = await mediamtxFetch(
      `/v3/config/paths/patch/${encodeURIComponent(pathName)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runOnReady, runOnReadyRestart: true }),
      },
    );

    if (!res.ok) {
      // MediaMTX failed — mark rule as inactive in DB
      await db
        .update(forwardingRules)
        .set({ status: "inactive", updatedAt: new Date() })
        .where(eq(forwardingRules.id, rule!.id));

      console.error(
        `Failed to configure MediaMTX forwarding for ${pathName}: ${res.status}`,
      );
    }
  } catch (err) {
    await db
      .update(forwardingRules)
      .set({ status: "inactive", updatedAt: new Date() })
      .where(eq(forwardingRules.id, rule!.id));

    console.error(
      "Failed to configure MediaMTX forwarding:",
      err instanceof Error ? err.message : String(err),
    );
  }

  // Audit log
  logAuditEvent({
    tenantId,
    actorType: "user",
    actorId: userId,
    eventType: "forwarding.rule_created",
    resourceType: "forwarding_rule",
    resourceId: rule!.id,
    details: { cameraId, targetUrl },
    sourceIp,
  });

  return rule!;
}

/**
 * Remove a forwarding rule: delete from DB + remove MediaMTX hook.
 */
export async function removeRule(
  id: string,
  tenantId: string,
  userId?: string,
  sourceIp?: string,
): Promise<boolean> {
  const [rule] = await db
    .select()
    .from(forwardingRules)
    .where(and(eq(forwardingRules.id, id), eq(forwardingRules.tenantId, tenantId)))
    .limit(1);

  if (!rule) return false;

  // Remove runOnReady from MediaMTX path config
  const pathName = `cam-${rule.cameraId}`;
  try {
    await mediamtxFetch(
      `/v3/config/paths/patch/${encodeURIComponent(pathName)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runOnReady: "", runOnReadyRestart: false }),
      },
    );
  } catch {
    // Best effort cleanup
  }

  // Delete from DB
  await db
    .delete(forwardingRules)
    .where(eq(forwardingRules.id, id));

  // Audit log
  logAuditEvent({
    tenantId,
    actorType: "user",
    actorId: userId,
    eventType: "forwarding.rule_deleted",
    resourceType: "forwarding_rule",
    resourceId: id,
    details: { cameraId: rule.cameraId, targetUrl: rule.targetUrl },
    sourceIp,
  });

  return true;
}

/**
 * List forwarding rules for a tenant from DB.
 */
export async function listRules(tenantId: string): Promise<ForwardingRule[]> {
  return db
    .select()
    .from(forwardingRules)
    .where(eq(forwardingRules.tenantId, tenantId));
}

/**
 * Get active forwarding rules for a specific camera from DB.
 */
export async function getRulesForCamera(
  cameraId: string,
): Promise<ForwardingRule[]> {
  return db
    .select()
    .from(forwardingRules)
    .where(
      and(
        eq(forwardingRules.cameraId, cameraId),
        eq(forwardingRules.status, "active"),
      ),
    );
}

/**
 * Build the FFmpeg forwarding command for a camera path.
 */
function buildForwardingCommand(
  pathName: string,
  targetUrl: string,
): string {
  return `ffmpeg -i rtsp://localhost:8554/${pathName} -c copy -f flv ${targetUrl}`;
}

/**
 * Re-apply all active forwarding rules to MediaMTX.
 * Called on data-plane-worker startup to sync DB → MediaMTX.
 */
export async function syncForwardingRules(tenantId: string): Promise<{
  synced: number;
  failed: number;
}> {
  const rules = await db
    .select()
    .from(forwardingRules)
    .where(
      and(
        eq(forwardingRules.tenantId, tenantId),
        eq(forwardingRules.status, "active"),
      ),
    );

  let synced = 0;
  let failed = 0;

  for (const rule of rules) {
    const pathName = `cam-${rule.cameraId}`;
    const runOnReady = buildForwardingCommand(pathName, rule.targetUrl);

    try {
      const res = await mediamtxFetch(
        `/v3/config/paths/patch/${encodeURIComponent(pathName)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ runOnReady, runOnReadyRestart: true }),
        },
      );
      if (res.ok) synced++;
      else failed++;
    } catch {
      failed++;
    }
  }

  return { synced, failed };
}
