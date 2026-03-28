import { eq } from "drizzle-orm";
import type { PaymentAdapter } from "./adapter";
import { db } from "../../db/client";
import { tenants, subscriptionPlans, invoices, payments } from "../../db/schema";

/**
 * Manual payment adapter for bank transfer / offline payments.
 * Subscription activation is done manually by an admin via the mark-paid endpoint.
 */
export class ManualAdapter implements PaymentAdapter {
  async createCheckoutSession(
    _tenantId: string,
    _planId: string,
  ): Promise<{ url: string }> {
    // Redirect to a page showing bank transfer details
    return { url: "/billing/manual-payment" };
  }

  async handleWebhook(
    _payload: unknown,
    _signature: string,
  ): Promise<{ event: string; tenantId?: string; planId?: string }> {
    // Not applicable for manual payments
    return { event: "not_applicable" };
  }

  async getSubscriptionStatus(
    tenantId: string,
  ): Promise<{ active: boolean; plan: string; renewsAt?: string }> {
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
    });

    if (!tenant || !tenant.subscriptionPlanId) {
      return { active: true, plan: "free" };
    }

    const plan = await db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.id, tenant.subscriptionPlanId),
    });

    return {
      active: true,
      plan: plan?.name ?? "free",
    };
  }

  async cancelSubscription(_tenantId: string): Promise<void> {
    // For manual payments, cancellation means reverting to the free plan.
    // This would be handled by an admin action.
    console.log(
      "[ManualAdapter] Cancellation for manual payment requires admin action.",
    );
  }
}

/**
 * Mark a tenant's payment as completed (admin action).
 * Updates the tenant's plan and creates an invoice record.
 */
export async function markPaymentCompleted(
  tenantId: string,
  planId: string,
): Promise<{ success: boolean; invoiceId?: string }> {
  const plan = await db.query.subscriptionPlans.findFirst({
    where: eq(subscriptionPlans.id, planId),
  });

  if (!plan) {
    return { success: false };
  }

  // Update tenant's plan
  await db
    .update(tenants)
    .set({
      subscriptionPlanId: planId,
      subscriptionTier: plan.name as "free" | "starter" | "pro" | "enterprise",
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, tenantId));

  // Create invoice
  const [invoice] = await db
    .insert(invoices)
    .values({
      tenantId,
      planId,
      amountCents: plan.priceCents,
      status: "paid",
      paymentMethod: "manual",
      paidAt: new Date(),
    })
    .returning();

  // Create payment record
  if (invoice) {
    await db.insert(payments).values({
      invoiceId: invoice.id,
      provider: "manual",
      amountCents: plan.priceCents,
      status: "completed",
    });
  }

  return { success: true, invoiceId: invoice?.id };
}
