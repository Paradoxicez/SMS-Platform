/**
 * Plan tier definitions — determines which features and limits each plan includes.
 * These are maintained in code (not DB) to prevent customers from modifying features.
 */

export type PlanTier = "free" | "starter" | "pro" | "enterprise";

export interface PlanLimits {
  cameras: number;
  projects: number;
  users: number;
  sites: number;
  apiKeys: number;
  viewerHours: number;
  retentionDays: number;
}

export interface PlanDefinition {
  displayName: string;
  features: string[];
  defaultLimits: PlanLimits;
}

export const ALL_FEATURES = [
  "hls",
  "webrtc",
  "embed",
  "api_access",
  "stream_profiles",
  "custom_profiles",
  "csv_import",
  "webhooks",
  "recording",
  "forwarding",
  "audit_log",
  "map_public",
  "ai",
  "sso",
  "multi_engine",
] as const;

export type FeatureFlag = (typeof ALL_FEATURES)[number];

const UNLIMITED = Number.MAX_SAFE_INTEGER;

export const PLAN_DEFINITIONS: Record<PlanTier, PlanDefinition> = {
  free: {
    displayName: "Free",
    features: ["hls"],
    defaultLimits: {
      cameras: 3,
      projects: 1,
      users: 2,
      sites: 1,
      apiKeys: 0,
      viewerHours: 100,
      retentionDays: 0,
    },
  },
  starter: {
    displayName: "Starter",
    features: [
      "hls",
      "stream_profiles",
      "embed",
      "api_access",
      "recording",
    ],
    defaultLimits: {
      cameras: 50,
      projects: 3,
      users: 5,
      sites: 5,
      apiKeys: 2,
      viewerHours: 1000,
      retentionDays: 7,
    },
  },
  pro: {
    displayName: "Pro",
    features: [
      "hls",
      "webrtc",
      "embed",
      "api_access",
      "stream_profiles",
      "custom_profiles",
      "csv_import",
      "webhooks",
      "recording",
      "forwarding",
      "audit_log",
      "map_public",
    ],
    defaultLimits: {
      cameras: 500,
      projects: 10,
      users: 20,
      sites: 30,
      apiKeys: 10,
      viewerHours: 10000,
      retentionDays: 30,
    },
  },
  enterprise: {
    displayName: "Enterprise",
    features: [...ALL_FEATURES],
    defaultLimits: {
      cameras: UNLIMITED,
      projects: UNLIMITED,
      users: UNLIMITED,
      sites: UNLIMITED,
      apiKeys: UNLIMITED,
      viewerHours: UNLIMITED,
      retentionDays: 90,
    },
  },
};

/**
 * Resolve effective features for a plan + addons.
 * Enterprise gets all features regardless of addons.
 */
export function resolveFeatures(plan: PlanTier, addons: string[] = []): string[] {
  const base = PLAN_DEFINITIONS[plan]?.features ?? PLAN_DEFINITIONS.free.features;
  if (plan === "enterprise") return [...ALL_FEATURES];
  const combined = new Set([...base, ...addons]);
  return [...combined];
}

/**
 * Resolve effective limits for a plan with optional overrides from license key.
 */
export function resolveLimits(
  plan: PlanTier,
  overrides: Partial<PlanLimits> = {},
): PlanLimits {
  const defaults = PLAN_DEFINITIONS[plan]?.defaultLimits ?? PLAN_DEFINITIONS.free.defaultLimits;
  return {
    cameras: overrides.cameras ?? defaults.cameras,
    projects: overrides.projects ?? defaults.projects,
    users: overrides.users ?? defaults.users,
    sites: overrides.sites ?? defaults.sites,
    apiKeys: overrides.apiKeys ?? defaults.apiKeys,
    viewerHours: overrides.viewerHours ?? defaults.viewerHours,
    retentionDays: overrides.retentionDays ?? defaults.retentionDays,
  };
}

/**
 * Check if a feature is available in a plan + addons.
 */
export function hasFeature(plan: PlanTier, feature: string, addons: string[] = []): boolean {
  const features = resolveFeatures(plan, addons);
  return features.includes(feature);
}
