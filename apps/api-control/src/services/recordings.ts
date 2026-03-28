import { eq, and, gte, lte, lt, desc } from "drizzle-orm";
import { db, withTenantContext } from "../db/client";
import { recordings } from "../db/schema/recordings";
import { cameras } from "../db/schema";

/**
 * T291: Recordings / VOD service
 */

export async function enableRecording(
  cameraId: string,
  tenantId: string,
  retentionDays: number = 30,
  storageType: string = "local",
) {
  // Verify camera belongs to tenant
  const camera = await withTenantContext(tenantId, async (tx) => {
    return tx.query.cameras.findFirst({
      where: and(eq(cameras.id, cameraId), eq(cameras.tenantId, tenantId)),
    });
  });

  if (!camera) {
    throw new Error("Camera not found");
  }

  // Update camera metadata to indicate recording is enabled
  // In production, this would configure MediaMTX recording for the camera path
  await withTenantContext(tenantId, async (tx) => {
    await tx
      .update(cameras)
      .set({
        tags: [...((camera.tags as string[]) ?? []), "__recording_enabled"],
        updatedAt: new Date(),
      })
      .where(eq(cameras.id, cameraId));
  });

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

export async function listRecordings(
  cameraId: string,
  tenantId: string,
  from?: Date,
  to?: Date,
  page: number = 1,
  perPage: number = 20,
) {
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

    return tx
      .select()
      .from(recordings)
      .where(and(...conditions))
      .orderBy(desc(recordings.startTime))
      .limit(perPage)
      .offset((page - 1) * perPage);
  });
}

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

  // In production, this would issue a playback session for the VOD file
  return {
    recording_id: recordingId,
    playback_url: `/vod/${recording.filePath}`,
    expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
  };
}

export async function purgeExpired(tenantId: string) {
  const now = new Date();

  return withTenantContext(tenantId, async (tx) => {
    // Find recordings past retention
    const expired = await tx
      .select()
      .from(recordings)
      .where(
        and(
          eq(recordings.tenantId, tenantId),
          lt(recordings.startTime, new Date(now.getTime() - 30 * 24 * 3600 * 1000)),
        ),
      );

    for (const rec of expired) {
      const retentionMs = rec.retentionDays * 24 * 3600 * 1000;
      if (rec.startTime.getTime() + retentionMs < now.getTime()) {
        await tx.delete(recordings).where(eq(recordings.id, rec.id));
        // TODO: Also delete the physical file from storage
      }
    }

    return { purged: expired.length };
  });
}
