import { z } from "zod";

export const outputProtocolSchema = z.enum(["hls", "webrtc", "both"]);
export type OutputProtocol = z.infer<typeof outputProtocolSchema>;

export const audioModeSchema = z.enum(["include", "strip", "mute"]);
export type AudioMode = z.infer<typeof audioModeSchema>;

export const outputResolutionSchema = z.enum([
  "original", "2160p", "1440p", "1080p", "720p", "480p", "360p", "240p",
]);
export type OutputResolution = z.infer<typeof outputResolutionSchema>;

export const outputCodecSchema = z.enum(["h264", "passthrough", "copy"]);
export type OutputCodec = z.infer<typeof outputCodecSchema>;

export const streamProfileSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().nullable(),
  output_protocol: outputProtocolSchema.default("hls"),
  audio_mode: audioModeSchema.default("include"),
  max_framerate: z.number().int().min(0).max(120).default(0),
  output_resolution: outputResolutionSchema.default("original"),
  output_codec: outputCodecSchema.default("h264"),
  keyframe_interval: z.number().int().min(1).max(10).default(2),
  is_default: z.boolean().default(false),
  version: z.number().int().default(1),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

export type StreamProfile = z.infer<typeof streamProfileSchema>;

export const createStreamProfileSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  output_protocol: outputProtocolSchema.default("hls"),
  audio_mode: audioModeSchema.default("include"),
  max_framerate: z.number().int().min(0).max(120).default(0),
  output_resolution: outputResolutionSchema.default("original"),
  output_codec: outputCodecSchema.default("h264"),
  keyframe_interval: z.number().int().min(1).max(10).default(2),
});

export type CreateStreamProfileInput = z.infer<typeof createStreamProfileSchema>;

export const updateStreamProfileSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  output_protocol: outputProtocolSchema.optional(),
  audio_mode: audioModeSchema.optional(),
  max_framerate: z.number().int().min(0).max(120).optional(),
  output_resolution: outputResolutionSchema.optional(),
  output_codec: outputCodecSchema.optional(),
  keyframe_interval: z.number().int().min(1).max(10).optional(),
  is_default: z.boolean().optional(),
  version: z.number().int(),
});

export type UpdateStreamProfileInput = z.infer<typeof updateStreamProfileSchema>;
