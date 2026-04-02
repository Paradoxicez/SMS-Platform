"use client"

import { useEffect, useRef, useState } from "react"
import Hls from "hls.js"

const MAX_RETRIES = 5
const BASE_RETRY_DELAY = 2000 // 2 seconds

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
  const retryCountRef = useRef(0)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video || !src) return

    setLoading(true)
    setError(null)
    setRetrying(false)
    retryCountRef.current = 0

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        manifestLoadingMaxRetry: 6,
        manifestLoadingRetryDelay: 2000,
        levelLoadingMaxRetry: 6,
        levelLoadingRetryDelay: 2000,
        fragLoadingMaxRetry: 6,
        fragLoadingRetryDelay: 2000,
        // Prevent Chrome from caching live manifests (stale manifest = video freeze)
        // Use query string cache-busting instead of Cache-Control header (blocked by CORS)
        xhrSetup: (xhr, url) => {
          if (url.includes(".m3u8")) {
            const separator = url.includes("?") ? "&" : "?";
            xhr.open("GET", `${url}${separator}_=${Date.now()}`, true);
          }
        },
      })
      hlsRef.current = hls
      hls.loadSource(src)
      hls.attachMedia(video)
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setLoading(false)
        setError(null)
        setRetrying(false)
        retryCountRef.current = 0
        if (autoPlay) video.play().catch(() => {})
      })
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (!data.fatal) return

        // Try hls.js built-in recovery first
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          if (retryCountRef.current < MAX_RETRIES) {
            retryCountRef.current++
            const delay = BASE_RETRY_DELAY * Math.pow(2, retryCountRef.current - 1)
            setRetrying(true)
            setError(`Reconnecting... (${retryCountRef.current}/${MAX_RETRIES})`)
            retryTimerRef.current = setTimeout(() => {
              hls.startLoad()
            }, delay)
            return
          }
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          if (retryCountRef.current < MAX_RETRIES) {
            retryCountRef.current++
            setRetrying(true)
            setError(`Recovering... (${retryCountRef.current}/${MAX_RETRIES})`)
            hls.recoverMediaError()
            return
          }
        }

        // All retries exhausted
        const msg = "Stream error: " + data.type
        setError(msg)
        setLoading(false)
        setRetrying(false)
        onErrorRef.current?.(data.type)
      })
      return () => {
        if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
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
      {loading && !retrying && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="size-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70 text-sm z-10 gap-2">
          {retrying && (
            <div className="size-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          )}
          <span>{error}</span>
        </div>
      )}
      <video ref={videoRef} className="size-full" controls playsInline />
    </div>
  )
}
