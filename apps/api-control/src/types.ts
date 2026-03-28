import type { Hono } from "hono";

/**
 * Hono environment type — declares all context variables set by middleware.
 */
export type AppEnv = {
  Variables: {
    userId: string;
    tenantId: string;
    userRole: string;
    userEmail: string;
    apiClientId?: string;
    requestId: string;
    tx?: unknown;
  };
};

export type AppType = Hono<AppEnv>;
