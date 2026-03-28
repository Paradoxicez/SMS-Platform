import { Hono } from "hono";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "../db/client";
import { cameras } from "../db/schema/cameras";
import { projects } from "../db/schema/projects";
import { sites } from "../db/schema/sites";
import { AppError } from "../middleware/error-handler";
import { checkQuota } from "../services/quota";
import { issueSession } from "../services/playback";
import { rateLimitMiddleware } from "../middleware/rate-limit";

const mapRouter = new Hono();

/**
 * T084: Map API route
 *
 * GET /map/cameras?project_key={key}
 * Public endpoint (no auth middleware) — returns cameras with map_visible=true
 * for a given project, including thumbnail URLs.
 */
mapRouter.get("/cameras", async (c) => {
  const projectKey = c.req.query("project_key");

  if (!projectKey) {
    throw new AppError(
      "VALIDATION_ERROR",
      "project_key query parameter is required",
      422,
    );
  }

  // Look up the project by public_key
  const project = await db.query.projects.findFirst({
    where: eq(projects.publicKey, projectKey),
  });

  if (!project) {
    throw new AppError("NOT_FOUND", "Project not found", 404);
  }

  // Check tenant viewer-hours quota
  const quota = await checkQuota(project.tenantId, project.id);

  // Fetch all sites belonging to this project
  const projectSites = await db
    .select({ id: sites.id })
    .from(sites)
    .where(eq(sites.projectId, project.id));

  const siteIds = projectSites.map((s) => s.id);

  if (siteIds.length === 0) {
    return c.json({
      data: [],
      meta: {
        request_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        quota: {
          allowed: quota.allowed,
          remaining: quota.remaining,
          limit: quota.limit,
        },
      },
    });
  }

  // Fetch cameras with map_visible=true across all project sites
  const result = await db
    .select({
      id: cameras.id,
      name: cameras.name,
      lat: cameras.lat,
      lng: cameras.lng,
      status: cameras.healthStatus,
      thumbnail_url: cameras.thumbnailUrl,
      tags: cameras.tags,
      site_name: sites.name,
      created_at: cameras.createdAt,
    })
    .from(cameras)
    .leftJoin(sites, eq(cameras.siteId, sites.id))
    .where(
      and(
        eq(cameras.mapVisible, true),
        eq(cameras.tenantId, project.tenantId),
        inArray(cameras.siteId, siteIds),
      ),
    );

  return c.json({
    data: result,
    meta: {
      request_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      quota: {
        allowed: quota.allowed,
        remaining: quota.remaining,
        limit: quota.limit,
      },
    },
  });
});

/**
 * POST /map/playback/sessions
 * Public playback session endpoint — authenticates via project_key instead of JWT.
 * Verifies the camera belongs to the project before issuing a session.
 */
mapRouter.post("/playback/sessions", rateLimitMiddleware, async (c) => {
  const body = await c.req.json();
  const projectKey = body.project_key as string | undefined;
  const cameraId = body.camera_id as string | undefined;
  const ttl = (body.ttl as number | undefined) ?? 120;
  const embedOrigin = body.embed_origin as string | undefined;

  if (!projectKey) {
    throw new AppError("VALIDATION_ERROR", "project_key is required", 422);
  }
  if (!cameraId) {
    throw new AppError("VALIDATION_ERROR", "camera_id is required", 422);
  }

  // Look up the project by public_key
  const project = await db.query.projects.findFirst({
    where: eq(projects.publicKey, projectKey),
  });

  if (!project) {
    throw new AppError("NOT_FOUND", "Project not found", 404);
  }

  // Verify camera belongs to this project's sites
  const projectSites = await db
    .select({ id: sites.id })
    .from(sites)
    .where(eq(sites.projectId, project.id));

  const siteIds = projectSites.map((s) => s.id);

  if (siteIds.length === 0) {
    throw new AppError("NOT_FOUND", "Camera not found in this project", 404);
  }

  const camera = await db.query.cameras.findFirst({
    where: and(
      eq(cameras.id, cameraId),
      eq(cameras.tenantId, project.tenantId),
      inArray(cameras.siteId, siteIds),
    ),
  });

  if (!camera) {
    throw new AppError("NOT_FOUND", "Camera not found in this project", 404);
  }

  const viewerIp =
    c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip");

  const result = await issueSession({
    cameraId,
    ttl,
    embedOrigin,
    tenantId: project.tenantId,
    apiClientId: project.id,
    viewerIp,
  });

  return c.json(
    {
      data: result,
      meta: {
        request_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    },
    201,
  );
});

export { mapRouter };
