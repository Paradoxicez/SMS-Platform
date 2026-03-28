"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { HlsPlayer } from "./hls-player";
import { WebRTCPlayer } from "./webrtc-player";

interface UnifiedPlayerProps {
  cameraId: string;
  playbackUrl?: string;
  cameraPath?: string;
  className?: string;
}

export function UnifiedPlayer({
  cameraId: _cameraId,
  playbackUrl,
  cameraPath,
  className,
}: UnifiedPlayerProps) {
  const [mode, setMode] = useState<"hls" | "webrtc">("hls");

  const handleWebRTCError = useCallback(() => {
    toast.info("WebRTC failed, switching to HLS");
    setMode("hls");
  }, []);

  const canWebRTC = !!cameraPath;
  const canHLS = !!playbackUrl;

  return (
    <div className={className}>
      {/* Mode toggle */}
      {canHLS && canWebRTC && (
        <div className="flex items-center gap-1 mb-2">
          <Button
            variant={mode === "hls" ? "default" : "outline"}
            size="sm"
            className="text-xs h-7"
            onClick={() => setMode("hls")}
          >
            Standard
          </Button>
          <Button
            variant={mode === "webrtc" ? "default" : "outline"}
            size="sm"
            className="text-xs h-7"
            onClick={() => setMode("webrtc")}
          >
            Low Latency
          </Button>
        </div>
      )}

      {/* Player */}
      {mode === "hls" && playbackUrl ? (
        <HlsPlayer src={playbackUrl} />
      ) : mode === "webrtc" && cameraPath ? (
        <WebRTCPlayer
          cameraPath={cameraPath}
          onError={handleWebRTCError}
        />
      ) : (
        <div className="aspect-video bg-black rounded-lg flex items-center justify-center">
          <p className="text-white/50 text-sm">No stream available</p>
        </div>
      )}
    </div>
  );
}
