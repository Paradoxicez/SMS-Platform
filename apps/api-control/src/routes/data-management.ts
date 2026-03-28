import { Hono } from "hono";
import { requireRole } from "../middleware/rbac";
import { exportTenantData } from "../services/data-export";
import { deleteTenant } from "../services/tenant-deletion";

/**
 * T275: Data management routes (export + GDPR deletion)
 */
const dataManagementRouter = new Hono();

// POST /data/export — admin only, returns JSON data export
dataManagementRouter.post(
  "/data/export",
  requireRole("admin"),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const buffer = await exportTenantData(tenantId);

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="tenant-export-${tenantId}.json"`,
      },
    });
  },
);

// POST /data/delete-tenant — admin only, requires confirmation
dataManagementRouter.post(
  "/data/delete-tenant",
  requireRole("admin"),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const { confirmation_name } = await c.req.json();

    if (!confirmation_name) {
      return c.json(
        { error: { code: "VALIDATION_ERROR", message: "confirmation_name is required" } },
        400,
      );
    }

    try {
      const result = await deleteTenant(tenantId, confirmation_name);
      return c.json({ data: result });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Deletion failed";
      return c.json(
        { error: { code: "DELETION_ERROR", message } },
        400,
      );
    }
  },
);

export { dataManagementRouter };
