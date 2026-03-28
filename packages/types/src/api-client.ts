import { z } from "zod";

export const apiClientSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  user_id: z.string().uuid(),
  key_prefix: z.string().max(8),
  key_hash: z.string().max(128),
  label: z.string().min(1).max(255),
  rate_limit_override: z.number().int().nullable(),
  last_used_at: z.coerce.date().nullable(),
  revoked_at: z.coerce.date().nullable(),
  created_at: z.coerce.date(),
});

export type ApiClient = z.infer<typeof apiClientSchema>;

export const createApiClientSchema = z.object({
  label: z.string().min(1).max(255),
});

export type CreateApiClientInput = z.infer<typeof createApiClientSchema>;
