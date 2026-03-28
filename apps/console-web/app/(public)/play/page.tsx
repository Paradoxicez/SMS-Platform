"use client"

import { useSearchParams } from "next/navigation"
import { useState, Suspense } from "react"
import { HlsPlayer } from "@/components/player/hls-player"
import { AlertCircle, WifiOff, Link2Off, Radio } from "lucide-react"

function ErrorState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType
  title: string
  description: string
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
  )
}

function PlayPageContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const [playerError, setPlayerError] = useState<string | null>(null)

  // No token provided
  if (!token) {
    return (
      <ErrorState
        icon={Link2Off}
        title="No playback token provided"
        description="Use the API to create a playback session. Call POST /api/v1/playback/sessions to get a playback URL, then pass it as the token parameter."
      />
    )
  }

  // Determine error type from HLS player error
  if (playerError) {
    const isNetworkError =
      playerError.includes("networkError") || playerError.includes("Network")

    if (isNetworkError) {
      return (
        <ErrorState
          icon={WifiOff}
          title="Unable to connect to stream"
          description="Check your network connection and ensure the stream server is reachable. If the problem persists, request a new playback session via the API."
        />
      )
    }

    return (
      <ErrorState
        icon={AlertCircle}
        title="Session expired or invalid"
        description="The playback session has expired or the token is no longer valid. Request a new session via POST /api/v1/playback/sessions."
      />
    )
  }

  return (
    <div className="w-full max-w-5xl">
      <HlsPlayer
        src={token}
        autoPlay
        onError={(err) => setPlayerError(err)}
      />
    </div>
  )
}

export default function PlayPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black p-4">
      <div className="mb-6 flex items-center gap-2 text-white/60">
        <Radio className="size-4" />
        <span className="text-sm font-medium">CCTV Platform Player</span>
      </div>
      <Suspense
        fallback={
          <div className="flex items-center justify-center">
            <div className="size-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          </div>
        }
      >
        <PlayPageContent />
      </Suspense>
    </div>
  )
}
