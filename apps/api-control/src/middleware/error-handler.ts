import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";

/**
 * Custom application error with a machine-readable code and HTTP status.
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(code: string, message: string, statusCode: number = 500) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * T050: Global error handler
 *
 * Maps known error types to standard error envelopes:
 *   - ZodError        -> VALIDATION_ERROR (422)
 *   - HTTPException   -> use its status
 *   - AppError        -> use its code and statusCode
 *   - Unknown         -> INTERNAL_ERROR (500)
 *
 * Never leaks internal details in production.
 */
export function errorHandler(err: Error, c: Context) {
  const isProduction = process.env["NODE_ENV"] === "production";

  // Structured log
  console.error(
    JSON.stringify({
      level: "error",
      error: err.name,
      message: err.message,
      stack: isProduction ? undefined : err.stack,
      path: c.req.path,
      method: c.req.method,
      timestamp: new Date().toISOString(),
    }),
  );

  // ZodError -> 422 VALIDATION_ERROR
  if (err instanceof ZodError) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: err.errors.map((e) => ({
            path: e.path.join("."),
            message: e.message,
          })),
        },
      },
      422,
    );
  }

  // HTTPException -> use its status
  if (err instanceof HTTPException) {
    return c.json(
      {
        error: {
          code: `HTTP_${err.status}`,
          message: err.message,
        },
      },
      err.status,
    );
  }

  // AppError -> use code and statusCode
  if (err instanceof AppError) {
    return c.json(
      {
        error: {
          code: err.code,
          message: err.message,
        },
      },
      err.statusCode as 400,
    );
  }

  // Unknown -> 500 INTERNAL_ERROR
  return c.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: isProduction
          ? "An unexpected error occurred"
          : err.message,
      },
    },
    500,
  );
}
