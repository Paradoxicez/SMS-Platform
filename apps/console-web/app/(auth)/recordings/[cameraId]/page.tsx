"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Download,
  ArrowLeft,
  Settings,
  CircleDot,
  X,
  Trash2,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RecordingTimeline } from "@/components/recordings/recording-timeline";
import { RecordingPlayer } from "@/components/recordings/recording-player";
import { formatTime } from "@/lib/format-date";
import { apiClient } from "@/lib/api-client";
import { useUserRole } from "@/lib/use-user-role";

// ---------- Types ----------

interface Recording {
  id: string;
  camera_id: string;
  start_time: string;
  end_time: string;
  file_format: string;
  size_bytes: number;
  retention_days: number;
  storage_type: string;
}

interface CameraInfo {
  id: string;
  name: string;
  health_status?: string;
  tags?: unknown;
  recording_mode?: string;
  retention_days?: number;
  storage_used?: number;
  inherited_from?: string;
}

// ---------- Helpers ----------

function formatDuration(ms: number): string {
  if (ms <= 0) return "0s";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i] ?? "B"}`;
}

function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDate(dateStr: string): Date {
  const parts = dateStr.split("-").map(Number);
  return new Date(parts[0] ?? 2026, (parts[1] ?? 1) - 1, parts[2] ?? 1);
}

function formatDisplayDate(dateStr: string): string {
  const d = parseDate(dateStr);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ---------- Inner page (needs useSearchParams) ----------

function RecordingDetailContent() {
  const { canEdit } = useUserRole();
  const params = useParams<{ cameraId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const cameraId = params.cameraId;

  const initialDate = searchParams.get("date") || toDateStr(new Date());
  const clipParam = searchParams.get("clip");

  const [currentDate, setCurrentDate] = useState(initialDate);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [camera, setCamera] = useState<CameraInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [currentPlayTime, setCurrentPlayTime] = useState<Date | null>(null);
  const [autoPlayed, setAutoPlayed] = useState(false);
  const [activeClipIndex, setActiveClipIndex] = useState<number>(-1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Fetch camera info
  useEffect(() => {
    async function fetchCamera() {
      try {
        const res = await apiClient.getCamera(cameraId);
        const c = res.data as any;
        setCamera({
          id: c.id,
          name: c.name,
          health_status: c.health_status,
          tags: c.tags,
          recording_mode: c.recording_mode,
          retention_days: c.retention_days,
          storage_used: c.storage_used,
          inherited_from: c.inherited_from,
        });
      } catch {
        // Camera fetch failed
      }
    }
    fetchCamera();
  }, [cameraId]);

  // Fetch recordings for the current date
  const fetchRecordings = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      p.set("from", currentDate + "T00:00:00.000Z");
      p.set("to", currentDate + "T23:59:59.999Z");

      const res = await apiClient.get<{ data: Recording[] }>(
        `/cameras/${cameraId}/recordings?${p.toString()}`,
      );
      setRecordings(res.data);
    } catch {
      setRecordings([]);
    } finally {
      setLoading(false);
    }
  }, [cameraId, currentDate]);

  useEffect(() => {
    fetchRecordings();
  }, [fetchRecordings]);

  // Auto-play first complete clip when recordings load
  useEffect(() => {
    if (autoPlayed || loading || recordings.length === 0) return;
    setAutoPlayed(true);

    // If clip param specified, play that one
    if (clipParam) {
      const target = recordings.find((r) => r.id === clipParam);
      if (target) { playRecording(target.id); return; }
    }

    // Otherwise play the latest complete recording
    const complete = recordings.filter((r) => r.end_time && r.size_bytes > 0);
    if (complete.length > 0) {
      playRecording(complete[0]!.id);
    }
  }, [loading, recordings, autoPlayed, clipParam]);

  // Day navigation
  function navigateDay(offset: number) {
    const d = parseDate(currentDate);
    d.setDate(d.getDate() + offset);
    const newDate = toDateStr(d);
    setCurrentDate(newDate);
    setPlaybackUrl(null);
    setCurrentPlayTime(null);
    router.replace(`/recordings/${cameraId}?date=${newDate}`);
  }

  // Play a specific recording clip — uses API stream endpoint with blob URL
  // for Safari compatibility (Safari requires Content-Length which MediaMTX doesn't provide)
  async function playRecording(recordingId: string) {
    // Track active clip index
    const idx = recordings.findIndex((r) => r.id === recordingId);
    setActiveClipIndex(idx);

    try {
      const headers: Record<string, string> = {};
      try {
        const sessionRes = await fetch("/api/auth/session");
        const session = await sessionRes.json();
        if (session?.accessToken) headers["Authorization"] = `Bearer ${session.accessToken}`;
      } catch { /* continue without token */ }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1"}/recordings/${recordingId}/stream`,
        { headers },
      );
      if (!res.ok) throw new Error(`${res.status}`);

      const blob = await res.blob();
      if (playbackUrl?.startsWith("blob:")) URL.revokeObjectURL(playbackUrl);
      setPlaybackUrl(URL.createObjectURL(blob));
    } catch {
      // Fallback: use MediaMTX playback URL directly (works in Chrome/Firefox)
      try {
        const res = await apiClient.post<{ data: { playback_url: string } }>(
          `/recordings/${recordingId}/playback`, {},
        );
        setPlaybackUrl(res.data.playback_url);
      } catch { /* Playback failed */ }
    }
  }

  // Download a recording
  async function downloadRecording(recordingId: string) {
    try {
      const res = await apiClient.post<{
        data: { playback_url: string };
      }>(`/recordings/${recordingId}/playback`, {});
      window.open(res.data.playback_url, "_blank");
    } catch {
      // Download failed
    }
  }

  // Seek from timeline
  async function handleTimelineSeek(timestamp: Date) {
    // Find the nearest recording that covers this timestamp
    const ts = timestamp.getTime();
    const matching = recordings.find((r) => {
      const start = new Date(r.start_time).getTime();
      const end = new Date(r.end_time).getTime();
      return ts >= start && ts <= end;
    });

    if (matching) {
      await playRecording(matching.id);
      setCurrentPlayTime(timestamp);
    } else {
      // Find nearest recording
      let closest: Recording | null = null;
      let closestDist = Infinity;
      for (const r of recordings) {
        const start = new Date(r.start_time).getTime();
        const dist = Math.abs(ts - start);
        if (dist < closestDist) {
          closestDist = dist;
          closest = r;
        }
      }
      if (closest) {
        await playRecording(closest.id);
        setCurrentPlayTime(new Date(closest.start_time));
      }
    }
  }

  // Player time update handler — use active clip's start time
  function handlePlayerTimeUpdate(currentSec: number) {
    if (activeClipIndex >= 0 && activeClipIndex < recordings.length && playbackUrl) {
      const clipStart = new Date(recordings[activeClipIndex]!.start_time);
      setCurrentPlayTime(new Date(clipStart.getTime() + currentSec * 1000));
    }
  }

  // Bulk actions
  async function handleBulkDownload() {
    for (const id of selectedIds) {
      try {
        const headers: Record<string, string> = {};
        try { const s = await (await fetch("/api/auth/session")).json(); if (s?.accessToken) headers["Authorization"] = `Bearer ${s.accessToken}`; } catch {}
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1"}/recordings/${id}/stream`, { headers });
        if (!res.ok) continue;
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = `recording_${id}.mp4`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      } catch {}
    }
    toast.success(`Downloading ${selectedIds.size} recording(s)`);
  }

  async function handleBulkDelete() {
    try {
      await Promise.all(Array.from(selectedIds).map((id) => apiClient.delete(`/recordings/${id}`)));
      toast.success(`Deleted ${selectedIds.size} recording(s)`);
      setSelectedIds(new Set());
      fetchRecordings();
    } catch { toast.error("Failed to delete"); }
  }

  const isRecordingEnabled = (camera as any)?.recording_enabled === true;

  const recordingStatusBadge = isRecordingEnabled ? (
    <Badge variant="secondary" className="gap-1 bg-red-100 text-red-700">
      <CircleDot className="h-3 w-3" />
      Recording
    </Badge>
  ) : (
    <Badge variant="outline" className="gap-1">
      <CircleDot className="h-3 w-3" />
      Recording Off
    </Badge>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/recordings">
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowLeft className="h-4 w-4" />
              Back to Recordings
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">
              {camera?.name ?? "Loading..."}
            </h1>
            <div className="mt-1 flex items-center gap-2">
              {recordingStatusBadge}
              <Badge
                variant={camera?.health_status === "online" ? "default" : "outline"}
              >
                {camera?.health_status ?? "offline"}
              </Badge>
            </div>
          </div>
        </div>
        <Link href={`/cameras/${cameraId}`}>
          <Button variant="outline" size="sm" className="gap-1">
            <Settings className="h-4 w-4" />
            Settings
          </Button>
        </Link>
      </div>

      {/* Player section */}
      <Card>
        <CardContent className="pt-4">
          <RecordingPlayer
            playbackUrl={playbackUrl}
            onTimeUpdate={handlePlayerTimeUpdate}
          />
        </CardContent>
      </Card>

      {/* Timeline section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Timeline</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => navigateDay(-1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[180px] text-center">
                {formatDisplayDate(currentDate)}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => navigateDay(1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <RecordingTimeline
            recordings={recordings.map((r) => ({
              start_time: r.start_time,
              end_time: r.end_time,
            }))}
            onSeek={handleTimelineSeek}
            currentTime={currentPlayTime}
            activeRecordingIndex={activeClipIndex}
          />
        </CardContent>
      </Card>

      {/* Clips table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Clips{" "}
            <span className="font-normal text-muted-foreground">
              ({recordings.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="size-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
            </div>
          ) : recordings.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No recordings found for this day.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={recordings.length > 0 && selectedIds.size === recordings.length}
                        onCheckedChange={(checked) =>
                          setSelectedIds(checked ? new Set(recordings.map((r) => r.id)) : new Set())
                        }
                      />
                    </TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recordings.map((rec) => {
                    const hasEnd = rec.end_time != null;
                    const durationMs = hasEnd
                      ? new Date(rec.end_time!).getTime() - new Date(rec.start_time).getTime()
                      : 0;
                    return (
                      <TableRow key={rec.id} data-selected={selectedIds.has(rec.id) || undefined}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(rec.id)}
                            onCheckedChange={(checked) => {
                              setSelectedIds((prev) => {
                                const next = new Set(prev);
                                checked ? next.add(rec.id) : next.delete(rec.id);
                                return next;
                              });
                            }}
                          />
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatTime(rec.start_time)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {hasEnd ? formatTime(rec.end_time!) : (
                            <span className="text-amber-600 font-medium">In progress</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {hasEnd ? formatDuration(durationMs) : (
                            <span className="text-amber-600">Recording...</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatBytes(rec.size_bytes)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => playRecording(rec.id)}
                              title="Play"
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => downloadRecording(rec.id)}
                              title="Download"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Bulk actions bar */}
          {selectedIds.size > 0 && (
            <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
              <div className="flex items-center gap-3 rounded-lg border bg-background px-4 py-2.5 shadow-lg">
                <span className="text-sm font-medium">{selectedIds.size} selected</span>
                <div className="h-4 w-px bg-border" />
                <Button variant="outline" size="sm" className="gap-1.5" onClick={handleBulkDownload}>
                  <Download className="size-3.5" /> Download
                </Button>
                {canEdit && (
                  <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive" onClick={handleBulkDelete}>
                    <Trash2 className="size-3.5" /> Delete
                  </Button>
                )}
                <div className="h-4 w-px bg-border" />
                <Button variant="ghost" size="icon" className="size-7" onClick={() => setSelectedIds(new Set())}>
                  <X className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Camera Info section */}
      {camera && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recording Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Mode</dt>
                <dd className="font-medium mt-0.5">
                  {camera.recording_mode ?? "Continuous"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Retention</dt>
                <dd className="font-medium mt-0.5">
                  {camera.retention_days != null
                    ? `${camera.retention_days} days`
                    : "30 days (default)"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Storage Used</dt>
                <dd className="font-medium mt-0.5">
                  {camera.storage_used != null
                    ? formatBytes(camera.storage_used)
                    : formatBytes(recordings.reduce((sum, r) => sum + (r.size_bytes ?? 0), 0))}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Inherited From</dt>
                <dd className="font-medium mt-0.5">
                  {camera.inherited_from ?? "Default"}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------- Page export with Suspense ----------

export default function RecordingDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <div className="size-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
        </div>
      }
    >
      <RecordingDetailContent />
    </Suspense>
  );
}
