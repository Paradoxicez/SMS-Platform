import { eq, and } from "drizzle-orm";
import { db, withTenantContext } from "../db/client";
import { policies } from "../db/schema/policies";
import { cameras } from "../db/schema/cameras";
import { projects } from "../db/schema/projects";
import { sites } from "../db/schema/sites";
import { AppError } from "../middleware/error-handler";
import { logAuditEvent } from "./audit";
import type { CreatePolicyInput, UpdatePolicyInput } from "@repo/types";

/**
 * T097: Policy service
 *
 * CRUD operations for playback policies with OCC (optimistic concurrency control),
 * audit logging, and policy resolution chain.
 */

/** System-level defaults when no policy is found */
const SYSTEM_DEFAULTS = {
  ttl_min: 60,
  ttl_max: 300,
  ttl_default: 120,
  rate_limit_per_min: 100,
  viewer_concurrency_limit: 50,
  domain_allowlist: null as string[] | null,
};

// ─── Create Policy ──────────────────────────────────────────────────────────

interface CreatePolicyParams {
  tenantId: string;
  data: CreatePolicyInput;
  actorId: string;
  sourceIp?: string;
}

export async function createPolicy(params: CreatePolicyParams) {
  const { tenantId, data, actorId, sourceIp } = params;

  const [policy] = await withTenantContext(tenantId, async (tx) => {
    return tx
      .insert(policies)
      .values({
        tenantId,
        name: data.name,
        ttlMin: data.ttl_min ?? 60,
        ttlMax: data.ttl_max ?? 300,
        ttlDefault: data.ttl_default ?? 120,
        domainAllowlist: data.domain_allowlist ?? null,
        rateLimitPerMin: data.rate_limit_per_min ?? 100,
        viewerConcurrencyLimit: data.viewer_concurrency_limit ?? 50,
      })
      .returning();
  });

  logAuditEvent({
    tenantId,
    actorType: "user",
    actorId,
    eventType: "policy.created",
    resourceType: "policy",
    resourceId: policy!.id,
    details: { name: data.name },
    sourceIp,
  });

  return policy!;
}

// ─── Update Policy (OCC) ────────────────────────────────────────────────────

interface UpdatePolicyParams {
  tenantId: string;
  id: string;
  data: UpdatePolicyInput;
  actorId: string;
  sourceIp?: string;
}

export async function updatePolicy(params: UpdatePolicyParams) {
  const { tenantId, id, data, actorId, sourceIp } = params;
  const { version, ...updates } = data;

  const setValues: Record<string, unknown> = {
    updatedAt: new Date(),
    version: version + 1,
  };

  if (updates.name !== undefined) setValues.name = updates.name;
  if (updates.ttl_min !== undefined) setValues.ttlMin = updates.ttl_min;
  if (updates.ttl_max !== undefined) setValues.ttlMax = updates.ttl_max;
  if (updates.ttl_default !== undefined)
    setValues.ttlDefault = updates.ttl_default;
  if (updates.domain_allowlist !== undefined)
    setValues.domainAllowlist = updates.domain_allowlist;
  if (updates.rate_limit_per_min !== undefined)
    setValues.rateLimitPerMin = updates.rate_limit_per_min;
  if (updates.viewer_concurrency_limit !== undefined)
    setValues.viewerConcurrencyLimit = updates.viewer_concurrency_limit;

  const [updated] = await withTenantContext(tenantId, async (tx) => {
    return tx
      .update(policies)
      .set(setValues)
      .where(
        and(
          eq(policies.id, id),
          eq(policies.tenantId, tenantId),
          eq(policies.version, version),
        ),
      )
      .returning();
  });

  if (!updated) {
    // Check whether the policy exists at all
    const existing = await db.query.policies.findFirst({
      where: and(eq(policies.id, id), eq(policies.tenantId, tenantId)),
    });

    if (!existing) {
      throw new AppError("NOT_FOUND", "Policy not found", 404);
    }

    throw new AppError(
      "CONFLICT",
      "Policy has been modified by another request. Please reload and retry.",
      409,
    );
  }

  logAuditEvent({
    tenantId,
    actorType: "user",
    actorId,
    eventType: "policy.updated",
    resourceType: "policy",
    resourceId: id,
    details: { changes: updates, from_version: version, to_version: version + 1 },
    sourceIp,
  });

  return updated;
}

// ─── Delete Policy ──────────────────────────────────────────────────────────

interface DeletePolicyParams {
  tenantId: string;
  id: string;
  actorId: string;
  sourceIp?: string;
}

export async function deletePolicy(params: DeletePolicyParams) {
  const { tenantId, id, actorId, sourceIp } = params;

  // Check the policy is not in use by cameras
  const cameraUsingPolicy = await db.query.cameras.findFirst({
    where: and(eq(cameras.policyId, id), eq(cameras.tenantId, tenantId)),
  });

  if (cameraUsingPolicy) {
    throw new AppError(
      "CONFLICT",
      "Policy is in use by one or more cameras and cannot be deleted",
      409,
    );
  }

  // Check the policy is not used as a project default
  const projectUsingPolicy = await db.query.projects.findFirst({
    where: and(
      eq(projects.defaultPolicyId, id),
      eq(projects.tenantId, tenantId),
    ),
  });

  if (projectUsingPolicy) {
    throw new AppError(
      "CONFLICT",
      "Policy is set as default for one or more projects and cannot be deleted",
      409,
    );
  }

  const [deleted] = await withTenantContext(tenantId, async (tx) => {
    return tx
      .delete(policies)
      .where(
        and(eq(policies.id, id), eq(policies.tenantId, tenantId)),
      )
      .returning();
  });

  if (!deleted) {
    throw new AppError("NOT_FOUND", "Policy not found", 404);
  }

  logAuditEvent({
    tenantId,
    actorType: "user",
    actorId,
    eventType: "policy.deleted",
    resourceType: "policy",
    resourceId: id,
    details: { name: deleted.name },
    sourceIp,
  });

  return deleted;
}

// ─── Get Effective Policy ───────────────────────────────────────────────────

export interface EffectivePolicy {
  ttl_min: number;
  ttl_max: number;
  ttl_default: number;
  rate_limit_per_min: number;
  viewer_concurrency_limit: number;
  domain_allowlist: string[] | null;
  source: "camera" | "site" | "project" | "system";
  policy_id?: string;
}

/**
 * Resolve the effective policy for a camera.
 * Resolution order: camera → site → project → system defaults
 */
export async function getEffectivePolicy(
  cameraId: string,
): Promise<EffectivePolicy> {
  const camera = await db.query.cameras.findFirst({
    where: eq(cameras.id, cameraId),
  });

  if (!camera) {
    return { ...SYSTEM_DEFAULTS, source: "system" };
  }

  // 1. Camera-level policy
  if (camera.policyId) {
    const policy = await db.query.policies.findFirst({
      where: eq(policies.id, camera.policyId),
    });
    if (policy) {
      return policyToEffective(policy, "camera");
    }
  }

  // 2. Site-level default policy
  const site = await db.query.sites.findFirst({
    where: eq(sites.id, camera.siteId),
  });

  if (site?.defaultPolicyId) {
    const policy = await db.query.policies.findFirst({
      where: eq(policies.id, site.defaultPolicyId),
    });
    if (policy) {
      return policyToEffective(policy, "site");
    }
  }

  // 3. Project-level default policy
  if (site) {
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, site.projectId),
    });

    if (project?.defaultPolicyId) {
      const policy = await db.query.policies.findFirst({
        where: eq(policies.id, project.defaultPolicyId),
      });
      if (policy) {
        return policyToEffective(policy, "project");
      }
    }
  }

  // 4. System defaults
  return { ...SYSTEM_DEFAULTS, source: "system" };
}

function policyToEffective(
  policy: { id: string; ttlMin: number; ttlMax: number; ttlDefault: number; rateLimitPerMin: number; viewerConcurrencyLimit: number; domainAllowlist: string[] | null },
  source: EffectivePolicy["source"],
): EffectivePolicy {
  return {
    ttl_min: policy.ttlMin,
    ttl_max: policy.ttlMax,
    ttl_default: policy.ttlDefault,
    rate_limit_per_min: policy.rateLimitPerMin,
    viewer_concurrency_limit: policy.viewerConcurrencyLimit,
    domain_allowlist: policy.domainAllowlist,
    source,
    policy_id: policy.id,
  };
}

// ─── List Policies ──────────────────────────────────────────────────────────

export async function listPolicies(tenantId: string) {
  return withTenantContext(tenantId, async (tx) => {
    return tx
      .select()
      .from(policies)
      .where(eq(policies.tenantId, tenantId))
      .orderBy(policies.createdAt);
  });
}

// ─── Get Policy ─────────────────────────────────────────────────────────────

export async function getPolicy(tenantId: string, id: string) {
  const policy = await db.query.policies.findFirst({
    where: and(eq(policies.id, id), eq(policies.tenantId, tenantId)),
  });

  if (!policy) {
    throw new AppError("NOT_FOUND", "Policy not found", 404);
  }

  return policy;
}
