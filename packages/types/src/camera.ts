import { z } from "zod";

export const healthStatusSchema = z.enum([
  "connecting",
  "online",
  "degraded",
  "offline",
  "reconnecting",
  "stopping",
  "stopped",
]);

export type HealthStatus = z.infer<typeof healthStatusSchema>;

export const cameraSchema = z.object({
  id: z.string().uuid(),
  site_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  rtsp_url: z.string().url(),
  credentials_encrypted: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  tags: z.array(z.string()).default([]),
  map_visible: z.boolean().default(false),
  health_status: healthStatusSchema.default("stopped"),
  policy_id: z.string().uuid().nullable(),
  thumbnail_url: z.string().url().nullable(),
  thumbnail_updated_at: z.coerce.date().nullable(),
  last_seen_at: z.coerce.date().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  version: z.number().int().default(1),
});

export type Camera = z.infer<typeof cameraSchema>;

export const createCameraSchema = z.object({
  site_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  rtsp_url: z.string().url(),
  credentials_encrypted: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  tags: z.array(z.string()).optional(),
  map_visible: z.boolean().optional(),
  policy_id: z.string().uuid().optional(),
  profile_id: z.string().uuid().optional(),
});

export type CreateCameraInput = z.infer<typeof createCameraSchema>;

export const updateCameraSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  rtsp_url: z.string().url().optional(),
  credentials_encrypted: z.string().nullable().optional(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  tags: z.array(z.string()).optional(),
  map_visible: z.boolean().optional(),
  policy_id: z.string().uuid().nullable().optional(),
  profile_id: z.string().uuid().nullable().optional(),
  version: z.number().int(),
});

export type UpdateCameraInput = z.infer<typeof updateCameraSchema>;
