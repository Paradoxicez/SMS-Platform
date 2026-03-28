import { z, type ZodTypeAny } from "zod";

export const metaSchema = z.object({
  request_id: z.string(),
  timestamp: z.coerce.date(),
});

export type Meta = z.infer<typeof metaSchema>;

export const paginationSchema = z.object({
  page: z.number().int(),
  per_page: z.number().int(),
  total: z.number().int(),
  total_pages: z.number().int(),
});

export type Pagination = z.infer<typeof paginationSchema>;

export function successEnvelope<T extends ZodTypeAny>(dataSchema: T) {
  return z.object({
    data: dataSchema,
    meta: metaSchema,
  });
}

export function paginatedEnvelope<T extends ZodTypeAny>(dataSchema: T) {
  return z.object({
    data: z.array(dataSchema),
    meta: metaSchema,
    pagination: paginationSchema,
  });
}

export const errorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
  meta: metaSchema,
});

export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;

export const ErrorCode = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  RATE_LIMITED: "RATE_LIMITED",
  CAMERA_OFFLINE: "CAMERA_OFFLINE",
  PLAYBACK_SESSION_EXPIRED: "PLAYBACK_SESSION_EXPIRED",
  PLAYBACK_ORIGIN_DENIED: "PLAYBACK_ORIGIN_DENIED",
  PLAYBACK_QUOTA_EXCEEDED: "PLAYBACK_QUOTA_EXCEEDED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
