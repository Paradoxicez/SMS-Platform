"use client";

import { useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { getApiBaseUrl } from "@/lib/api-url";

const API_BASE = getApiBaseUrl();

const EMBED_BASE =
  typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:3000`
    : "http://localhost:3000";

// ── Snippet Definitions ─────────────────────────────────────────────────────

interface Snippet {
  title: string;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  description: string;
  code: string;
  response?: string;
}

const SECTIONS: {
  label: string;
  value: string;
  snippets: Snippet[];
}[] = [
  {
    label: "Playback",
    value: "playback",
    snippets: [
      {
        title: "Create Playback Session",
        method: "POST",
        path: "/playback/sessions",
        description:
          "Get an HLS playback URL for a camera. TTL is optional and defaults to the policy's ttl_default. The returned playback_url works with any HLS player (hls.js, Video.js, native Safari).",
        code: `curl -X POST ${API_BASE}/playback/sessions \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "camera_id": "CAMERA_ID",
    "ttl": 300,
    "embed_origin": "https://your-site.com"
  }'`,
        response: `{
  "data": {
    "session_id": "a1b2c3d4-...",
    "playback_url": "http://host/cam-.../index.m3u8",
    "protocol": "hls",
    "codec": "h264",
    "ttl": 300,
    "expires_at": "2026-03-31T12:05:00Z"
  }
}

// Notes:
// - ttl: optional (defaults to policy ttl_default)
// - embed_origin: optional (checked against domain allowlist)
// - playback_url: use with hls.js or <video> tag`,
      },
      {
        title: "Batch Create Sessions",
        method: "POST",
        path: "/playback/sessions/batch",
        description: "Create playback sessions for multiple cameras at once. TTL is optional.",
        code: `curl -X POST ${API_BASE}/playback/sessions/batch \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "camera_ids": ["CAM_ID_1", "CAM_ID_2"],
    "ttl": 120
  }'`,
        response: `{
  "data": [
    {
      "camera_id": "CAM_ID_1",
      "session_id": "...",
      "playback_url": "http://host/.../index.m3u8",
      "ttl": 120,
      "expires_at": "..."
    },
    {
      "camera_id": "CAM_ID_2",
      "session_id": "...",
      "playback_url": "http://host/.../index.m3u8",
      "ttl": 120,
      "expires_at": "..."
    }
  ]
}`,
      },
      {
        title: "Refresh Session",
        method: "POST",
        path: "/playback/sessions/:id/refresh",
        description: "Extend the TTL of an active session. Call before expiry to keep the stream alive.",
        code: `curl -X POST ${API_BASE}/playback/sessions/SESSION_ID/refresh \\
  -H "X-API-Key: YOUR_API_KEY"`,
        response: `{
  "data": {
    "session_id": "SESSION_ID",
    "expires_at": "2026-03-31T12:10:00Z"
  }
}`,
      },
      {
        title: "Revoke Session",
        method: "POST",
        path: "/playback/sessions/:id/revoke",
        description: "Immediately invalidate a session. The playback URL stops working.",
        code: `curl -X POST ${API_BASE}/playback/sessions/SESSION_ID/revoke \\
  -H "X-API-Key: YOUR_API_KEY"`,
        response: `{
  "data": {
    "session_id": "SESSION_ID",
    "status": "revoked"
  }
}`,
      },
    ],
  },
  {
    label: "Cameras",
    value: "cameras",
    snippets: [
      {
        title: "List Cameras",
        method: "GET",
        path: "/cameras",
        description: "List all cameras. Supports filtering by status, site_id, tags, and pagination.",
        code: `curl "${API_BASE}/cameras?status=online&page=1&per_page=10" \\
  -H "X-API-Key: YOUR_API_KEY"`,
        response: `{
  "data": [
    {
      "id": "2a644ec7-...",
      "name": "Front Gate",
      "health_status": "online",
      "source_codec": "H264",
      "source_resolution": "1920x1080",
      "tags": ["entrance"]
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 10,
    "total": 2
  }
}`,
      },
      {
        title: "Get Camera",
        method: "GET",
        path: "/cameras/:id",
        description: "Get full details of a camera including source info.",
        code: `curl ${API_BASE}/cameras/CAMERA_ID \\
  -H "X-API-Key: YOUR_API_KEY"`,
        response: `{
  "data": {
    "id": "CAMERA_ID",
    "name": "Front Gate",
    "health_status": "online",
    "source_codec": "H264",
    "source_resolution": "1920x1080",
    "source_audio": "G711",
    "policy_id": null,
    "profile_id": "...",
    "version": 3
  }
}`,
      },
      {
        title: "Analyze RTSP Source",
        method: "POST",
        path: "/cameras/analyze",
        description: "Detect codec, resolution, and audio from an RTSP URL without creating a camera.",
        code: `curl -X POST ${API_BASE}/cameras/analyze \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "rtsp_url": "rtsp://admin:pass@192.168.1.100:554/stream"
  }'`,
        response: `{
  "data": {
    "codec": "H265",
    "resolution": "1920x1080",
    "fps": null,
    "audio": "G711"
  }
}

// H265 cameras are auto-transcoded to H264
// for browser compatibility`,
      },
      {
        title: "Create Camera",
        method: "POST",
        path: "/sites/:siteId/cameras",
        description: "Onboard a new RTSP camera. Source codec is auto-detected on first connection.",
        code: `curl -X POST ${API_BASE}/sites/SITE_ID/cameras \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Front Gate Camera",
    "rtsp_url": "rtsp://admin:pass@192.168.1.100:554/stream",
    "lat": 13.7563,
    "lng": 100.5018,
    "tags": ["entrance", "outdoor"]
  }'`,
        response: `{
  "data": {
    "id": "new-camera-uuid",
    "name": "Front Gate Camera",
    "health_status": "connecting",
    "source_codec": null
  }
}

// source_codec is populated after
// the camera connects and is analyzed`,
      },
      {
        title: "Start / Stop Stream",
        method: "POST",
        path: "/cameras/:id/start",
        description: "Start or stop a camera stream.",
        code: `# Start stream
curl -X POST ${API_BASE}/cameras/CAMERA_ID/start \\
  -H "X-API-Key: YOUR_API_KEY"

# Stop stream
curl -X POST ${API_BASE}/cameras/CAMERA_ID/stop \\
  -H "X-API-Key: YOUR_API_KEY"`,
        response: `{
  "data": {
    "camera_id": "CAMERA_ID",
    "status": "starting"
  }
}`,
      },
    ],
  },
  {
    label: "Policies",
    value: "policies",
    snippets: [
      {
        title: "List Policies",
        method: "GET",
        path: "/policies",
        description: "List all playback policies.",
        code: `curl ${API_BASE}/policies \\
  -H "X-API-Key: YOUR_API_KEY"`,
        response: `{
  "data": [
    {
      "id": "...",
      "name": "Standard Policy",
      "ttl_min": 60,
      "ttl_max": 300,
      "ttl_default": 120,
      "rate_limit_per_min": 100,
      "viewer_concurrency_limit": 50,
      "domain_allowlist": ["*.example.com"]
    }
  ]
}`,
      },
      {
        title: "Create Policy",
        method: "POST",
        path: "/policies",
        description: "Create a policy to control session TTL, rate limits, viewer concurrency, and domain allowlist. Assign to projects, sites, or cameras.",
        code: `curl -X POST ${API_BASE}/policies \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Embed Policy",
    "ttl_min": 30,
    "ttl_max": 120,
    "ttl_default": 60,
    "rate_limit_per_min": 20,
    "viewer_concurrency_limit": 50,
    "domain_allowlist": ["*.example.com"]
  }'`,
        response: `{
  "data": {
    "id": "new-policy-uuid",
    "name": "Embed Policy",
    ...
  }
}

// Policy enforcement:
// - ttl_min/max: session TTL must be in range
// - ttl_default: used when ttl is omitted
// - rate_limit_per_min: per API key per camera
// - viewer_concurrency_limit: per camera
// - domain_allowlist: embed_origin check
//
// Resolution: camera > site > project > defaults`,
      },
    ],
  },
  {
    label: "Projects & Sites",
    value: "projects",
    snippets: [
      {
        title: "List Projects",
        method: "GET",
        path: "/projects",
        description: "List all projects.",
        code: `curl ${API_BASE}/projects \\
  -H "X-API-Key: YOUR_API_KEY"`,
        response: `{
  "data": [
    {
      "id": "...",
      "name": "Bangkok Office",
      "public_key": "pk_..."
    }
  ]
}`,
      },
      {
        title: "Create Project",
        method: "POST",
        path: "/projects",
        description: "Create a project to organize sites and cameras.",
        code: `curl -X POST ${API_BASE}/projects \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Bangkok Office",
    "description": "All cameras in Bangkok HQ"
  }'`,
      },
      {
        title: "Create Site",
        method: "POST",
        path: "/projects/:projectId/sites",
        description: "Create a site within a project. Cameras are added to sites.",
        code: `curl -X POST ${API_BASE}/projects/PROJECT_ID/sites \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Warehouse A",
    "address": "123 Main St",
    "timezone": "Asia/Bangkok"
  }'`,
      },
    ],
  },
  {
    label: "Stream Profiles",
    value: "profiles",
    snippets: [
      {
        title: "List Stream Profiles",
        method: "GET",
        path: "/stream-profiles",
        description: "List all stream output profiles.",
        code: `curl ${API_BASE}/stream-profiles \\
  -H "X-API-Key: YOUR_API_KEY"`,
        response: `{
  "data": [
    {
      "id": "...",
      "name": "SD 480p Strip Audio",
      "output_codec": "h264",
      "output_resolution": "480p",
      "max_framerate": 15,
      "audio_mode": "strip",
      "is_default": false
    }
  ]
}`,
      },
      {
        title: "Create Stream Profile",
        method: "POST",
        path: "/stream-profiles",
        description: "Create a profile to control transcode settings. Assign to cameras to customize their external stream output.",
        code: `curl -X POST ${API_BASE}/stream-profiles \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "SD 480p Strip Audio",
    "output_codec": "h264",
    "audio_mode": "strip",
    "max_framerate": 15,
    "output_resolution": "480p",
    "keyframe_interval": 2
  }'`,
        response: `{
  "data": {
    "id": "new-profile-uuid",
    ...
  }
}

// output_codec: "h264" (transcode) or "passthrough"
// audio_mode: "include", "strip", or "mute"
// output_resolution: "original" to "240p"
// Passthrough: no CPU usage, original quality`,
      },
    ],
  },
  {
    label: "API Keys",
    value: "api-keys",
    snippets: [
      {
        title: "Generate API Key",
        method: "POST",
        path: "/api-clients",
        description: "Generate a new API key. The full key is returned ONCE — store it securely.",
        code: `curl -X POST ${API_BASE}/api-clients \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "label": "Mobile App Key",
    "project_id": "PROJECT_ID",
    "site_id": "SITE_ID"
  }'`,
        response: `{
  "data": {
    "id": "key-uuid",
    "key": "sk_live_abc123...",
    "key_prefix": "sk_live_a",
    "label": "Mobile App Key"
  }
}

// WARNING: "key" is shown only once!
// Use X-API-Key header for all API calls`,
      },
      {
        title: "List / Manage Keys",
        method: "GET",
        path: "/api-clients",
        description: "List, disable, enable, revoke, or delete API keys.",
        code: `# List all keys
curl ${API_BASE}/api-clients -H "X-API-Key: YOUR_API_KEY"

# Disable (temporary)
curl -X POST ${API_BASE}/api-clients/KEY_ID/disable -H "X-API-Key: YOUR_API_KEY"

# Enable
curl -X POST ${API_BASE}/api-clients/KEY_ID/enable -H "X-API-Key: YOUR_API_KEY"

# Revoke (permanent)
curl -X POST ${API_BASE}/api-clients/KEY_ID/revoke -H "X-API-Key: YOUR_API_KEY"`,
      },
    ],
  },
  {
    label: "Usage & Audit",
    value: "usage",
    snippets: [
      {
        title: "API Usage Stats",
        method: "GET",
        path: "/developer/usage",
        description: "Get aggregate API usage: requests per minute/hour/day and top endpoints.",
        code: `curl ${API_BASE}/developer/usage \\
  -H "X-API-Key: YOUR_API_KEY"

# Per-key usage
curl "${API_BASE}/developer/usage?api_client_id=KEY_ID" \\
  -H "X-API-Key: YOUR_API_KEY"`,
        response: `{
  "data": {
    "current_requests_per_minute": 12,
    "current_requests_per_hour": 340,
    "current_requests_per_day": 2841,
    "top_endpoints": [
      { "endpoint": "/playback/sessions", "count": 1203 },
      { "endpoint": "/cameras", "count": 892 }
    ]
  }
}`,
      },
      {
        title: "Audit Events",
        method: "GET",
        path: "/audit/events",
        description: "Query audit trail. Filter by event_type, actor_id, date range.",
        code: `curl "${API_BASE}/audit/events?page=1&per_page=20" \\
  -H "X-API-Key: YOUR_API_KEY"

# Export as CSV
curl -X POST ${API_BASE}/audit/events/export \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "format": "csv", "from": "2026-03-01T00:00:00Z", "to": "2026-03-31T23:59:59Z" }'`,
      },
    ],
  },
  {
    label: "Embed",
    value: "embed",
    snippets: [
      {
        title: "Embed Camera (iframe)",
        method: "GET",
        path: "/embed/:cameraId?key=",
        description: "Embed a live camera stream in any webpage. No backend code needed.",
        code: `<iframe
  src="${EMBED_BASE}/embed/CAMERA_ID?key=YOUR_API_KEY"
  width="640"
  height="360"
  frameborder="0"
  allowfullscreen
></iframe>`,
        response: `<!-- The embed page handles:
  - Playback session creation
  - HLS player initialization
  - Auto-refresh before expiry
  - Domain allowlist enforcement

  Requirements:
  - Valid API key
  - Camera must be online
  - Domain must be in policy allowlist
    (if configured) -->`,
      },
    ],
  },
];

// ── UI Components ───────────────────────────────────────────────────────────

function methodColor(method: string): string {
  switch (method) {
    case "GET": return "bg-blue-100 text-blue-700";
    case "POST": return "bg-green-100 text-green-700";
    case "PATCH": return "bg-yellow-100 text-yellow-700";
    case "DELETE": return "bg-red-100 text-red-700";
    default: return "bg-gray-100 text-gray-700";
  }
}

function SnippetCard({ snippet }: { snippet: Snippet }) {
  const [copiedLeft, setCopiedLeft] = useState(false);
  const [copiedRight, setCopiedRight] = useState(false);

  function handleCopyCode() {
    navigator.clipboard.writeText(snippet.code);
    setCopiedLeft(true);
    setTimeout(() => setCopiedLeft(false), 2000);
  }

  function handleCopyResponse() {
    if (snippet.response) {
      navigator.clipboard.writeText(snippet.response);
      setCopiedRight(true);
      setTimeout(() => setCopiedRight(false), 2000);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Badge className={`${methodColor(snippet.method)} font-mono text-xs`}>
            {snippet.method}
          </Badge>
          <CardTitle className="text-sm font-medium">{snippet.title}</CardTitle>
        </div>
        <p className="font-mono text-xs text-muted-foreground">{snippet.path}</p>
        <p className="text-sm text-muted-foreground">{snippet.description}</p>
      </CardHeader>
      <CardContent>
        <div className={`grid gap-3 ${snippet.response ? "grid-cols-[3fr_2fr]" : "grid-cols-1"}`}>
          {/* Request (left) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Request</span>
              <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1.5" onClick={handleCopyCode}>
                {copiedLeft ? "Copied!" : "Copy"}
              </Button>
            </div>
            <pre className="overflow-auto rounded-lg bg-zinc-950 text-zinc-100 p-3 text-xs font-mono leading-relaxed">
              {snippet.code}
            </pre>
          </div>

          {/* Response (right) */}
          {snippet.response && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Response</span>
                <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1.5" onClick={handleCopyResponse}>
                  {copiedRight ? "Copied!" : "Copy"}
                </Button>
              </div>
              <pre className="overflow-auto rounded-lg bg-zinc-900 text-emerald-300 p-3 text-xs font-mono leading-relaxed">
                {snippet.response}
              </pre>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Code snippets component — real, copy-paste ready cURL examples
 * with response previews in a 60/40 split layout.
 */
export function CodeSnippets() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>API Reference</CardTitle>
        <CardDescription>
          Copy-paste ready examples. Replace{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">YOUR_API_KEY</code>{" "}
          with your key from{" "}
          <a href="/api-keys" className="underline font-medium">API Keys</a>.
          All endpoints require the <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">X-API-Key</code> header.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="playback" className="space-y-4">
          <TabsList className="flex-wrap h-auto gap-1">
            {SECTIONS.map((section) => (
              <TabsTrigger key={section.value} value={section.value}>
                {section.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {SECTIONS.map((section) => (
            <TabsContent key={section.value} value={section.value} className="space-y-4">
              {section.snippets.map((snippet, i) => (
                <SnippetCard key={i} snippet={snippet} />
              ))}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
