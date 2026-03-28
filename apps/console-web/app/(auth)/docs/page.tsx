"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowDown, ArrowRight } from "lucide-react";

// ─── API Workflow Tab ──────────────────────────────────────────────────────────

interface Step {
  order: number;
  method: "GET" | "POST" | "PATCH" | "DELETE" | "—";
  path: string;
  label: string;
  description: string;
}

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: "bg-blue-100 text-blue-700",
    POST: "bg-green-100 text-green-700",
    PATCH: "bg-yellow-100 text-yellow-700",
    DELETE: "bg-red-100 text-red-700",
    "—": "bg-gray-100 text-gray-500",
  };
  return (
    <Badge className={`${colors[method] ?? "bg-gray-100"} font-mono text-[10px] px-1.5`}>
      {method}
    </Badge>
  );
}

function StepCard({ step, isLast }: { step: Step; isLast: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <div className="w-full rounded-lg border bg-card p-4">
        <div className="flex items-start gap-3">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
            {step.order}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <MethodBadge method={step.method} />
              <code className="text-xs text-muted-foreground font-mono">{step.path}</code>
            </div>
            <p className="mt-1 text-sm font-medium">{step.label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{step.description}</p>
          </div>
        </div>
      </div>
      {!isLast && (
        <ArrowDown className="my-1.5 size-4 text-muted-foreground/50" />
      )}
    </div>
  );
}

function WorkflowSection({
  title,
  description,
  steps,
}: {
  title: string;
  description: string;
  steps: Step[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-0">
        {steps.map((step, i) => (
          <StepCard key={i} step={step} isLast={i === steps.length - 1} />
        ))}
      </CardContent>
    </Card>
  );
}

const SETUP_STEPS: Step[] = [
  {
    order: 1,
    method: "POST",
    path: "/projects",
    label: "Create a Project",
    description: "Group your cameras by project (e.g. \"Bangkok Office\", \"Factory A\").",
  },
  {
    order: 2,
    method: "POST",
    path: "/projects/:id/sites",
    label: "Create a Site",
    description: "A physical location within a project (e.g. \"Building 1\", \"Parking Lot\").",
  },
  {
    order: 3,
    method: "POST",
    path: "/sites/:id/cameras",
    label: "Add a Camera",
    description: "Register a camera with its RTSP URL. Status starts as 'stopped'.",
  },
  {
    order: 4,
    method: "POST",
    path: "/cameras/:id/start",
    label: "Start the Stream",
    description: "Connects to the camera and starts streaming. Status: stopped → connecting → online.",
  },
  {
    order: 5,
    method: "POST",
    path: "/api-clients",
    label: "Create an API Key",
    description: "Generate a key for external access. The full key is shown only once — save it.",
  },
];

const PLAYBACK_STEPS: Step[] = [
  {
    order: 1,
    method: "POST",
    path: "/playback/sessions",
    label: "Create a Playback Session",
    description: "Send camera_id + ttl (60-300s). Returns a playback_url (HLS .m3u8) with a signed token.",
  },
  {
    order: 2,
    method: "—",
    path: "playback_url",
    label: "Play the Stream",
    description: "Use the playback_url with hls.js, Video.js, or any HLS-compatible player. No additional API call needed.",
  },
  {
    order: 3,
    method: "POST",
    path: "/playback/sessions/:id/refresh",
    label: "Renew Before Expiry",
    description: "Call at ~80% of TTL to extend the session. The playback_url stays the same.",
  },
  {
    order: 4,
    method: "POST",
    path: "/playback/sessions/:id/revoke",
    label: "Revoke When Done (optional)",
    description: "Immediately invalidate the session. Stream stops and token becomes unusable.",
  },
];

const EMBED_STEPS: Step[] = [
  {
    order: 1,
    method: "—",
    path: "/embed/:cameraId?key=YOUR_API_KEY",
    label: "Use the Embed URL",
    description: "Paste the URL into an <iframe>. No backend code needed — the page handles session creation, playback, and auto-renewal automatically.",
  },
];

const MULTI_STEPS: Step[] = [
  {
    order: 1,
    method: "GET",
    path: "/cameras?status=online",
    label: "List Online Cameras",
    description: "Get all cameras that are currently streaming.",
  },
  {
    order: 2,
    method: "POST",
    path: "/playback/sessions/batch",
    label: "Batch Create Sessions",
    description: "Send multiple camera_ids in one request. Returns a playback_url for each camera.",
  },
  {
    order: 3,
    method: "—",
    path: "playback_urls[]",
    label: "Play All Streams",
    description: "Create one hls.js instance per camera. Only load streams that are visible (lazy load). Destroy when scrolled out of view.",
  },
  {
    order: 4,
    method: "POST",
    path: "/playback/sessions/:id/refresh",
    label: "Renew Loop",
    description: "Set a timer per session at 80% of TTL. Renew each session before it expires to keep streams playing continuously.",
  },
];

function ApiWorkflowTab() {
  return (
    <div className="space-y-6">
      <WorkflowSection
        title="1. Initial Setup"
        description="Do this once to set up your cameras and get an API key."
        steps={SETUP_STEPS}
      />

      <Separator />

      <WorkflowSection
        title="2. Play a Single Stream"
        description="Create a session, get a URL, play it. Renew before it expires."
        steps={PLAYBACK_STEPS}
      />

      <div className="rounded-lg border bg-muted/50 p-4">
        <div className="flex items-start gap-2">
          <span className="text-sm font-medium">Tip:</span>
          <p className="text-sm text-muted-foreground">
            The playback_url is a standard HLS URL. Any player that supports .m3u8 will work:
            <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs font-mono">hls.js</code>
            <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs font-mono">Video.js</code>
            <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs font-mono">ExoPlayer</code>
            <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs font-mono">AVPlayer</code>
            — or Safari natively.
          </p>
        </div>
      </div>

      <Separator />

      <WorkflowSection
        title="3. Embed (Easiest)"
        description="No backend needed. Just paste an iframe and you're done."
        steps={EMBED_STEPS}
      />

      <Separator />

      <WorkflowSection
        title="4. Multi-Camera Grid"
        description="Display multiple cameras at once — for dashboards, control rooms, or monitoring pages."
        steps={MULTI_STEPS}
      />

      <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
        <p className="text-sm font-medium">Best Practices for Multi-Camera</p>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>Keep API Key on your server — never expose it to the browser</li>
          <li>Lazy load — only create sessions for cameras visible on screen</li>
          <li>Destroy streams when scrolled out of view to save bandwidth</li>
          <li>Use 480p/360p profiles for grid views with many cameras</li>
          <li>Limit concurrent streams per user (recommended: max 9-16)</li>
        </ul>
      </div>

      <Separator />

      {/* Quick Reference */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Reference</CardTitle>
          <CardDescription>All endpoints used in these workflows</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[70px]">Method</TableHead>
                  <TableHead>Endpoint</TableHead>
                  <TableHead>Purpose</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  ["POST", "/projects", "Create project"],
                  ["POST", "/projects/:id/sites", "Create site"],
                  ["POST", "/sites/:id/cameras", "Add camera"],
                  ["POST", "/cameras/:id/start", "Start stream"],
                  ["POST", "/cameras/:id/stop", "Stop stream"],
                  ["GET", "/cameras", "List cameras"],
                  ["GET", "/cameras/:id", "Get camera detail"],
                  ["GET", "/cameras/:id/status", "Get health status"],
                  ["POST", "/api-clients", "Create API key"],
                  ["POST", "/playback/sessions", "Create playback session"],
                  ["POST", "/playback/sessions/batch", "Batch create sessions"],
                  ["POST", "/playback/sessions/:id/refresh", "Extend session TTL"],
                  ["POST", "/playback/sessions/:id/revoke", "Revoke session"],
                ].map(([method, path, desc], i) => (
                  <TableRow key={i}>
                    <TableCell><MethodBadge method={method!} /></TableCell>
                    <TableCell className="font-mono text-xs">{path}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{desc}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Profile Guide Tab (existing content) ──────────────────────────────────────

function ProfileGuideTab() {
  return (
    <div className="space-y-8">
      {/* Quick Start */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-semibold">Quick Start</h2>
            <p className="text-sm text-muted-foreground">
              Common profile presets for typical use cases
            </p>
          </div>
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Use Case</TableHead>
                <TableHead>Protocol</TableHead>
                <TableHead>Codec</TableHead>
                <TableHead>Audio</TableHead>
                <TableHead>Resolution</TableHead>
                <TableHead>FPS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Public website embed</TableCell>
                <TableCell><Badge variant="outline">HLS</Badge></TableCell>
                <TableCell>H.264</TableCell>
                <TableCell>Strip</TableCell>
                <TableCell>720p</TableCell>
                <TableCell>15</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Security monitoring</TableCell>
                <TableCell><Badge variant="outline">HLS</Badge></TableCell>
                <TableCell>H.264</TableCell>
                <TableCell>Include</TableCell>
                <TableCell>1080p</TableCell>
                <TableCell>Original</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Real-time monitoring</TableCell>
                <TableCell><Badge variant="outline">WebRTC</Badge></TableCell>
                <TableCell>Passthrough</TableCell>
                <TableCell>Include</TableCell>
                <TableCell>Original</TableCell>
                <TableCell>Original</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Mobile / low bandwidth</TableCell>
                <TableCell><Badge variant="outline">HLS</Badge></TableCell>
                <TableCell>H.264</TableCell>
                <TableCell>Strip</TableCell>
                <TableCell>480p</TableCell>
                <TableCell>10</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Bandwidth saver</TableCell>
                <TableCell><Badge variant="outline">HLS</Badge></TableCell>
                <TableCell>H.264</TableCell>
                <TableCell>Strip</TableCell>
                <TableCell>360p</TableCell>
                <TableCell>5</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>

      <Separator />

      {/* Protocol */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Output Protocol</CardTitle>
          <CardDescription>How the stream is delivered to viewers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border p-4">
            <div className="flex items-center gap-2">
              <Badge>HLS</Badge>
              <span className="text-sm font-medium">HTTP Live Streaming</span>
              <Badge variant="secondary" className="ml-auto">Recommended</Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Works on every browser and device. Video is split into small segments delivered over HTTP. Latency is 5-15 seconds.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Best for: website embeds, public viewing, mobile apps, recording playback.
            </p>
          </div>
          <div className="rounded-md border p-4">
            <div className="flex items-center gap-2">
              <Badge>WebRTC</Badge>
              <span className="text-sm font-medium">Web Real-Time Communication</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Ultra-low latency (under 1 second). May be blocked by strict firewalls.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Best for: live monitoring, PTZ control, intercom, alarm response.
            </p>
          </div>
          <div className="rounded-md border p-4">
            <div className="flex items-center gap-2">
              <Badge>Both</Badge>
              <span className="text-sm font-medium">HLS + WebRTC</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              HLS by default with a toggle to switch to WebRTC for low latency.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Codec */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Output Codec</CardTitle>
          <CardDescription>How the video is encoded before delivery</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border p-4">
            <div className="flex items-center gap-2">
              <Badge>H.264</Badge>
              <span className="text-sm font-medium">Transcode to H.264</span>
              <Badge variant="secondary" className="ml-auto">Recommended</Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Maximum compatibility. All profile settings (resolution, framerate, audio) are applied.
            </p>
            <div className="mt-2 flex gap-2">
              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Uses CPU</Badge>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">All settings applied</Badge>
            </div>
          </div>
          <div className="rounded-md border p-4">
            <div className="flex items-center gap-2">
              <Badge>Passthrough</Badge>
              <span className="text-sm font-medium">No transcoding (direct)</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Zero CPU. Profile settings are <strong>NOT applied</strong>. WebRTC only.
            </p>
            <div className="mt-2 flex gap-2">
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Zero CPU</Badge>
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Settings ignored</Badge>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">WebRTC only</Badge>
            </div>
          </div>
          <div className="rounded-md border p-4">
            <div className="flex items-center gap-2">
              <Badge>Copy</Badge>
              <span className="text-sm font-medium">Repackage without transcoding</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Repackages into HLS without changing codec. Only works if camera outputs H.264.
            </p>
            <div className="mt-2 flex gap-2">
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Low CPU</Badge>
              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">H.264 cameras only</Badge>
            </div>
          </div>
          <div className="rounded-md bg-muted/50 p-4">
            <p className="text-sm font-medium mb-2">How to choose:</p>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Need real-time ({"<"}1s delay)? <strong>Passthrough + WebRTC</strong></li>
              <li>Camera outputs H.264 and no changes needed? <strong>Copy</strong></li>
              <li>Everything else? <strong>H.264</strong> (safe default)</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* Audio */}
      <div>
        <h2 className="text-lg font-semibold mb-1">Audio Mode</h2>
        <p className="text-sm text-muted-foreground mb-3">How audio from the camera is handled</p>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mode</TableHead>
                <TableHead>Behavior</TableHead>
                <TableHead>Use Case</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell><Badge variant="outline">Include</Badge></TableCell>
                <TableCell className="text-sm">Audio transcoded to AAC and included</TableCell>
                <TableCell className="text-sm text-muted-foreground">Security cameras with microphone</TableCell>
              </TableRow>
              <TableRow>
                <TableCell><Badge variant="outline">Strip</Badge></TableCell>
                <TableCell className="text-sm">Audio track completely removed</TableCell>
                <TableCell className="text-sm text-muted-foreground">Public embeds, privacy compliance</TableCell>
              </TableRow>
              <TableRow>
                <TableCell><Badge variant="outline">Mute</Badge></TableCell>
                <TableCell className="text-sm">Silent audio track preserved</TableCell>
                <TableCell className="text-sm text-muted-foreground">UI shows audio controls but no sound</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Resolution */}
      <div>
        <h2 className="text-lg font-semibold mb-1">Output Resolution</h2>
        <p className="text-sm text-muted-foreground mb-3">Downscale the video to save bandwidth</p>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Setting</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Bandwidth</TableHead>
                <TableHead>Use Case</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                ["Original", "Camera native", "Highest", "Full quality monitoring"],
                ["1080p", "1920 x 1080", "~2 Mbps", "HD security monitoring"],
                ["720p", "1280 x 720", "~1.5 Mbps", "Website embed, good balance"],
                ["480p", "854 x 480", "~800 Kbps", "Mobile viewing"],
                ["360p", "640 x 360", "~500 Kbps", "Low bandwidth, many cameras"],
                ["240p", "426 x 240", "~300 Kbps", "Thumbnail quality, grid view"],
              ].map(([setting, size, bw, use], i) => (
                <TableRow key={i}>
                  <TableCell><Badge variant="outline">{setting}</Badge></TableCell>
                  <TableCell className="text-sm">{size}</TableCell>
                  <TableCell className="text-sm">{bw}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{use}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Framerate */}
      <div>
        <h2 className="text-lg font-semibold mb-1">Max Framerate</h2>
        <p className="text-sm text-muted-foreground mb-3">Limit FPS to save bandwidth and CPU</p>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Setting</TableHead>
                <TableHead>Smoothness</TableHead>
                <TableHead>Use Case</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                ["Original", "Camera native (25-30fps)", "Full motion, security"],
                ["15 fps", "Smooth enough for most uses", "Website embed"],
                ["10 fps", "Slightly choppy", "Bandwidth saving"],
                ["5 fps", "Slideshow-like", "Grid view, many cameras"],
              ].map(([setting, smooth, use], i) => (
                <TableRow key={i}>
                  <TableCell><Badge variant="outline">{setting}</Badge></TableCell>
                  <TableCell className="text-sm">{smooth}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{use}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Separator />

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Important Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md bg-yellow-50 border border-yellow-200 p-4">
            <p className="text-sm font-medium text-yellow-800">Passthrough = No profile settings applied</p>
            <p className="mt-1 text-sm text-yellow-700">
              Resolution, framerate, and audio settings are completely ignored. This is by design for minimum latency.
            </p>
          </div>
          <div className="rounded-md bg-blue-50 border border-blue-200 p-4">
            <p className="text-sm font-medium text-blue-800">Changes apply immediately</p>
            <p className="mt-1 text-sm text-blue-700">
              Updating a profile reconfigures all cameras using it within seconds. Viewers may see a brief interruption (2-5s).
            </p>
          </div>
          <div className="rounded-md bg-red-50 border border-red-200 p-4">
            <p className="text-sm font-medium text-red-800">CPU usage warning</p>
            <p className="mt-1 text-sm text-red-700">
              Each H.264 transcoded camera runs an FFmpeg process. Expect 50-100 cameras per CPU core. Use Passthrough or Copy when possible.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function DocsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Documentation</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Guides for using the API and configuring stream profiles.
        </p>
      </div>

      <Tabs defaultValue="workflow">
        <TabsList>
          <TabsTrigger value="workflow">API Workflow</TabsTrigger>
          <TabsTrigger value="profiles">Stream Profile Guide</TabsTrigger>
        </TabsList>

        <TabsContent value="workflow" className="mt-6">
          <ApiWorkflowTab />
        </TabsContent>

        <TabsContent value="profiles" className="mt-6">
          <ProfileGuideTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
