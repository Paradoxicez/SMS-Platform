import { createMiddleware } from "hono/factory";
import { db } from "../db/client";
import { tenants } from "../db/schema";
import {
  getLicenseStatus,
  loadLicenseOnStartup,
  getCachedLicenseStatus,
  isOnPrem,
} from "../services/license";

let licenseCheckInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Initialize the license checker.
 * Loads license from DB on startup and sets up an hourly re-check.
 */
export async function initLicenseChecker(): Promise<void> {
  if (!isOnPrem()) {
    console.log("License checker: skipping (cloud deployment)");
    return;
  }

  console.log("License checker: initializing...");

  // Get default tenant (on-prem = single tenant)
  const [tenant] = await db.select({ id: tenants.id }).from(tenants).limit(1);

  if (tenant) {
    await loadLicenseOnStartup(tenant.id);
    const status = getCachedLicenseStatus();
    if (status) {
      console.log(
        `License checker: status=${status.status}, plan=${status.plan ?? "none"}, valid=${status.valid}`,
      );
    } else {
      console.log("License checker: no active license found — trial mode");
    }

    // Re-check every hour
    licenseCheckInterval = setInterval(
      async () => {
        try {
          const s = await getLicenseStatus(tenant.id);
          if (!s.valid) {
            console.warn(`License checker: license is ${s.status} — ${s.reason}`);
          }
        } catch (err) {
          console.error("License checker: periodic check failed:", err);
        }
      },
      60 * 60 * 1000,
    );
  } else {
    console.log("License checker: no tenant found — trial mode");
  }
}

/**
 * Middleware that blocks mutating actions if the license is expired
 * and past the grace period (read_only mode). Only applies to on-prem.
 */
export function requireValidLicense() {
  return createMiddleware(async (c, next) => {
    if (!isOnPrem()) {
      await next();
      return;
    }

    const status = getCachedLicenseStatus();

    // Trial mode — limited but allowed
    if (!status || status.status === "trial") {
      await next();
      return;
    }

    // Read-only mode — block mutating actions
    if (status.status === "read_only") {
      return c.json(
        {
          error: {
            code: "LICENSE_EXPIRED",
            message:
              "License expired. Renew your license to continue using this feature.",
            details: {
              status: status.status,
              plan: status.plan,
              expires_at: status.expiresAt,
            },
          },
        },
        403,
      );
    }

    await next();
  });
}
