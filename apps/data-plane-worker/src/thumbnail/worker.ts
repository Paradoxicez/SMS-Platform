import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync } from "node:fs";

interface ActiveProcess {
  process: ChildProcess;
  cameraId: string;
  rtspUrl: string;
  interval: number;
  restartCount: number;
  restartTimer?: ReturnType<typeof setTimeout>;
}

const MAX_RESTART_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 2000;

/**
 * T082: Thumbnail worker
 *
 * Spawns FFmpeg processes to extract keyframe thumbnails from RTSP streams.
 * Tracks active processes in a Map, handles crashes with exponential backoff.
 */
export class ThumbnailWorker {
  private activeProcesses = new Map<string, ActiveProcess>();

  /**
   * Start thumbnail extraction for a camera.
   * Spawns an FFmpeg process that writes a single JPEG frame at the given interval.
   */
  startForCamera(cameraId: string, rtspUrl: string, interval = 5): void {
    // Stop any existing process for this camera
    if (this.activeProcesses.has(cameraId)) {
      this.stopForCamera(cameraId);
    }

    this.spawnProcess(cameraId, rtspUrl, interval, 0);
  }

  /**
   * Stop thumbnail extraction for a camera.
   * Kills the FFmpeg process and clears any pending restart timers.
   */
  stopForCamera(cameraId: string): void {
    const entry = this.activeProcesses.get(cameraId);
    if (!entry) return;

    if (entry.restartTimer) {
      clearTimeout(entry.restartTimer);
    }

    try {
      entry.process.kill("SIGTERM");
    } catch {
      // Process may already be dead
    }

    this.activeProcesses.delete(cameraId);
    console.log(
      JSON.stringify({
        level: "info",
        service: "thumbnail-worker",
        message: "Stopped thumbnail extraction",
        cameraId,
        timestamp: new Date().toISOString(),
      }),
    );
  }

  /** Stop all active thumbnail processes. */
  stopAll(): void {
    for (const cameraId of this.activeProcesses.keys()) {
      this.stopForCamera(cameraId);
    }
  }

  /** Return the set of camera IDs with active thumbnail processes. */
  getActiveCameras(): string[] {
    return Array.from(this.activeProcesses.keys());
  }

  private spawnProcess(
    cameraId: string,
    rtspUrl: string,
    interval: number,
    restartCount: number,
  ): void {
    // Ensure output directory exists
    const outputDir = `/thumbnails/${cameraId}`;
    try {
      mkdirSync(outputDir, { recursive: true });
    } catch {
      // Directory may already exist
    }

    const outputPath = `${outputDir}/latest.jpg`;

    const args = [
      "-i",
      rtspUrl,
      "-vf",
      `fps=1/${interval},scale=640:360`,
      "-frames:v",
      "1",
      "-update",
      "1",
      "-y",
      outputPath,
    ];

    const proc = spawn("ffmpeg", args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    const entry: ActiveProcess = {
      process: proc,
      cameraId,
      rtspUrl,
      interval,
      restartCount,
    };

    this.activeProcesses.set(cameraId, entry);

    console.log(
      JSON.stringify({
        level: "info",
        service: "thumbnail-worker",
        message: "Started thumbnail extraction",
        cameraId,
        interval,
        timestamp: new Date().toISOString(),
      }),
    );

    proc.stderr?.on("data", (data: Buffer) => {
      const msg = data.toString().trim();
      if (msg.length > 0) {
        console.log(
          JSON.stringify({
            level: "debug",
            service: "thumbnail-worker",
            message: "FFmpeg stderr",
            cameraId,
            output: msg.slice(0, 500),
            timestamp: new Date().toISOString(),
          }),
        );
      }
    });

    proc.on("error", (err) => {
      console.error(
        JSON.stringify({
          level: "error",
          service: "thumbnail-worker",
          message: "FFmpeg process error",
          cameraId,
          error: err.message,
          timestamp: new Date().toISOString(),
        }),
      );
      this.handleProcessExit(cameraId, 1);
    });

    proc.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        console.error(
          JSON.stringify({
            level: "error",
            service: "thumbnail-worker",
            message: "FFmpeg process exited unexpectedly",
            cameraId,
            exitCode: code,
            timestamp: new Date().toISOString(),
          }),
        );
        this.handleProcessExit(cameraId, code);
      }
    });
  }

  private handleProcessExit(cameraId: string, _exitCode: number): void {
    const entry = this.activeProcesses.get(cameraId);
    if (!entry) return;

    if (entry.restartCount >= MAX_RESTART_ATTEMPTS) {
      console.error(
        JSON.stringify({
          level: "error",
          service: "thumbnail-worker",
          message: "Max restart attempts reached, giving up",
          cameraId,
          restartCount: entry.restartCount,
          timestamp: new Date().toISOString(),
        }),
      );
      this.activeProcesses.delete(cameraId);
      return;
    }

    const backoffMs = BASE_BACKOFF_MS * Math.pow(2, entry.restartCount);
    console.log(
      JSON.stringify({
        level: "info",
        service: "thumbnail-worker",
        message: "Scheduling restart with backoff",
        cameraId,
        restartCount: entry.restartCount + 1,
        backoffMs,
        timestamp: new Date().toISOString(),
      }),
    );

    entry.restartTimer = setTimeout(() => {
      // Only restart if still tracked (not manually stopped)
      if (this.activeProcesses.has(cameraId)) {
        this.activeProcesses.delete(cameraId);
        this.spawnProcess(
          cameraId,
          entry.rtspUrl,
          entry.interval,
          entry.restartCount + 1,
        );
      }
    }, backoffMs);
  }
}

/** Singleton instance */
export const thumbnailWorker = new ThumbnailWorker();
