"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { HlsPlayer } from "@/components/player/hls-player";
import { WebRTCPlayer } from "@/components/player/webrtc-player";
import {
  AlertCircle,
  KeyRound,
  WifiOff,
  ShieldX,
  RefreshCw,
} from "lucide-react";

function ErrorState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 text-center text-white/80">
      <div className="flex size-16 items-center justify-center rounded-full bg-white/10">
        <Icon className="size-8" />
      </div>
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <p className="max-w-md text-sm">{description}</p>
      </div>
    </div>
  );
}

function EmbedPlayerContent() {
  const params = useParams<{ cameraId: string }>();
  const searchParams = useSearchParams();
  const cameraId = params.cameraId;
  const apiKey = searchParams.get("key");

  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [protocol, setProtocol] = useState<"hls" | "webrtc" | "both">("hls");
  const [codec, setCodec] = useState<string>("h264");
  const [playerMode, setPlayerMode] = useState<"hls" | "webrtc">("hls");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const renewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const issueSession = useCallback(async (isRenew = false) => {
    if (!apiKey) {
      setError("missing_key");
      setLoading(false);
      return;
    }

    // Only show loading spinner on initial load, not on renew
    if (!isRenew) {
      setLoading(true);
      setError(null);
    }

    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";
      const res = await fetch(`${baseUrl}/playback/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
        },
        body: JSON.stringify({
          camera_id: cameraId,
          ttl: 300,
          embed_origin: typeof window !== "undefined" ? window.location.origin : undefined,
        }),
      });

      if (!res.ok) {
        const status = res.status;
        if (status === 401 || status === 403) {
          let errorData: { error?: { code?: string } } | null = null;
          try {
            errorData = await res.json();
          } catch {
            // Not JSON
          }
          const code = errorData?.error?.code ?? "";
          if (code === "DOMAIN_BLOCKED" || code === "ORIGIN_NOT_ALLOWED") {
            setError("domain_blocked");
          } else {
            setError("invalid_key");
          }
        } else if (status === 404) {
          setError("camera_offline");
        } else {
          setError("unknown");
        }
        if (!isRenew) setLoading(false);
        return;
      }

      const data = await res.json();
      const url = data.data.playback_url;
      const ttl = data.data.ttl ?? 300;
      const serverProtocol = data.data.protocol ?? "hls";
      const serverCodec = data.data.codec ?? "h264";

      setPlaybackUrl(url);
      setProtocol(serverProtocol);
      setCodec(serverCodec);

      if (serverProtocol === "webrtc" && serverCodec === "passthrough") {
        setPlayerMode("webrtc");
      } else {
        setPlayerMode("hls");
      }

      // Schedule auto-renew at 80% of TTL (before token expires)
      if (renewTimerRef.current) clearTimeout(renewTimerRef.current);
      const renewIn = Math.floor(ttl * 0.8) * 1000;
      renewTimerRef.current = setTimeout(() => {
        issueSession(true);
      }, renewIn);
    } catch {
      if (!isRenew) setError("unknown");
    } finally {
      if (!isRenew) setLoading(false);
    }
  }, [apiKey, cameraId]);

  useEffect(() => {
    issueSession();
    return () => {
      if (renewTimerRef.current) clearTimeout(renewTimerRef.current);
    };
  }, [issueSession]);

  // Re-issue session when tab becomes visible again
  // (browser throttles timers in background tabs → renew timer may have missed → session expired)
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "visible") {
        // Tab is back — renew session immediately
        issueSession(true);
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [issueSession]);

  // Auto-retry on fatal player error
  useEffect(() => {
    if (error === "session_expired") {
      const timer = setTimeout(() => {
        issueSession();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [error, issueSession]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-black">
        <div className="size-10 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      </div>
    );
  }

  if (error) {
    const errorContent: Record<
      string,
      { icon: React.ElementType; title: string; description: string }
    > = {
      missing_key: {
        icon: KeyRound,
        title: "Missing API key",
        description:
          "Include ?key=your_api_key in the embed URL.",
      },
      invalid_key: {
        icon: ShieldX,
        title: "Invalid API key",
        description:
          "The provided API key is not valid. Check your key in the Developer portal.",
      },
      camera_offline: {
        icon: WifiOff,
        title: "Camera is currently offline",
        description:
          "The camera stream is not available right now. It may be offline or not configured.",
      },
      domain_blocked: {
        icon: ShieldX,
        title: "Playback not allowed on this domain",
        description:
          "Check your playback policy to ensure this domain is allowed.",
      },
      session_expired: {
        icon: RefreshCw,
        title: "Session expired",
        description: "Reconnecting automatically...",
      },
      unknown: {
        icon: AlertCircle,
        title: "Something went wrong",
        description:
          "An unexpected error occurred. Please try again later.",
      },
    };

    const content = errorContent[error] ?? errorContent.unknown;

    return (
      <div className="flex items-center justify-center h-screen w-screen bg-black">
        <ErrorState
          icon={content.icon}
          title={content.title}
          description={content.description}
        />
      </div>
    );
  }

  if (!playbackUrl) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-black">
        <ErrorState
          icon={AlertCircle}
          title="No playback URL"
          description="Could not obtain a playback session."
        />
      </div>
    );
  }

  // Extract camera path from WHEP URL for WebRTC player
  // WHEP URL format: http://host:port/cam-{id}/whep → cameraPath = cam-{id}
  const cameraPath = `cam-${cameraId}`;

  return (
    <div className="relative h-screen w-screen bg-black">
      {playerMode === "webrtc" ? (
        <WebRTCPlayer
          cameraPath={cameraPath}
          className="h-full w-full object-contain"
          onError={() => setError("session_expired")}
        />
      ) : (
        <HlsPlayer
          src={playbackUrl}
          autoPlay
          className="h-full w-full object-contain"
          onError={() => setError("session_expired")}
        />
      )}

      {/* Toggle button for "both" protocol mode */}
      {protocol === "both" && (
        <button
          onClick={() => setPlayerMode(playerMode === "hls" ? "webrtc" : "hls")}
          className="absolute bottom-4 right-4 rounded-md bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/80"
        >
          {playerMode === "hls" ? "Switch to WebRTC" : "Switch to HLS"}
        </button>
      )}
    </div>
  );
}

export default function EmbedPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen w-screen bg-black">
          <div className="size-10 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        </div>
      }
    >
      <EmbedPlayerContent />
    </Suspense>
  );
}
