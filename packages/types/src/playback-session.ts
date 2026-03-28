import { z } from "zod";

export const playbackSessionStatusSchema = z.enum([
  "active",
  "expired",
  "revoked",
]);

export type PlaybackSessionStatus = z.infer<typeof playbackSessionStatusSchema>;

export const playbackSessionSchema = z.object({
  id: z.string().uuid(),
  camera_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  api_client_id: z.string().uuid(),
  issued_at: z.coerce.date(),
  expires_at: z.coerce.date(),
  allowed_origins: z.array(z.string()).nullable(),
  viewer_ip: z.string().nullable(),
  status: playbackSessionStatusSchema.default("active"),
  revoked_at: z.coerce.date().nullable(),
});

export type PlaybackSession = z.infer<typeof playbackSessionSchema>;

export const createPlaybackSessionSchema = z.object({
  camera_id: z.string().uuid(),
  ttl: z.number().int().min(60).max(300),
  embed_origin: z.string().optional(),
});

export type CreatePlaybackSessionInput = z.infer<
  typeof createPlaybackSessionSchema
>;

export const batchCreatePlaybackSessionSchema = z.object({
  camera_ids: z.array(z.string().uuid()).min(1),
  ttl: z.number().int().min(60).max(300),
  embed_origin: z.string().optional(),
});

export type BatchCreatePlaybackSessionInput = z.infer<
  typeof batchCreatePlaybackSessionSchema
>;
