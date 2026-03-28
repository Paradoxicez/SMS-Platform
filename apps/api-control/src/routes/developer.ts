import { Hono } from "hono";
import { getApiUsage } from "../services/rate-analytics";
import type { AppEnv } from "../types";

/**
 * T278: Developer routes (rate analytics)
 */
const developerRouter = new Hono<AppEnv>();

// GET /developer/usage — API usage analytics
developerRouter.get("/developer/usage", async (c) => {
  const tenantId = c.get("tenantId") as string;
  const apiClientId = c.req.query("api_client_id");

  const usage = await getApiUsage(tenantId, apiClientId ?? undefined);
  return c.json({ data: usage });
});

export { developerRouter };
