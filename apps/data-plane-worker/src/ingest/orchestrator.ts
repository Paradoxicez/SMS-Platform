/**
 * T062: Ingest orchestrator
 *
 * Manages camera assignment to MediaMTX for RTSP ingest.
 * Integrates with the health state machine and MediaMTX client.
 */

import { MediaMTXClient, type MediaMTXPathConfig } from "../mediamtx/client";
import {
  CameraHealthStateMachine,
  type CameraState,
  type CameraEvent,
} from "../health/state-machine";
import { FlappingDetector } from "../health/flapping-detector";
import { HealthPublisher } from "../health/publisher";

export interface StreamProfileConfig {
  audio_mode: "include" | "strip" | "mute";
  max_framerate: number;
  output_protocol: "hls" | "webrtc" | "both";
  output_resolution: "original" | "2160p" | "1440p" | "1080p" | "720p" | "480p" | "360p" | "240p";
}

const RESOLUTION_MAP: Record<string, string> = {
  "2160p": "3840:2160",
  "1440p": "2560:1440",
  "1080p": "1920:1080",
  "720p": "1280:720",
  "480p": "854:480",
  "360p": "640:360",
  "240p": "426:240",
};

export interface CameraConfig {
  id: string;
  tenant_id: string;
  rtsp_url: string;
  name: string;
  credentials_encrypted?: string | null;
  forwarding_target_url?: string | null;
  stream_profile?: StreamProfileConfig | null;
  recording_enabled?: boolean;
  recording_retention_days?: number;
}

export class IngestOrchestrator {
  private readonly mediamtx: MediaMTXClient;
  private readonly stateMachine: CameraHealthStateMachine;
  private readonly flappingDetector: FlappingDetector;
  private readonly publisher: HealthPublisher;
  private readonly activeCameras: Map<string, CameraConfig> = new Map();

  constructor(
    mediamtx: MediaMTXClient,
    stateMachine: CameraHealthStateMachine,
    flappingDetector: FlappingDetector,
    publisher: HealthPublisher,
  ) {
    this.mediamtx = mediamtx;
    this.stateMachine = stateMachine;
    this.flappingDetector = flappingDetector;
    this.publisher = publisher;
  }

  /**
   * Assign a camera to MediaMTX for RTSP ingest.
   * Adds the camera path and starts the state machine.
   */
  async assignCamera(camera: CameraConfig): Promise<void> {
    const pathName = `cam-${camera.id}`;

    const isSrt = camera.rtsp_url.startsWith("srt://");

    const pathConfig: MediaMTXPathConfig = {
      source: camera.rtsp_url,
      sourceOnDemand: false,
    };

    // Only set sourceProtocol for RTSP sources
    if (!isSrt) {
      pathConfig.sourceProtocol = "tcp";
    }

    // T293: Add recording configuration if enabled
    if (camera.recording_enabled) {
      (pathConfig as any).record = true;
      (pathConfig as any).recordPath = `./recordings/${pathName}/%Y-%m-%d_%H-%M-%S`;
      (pathConfig as any).recordFormat = "fmp4";
    }

    // Build FFmpeg args based on stream profile settings
    const ffmpegArgs = this.buildFfmpegArgs(camera, pathName);

    if (ffmpegArgs) {
      pathConfig.runOnReady = ffmpegArgs;
      pathConfig.runOnReadyRestart = true;
    } else if (camera.forwarding_target_url) {
      // Fallback: if no special processing but forwarding is set, use simple copy
      pathConfig.runOnReady = `ffmpeg -i rtsp://localhost:8554/${pathName} -c copy -f flv ${camera.forwarding_target_url}`;
      pathConfig.runOnReadyRestart = true;
    }

    try {
      await this.mediamtx.addPath(pathName, pathConfig);

      this.activeCameras.set(camera.id, camera);
      this.stateMachine.setState(camera.id, "connecting");

      await this.publisher.publishStateChange({
        camera_id: camera.id,
        tenant_id: camera.tenant_id,
        previous_state: "stopped",
        new_state: "connecting",
        event: "manual_start",
        timestamp: new Date().toISOString(),
      });

      // Simulate RTSP validation success after path is added
      // In production, this would be driven by MediaMTX webhook/polling
      this.scheduleRtspValidation(camera);
    } catch (err) {
      console.error(
        JSON.stringify({
          level: "error",
          service: "orchestrator",
          message: "Failed to assign camera to MediaMTX",
          cameraId: camera.id,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
      throw err;
    }
  }

  /**
   * Unassign a camera from MediaMTX.
   */
  async unassignCamera(cameraId: string): Promise<void> {
    const pathName = `cam-${cameraId}`;
    const camera = this.activeCameras.get(cameraId);

    try {
      await this.mediamtx.removePath(pathName);
    } catch (err) {
      console.error(
        JSON.stringify({
          level: "warn",
          service: "orchestrator",
          message: "Failed to remove MediaMTX path (may not exist)",
          cameraId,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }

    const previousState = this.stateMachine.getState(cameraId);

    // Transition through "stopping" before "stopped"
    this.stateMachine.setState(cameraId, "stopping");
    if (camera) {
      await this.publisher.publishStateChange({
        camera_id: cameraId,
        tenant_id: camera.tenant_id,
        previous_state: previousState,
        new_state: "stopping",
        event: "manual_stop",
        timestamp: new Date().toISOString(),
      });
    }

    this.activeCameras.delete(cameraId);
    this.flappingDetector.reset(cameraId);

    this.stateMachine.setState(cameraId, "stopped");
    if (camera) {
      await this.publisher.publishStateChange({
        camera_id: cameraId,
        tenant_id: camera.tenant_id,
        previous_state: "stopping",
        new_state: "stopped",
        event: "manual_stop",
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Start a camera that is already configured but stopped.
   */
  async startCamera(cameraId: string): Promise<void> {
    const camera = this.activeCameras.get(cameraId);
    if (!camera) {
      throw new Error(`Camera ${cameraId} is not assigned to this node`);
    }

    await this.assignCamera(camera);
  }

  /**
   * Stop a camera ingest and update state to stopped.
   */
  async stopCamera(cameraId: string): Promise<void> {
    await this.unassignCamera(cameraId);
  }

  /**
   * Handle a health event for a camera (e.g., connection_lost, first_frame).
   */
  async handleEvent(cameraId: string, event: CameraEvent): Promise<CameraState> {
    const camera = this.activeCameras.get(cameraId);
    const previousState = this.stateMachine.getState(cameraId);

    // Record transition for flapping detection
    const isFlapping = this.flappingDetector.recordTransition(cameraId);

    // If flapping, override the event
    const effectiveEvent = isFlapping ? "flapping_detected" : event;

    // Check if transition is valid, skip if not
    const canTransition = this.stateMachine.canTransition(cameraId, effectiveEvent);
    if (!canTransition) {
      return previousState;
    }

    const newState = this.stateMachine.transition(cameraId, effectiveEvent);

    if (camera) {
      await this.publisher.publishStateChange({
        camera_id: cameraId,
        tenant_id: camera.tenant_id,
        previous_state: previousState,
        new_state: newState,
        event: effectiveEvent,
        timestamp: new Date().toISOString(),
      });

      await this.publisher.publishHealthUpdate({
        camera_id: cameraId,
        tenant_id: camera.tenant_id,
        health_status: newState,
        timestamp: new Date().toISOString(),
      });
    }

    return newState;
  }

  /**
   * Schedule an RTSP validation check.
   * After successful validation, auto-start the camera (FR-011).
   */
  private scheduleRtspValidation(camera: CameraConfig): void {
    setTimeout(async () => {
      try {
        // Check if the path is active in MediaMTX
        const paths = await this.mediamtx.listPaths();
        const pathName = `cam-${camera.id}`;
        const cameraPath = paths.items.find((p) => p.name === pathName);

        if (cameraPath?.ready) {
          // RTSP validated — transition to online
          await this.handleEvent(camera.id, "rtsp_validated");
        }
      } catch (err) {
        console.error(
          JSON.stringify({
            level: "error",
            service: "orchestrator",
            message: "RTSP validation check failed",
            cameraId: camera.id,
            error: err instanceof Error ? err.message : String(err),
          }),
        );
      }
    }, 3000); // Check after 3 seconds
  }

  /**
   * Build FFmpeg arguments based on the camera's stream profile.
   * Returns null if no special processing is needed (include audio, original fps).
   */
  private buildFfmpegArgs(camera: CameraConfig, pathName: string): string | null {
    const profile = camera.stream_profile;
    if (!profile) {
      return null;
    }

    const needsAudioProcessing =
      profile.audio_mode === "strip" || profile.audio_mode === "mute";
    const needsFramerateLimit = profile.max_framerate > 0;
    const needsResolutionScale =
      profile.output_resolution !== undefined &&
      profile.output_resolution !== "original" &&
      RESOLUTION_MAP[profile.output_resolution] !== undefined;

    // If no special processing needed, use standard repackage (no FFmpeg)
    if (!needsAudioProcessing && !needsFramerateLimit && !needsResolutionScale) {
      // Still handle forwarding if set
      if (camera.forwarding_target_url) {
        return `ffmpeg -i rtsp://localhost:8554/${pathName} -c copy -f flv ${camera.forwarding_target_url}`;
      }
      return null;
    }

    const args: string[] = [
      "ffmpeg",
      "-i",
      `rtsp://localhost:8554/${pathName}`,
    ];

    // Audio mode handling
    if (profile.audio_mode === "strip") {
      args.push("-an");
    } else if (profile.audio_mode === "mute") {
      args.push("-af", '"volume=0"');
    }

    // Resolution scaling (downscale only, preserve aspect ratio)
    if (needsResolutionScale) {
      const scale = RESOLUTION_MAP[profile.output_resolution];
      if (scale) {
        // -2 ensures divisible by 2 for encoders; min() prevents upscaling
        args.push("-vf", `scale='min(${scale.split(":")[0]},iw)':min'(${scale.split(":")[1]},ih)':force_original_aspect_ratio=decrease`);
      }
    }

    // Framerate cap
    if (profile.max_framerate > 0) {
      args.push("-r", String(profile.max_framerate));
    }

    // Output handling
    if (camera.forwarding_target_url) {
      args.push("-c:v", "copy", "-f", "flv", camera.forwarding_target_url);
    } else {
      // Re-publish back to MediaMTX on a processed path
      args.push("-c:v", "copy", "-f", "rtsp", `rtsp://localhost:8554/${pathName}-out`);
    }

    return args.join(" ");
  }

  getActiveCameras(): Map<string, CameraConfig> {
    return new Map(this.activeCameras);
  }

  getCameraState(cameraId: string): CameraState {
    return this.stateMachine.getState(cameraId);
  }
}
