"use client";

import { useEffect, useRef, useState } from "react";

interface WebRTCPlayerProps {
  cameraPath: string;
  className?: string;
  onError?: (error: string) => void;
}

const MEDIAMTX_WEBRTC_URL =
  process.env.NEXT_PUBLIC_MEDIAMTX_WEBRTC_URL ?? "http://localhost:8889";

export function WebRTCPlayer({
  cameraPath,
  className,
  onError,
}: WebRTCPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !cameraPath) return;

    setLoading(true);
    setError(null);

    let aborted = false;

    async function connect() {
      try {
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        });
        pcRef.current = pc;

        pc.addTransceiver("video", { direction: "recvonly" });
        pc.addTransceiver("audio", { direction: "recvonly" });

        pc.ontrack = (evt) => {
          if (video && evt.streams[0]) {
            video.srcObject = evt.streams[0];
            setLoading(false);
          }
        };

        pc.onconnectionstatechange = () => {
          if (
            pc.connectionState === "failed" ||
            pc.connectionState === "disconnected"
          ) {
            const msg = `WebRTC connection ${pc.connectionState}`;
            setError(msg);
            setLoading(false);
            onError?.(msg);
          }
        };

        // Create offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // Wait for ICE gathering
        await new Promise<void>((resolve) => {
          if (pc.iceGatheringState === "complete") {
            resolve();
            return;
          }
          const handler = () => {
            if (pc.iceGatheringState === "complete") {
              pc.removeEventListener("icegatheringstatechange", handler);
              resolve();
            }
          };
          pc.addEventListener("icegatheringstatechange", handler);
          // Timeout after 3 seconds
          setTimeout(resolve, 3000);
        });

        if (aborted) return;

        // Send offer to WHEP endpoint
        const whepUrl = `${MEDIAMTX_WEBRTC_URL}/${cameraPath}/whep`;
        const res = await fetch(whepUrl, {
          method: "POST",
          headers: { "Content-Type": "application/sdp" },
          body: pc.localDescription!.sdp,
        });

        if (!res.ok) {
          throw new Error(`WHEP request failed: ${res.status}`);
        }

        const answerSdp = await res.text();
        await pc.setRemoteDescription(
          new RTCSessionDescription({ type: "answer", sdp: answerSdp }),
        );
      } catch (err) {
        if (aborted) return;
        const msg =
          err instanceof Error ? err.message : "WebRTC connection failed";
        setError(msg);
        setLoading(false);
        onError?.(msg);
      }
    }

    connect();

    return () => {
      aborted = true;
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
    };
  }, [cameraPath, onError]);

  return (
    <div
      className={`relative aspect-video bg-black rounded-lg overflow-hidden ${className ?? ""}`}
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="size-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-white/70 text-sm z-10">
          {error}
        </div>
      )}
      <video
        ref={videoRef}
        className="size-full"
        autoPlay
        playsInline
        controls
      />
    </div>
  );
}
