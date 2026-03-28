import { eq, desc } from "drizzle-orm";
import type { PaymentAdapter } from "./adapter";
import { StripeAdapter } from "./stripe-adapter";
import { ManualAdapter } from "./manual-adapter";
import { db } from "../../db/client";
import { tenants, subscriptionPlans, invoices, payments } from "../../db/schema";

/**
 * Select the payment adapter based on the PAYMENT_PROVIDER environment variable.
 * Defaults to manual.
 */
export function getPaymentAdapter(): PaymentAdapter {
  const provider = process.env["PAYMENT_PROVIDER"] ?? "manual";

  switch (provider) {
    case "stripe":
      return new StripeAdapter();
    case "manual":
    default:
      return new ManualAdapter();
  }
}

/**
 * Create a subscription by generating a checkout session.
 */
export async function createSubscription(
  tenantId: string,
  planId: string,
): Promise<{ url: string }> {
  const adapter = getPaymentAdapter();
  return adapter.createCheckoutSession(tenantId, planId);
}

/**
 * Handle incoming payment webhook from the configured provider.
 */
export async function handlePayment(
  payload: unknown,
  signature: string,
): Promise<{ event: string; tenantId?: string; planId?: string }> {
  const adapter = getPaymentAdapter();
  const result = await adapter.handleWebhook(payload, signature);

  // On successful payment, update the tenant's plan
  if (
    result.event === "checkout.session.completed" &&
    result.tenantId &&
    result.planId
  ) {
    const plan = await db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.id, result.planId),
    });

    if (plan) {
      await db
        .update(tenants)
        .set({
          subscriptionPlanId: result.planId,
          subscriptionTier: plan.name as
            | "free"
            | "starter"
            | "pro"
            | "enterprise",
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, result.tenantId));

      // Create invoice record
      const [invoice] = await db
        .insert(invoices)
        .values({
          tenantId: result.tenantId,
          planId: result.planId,
          amountCents: plan.priceCents,
          status: "paid",
          paymentMethod: "stripe",
          paidAt: new Date(),
        })
        .returning();

      if (invoice) {
        await db.insert(payments).values({
          invoiceId: invoice.id,
          provider: "stripe",
          amountCents: plan.priceCents,
          status: "completed",
        });
      }
    }
  }

  return result;
}

/**
 * Get invoices for a tenant.
 */
export async function getInvoices(tenantId: string) {
  return db.query.invoices.findMany({
    where: eq(invoices.tenantId, tenantId),
    orderBy: [desc(invoices.createdAt)],
  });
}
