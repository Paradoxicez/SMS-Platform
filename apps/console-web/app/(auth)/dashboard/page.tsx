"use client";

import { useEffect, useState, useCallback } from "react";
import { useCameraStatusStream } from "@/hooks/use-camera-status-stream";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { apiClient, type DashboardStats } from "@/lib/api-client";
import { OnboardingWizard } from "@/components/onboarding/wizard";
import { SystemResources } from "@/components/dashboard/system-resources";
import {
  Camera,
  Wifi,
  WifiOff,
  AlertTriangle,
  PlayCircle,
  ArrowUpRight,
  Rocket,
  FolderKanban,
  Building2,
} from "lucide-react";
import { formatTime } from "@/lib/format-date";
import type { Camera as CameraType } from "@repo/types";

interface AuditEvent {
  id: string;
  timestamp: string;
  event_type?: string;
  eventType?: string;
  actor_type?: string;
  actorType?: string;
  resource_type?: string;
  resourceType?: string;
}

function eventBadgeVariant(eventType?: string) {
  if (!eventType) return "secondary" as const;
  if (eventType.startsWith("session.")) return "default" as const;
  if (eventType.startsWith("camera.")) return "secondary" as const;
  if (eventType.includes("denied")) return "destructive" as const;
  return "outline" as const;
}

// ─── Dashboard Page ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    total_cameras: 0,
    online_count: 0,
    offline_count: 0,
    degraded_count: 0,
    active_sessions: 0,
  });
  const [loading, setLoading] = useState(true);
  const [problemCameras, setProblemCameras] = useState<CameraType[]>([]);
  const [recentEvents, setRecentEvents] = useState<AuditEvent[]>([]);
  const [projectCount, setProjectCount] = useState(0);
  const [siteCount, setSiteCount] = useState(0);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [onboardingSkipped, setOnboardingSkipped] = useState(false);

  // Real-time camera status updates
  useCameraStatusStream(
    useCallback((event) => {
      const { previous_state, new_state } = event;

      // Update stat counts
      setStats((prev) => {
        const next = { ...prev };
        // Decrement old status count
        if (previous_state === "online") next.online_count = Math.max(0, next.online_count - 1);
        else if (previous_state === "offline") next.offline_count = Math.max(0, next.offline_count - 1);
        else if (previous_state === "degraded") next.degraded_count = Math.max(0, next.degraded_count - 1);
        // Increment new status count
        if (new_state === "online") next.online_count += 1;
        else if (new_state === "offline") next.offline_count += 1;
        else if (new_state === "degraded") next.degraded_count += 1;
        return next;
      });

      // Update problem cameras list
      setProblemCameras((prev) =>
        prev
          .map((cam) =>
            cam.id === event.camera_id
              ? { ...cam, health_status: new_state as CameraType["health_status"] }
              : cam,
          )
          .filter((cam) => cam.health_status === "offline" || cam.health_status === "degraded"),
      );
    }, []),
  );

  useEffect(() => {
    // Onboarding check
    async function fetchOnboardingStatus() {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
        const res = await fetch(`${apiUrl}/api/v1/onboarding/status`, {
          credentials: "include",
        });
        if (res.ok) {
          const body = await res.json();
          setOnboardingCompleted(body?.data?.completed ?? true);
          if (!body?.data?.completed) setShowWizard(true);
        } else {
          setOnboardingCompleted(true);
        }
      } catch {
        setOnboardingCompleted(true);
      }
    }
    fetchOnboardingStatus();

    // Dashboard stats
    apiClient.getDashboardStats()
      .then((res) => setStats(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));

    // Problem cameras (offline + degraded)
    Promise.all([
      apiClient.listCameras({ status: "offline", per_page: 10 }),
      apiClient.listCameras({ status: "degraded", per_page: 10 }),
    ])
      .then(([offline, degraded]) => {
        setProblemCameras([...(offline.data ?? []), ...(degraded.data ?? [])]);
      })
      .catch(() => {});

    // Recent audit events
    apiClient
      .get<{ data: AuditEvent[] }>("/audit/events?per_page=5")
      .then((res) => setRecentEvents(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});

    // Project + site counts
    apiClient.listProjects(1, 1)
      .then((res) => setProjectCount(res.pagination?.total ?? 0))
      .catch(() => {});

    apiClient.get<{ data: unknown[]; pagination: { total: number } }>("/sites?per_page=1")
      .then((res) => setSiteCount(res.pagination?.total ?? 0))
      .catch(() => setSiteCount(0));
  }, []);

  const statCards = [
    { label: "Total Cameras", value: stats.total_cameras, icon: Camera, sub: "Registered devices" },
    { label: "Online", value: stats.online_count, icon: Wifi, sub: "Streaming now", accent: "text-emerald-600", dot: "bg-emerald-500" },
    { label: "Offline", value: stats.offline_count, icon: WifiOff, sub: "Disconnected", accent: "text-red-500", dot: "bg-red-500" },
    { label: "Degraded", value: stats.degraded_count, icon: AlertTriangle, sub: "Needs attention", accent: "text-amber-500", dot: "bg-amber-500" },
    { label: "Active Sessions", value: stats.active_sessions, icon: PlayCircle, sub: "Viewers connected" },
  ];

  return (
    <div className="flex flex-col gap-3 h-[calc(100vh-3rem)] -m-6 p-4 overflow-hidden">
      {/* Onboarding Wizard */}
      <OnboardingWizard
        open={showWizard}
        onComplete={() => { setShowWizard(false); setOnboardingCompleted(true); }}
        onSkip={() => { setShowWizard(false); setOnboardingSkipped(true); }}
      />

      {onboardingCompleted === false && onboardingSkipped && !showWizard && (
        <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
          <div className="flex items-center gap-3">
            <Rocket className="size-5 text-primary" />
            <div>
              <p className="text-sm font-medium">Complete your setup</p>
              <p className="text-xs text-muted-foreground">Add your first camera to get started.</p>
            </div>
          </div>
          <Button size="sm" onClick={() => setShowWizard(true)}>Resume Setup</Button>
        </div>
      )}

      {/* Row 1: Stat Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {statCards.map((s) => (
          <Card key={s.label} className="relative overflow-hidden">
            <CardContent className="px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{s.label}</span>
                <s.icon className="size-4 text-muted-foreground/50" />
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className={`text-2xl font-semibold tabular-nums ${s.accent ?? ""}`}>
                  {loading ? "--" : s.value}
                </span>
                {s.dot && <div className={`size-1.5 rounded-full ${s.dot} animate-pulse`} />}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{s.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Row 2: Camera Status + Project Summary + Recent Events (3 equal cols) */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3 flex-1 min-h-0">
        {/* Camera Status */}
        <Card className="flex flex-col overflow-hidden">
          <CardHeader className="pb-3 shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Camera Status</CardTitle>
              <a href="/cameras" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                View all <ArrowUpRight className="size-3" />
              </a>
            </div>
          </CardHeader>
          <Separator />
          <CardContent className="p-0">
            {problemCameras.length === 0 ? (
              <div className="flex items-center gap-3 px-6 py-4">
                <div className="rounded-full bg-emerald-50 p-2">
                  <Wifi className="size-4 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-emerald-600">All cameras healthy</p>
                  <p className="text-xs text-muted-foreground">No issues detected</p>
                </div>
              </div>
            ) : (
              <div className="divide-y">
                {problemCameras.slice(0, 5).map((cam) => (
                  <a
                    key={cam.id}
                    href="/cameras"
                    className="flex items-center gap-3 px-6 py-2.5 hover:bg-muted/50 transition-colors"
                  >
                    <div className={`size-2 rounded-full shrink-0 ${
                      cam.health_status === "offline" ? "bg-red-500" : "bg-amber-500"
                    }`} />
                    <span className="flex-1 text-sm truncate">{cam.name}</span>
                    <Badge variant={cam.health_status === "offline" ? "destructive" : "secondary"} className="text-[10px]">
                      {cam.health_status}
                    </Badge>
                  </a>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Project Summary */}
        <Card className="flex flex-col overflow-hidden">
          <CardHeader className="pb-3 shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Project Summary</CardTitle>
              <a href="/projects" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                View all <ArrowUpRight className="size-3" />
              </a>
            </div>
          </CardHeader>
          <Separator />
          <CardContent className="p-0">
            <div className="divide-y">
              <a href="/projects" className="flex items-center justify-between px-6 py-2.5 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2">
                  <FolderKanban className="size-4 text-muted-foreground" />
                  <span className="text-sm">Projects</span>
                </div>
                <span className="text-sm font-medium tabular-nums">{projectCount}</span>
              </a>
              <div className="flex items-center justify-between px-6 py-2.5">
                <div className="flex items-center gap-2">
                  <Building2 className="size-4 text-muted-foreground" />
                  <span className="text-sm">Sites</span>
                </div>
                <span className="text-sm font-medium tabular-nums">{siteCount}</span>
              </div>
              <a href="/cameras" className="flex items-center justify-between px-6 py-2.5 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2">
                  <Camera className="size-4 text-muted-foreground" />
                  <span className="text-sm">Cameras</span>
                </div>
                <span className="text-sm font-medium tabular-nums">{stats.total_cameras}</span>
              </a>
              <div className="flex items-center justify-between px-6 py-2.5">
                <div className="flex items-center gap-2">
                  <PlayCircle className="size-4 text-muted-foreground" />
                  <span className="text-sm">Active Sessions</span>
                </div>
                <span className="text-sm font-medium tabular-nums">{stats.active_sessions}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Events */}
        <Card className="flex flex-col overflow-hidden">
          <CardHeader className="pb-3 shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent Events</CardTitle>
              <a href="/audit" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                View all <ArrowUpRight className="size-3" />
              </a>
            </div>
          </CardHeader>
          <Separator />
          <CardContent className="p-0">
            {recentEvents.length === 0 ? (
              <div className="px-6 py-4">
                <p className="text-sm text-muted-foreground">No recent events</p>
              </div>
            ) : (
              <div className="divide-y">
                {recentEvents.map((event) => {
                  const eventType = event.event_type ?? event.eventType ?? "unknown";
                  return (
                    <div key={event.id} className="flex items-center gap-3 px-6 py-2.5">
                      <Badge variant={eventBadgeVariant(eventType)} className="text-[10px] shrink-0">
                        {eventType}
                      </Badge>
                      <span className="flex-1 text-xs text-muted-foreground truncate">
                        {event.resource_type ?? event.resourceType ?? ""}
                      </span>
                      <time className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">
                        {formatTime(event.timestamp)}
                      </time>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3: System Resources (Realtime) */}
      <SystemResources />
    </div>
  );
}
