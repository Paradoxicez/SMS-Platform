"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Play, Download, X } from "lucide-react"
import { RecBadge } from "@/components/cameras/rec-badge"
import { toast } from "sonner"
import { formatDateTime } from "@/lib/format-date"
import { getApiBaseUrl } from "@/lib/api-url"
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
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i] ?? "B"}`
}

const API_BASE = getApiBaseUrl()

export function RecordingCard({ recording, selected, onSelectChange }: RecordingCardProps) {
  const router = useRouter()
  const [imgError, setImgError] = useState(false)
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null)
  const [loadingPlay, setLoadingPlay] = useState(false)
  const thumbnailUrl = `${API_BASE}/cameras/${recording.camera_id}/thumbnail`

  function handleCardClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement
    if (target.closest("[data-slot='checkbox']") || target.closest("[data-role='checkbox-area']") || target.closest("button") || target.closest("a") || target.closest("video")) return
    const dateStr = new Date(recording.start_time).toISOString().split("T")[0]!
    router.push(`/recordings/${recording.camera_id}?date=${dateStr}&clip=${recording.id}`)
  }

  async function handlePlay(e: React.MouseEvent) {
    e.stopPropagation()
    if (playbackUrl) { setPlaybackUrl(null); return } // toggle off
    setLoadingPlay(true)
    try {
      const headers: Record<string, string> = {}
      try {
        const sessionRes = await fetch("/api/auth/session")
        const session = await sessionRes.json()
        if (session?.accessToken) headers["Authorization"] = `Bearer ${session.accessToken}`
      } catch {}

      const res = await fetch(`${API_BASE}/recordings/${recording.id}/stream`, { headers })
      if (!res.ok) throw new Error()

      const blob = await res.blob()
      setPlaybackUrl(URL.createObjectURL(blob))
    } catch {
      toast.error("Failed to load recording")
    } finally {
      setLoadingPlay(false)
    }
  }

  async function handleDownload(e: React.MouseEvent) {
    e.stopPropagation()
    try {
      const headers: Record<string, string> = {}
      try {
        const sessionRes = await fetch("/api/auth/session")
        const session = await sessionRes.json()
        if (session?.accessToken) headers["Authorization"] = `Bearer ${session.accessToken}`
      } catch {}

      const res = await fetch(`${API_BASE}/recordings/${recording.id}/stream`, { headers })
      if (!res.ok) throw new Error()

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${recording.camera_name ?? recording.camera_id}_${recording.start_time}.mp4`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success("Download started")
    } catch {
      toast.error("Failed to download")
    }
  }

  return (
    <Card
      className="group cursor-pointer overflow-hidden transition-shadow hover:shadow-md"
      onClick={handleCardClick}
    >
      <div className="relative aspect-[4/3] bg-black">
        {/* Video playback or thumbnail */}
        {playbackUrl ? (
          <div className="absolute inset-0 z-10">
            <video
              src={playbackUrl}
              className="size-full object-cover"
              controls
              autoPlay
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={(e) => { e.stopPropagation(); setPlaybackUrl(null) }}
              className="absolute top-2 right-2 rounded-full p-1 bg-black/60 text-white hover:bg-black/80 transition-colors z-20"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : !imgError ? (
          <img
            src={thumbnailUrl}
            alt={recording.camera_name ?? "Recording"}
            className="absolute inset-0 size-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : null}

        {/* Checkbox — top left */}
        {!playbackUrl && (
          <div
            data-role="checkbox-area"
            className={`absolute left-2 top-2 z-10 transition-opacity ${
              selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rounded bg-black/50 p-0.5">
              <Checkbox
                checked={selected}
                onCheckedChange={(checked) => onSelectChange(recording.id, !!checked)}
              />
            </div>
          </div>
        )}

        {/* REC badge — if in progress */}
        {!recording.end_time && !playbackUrl && (
          <RecBadge className="absolute top-2 left-10 z-10" />
        )}

        {/* Top overlay — camera name + date */}
        {!playbackUrl && (
          <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/60 to-transparent p-2 pb-6 pointer-events-none">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-white truncate ml-7">
                {recording.camera_name ?? "Unknown"}
              </span>
            </div>
            <p className="text-[10px] text-white/50 ml-7 mt-0.5">
              {formatDateTime(recording.start_time)}
            </p>
          </div>
        )}

        {/* Bottom overlay — duration + size + actions */}
        {!playbackUrl && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 pt-6 flex items-end justify-between">
            <div className="flex items-center gap-2 text-[10px] text-white/80">
              <span>{formatDuration(recording.start_time, recording.end_time)}</span>
              <span>·</span>
              <span>{formatBytes(recording.size_bytes)}</span>
            </div>

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={handlePlay}
                disabled={loadingPlay}
                className="rounded-full p-1.5 bg-white/20 text-white backdrop-blur hover:bg-white/30 transition-colors"
                title="Play"
              >
                {loadingPlay ? (
                  <div className="size-3.5 animate-spin rounded-full border border-white/30 border-t-white" />
                ) : (
                  <Play className="size-3.5" />
                )}
              </button>
              <button
                onClick={handleDownload}
                className="rounded-full p-1.5 bg-white/20 text-white backdrop-blur hover:bg-white/30 transition-colors"
                title="Download"
              >
                <Download className="size-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
