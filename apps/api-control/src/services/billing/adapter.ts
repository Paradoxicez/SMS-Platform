/**
 * Payment adapter interface for billing integrations.
 * Implementations: StripeAdapter, ManualAdapter.
 */
export interface PaymentAdapter {
  /**
   * Create a checkout session for a tenant upgrading to a plan.
   * Returns a URL to redirect the user to.
   */
  createCheckoutSession(
    tenantId: string,
    planId: string,
  ): Promise<{ url: string }>;

  /**
   * Handle an incoming webhook payload from the payment provider.
   * Returns the parsed event info.
   */
  handleWebhook(
    payload: unknown,
    signature: string,
  ): Promise<{ event: string; tenantId?: string; planId?: string }>;

  /**
   * Get the current subscription status for a tenant.
   */
  getSubscriptionStatus(
    tenantId: string,
  ): Promise<{ active: boolean; plan: string; renewsAt?: string }>;

  /**
   * Cancel a tenant's subscription.
   */
  cancelSubscription(tenantId: string): Promise<void>;
}
