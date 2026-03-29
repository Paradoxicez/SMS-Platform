import { eq, and, gte, lte, desc, count } from "drizzle-orm";
import { withTenantContext } from "../db/client";
import { recordings } from "../db/schema/recordings";
import { cameras } from "../db/schema";
import { randomUUID } from "node:crypto";
import { getStorageProvider, type S3Config } from "../lib/recording-storage";
import { isWithinSchedule, type ScheduleWindow } from "../lib/recording-schedule";
import { resolveEffectiveConfig } from "./recording-config";
import { mediamtxFetch } from "../lib/mediamtx-fetch";

// ─── Enable / Disable ───────────────────────────────────────────────────────

export async function enableRecording(
  cameraId: string,
  tenantId: string,
  retentionDays: number = 30,
  storageType: string = "local",
) {
  const camera = await withTenantContext(tenantId, async (tx) => {
    return tx.query.cameras.findFirst({
      where: and(eq(cameras.id, cameraId), eq(cameras.tenantId, tenantId)),
    });
  });

  if (!camera) {
    throw new Error("Camera not found");
  }

  if (!camera.recordingEnabled) {
    await withTenantContext(tenantId, async (tx) => {
      await tx
        .update(cameras)
        .set({ recordingEnabled: true, updatedAt: new Date() })
        .where(eq(cameras.id, cameraId));
    });
  }

  // Configure MediaMTX to start recording on this camera's path
  const pathName = `cam-${cameraId}`;
  try {
    const mtxRes = await mediamtxFetch(`/v3/config/paths/patch/${pathName}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        record: true,
        recordPath: `./recordings/%path/%Y-%m-%d_%H-%M-%S-%f`,
        recordFormat: "fmp4",
        runOnRecordSegmentCreate: "/on-record-segment.sh recording_start",
        runOnRecordSegmentComplete: "/on-record-segment.sh recording_end",
      }),
    });
    if (!mtxRes.ok) {
      const errText = await mtxRes.text().catch(() => "");
      console.error(JSON.stringify({
        level: "error",
        service: "recordings",
        message: `MediaMTX PATCH failed: ${mtxRes.status} ${errText}`,
        cameraId,
        pathName,
      }));
    }
    console.log(JSON.stringify({
      level: "info",
      service: "recordings",
      message: "MediaMTX recording enabled",
      cameraId,
      pathName,
    }));
  } catch (err) {
    console.error(JSON.stringify({
      level: "error",
      service: "recordings",
      message: "Failed to enable recording on MediaMTX",
      cameraId,
      error: err instanceof Error ? err.message : String(err),
    }));
  }

  return {
    camera_id: cameraId,
    recording_enabled: true,
    retention_days: retentionDays,
    storage_type: storageType,
  };
}

export async function disableRecording(cameraId: string, tenantId: string) {
  const camera = await withTenantContext(tenantId, async (tx) => {
    return tx.query.cameras.findFirst({
      where: and(eq(cameras.id, cameraId), eq(cameras.tenantId, tenantId)),
    });
  });

  if (!camera) {
    throw new Error("Camera not found");
  }

  await withTenantContext(tenantId, async (tx) => {
    await tx
      .update(cameras)
      .set({ recordingEnabled: false, updatedAt: new Date() })
      .where(eq(cameras.id, cameraId));
  });

  // Tell MediaMTX to stop recording on this camera's path
  const pathName = `cam-${cameraId}`;
  try {
    await mediamtxFetch(`/v3/config/paths/patch/${pathName}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ record: false }),
    });
    console.log(JSON.stringify({
      level: "info",
      service: "recordings",
      message: "MediaMTX recording disabled",
      cameraId,
      pathName,
    }));
  } catch (err) {
    console.error(JSON.stringify({
      level: "error",
      service: "recordings",
      message: "Failed to disable recording on MediaMTX",
      cameraId,
      error: err instanceof Error ? err.message : String(err),
    }));
  }

  return { camera_id: cameraId, recording_enabled: false };
}

// ─── Sync Config to MediaMTX ────────────────────────────────────────────────

/**
 * Sync recording config to MediaMTX for affected cameras.
 * Called after saving recording config (global/site/project/camera scope).
 *
 * For camera scope: update that camera's MediaMTX path.
 * For global/site/project: update all cameras with recording_enabled = true.
 */
export async function syncConfigToMediaMTX(
  tenantId: string,
  scopeType: string,
  scopeId?: string,
): Promise<{ synced: number }> {
  // Find cameras to update
  let cameraIds: string[] = [];

  if (scopeType === "camera" && scopeId) {
    cameraIds = [scopeId];
  } else {
    // For global/site/project: find all cameras with recording enabled
    const allCameras = await withTenantContext(tenantId, async (tx) => {
      return tx.select({ id: cameras.id }).from(cameras).where(and(eq(cameras.tenantId, tenantId), eq(cameras.recordingEnabled, true)));
    });
    cameraIds = allCameras.map((c) => c.id);
  }

  let synced = 0;

  for (const cameraId of cameraIds) {
    const config = await resolveEffectiveConfig(tenantId, cameraId);

    const pathName = `cam-${cameraId}`;
    const retentionHours = config.retentionDays * 24;
    const retentionStr = `${retentionHours}h0m0s`; // MediaMTX Go duration format

    try {
      await mediamtxFetch(`/v3/config/paths/patch/${pathName}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          record: config.enabled,
          recordFormat: "fmp4", // MediaMTX only supports fmp4
          recordDeleteAfter: retentionStr,
          recordSegmentDuration: `${config.segmentDurationMinutes ?? 60}m0s`,
          recordPath: `./recordings/%path/%Y-%m-%d_%H-%M-%S-%f`,
        }),
      });
      synced++;
    } catch (err) {
      console.warn(JSON.stringify({
        level: "warn",
        service: "recordings",
        message: "Failed to sync config to MediaMTX",
        cameraId,
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }

  console.log(JSON.stringify({
    level: "info",
    service: "recordings",
    message: `Synced recording config to MediaMTX for ${synced} camera(s)`,
    scopeType,
    scopeId,
  }));

  return { synced };
}

// ─── Event-Based Recording Trigger ──────────────────────────────────────────

export interface EventRecordingTrigger {
  camera_id: string;
  tenant_id: string;
  event_type: string; // "motion_detected", "person_detected", etc.
  duration_seconds?: number; // How long to record (default: 60)
  source?: string; // AI integration name
}

/**
 * Trigger recording for a camera based on an external event (e.g., motion detection).
 * Only works if the camera's recording mode is "event_based".
 * Returns the path that MediaMTX should record to.
 */
export async function triggerEventRecording(
  trigger: EventRecordingTrigger,
): Promise<{ triggered: boolean; reason?: string; record_path?: string }> {
  const config = await resolveEffectiveConfig(trigger.tenant_id, trigger.camera_id);

  if (config.mode !== "event_based") {
    return { triggered: false, reason: "Camera recording mode is not event_based" };
  }

  if (!config.enabled) {
    return { triggered: false, reason: "Recording is disabled for this camera" };
  }

  const durationSec = trigger.duration_seconds ?? 60;
  const recordPath = `${trigger.tenant_id}/${trigger.camera_id}/events/${Date.now()}`;

  console.log(JSON.stringify({
    level: "info",
    service: "recordings",
    message: "Event-based recording triggered",
    cameraId: trigger.camera_id,
    eventType: trigger.event_type,
    durationSec,
    source: trigger.source,
    recordPath,
  }));

  // NOTE: In production, this would send a command to MediaMTX to start recording
  // for the specified duration. The recording start/end events will flow back
  // through the webhook (handleRecordingEvent) to populate the DB.

  return {
    triggered: true,
    record_path: recordPath,
  };
}

// ─── Recording Webhook (from MediaMTX) ─────────────────────────────────────

export interface RecordingEvent {
  type: "recording_start" | "recording_end";
  path: string; // MediaMTX path name (e.g., "tenant-uuid/camera-uuid")
  file_path: string; // Actual file path on disk
  start_time: string; // ISO 8601
  end_time?: string; // ISO 8601 (only on recording_end)
  file_size?: number; // bytes (only on recording_end)
  format?: string; // e.g., "fmp4"
}

/**
 * Handle recording events from MediaMTX webhook.
 * Called by the internal webhook endpoint.
 */
export async function handleRecordingEvent(event: RecordingEvent): Promise<void> {
  let tenantId: string;
  let cameraId: string;

  // Parse path — supports 2 formats:
  // Format 1: "tenant-uuid/camera-uuid" (from manual webhook)
  // Format 2: "cam-{camera-uuid}" (from MediaMTX runOnRecordSegment)
  const pathParts = event.path.split("/");
  if (pathParts.length >= 2) {
    tenantId = pathParts[0]!;
    cameraId = pathParts[1]!;
  } else if (event.path.startsWith("cam-")) {
    cameraId = event.path.replace("cam-", "");
    // Lookup tenant from camera (direct DB query, no tenant context needed)
    const { db: rawDb } = await import("../db/client");
    const [camera] = await rawDb.select({ tenantId: cameras.tenantId }).from(cameras).where(eq(cameras.id, cameraId)).limit(1);
    if (!camera) {
      console.warn(JSON.stringify({
        level: "warn",
        service: "recordings",
        message: "Camera not found for recording event",
        path: event.path,
        cameraId,
      }));
      return;
    }
    tenantId = camera.tenantId;
  } else {
    console.warn(JSON.stringify({
      level: "warn",
      service: "recordings",
      message: "Invalid recording event path",
      path: event.path,
    }));
    return;
  }

  // Resolve effective recording config for schedule + retention
  const config = await resolveEffectiveConfig(tenantId, cameraId);

  if (event.type === "recording_start") {
    // Check schedule — skip if mode=scheduled and outside time window
    if (config.mode === "scheduled") {
      const schedule = config.schedule as ScheduleWindow[] | null;
      if (!isWithinSchedule(schedule)) {
        console.log(JSON.stringify({
          level: "info",
          service: "recordings",
          message: "Recording skipped — outside scheduled window",
          cameraId,
          mode: config.mode,
        }));
        return;
      }
    }

    // Insert a new recording row with null endTime (in-progress)
    await withTenantContext(tenantId, async (tx) => {
      await tx.insert(recordings).values({
        id: randomUUID(),
        cameraId,
        tenantId,
        startTime: new Date(event.start_time),
        endTime: null,
        filePath: event.file_path,
        fileFormat: config.format ?? event.format ?? "fmp4",
        sizeBytes: 0,
        retentionDays: config.retentionDays,
        storageType: config.storageType,
      });
    });

    console.log(JSON.stringify({
      level: "info",
      service: "recordings",
      message: "Recording started",
      cameraId,
      filePath: event.file_path,
    }));
  } else if (event.type === "recording_end") {
    // Update the recording with endTime and file size
    await withTenantContext(tenantId, async (tx) => {
      await tx
        .update(recordings)
        .set({
          endTime: event.end_time ? new Date(event.end_time) : new Date(),
          sizeBytes: event.file_size ?? 0,
        })
        .where(
          and(
            eq(recordings.filePath, event.file_path),
            eq(recordings.tenantId, tenantId),
          ),
        );
    });

    console.log(JSON.stringify({
      level: "info",
      service: "recordings",
      message: "Recording ended",
      cameraId,
      filePath: event.file_path,
      sizeBytes: event.file_size,
    }));
  }
}

// ─── List Recordings (with pagination metadata) ─────────────────────────────

export async function listRecordings(
  cameraId: string,
  tenantId: string,
  from?: Date,
  to?: Date,
  page: number = 1,
  perPage: number = 20,
): Promise<{ items: (typeof recordings.$inferSelect)[]; total: number }> {
  return withTenantContext(tenantId, async (tx) => {
    const conditions = [
      eq(recordings.cameraId, cameraId),
      eq(recordings.tenantId, tenantId),
    ];

    if (from) {
      conditions.push(gte(recordings.startTime, from));
    }
    if (to) {
      conditions.push(lte(recordings.startTime, to));
    }

    const whereClause = and(...conditions);

    const [items, [countResult]] = await Promise.all([
      tx
        .select()
        .from(recordings)
        .where(whereClause)
        .orderBy(desc(recordings.startTime))
        .limit(perPage)
        .offset((page - 1) * perPage),
      tx
        .select({ value: count() })
        .from(recordings)
        .where(whereClause),
    ]);

    return {
      items,
      total: countResult?.value ?? 0,
    };
  });
}

// ─── VOD Playback Session ───────────────────────────────────────────────────

/**
 * Create a signed VOD playback session for a recording.
 * Generates a time-limited URL that proxies through the origin server.
 */
export async function createVodSession(
  recordingId: string,
  tenantId: string,
) {
  const recording = await withTenantContext(tenantId, async (tx) => {
    return tx.query.recordings.findFirst({
      where: and(
        eq(recordings.id, recordingId),
        eq(recordings.tenantId, tenantId),
      ),
    });
  });

  if (!recording) {
    throw new Error("Recording not found");
  }

  // Generate signed playback URL based on storage type
  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + 3600 * 1000); // 1 hour
  const expiresInSec = 3600;

  let playbackUrl: string;

  if (recording.storageType === "s3" && recording.s3Key && recording.s3Bucket) {
    // S3: generate pre-signed URL
    const s3Config: S3Config = {
      bucket: recording.s3Bucket,
      region: process.env["S3_REGION"] ?? "us-east-1",
      endpoint: process.env["S3_ENDPOINT"],
      accessKey: process.env["S3_ACCESS_KEY"] ?? "",
      secretKey: process.env["S3_SECRET_KEY"] ?? "",
    };
    const storage = getStorageProvider("s3", s3Config);
    playbackUrl = await storage.getSignedUrl(recording.s3Key, expiresInSec);
  } else {
    // Local: use origin base URL
    const storage = getStorageProvider("local");
    playbackUrl = await storage.getSignedUrl(recording.filePath, expiresInSec);
  }

  return {
    session_id: sessionId,
    recording_id: recordingId,
    playback_url: playbackUrl,
    storage_type: recording.storageType,
    format: recording.fileFormat,
    duration_ms: recording.endTime
      ? recording.endTime.getTime() - recording.startTime.getTime()
      : null,
    file_size: Number(recording.sizeBytes),
    expires_at: expiresAt.toISOString(),
  };
}

// ─── Purge Expired Recordings ───────────────────────────────────────────────

/**
 * Delete a single recording by ID (DB record + file).
 */
export async function deleteRecording(recordingId: string, tenantId: string): Promise<void> {
  const rec = await withTenantContext(tenantId, async (tx) => {
    return tx.query.recordings.findFirst({
      where: and(eq(recordings.id, recordingId), eq(recordings.tenantId, tenantId)),
    });
  });

  if (!rec) {
    throw new Error("Recording not found");
  }

  // Delete file from storage
  try {
    if (rec.storageType === "s3" && rec.s3Key && rec.s3Bucket) {
      const s3Config: S3Config = {
        bucket: rec.s3Bucket,
        region: process.env["S3_REGION"] ?? "us-east-1",
        endpoint: process.env["S3_ENDPOINT"],
        accessKey: process.env["S3_ACCESS_KEY"] ?? "",
        secretKey: process.env["S3_SECRET_KEY"] ?? "",
      };
      const storage = getStorageProvider("s3", s3Config);
      await storage.delete(rec.s3Key);
    } else {
      const storage = getStorageProvider("local");
      await storage.delete(rec.filePath);
    }
  } catch {
    console.warn(JSON.stringify({
      level: "warn",
      service: "recordings",
      message: "Failed to delete recording file",
      recordingId,
      filePath: rec.filePath,
    }));
  }

  // Delete DB record
  await withTenantContext(tenantId, async (tx) => {
    await tx.delete(recordings).where(eq(recordings.id, recordingId));
  });

  console.log(JSON.stringify({
    level: "info",
    service: "recordings",
    message: "Recording deleted",
    recordingId,
    filePath: rec.filePath,
  }));
}

/**
 * Delete recordings past their retention period.
 * Also removes physical files from disk.
 */
export async function purgeExpired(tenantId: string) {
  const now = new Date();

  return withTenantContext(tenantId, async (tx) => {
    // Find recordings that have exceeded their retention window
    const allRecordings = await tx
      .select()
      .from(recordings)
      .where(eq(recordings.tenantId, tenantId));

    let purgedCount = 0;

    for (const rec of allRecordings) {
      const retentionMs = rec.retentionDays * 24 * 3600 * 1000;
      if (rec.startTime.getTime() + retentionMs < now.getTime()) {
        // Delete file from storage (local or S3)
        try {
          if (rec.storageType === "s3" && rec.s3Key && rec.s3Bucket) {
            const s3Config: S3Config = {
              bucket: rec.s3Bucket,
              region: process.env["S3_REGION"] ?? "us-east-1",
              endpoint: process.env["S3_ENDPOINT"],
              accessKey: process.env["S3_ACCESS_KEY"] ?? "",
              secretKey: process.env["S3_SECRET_KEY"] ?? "",
            };
            const storage = getStorageProvider("s3", s3Config);
            await storage.delete(rec.s3Key);
          } else {
            const storage = getStorageProvider("local");
            await storage.delete(rec.filePath);
          }
        } catch {
          console.warn(JSON.stringify({
            level: "warn",
            service: "recordings",
            message: "Failed to delete recording file",
            filePath: rec.filePath,
            storageType: rec.storageType,
          }));
        }

        // Delete DB record
        await tx.delete(recordings).where(eq(recordings.id, rec.id));
        purgedCount++;
      }
    }

    if (purgedCount > 0) {
      console.log(JSON.stringify({
        level: "info",
        service: "recordings",
        message: `Purged ${purgedCount} expired recording(s)`,
        tenantId,
      }));
    }

    return { purged: purgedCount };
  });
}
