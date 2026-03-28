"use client"

import { useEffect, useRef, useState } from "react"
import Hls from "hls.js"

interface HlsPlayerProps {
  src: string
  autoPlay?: boolean
  className?: string
  onError?: (error: string) => void
}

export function HlsPlayer({ src, autoPlay = true, className, onError }: HlsPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video || !src) return

    setLoading(true)
    setError(null)

    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true })
      hlsRef.current = hls
      hls.loadSource(src)
      hls.attachMedia(video)
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setLoading(false)
        if (autoPlay) video.play().catch(() => {})
      })
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          const msg = "Stream error: " + data.type
          setError(msg)
          setLoading(false)
          onErrorRef.current?.(data.type)
        }
      })
      return () => {
        hls.destroy()
        hlsRef.current = null
      }
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src
      video.addEventListener("loadedmetadata", () => {
        setLoading(false)
        if (autoPlay) video.play().catch(() => {})
      })
      video.addEventListener("error", () => {
        const msg = "Stream playback error"
        setError(msg)
        setLoading(false)
        onErrorRef.current?.(msg)
      })
    } else {
      setError("HLS is not supported in this browser")
      setLoading(false)
    }
  }, [src, autoPlay])

  return (
    <div className={`relative aspect-video bg-black rounded-lg overflow-hidden ${className ?? ""}`}>
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
      <video ref={videoRef} className="size-full" controls playsInline />
    </div>
  )
}
