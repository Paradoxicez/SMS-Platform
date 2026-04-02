import { Hono } from "hono";
import {
  verifyStreamToken,
  getStreamSecurityConfig,
} from "../services/stream-security";
import { redis } from "../lib/redis";
import type { AppEnv } from "../types";

const ORIGIN_BASE_URL =
  process.env["ORIGIN_BASE_URL"] ?? "http://localhost:8888";

const streamProxyRouter = new Hono<AppEnv>();

/**
 * GET /stream/:token/*
 *
 * Proxy HLS requests to MediaMTX with token validation.
 * URL format: /stream/{token}/index.m3u8 or /stream/{token}/segment.mp4
 */
streamProxyRouter.get("/stream/:token/*", async (c) => {
  const token = c.req.param("token");
  const path = c.req.path.replace(`/api/v1/stream/${token}`, "");

  // 1. Verify token
  const decoded = verifyStreamToken(token);
  if (!decoded) {
    return c.json({ error: { code: "STREAM_TOKEN_INVALID", message: "Invalid or expired stream token" } }, 403);
  }

  // 2. Check session still active in Redis
  const sessionKey = `session:${decoded.sessionId}`;
  const sessionData = await redis.get(sessionKey);
  if (!sessionData) {
    return c.json({ error: { code: "SESSION_EXPIRED", message: "Playback session expired" } }, 403);
  }

  // 3. Parse session to get tenant for CDN config
  const session = JSON.parse(sessionData) as {
    camera_id: string;
    tenant_id: string;
  };

  const secConfig = await getStreamSecurityConfig(session.tenant_id);

  // 4. Proxy to MediaMTX — try -hls (transcoded) then original, pick first that works
  const suffix = path || "/index.m3u8";
  const hlsUrl = `${ORIGIN_BASE_URL}/cam-${decoded.cameraId}-hls${suffix}`;
  const originalUrl = `${ORIGIN_BASE_URL}/cam-${decoded.cameraId}${suffix}`;

  try {
    // Try both paths — prefer -hls for transcoded, fallback to original
    let upstream = await fetch(hlsUrl);
    if (!upstream.ok) {
      upstream = await fetch(originalUrl);
    }
    if (!upstream.ok) {
      return c.json({ error: { code: "UPSTREAM_ERROR", message: "Stream not available" } }, upstream.status as 400 | 401 | 403 | 404 | 500 | 502 | 503 | 504);
    }

    const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
    const body = await upstream.arrayBuffer();

    // Set cache headers for CDN
    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Access-Control-Allow-Origin": "*",
    };

    if (secConfig.cdnEnabled) {
      // Short cache for segments, no cache for playlists
      if (path.endsWith(".m3u8")) {
        headers["Cache-Control"] = "public, max-age=1";
      } else {
        headers["Cache-Control"] = "public, max-age=10";
      }
    } else {
      headers["Cache-Control"] = "no-store";
    }

    return new Response(body, { status: 200, headers });
  } catch {
    return c.json({ error: { code: "UPSTREAM_ERROR", message: "Failed to fetch stream" } }, 502);
  }
});

export { streamProxyRouter };
