"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { HlsPlayer } from "@/components/player/hls-player"
import { Radio, Eye } from "lucide-react"
import { toast } from "sonner"
import { apiClient } from "@/lib/api-client"
import type { Camera } from "@repo/types"

interface CameraCardProps {
  camera: Camera
  siteName?: string
  viewerCount?: number
  onClick?: () => void
  onRefresh?: () => void
}

function getHlsBase() {
  if (process.env.NEXT_PUBLIC_MEDIAMTX_HLS_URL) return process.env.NEXT_PUBLIC_MEDIAMTX_HLS_URL
  if (typeof window !== "undefined") return `${window.location.protocol}//${window.location.hostname}:8888`
  return "http://localhost:8888"
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === "online" ? "bg-emerald-400" :
    status === "degraded" ? "bg-amber-400" :
    status === "offline" || status === "stopped" ? "bg-red-400" :
    "bg-gray-400"
  return <div className={`size-1.5 rounded-full ${color}`} />
}

function RecToggle({ active, loading, onClick }: { active: boolean; loading: boolean; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold text-white transition-colors ${
        active ? "bg-red-600/80 hover:bg-red-600" : "bg-white/20 hover:bg-white/30"
      }`}
      title={active ? "Stop recording" : "Start recording"}
    >
      <span className="relative flex h-2 w-2">
        {active && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${active ? "bg-red-300" : "bg-white/60"}`} />
      </span>
      REC
    </button>
  )
}

export function CameraCard({ camera, siteName, viewerCount, onClick, onRefresh }: CameraCardProps) {
  const [actionLoading, setActionLoading] = useState(false)
  const status = (camera as any).health_status ?? "offline"
  const isOnline = status === "online" || status === "degraded" || status === "connecting" || status === "reconnecting"
  const [isRecording, setIsRecording] = useState((camera as any).recording_enabled === true)
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null)

  useEffect(() => {
    setIsRecording((camera as any).recording_enabled === true)
  }, [(camera as any).recording_enabled])

  // Get live stream URL when online
  useEffect(() => {
    if (!isOnline) { setPlaybackUrl(null); return }

    apiClient
      .post<{ data: { playback_url: string; stream_path?: string } }>("/playback/internal/sessions", {
        camera_id: camera.id,
      })
      .then((res) => {
        // Prefer stream_path with dynamic base (works across networks)
        if (res.data.stream_path) {
          setPlaybackUrl(`${getHlsBase()}/${res.data.stream_path}`)
        } else {
          setPlaybackUrl(res.data.playback_url)
        }
      })
      .catch(() => {
        // Fallback: original stream path
        setPlaybackUrl(`${getHlsBase()}/cam-${camera.id}/index.m3u8`)
      })
  }, [camera.id, isOnline])

  async function handleStartStop(e: React.MouseEvent) {
    e.stopPropagation()
    setActionLoading(true)
    try {
      if (isOnline) {
        await apiClient.post(`/cameras/${camera.id}/stop`, {})
        toast.success("Stream stopped")
      } else {
        await apiClient.post(`/cameras/${camera.id}/start`, {})
        toast.success("Stream starting...")
      }
      onRefresh?.()
    } catch {
      toast.error("Failed")
    } finally {
      setActionLoading(false)
    }
  }

  async function handleToggleRecord(e: React.MouseEvent) {
    e.stopPropagation()
    setActionLoading(true)
    try {
      if (isRecording) {
        await apiClient.post(`/cameras/${camera.id}/recording/disable`, {})
        setIsRecording(false)
        toast.success("Recording disabled")
      } else {
        await apiClient.post(`/cameras/${camera.id}/recording/enable`, {})
        setIsRecording(true)
        toast.success("Recording enabled")
      }
      onRefresh?.()
    } catch {
      toast.error("Failed")
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <Card
      className="group cursor-pointer overflow-hidden transition-shadow hover:shadow-md"
      onClick={onClick}
    >
      <div className="relative aspect-[4/3] bg-black">
        {/* Live stream or black screen */}
        {isOnline && playbackUrl ? (
          <div className="absolute inset-0" onClick={(e) => e.stopPropagation()}>
            <HlsPlayer
              src={playbackUrl}
              autoPlay
              className="size-full rounded-none [&_video]:rounded-none [&>div]:rounded-none"
              onError={() => {}}
            />
          </div>
        ) : null}

        {/* Top overlay — name + status */}
        <div className="absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/60 to-transparent p-2 pb-6 pointer-events-none">
          <div className="flex items-center gap-1.5">
            <StatusDot status={status} />
            <span className="text-xs font-medium text-white truncate">{camera.name}</span>
            <span className="text-[10px] text-white/60 capitalize ml-auto shrink-0">{status}</span>
          </div>
          {siteName && (
            <p className="text-[10px] text-white/50 truncate mt-0.5 pl-3">{siteName}</p>
          )}
        </div>

        {/* Bottom overlay — badges + action buttons */}
        <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/60 to-transparent p-2 pt-6 flex items-end justify-between pointer-events-none">
          {/* Left: viewer count */}
          <div className="flex items-center gap-2">
            {viewerCount !== undefined && viewerCount > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-white/80"><Eye className="size-3" />{viewerCount}</span>
            )}
          </div>

          {/* Right: action buttons — show on hover */}
          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto">
            {isOnline && (
              <RecToggle
                active={isRecording}
                loading={actionLoading}
                onClick={handleToggleRecord}
              />
            )}
            <button
              onClick={handleStartStop}
              disabled={actionLoading}
              className={`rounded-full p-1.5 backdrop-blur transition-colors ${
                isOnline
                  ? "bg-emerald-500/80 text-white hover:bg-emerald-500"
                  : "bg-white/20 text-white hover:bg-white/30"
              }`}
              title={isOnline ? "Stop stream" : "Start stream"}
            >
              <Radio className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    </Card>
  )
}
