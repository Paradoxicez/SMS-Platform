import { Hono } from "hono";
import { createPolicySchema, updatePolicySchema } from "@repo/types";
import { requireRole } from "../middleware/rbac";
import {
  createPolicy,
  updatePolicy,
  deletePolicy,
  listPolicies,
  getPolicy,
} from "../services/policies";

const policiesRouter = new Hono();

/**
 * T098: Policy routes
 *
 * CRUD endpoints for playback policies with RBAC enforcement.
 */

// POST /policies — create a new policy
policiesRouter.post(
  "/",
  requireRole("admin", "operator"),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const actorId = c.get("userId") as string;
    const body = await c.req.json();
    const data = createPolicySchema.parse(body);

    const policy = await createPolicy({
      tenantId,
      data,
      actorId,
      sourceIp: c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
    });

    return c.json(
      {
        data: policy,
        meta: {
          request_id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        },
      },
      201,
    );
  },
);

// GET /policies — list all policies for the tenant
policiesRouter.get(
  "/",
  requireRole("admin", "operator", "developer"),
  async (c) => {
    const tenantId = c.get("tenantId") as string;

    const policyList = await listPolicies(tenantId);

    return c.json({
      data: policyList,
      meta: {
        request_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    });
  },
);

// GET /policies/:id — get a single policy
policiesRouter.get(
  "/:id",
  requireRole("admin", "operator", "developer"),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const id = c.req.param("id");

    const policy = await getPolicy(tenantId, id);

    return c.json({
      data: policy,
      meta: {
        request_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    });
  },
);

// PATCH /policies/:id — update a policy (with OCC version check)
policiesRouter.patch(
  "/:id",
  requireRole("admin", "operator"),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const actorId = c.get("userId") as string;
    const id = c.req.param("id");
    const body = await c.req.json();
    const data = updatePolicySchema.parse(body);

    const policy = await updatePolicy({
      tenantId,
      id,
      data,
      actorId,
      sourceIp: c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
    });

    return c.json({
      data: policy,
      meta: {
        request_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    });
  },
);

// DELETE /policies/:id — delete a policy
policiesRouter.delete(
  "/:id",
  requireRole("admin"),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const actorId = c.get("userId") as string;
    const id = c.req.param("id");

    await deletePolicy({
      tenantId,
      id,
      actorId,
      sourceIp: c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
    });

    return c.json({
      data: { id },
      meta: {
        request_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    });
  },
);

export { policiesRouter };
