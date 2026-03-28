import { Hono } from "hono";
import crypto from "node:crypto";
import { eq, and, gt } from "drizzle-orm";
import { db } from "../db/client";
import { tenants } from "../db/schema/tenants";
import { users } from "../db/schema/users";
import { verificationTokens } from "../db/schema/verification-tokens";
import { AppError } from "../middleware/error-handler";
import { sendVerificationEmail } from "../services/email";
import type { AppEnv } from "../types";

export const authRouter = new Hono<AppEnv>();

// POST /auth/register
authRouter.post("/auth/register", async (c) => {
  const body = await c.req.json();
  const { email, password, tenant_name } = body as {
    email: string;
    password: string;
    tenant_name: string;
  };

  // Validation
  if (!email || !password || !tenant_name) {
    throw new AppError(
      "VALIDATION_ERROR",
      "email, password, and tenant_name are required",
      422,
    );
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError("VALIDATION_ERROR", "Invalid email format", 422);
  }

  if (password.length < 8) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Password must be at least 8 characters",
      422,
    );
  }

  // Check if email already registered
  const existingUser = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  if (existingUser.length > 0) {
    throw new AppError("CONFLICT", "An account with this email already exists", 409);
  }

  // Create tenant
  const slug = tenant_name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 63);

  const [tenant] = await db
    .insert(tenants)
    .values({
      name: tenant_name,
      slug: `${slug}-${crypto.randomBytes(3).toString("hex")}`,
      billingEmail: email.toLowerCase(),
      subscriptionTier: "free",
      onboardingCompleted: false,
    })
    .returning();

  // Create user (admin role, not yet verified)
  const [user] = await db
    .insert(users)
    .values({
      tenantId: tenant!.id,
      email: email.toLowerCase(),
      name: email.split("@")[0]!,
      role: "admin",
      mfaEnabled: false,
    })
    .returning();

  // Generate verification token
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

  await db.insert(verificationTokens).values({
    email: email.toLowerCase(),
    token,
    type: "email_verify",
    expiresAt,
  });

  // Send verification email
  const baseUrl = process.env["CONSOLE_WEB_URL"] ?? "http://localhost:3000";
  const verifyUrl = `${baseUrl}/verify/${token}`;

  await sendVerificationEmail(email.toLowerCase(), verifyUrl);

  console.log(`[AUTH] Verification URL for ${email}: ${verifyUrl}`);

  return c.json(
    {
      data: {
        message: "Registration successful. Please check your email to verify your account.",
        user_id: user!.id,
        tenant_id: tenant!.id,
      },
      meta: {
        request_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    },
    201,
  );
});

// POST /auth/verify
authRouter.post("/auth/verify", async (c) => {
  const body = await c.req.json();
  const { token } = body as { token: string };

  if (!token) {
    throw new AppError("VALIDATION_ERROR", "Token is required", 422);
  }

  // Find valid token
  const [record] = await db
    .select()
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.token, token),
        eq(verificationTokens.type, "email_verify"),
        gt(verificationTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!record) {
    throw new AppError("NOT_FOUND", "Invalid or expired verification link", 404);
  }

  if (record.usedAt) {
    throw new AppError("CONFLICT", "This verification link has already been used", 409);
  }

  // Mark token as used
  await db
    .update(verificationTokens)
    .set({ usedAt: new Date() })
    .where(eq(verificationTokens.id, record.id));

  // Note: email_verified flag would be on a separate column if needed.
  // For now, the token being used is the verification.
  // The user can now log in via Keycloak (which is the IdP).

  return c.json({
    data: {
      message: "Email verified successfully. You can now sign in.",
      email: record.email,
    },
    meta: {
      request_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    },
  });
});
