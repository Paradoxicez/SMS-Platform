import { Hono } from "hono";
import { getApiUsage } from "../services/rate-analytics";

/**
 * T278: Developer routes (rate analytics)
 */
const developerRouter = new Hono();

// GET /developer/usage — API usage analytics
developerRouter.get("/developer/usage", async (c) => {
  const tenantId = c.get("tenantId") as string;
  const apiClientId = c.req.query("api_client_id");

  const usage = await getApiUsage(tenantId, apiClientId ?? undefined);
  return c.json({ data: usage });
});

export { developerRouter };
