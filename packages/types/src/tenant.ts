import { z } from "zod";

export const subscriptionTierSchema = z.enum([
  "free",
  "starter",
  "pro",
  "enterprise",
]);

export type SubscriptionTier = z.infer<typeof subscriptionTierSchema>;

export const tenantSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(63),
  billing_email: z.string().email().max(255),
  subscription_tier: subscriptionTierSchema.default("free"),
  viewer_hours_quota: z.number().int().default(1000),
  egress_quota_bytes: z.number().int().default(107374182400),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

export type Tenant = z.infer<typeof tenantSchema>;

export const createTenantSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z
    .string()
    .min(1)
    .max(63)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Must be a URL-safe slug"),
  billing_email: z.string().email().max(255),
  subscription_tier: subscriptionTierSchema.optional(),
  viewer_hours_quota: z.number().int().positive().optional(),
  egress_quota_bytes: z.number().int().positive().optional(),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;

export const updateTenantSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  slug: z
    .string()
    .min(1)
    .max(63)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Must be a URL-safe slug")
    .optional(),
  billing_email: z.string().email().max(255).optional(),
  subscription_tier: subscriptionTierSchema.optional(),
  viewer_hours_quota: z.number().int().positive().optional(),
  egress_quota_bytes: z.number().int().positive().optional(),
});

export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
