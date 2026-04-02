"use client";

import { useEffect, useState, useCallback } from "react";
import { getApiBaseUrl } from "@/lib/api-url";
import { useCameraStatusStream } from "@/hooks/use-camera-status-stream";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { apiClient, type DashboardStats } from "@/lib/api-client";
import { OnboardingWizard } from "@/components/onboarding/wizard";
import { SystemResources } from "@/components/dashboard/system-resources";
import { BandwidthChart } from "@/components/dashboard/bandwidth-chart";
import { ApiRequestsChart } from "@/components/dashboard/api-requests-chart";
import {
  Camera,
  Wifi,
  WifiOff,
  AlertTriangle,
  PlayCircle,
  ArrowUpRight,
  Rocket,
} from "lucide-react";
import type { Camera as CameraType } from "@repo/types";

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
        const res = await fetch(`${getApiBaseUrl()}/onboarding/status`, {
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

    // Poll viewer count every 5 seconds
    function fetchViewers() {
      apiClient
        .get<{ data: { total_viewers: number; per_camera: Record<string, number> } }>("/cameras/status/viewers")
        .then((res) => {
          setStats((prev) => ({ ...prev, active_sessions: res.data.total_viewers }));
        })
        .catch(() => {});
    }
    fetchViewers();
    const viewerInterval = setInterval(fetchViewers, 5000);
    return () => clearInterval(viewerInterval);
  }, []);

  const statCards = [
    { label: "Total Cameras", value: stats.total_cameras, icon: Camera, sub: "Registered devices", href: "/cameras" },
    { label: "Online", value: stats.online_count, icon: Wifi, sub: "Streaming now", accent: "text-emerald-600", dot: "bg-emerald-500", href: "/cameras?status=online" },
    { label: "Offline", value: stats.offline_count, icon: WifiOff, sub: "Disconnected", accent: "text-red-500", dot: "bg-red-500", href: "/cameras?status=offline" },
    { label: "Degraded", value: stats.degraded_count, icon: AlertTriangle, sub: "Needs attention", accent: "text-amber-500", dot: "bg-amber-500", href: "/cameras?status=degraded" },
    { label: "Live Viewers", value: stats.active_sessions, icon: PlayCircle, sub: "Watching streams now", href: "/cameras?status=online" },
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
          <a key={s.label} href={s.href}>
            <Card className="relative overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
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
          </a>
        ))}
      </div>

      {/* Row 2: Camera Status (left, full height) + Bandwidth + API Usage (right, stacked) */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[2fr_3fr]">
        {/* Left: Camera Status — stretches full height */}
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
          <CardContent className="p-0 flex-1">
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
                {problemCameras.slice(0, 10).map((cam) => (
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

        {/* Right: Bandwidth (top) + API Usage (bottom) */}
        <div className="flex flex-col gap-3">
          <BandwidthChart />
          <ApiRequestsChart />
        </div>
      </div>

      {/* Row 3: System Resources (Realtime) */}
      <SystemResources />
    </div>
  );
}
