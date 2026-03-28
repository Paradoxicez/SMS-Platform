import { z } from "zod";

export const actorTypeSchema = z.enum(["user", "api_client", "system"]);

export type ActorType = z.infer<typeof actorTypeSchema>;

export const eventTypes = [
  "session.issued",
  "session.refreshed",
  "session.revoked",
  "session.denied",
  "camera.status_changed",
  "user.role_changed",
  "policy.changed",
  "user.login",
  "user.login_failed",
] as const;

export const eventTypeSchema = z.enum(eventTypes);

export type EventType = z.infer<typeof eventTypeSchema>;

export const auditEventSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  timestamp: z.coerce.date(),
  actor_type: actorTypeSchema,
  actor_id: z.string().uuid().nullable(),
  event_type: z.string().max(63),
  resource_type: z.string().max(63).nullable(),
  resource_id: z.string().uuid().nullable(),
  details: z.unknown().nullable(),
  source_ip: z.string().nullable(),
});

export type AuditEvent = z.infer<typeof auditEventSchema>;

export const createAuditEventSchema = z.object({
  actor_type: actorTypeSchema,
  actor_id: z.string().uuid().optional(),
  event_type: z.string().max(63),
  resource_type: z.string().max(63).optional(),
  resource_id: z.string().uuid().optional(),
  details: z.unknown().optional(),
  source_ip: z.string().optional(),
});

export type CreateAuditEventInput = z.infer<typeof createAuditEventSchema>;
