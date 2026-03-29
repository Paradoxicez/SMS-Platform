"use client";

import { useEffect, useState, useCallback } from "react";
import { useCameraStatusStream } from "@/hooks/use-camera-status-stream";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { Camera } from "@repo/types";
import { formatDateTime } from "@/lib/format-date";
import { apiClient, type CameraHealthStatus } from "../../lib/api-client";
import { HlsPlayer } from "@/components/player/hls-player";
import { VideoOff, Code2, CircleDot } from "lucide-react";
import { EmbedCodeDialog } from "./embed-code-dialog";
import { RecordingSettingsDialog } from "@/components/recordings/recording-settings-dialog";
import { RecBadge } from "@/components/cameras/rec-badge";

interface CameraDetailSheetProps {
  camera: Camera;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onUpdated?: () => void;
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "online":
      return (
        <Badge className="bg-green-100 text-green-700 hover:bg-green-200">
          Online
        </Badge>
      );
    case "offline":
      return <Badge variant="destructive">Offline</Badge>;
    case "degraded":
      return (
        <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-200">
          Degraded
        </Badge>
      );
    case "connecting":
      return (
        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200">
          Connecting
        </Badge>
      );
    case "reconnecting":
      return (
        <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-200">
          Reconnecting
        </Badge>
      );
    case "stopping":
      return (
        <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-200 animate-pulse">
          Stopping
        </Badge>
      );
    case "stopped":
      return <Badge variant="secondary">Stopped</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function maskRtspUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const masked = `rtsp://***@${parsed.hostname}:${parsed.port || "554"}${parsed.pathname}`;
    return masked;
  } catch {
    return "rtsp://***";
  }
}

export function CameraDetailSheet({
  camera,
  open,
  onOpenChange,
  onStart,
  onStop,
  onUpdated: _onUpdated,
}: CameraDetailSheetProps) {
  const [healthStatus, setHealthStatus] = useState<CameraHealthStatus | null>(
    null,
  );
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [embedDialogOpen, setEmbedDialogOpen] = useState(false);
  const [localStatus, setLocalStatus] = useState<string | null>(null);
  const [profileName, setProfileName] = useState("Default");
  const [bandwidth, setBandwidth] = useState<{ bytesIn: number; bytesOut: number } | null>(null);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [recordingLoading, setRecordingLoading] = useState(false);
  const [recordingSettingsOpen, setRecordingSettingsOpen] = useState(false);

  const currentStatus =
    localStatus ??
    (camera as any).health_status ??
    (camera as any).healthStatus;

  // Real-time status updates from SSE
  useCameraStatusStream((event) => {
    if (event.camera_id === camera.id) {
      setLocalStatus(event.new_state);
    }
  });

  useEffect(() => {
    setLocalStatus(null);
  }, [(camera as any).health_status, (camera as any).healthStatus]);

  const isOnline =
    currentStatus === "online" ||
    currentStatus === "degraded" ||
    currentStatus === "connecting" ||
    currentStatus === "reconnecting";

  const isStopped =
    currentStatus === "stopped" || currentStatus === "stopping" || currentStatus === "offline";

  useEffect(() => {
    if (open && camera) {
      setLoadingStatus(true);
      apiClient
        .getCameraStatus(camera.id)
        .then((res) => setHealthStatus(res.data))
        .catch(() => setHealthStatus(null))
        .finally(() => setLoadingStatus(false));

      const profileId = (camera as any).profile_id;
      if (profileId) {
        apiClient
          .getProfile(profileId)
          .then((res) =>
            setProfileName((res.data as any)?.name ?? "Default"),
          )
          .catch(() => setProfileName("Default"));
      } else {
        setProfileName("Default");
      }

      // Create playback session to get correct URL (supports signed proxy)
      setPlaybackUrl(null);
      if (isOnline) {
        apiClient
          .post<{ data: { playback_url: string } }>("/playback/sessions", {
            camera_id: camera.id,
            ttl: 300,
          })
          .then((res) => setPlaybackUrl(res.data.playback_url))
          .catch(() => {
            // Fallback to direct URL if session creation fails
            const fallback = process.env.NEXT_PUBLIC_MEDIAMTX_HLS_URL ?? "http://localhost:8888";
            setPlaybackUrl(`${fallback}/cam-${camera.id}-hls/index.m3u8`);
          });
      }
    }
  }, [open, camera, isOnline]);

  const isRecording = ((camera.tags as string[]) ?? []).includes("__recording_enabled");

  async function handleRecordingClick() {
    setRecordingLoading(true);
    try {
      const endpoint = isRecording
        ? `/cameras/${camera.id}/recording/disable`
        : `/cameras/${camera.id}/recording/enable`;
      await apiClient.post(endpoint, {});
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to toggle recording";
      console.error("Recording toggle error:", message);
      alert(message);
    } finally {
      setRecordingLoading(false);
    }
  }

  // Realtime bandwidth polling every 2s
  useEffect(() => {
    if (!open || !camera) return;

    function fetchBandwidth() {
      apiClient
        .get<{ data: { items: Record<string, unknown>[] } }>("/mediamtx/paths")
        .then((res) => {
          const pathName = `cam-${camera.id}`;
          let totalIn = 0;
          let totalOut = 0;
          for (const p of res.data.items ?? []) {
            const name = (p.name ?? p.name) as string;
            if (name?.startsWith(pathName)) {
              totalIn += ((p.bytes_received ?? p.bytesReceived) as number) ?? 0;
              totalOut += ((p.bytes_sent ?? p.bytesSent) as number) ?? 0;
            }
          }
          setBandwidth({ bytesIn: totalIn, bytesOut: totalOut });
        })
        .catch(() => {});
    }

    fetchBandwidth();
    const interval = setInterval(fetchBandwidth, 2000);
    return () => clearInterval(interval);
  }, [open, camera]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      onOpenChange(nextOpen);
    },
    [onOpenChange],
  );

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-[480px] sm:max-w-[480px] overflow-y-auto">
        <div className="px-6 py-6 space-y-6">
          <SheetHeader>
            <SheetTitle>{camera.name}</SheetTitle>
            <SheetDescription>
              Camera details and stream status
            </SheetDescription>
          </SheetHeader>

          {/* Stream Preview */}
          <div className="relative">
            {isRecording && <RecBadge className="absolute top-2 left-2 z-10" />}
            {isOnline && playbackUrl ? (
              <HlsPlayer
                src={playbackUrl}
                autoPlay
                className="rounded-lg"
              />
            ) : (
              <div className="relative aspect-video bg-muted rounded-lg flex items-center justify-center">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <VideoOff className="size-8" />
                  <span className="text-sm">Camera is offline</span>
                </div>
                <Badge
                  variant="destructive"
                  className="absolute top-2 right-2"
                >
                  Offline
                </Badge>
              </div>
            )}
          </div>

          <div>
            <Tabs defaultValue="info" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="info">Info</TabsTrigger>
                <TabsTrigger value="stream">Stream Stats</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="space-y-4">
                  <div className="space-y-4">
                    <div className="grid grid-cols-[100px_1fr] gap-2 items-baseline">
                      <span className="text-sm font-medium text-muted-foreground">Camera ID</span>
                      <span className="text-sm select-all break-all">{camera.id}</span>
                    </div>

                    <div className="grid grid-cols-[100px_1fr] gap-2 items-baseline">
                      <span className="text-sm font-medium text-muted-foreground">Name</span>
                      <span className="text-sm">{camera.name}</span>
                    </div>

                    <div className="grid grid-cols-[100px_1fr] gap-2 items-baseline">
                      <span className="text-sm font-medium text-muted-foreground">Stream URL</span>
                      <span className="text-sm font-mono break-all">
                        {maskRtspUrl(
                          (camera as any).rtsp_url ??
                            (camera as any).rtspUrl,
                        )}
                      </span>
                    </div>

                    <div className="grid grid-cols-[100px_1fr] gap-2 items-center">
                      <span className="text-sm font-medium text-muted-foreground">Status</span>
                      <div><StatusBadge status={currentStatus} /></div>
                    </div>

                    <div className="grid grid-cols-[100px_1fr] gap-2 items-baseline">
                      <span className="text-sm font-medium text-muted-foreground">Location</span>
                      <span className="text-sm">
                        {(camera as any).lat != null &&
                        (camera as any).lng != null
                          ? `${Number((camera as any).lat).toFixed(6)}, ${Number((camera as any).lng).toFixed(6)}`
                          : "Not set"}
                      </span>
                    </div>

                    {camera.tags &&
                      (camera.tags as string[]).length > 0 && (
                        <div className="grid grid-cols-[100px_1fr] gap-2 items-baseline">
                          <span className="text-sm font-medium text-muted-foreground">Tags</span>
                          <div className="flex flex-wrap gap-1">
                            {(camera.tags as string[]).map((tag) => (
                              <Badge
                                key={tag}
                                variant="outline"
                                className="text-xs"
                              >
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                    <div className="grid grid-cols-[100px_1fr] gap-2 items-baseline">
                      <span className="text-sm font-medium text-muted-foreground">Created</span>
                      <span className="text-sm">
                        {formatDateTime(
                          (camera as any).created_at ??
                            (camera as any).createdAt,
                        )}
                      </span>
                    </div>

                    <div className="grid grid-cols-[100px_1fr] gap-2 items-center">
                      <span className="text-sm font-medium text-muted-foreground">Profile</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{profileName}</Badge>
                        <Button variant="ghost" size="sm" asChild>
                          <a href="/profiles">Change</a>
                        </Button>
                      </div>
                    </div>
                  </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-4 border-t">
                      {isStopped ? (
                        <Button
                          className="flex-1"
                          onClick={() => {
                            setLocalStatus("connecting");
                            onStart(camera.id);
                          }}
                        >
                          Start Stream
                        </Button>
                      ) : currentStatus === "stopping" ? (
                        <Button
                          variant="outline"
                          className="flex-1"
                          disabled
                        >
                          Stopping...
                        </Button>
                      ) : (
                        <Button
                          variant="destructive"
                          className="flex-1"
                          onClick={() => {
                            setLocalStatus("stopping");
                            onStop(camera.id);
                          }}
                        >
                          Stop Stream
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setEmbedDialogOpen(true)}
                        title="Get Embed Code"
                      >
                        <Code2 className="size-4" />
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      {isRecording ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          className="flex-1"
                          onClick={handleRecordingClick}
                          disabled={recordingLoading}
                        >
                          <CircleDot className="size-3.5 mr-1" />
                          Stop Recording
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={handleRecordingClick}
                          disabled={recordingLoading}
                        >
                          <CircleDot className="size-3.5 mr-1" />
                          Record
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 whitespace-nowrap"
                        onClick={() => setRecordingSettingsOpen(true)}
                      >
                        Recording Settings
                      </Button>
                    </div>
              </TabsContent>

              <TabsContent value="stream" className="space-y-4">
                {loadingStatus ? (
                  <p className="text-sm text-muted-foreground">
                    Loading stream stats...
                  </p>
                ) : healthStatus ? (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-muted-foreground">
                        Status
                      </span>
                      <StatusBadge status={healthStatus.health_status} />
                    </div>

                    {healthStatus.metrics && (
                      <>
                        {healthStatus.metrics.codec && (
                          <div className="flex justify-between">
                            <span className="text-sm font-medium text-muted-foreground">
                              Codec
                            </span>
                            <span className="text-sm">
                              {healthStatus.metrics.codec as string}
                            </span>
                          </div>
                        )}

                        {healthStatus.metrics.resolution && (
                          <div className="flex justify-between">
                            <span className="text-sm font-medium text-muted-foreground">
                              Resolution
                            </span>
                            <span className="text-sm">
                              {healthStatus.metrics.resolution as string}
                            </span>
                          </div>
                        )}

                        {healthStatus.metrics.bitrate_kbps && (
                          <div className="flex justify-between">
                            <span className="text-sm font-medium text-muted-foreground">
                              Bitrate
                            </span>
                            <span className="text-sm">
                              {healthStatus.metrics.bitrate_kbps as number}{" "}
                              kbps
                            </span>
                          </div>
                        )}

                        {healthStatus.metrics.uptime && (
                          <div className="flex justify-between">
                            <span className="text-sm font-medium text-muted-foreground">
                              Uptime
                            </span>
                            <span className="text-sm">
                              {healthStatus.metrics.uptime as string}
                            </span>
                          </div>
                        )}

                        {healthStatus.metrics.last_segment_at && (
                          <div className="flex justify-between">
                            <span className="text-sm font-medium text-muted-foreground">
                              Last Segment
                            </span>
                            <span className="text-sm">
                              {formatDateTime(
                                healthStatus.metrics
                                  .last_segment_at as string,
                              )}
                            </span>
                          </div>
                        )}
                      </>
                    )}

                    {bandwidth && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-sm font-medium text-muted-foreground">
                            Data Received
                          </span>
                          <span className="text-sm">
                            {(bandwidth.bytesIn / 1024 / 1024).toFixed(1)} MB
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm font-medium text-muted-foreground">
                            Data Sent
                          </span>
                          <span className="text-sm">
                            {(bandwidth.bytesOut / 1024 / 1024).toFixed(1)} MB
                          </span>
                        </div>
                      </>
                    )}

                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-muted-foreground">
                        Last Updated
                      </span>
                      <span className="text-sm">
                        {formatDateTime(
                          healthStatus.updated_at,
                        )}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No stream statistics available. Start the stream to see
                    real-time data.
                  </p>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </SheetContent>

      <EmbedCodeDialog
        open={embedDialogOpen}
        onClose={() => setEmbedDialogOpen(false)}
        cameraId={camera.id}
        cameraName={camera.name}
      />

      <RecordingSettingsDialog
        open={recordingSettingsOpen}
        onOpenChange={setRecordingSettingsOpen}
        scopeType="camera"
        scopeId={camera.id}
        scopeName={camera.name}
      />
    </Sheet>
  );
}
