/**
 * License heartbeat — optional periodic validation with vendor's license server.
 * Only active when LICENSE_HEARTBEAT_URL is configured.
 */

import { count } from "drizzle-orm";
import { db } from "../db/client";
import { cameras } from "../db/schema";
import { getCachedLicenseStatus } from "./license";
import { recordHeartbeat } from "../routes/health";

const HEARTBEAT_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
const CACHE_TTL = 72 * 60 * 60 * 1000; // 72 hours

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let lastValidResponse: { timestamp: number; status: string } | null = null;

/**
 * Start the heartbeat service if LICENSE_HEARTBEAT_URL is configured.
 */
export function startHeartbeat(): void {
  const url = process.env["LICENSE_HEARTBEAT_URL"];
  if (!url) return;

  console.log(
    JSON.stringify({
      level: "info",
      service: "license-heartbeat",
      message: "Starting heartbeat service",
      interval: "24h",
      url: url.replace(/\/[^/]*$/, "/***"),
    }),
  );

  // Send initial heartbeat
  sendHeartbeat(url).catch(() => {});

  // Schedule recurring
  heartbeatTimer = setInterval(() => {
    sendHeartbeat(url).catch(() => {});
  }, HEARTBEAT_INTERVAL);
}

/**
 * Stop the heartbeat service.
 */
export function stopHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

/**
 * Check if the cached heartbeat response is still valid.
 */
export function isHeartbeatCacheValid(): boolean {
  if (!lastValidResponse) return true; // No heartbeat configured = always valid
  const elapsed = Date.now() - lastValidResponse.timestamp;
  return elapsed < CACHE_TTL;
}

/**
 * Check if the license has been revoked via heartbeat.
 */
export function isRevoked(): boolean {
  return lastValidResponse?.status === "revoked";
}

async function sendHeartbeat(url: string): Promise<void> {
  const license = getCachedLicenseStatus();
  if (!license?.licenseId) return;

  // Count cameras
  let cameraCount = 0;
  try {
    const [result] = await db.select({ value: count() }).from(cameras);
    cameraCount = result?.value ?? 0;
  } catch {
    // DB might not be ready
  }

  const body = {
    license_id: license.licenseId,
    camera_count: cameraCount,
    platform_version: process.env["npm_package_version"] ?? "unknown",
    timestamp: new Date().toISOString(),
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (res.ok) {
      const data = (await res.json()) as { status: string; reason?: string };

      lastValidResponse = {
        timestamp: Date.now(),
        status: data.status,
      };

      recordHeartbeat(true);

      if (data.status === "revoked") {
        console.warn(
          JSON.stringify({
            level: "warn",
            service: "license-heartbeat",
            message: "License revoked by vendor",
            reason: data.reason,
            licenseId: license.licenseId,
          }),
        );
      } else {
        console.log(
          JSON.stringify({
            level: "info",
            service: "license-heartbeat",
            message: "Heartbeat successful",
            status: data.status,
          }),
        );
      }
    } else {
      recordHeartbeat(false);
      console.warn(
        JSON.stringify({
          level: "warn",
          service: "license-heartbeat",
          message: `Heartbeat failed: HTTP ${res.status}`,
        }),
      );
    }
  } catch (err) {
    recordHeartbeat(false);
    console.warn(
      JSON.stringify({
        level: "warn",
        service: "license-heartbeat",
        message: "Heartbeat failed: server unreachable",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    // Don't update lastValidResponse — keep using cached status
  }
}
