import { describe, it, expect } from "vitest";
import {
  PLAN_DEFINITIONS,
  resolveFeatures,
  resolveLimits,
  hasFeature,
  ALL_FEATURES,
} from "../plan-definitions";
import type { PlanTier } from "../plan-definitions";

describe("plan-definitions", () => {
  describe("PLAN_DEFINITIONS", () => {
    it("should define all 4 plan tiers", () => {
      const tiers: PlanTier[] = ["free", "starter", "pro", "enterprise"];
      for (const tier of tiers) {
        expect(PLAN_DEFINITIONS[tier]).toBeDefined();
        expect(PLAN_DEFINITIONS[tier].displayName).toBeTruthy();
        expect(PLAN_DEFINITIONS[tier].features.length).toBeGreaterThan(0);
      }
    });

    it("free plan should only have hls", () => {
      expect(PLAN_DEFINITIONS.free.features).toEqual(["hls"]);
    });

    it("enterprise should include all features", () => {
      expect(PLAN_DEFINITIONS.enterprise.features).toEqual(
        expect.arrayContaining([...ALL_FEATURES]),
      );
    });

    it("free plan should have lowest limits", () => {
      expect(PLAN_DEFINITIONS.free.defaultLimits.cameras).toBe(3);
      expect(PLAN_DEFINITIONS.free.defaultLimits.projects).toBe(1);
      expect(PLAN_DEFINITIONS.free.defaultLimits.users).toBe(2);
    });
  });

  describe("resolveFeatures", () => {
    it("should return base features for plan without addons", () => {
      const features = resolveFeatures("free");
      expect(features).toEqual(["hls"]);
    });

    it("should merge addons into features", () => {
      const features = resolveFeatures("free", ["recording", "ai"]);
      expect(features).toContain("hls");
      expect(features).toContain("recording");
      expect(features).toContain("ai");
    });

    it("should deduplicate features from plan and addons", () => {
      const features = resolveFeatures("starter", ["hls", "embed"]);
      const hlsCount = features.filter((f) => f === "hls").length;
      expect(hlsCount).toBe(1);
    });

    it("enterprise should return all features regardless of addons", () => {
      const features = resolveFeatures("enterprise");
      expect(features.length).toBe(ALL_FEATURES.length);
    });
  });

  describe("resolveLimits", () => {
    it("should return plan defaults when no overrides", () => {
      const limits = resolveLimits("pro");
      expect(limits.cameras).toBe(500);
      expect(limits.projects).toBe(10);
    });

    it("should apply overrides", () => {
      const limits = resolveLimits("pro", { cameras: 1000 });
      expect(limits.cameras).toBe(1000);
      expect(limits.projects).toBe(10); // unchanged
    });

    it("should fallback to free defaults for unknown plan", () => {
      const limits = resolveLimits("unknown" as PlanTier);
      expect(limits.cameras).toBe(3);
    });
  });

  describe("hasFeature", () => {
    it("should return true for included feature", () => {
      expect(hasFeature("pro", "webrtc")).toBe(true);
    });

    it("should return false for excluded feature", () => {
      expect(hasFeature("free", "webrtc")).toBe(false);
    });

    it("should return true when feature is added via addon", () => {
      expect(hasFeature("free", "recording", ["recording"])).toBe(true);
    });

    it("enterprise should have all features", () => {
      for (const feature of ALL_FEATURES) {
        expect(hasFeature("enterprise", feature)).toBe(true);
      }
    });
  });
});
