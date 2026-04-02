"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts";

interface MetricPoint { t: string; bwIn: number; bwOut: number }

const MAX_POINTS = 60;
const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1").replace(/\/api\/v1$/, "");

const chartConfig = {
  bwIn: { label: "Inbound", color: "#3b82f6" },
  bwOut: { label: "Outbound", color: "#10b981" },
} satisfies ChartConfig;

function formatKbps(v: number): string {
  return v >= 1000 ? `${(v / 1000).toFixed(1)} Mbps` : `${Math.round(v)} kbps`;
}
function formatYAxis(v: number): string { return v >= 1000 ? `${(v / 1000).toFixed(0)}` : `${v}`; }
function formatTime(t: string): string {
  try { return new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }); } catch { return ""; }
}
function formatBytes(b: number): string {
  if (b >= 1073741824) return `${(b / 1073741824).toFixed(1)} GB`;
  if (b >= 1048576) return `${(b / 1048576).toFixed(1)} MB`;
  return `${Math.round(b / 1024)} KB`;
}

export function BandwidthChart() {
  const [data, setData] = useState<MetricPoint[]>([]);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource(`${API_BASE}/api/v1/system/metrics/stream`, { withCredentials: true });
    esRef.current = es;
    es.addEventListener("history", (e) => {
      try { setData(JSON.parse(e.data).map((p: MetricPoint) => ({ t: p.t, bwIn: Math.round(p.bwIn), bwOut: Math.round(p.bwOut) }))); } catch {}
    });
    es.addEventListener("metric", (e) => {
      try {
        const p = JSON.parse(e.data);
        setData((prev) => { const n = [...prev, { t: p.t, bwIn: Math.round(p.bwIn), bwOut: Math.round(p.bwOut) }]; if (n.length > MAX_POINTS) n.shift(); return n; });
      } catch {}
    });
    let fb: ReturnType<typeof setInterval> | null = null;
    es.onerror = () => { if (!fb) fb = setInterval(async () => { try { const r = await fetch(`${API_BASE}/api/v1/system/metrics`, { credentials: "include" }); if (r.ok) { const b = await r.json(); if (b?.data?.history) setData(b.data.history.map((p: MetricPoint) => ({ t: p.t, bwIn: Math.round(p.bwIn), bwOut: Math.round(p.bwOut) }))); } } catch {} }, 3000); };
    return () => { es.close(); esRef.current = null; if (fb) clearInterval(fb); };
  }, []);

  const avgIn = useMemo(() => { const r = data.slice(-5); return r.length ? Math.round(r.reduce((s, p) => s + p.bwIn, 0) / r.length) : 0; }, [data]);
  const avgOut = useMemo(() => { const r = data.slice(-5); return r.length ? Math.round(r.reduce((s, p) => s + p.bwOut, 0) / r.length) : 0; }, [data]);
  const peakBw = useMemo(() => data.length ? Math.max(...data.map((p) => Math.max(p.bwIn, p.bwOut))) : 0, [data]);
  const avgBw = useMemo(() => data.length ? Math.round(data.reduce((s, p) => s + p.bwIn + p.bwOut, 0) / data.length) : 0, [data]);
  const totalEst = useMemo(() => avgBw * data.length * 1024 / 8, [avgBw, data.length]);
  const yUnit = useMemo(() => (data.length ? Math.max(...data.map((p) => Math.max(p.bwIn, p.bwOut))) : 0) >= 1000 ? "Mbps" : "kbps", [data]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Bandwidth</CardTitle>
            <CardDescription>Real-time network throughput</CardDescription>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-blue-500" />In: {formatKbps(avgIn)}</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-emerald-500" />Out: {formatKbps(avgOut)}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <ChartContainer config={chartConfig} className="h-[180px] w-full">
          {data.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Waiting for data...</div>
          ) : (
            <AreaChart data={data} accessibilityLayer>
              <defs>
                <linearGradient id="fillIn" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--color-bwIn)" stopOpacity={0.3} /><stop offset="100%" stopColor="var(--color-bwIn)" stopOpacity={0.02} /></linearGradient>
                <linearGradient id="fillOut" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--color-bwOut)" stopOpacity={0.3} /><stop offset="100%" stopColor="var(--color-bwOut)" stopOpacity={0.02} /></linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="t" tickFormatter={formatTime} tickLine={false} axisLine={false} tickMargin={8} minTickGap={80} fontSize={10} />
              <YAxis tickFormatter={formatYAxis} tickLine={false} axisLine={false} width={35} fontSize={10} label={{ value: yUnit, position: "insideTopLeft", offset: -5, style: { fontSize: 9 } }} />
              <ChartTooltip content={<ChartTooltipContent indicator="dot" labelFormatter={(l) => formatTime(String(l))} formatter={(value, name) => { const v = formatKbps(Number(value)); return (<><div className="shrink-0 rounded-[2px] h-2.5 w-2.5" style={{ backgroundColor: `var(--color-${String(name)})` }} /><span className="text-muted-foreground">{chartConfig[name as keyof typeof chartConfig]?.label}</span><span className="ml-auto font-mono font-medium">{v}</span></>); }} />} />
              <Area type="monotone" dataKey="bwIn" stroke="var(--color-bwIn)" strokeWidth={1.5} fill="url(#fillIn)" dot={false} isAnimationActive={false} />
              <Area type="monotone" dataKey="bwOut" stroke="var(--color-bwOut)" strokeWidth={1.5} fill="url(#fillOut)" dot={false} isAnimationActive={false} />
            </AreaChart>
          )}
        </ChartContainer>
        <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-2 mt-2 px-1">
          <span>Peak: <strong className="text-foreground">{formatKbps(peakBw)}</strong></span>
          <span>Avg: <strong className="text-foreground">{formatKbps(avgBw)}</strong></span>
          <span>Total: <strong className="text-foreground">{formatBytes(totalEst)}</strong></span>
        </div>
      </CardContent>
    </Card>
  );
}
