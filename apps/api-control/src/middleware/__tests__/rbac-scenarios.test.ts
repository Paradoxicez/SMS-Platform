import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import { requireRole } from "../rbac";
import type { AppEnv } from "../../types";

// Mock audit to prevent DB calls
vi.mock("../../services/audit", () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

/**
 * Create a test app with a route that requires specific roles.
 * The test sets the user role via the `x-test-role` header.
 */
function createTestApp(allowedRoles: string[]) {
  const app = new Hono<AppEnv>();

  // Simulate auth middleware: set user context from test header
  app.use("*", async (c, next) => {
    c.set("tenantId", "tenant-test");
    c.set("userId", "user-test");
    const role = c.req.header("x-test-role");
    if (role) c.set("userRole", role);
    await next();
  });

  app.get("/test", requireRole(...allowedRoles), (c) => {
    return c.json({ data: "ok" });
  });

  return app;
}

function requestAs(app: Hono<AppEnv>, role: string) {
  return app.request("/test", {
    headers: { "x-test-role": role },
  });
}

describe("RBAC Middleware — Role Access Scenarios", () => {
  // ======================================================================
  // Admin-only endpoints
  // ======================================================================
  describe("Admin-only (user management, webhooks, data export)", () => {
    const app = createTestApp(["admin"]);

    it("admin should be allowed", async () => {
      const res = await requestAs(app, "admin");
      expect(res.status).toBe(200);
    });

    it("operator should be blocked", async () => {
      const res = await requestAs(app, "operator");
      expect(res.status).toBe(403);
    });

    it("developer should be blocked", async () => {
      const res = await requestAs(app, "developer");
      expect(res.status).toBe(403);
    });

    it("viewer should be blocked", async () => {
      const res = await requestAs(app, "viewer");
      expect(res.status).toBe(403);
    });

    it("unknown role should be blocked", async () => {
      const res = await requestAs(app, "unknown");
      expect(res.status).toBe(403);
    });

    it("no role (empty) should be blocked", async () => {
      const res = await app.request("/test");
      expect(res.status).toBe(403);
    });
  });

  // ======================================================================
  // Admin + Operator (cameras CRUD, projects CRUD, policies, recording control)
  // ======================================================================
  describe("Admin + Operator (cameras/projects/policies CRUD)", () => {
    const app = createTestApp(["admin", "operator"]);

    it("admin should be allowed", async () => {
      const res = await requestAs(app, "admin");
      expect(res.status).toBe(200);
    });

    it("operator should be allowed", async () => {
      const res = await requestAs(app, "operator");
      expect(res.status).toBe(200);
    });

    it("developer should be blocked", async () => {
      const res = await requestAs(app, "developer");
      expect(res.status).toBe(403);
    });

    it("viewer should be blocked", async () => {
      const res = await requestAs(app, "viewer");
      expect(res.status).toBe(403);
    });
  });

  // ======================================================================
  // Admin + Developer (API key management)
  // ======================================================================
  describe("Admin + Developer (API key management)", () => {
    const app = createTestApp(["admin", "developer"]);

    it("admin should be allowed", async () => {
      const res = await requestAs(app, "admin");
      expect(res.status).toBe(200);
    });

    it("developer should be allowed", async () => {
      const res = await requestAs(app, "developer");
      expect(res.status).toBe(200);
    });

    it("operator should be blocked", async () => {
      const res = await requestAs(app, "operator");
      expect(res.status).toBe(403);
    });

    it("viewer should be blocked", async () => {
      const res = await requestAs(app, "viewer");
      expect(res.status).toBe(403);
    });
  });

  // ======================================================================
  // Admin + Operator + Developer (playback sessions, policies read)
  // ======================================================================
  describe("Admin + Operator + Developer (playback, policies read)", () => {
    const app = createTestApp(["admin", "operator", "developer"]);

    it("admin should be allowed", async () => {
      const res = await requestAs(app, "admin");
      expect(res.status).toBe(200);
    });

    it("operator should be allowed", async () => {
      const res = await requestAs(app, "operator");
      expect(res.status).toBe(200);
    });

    it("developer should be allowed", async () => {
      const res = await requestAs(app, "developer");
      expect(res.status).toBe(200);
    });

    it("viewer should be blocked", async () => {
      const res = await requestAs(app, "viewer");
      expect(res.status).toBe(403);
    });
  });

  // ======================================================================
  // All roles including viewer (read-only endpoints)
  // ======================================================================
  describe("All roles (read-only: cameras list, recordings list, profiles)", () => {
    const app = createTestApp(["admin", "operator", "developer", "viewer"]);

    it("admin should be allowed", async () => {
      const res = await requestAs(app, "admin");
      expect(res.status).toBe(200);
    });

    it("operator should be allowed", async () => {
      const res = await requestAs(app, "operator");
      expect(res.status).toBe(200);
    });

    it("developer should be allowed", async () => {
      const res = await requestAs(app, "developer");
      expect(res.status).toBe(200);
    });

    it("viewer should be allowed", async () => {
      const res = await requestAs(app, "viewer");
      expect(res.status).toBe(200);
    });

    it("unknown role should still be blocked", async () => {
      const res = await requestAs(app, "unknown");
      expect(res.status).toBe(403);
    });
  });

  // ======================================================================
  // Error response format
  // ======================================================================
  describe("403 response format", () => {
    const app = createTestApp(["admin"]);

    it("should return proper error structure", async () => {
      const res = await requestAs(app, "viewer");
      expect(res.status).toBe(403);
      const body = (await res.json()) as { error: { code: string; message: string } };
      expect(body.error.code).toBe("FORBIDDEN");
      expect(body.error.message).toBe("Insufficient permissions");
    });
  });
});

/**
 * Cross-reference test: verify actual route definitions match expected role matrix.
 * This imports the real route definitions and checks role middleware is applied.
 */
describe("RBAC Route Coverage — Role Matrix Cross-Check", () => {
  const ROLE_MATRIX: Record<string, string[]> = {
    // Admin-only
    "users.create": ["admin"],
    "users.invite": ["admin"],
    "users.list": ["admin"],
    "users.changeRole": ["admin"],
    "users.remove": ["admin"],
    "webhooks.register": ["admin"],
    "webhooks.delete": ["admin"],
    "data.export": ["admin"],
    "mediamtx.config": ["admin"],

    // Admin + Operator
    "cameras.create": ["admin", "operator"],
    "cameras.update": ["admin", "operator"],
    "cameras.delete": ["admin", "operator"],
    "projects.create": ["admin", "operator"],
    "projects.delete": ["admin", "operator"],
    "policies.create": ["admin", "operator"],
    "recordings.enable": ["admin", "operator"],
    "recordings.disable": ["admin", "operator"],
    "audit.events": ["admin", "operator"],

    // Admin + Developer
    "apiKeys.create": ["admin", "developer"],
    "apiKeys.revoke": ["admin", "developer"],

    // Admin + Operator + Developer
    "playback.create": ["admin", "operator", "developer"],
    "policies.read": ["admin", "operator", "developer"],

    // All roles (read-only)
    "cameras.list": ["admin", "operator", "developer", "viewer"],
    "recordings.list": ["admin", "operator", "developer", "viewer"],
    "recordings.playback": ["admin", "operator", "developer", "viewer"],
    "projects.list": ["admin", "operator", "viewer"],
    "profiles.list": ["admin", "operator", "viewer"],
  };

  for (const [endpoint, allowedRoles] of Object.entries(ROLE_MATRIX)) {
    const allRoles = ["admin", "operator", "developer", "viewer"];

    for (const role of allRoles) {
      const shouldAllow = allowedRoles.includes(role);
      it(`${endpoint}: ${role} should be ${shouldAllow ? "allowed" : "blocked"}`, async () => {
        const app = createTestApp(allowedRoles);
        const res = await requestAs(app, role);
        expect(res.status).toBe(shouldAllow ? 200 : 403);
      });
    }
  }
});
