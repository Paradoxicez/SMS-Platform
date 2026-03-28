"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { MapCamera } from "../../app/(public)/map/[projectKey]/page";

/**
 * T088 + T089: Click-to-play dialog
 *
 * Opens on marker click. Auto-issues a playback session, initializes hls.js,
 * shows camera info + session expiry countdown, handles refresh & quota errors.
 * Closing the dialog revokes the session.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface PlayerDialogProps {
  camera: MapCamera;
  projectKey?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface PlaybackSession {
  session_id: string;
  playback_url: string;
  expires_at: string;
  ttl: number;
}

export function PlayerDialog({
  camera,
  projectKey,
  open,
  onOpenChange,
}: PlayerDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<unknown>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [session, setSession] = useState<PlaybackSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(0);

  // Issue a new playback session
  const issueSession = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      let url: string;
      let payload: Record<string, unknown>;

      if (projectKey) {
        // Public map: use project_key-based endpoint (no JWT needed)
        url = `${API_BASE_URL}/map/playback/sessions`;
        payload = {
          camera_id: camera.id,
          project_key: projectKey,
          ttl: 120,
        };
      } else {
        // Authenticated console: use standard endpoint
        url = `${API_BASE_URL}/api/v1/playback/sessions`;
        payload = {
          camera_id: camera.id,
          ttl: 120,
        };
        const token = typeof window !== "undefined"
          ? localStorage.getItem("auth_token")
          : null;
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
      }

      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const code = data?.error?.code;

        if (code === "QUOTA_EXCEEDED") {
          throw new Error("Viewer-hours quota exceeded. Please contact your administrator.");
        }

        throw new Error(data?.error?.message ?? `Failed to start playback (HTTP ${res.status})`);
      }

      const data = await res.json();
      const sessionData = data.data as PlaybackSession;
      setSession(sessionData);
      return sessionData;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start playback";
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [camera.id, projectKey]);

  // Refresh the session before expiry
  const refreshSession = useCallback(async (sessionId: string) => {
    try {
      const token = typeof window !== "undefined"
        ? localStorage.getItem("auth_token")
        : null;

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(
        `${API_BASE_URL}/api/v1/playback/sessions/${sessionId}/refresh`,
        { method: "POST", headers },
      );

      if (res.ok) {
        const data = await res.json();
        setSession((prev) =>
          prev ? { ...prev, expires_at: data.data.expires_at } : prev,
        );
      }
    } catch {
      // Refresh failed silently — countdown will reach 0 and user can retry
    }
  }, []);

  // Revoke session on dialog close
  const revokeSession = useCallback(async (sessionId: string) => {
    try {
      const token = typeof window !== "undefined"
        ? localStorage.getItem("auth_token")
        : null;

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      await fetch(
        `${API_BASE_URL}/api/v1/playback/sessions/${sessionId}/revoke`,
        { method: "POST", headers },
      );
    } catch {
      // Best effort revocation
    }
  }, []);

  // Initialize HLS player when session is ready
  useEffect(() => {
    if (!session || !videoRef.current) return;

    let hls: { destroy: () => void } | null = null;

    async function initHls() {
      try {
        const Hls = (await import("hls.js")).default;

        if (!Hls.isSupported() || !videoRef.current) {
          // Fallback: try native HLS (Safari)
          if (videoRef.current) {
            videoRef.current.src = session!.playback_url;
            videoRef.current.play().catch(() => {});
          }
          return;
        }

        const hlsInstance = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
        });

        hlsInstance.loadSource(session!.playback_url);
        hlsInstance.attachMedia(videoRef.current!);

        (hlsInstance as unknown as { on: (event: string, cb: () => void) => void }).on(
          "hlsManifestParsed" as string,
          () => {
            videoRef.current?.play().catch(() => {});
          },
        );

        hls = hlsInstance as unknown as { destroy: () => void };
        hlsRef.current = hls;
      } catch {
        setError("Failed to initialize video player");
      }
    }

    initHls();

    return () => {
      if (hls) {
        (hls as { destroy: () => void }).destroy();
        hlsRef.current = null;
      }
    };
  }, [session]);

  // Countdown timer and auto-refresh
  useEffect(() => {
    if (!session) return;

    const interval = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.floor(
          (new Date(session.expires_at).getTime() - Date.now()) / 1000,
        ),
      );
      setCountdown(remaining);

      // Auto-refresh when 30 seconds remain
      if (remaining === 30) {
        refreshSession(session.session_id);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [session, refreshSession]);

  // Issue session on open
  useEffect(() => {
    if (open && !session && !loading) {
      issueSession();
    }
  }, [open, session, loading, issueSession]);

  // Cleanup on close
  const handleClose = useCallback(() => {
    if (session) {
      revokeSession(session.session_id);
    }

    if (hlsRef.current) {
      (hlsRef.current as { destroy: () => void }).destroy();
      hlsRef.current = null;
    }

    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }

    setSession(null);
    setError(null);
    setCountdown(0);
    onOpenChange(false);
  }, [session, revokeSession, onOpenChange]);

  if (!open) return null;

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60">
      <div className="w-full max-w-3xl overflow-hidden rounded-lg bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold">{camera.name}</h3>
            <Badge
              variant={
                camera.status === "online"
                  ? "default"
                  : camera.status === "offline" || camera.status === "stopped"
                    ? "destructive"
                    : camera.status === "stopping"
                      ? "outline"
                      : "secondary"
              }
            >
              {camera.status}
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            {session && countdown > 0 && (
              <span className="text-sm text-muted-foreground">
                Session expires in {formatCountdown(countdown)}
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={handleClose}>
              Close
            </Button>
          </div>
        </div>

        {/* Video area */}
        <div className="relative aspect-video bg-black">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-white">Starting playback...</p>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <p className="text-sm text-red-400">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setError(null);
                  issueSession();
                }}
              >
                Retry
              </Button>
            </div>
          )}

          {session && !error && (
            <video
              ref={videoRef}
              className="h-full w-full"
              controls
              autoPlay
              muted
              playsInline
            />
          )}
        </div>
      </div>
    </div>
  );
}
