"use client";

import { useCallback, useRef } from "react";

interface TimelineRecording {
  startTime: string;
  endTime: string;
}

interface RecordingTimelineProps {
  recordings: TimelineRecording[];
  onSeek: (timestamp: Date) => void;
  currentTime: Date | null;
}

const HOUR_LABELS = [0, 3, 6, 9, 12, 15, 18, 21];
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function RecordingTimeline({
  recordings,
  onSeek,
  currentTime,
}: RecordingTimelineProps) {
  const barRef = useRef<HTMLDivElement>(null);

  // Get the start of the day from the first recording or today
  const dayStart = recordings.length > 0
    ? new Date(new Date(recordings[0].startTime).toDateString())
    : new Date(new Date().toDateString());

  const getPercent = useCallback(
    (date: Date) => {
      const ms = date.getTime() - dayStart.getTime();
      return Math.max(0, Math.min(100, (ms / MS_PER_DAY) * 100));
    },
    [dayStart],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const bar = barRef.current;
      if (!bar) return;
      const rect = bar.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      const timestamp = new Date(dayStart.getTime() + percent * MS_PER_DAY);
      onSeek(timestamp);
    },
    [dayStart, onSeek],
  );

  const playheadPercent =
    currentTime != null ? getPercent(currentTime) : null;

  return (
    <div className="w-full select-none">
      {/* Timeline bar */}
      <div
        ref={barRef}
        className="relative w-full h-10 bg-muted rounded cursor-pointer overflow-hidden"
        onClick={handleClick}
      >
        {/* Recording segments */}
        {recordings.map((rec, i) => {
          const start = getPercent(new Date(rec.startTime));
          const end = getPercent(new Date(rec.endTime));
          const width = end - start;
          return (
            <div
              key={i}
              className="absolute top-0 h-full bg-green-500/70"
              style={{ left: `${start}%`, width: `${width}%` }}
            />
          );
        })}

        {/* Playhead */}
        {playheadPercent != null && (
          <div
            className="absolute top-0 h-full w-0.5 bg-red-500 z-10"
            style={{ left: `${playheadPercent}%` }}
          />
        )}
      </div>

      {/* Hour labels */}
      <div className="relative w-full h-5 mt-1">
        {HOUR_LABELS.map((hour) => {
          const percent = (hour / 24) * 100;
          return (
            <span
              key={hour}
              className="absolute text-xs text-muted-foreground -translate-x-1/2"
              style={{ left: `${percent}%` }}
            >
              {String(hour).padStart(2, "0")}
            </span>
          );
        })}
      </div>
    </div>
  );
}
