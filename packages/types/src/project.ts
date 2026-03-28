import { z } from "zod";

export const projectSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().nullable(),
  default_policy_id: z.string().uuid().nullable(),
  viewer_hours_quota: z.number().int().nullable(),
  public_key: z.string().max(32),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

export type Project = z.infer<typeof projectSchema>;

export const createProjectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  default_policy_id: z.string().uuid().optional(),
  viewer_hours_quota: z.number().int().positive().optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  default_policy_id: z.string().uuid().nullable().optional(),
  viewer_hours_quota: z.number().int().positive().nullable().optional(),
});

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
