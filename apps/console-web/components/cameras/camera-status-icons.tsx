"use client"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { TooltipProvider } from "@/components/ui/tooltip"

interface CameraStatusIconsProps {
  healthStatus: string
  isRecording: boolean
}

/**
 * Camera status displayed as icon combo:
 * 🟢 = online/reachable
 * 🟡 = connecting/degraded/reconnecting
 * 🔴 = offline
 * ⚫ = stopped
 * + 🔴REC badge if recording
 */
export function CameraStatusIcons({ healthStatus, isRecording }: CameraStatusIconsProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-1.5">
        {/* Connection status dot */}
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              {(healthStatus === "connecting" || healthStatus === "reconnecting") && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              )}
              <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${getStatusColor(healthStatus)}`} />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {getStatusLabel(healthStatus)}
          </TooltipContent>
        </Tooltip>

        {/* Recording indicator */}
        {isRecording && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-0.5 rounded bg-black/80 px-1 py-px text-[9px] font-bold text-white leading-none">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
                </span>
                REC
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Recording active
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  )
}

function getStatusColor(status: string): string {
  switch (status) {
    case "online":
      return "bg-green-500"
    case "connecting":
    case "reconnecting":
      return "bg-amber-400"
    case "degraded":
      return "bg-amber-500"
    case "offline":
      return "bg-red-500"
    case "stopped":
    case "stopping":
    default:
      return "bg-gray-400"
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case "online":
      return "Online — camera connected"
    case "connecting":
      return "Connecting..."
    case "reconnecting":
      return "Reconnecting..."
    case "degraded":
      return "Degraded — unstable connection"
    case "offline":
      return "Offline — cannot reach camera"
    case "stopped":
      return "Stopped — stream not started"
    case "stopping":
      return "Stopping..."
    default:
      return status
  }
}
