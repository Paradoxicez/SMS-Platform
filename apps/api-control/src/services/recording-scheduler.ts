/**
 * Recording Scheduler Service
 *
 * Runs every 60 seconds. For cameras with recording mode "scheduled",
 * toggles MediaMTX record on/off based on configured time windows.
 */

import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { cameras } from "../db/schema";
import { resolveEffectiveConfig } from "./recording-config";
import { mediamtxFetch } from "../lib/mediamtx-fetch";
import { isWithinSchedule, type ScheduleWindow } from "../lib/recording-schedule";

const SYNC_INTERVAL = 60_000; // 1 minute
let syncTimer: ReturnType<typeof setInterval> | null = null;

// Track current state to avoid redundant PATCHes
const recordingState = new Map<string, boolean>();

export function startRecordingScheduler() {
  console.log(JSON.stringify({
    level: "info",
    service: "recording-scheduler",
    message: `Starting recording scheduler (every ${SYNC_INTERVAL / 1000}s)`,
  }));

  // Run immediately then periodically
  syncScheduledRecordings().catch(() => {});
  syncTimer = setInterval(() => {
    syncScheduledRecordings().catch((err) => {
      console.error(JSON.stringify({
        level: "error",
        service: "recording-scheduler",
        message: "Scheduler sync failed",
        error: err instanceof Error ? err.message : String(err),
      }));
    });
  }, SYNC_INTERVAL);
}

export function stopRecordingScheduler() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
}

async function syncScheduledRecordings() {
  // Find all cameras with recording enabled
  const activeCameras = await db
    .select({
      id: cameras.id,
      tenantId: cameras.tenantId,
      recordingEnabled: cameras.recordingEnabled,
    })
    .from(cameras)
    .where(eq(cameras.recordingEnabled, true));

  if (activeCameras.length === 0) return;

  let toggled = 0;

  for (const camera of activeCameras) {
    try {
      const config = await resolveEffectiveConfig(camera.tenantId, camera.id);

      // Only manage cameras in "scheduled" mode
      if (config.mode !== "scheduled") continue;

      const schedule = config.schedule as ScheduleWindow[] | null;
      const shouldRecord = isWithinSchedule(schedule);
      const pathName = `cam-${camera.id}`;

      // Check if state changed
      const previousState = recordingState.get(camera.id);
      if (previousState === shouldRecord) continue;

      // Toggle recording on MediaMTX
      const res = await mediamtxFetch(
        `/v3/config/paths/patch/${encodeURIComponent(pathName)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ record: shouldRecord }),
        },
      );

      if (res.ok) {
        recordingState.set(camera.id, shouldRecord);
        toggled++;
        console.log(JSON.stringify({
          level: "info",
          service: "recording-scheduler",
          message: `${shouldRecord ? "Started" : "Stopped"} recording for ${pathName}`,
          cameraId: camera.id,
        }));
      }
    } catch (err) {
      console.warn(JSON.stringify({
        level: "warn",
        service: "recording-scheduler",
        message: "Failed to sync scheduled recording",
        cameraId: camera.id,
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }

  if (toggled > 0) {
    console.log(JSON.stringify({
      level: "info",
      service: "recording-scheduler",
      message: `Scheduler sync: ${toggled} camera(s) toggled`,
    }));
  }
}
