import os from "node:os";
import { execSync } from "node:child_process";
import { redis } from "../lib/redis";
import { mediamtxFetch } from "../lib/mediamtx-fetch";

// ─── CPU Usage ─────────────────────────────────────────────────────────────────

let prevCpuIdle = 0;
let prevCpuTotal = 0;

function getCpuUsage(): number {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;
  for (const cpu of cpus) {
    idle += cpu.times.idle;
    total += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq;
  }

  const idleDiff = idle - prevCpuIdle;
  const totalDiff = total - prevCpuTotal;
  prevCpuIdle = idle;
  prevCpuTotal = total;

  if (totalDiff === 0) return 0;
  return Math.round((1 - idleDiff / totalDiff) * 100);
}

// ─── Memory Usage ──────────────────────────────────────────────────────────────

function getMemoryUsage(): { used: number; total: number; percent: number } {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  return {
    used: Math.round(used / 1024 / 1024), // MB
    total: Math.round(total / 1024 / 1024), // MB
    percent: Math.round((used / total) * 100),
  };
}

// ─── Disk Usage ────────────────────────────────────────────────────────────────

function getDiskUsage(): { used: number; total: number; percent: number } {
  try {
    const output = execSync("df -k / | tail -1", { encoding: "utf-8" });
    const parts = output.trim().split(/\s+/);
    // df -k output: Filesystem 1K-blocks Used Available Use% Mounted
    const totalKb = parseInt(parts[1] ?? "0", 10);
    const usedKb = parseInt(parts[2] ?? "0", 10);
    const total = Math.round(totalKb / 1024); // MB
    const used = Math.round(usedKb / 1024); // MB
    const percent = total > 0 ? Math.round((used / total) * 100) : 0;
    return { used, total, percent };
  } catch {
    return { used: 0, total: 0, percent: 0 };
  }
}

// ─── Bandwidth (from MediaMTX) ─────────────────────────────────────────────────

let prevBandwidthIn = 0;
let prevBandwidthOut = 0;
let prevBandwidthTime = Date.now();

async function getBandwidth(): Promise<{
  inRate: number;
  outRate: number;
  totalInBytes: number;
  totalOutBytes: number;
}> {
  try {
    const res = await mediamtxFetch("/v3/paths/list");
    if (!res.ok) return { inRate: 0, outRate: 0, totalInBytes: 0, totalOutBytes: 0 };

    const data = (await res.json()) as {
      items: { inboundBytes: number; outboundBytes: number }[];
    };

    let totalIn = 0;
    let totalOut = 0;
    for (const item of data.items ?? []) {
      totalIn += item.inboundBytes ?? 0;
      totalOut += item.outboundBytes ?? 0;
    }

    const now = Date.now();
    const elapsed = (now - prevBandwidthTime) / 1000; // seconds
    const inRate = elapsed > 0 ? Math.round(((totalIn - prevBandwidthIn) / elapsed) * 8 / 1000) : 0; // kbps
    const outRate = elapsed > 0 ? Math.round(((totalOut - prevBandwidthOut) / elapsed) * 8 / 1000) : 0; // kbps

    prevBandwidthIn = totalIn;
    prevBandwidthOut = totalOut;
    prevBandwidthTime = now;

    return {
      inRate: Math.max(0, inRate),
      outRate: Math.max(0, outRate),
      totalInBytes: totalIn,
      totalOutBytes: totalOut,
    };
  } catch {
    return { inRate: 0, outRate: 0, totalInBytes: 0, totalOutBytes: 0 };
  }
}

// ─── Snapshot (current values) ─────────────────────────────────────────────────

export async function getSystemMetricsSnapshot() {
  const cpu = getCpuUsage();
  const memory = getMemoryUsage();
  const disk = getDiskUsage();
  const bandwidth = await getBandwidth();

  return {
    timestamp: new Date().toISOString(),
    cpu: { percent: cpu, cores: os.cpus().length },
    memory,
    disk,
    bandwidth,
  };
}

// ─── History (stored in Redis) ──────────────────────────────────────────────────

const HISTORY_KEY = "system:metrics:history";
const MAX_POINTS = 60; // 1 hour at 1-min intervals

export async function recordMetricsPoint() {
  const snapshot = await getSystemMetricsSnapshot();
  const point = {
    t: snapshot.timestamp,
    cpu: snapshot.cpu.percent,
    mem: snapshot.memory.percent,
    disk: snapshot.disk.percent,
    bwIn: snapshot.bandwidth.inRate,
    bwOut: snapshot.bandwidth.outRate,
  };

  await redis.lpush(HISTORY_KEY, JSON.stringify(point));
  await redis.ltrim(HISTORY_KEY, 0, MAX_POINTS - 1);
}

export async function getMetricsHistory(): Promise<
  { t: string; cpu: number; mem: number; disk: number; bwIn: number; bwOut: number }[]
> {
  const raw = await redis.lrange(HISTORY_KEY, 0, MAX_POINTS - 1);
  return raw
    .map((s) => {
      try {
        return JSON.parse(s);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .reverse(); // oldest first for chart
}

// ─── Background collector ──────────────────────────────────────────────────────

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startMetricsCollector(intervalMs = 60_000) {
  // Initial reading to prime CPU diff
  getCpuUsage();
  getBandwidth();

  // Record first point after 2 seconds (let CPU diff stabilize)
  setTimeout(() => recordMetricsPoint().catch(() => {}), 2000);

  intervalId = setInterval(() => {
    recordMetricsPoint().catch(() => {});
  }, intervalMs);
}

export function stopMetricsCollector() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
