/**
 * License service — Ed25519-based license validation with DB persistence.
 *
 * Replaces the old HMAC-SHA256 implementation.
 */

import { eq, and, desc } from "drizzle-orm";
import { db } from "../db/client";
import { licenses } from "../db/schema";
import {
  decodeLicense,
  getLicenseStatus as getPayloadStatus,
  daysRemaining,
  type LicensePayload,
} from "../lib/license-codec";
import {
  resolveFeatures,
  resolveLimits,
  type PlanTier,
  type PlanLimits,
} from "../lib/plan-definitions";
import { logAuditEvent } from "./audit";
import { recordLicenseActivation, setLicenseMetrics } from "../routes/health";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LicenseStatus {
  valid: boolean;
  status: "active" | "expiring" | "grace_period" | "read_only" | "trial" | "invalid" | "none";
  licenseId?: string;
  tenant?: string;
  plan?: string;
  limits?: PlanLimits;
  features?: string[];
  addons?: string[];
  expiresAt?: string;
  daysRemaining?: number;
  reason?: string;
}

// ─── In-memory cache ─────────────────────────────────────────────────────────

let cachedStatus: LicenseStatus | null = null;
let cachedPayload: LicensePayload | null = null;

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Check if we are in on-prem deployment mode.
 */
export function isOnPrem(): boolean {
  return process.env["DEPLOYMENT_MODE"] === "onprem";
}

/**
 * Activate a license key: verify Ed25519 signature, persist to DB, update cache.
 */
export async function activateLicense(
  key: string,
  tenantId: string,
): Promise<LicenseStatus> {
  // 1. Decode and verify signature
  const decoded = decodeLicense(key);

  if (!decoded.valid) {
    recordLicenseActivation(false);
    return {
      valid: false,
      status: "invalid",
      reason: decoded.error ?? "Invalid license key",
    };
  }

  const payload = decoded.payload;

  // 2. Check if expired beyond grace period (> 30 days past expiry)
  const status = getPayloadStatus(payload);
  if (status === "read_only") {
    recordLicenseActivation(false);
    return {
      valid: false,
      status: "invalid",
      reason: "License has expired. Contact your vendor for renewal.",
    };
  }

  // 3. Deactivate previous license for this tenant
  await db
    .update(licenses)
    .set({ isActive: false })
    .where(and(eq(licenses.tenantId, tenantId), eq(licenses.isActive, true)));

  // 4. Insert new license record
  const limits = resolveLimits(payload.plan as PlanTier, {
    cameras: payload.limits.cameras,
    projects: payload.limits.projects,
    users: payload.limits.users,
    sites: payload.limits.sites,
    apiKeys: payload.limits.api_keys,
    viewerHours: payload.limits.viewer_hours,
    retentionDays: payload.limits.retention_days,
  });

  const features = resolveFeatures(payload.plan as PlanTier, payload.addons);

  await db.insert(licenses).values({
    tenantId,
    licenseKey: key,
    licenseId: payload.id,
    plan: payload.plan,
    limits,
    addons: payload.addons,
    issuedAt: new Date(payload.issuedAt),
    expiresAt: new Date(payload.expiresAt),
    isActive: true,
  });

  // 5. Update in-memory cache
  cachedPayload = payload;
  cachedStatus = buildStatus(payload, limits, features);

  // 5b. Update Prometheus metrics
  recordLicenseActivation(true);
  setLicenseMetrics(cachedStatus.status, cachedStatus.daysRemaining ?? 0, payload.plan);

  // 6. Audit log
  logAuditEvent({
    tenantId,
    actorType: "system",
    actorId: undefined,
    eventType: "license.activated",
    resourceType: "license",
    resourceId: payload.id,
    details: {
      plan: payload.plan,
      cameras: limits.cameras,
      addons: payload.addons,
      expiresAt: payload.expiresAt,
    },
    sourceIp: undefined,
  });

  return cachedStatus;
}

/**
 * Get current license status. Reads from cache → DB → env → trial.
 */
export async function getLicenseStatus(tenantId?: string): Promise<LicenseStatus> {
  if (!isOnPrem()) {
    return { valid: true, status: "active", reason: "Cloud deployment" };
  }

  // Return cache if available
  if (cachedStatus && cachedPayload) {
    // Re-check expiry (might have changed since cache)
    const limits = resolveLimits(cachedPayload.plan as PlanTier, {
      cameras: cachedPayload.limits.cameras,
      projects: cachedPayload.limits.projects,
      users: cachedPayload.limits.users,
      sites: cachedPayload.limits.sites,
      apiKeys: cachedPayload.limits.api_keys,
      viewerHours: cachedPayload.limits.viewer_hours,
      retentionDays: cachedPayload.limits.retention_days,
    });
    const features = resolveFeatures(cachedPayload.plan as PlanTier, cachedPayload.addons);
    cachedStatus = buildStatus(cachedPayload, limits, features);
    setLicenseMetrics(cachedStatus.status, cachedStatus.daysRemaining ?? 0, cachedPayload.plan);
    return cachedStatus;
  }

  // Try loading from DB
  if (tenantId) {
    const loaded = await loadFromDb(tenantId);
    if (loaded) return loaded;
  }

  // Try env var fallback
  const envKey = process.env["LICENSE_KEY"];
  if (envKey && tenantId) {
    const result = await activateLicense(envKey, tenantId);
    return result;
  }

  // No license — trial mode
  return {
    valid: true,
    status: "trial",
    plan: "free",
    features: resolveFeatures("free"),
    limits: resolveLimits("free"),
    reason: "No license activated. Running in trial mode.",
  };
}

/**
 * Load license from DB on startup.
 */
export async function loadLicenseOnStartup(tenantId: string): Promise<void> {
  await loadFromDb(tenantId);
}

/**
 * Get cached license status (for middleware — fast, no DB call).
 */
export function getCachedLicenseStatus(): LicenseStatus | null {
  return cachedStatus;
}

/**
 * Get effective features for the current license (for feature gating).
 */
export function getEffectiveFeatures(): string[] {
  if (!isOnPrem()) return ["*"]; // Cloud = all features
  return cachedStatus?.features ?? resolveFeatures("free");
}

/**
 * Get effective limits for the current license.
 */
export function getEffectiveLimits(): PlanLimits {
  if (!isOnPrem()) {
    return resolveLimits("enterprise"); // Cloud = enterprise limits
  }
  return cachedStatus?.limits ?? resolveLimits("free");
}

/**
 * Check if a specific feature is available.
 */
export function hasFeature(feature: string): boolean {
  const features = getEffectiveFeatures();
  if (features.includes("*")) return true;
  return features.includes(feature);
}

// ─── Internal helpers ────────────────────────────────────────────────────────

async function loadFromDb(tenantId: string): Promise<LicenseStatus | null> {
  try {
    const [record] = await db
      .select()
      .from(licenses)
      .where(and(eq(licenses.tenantId, tenantId), eq(licenses.isActive, true)))
      .orderBy(desc(licenses.activatedAt))
      .limit(1);

    if (!record) return null;

    // Verify signature is still valid
    const decoded = decodeLicense(record.licenseKey);
    if (!decoded.valid) {
      console.error(JSON.stringify({
        level: "error",
        service: "license",
        message: "Stored license key failed signature verification",
        licenseId: record.licenseId,
      }));
      return null;
    }

    const payload = decoded.payload;
    cachedPayload = payload;

    const limits = resolveLimits(payload.plan as PlanTier, {
      cameras: payload.limits.cameras,
      projects: payload.limits.projects,
      users: payload.limits.users,
      sites: payload.limits.sites,
      apiKeys: payload.limits.api_keys,
      viewerHours: payload.limits.viewer_hours,
      retentionDays: payload.limits.retention_days,
    });
    const features = resolveFeatures(payload.plan as PlanTier, payload.addons);

    cachedStatus = buildStatus(payload, limits, features);
    return cachedStatus;
  } catch (err) {
    console.error(JSON.stringify({
      level: "error",
      service: "license",
      message: "Failed to load license from DB",
      error: err instanceof Error ? err.message : String(err),
    }));
    return null;
  }
}

function buildStatus(
  payload: LicensePayload,
  limits: PlanLimits,
  features: string[],
): LicenseStatus {
  const status = getPayloadStatus(payload);
  const days = daysRemaining(payload);

  return {
    valid: status !== "read_only",
    status,
    licenseId: payload.id,
    tenant: payload.tenant,
    plan: payload.plan,
    limits,
    features,
    addons: payload.addons,
    expiresAt: payload.expiresAt,
    daysRemaining: days,
  };
}
