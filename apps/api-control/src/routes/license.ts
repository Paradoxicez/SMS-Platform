import { Hono } from "hono";
import { activateLicense, getLicenseStatus, isOnPrem } from "../services/license";

export const licenseRouter = new Hono();

// POST /license/activate — validate, persist, and activate a license key
licenseRouter.post("/license/activate", async (c) => {
  const body = await c.req.json<{ key?: string }>();

  if (!body.key || typeof body.key !== "string") {
    return c.json(
      { error: { code: "BAD_REQUEST", message: "License key is required" } },
      400,
    );
  }

  const tenantId = c.get("tenantId") as string;
  const status = await activateLicense(body.key, tenantId);

  if (!status.valid && status.status === "invalid") {
    return c.json(
      {
        error: {
          code: status.reason?.includes("expired") ? "LICENSE_EXPIRED" : "INVALID_LICENSE",
          message: status.reason ?? "Invalid license key",
        },
      },
      422,
    );
  }

  return c.json({
    data: {
      valid: status.valid,
      status: status.status,
      license_id: status.licenseId,
      tenant: status.tenant,
      plan: status.plan,
      limits: status.limits,
      features: status.features,
      addons: status.addons,
      expires_at: status.expiresAt,
      days_remaining: status.daysRemaining,
    },
    meta: {
      request_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    },
  });
});

// GET /license/status — return current license info
licenseRouter.get("/license/status", async (c) => {
  const tenantId = c.get("tenantId") as string | undefined;
  const status = await getLicenseStatus(tenantId);

  return c.json({
    data: {
      is_on_prem: isOnPrem(),
      valid: status.valid,
      status: status.status,
      license_id: status.licenseId,
      tenant: status.tenant,
      plan: status.plan,
      limits: status.limits,
      features: status.features,
      addons: status.addons,
      expires_at: status.expiresAt,
      days_remaining: status.daysRemaining,
      reason: status.reason,
    },
    meta: {
      request_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    },
  });
});
