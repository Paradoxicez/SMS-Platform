"use client"

import { useRef, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { HlsPlayer } from "@/components/player/hls-player"
import { formatDateTime } from "@/lib/format-date"
import { Clock, HardDrive } from "lucide-react"
import type { Recording } from "./types"

interface RecordingCardProps {
  recording: Recording
  selected: boolean
  onSelectChange: (id: string, selected: boolean) => void
}

function formatDuration(startTime: string, endTime: string | null): string {
  if (!endTime) return "In progress"
  const ms = new Date(endTime).getTime() - new Date(startTime).getTime()
  if (ms < 0) return "-"
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

export function RecordingCard({ recording, selected, onSelectChange }: RecordingCardProps) {
  const router = useRouter()
  const [hovering, setHovering] = useState(false)
  const [imgError, setImgError] = useState(false)
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  const thumbnailUrl = `/api/v1/cameras/${recording.cameraId}/thumbnail`
  const previewUrl = recording.hlsUrl ?? null

  const handleMouseEnter = useCallback(() => {
    setHovering(true)
    if (previewUrl) {
      hoverTimeoutRef.current = setTimeout(() => setShowPreview(true), 400)
    }
  }, [previewUrl])

  const handleMouseLeave = useCallback(() => {
    setHovering(false)
    setShowPreview(false)
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
  }, [])

  function handleCardClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement
    if (target.closest("[data-slot='checkbox']") || target.closest("[data-role='checkbox-area']")) {
      return
    }
    const dateStr = recording.startTime.split("T")[0]
    router.push(`/recordings/${recording.cameraId}?date=${dateStr}`)
  }

  return (
    <Card
      className="group relative cursor-pointer overflow-hidden transition-shadow hover:shadow-md"
      onClick={handleCardClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Thumbnail / Preview area */}
      <div className="relative aspect-video bg-muted">
        {showPreview && previewUrl ? (
          <div className="absolute inset-0">
            <HlsPlayer src={previewUrl} autoPlay className="size-full rounded-none" />
            {/* Progress bar */}
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black/30">
              <div className="h-full animate-pulse bg-red-500" style={{ width: "60%" }} />
            </div>
          </div>
        ) : (
          <>
            {!imgError ? (
              <img
                src={thumbnailUrl}
                alt={recording.cameraName ?? "Recording thumbnail"}
                className="size-full object-cover"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="flex size-full items-center justify-center bg-muted text-muted-foreground text-xs">
                No thumbnail
              </div>
            )}
          </>
        )}

        {/* Checkbox */}
        <div
          data-role="checkbox-area"
          className={`absolute left-2 top-2 z-10 transition-opacity ${
            selected || hovering ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="rounded bg-background/80 p-0.5">
            <Checkbox
              checked={selected}
              onCheckedChange={(checked) => onSelectChange(recording.id, !!checked)}
            />
          </div>
        </div>

        {/* Duration badge */}
        <div className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white">
          {formatDuration(recording.startTime, recording.endTime)}
        </div>
      </div>

      {/* Info */}
      <div className="space-y-1 p-3">
        <p className="text-sm font-medium leading-tight truncate">
          {recording.cameraName ?? "Unknown Camera"}
        </p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="size-3" />
            {formatDateTime(recording.startTime)}
          </span>
          <span className="flex items-center gap-1">
            <HardDrive className="size-3" />
            {formatBytes(recording.sizeBytes)}
          </span>
        </div>
      </div>
    </Card>
  )
}
