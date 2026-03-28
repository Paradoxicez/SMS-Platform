import type { PaymentAdapter } from "./adapter";

const STRIPE_SECRET_KEY = process.env["STRIPE_SECRET_KEY"];
const STRIPE_WEBHOOK_SECRET = process.env["STRIPE_WEBHOOK_SECRET"];
const STRIPE_API_BASE = "https://api.stripe.com/v1";

/**
 * Stripe payment adapter.
 * Uses the Stripe REST API via fetch (no SDK dependency).
 * If STRIPE_SECRET_KEY is not set, methods log a TODO and return stubs.
 */
export class StripeAdapter implements PaymentAdapter {
  private async stripeRequest(
    path: string,
    method: string = "GET",
    body?: URLSearchParams,
  ): Promise<unknown> {
    if (!STRIPE_SECRET_KEY) {
      console.warn(
        `[StripeAdapter] STRIPE_SECRET_KEY not set — skipping ${method} ${path}`,
      );
      return null;
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
    };
    if (body) {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
    }

    const res = await fetch(`${STRIPE_API_BASE}${path}`, {
      method,
      headers,
      body: body?.toString(),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`Stripe API error (${res.status}): ${errorBody}`);
    }

    return res.json();
  }

  async createCheckoutSession(
    tenantId: string,
    planId: string,
  ): Promise<{ url: string }> {
    if (!STRIPE_SECRET_KEY) {
      console.warn(
        "[StripeAdapter] TODO: STRIPE_SECRET_KEY not configured. Returning placeholder URL.",
      );
      return { url: `/billing?plan=${planId}&tenant=${tenantId}` };
    }

    const params = new URLSearchParams({
      "mode": "subscription",
      "success_url": `${process.env["APP_URL"] ?? "http://localhost:3000"}/billing?success=true`,
      "cancel_url": `${process.env["APP_URL"] ?? "http://localhost:3000"}/billing?cancelled=true`,
      "metadata[tenant_id]": tenantId,
      "metadata[plan_id]": planId,
      // In production, you'd map planId to a Stripe Price ID
      "line_items[0][price]": planId,
      "line_items[0][quantity]": "1",
    });

    const session = (await this.stripeRequest(
      "/checkout/sessions",
      "POST",
      params,
    )) as { url: string } | null;

    return { url: session?.url ?? `/billing?plan=${planId}` };
  }

  async handleWebhook(
    payload: unknown,
    _signature: string,
  ): Promise<{ event: string; tenantId?: string; planId?: string }> {
    if (!STRIPE_WEBHOOK_SECRET) {
      console.warn(
        "[StripeAdapter] TODO: STRIPE_WEBHOOK_SECRET not configured.",
      );
      return { event: "unknown" };
    }

    // In production, you'd verify the webhook signature here using
    // crypto.timingSafeEqual with the Stripe signing secret.
    // For now, parse the event type from the payload.
    const body = payload as {
      type?: string;
      data?: { object?: { metadata?: { tenant_id?: string; plan_id?: string } } };
    };

    return {
      event: body.type ?? "unknown",
      tenantId: body.data?.object?.metadata?.tenant_id,
      planId: body.data?.object?.metadata?.plan_id,
    };
  }

  async getSubscriptionStatus(
    _tenantId: string,
  ): Promise<{ active: boolean; plan: string; renewsAt?: string }> {
    if (!STRIPE_SECRET_KEY) {
      console.warn(
        "[StripeAdapter] TODO: STRIPE_SECRET_KEY not configured. Returning inactive.",
      );
      return { active: false, plan: "free" };
    }

    // In production, you'd look up the Stripe customer by tenant metadata
    // and get their active subscription. Stubbed for now.
    return { active: false, plan: "free" };
  }

  async cancelSubscription(tenantId: string): Promise<void> {
    if (!STRIPE_SECRET_KEY) {
      console.warn(
        "[StripeAdapter] TODO: STRIPE_SECRET_KEY not configured. Cannot cancel.",
      );
      return;
    }

    // In production, look up the Stripe subscription ID for this tenant
    // and call DELETE /subscriptions/:id
    console.log(
      `[StripeAdapter] TODO: Cancel subscription for tenant ${tenantId}`,
    );
  }
}
