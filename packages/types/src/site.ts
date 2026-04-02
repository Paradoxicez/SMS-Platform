import { z } from "zod";

export const siteSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  address: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  timezone: z.string().max(63).default("UTC"),
  default_profile_id: z.string().uuid().nullable().optional(),
  default_policy_id: z.string().uuid().nullable().optional(),
  created_at: z.coerce.date(),
});

export type Site = z.infer<typeof siteSchema>;

export const createSiteSchema = z.object({
  project_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  address: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  timezone: z.string().max(63).optional(),
  default_profile_id: z.string().uuid().optional(),
  default_policy_id: z.string().uuid().optional(),
});

export type CreateSiteInput = z.infer<typeof createSiteSchema>;

export const updateSiteSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  address: z.string().nullable().optional(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  timezone: z.string().max(63).optional(),
  default_profile_id: z.string().uuid().nullable().optional(),
  default_policy_id: z.string().uuid().nullable().optional(),
});

export type UpdateSiteInput = z.infer<typeof updateSiteSchema>;
