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

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ??
  (typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:3001/api/v1`
    : "http://localhost:3001/api/v1");

const EMBED_BASE =
  typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:3000`
    : "http://localhost:3000";

// ── Cameras ──────────────────────────────────────────────────────────────────

const CURL_LIST_CAMERAS = `curl ${API_BASE}/cameras \\
  -H "X-API-Key: YOUR_API_KEY"`;

const CURL_LIST_CAMERAS_FILTER = `curl "${API_BASE}/cameras?status=online&page=1&per_page=10" \\
  -H "X-API-Key: YOUR_API_KEY"`;

const CURL_GET_CAMERA = `curl ${API_BASE}/cameras/CAMERA_ID \\
  -H "X-API-Key: YOUR_API_KEY"`;

const CURL_GET_CAMERA_STATUS = `curl ${API_BASE}/cameras/CAMERA_ID/status \\
  -H "X-API-Key: YOUR_API_KEY"`;

const CURL_CREATE_CAMERA = `curl -X POST ${API_BASE}/sites/SITE_ID/cameras \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Front Gate Camera",
    "rtsp_url": "rtsp://admin:password@192.168.1.100:554/stream1",
    "lat": 13.7563,
    "lng": 100.5018,
    "tags": ["entrance", "outdoor"]
  }'`;

const CURL_UPDATE_CAMERA = `curl -X PATCH ${API_BASE}/cameras/CAMERA_ID \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Front Gate Camera (Updated)",
    "tags": ["entrance", "outdoor", "hd"],
    "version": 1
  }'`;

const CURL_START_CAMERA = `curl -X POST ${API_BASE}/cameras/CAMERA_ID/start \\
  -H "X-API-Key: YOUR_API_KEY"`;

const CURL_STOP_CAMERA = `curl -X POST ${API_BASE}/cameras/CAMERA_ID/stop \\
  -H "X-API-Key: YOUR_API_KEY"`;

const CURL_DELETE_CAMERA = `curl -X DELETE ${API_BASE}/cameras/CAMERA_ID \\
  -H "X-API-Key: YOUR_API_KEY"`;

// ── Sites ────────────────────────────────────────────────────────────────────

const CURL_LIST_SITES = `curl ${API_BASE}/projects/PROJECT_ID/sites \\
  -H "X-API-Key: YOUR_API_KEY"`;

const CURL_GET_SITE = `curl ${API_BASE}/sites/SITE_ID \\
  -H "X-API-Key: YOUR_API_KEY"`;

const CURL_CREATE_SITE = `curl -X POST ${API_BASE}/projects/PROJECT_ID/sites \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Warehouse A",
    "address": "123 Main St",
    "lat": 13.7563,
    "lng": 100.5018,
    "timezone": "Asia/Bangkok"
  }'`;

// ── Playback Sessions ────────────────────────────────────────────────────────

const CURL_CREATE_SESSION = `# Create a playback session to get an HLS stream URL
curl -X POST ${API_BASE}/playback/sessions \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "camera_id": "CAMERA_ID",
    "ttl": 300
  }'

# Response:
# {
#   "data": {
#     "session_id": "...",
#     "playback_url": "http://host/api/v1/stream/{token}/index.m3u8",
#     "protocol": "hls",
#     "ttl": 300,
#     "expires_at": "2026-03-25T10:00:00Z"
#   }
# }
#
# Use playback_url with any HLS player (hls.js, Video.js, etc.)`;

const CURL_BATCH_SESSION = `curl -X POST ${API_BASE}/playback/sessions/batch \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "camera_ids": ["CAMERA_ID_1", "CAMERA_ID_2"],
    "ttl": 300
  }'`;

const CURL_REFRESH_SESSION = `curl -X POST ${API_BASE}/playback/sessions/SESSION_ID/refresh \\
  -H "X-API-Key: YOUR_API_KEY"`;

const CURL_REVOKE_SESSION = `curl -X POST ${API_BASE}/playback/sessions/SESSION_ID/revoke \\
  -H "X-API-Key: YOUR_API_KEY"`;

// ── Projects ─────────────────────────────────────────────────────────────────

const CURL_LIST_PROJECTS = `curl ${API_BASE}/projects \\
  -H "X-API-Key: YOUR_API_KEY"`;

const CURL_CREATE_PROJECT = `curl -X POST ${API_BASE}/projects \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Bangkok Office",
    "description": "All cameras in Bangkok HQ"
  }'`;

// ── API Keys ─────────────────────────────────────────────────────────────────

const CURL_LIST_KEYS = `curl ${API_BASE}/api-clients \\
  -H "X-API-Key: YOUR_API_KEY"`;

const CURL_GENERATE_KEY = `curl -X POST ${API_BASE}/api-clients \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "label": "Mobile App Key",
    "project_id": "PROJECT_ID",
    "site_id": "SITE_ID"
  }'`;

const CURL_DISABLE_KEY = `curl -X POST ${API_BASE}/api-clients/KEY_ID/disable \\
  -H "X-API-Key: YOUR_API_KEY"`;

const CURL_ENABLE_KEY = `curl -X POST ${API_BASE}/api-clients/KEY_ID/enable \\
  -H "X-API-Key: YOUR_API_KEY"`;

const CURL_REVOKE_KEY = `curl -X POST ${API_BASE}/api-clients/KEY_ID/revoke \\
  -H "X-API-Key: YOUR_API_KEY"`;

const CURL_DELETE_KEY = `curl -X DELETE ${API_BASE}/api-clients/KEY_ID \\
  -H "X-API-Key: YOUR_API_KEY"`;

// ── Policies ─────────────────────────────────────────────────────────────────

const CURL_LIST_POLICIES = `curl ${API_BASE}/policies \\
  -H "X-API-Key: YOUR_API_KEY"`;

const CURL_CREATE_POLICY = `curl -X POST ${API_BASE}/policies \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Standard Policy",
    "ttl_min": 60,
    "ttl_max": 300,
    "domain_allowlist": ["*.example.com", "localhost"]
  }'`;

// ── Audit ────────────────────────────────────────────────────────────────────

const CURL_LIST_AUDIT = `curl "${API_BASE}/audit/events?page=1&per_page=20" \\
  -H "X-API-Key: YOUR_API_KEY"`;

const CURL_EXPORT_AUDIT = `curl -X POST ${API_BASE}/audit/events/export \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "format": "csv",
    "from": "2026-03-01T00:00:00Z",
    "to": "2026-03-23T23:59:59Z"
  }'`;

// ── Stream Profiles ──────────────────────────────────────────────────────────

const CURL_LIST_PROFILES = `curl ${API_BASE}/stream-profiles \\
  -H "X-API-Key: YOUR_API_KEY"`;

const CURL_CREATE_PROFILE = `curl -X POST ${API_BASE}/stream-profiles \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "HD HLS Only",
    "protocol": "hls",
    "audio_mode": "include",
    "max_framerate": 30,
    "output_resolution": "1080p"
  }'`;

// ── Usage ────────────────────────────────────────────────────────────────────

const CURL_USAGE = `curl ${API_BASE}/developer/usage \\
  -H "X-API-Key: YOUR_API_KEY"`;

const CURL_USAGE_PER_KEY = `curl "${API_BASE}/developer/usage?api_client_id=KEY_ID" \\
  -H "X-API-Key: YOUR_API_KEY"`;

// ── Embed ────────────────────────────────────────────────────────────────────

const EMBED_IFRAME = `<iframe
  src="${EMBED_BASE}/embed/CAMERA_ID?key=YOUR_API_KEY"
  width="640"
  height="360"
  frameborder="0"
  allowfullscreen
></iframe>`;

// ──────────────────────────────────────────────────────────────────────────────

interface Snippet {
  title: string;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  description: string;
  code: string;
  hasBody?: boolean;
}

const SECTIONS: {
  label: string;
  value: string;
  snippets: Snippet[];
}[] = [
  {
    label: "Cameras",
    value: "cameras",
    snippets: [
      {
        title: "List Cameras",
        method: "GET",
        path: "/cameras",
        description: "List all cameras. Returns paginated results.",
        code: CURL_LIST_CAMERAS,
      },
      {
        title: "List Cameras (Filtered)",
        method: "GET",
        path: "/cameras?status=online",
        description:
          "Filter by status (online/offline/degraded), site_id, tags, or search text.",
        code: CURL_LIST_CAMERAS_FILTER,
      },
      {
        title: "Get Camera",
        method: "GET",
        path: "/cameras/:id",
        description: "Get full details of a single camera by ID.",
        code: CURL_GET_CAMERA,
      },
      {
        title: "Get Camera Status",
        method: "GET",
        path: "/cameras/:id/status",
        description: "Get real-time health/status metrics for a camera.",
        code: CURL_GET_CAMERA_STATUS,
      },
      {
        title: "Create Camera",
        method: "POST",
        path: "/sites/:siteId/cameras",
        description: "Onboard a new RTSP camera to a site.",
        code: CURL_CREATE_CAMERA,
        hasBody: true,
      },
      {
        title: "Start Stream",
        method: "POST",
        path: "/cameras/:id/start",
        description: "Start the RTSP stream for a camera. Status will change to 'connecting' then 'online'.",
        code: CURL_START_CAMERA,
      },
      {
        title: "Stop Stream",
        method: "POST",
        path: "/cameras/:id/stop",
        description: "Stop the stream. Status changes to 'stopping' then 'stopped'.",
        code: CURL_STOP_CAMERA,
      },
      {
        title: "Update Camera",
        method: "PATCH",
        path: "/cameras/:id",
        description: "Update camera name, tags, or other properties. Requires 'version' field for concurrency control.",
        code: CURL_UPDATE_CAMERA,
        hasBody: true,
      },
      {
        title: "Delete Camera",
        method: "DELETE",
        path: "/cameras/:id",
        description: "Remove a camera. Must stop the stream first.",
        code: CURL_DELETE_CAMERA,
      },
    ],
  },
  {
    label: "Playback",
    value: "playback",
    snippets: [
      {
        title: "Create Playback Session",
        method: "POST",
        path: "/playback/sessions",
        description:
          "Get an HLS playback URL for a camera. Use the returned playback_url with any HLS player (hls.js, Video.js, etc). TTL: 60-300 seconds.",
        code: CURL_CREATE_SESSION,
        hasBody: true,
      },
      {
        title: "Batch Create Sessions",
        method: "POST",
        path: "/playback/sessions/batch",
        description: "Create playback sessions for multiple cameras at once.",
        code: CURL_BATCH_SESSION,
        hasBody: true,
      },
      {
        title: "Refresh Session",
        method: "POST",
        path: "/playback/sessions/:id/refresh",
        description: "Extend the TTL of an active playback session.",
        code: CURL_REFRESH_SESSION,
      },
      {
        title: "Revoke Session",
        method: "POST",
        path: "/playback/sessions/:id/revoke",
        description: "Immediately invalidate a playback session.",
        code: CURL_REVOKE_SESSION,
      },
    ],
  },
  {
    label: "Projects",
    value: "projects",
    snippets: [
      {
        title: "List Projects",
        method: "GET",
        path: "/projects",
        description: "List all projects for the current tenant.",
        code: CURL_LIST_PROJECTS,
      },
      {
        title: "Create Project",
        method: "POST",
        path: "/projects",
        description: "Create a new project to organize sites and cameras.",
        code: CURL_CREATE_PROJECT,
        hasBody: true,
      },
    ],
  },
  {
    label: "Sites",
    value: "sites",
    snippets: [
      {
        title: "List Sites",
        method: "GET",
        path: "/projects/:projectId/sites",
        description: "List all sites within a project.",
        code: CURL_LIST_SITES,
      },
      {
        title: "Get Site",
        method: "GET",
        path: "/sites/:id",
        description: "Get details of a single site.",
        code: CURL_GET_SITE,
      },
      {
        title: "Create Site",
        method: "POST",
        path: "/projects/:projectId/sites",
        description: "Create a new site within a project. Cameras are added to sites.",
        code: CURL_CREATE_SITE,
        hasBody: true,
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
        code: CURL_LIST_PROFILES,
      },
      {
        title: "Create Stream Profile",
        method: "POST",
        path: "/stream-profiles",
        description:
          "Create a profile to control HLS/WebRTC output, audio, framerate, resolution.",
        code: CURL_CREATE_PROFILE,
        hasBody: true,
      },
    ],
  },
  {
    label: "API Keys",
    value: "api-keys",
    snippets: [
      {
        title: "List API Keys",
        method: "GET",
        path: "/api-clients",
        description: "List all API keys for the current tenant.",
        code: CURL_LIST_KEYS,
      },
      {
        title: "Generate API Key",
        method: "POST",
        path: "/api-clients",
        description:
          "Generate a new API key scoped to a project/site. The full key is returned ONCE.",
        code: CURL_GENERATE_KEY,
        hasBody: true,
      },
      {
        title: "Disable API Key",
        method: "POST",
        path: "/api-clients/:id/disable",
        description: "Temporarily disable an API key. Requests will get 403.",
        code: CURL_DISABLE_KEY,
      },
      {
        title: "Enable API Key",
        method: "POST",
        path: "/api-clients/:id/enable",
        description: "Re-enable a disabled API key.",
        code: CURL_ENABLE_KEY,
      },
      {
        title: "Revoke API Key",
        method: "POST",
        path: "/api-clients/:id/revoke",
        description: "Permanently revoke an API key.",
        code: CURL_REVOKE_KEY,
      },
      {
        title: "Delete API Key",
        method: "DELETE",
        path: "/api-clients/:id",
        description: "Permanently delete an API key from the system.",
        code: CURL_DELETE_KEY,
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
        description: "List all retention and stream policies.",
        code: CURL_LIST_POLICIES,
      },
      {
        title: "Create Policy",
        method: "POST",
        path: "/policies",
        description:
          "Create a policy with TTL bounds and domain allowlist for embeds.",
        code: CURL_CREATE_POLICY,
        hasBody: true,
      },
    ],
  },
  {
    label: "Audit",
    value: "audit",
    snippets: [
      {
        title: "List Audit Events",
        method: "GET",
        path: "/audit/events",
        description:
          "Query audit events. Filter by event_type, actor_id, camera_id, date range.",
        code: CURL_LIST_AUDIT,
      },
      {
        title: "Export Audit Events",
        method: "POST",
        path: "/audit/events/export",
        description: "Export audit events as CSV or JSON within a date range.",
        code: CURL_EXPORT_AUDIT,
        hasBody: true,
      },
    ],
  },
  {
    label: "Usage",
    value: "usage",
    snippets: [
      {
        title: "Tenant Usage Overview",
        method: "GET",
        path: "/developer/usage",
        description:
          "Get aggregate API usage stats: requests/min, /hour, /day, top endpoints.",
        code: CURL_USAGE,
      },
      {
        title: "Per-Key Usage",
        method: "GET",
        path: "/developer/usage?api_client_id=",
        description: "Get usage stats scoped to a specific API key.",
        code: CURL_USAGE_PER_KEY,
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
        description:
          "Embed a live camera stream in any webpage. No backend needed on your side.",
        code: EMBED_IFRAME,
      },
    ],
  },
];

function methodColor(method: string): string {
  switch (method) {
    case "GET":
      return "bg-blue-100 text-blue-700";
    case "POST":
      return "bg-green-100 text-green-700";
    case "PATCH":
      return "bg-yellow-100 text-yellow-700";
    case "DELETE":
      return "bg-red-100 text-red-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function SnippetCard({ snippet }: { snippet: Snippet }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(snippet.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge className={`${methodColor(snippet.method)} font-mono text-xs`}>
              {snippet.method}
            </Badge>
            <CardTitle className="text-sm font-medium">
              {snippet.title}
            </CardTitle>
          </div>
          <p className="font-mono text-xs text-muted-foreground">
            {snippet.path}
          </p>
          <p className="text-sm text-muted-foreground">{snippet.description}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className="shrink-0"
        >
          {copied ? "Copied!" : "Copy"}
        </Button>
      </CardHeader>
      <CardContent>
        <pre className="overflow-auto rounded-lg bg-muted p-4 text-xs font-mono leading-relaxed">
          {snippet.code}
        </pre>
        {snippet.hasBody && (
          <p className="mt-2 text-xs text-muted-foreground">
            * Replace placeholder IDs (CAMERA_ID, SITE_ID, etc.) with real
            values from your system.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Code snippets component — real, copy-paste ready cURL examples
 * Copy-paste ready cURL examples with request bodies.
 */
export function CodeSnippets() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>API Examples</CardTitle>
        <CardDescription>
          Ready-to-use cURL commands pointing to your API server. Copy, replace{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">
            YOUR_API_KEY
          </code>{" "}
          with your key from the{" "}
          <a href="/api-keys" className="underline font-medium">
            API Keys
          </a>{" "}
          page, and run in your terminal.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="cameras" className="space-y-4">
          <TabsList className="flex-wrap h-auto gap-1">
            {SECTIONS.map((section) => (
              <TabsTrigger key={section.value} value={section.value}>
                {section.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {SECTIONS.map((section) => (
            <TabsContent
              key={section.value}
              value={section.value}
              className="space-y-4"
            >
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
