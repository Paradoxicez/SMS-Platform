import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { authMiddleware } from "./middleware/auth";
import { errorHandler } from "./middleware/error-handler";
import { loggerMiddleware } from "./middleware/logger";
import { tenantsRouter } from "./routes/tenants";
import { projectsRouter } from "./routes/projects";
import { sitesRouter } from "./routes/sites";
import { camerasRouter } from "./routes/cameras";
import { internalRouter } from "./routes/internal";
import { mapRouter } from "./routes/map";
import { policiesRouter } from "./routes/policies";
import { playbackRouter } from "./routes/playback";
import { usersRouter } from "./routes/users";
import { apiClientsRouter } from "./routes/api-clients";
import { auditRouter } from "./routes/audit";
import { healthRouter } from "./routes/health";
import { notificationsRouter } from "./routes/notifications";
import { invitationsRouter, publicInvitationsRouter } from "./routes/invitations";
import { mediamtxRouter } from "./routes/mediamtx";
import { forwardingRouter } from "./routes/forwarding";
import { streamProfilesRouter } from "./routes/stream-profiles";
import { startHealthSubscriber } from "./services/health-subscriber";
import { generateOpenApiSpec } from "./openapi";
import { authRouter } from "./routes/auth";
import { onboardingRouter } from "./routes/onboarding";
import { plansRouter } from "./routes/plans";
import { licenseRouter } from "./routes/license";
import { billingRouter, billingWebhookRouter } from "./routes/billing";
import { initLicenseChecker } from "./middleware/license";
import { startHeartbeat, stopHeartbeat } from "./services/license-heartbeat";
import { webhooksRouter } from "./routes/webhooks";
import { dataManagementRouter } from "./routes/data-management";
import { developerRouter } from "./routes/developer";
import { recordingsRouter } from "./routes/recordings";
import { aiIntegrationsRouter } from "./routes/ai-integrations";
import { redis } from "./lib/redis";
import { stopHealthSubscriber } from "./services/health-subscriber";
import { toSnakeCase } from "./lib/case-transform";
import { startStreamSync, stopStreamSync } from "./services/stream-sync";
import { systemMetricsRouter } from "./routes/system-metrics";
import { streamProxyRouter } from "./routes/stream-proxy";
import { startMetricsCollector, stopMetricsCollector } from "./services/system-metrics";
import type { AppEnv } from "./types";

const app = new Hono<AppEnv>();

// CORS — allow console-web to call API
app.use(
  "*",
  cors({
    origin: process.env["CORS_ORIGIN"] ?? "http://localhost:3000",
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-API-Key"],
    exposeHeaders: ["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"],
    credentials: true,
    maxAge: 86400,
  }),
);

// Global error handler
app.onError(errorHandler);

// Transform camelCase responses to snake_case (API convention)
app.use("*", async (c, next) => {
  await next();
  if (c.res.headers.get("content-type")?.includes("application/json")) {
    try {
      const body = await c.res.json();
      const transformed = toSnakeCase(body);
      c.res = new Response(JSON.stringify(transformed), {
        status: c.res.status,
        headers: c.res.headers,
      });
    } catch {
      // Not JSON or already consumed — skip
    }
  }
});

// Structured logging middleware
app.use("*", loggerMiddleware);

// Health / readiness / metrics (no auth required)
app.route("/", healthRouter);

// Internal routes (use shared-secret auth, not OIDC)
app.route("/internal", internalRouter);

// Public routes (no auth required)
app.route("/map", mapRouter);
app.route("/api/v1", publicInvitationsRouter); // public invitation accept/validate
app.route("/api/v1", authRouter); // public auth routes (register, verify)
app.route("/api/v1", plansRouter); // public plans listing (for pricing page)
app.route("/api/v1", billingWebhookRouter); // payment webhook (no auth)

// System metrics (no auth — SSE doesn't support custom headers)
app.route("/api/v1/system", systemMetricsRouter);

// Stream proxy (no auth — token in URL is the auth)
app.route("/api/v1", streamProxyRouter);

// OpenAPI docs (no auth required)
app.get("/api/v1/docs", (c) => {
  return c.json(generateOpenApiSpec());
});

// Apply auth middleware for all /api routes
const api = new Hono<AppEnv>();
api.use("/*", authMiddleware);

// Mount routes under /api/v1
api.route("/tenants", tenantsRouter);
api.route("/projects", projectsRouter);
api.route("/", sitesRouter); // handles /projects/:projectId/sites and /sites/:id
api.route("/", camerasRouter); // handles /sites/:siteId/cameras and /cameras/*
api.route("/playback", playbackRouter); // handles /playback/sessions/*
api.route("/policies", policiesRouter);
api.route("/", usersRouter); // handles /users/*
api.route("/", apiClientsRouter); // handles /api-clients/*
api.route("/", auditRouter); // handles /audit/*
api.route("/", notificationsRouter); // handles /notifications/*
api.route("/", invitationsRouter); // handles /users/invite, /users/invitations
api.route("/", mediamtxRouter); // handles /mediamtx/*
api.route("/", forwardingRouter); // handles /forwarding/*
api.route("/", streamProfilesRouter); // handles /stream-profiles/*
api.route("/", onboardingRouter); // handles /onboarding/*
api.route("/", licenseRouter); // handles /license/*
api.route("/", billingRouter); // handles /billing/*
api.route("/", webhooksRouter); // handles /webhooks/*
api.route("/", dataManagementRouter); // handles /data/*
api.route("/", developerRouter); // handles /developer/*
api.route("/", recordingsRouter); // handles /cameras/:id/recording/*, /recordings/*
api.route("/", aiIntegrationsRouter); // handles /ai-integrations/*
app.route("/api/v1", api);

// Legacy root endpoint
app.get("/", (c) => {
  return c.json({ message: "api-control running" });
});

const port = 3001;

serve({ fetch: app.fetch, port }, () => {
  console.log(`api-control listening on http://localhost:${port}`);
});

// Start Redis health subscriber (non-blocking)
try {
  startHealthSubscriber();
} catch (err) {
  console.error("Failed to start health subscriber:", err);
}

// Start stream sync — auto-recover cameras when MediaMTX restarts
startStreamSync();

// Start system metrics collector (every 60s)
startMetricsCollector(60_000);

// Initialize license checker for on-prem deployments (non-blocking)
initLicenseChecker()
  .then(() => {
    // Start heartbeat after license is loaded
    startHeartbeat();
  })
  .catch((err) => {
    console.error("Failed to initialize license checker:", err);
  });

// T282: Graceful shutdown handler
function gracefulShutdown(signal: string) {
  console.log(
    JSON.stringify({
      level: "info",
      service: "api-control",
      message: `Received ${signal}, shutting down gracefully...`,
    }),
  );

  stopStreamSync();
  stopMetricsCollector();
  stopHeartbeat();
  // Stop accepting new connections and wait for in-flight requests
  const shutdownTimeout = setTimeout(() => {
    console.log(
      JSON.stringify({
        level: "warn",
        service: "api-control",
        message: "Shutdown timeout reached, forcing exit",
      }),
    );
    process.exit(1);
  }, 30000);

  // Clean up resources
  stopHealthSubscriber();
  redis.disconnect();

  clearTimeout(shutdownTimeout);
  process.exit(0);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

export default app;
