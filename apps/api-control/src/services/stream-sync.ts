/**
 * Stream Sync Service
 *
 * Periodically checks MediaMTX paths against DB camera status.
 * Auto-recovers cameras when MediaMTX restarts or paths are lost.
 */

import { eq, inArray } from "drizzle-orm";
import { db } from "../db/client";
import { cameras } from "../db/schema";
import { mediamtxFetch } from "../lib/mediamtx-fetch";
import { redis } from "../lib/redis";
import { setupCameraPipeline } from "./stream-pipeline";

const SYNC_INTERVAL = 30_000; // 30 seconds
const RECOVERY_COOLDOWN = 120_000; // 2 minutes cooldown before re-adding a failed path
const MAX_RECOVERY_ATTEMPTS = 5; // Max recovery attempts before giving up

let syncTimer: ReturnType<typeof setInterval> | null = null;
let syncing = false;

// Track recovery attempts per camera to prevent reconnect loops
const recoveryAttempts = new Map<string, { count: number; lastAttempt: number }>();

interface MediaMTXPath {
  name: string;
  ready: boolean;
  bytesReceived: number;
}

export function startStreamSync() {
  console.log(JSON.stringify({
    level: "info",
    service: "stream-sync",
    message: `Starting stream sync (every ${SYNC_INTERVAL / 1000}s)`,
  }));

  // Run immediately on startup
  syncStreams().catch(() => {});

  // Then run periodically
  syncTimer = setInterval(() => {
    syncStreams().catch((err) => {
      console.error(JSON.stringify({
        level: "error",
        service: "stream-sync",
        message: "Sync failed",
        error: err instanceof Error ? err.message : String(err),
      }));
    });
  }, SYNC_INTERVAL);
}

export function stopStreamSync() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
}

/** Reset recovery counter for a camera (e.g. after manual start) */
export function resetRecoveryAttempts(cameraId: string) {
  recoveryAttempts.delete(cameraId);
}

async function syncStreams() {
  if (syncing) return; // Prevent overlapping syncs
  syncing = true;

  try {
    // 1. Get all active cameras from DB (online, connecting, degraded, reconnecting)
    const activeCameras = await db
      .select()
      .from(cameras)
      .where(
        inArray(cameras.healthStatus, ["online", "connecting", "degraded", "reconnecting"]),
      );

    if (activeCameras.length === 0) {
      syncing = false;
      return;
    }

    // 2. Get all paths from MediaMTX
    let mediamtxPaths: MediaMTXPath[] = [];
    try {
      const res = await mediamtxFetch("/v3/paths/list");
      if (res.ok) {
        const data = (await res.json()) as { items?: MediaMTXPath[] };
        mediamtxPaths = data.items || [];
      } else {
        // MediaMTX unreachable — mark all as degraded
        console.warn(JSON.stringify({
          level: "warn",
          service: "stream-sync",
          message: "MediaMTX unreachable — skipping sync",
        }));
        syncing = false;
        return;
      }
    } catch {
      syncing = false;
      return;
    }

    const pathNames = new Set(mediamtxPaths.map((p) => p.name));
    const readyPaths = new Set(
      mediamtxPaths.filter((p) => p.ready).map((p) => p.name),
    );

    let recovered = 0;
    let updated = 0;

    for (const camera of activeCameras) {
      const pathName = `cam-${camera.id}`;

      // 3. Check if camera path exists in MediaMTX
      if (!pathNames.has(pathName)) {
        // Path missing — check cooldown before re-adding
        const recovery = recoveryAttempts.get(camera.id);
        const now = Date.now();

        if (recovery) {
          // Skip if within cooldown period
          if (now - recovery.lastAttempt < RECOVERY_COOLDOWN) {
            continue;
          }
          // Skip if max attempts exceeded — mark as offline
          if (recovery.count >= MAX_RECOVERY_ATTEMPTS) {
            if (camera.healthStatus !== "offline") {
              console.warn(JSON.stringify({
                level: "warn",
                service: "stream-sync",
                message: `Max recovery attempts (${MAX_RECOVERY_ATTEMPTS}) reached, marking offline`,
                cameraId: camera.id,
              }));
              await db
                .update(cameras)
                .set({ healthStatus: "offline", updatedAt: new Date() })
                .where(eq(cameras.id, camera.id));
              await redis.publish(
                "camera:health:state_change",
                JSON.stringify({
                  camera_id: camera.id,
                  tenant_id: camera.tenantId,
                  previous_state: camera.healthStatus,
                  new_state: "offline",
                  event: "camera.offline",
                  timestamp: new Date().toISOString(),
                }),
              );
            }
            continue;
          }
        }

        // Track this recovery attempt
        recoveryAttempts.set(camera.id, {
          count: (recovery?.count ?? 0) + 1,
          lastAttempt: now,
        });

        console.log(JSON.stringify({
          level: "info",
          service: "stream-sync",
          message: `Re-adding missing path: ${pathName} (attempt ${(recovery?.count ?? 0) + 1}/${MAX_RECOVERY_ATTEMPTS})`,
          cameraId: camera.id,
        }));

        try {
          // Use pipeline service — applies Stream Profile settings automatically
          const result = await setupCameraPipeline(
            camera.id,
            camera.tenantId,
            camera.rtspUrl,
          );

          if (result.success) {
            await db
              .update(cameras)
              .set({ healthStatus: "connecting", updatedAt: new Date() })
              .where(eq(cameras.id, camera.id));
            recovered++;
          } else {
            console.error(JSON.stringify({
              level: "error",
              service: "stream-sync",
              message: `Pipeline setup failed: ${result.error}`,
              cameraId: camera.id,
            }));
          }
        } catch (err) {
          console.error(JSON.stringify({
            level: "error",
            service: "stream-sync",
            message: `Failed to re-add path: ${pathName}`,
            error: err instanceof Error ? err.message : String(err),
          }));
        }
      } else if (readyPaths.has(pathName)) {
        // 4. Path exists and ready — ensure DB says "online"
        // Reset recovery counter on successful stream
        recoveryAttempts.delete(camera.id);

        if (camera.healthStatus !== "online") {
          await db
            .update(cameras)
            .set({ healthStatus: "online", updatedAt: new Date(), lastSeenAt: new Date() })
            .where(eq(cameras.id, camera.id));
          await redis.publish(
            "camera:health:state_change",
            JSON.stringify({
              camera_id: camera.id,
              tenant_id: camera.tenantId,
              previous_state: camera.healthStatus,
              new_state: "online",
              event: "camera.online",
              timestamp: new Date().toISOString(),
            }),
          );
          updated++;
        }
      } else {
        // 5. Path exists but not ready — keep as connecting
        if (camera.healthStatus === "online") {
          await db
            .update(cameras)
            .set({ healthStatus: "connecting", updatedAt: new Date() })
            .where(eq(cameras.id, camera.id));
          await redis.publish(
            "camera:health:state_change",
            JSON.stringify({
              camera_id: camera.id,
              tenant_id: camera.tenantId,
              previous_state: "online",
              new_state: "connecting",
              event: "camera.connecting",
              timestamp: new Date().toISOString(),
            }),
          );
          updated++;
        }
      }
    }

    // 6. Check for cameras marked "online" in DB but path not ready
    // (handles case where stream died but MediaMTX didn't remove path)
    if (recovered > 0 || updated > 0) {
      console.log(JSON.stringify({
        level: "info",
        service: "stream-sync",
        message: `Sync complete: ${recovered} recovered, ${updated} status updated, ${activeCameras.length} total active`,
      }));
    }
  } finally {
    syncing = false;
  }
}
