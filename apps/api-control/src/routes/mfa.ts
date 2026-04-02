import { Hono } from "hono";
import { TOTP, Secret } from "otpauth";
import bcrypt from "bcryptjs";
import { eq, and } from "drizzle-orm";
import { AppError } from "../middleware/error-handler";
import type { AppEnv } from "../types";

const APP_NAME = "SMS Platform";

const mfaRouter = new Hono<AppEnv>();

// POST /mfa/setup — generate TOTP secret and return QR code URI
mfaRouter.post("/mfa/setup", async (c) => {
  const tenantId = c.get("tenantId") as string;
  const userId = c.get("userId") as string;
  const { withTenantContext } = await import("../db/client");
  const { users } = await import("../db/schema/users");

  const [user] = await withTenantContext(tenantId, async (tx) => {
    return tx
      .select({ email: users.email, mfaEnabled: users.mfaEnabled })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)));
  });

  if (!user) throw new AppError("NOT_FOUND", "User not found", 404);

  if (user.mfaEnabled) {
    throw new AppError("CONFLICT", "MFA is already enabled. Disable it first to reconfigure.", 409);
  }

  // Generate new TOTP secret
  const secret = new Secret();
  const totp = new TOTP({
    issuer: APP_NAME,
    label: user.email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret,
  });

  // Store secret temporarily (not yet enabled until verified)
  await withTenantContext(tenantId, async (tx) => {
    await tx
      .update(users)
      .set({ totpSecret: secret.base32 })
      .where(eq(users.id, userId));
  });

  return c.json({
    data: {
      secret: secret.base32,
      uri: totp.toString(),
      // Frontend can use this URI to generate QR code with any QR library
    },
  });
});

// POST /mfa/verify — verify TOTP code and enable MFA
mfaRouter.post("/mfa/verify", async (c) => {
  const tenantId = c.get("tenantId") as string;
  const userId = c.get("userId") as string;
  const body = await c.req.json();
  const { code } = body as { code?: string };

  if (!code || code.length !== 6) {
    throw new AppError("VALIDATION_ERROR", "A 6-digit code is required", 422);
  }

  const { withTenantContext } = await import("../db/client");
  const { users } = await import("../db/schema/users");

  const [user] = await withTenantContext(tenantId, async (tx) => {
    return tx
      .select({ totpSecret: users.totpSecret, mfaEnabled: users.mfaEnabled })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)));
  });

  if (!user?.totpSecret) {
    throw new AppError("NOT_FOUND", "No MFA setup in progress. Call /mfa/setup first.", 404);
  }

  const totp = new TOTP({
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(user.totpSecret),
  });

  const delta = totp.validate({ token: code, window: 1 });

  if (delta === null) {
    throw new AppError("UNAUTHORIZED", "Invalid verification code", 401);
  }

  // Enable MFA
  await withTenantContext(tenantId, async (tx) => {
    await tx
      .update(users)
      .set({ mfaEnabled: true })
      .where(eq(users.id, userId));
  });

  return c.json({ data: { mfa_enabled: true } });
});

// POST /mfa/disable — disable MFA (requires password confirmation)
mfaRouter.post("/mfa/disable", async (c) => {
  const tenantId = c.get("tenantId") as string;
  const userId = c.get("userId") as string;
  const body = await c.req.json();
  const { password } = body as { password?: string };

  if (!password) {
    throw new AppError("VALIDATION_ERROR", "Password is required to disable MFA", 422);
  }

  const { withTenantContext } = await import("../db/client");
  const { users } = await import("../db/schema/users");

  const [user] = await withTenantContext(tenantId, async (tx) => {
    return tx
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)));
  });

  if (!user?.passwordHash) {
    throw new AppError("NOT_FOUND", "User not found", 404);
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new AppError("UNAUTHORIZED", "Incorrect password", 401);
  }

  await withTenantContext(tenantId, async (tx) => {
    await tx
      .update(users)
      .set({ mfaEnabled: false, totpSecret: null })
      .where(eq(users.id, userId));
  });

  return c.json({ data: { mfa_enabled: false } });
});

// GET /mfa/status — check MFA status
mfaRouter.get("/mfa/status", async (c) => {
  const tenantId = c.get("tenantId") as string;
  const userId = c.get("userId") as string;
  const { withTenantContext } = await import("../db/client");
  const { users } = await import("../db/schema/users");

  const [user] = await withTenantContext(tenantId, async (tx) => {
    return tx
      .select({ mfaEnabled: users.mfaEnabled })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)));
  });

  return c.json({ data: { mfa_enabled: user?.mfaEnabled ?? false } });
});

export { mfaRouter };
