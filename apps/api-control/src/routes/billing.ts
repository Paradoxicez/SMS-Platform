import { Hono } from "hono";
import { getUsageSummary } from "../services/feature-gate";
import {
  createSubscription,
  handlePayment,
  getInvoices,
} from "../services/billing";
import { markPaymentCompleted } from "../services/billing/manual-adapter";
import { requireRole } from "../middleware/rbac";
import type { AppEnv } from "../types";

export const billingRouter = new Hono<AppEnv>();

// GET /billing/usage — current usage vs limits
billingRouter.get("/billing/usage", async (c) => {
  const tenantId = c.get("tenantId") as string;
  const usage = await getUsageSummary(tenantId);

  return c.json({
    data: {
      plan_name: usage.planName,
      plan_display_name: usage.planDisplayName,
      cameras: usage.cameras,
      projects: usage.projects,
      users: usage.users,
      viewer_hours_quota: usage.viewerHoursQuota,
      features: usage.features,
    },
    meta: {
      request_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    },
  });
});

// POST /billing/checkout — create checkout session
billingRouter.post("/billing/checkout", async (c) => {
  const tenantId = c.get("tenantId") as string;
  const body = await c.req.json<{ plan_id?: string }>();

  if (!body.plan_id) {
    return c.json(
      { error: { code: "BAD_REQUEST", message: "plan_id is required" } },
      400,
    );
  }

  const result = await createSubscription(tenantId, body.plan_id);

  return c.json({
    data: { url: result.url },
    meta: {
      request_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    },
  });
});

// GET /billing/invoices — list invoices
billingRouter.get("/billing/invoices", async (c) => {
  const tenantId = c.get("tenantId") as string;
  const invoiceList = await getInvoices(tenantId);

  return c.json({
    data: invoiceList.map((inv) => ({
      id: inv.id,
      plan_id: inv.planId,
      amount_cents: inv.amountCents,
      status: inv.status,
      payment_method: inv.paymentMethod,
      paid_at: inv.paidAt?.toISOString() ?? null,
      created_at: inv.createdAt.toISOString(),
    })),
    meta: {
      request_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    },
  });
});

// POST /billing/mark-paid — admin marks manual payment (admin only)
billingRouter.post(
  "/billing/mark-paid",
  requireRole("admin"),
  async (c) => {
    const body = await c.req.json<{
      tenant_id?: string;
      plan_id?: string;
    }>();

    if (!body.tenant_id || !body.plan_id) {
      return c.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: "tenant_id and plan_id are required",
          },
        },
        400,
      );
    }

    const result = await markPaymentCompleted(body.tenant_id, body.plan_id);

    if (!result.success) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Plan not found" } },
        404,
      );
    }

    return c.json({
      data: { success: true, invoice_id: result.invoiceId },
      meta: {
        request_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    });
  },
);

/**
 * Webhook route — mounted separately without auth.
 */
export const billingWebhookRouter = new Hono<AppEnv>();

// POST /billing/webhook — handle payment provider webhook (no auth)
billingWebhookRouter.post("/billing/webhook", async (c) => {
  const signature = c.req.header("stripe-signature") ?? "";
  const payload = await c.req.json();

  const result = await handlePayment(payload, signature);

  return c.json({ received: true, event: result.event });
});
