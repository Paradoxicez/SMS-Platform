"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { RecBadge } from "@/components/cameras/rec-badge";
import type { MapCamera } from "../../app/(public)/map/[projectKey]/page";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const FALLBACK_HLS_URL = process.env.NEXT_PUBLIC_MEDIAMTX_HLS_URL ?? "http://localhost:8888";

interface CameraPinHoverProps {
  camera: MapCamera;
}

function formatUptime(createdAt?: string): string {
  if (!createdAt) return "";
  const diff = Date.now() - new Date(createdAt).getTime();
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days > 0) return `Up ${days}d ${hours}h`;
  if (hours > 0) return `Up ${hours}h`;
  return "Up <1h";
}

function formatLastSeen(createdAt?: string): string {
  if (!createdAt) return "";
  const diff = Date.now() - new Date(createdAt).getTime();
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `Last seen ${days}d ago`;
  if (hours > 0) return `Last seen ${hours}h ago`;
  return "Last seen recently";
}

function LivePreview({ cameraId }: { cameraId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<{ destroy: () => void } | null>(null);
  const [hlsUrl, setHlsUrl] = useState<string | null>(null);

  // Get playback URL via session (supports signed proxy) with fallback
  useEffect(() => {
    async function getUrl() {
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch(`${API_BASE_URL}/api/v1/playback/sessions`, {
          method: "POST",
          headers,
          body: JSON.stringify({ camera_id: cameraId, ttl: 120 }),
        });
        if (res.ok) {
          const data = await res.json();
          setHlsUrl(data.data.playback_url);
          return;
        }
      } catch { /* fallback */ }
      // Fallback to direct URL
      setHlsUrl(`${FALLBACK_HLS_URL}/cam-${cameraId}-hls/index.m3u8`);
    }
    getUrl();
  }, [cameraId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !hlsUrl) return;

    let hls: InstanceType<typeof import("hls.js").default> | null = null;

    async function init() {
      try {
        const Hls = (await import("hls.js")).default;

        if (!Hls.isSupported()) {
          if (video) {
            video.src = hlsUrl!;
            video.play().catch(() => {});
          }
          return;
        }

        hls = new Hls({
          enableWorker: false,
          lowLatencyMode: true,
          maxBufferLength: 5,
          maxMaxBufferLength: 10,
        });

        hls.loadSource(hlsUrl!);
        hls.attachMedia(video!);
        (hls as unknown as { on: (event: string, cb: () => void) => void }).on("hlsManifestParsed", () => {
          video?.play().catch(() => {});
        });

        hlsRef.current = hls as unknown as { destroy: () => void };
      } catch {
        // Failed to load HLS
      }
    }

    init();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [hlsUrl]);

  return (
    <video
      ref={videoRef}
      className="h-full w-full object-cover"
      muted
      autoPlay
      playsInline
    />
  );
}

export function CameraPinHover({ camera }: CameraPinHoverProps) {
  const isOnline = camera.status === "online" || camera.status === "degraded";

  return (
    <div className="w-64 overflow-hidden rounded-lg border bg-white shadow-lg">
      {/* Thumbnail with overlays */}
      <div className="relative h-36 w-full bg-gray-900">
        {camera.thumbnail_url ? (
          <img
            src={camera.thumbnail_url}
            alt={`${camera.name} thumbnail`}
            className="h-full w-full object-cover"
          />
        ) : isOnline ? (
          <LivePreview cameraId={camera.id} />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-gray-500">
            No preview
          </div>
        )}

        {/* Top-left: resolution or REC badge */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          <span className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
            720p
          </span>
          {camera.tags?.includes("__recording_enabled") && (
            <RecBadge />
          )}
        </div>

        {/* Top-right: live/offline indicator */}
        <div className="absolute top-2 right-2">
          {isOnline ? (
            <span className="inline-flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
              <span className="size-1.5 rounded-full bg-green-400 animate-pulse" />
              LIVE
            </span>
          ) : (
            <span className="rounded bg-red-600/80 px-1.5 py-0.5 text-[10px] font-medium text-white">
              OFFLINE
            </span>
          )}
        </div>
      </div>

      {/* Info section */}
      <div className="p-3 space-y-1.5">
        {/* Name + Status */}
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium">{camera.name}</span>
          <Badge
            variant={isOnline ? "default" : "destructive"}
            className="shrink-0 text-[10px] px-1.5 py-0"
          >
            {camera.status.charAt(0).toUpperCase() + camera.status.slice(1)}
          </Badge>
        </div>

        {/* Site name */}
        {camera.site_name && (
          <p className="text-xs text-muted-foreground truncate">
            {camera.site_name}
          </p>
        )}

        {/* Tags */}
        {camera.tags && camera.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {camera.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Uptime / Last seen */}
        {camera.created_at && (
          <p className="text-[11px] text-muted-foreground">
            {isOnline
              ? formatUptime(camera.created_at)
              : formatLastSeen(camera.created_at)}
          </p>
        )}
      </div>
    </div>
  );
}
