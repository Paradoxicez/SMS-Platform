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
import { ArrowDown } from "lucide-react";

// ─── Shared Components ───────────────────────────────────────────────────────

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

interface Step {
  order: number;
  method: "GET" | "POST" | "PATCH" | "DELETE" | "—";
  path: string;
  label: string;
  description: string;
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

function WorkflowSection({ title, description, steps }: { title: string; description: string; steps: Step[] }) {
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

// ─── API Workflow Tab ─────────────────────────────────────────────────────────

const SETUP_STEPS: Step[] = [
  { order: 1, method: "POST", path: "/projects", label: "Create a Project", description: "Group your cameras by project (e.g. \"Bangkok Office\", \"Factory A\")." },
  { order: 2, method: "POST", path: "/projects/:id/sites", label: "Create a Site", description: "A physical location within a project (e.g. \"Building 1\", \"Parking Lot\")." },
  { order: 3, method: "POST", path: "/sites/:id/cameras", label: "Add a Camera", description: "Register a camera with its RTSP URL. Source codec (H264/H265) is auto-detected on first connection." },
  { order: 4, method: "POST", path: "/cameras/:id/start", label: "Start the Stream", description: "Connects to the camera and starts streaming. H265 cameras are auto-transcoded to H264 for browser compatibility." },
  { order: 5, method: "POST", path: "/api-clients", label: "Create an API Key", description: "Generate a key for external access. The full key is shown only once — save it." },
];

const PLAYBACK_STEPS: Step[] = [
  { order: 1, method: "POST", path: "/playback/sessions", label: "Create a Playback Session", description: "Send camera_id (required) and ttl (optional). TTL defaults to the policy's ttl_default if omitted. Must be within policy's ttl_min/ttl_max range." },
  { order: 2, method: "—", path: "playback_url", label: "Play the Stream", description: "Use the returned playback_url with hls.js, Video.js, or any HLS player. The URL is an HLS .m3u8 manifest." },
  { order: 3, method: "POST", path: "/playback/sessions/:id/refresh", label: "Renew Before Expiry", description: "Call at ~80% of TTL to extend the session. The playback_url stays the same." },
  { order: 4, method: "POST", path: "/playback/sessions/:id/revoke", label: "Revoke When Done (optional)", description: "Immediately invalidate the session. Stream stops and token becomes unusable." },
];

const EMBED_STEPS: Step[] = [
  { order: 1, method: "—", path: "/embed/:cameraId?key=YOUR_API_KEY", label: "Use the Embed URL", description: "Paste the URL into an <iframe>. No backend code needed — the page handles session creation, playback, and auto-renewal automatically." },
];

const MULTI_STEPS: Step[] = [
  { order: 1, method: "GET", path: "/cameras?status=online", label: "List Online Cameras", description: "Get all cameras that are currently streaming." },
  { order: 2, method: "POST", path: "/playback/sessions/batch", label: "Batch Create Sessions", description: "Send multiple camera_ids in one request. TTL is optional. Returns a playback_url for each camera." },
  { order: 3, method: "—", path: "playback_urls[]", label: "Play All Streams", description: "Create one hls.js instance per camera. Only load streams that are visible (lazy load)." },
  { order: 4, method: "POST", path: "/playback/sessions/:id/refresh", label: "Renew Loop", description: "Set a timer per session at 80% of TTL. Renew each session before it expires." },
];

function ApiWorkflowTab() {
  return (
    <div className="space-y-6">
      <WorkflowSection title="1. Initial Setup" description="Do this once to set up your cameras and get an API key." steps={SETUP_STEPS} />
      <Separator />
      <WorkflowSection title="2. Play a Single Stream" description="Create a session, get a URL, play it. Renew before it expires." steps={PLAYBACK_STEPS} />

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
      <WorkflowSection title="3. Embed (Easiest)" description="No backend needed. Just paste an iframe and you're done." steps={EMBED_STEPS} />
      <Separator />
      <WorkflowSection title="4. Multi-Camera Grid" description="Display multiple cameras at once — for dashboards, control rooms, or monitoring pages." steps={MULTI_STEPS} />

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
                  ["POST", "/cameras/analyze", "Detect source codec/resolution"],
                  ["POST", "/cameras/:id/start", "Start stream"],
                  ["POST", "/cameras/:id/stop", "Stop stream"],
                  ["GET", "/cameras", "List cameras"],
                  ["GET", "/cameras/:id", "Get camera detail + source info"],
                  ["POST", "/api-clients", "Create API key"],
                  ["POST", "/playback/sessions", "Create playback session"],
                  ["POST", "/playback/sessions/batch", "Batch create sessions"],
                  ["POST", "/playback/sessions/:id/refresh", "Extend session TTL"],
                  ["POST", "/playback/sessions/:id/revoke", "Revoke session"],
                  ["GET", "/policies", "List policies"],
                  ["POST", "/policies", "Create policy (TTL, rate limit, domain)"],
                  ["GET", "/developer/usage", "API usage stats"],
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

// ─── Policy Guide Tab ────────────────────────────────────────────────────────

function PolicyGuideTab() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">What Policies Control</CardTitle>
          <CardDescription>Policies enforce rules on external playback sessions created via API keys.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Field</TableHead>
                  <TableHead>What It Does</TableHead>
                  <TableHead>Default</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  ["ttl_min / ttl_max", "Session TTL must be within this range", "60 — 300s"],
                  ["ttl_default", "Used when client doesn't specify TTL", "120s"],
                  ["rate_limit_per_min", "Max session requests per API key per camera per minute", "100"],
                  ["viewer_concurrency_limit", "Max active viewers per camera", "50"],
                  ["domain_allowlist", "Only allow embed from these domains (supports *.example.com)", "All domains"],
                ].map(([field, desc, def], i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs">{field}</TableCell>
                    <TableCell className="text-sm">{desc}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{def}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Policy Resolution Order</CardTitle>
          <CardDescription>When a playback session is created, the system finds the effective policy:</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-0">
            {[
              { label: "Camera Policy", desc: "If the camera has a policy assigned directly, use it." },
              { label: "Site Default Policy", desc: "Otherwise, check the site's default policy." },
              { label: "Project Default Policy", desc: "Otherwise, check the project's default policy." },
              { label: "System Defaults", desc: "If no policy found anywhere, use system defaults (TTL 60-300s, no rate limit, no domain restriction)." },
            ].map((item, i, arr) => (
              <div key={i} className="flex flex-col items-center">
                <div className="w-full rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">{i + 1}</div>
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                </div>
                {i < arr.length - 1 && <ArrowDown className="my-1 size-3 text-muted-foreground/50" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
        <p className="text-sm font-medium">Policy applies to external API only</p>
        <p className="text-sm text-muted-foreground">
          Internal console preview (live view) is not affected by policies. Policies only enforce rules when developers create sessions via API keys.
        </p>
      </div>
    </div>
  );
}

// ─── Profile Guide Tab ───────────────────────────────────────────────────────

function ProfileGuideTab() {
  return (
    <div className="space-y-8">
      {/* Quick Start */}
      <div>
        <h2 className="text-lg font-semibold mb-1">Quick Start</h2>
        <p className="text-sm text-muted-foreground mb-3">Common profile presets for typical use cases</p>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Use Case</TableHead>
                <TableHead>Video Processing</TableHead>
                <TableHead>Audio</TableHead>
                <TableHead>Resolution</TableHead>
                <TableHead>FPS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                ["Public website embed", "Transcode (H.264)", "Strip", "720p", "15"],
                ["Security monitoring", "Transcode (H.264)", "Include", "1080p", "Original"],
                ["Low CPU / passthrough", "Original (Passthrough)", "Include", "Original", "Original"],
                ["Mobile / low bandwidth", "Transcode (H.264)", "Strip", "480p", "10"],
                ["Bandwidth saver / grid", "Transcode (H.264)", "Strip", "360p", "5"],
              ].map(([use, proc, audio, res, fps], i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{use}</TableCell>
                  <TableCell className="text-sm">{proc}</TableCell>
                  <TableCell className="text-sm">{audio}</TableCell>
                  <TableCell className="text-sm">{res}</TableCell>
                  <TableCell className="text-sm">{fps}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Separator />

      {/* Video Processing */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Video Processing</CardTitle>
          <CardDescription>How the camera stream is processed before delivery</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border p-4">
            <div className="flex items-center gap-2">
              <Badge>Transcode (H.264)</Badge>
              <Badge variant="secondary" className="ml-auto">Recommended</Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Re-encode to H.264. Allows resolution, framerate, and audio changes. Works with all browsers.
            </p>
            <div className="mt-2 flex gap-2">
              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Uses CPU</Badge>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">All settings applied</Badge>
            </div>
          </div>
          <div className="rounded-md border p-4">
            <div className="flex items-center gap-2">
              <Badge>Original (Passthrough)</Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              No processing. Stream goes directly from camera to viewer. Zero CPU usage but resolution/framerate settings are ignored.
            </p>
            <div className="mt-2 flex gap-2">
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Zero CPU</Badge>
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Settings ignored</Badge>
            </div>
          </div>
          <div className="rounded-md bg-muted/50 p-4">
            <p className="text-sm font-medium mb-2">How to choose:</p>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Camera outputs H.264 and no changes needed? <strong>Original (Passthrough)</strong></li>
              <li>Need to change resolution/framerate/audio? <strong>Transcode (H.264)</strong></li>
              <li>Camera outputs H.265? <strong>Transcode (H.264)</strong> — required for browser compatibility</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* H265 Auto-Transcode */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">H265 Camera Support</CardTitle>
          <CardDescription>How the system handles H.265 (HEVC) cameras</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Most browsers cannot play H.265 video. When a camera is detected as H.265, the system automatically creates a transcoded H.264 stream for browser playback.
          </p>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Camera Codec</TableHead>
                  <TableHead>Preview (Console)</TableHead>
                  <TableHead>External (API)</TableHead>
                  <TableHead>FFmpeg</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell><Badge variant="outline">H264</Badge></TableCell>
                  <TableCell className="text-sm">Original stream directly</TableCell>
                  <TableCell className="text-sm">Profile transcode (if set)</TableCell>
                  <TableCell className="text-sm text-muted-foreground">Only if profile is Transcode</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><Badge variant="outline">H265</Badge></TableCell>
                  <TableCell className="text-sm">Auto H264 transcode</TableCell>
                  <TableCell className="text-sm">Profile transcode (from H264)</TableCell>
                  <TableCell className="text-sm text-muted-foreground">Always (auto + profile)</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">
            Source codec is auto-detected when a camera connects. You can also use <code className="bg-muted px-1 rounded">POST /cameras/analyze</code> to check before adding.
          </p>
        </CardContent>
      </Card>

      <Separator />

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
        <p className="text-sm text-muted-foreground mb-3">Downscale the video to save bandwidth (Transcode mode only)</p>
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
        <p className="text-sm text-muted-foreground mb-3">Limit FPS to save bandwidth and CPU (Transcode mode only)</p>
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
          <div className="rounded-md bg-blue-50 border border-blue-200 p-4">
            <p className="text-sm font-medium text-blue-800">Profiles affect external API streams only</p>
            <p className="mt-1 text-sm text-blue-700">
              Console live preview always shows the original stream (or auto-transcoded H264 for H265 cameras). Profiles control what developers get via the playback API.
            </p>
          </div>
          <div className="rounded-md bg-yellow-50 border border-yellow-200 p-4">
            <p className="text-sm font-medium text-yellow-800">Passthrough ignores all profile settings</p>
            <p className="mt-1 text-sm text-yellow-700">
              Resolution, framerate, and audio settings only apply in Transcode mode. Passthrough sends the camera's native stream as-is.
            </p>
          </div>
          <div className="rounded-md bg-green-50 border border-green-200 p-4">
            <p className="text-sm font-medium text-green-800">Changes apply immediately</p>
            <p className="mt-1 text-sm text-green-700">
              Updating a profile reconfigures all cameras using it within seconds. Viewers may see a brief interruption (2-5s).
            </p>
          </div>
          <div className="rounded-md bg-red-50 border border-red-200 p-4">
            <p className="text-sm font-medium text-red-800">CPU usage warning</p>
            <p className="mt-1 text-sm text-red-700">
              Each transcoded camera runs an FFmpeg process. H265 cameras use 2 FFmpeg processes (auto H264 + profile). Use Passthrough when possible.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function DocsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Documentation</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Guides for using the API, configuring stream profiles, and managing policies.
        </p>
      </div>

      <Tabs defaultValue="workflow">
        <TabsList>
          <TabsTrigger value="workflow">API Workflow</TabsTrigger>
          <TabsTrigger value="policies">Policies</TabsTrigger>
          <TabsTrigger value="profiles">Stream Profiles</TabsTrigger>
        </TabsList>

        <TabsContent value="workflow" className="mt-6">
          <ApiWorkflowTab />
        </TabsContent>

        <TabsContent value="policies" className="mt-6">
          <PolicyGuideTab />
        </TabsContent>

        <TabsContent value="profiles" className="mt-6">
          <ProfileGuideTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
