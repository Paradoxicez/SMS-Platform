"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { HlsPlayer } from "@/components/player/hls-player";

interface RecordingPlayerProps {
  playbackUrl: string | null;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
}

function formatPlayerTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function TimeUpdatePoller({ onTick }: { onTick: () => void }) {
  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;

  useEffect(() => {
    const id = setInterval(() => onTickRef.current(), 500);
    return () => clearInterval(id);
  }, []);

  return null;
}

export function RecordingPlayer({
  playbackUrl,
  onTimeUpdate,
}: RecordingPlayerProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  onTimeUpdateRef.current = onTimeUpdate;

  const handleTimeUpdate = useCallback(() => {
    const video = document.querySelector<HTMLVideoElement>(
      "[data-recording-player] video",
    );
    if (!video) return;
    const ct = video.currentTime;
    const dur = video.duration;
    setCurrentTime(ct);
    setDuration(dur);
    onTimeUpdateRef.current?.(ct, dur);
  }, []);

  if (!playbackUrl) {
    return (
      <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Select a recording clip or click on the timeline to start playback.
        </p>
      </div>
    );
  }

  return (
    <div data-recording-player="">
      <HlsPlayer src={playbackUrl} autoPlay onError={() => {}} />
      {/* Time display */}
      <div className="mt-2 flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <span>{formatPlayerTime(currentTime)}</span>
        <span>/</span>
        <span>{formatPlayerTime(duration)}</span>
      </div>
      <TimeUpdatePoller onTick={handleTimeUpdate} />
    </div>
  );
}
