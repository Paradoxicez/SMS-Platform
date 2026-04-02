"use client";

import { useCallback, useMemo, useRef, useState } from "react";

interface TimelineRecording {
  start_time: string;
  end_time: string | null;
}

interface RecordingTimelineProps {
  recordings: TimelineRecording[];
  onSeek: (timestamp: Date) => void;
  currentTime: Date | null;
  activeRecordingIndex?: number;
}

function formatHM(d: Date): string {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatHMS(d: Date): string {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

export function RecordingTimeline({
  recordings,
  onSeek,
  currentTime,
  activeRecordingIndex,
}: RecordingTimelineProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const [hoverTime, setHoverTime] = useState<Date | null>(null);
  const [hoverX, setHoverX] = useState(0);

  // Calculate zoom range — recordings range ± 1hr buffer, minimum 2hr window
  const { rangeStart, rangeMs } = useMemo(() => {
    if (recordings.length === 0) {
      const now = new Date();
      const start = new Date(now.toDateString());
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      return { rangeStart: start, rangeEnd: end, rangeMs: end.getTime() - start.getTime() };
    }

    let minMs = Infinity;
    let maxMs = -Infinity;

    for (const rec of recordings) {
      const s = new Date(rec.start_time).getTime();
      const e = rec.end_time ? new Date(rec.end_time).getTime() : Date.now();
      if (s < minMs) minMs = s;
      if (e > maxMs) maxMs = e;
    }

    // Add 1 hour buffer on each side
    const buffer = 60 * 60 * 1000;
    const start = new Date(minMs - buffer);
    const end = new Date(maxMs + buffer);

    // Minimum 2 hour window
    const minWindow = 2 * 60 * 60 * 1000;
    const range = end.getTime() - start.getTime();
    if (range < minWindow) {
      const mid = start.getTime() + range / 2;
      return {
        rangeStart: new Date(mid - minWindow / 2),
        rangeEnd: new Date(mid + minWindow / 2),
        rangeMs: minWindow,
      };
    }

    return { rangeStart: start, rangeEnd: end, rangeMs: range };
  }, [recordings]);

  const getPercent = useCallback(
    (date: Date) => {
      const ms = date.getTime() - rangeStart.getTime();
      return Math.max(0, Math.min(100, (ms / rangeMs) * 100));
    },
    [rangeStart, rangeMs],
  );

  const getTimeFromPercent = useCallback(
    (percent: number) => {
      return new Date(rangeStart.getTime() + percent * rangeMs);
    },
    [rangeStart, rangeMs],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const bar = barRef.current;
      if (!bar) return;
      const rect = bar.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      onSeek(getTimeFromPercent(percent));
    },
    [getTimeFromPercent, onSeek],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const bar = barRef.current;
      if (!bar) return;
      const rect = bar.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      setHoverTime(getTimeFromPercent(percent));
      setHoverX(e.clientX - rect.left);
    },
    [getTimeFromPercent],
  );

  const playheadPercent = currentTime != null ? getPercent(currentTime) : null;

  // Generate tick labels
  const ticks = useMemo(() => {
    const result: { percent: number; label: string }[] = [];
    const count = 5;
    const stepMs = rangeMs / count;
    for (let i = 0; i <= count; i++) {
      const t = new Date(rangeStart.getTime() + i * stepMs);
      result.push({ percent: (i / count) * 100, label: formatHM(t) });
    }
    return result;
  }, [rangeStart, rangeMs]);

  return (
    <div className="w-full select-none">
      {/* Timeline bar */}
      <div
        ref={barRef}
        className="relative w-full h-10 bg-muted rounded-lg cursor-pointer overflow-hidden group"
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverTime(null)}
      >
        {/* Recording segments */}
        {recordings.map((rec, i) => {
          const start = getPercent(new Date(rec.start_time));
          const end = rec.end_time
            ? getPercent(new Date(rec.end_time))
            : currentTime
              ? getPercent(currentTime)
              : Math.min(start + 3, 100);
          const width = Math.max(end - start, 0.8);
          const isInProgress = !rec.end_time;
          const isActive = activeRecordingIndex === i;
          return (
            <div
              key={i}
              className={`absolute top-0 h-full rounded-sm transition-colors ${
                isInProgress
                  ? "bg-amber-500/60 animate-pulse"
                  : isActive
                    ? "bg-emerald-500"
                    : "bg-emerald-500/50 hover:bg-emerald-500/70"
              }`}
              style={{ left: `${start}%`, width: `${width}%` }}
            />
          );
        })}

        {/* Playhead */}
        {playheadPercent != null && (
          <div
            className="absolute top-0 h-full w-0.5 bg-red-500 z-10 pointer-events-none"
            style={{ left: `${playheadPercent}%` }}
          >
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 size-2 rounded-full bg-red-500" />
          </div>
        )}

        {/* Hover line + tooltip */}
        {hoverTime && (
          <>
            <div
              className="absolute top-0 h-full w-px bg-white/40 z-10 pointer-events-none"
              style={{ left: `${hoverX}px` }}
            />
            <div
              className="absolute -top-8 z-20 rounded bg-black/80 px-2 py-1 text-[10px] text-white pointer-events-none whitespace-nowrap"
              style={{ left: `${Math.min(Math.max(hoverX - 30, 0), (barRef.current?.clientWidth ?? 300) - 70)}px` }}
            >
              {formatHMS(hoverTime)}
            </div>
          </>
        )}
      </div>

      {/* Time labels */}
      <div className="relative w-full h-5 mt-1">
        {ticks.map((tick, i) => (
          <span
            key={i}
            className="absolute text-[10px] text-muted-foreground"
            style={{
              left: `${tick.percent}%`,
              transform: i === 0 ? "none" : i === ticks.length - 1 ? "translateX(-100%)" : "translateX(-50%)",
            }}
          >
            {tick.label}
          </span>
        ))}
      </div>
    </div>
  );
}
