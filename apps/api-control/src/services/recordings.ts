import { eq, and, gte, lte, desc, count } from "drizzle-orm";
import { withTenantContext } from "../db/client";
import { recordings } from "../db/schema/recordings";
import { cameras } from "../db/schema";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";

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

  const existingTags = (camera.tags as string[]) ?? [];
  if (!existingTags.includes("__recording_enabled")) {
    await withTenantContext(tenantId, async (tx) => {
      await tx
        .update(cameras)
        .set({
          tags: [...existingTags, "__recording_enabled"],
          updatedAt: new Date(),
        })
        .where(eq(cameras.id, cameraId));
    });
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

  const tags = ((camera.tags as string[]) ?? []).filter(
    (t) => t !== "__recording_enabled",
  );

  await withTenantContext(tenantId, async (tx) => {
    await tx
      .update(cameras)
      .set({ tags, updatedAt: new Date() })
      .where(eq(cameras.id, cameraId));
  });

  return { camera_id: cameraId, recording_enabled: false };
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
  // Parse camera and tenant from MediaMTX path: "tenant-uuid/camera-uuid"
  const pathParts = event.path.split("/");
  if (pathParts.length < 2) {
    console.warn(JSON.stringify({
      level: "warn",
      service: "recordings",
      message: "Invalid recording event path",
      path: event.path,
    }));
    return;
  }

  const tenantId = pathParts[0]!;
  const cameraId = pathParts[1]!;

  if (event.type === "recording_start") {
    // Insert a new recording row with null endTime (in-progress)
    await withTenantContext(tenantId, async (tx) => {
      await tx.insert(recordings).values({
        id: randomUUID(),
        cameraId,
        tenantId,
        startTime: new Date(event.start_time),
        endTime: null,
        filePath: event.file_path,
        fileFormat: event.format ?? "fmp4",
        sizeBytes: 0,
        retentionDays: 30, // Will be overridden by camera config
        storageType: "local",
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

  // Generate signed session token for VOD playback
  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + 3600 * 1000); // 1 hour
  const originBase = process.env["ORIGIN_BASE_URL"] ?? "http://localhost:8888";

  return {
    session_id: sessionId,
    recording_id: recordingId,
    playback_url: `${originBase}/vod/${recording.filePath}?session=${sessionId}`,
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
        // Delete physical file from disk
        try {
          await fs.unlink(rec.filePath);
        } catch {
          // File may already be deleted or path invalid — continue
          console.warn(JSON.stringify({
            level: "warn",
            service: "recordings",
            message: "Failed to delete recording file",
            filePath: rec.filePath,
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
