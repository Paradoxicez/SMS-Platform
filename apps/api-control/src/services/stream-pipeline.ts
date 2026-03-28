/**
 * Stream Pipeline Service
 *
 * Builds FFmpeg commands from Stream Profile settings and manages
 * MediaMTX paths (add/remove/update) for cameras.
 */

import { eq, and } from "drizzle-orm";
import { db } from "../db/client";
import { cameras, streamProfiles } from "../db/schema";
import { mediamtxFetch } from "../lib/mediamtx-fetch";

const RESOLUTION_MAP: Record<string, string> = {
  "2160p": "3840:2160",
  "1440p": "2560:1440",
  "1080p": "1920:1080",
  "720p": "1280:720",
  "480p": "854:480",
  "360p": "640:360",
  "240p": "426:240",
};

interface ProfileSettings {
  outputProtocol: string;
  audioMode: string;
  maxFramerate: number;
  outputResolution: string;
  outputCodec: string;
  keyframeInterval: number;
}

/**
 * Get the effective profile settings for a camera.
 * Camera profile → Site default → Tenant default → system defaults.
 */
export async function getCameraProfileSettings(
  cameraId: string,
  tenantId: string,
): Promise<ProfileSettings> {
  // Get camera's assigned profile
  const camera = await db.query.cameras.findFirst({
    where: and(eq(cameras.id, cameraId), eq(cameras.tenantId, tenantId)),
  });

  if (camera?.profileId) {
    const profile = await db.query.streamProfiles.findFirst({
      where: eq(streamProfiles.id, camera.profileId),
    });
    if (profile) {
      return {
        outputProtocol: profile.outputProtocol,
        audioMode: profile.audioMode,
        maxFramerate: profile.maxFramerate,
        outputResolution: profile.outputResolution ?? "original",
        outputCodec: profile.outputCodec ?? "h264",
        keyframeInterval: profile.keyframeInterval ?? 2,
      };
    }
  }

  // Fallback: tenant default profile
  const defaultProfile = await db.query.streamProfiles.findFirst({
    where: and(
      eq(streamProfiles.tenantId, tenantId),
      eq(streamProfiles.isDefault, true),
    ),
  });

  if (defaultProfile) {
    return {
      outputProtocol: defaultProfile.outputProtocol,
      audioMode: defaultProfile.audioMode,
      maxFramerate: defaultProfile.maxFramerate,
      outputResolution: defaultProfile.outputResolution ?? "original",
      outputCodec: defaultProfile.outputCodec ?? "h264",
      keyframeInterval: defaultProfile.keyframeInterval ?? 2,
    };
  }

  // System defaults
  return {
    outputProtocol: "hls",
    audioMode: "include",
    maxFramerate: 0,
    outputResolution: "original",
    outputCodec: "h264",
    keyframeInterval: 2,
  };
}

/**
 * Build FFmpeg command based on profile settings.
 * Returns null if no transcoding needed (passthrough mode).
 */
export function buildFfmpegCommand(
  inputPath: string,
  outputPath: string,
  profile: ProfileSettings,
): string | null {
  const codec = profile.outputCodec ?? "h264";

  // Passthrough: no FFmpeg needed — stream goes directly to viewer via WebRTC
  if (codec === "passthrough") {
    return null;
  }

  const needsResolution =
    profile.outputResolution !== "original" &&
    RESOLUTION_MAP[profile.outputResolution];
  const needsFramerate = profile.maxFramerate > 0;

  // Copy mode: repackage without transcoding
  // If resolution or framerate changes are requested, auto-fallback to h264
  const useCopy = codec === "copy" && !needsResolution && !needsFramerate;

  if (codec === "copy" && (needsResolution || needsFramerate)) {
    console.log(JSON.stringify({
      level: "warn",
      service: "stream-pipeline",
      message: `Codec "copy" requested but resolution/framerate changes needed — falling back to h264 transcode`,
      inputPath,
    }));
  }

  const args: string[] = [
    "ffmpeg",
    "-i", `rtsp://localhost:8554/${inputPath}`,
  ];

  if (useCopy) {
    args.push("-c:v", "copy");
  } else {
    // h264 transcode (default) or copy-fallback
    args.push("-c:v", "libx264");
    args.push("-preset", "ultrafast");
    args.push("-tune", "zerolatency");
    // Force keyframe at configured interval so HLS can cut segments properly
    // Without this, segments wait for camera's native GOP (often 10-20s on CCTV)
    const fps = needsFramerate ? profile.maxFramerate : 15;
    const gopSize = fps * (profile.keyframeInterval || 2);
    args.push("-g", String(gopSize));
    args.push("-keyint_min", String(gopSize));
  }

  // Bitrate — adjust based on resolution (only for transcode, not copy)
  if (!useCopy) {
    if (needsResolution) {
      const res = profile.outputResolution;
      const bitrateMap: Record<string, string> = {
        "2160p": "6000k", "1440p": "4000k", "1080p": "2000k",
        "720p": "1500k", "480p": "800k", "360p": "500k", "240p": "300k",
      };
      args.push("-b:v", bitrateMap[res] ?? "1500k");
    } else {
      args.push("-b:v", "2000k");
    }
  }

  // Resolution scaling — use simple scale without min() to avoid shell quoting issues
  if (needsResolution && !useCopy) {
    const scale = RESOLUTION_MAP[profile.outputResolution];
    args.push("-vf", `scale=${scale}:force_original_aspect_ratio=decrease`);
  }

  // Framerate
  if (needsFramerate && !useCopy) {
    args.push("-r", String(profile.maxFramerate));
  }

  // Audio
  if (profile.audioMode === "strip") {
    args.push("-an");
  } else if (profile.audioMode === "mute") {
    args.push("-af", "volume=0");
  } else if (useCopy) {
    // Copy audio as-is in copy mode
    args.push("-c:a", "copy");
  } else {
    // Include audio — but camera might have unsupported codec (G711)
    // Transcode to AAC for HLS compatibility
    args.push("-c:a", "aac", "-b:a", "128k");
  }

  // Output
  args.push("-f", "rtsp");
  args.push(`rtsp://publisher:publisher_secret@localhost:8554/${outputPath}`);

  return args.join(" ");
}

/**
 * Setup complete streaming pipeline for a camera:
 * 1. Add RTSP source path (cam-{id})
 * 2. Add HLS output path (cam-{id}-hls)
 * 3. Set FFmpeg transcode hook based on profile
 */
export async function setupCameraPipeline(
  cameraId: string,
  tenantId: string,
  rtspUrl: string,
): Promise<{ success: boolean; error?: string }> {
  const pathName = `cam-${cameraId}`;
  const hlsPathName = `${pathName}-hls`;

  // Get profile settings
  const profile = await getCameraProfileSettings(cameraId, tenantId);
  const ffmpegCmd = buildFfmpegCommand(pathName, hlsPathName, profile);

  const isPassthroughWebrtc =
    profile.outputCodec === "passthrough" && profile.outputProtocol === "webrtc";

  console.log(JSON.stringify({
    level: "info",
    service: "stream-pipeline",
    message: `Setting up pipeline for ${pathName}`,
    profile: {
      protocol: profile.outputProtocol,
      audio: profile.audioMode,
      resolution: profile.outputResolution,
      fps: profile.maxFramerate,
      codec: profile.outputCodec,
    },
  }));

  try {
    // 1. Add RTSP source path
    const addRes = await mediamtxFetch(
      `/v3/config/paths/add/${encodeURIComponent(pathName)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: rtspUrl,
          sourceProtocol: "tcp",
          sourceOnDemand: false,
        }),
      },
    );

    if (!addRes.ok) {
      const body = await addRes.text();
      // Path might already exist — try patching instead
      if (body.includes("already exists")) {
        await mediamtxFetch(
          `/v3/config/paths/patch/${encodeURIComponent(pathName)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              source: rtspUrl,
              sourceProtocol: "tcp",
              sourceOnDemand: false,
            }),
          },
        );
      } else {
        return { success: false, error: `Add path failed: ${body}` };
      }
    }

    // Passthrough + WebRTC: only the source path is needed.
    // WebRTC viewers connect directly to cam-{id} — no HLS path or FFmpeg hook.
    if (isPassthroughWebrtc) {
      // Clear any previously configured FFmpeg hook
      await mediamtxFetch(
        `/v3/config/paths/patch/${encodeURIComponent(pathName)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            runOnReady: "",
            runOnReadyRestart: false,
          }),
        },
      );
      return { success: true };
    }

    // 2. Add HLS output path (receives from FFmpeg)
    await mediamtxFetch(
      `/v3/config/paths/add/${encodeURIComponent(hlsPathName)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "publisher" }),
      },
    ).catch(() => {
      // Might already exist — patch it
      return mediamtxFetch(
        `/v3/config/paths/patch/${encodeURIComponent(hlsPathName)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: "publisher" }),
        },
      );
    });

    // 3. Set FFmpeg transcode hook
    if (ffmpegCmd) {
      await mediamtxFetch(
        `/v3/config/paths/patch/${encodeURIComponent(pathName)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            runOnReady: ffmpegCmd,
            runOnReadyRestart: true,
          }),
        },
      );
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Remove camera pipeline from MediaMTX.
 * Deletes both config paths and kicks any active connections.
 */
export async function removeCameraPipeline(
  cameraId: string,
): Promise<void> {
  const pathName = `cam-${cameraId}`;
  const hlsPathName = `${pathName}-hls`;

  // 1. Delete HLS output path config (ignore 404 — may not exist for passthrough)
  const hlsRes = await mediamtxFetch(
    `/v3/config/paths/delete/${encodeURIComponent(hlsPathName)}`,
    { method: "POST" },
  ).catch(() => null);

  if (hlsRes && !hlsRes.ok && hlsRes.status !== 404) {
    console.error(JSON.stringify({
      level: "error",
      service: "stream-pipeline",
      message: `Failed to delete HLS path config: ${hlsPathName}`,
      status: hlsRes.status,
    }));
  }

  // 2. Delete source path config — this stops the RTSP pull
  const srcRes = await mediamtxFetch(
    `/v3/config/paths/delete/${encodeURIComponent(pathName)}`,
    { method: "POST" },
  ).catch(() => null);

  if (srcRes && !srcRes.ok && srcRes.status !== 404) {
    console.error(JSON.stringify({
      level: "error",
      service: "stream-pipeline",
      message: `Failed to delete source path config: ${pathName}`,
      status: srcRes.status,
    }));
  }

  // 3. Verify paths are actually gone
  try {
    const res = await mediamtxFetch("/v3/paths/list");
    if (res.ok) {
      const data = (await res.json()) as { items?: { name: string }[] };
      const remaining = (data.items ?? []).filter(
        (p) => p.name === pathName || p.name === hlsPathName,
      );
      if (remaining.length > 0) {
        console.error(JSON.stringify({
          level: "error",
          service: "stream-pipeline",
          message: `Paths still active after deletion: ${remaining.map((p) => p.name).join(", ")}`,
          cameraId,
        }));
      }
    }
  } catch {
    // verification is best-effort
  }
}

/**
 * Update camera pipeline when profile changes.
 * Re-creates the FFmpeg command with new profile settings.
 */
export async function updateCameraPipeline(
  cameraId: string,
  tenantId: string,
): Promise<{ success: boolean; error?: string }> {
  const pathName = `cam-${cameraId}`;
  const hlsPathName = `${pathName}-hls`;

  const profile = await getCameraProfileSettings(cameraId, tenantId);
  const ffmpegCmd = buildFfmpegCommand(pathName, hlsPathName, profile);

  console.log(JSON.stringify({
    level: "info",
    service: "stream-pipeline",
    message: `Updating pipeline for ${pathName}`,
    profile: {
      audio: profile.audioMode,
      resolution: profile.outputResolution,
      fps: profile.maxFramerate,
      codec: profile.outputCodec,
    },
  }));

  try {
    if (ffmpegCmd) {
      await mediamtxFetch(
        `/v3/config/paths/patch/${encodeURIComponent(pathName)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            runOnReady: ffmpegCmd,
            runOnReadyRestart: true,
          }),
        },
      );
    }
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
