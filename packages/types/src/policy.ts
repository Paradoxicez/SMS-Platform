import { z } from "zod";

export const policySchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  ttl_min: z.number().int().default(60),
  ttl_max: z.number().int().default(300),
  ttl_default: z.number().int().default(120),
  domain_allowlist: z.array(z.string()).nullable(),
  rate_limit_per_min: z.number().int().default(100),
  viewer_concurrency_limit: z.number().int().default(50),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  version: z.number().int().default(1),
});

export type Policy = z.infer<typeof policySchema>;

export const createPolicySchema = z.object({
  name: z.string().min(1).max(255),
  ttl_min: z.number().int().positive().optional(),
  ttl_max: z.number().int().positive().optional(),
  ttl_default: z.number().int().positive().optional(),
  domain_allowlist: z.array(z.string()).optional(),
  rate_limit_per_min: z.number().int().positive().optional(),
  viewer_concurrency_limit: z.number().int().positive().optional(),
});

export type CreatePolicyInput = z.infer<typeof createPolicySchema>;

export const updatePolicySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  ttl_min: z.number().int().positive().optional(),
  ttl_max: z.number().int().positive().optional(),
  ttl_default: z.number().int().positive().optional(),
  domain_allowlist: z.array(z.string()).nullable().optional(),
  rate_limit_per_min: z.number().int().positive().optional(),
  viewer_concurrency_limit: z.number().int().positive().optional(),
  version: z.number().int(),
});

export type UpdatePolicyInput = z.infer<typeof updatePolicySchema>;
