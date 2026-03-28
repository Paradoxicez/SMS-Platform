import { z } from "zod";

export const streamSchema = z.object({
  id: z.string().uuid(),
  camera_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  ingest_node_id: z.string().max(63),
  codec: z.string().max(16).nullable(),
  resolution: z.string().max(16).nullable(),
  bitrate_kbps: z.number().int().nullable(),
  started_at: z.coerce.date(),
  last_segment_at: z.coerce.date().nullable(),
});

export type Stream = z.infer<typeof streamSchema>;
