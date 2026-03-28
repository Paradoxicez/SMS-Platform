"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Cpu, MemoryStick, HardDrive, Activity } from "lucide-react";

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

function getGlowColor(percent: number): string {
  if (percent >= 80) return "rgba(239,68,68,0.15)";
  if (percent >= 50) return "rgba(245,158,11,0.15)";
  return "rgba(34,197,94,0.1)";
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
  data,
  dataKey,
  showChart = true,
}: {
  icon: React.ElementType;
  label: string;
  percent: number;
  subtitle: string;
}) {
  const color = getStatusColor(percent);
  const glow = getGlowColor(percent);

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

// ─── Bandwidth Card (special: shows in + out) ──────────────────────────────────

function BandwidthCard({
  data,
  currentIn,
  currentOut,
}: {
  data: MetricPoint[];
  currentIn: number;
  currentOut: number;
}) {
  const color = "#22c55e";
  const glow = "rgba(34,197,94,0.1)";

  return (
    <Card
      className="relative overflow-hidden transition-all duration-500"
      style={{ borderColor: `${color}22` }}
    >
      <CardContent className="px-4 py-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Activity className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">Streaming</span>
          </div>
          <span className="text-xs text-muted-foreground">kbps</span>
        </div>

        {/* In/Out numbers */}
        <div className="flex items-center gap-3">
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold tabular-nums text-blue-500">
              <AnimatedNumber value={currentIn} suffix="" color="#3b82f6" />
            </span>
            <span className="text-xs text-muted-foreground">in</span>
          </div>
          <span className="text-muted-foreground">/</span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold tabular-nums text-emerald-500">
              <AnimatedNumber value={currentOut} suffix="" color="#22c55e" />
            </span>
            <span className="text-xs text-muted-foreground">out</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Component with SSE ───────────────────────────────────────────────────

const MAX_POINTS = 60;
// Strip /api/v1 suffix if present — SSE URL is built with full path
const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1").replace(/\/api\/v1$/, "");

export function SystemResources() {
  const [data, setData] = useState<MetricPoint[]>([]);
  const [current, setCurrent] = useState<MetricPoint | null>(null);
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;

    // SSE doesn't support custom headers, so use the cookie-based auth
    const url = `${API_BASE}/api/v1/system/metrics/stream`;
    const es = new EventSource(url, { withCredentials: true });
    eventSourceRef.current = es;

    es.addEventListener("history", (e) => {
      try {
        const history = JSON.parse(e.data) as MetricPoint[];
        setData(history);
        if (history.length > 0) setCurrent(history[history.length - 1]!);
        setConnected(true);
      } catch { /* ignore */ }
    });

    es.addEventListener("metric", (e) => {
      try {
        const point = JSON.parse(e.data) as MetricPoint;
        setCurrent(point);
        setData((prev) => {
          const next = [...prev, point];
          if (next.length > MAX_POINTS) next.shift();
          return next;
        });
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
        if (d?.history) setData(d.history);
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
    <div className="space-y-2 shrink-0">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          System Resources
        </span>
        <span
          className={`size-1.5 rounded-full ${connected ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`}
          title={connected ? "Live" : "Reconnecting..."}
        />
      </div>
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
        <BandwidthCard
          data={data}
          currentIn={current.bwIn}
          currentOut={current.bwOut}
        />
      </div>
    </div>
  );
}
