import { eq, and, sql } from "drizzle-orm";
import { withTenantContext } from "../db/client";
import { streamProfiles, cameras } from "../db/schema";
import { logAuditEvent } from "./audit";
import { AppError } from "../middleware/error-handler";
import type { CreateStreamProfileInput, UpdateStreamProfileInput } from "@repo/types";

export async function createProfile(
  tenantId: string,
  data: CreateStreamProfileInput,
  actorId?: string,
  sourceIp?: string,
) {
  const [profile] = await withTenantContext(tenantId, async (tx) => {
    return tx
      .insert(streamProfiles)
      .values({
        tenantId,
        name: data.name,
        description: data.description ?? null,
        outputProtocol: data.output_protocol,
        audioMode: data.audio_mode,
        maxFramerate: data.max_framerate,
        outputResolution: data.output_resolution ?? "original",
        outputCodec: data.output_codec ?? "h264",
      })
      .returning();
  });

  logAuditEvent({
    tenantId,
    actorType: "user",
    actorId,
    eventType: "stream_profile.created",
    resourceType: "stream_profile",
    resourceId: profile!.id,
    details: { name: data.name },
    sourceIp,
  });

  return profile!;
}

export async function listProfiles(tenantId: string) {
  return withTenantContext(tenantId, async (tx) => {
    return tx
      .select()
      .from(streamProfiles)
      .where(eq(streamProfiles.tenantId, tenantId))
      .orderBy(streamProfiles.createdAt);
  });
}

export async function getProfile(id: string, tenantId: string) {
  const profile = await withTenantContext(tenantId, async (tx) => {
    return tx.query.streamProfiles.findFirst({
      where: and(eq(streamProfiles.id, id), eq(streamProfiles.tenantId, tenantId)),
    });
  });

  if (!profile) {
    throw new AppError("NOT_FOUND", "Stream profile not found", 404);
  }

  return profile;
}

export async function updateProfile(
  id: string,
  tenantId: string,
  data: UpdateStreamProfileInput,
  actorId?: string,
  sourceIp?: string,
) {
  const { version, ...updateFields } = data;

  const updateData: Record<string, unknown> = {};
  if (updateFields.name !== undefined) updateData.name = updateFields.name;
  if (updateFields.description !== undefined) updateData.description = updateFields.description;
  if (updateFields.output_protocol !== undefined) updateData.outputProtocol = updateFields.output_protocol;
  if (updateFields.audio_mode !== undefined) updateData.audioMode = updateFields.audio_mode;
  if (updateFields.max_framerate !== undefined) updateData.maxFramerate = updateFields.max_framerate;
  if (updateFields.output_resolution !== undefined) updateData.outputResolution = updateFields.output_resolution;
  if (updateFields.output_codec !== undefined) updateData.outputCodec = updateFields.output_codec;
  if (updateFields.is_default !== undefined) updateData.isDefault = updateFields.is_default;
  updateData.updatedAt = new Date();
  updateData.version = sql`${streamProfiles.version} + 1`;

  const [profile] = await withTenantContext(tenantId, async (tx) => {
    return tx
      .update(streamProfiles)
      .set(updateData)
      .where(
        and(
          eq(streamProfiles.id, id),
          eq(streamProfiles.tenantId, tenantId),
          eq(streamProfiles.version, version),
        ),
      )
      .returning();
  });

  if (!profile) {
    const existing = await withTenantContext(tenantId, async (tx) => {
      return tx.query.streamProfiles.findFirst({
        where: and(eq(streamProfiles.id, id), eq(streamProfiles.tenantId, tenantId)),
      });
    });

    if (!existing) {
      throw new AppError("NOT_FOUND", "Stream profile not found", 404);
    }
    throw new AppError(
      "CONFLICT",
      "Stream profile was modified by another request. Please refresh and try again.",
      409,
    );
  }

  logAuditEvent({
    tenantId,
    actorType: "user",
    actorId,
    eventType: "stream_profile.updated",
    resourceType: "stream_profile",
    resourceId: profile.id,
    details: updateFields,
    sourceIp,
  });

  // Trigger propagation to cameras using this profile
  propagateProfileChanges(profile.id, tenantId).catch((err) => {
    console.error(
      JSON.stringify({
        level: "error",
        service: "stream-profiles",
        message: "Failed to propagate profile changes",
        profileId: profile.id,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  });

  return profile;
}

export async function deleteProfile(
  id: string,
  tenantId: string,
  actorId?: string,
  sourceIp?: string,
) {
  const profile = await getProfile(id, tenantId);

  if (profile.isDefault) {
    throw new AppError(
      "CONFLICT",
      "Cannot delete the default stream profile",
      409,
    );
  }

  // Check if any cameras are using this profile; reassign them to default
  const camerasUsingProfile = await getCamerasUsingProfile(id, tenantId);
  if (camerasUsingProfile.length > 0) {
    const defaultProfile = await getDefaultProfile(tenantId);
    await withTenantContext(tenantId, async (tx) => {
      await tx
        .update(cameras)
        .set({ profileId: defaultProfile.id, updatedAt: new Date() })
        .where(and(eq(cameras.profileId, id), eq(cameras.tenantId, tenantId)));
    });
  }

  const [deleted] = await withTenantContext(tenantId, async (tx) => {
    return tx
      .delete(streamProfiles)
      .where(and(eq(streamProfiles.id, id), eq(streamProfiles.tenantId, tenantId)))
      .returning();
  });

  if (!deleted) {
    throw new AppError("NOT_FOUND", "Stream profile not found", 404);
  }

  logAuditEvent({
    tenantId,
    actorType: "user",
    actorId,
    eventType: "stream_profile.deleted",
    resourceType: "stream_profile",
    resourceId: deleted.id,
    sourceIp,
  });

  return deleted;
}

export async function cloneProfile(
  id: string,
  tenantId: string,
  actorId?: string,
  sourceIp?: string,
) {
  const original = await getProfile(id, tenantId);

  const [cloned] = await withTenantContext(tenantId, async (tx) => {
    return tx
      .insert(streamProfiles)
      .values({
        tenantId,
        name: `${original.name} (Copy)`,
        description: original.description,
        outputProtocol: original.outputProtocol,
        audioMode: original.audioMode,
        maxFramerate: original.maxFramerate,
        outputResolution: original.outputResolution,
        outputCodec: original.outputCodec,
        isDefault: false,
      })
      .returning();
  });

  logAuditEvent({
    tenantId,
    actorType: "user",
    actorId,
    eventType: "stream_profile.cloned",
    resourceType: "stream_profile",
    resourceId: cloned!.id,
    details: { cloned_from: id },
    sourceIp,
  });

  return cloned!;
}

export async function getDefaultProfile(tenantId: string) {
  const profile = await withTenantContext(tenantId, async (tx) => {
    return tx.query.streamProfiles.findFirst({
      where: and(
        eq(streamProfiles.tenantId, tenantId),
        eq(streamProfiles.isDefault, true),
      ),
    });
  });

  if (profile) {
    return profile;
  }

  // Create a default profile if none exists
  const [created] = await withTenantContext(tenantId, async (tx) => {
    return tx
      .insert(streamProfiles)
      .values({
        tenantId,
        name: "Default",
        description: "Standard output — HLS, audio included, original framerate",
        outputProtocol: "hls",
        audioMode: "include",
        maxFramerate: 0,
        outputResolution: "original",
        outputCodec: "h264",
        isDefault: true,
      })
      .returning();
  });

  return created!;
}

export async function getEffectiveProfile(cameraId: string, tenantId: string) {
  const camera = await withTenantContext(tenantId, async (tx) => {
    return tx.query.cameras.findFirst({
      where: and(eq(cameras.id, cameraId), eq(cameras.tenantId, tenantId)),
    });
  });

  if (!camera) {
    throw new AppError("NOT_FOUND", "Camera not found", 404);
  }

  if (camera.profileId) {
    const profile = await withTenantContext(tenantId, async (tx) => {
      return tx.query.streamProfiles.findFirst({
        where: and(
          eq(streamProfiles.id, camera.profileId!),
          eq(streamProfiles.tenantId, tenantId),
        ),
      });
    });

    if (profile) {
      return profile;
    }
  }

  // Fall back to tenant default profile
  return getDefaultProfile(tenantId);
}

export async function getCamerasUsingProfile(profileId: string, tenantId: string) {
  return withTenantContext(tenantId, async (tx) => {
    return tx
      .select()
      .from(cameras)
      .where(
        and(eq(cameras.profileId, profileId), eq(cameras.tenantId, tenantId)),
      );
  });
}

export async function propagateProfileChanges(profileId: string, tenantId: string) {
  const { updateCameraPipeline } = await import("./stream-pipeline");
  const camerasUsingProfile = await getCamerasUsingProfile(profileId, tenantId);

  let updated = 0;
  for (const camera of camerasUsingProfile) {
    try {
      const result = await updateCameraPipeline(camera.id, tenantId);
      if (result.success) updated++;
    } catch (err) {
      console.error(
        JSON.stringify({
          level: "error",
          service: "stream-profiles",
          message: "Failed to update camera pipeline",
          cameraId: camera.id,
          profileId,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }

  console.log(JSON.stringify({
    level: "info",
    service: "stream-profiles",
    message: `Profile ${profileId} propagated to ${updated}/${camerasUsingProfile.length} cameras`,
  }));
}
