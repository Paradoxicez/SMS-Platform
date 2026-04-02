"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Cpu, MemoryStick, HardDrive, Database } from "lucide-react";
import { apiClient } from "@/lib/api-client";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface MetricPoint {
  t: string;
  cpu: number;
  cpuCores?: number;
  mem: number;
  memUsed?: number;
  memTotal?: number;
  disk: number;
  diskUsed?: number;
  diskTotal?: number;
  bwIn: number;
  bwOut: number;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getStatusColor(percent: number): string {
  if (percent >= 80) return "#ef4444"; // red
  if (percent >= 50) return "#f59e0b"; // amber
  return "#22c55e"; // green
}

function formatBytes(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}

// ─── Animated Number ───────────────────────────────────────────────────────────

function AnimatedNumber({
  value,
  suffix = "%",
  color,
}: {
  value: number;
  suffix?: string;
  color?: string;
}) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    const prev = prevRef.current;
    const diff = value - prev;
    if (diff === 0) return;

    const steps = 15;
    let step = 0;
    const interval = setInterval(() => {
      step++;
      setDisplay(Math.round(prev + (diff * step) / steps));
      if (step >= steps) {
        clearInterval(interval);
        setDisplay(value);
      }
    }, 20);

    prevRef.current = value;
    return () => clearInterval(interval);
  }, [value]);

  return (
    <span
      className="tabular-nums transition-colors duration-500"
      style={{ color: color ?? getStatusColor(value) }}
    >
      {display}{suffix}
    </span>
  );
}

// ─── Metric Card ───────────────────────────────────────────────────────────────

function MetricCard({
  icon: Icon,
  label,
  percent,
  subtitle,
}: {
  icon: React.ElementType;
  label: string;
  percent: number;
  subtitle: string;
}) {
  const color = getStatusColor(percent);

  return (
    <Card
      className="relative overflow-hidden transition-all duration-500"
      style={{ borderColor: `${color}22` }}
    >
      <CardContent className="px-4 py-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Icon className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">{label}</span>
          </div>
          <span className="text-xs text-muted-foreground">{subtitle}</span>
        </div>

        {/* Number + progress */}
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold shrink-0" style={{ color }}>
            <AnimatedNumber value={percent} />
          </span>
          <div className="relative h-2 w-full rounded-full bg-muted overflow-hidden flex-1">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${percent}%`,
                background: `linear-gradient(90deg, ${color}88, ${color})`,
                boxShadow: `0 0 6px ${color}44`,
              }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Recording Storage Card ─────────────────────────────────────────────────────

interface StorageUsage {
  total_bytes: number;
  total_count: number;
  top_cameras: {
    camera_id: string;
    total_bytes: number;
    recording_count: number;
  }[];
}

function formatStorageBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(1)} ${units[i] ?? "B"}`;
}

function RecordingStorageCard() {
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUsage = useCallback(async () => {
    try {
      const res = await apiClient.get<{ data: StorageUsage }>(
        "/recording-config/storage-usage",
      );
      setUsage(res.data);
    } catch {
      setUsage(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  if (loading) {
    return (
      <Card className="h-[70px] animate-pulse bg-muted/50" />
    );
  }

  if (!usage) {
    return (
      <Card className="relative overflow-hidden" style={{ borderColor: "#64748b22" }}>
        <CardContent className="px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <Database className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">Recordings</span>
          </div>
          <span className="text-xs text-muted-foreground">Unavailable</span>
        </CardContent>
      </Card>
    );
  }

  // Estimate a reasonable cap for the progress bar (1 TB default)
  const capBytes = 1_099_511_627_776;
  const percent = Math.min(Math.round((usage.total_bytes / capBytes) * 100), 100);
  const color = getStatusColor(percent);

  return (
    <Card
      className="relative overflow-hidden transition-all duration-500"
      style={{ borderColor: `${color}22` }}
    >
      <CardContent className="px-4 py-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Database className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">Recordings</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {usage.total_count.toLocaleString()} files
          </span>
        </div>

        {/* Number + progress */}
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold shrink-0 tabular-nums" style={{ color }}>
            {formatStorageBytes(usage.total_bytes)}
          </span>
          <div className="relative h-2 w-full rounded-full bg-muted overflow-hidden flex-1">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${Math.max(percent, 2)}%`,
                background: `linear-gradient(90deg, ${color}88, ${color})`,
                boxShadow: `0 0 6px ${color}44`,
              }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Component with SSE ───────────────────────────────────────────────────

// Strip /api/v1 suffix if present — SSE URL is built with full path
const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1").replace(/\/api\/v1$/, "");

export function SystemResources() {
  const [current, setCurrent] = useState<MetricPoint | null>(null);
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // SSE doesn't support custom headers, so use the cookie-based auth
    const url = `${API_BASE}/api/v1/system/metrics/stream`;
    const es = new EventSource(url, { withCredentials: true });
    eventSourceRef.current = es;

    es.addEventListener("history", (e) => {
      try {
        const history = JSON.parse(e.data) as MetricPoint[];
        if (history.length > 0) setCurrent(history[history.length - 1]!);
        setConnected(true);
      } catch { /* ignore */ }
    });

    es.addEventListener("metric", (e) => {
      try {
        const point = JSON.parse(e.data) as MetricPoint;
        setCurrent(point);
        setConnected(true);
      } catch { /* ignore */ }
    });

    es.onerror = () => {
      setConnected(false);
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, []);

  // Fallback: if SSE fails, poll the REST endpoint
  useEffect(() => {
    if (connected) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/system/metrics`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const json = await res.json();
        const d = json.data;
        if (d?.current) {
          setCurrent({
            t: d.current.timestamp,
            cpu: d.current.cpu.percent,
            cpuCores: d.current.cpu.cores,
            mem: d.current.memory.percent,
            memUsed: d.current.memory.used,
            memTotal: d.current.memory.total,
            disk: d.current.disk.percent,
            diskUsed: d.current.disk.used,
            diskTotal: d.current.disk.total,
            bwIn: d.current.bandwidth.inRate,
            bwOut: d.current.bandwidth.outRate,
          });
        }
      } catch { /* ignore */ }
    }, 3000);

    return () => clearInterval(interval);
  }, [connected]);

  if (!current) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="h-[70px] animate-pulse bg-muted/50" />
        ))}
      </div>
    );
  }

  return (
    <div className="shrink-0">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          icon={Cpu}
          label="CPU"
          percent={current.cpu}
          subtitle={`${current.cpuCores ?? 0} cores`}
        />
        <MetricCard
          icon={MemoryStick}
          label="Memory"
          percent={current.mem}
          subtitle={current.memTotal ? `${formatBytes(current.memUsed ?? 0)} / ${formatBytes(current.memTotal)}` : ""}
        />
        <MetricCard
          icon={HardDrive}
          label="Storage"
          percent={current.disk}
          subtitle={current.diskTotal ? `${formatBytes(current.diskUsed ?? 0)} / ${formatBytes(current.diskTotal)}` : ""}
        />
        <RecordingStorageCard />
      </div>
    </div>
  );
}
