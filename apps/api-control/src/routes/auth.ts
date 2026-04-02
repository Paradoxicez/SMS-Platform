import { Hono } from "hono";
import crypto from "node:crypto";
import { eq, and, gt } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import { db } from "../db/client";
import { tenants } from "../db/schema/tenants";
import { users } from "../db/schema/users";
import { verificationTokens } from "../db/schema/verification-tokens";
import { AppError } from "../middleware/error-handler";
import { sendVerificationEmail } from "../services/email";
import type { AppEnv } from "../types";

if (!process.env["AUTH_SECRET"]) {
  throw new Error("AUTH_SECRET environment variable is required");
}
const JWT_SECRET = new TextEncoder().encode(process.env["AUTH_SECRET"]);
const JWT_ISSUER = "sms-platform";
const JWT_EXPIRY = "7d";

async function issueToken(user: {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: string;
}) {
  return new SignJWT({
    sub: user.id,
    tenant_id: user.tenantId,
    email: user.email,
    name: user.name,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(JWT_ISSUER)
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(JWT_SECRET);
}

export const authRouter = new Hono<AppEnv>();

// POST /auth/login
authRouter.post("/auth/login", async (c) => {
  const body = await c.req.json();
  const { email, password } = body as { email?: string; password?: string };

  if (!email || !password) {
    throw new AppError("VALIDATION_ERROR", "email and password are required", 422);
  }

  const user = await db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase()),
  });

  if (!user || !user.passwordHash) {
    throw new AppError("UNAUTHORIZED", "Invalid email or password", 401);
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new AppError("UNAUTHORIZED", "Invalid email or password", 401);
  }

  // Update last login
  db.update(users)
    .set({ lastLogin: new Date() })
    .where(eq(users.id, user.id))
    .catch(() => {});

  const token = await issueToken(user);

  // Check if MFA is enabled — if so, return partial token that requires TOTP verification
  if (user.mfaEnabled && user.totpSecret) {
    return c.json({
      data: {
        mfa_required: true,
        mfa_token: token, // short-lived token to pass to /auth/mfa/verify
        user_id: user.id,
      },
    });
  }

  return c.json({
    data: {
      access_token: token,
      token_type: "Bearer",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenant_id: user.tenantId,
      },
    },
  });
});

// POST /auth/register
authRouter.post("/auth/register", async (c) => {
  const body = await c.req.json();
  const { email, password, tenant_name } = body as {
    email: string;
    password: string;
    tenant_name: string;
  };

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

  // Hash password
  const passwordHash = await bcrypt.hash(password, 12);

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

  // Create user with password hash
  const [user] = await db
    .insert(users)
    .values({
      tenantId: tenant!.id,
      email: email.toLowerCase(),
      name: email.split("@")[0]!,
      passwordHash,
      role: "admin",
      mfaEnabled: false,
    })
    .returning();

  // Generate verification token
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await db.insert(verificationTokens).values({
    email: email.toLowerCase(),
    token,
    type: "email_verify",
    expiresAt,
  });

  const baseUrl = process.env["CONSOLE_WEB_URL"] ?? "http://localhost:3000";
  const verifyUrl = `${baseUrl}/verify/${token}`;

  await sendVerificationEmail(email.toLowerCase(), verifyUrl);
  console.log(`[AUTH] Verification URL for ${email}: ${verifyUrl}`);

  // Auto-issue token so user is logged in immediately
  const accessToken = await issueToken(user!);

  return c.json(
    {
      data: {
        message: "Registration successful. Please check your email to verify your account.",
        access_token: accessToken,
        token_type: "Bearer",
        user: {
          id: user!.id,
          email: user!.email,
          name: user!.name,
          role: user!.role,
          tenant_id: user!.tenantId,
        },
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

  await db
    .update(verificationTokens)
    .set({ usedAt: new Date() })
    .where(eq(verificationTokens.id, record.id));

  return c.json({
    data: {
      message: "Email verified successfully. You can now sign in.",
      email: record.email,
    },
  });
});

// POST /auth/mfa/verify — verify TOTP code during login
authRouter.post("/auth/mfa/verify", async (c) => {
  const body = await c.req.json();
  const { mfa_token, code } = body as { mfa_token?: string; code?: string };

  if (!mfa_token || !code) {
    throw new AppError("VALIDATION_ERROR", "mfa_token and code are required", 422);
  }

  // Verify the mfa_token to get the user
  const { jwtVerify } = await import("jose");
  let userId: string;
  try {
    const { payload } = await jwtVerify(mfa_token, JWT_SECRET, { issuer: JWT_ISSUER });
    userId = payload.sub as string;
  } catch {
    throw new AppError("UNAUTHORIZED", "Invalid or expired MFA token", 401);
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user?.totpSecret || !user.mfaEnabled) {
    throw new AppError("NOT_FOUND", "MFA not configured for this user", 404);
  }

  const { TOTP, Secret } = await import("otpauth");
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

  // Issue full access token
  const token = await issueToken(user);

  return c.json({
    data: {
      access_token: token,
      token_type: "Bearer",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenant_id: user.tenantId,
      },
    },
  });
});

// Export JWT helpers for use in other routes
export { JWT_SECRET, JWT_ISSUER, issueToken };
