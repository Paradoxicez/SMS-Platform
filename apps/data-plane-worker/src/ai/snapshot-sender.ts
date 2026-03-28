import { spawn } from "child_process";

/**
 * T299: AI Snapshot Sender
 *
 * For each active AI integration, periodically captures a JPEG snapshot
 * from a camera stream via FFmpeg and POSTs it to the integration endpoint.
 */

export interface AiIntegrationConfig {
  id: string;
  tenant_id: string;
  name: string;
  endpoint_url: string;
  api_key?: string | null;
  cameras: string[];
  interval_seconds: number;
  is_active: boolean;
}

export class SnapshotSender {
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private mediamtxUrl: string;

  constructor(mediamtxUrl: string = "rtsp://localhost:8554") {
    this.mediamtxUrl = mediamtxUrl;
  }

  /**
   * Start sending snapshots for an integration.
   */
  start(integration: AiIntegrationConfig): void {
    if (!integration.is_active) return;

    // Stop existing interval if any
    this.stop(integration.id);

    const intervalMs = integration.interval_seconds * 1000;

    const timer = setInterval(async () => {
      for (const cameraId of integration.cameras) {
        try {
          await this.captureAndSend(cameraId, integration);
        } catch (err) {
          console.error(
            JSON.stringify({
              level: "error",
              service: "snapshot-sender",
              message: "Failed to capture/send snapshot",
              integrationId: integration.id,
              cameraId,
              error: err instanceof Error ? err.message : String(err),
            }),
          );
        }
      }
    }, intervalMs);

    this.intervals.set(integration.id, timer);

    console.log(
      JSON.stringify({
        level: "info",
        service: "snapshot-sender",
        message: `Started snapshot sender for integration '${integration.name}'`,
        integrationId: integration.id,
        cameras: integration.cameras.length,
        intervalSeconds: integration.interval_seconds,
      }),
    );
  }

  /**
   * Stop sending snapshots for an integration.
   */
  stop(integrationId: string): void {
    const timer = this.intervals.get(integrationId);
    if (timer) {
      clearInterval(timer);
      this.intervals.delete(integrationId);
    }
  }

  /**
   * Stop all snapshot senders.
   */
  stopAll(): void {
    for (const [id] of this.intervals) {
      this.stop(id);
    }
  }

  /**
   * Capture a single JPEG frame via FFmpeg and POST to the AI endpoint.
   */
  private async captureAndSend(
    cameraId: string,
    integration: AiIntegrationConfig,
  ): Promise<void> {
    const pathName = `cam-${cameraId}`;
    const streamUrl = `${this.mediamtxUrl}/${pathName}`;

    // Capture one JPEG frame using FFmpeg
    const jpegBuffer = await this.captureFrame(streamUrl);

    // POST to AI endpoint
    const headers: Record<string, string> = {
      "Content-Type": "image/jpeg",
      "X-Camera-Id": cameraId,
      "X-Integration-Id": integration.id,
      "X-Tenant-Id": integration.tenant_id,
    };

    if (integration.api_key) {
      headers["Authorization"] = `Bearer ${integration.api_key}`;
    }

    const response = await fetch(integration.endpoint_url, {
      method: "POST",
      headers,
      body: jpegBuffer,
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`AI endpoint returned ${response.status}`);
    }
  }

  /**
   * Use FFmpeg to capture a single JPEG frame from an RTSP stream.
   */
  private captureFrame(streamUrl: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];

      const ffmpeg = spawn("ffmpeg", [
        "-i", streamUrl,
        "-frames:v", "1",
        "-f", "image2",
        "-c:v", "mjpeg",
        "-q:v", "5",
        "pipe:1",
      ], { stdio: ["ignore", "pipe", "ignore"] });

      ffmpeg.stdout.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });

      ffmpeg.on("close", (code) => {
        if (code === 0) {
          resolve(Buffer.concat(chunks));
        } else {
          reject(new Error(`FFmpeg exited with code ${code}`));
        }
      });

      ffmpeg.on("error", (err) => {
        reject(err);
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        ffmpeg.kill("SIGTERM");
        reject(new Error("FFmpeg capture timed out"));
      }, 10000);
    });
  }
}
