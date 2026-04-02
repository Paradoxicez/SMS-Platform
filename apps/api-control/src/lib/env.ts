import { z } from "zod";

const isProduction = process.env["NODE_ENV"] === "production";

const secretField = isProduction
  ? z.string().min(16, "must be at least 16 characters in production")
  : z.string().min(1, "is required");

const envSchema = z.object({
  // Required
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),
  AUTH_SECRET: secretField,
  SESSION_SECRET: secretField,
  INTERNAL_SECRET: isProduction
    ? z.string().min(16, "INTERNAL_SECRET must be at least 16 characters in production")
    : z.string().optional(),

  // Required in production
  CORS_ORIGIN: isProduction
    ? z.string().min(1, "CORS_ORIGIN is required in production")
    : z.string().optional(),

  // Optional with defaults
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  ORIGIN_BASE_URL: z.string().default("http://localhost:8888"),
  DEPLOYMENT_MODE: z.enum(["onprem", "cloud"]).default("onprem"),
  MEDIAMTX_API_USER: z.string().default("admin"),
  MEDIAMTX_API_PASS: z.string().default("admin"),
});

export function validateEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    console.error(
      JSON.stringify({
        level: "fatal",
        service: "api-control",
        message: "Environment validation failed",
        errors: result.error.issues,
      }),
    );

    throw new Error(`Environment validation failed:\n${errors}`);
  }

  return result.data;
}
