"use client"

import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

interface UsageMeter {
  label: string
  current: number
  limit: number
}

interface UsageMetersProps {
  meters: UsageMeter[]
}

function getColor(percentage: number): string {
  if (percentage >= 90) return "text-red-600 dark:text-red-400"
  if (percentage >= 70) return "text-yellow-600 dark:text-yellow-400"
  return "text-green-600 dark:text-green-400"
}

function getBarColor(percentage: number): string {
  if (percentage >= 90) return "[&>div]:bg-red-500"
  if (percentage >= 70) return "[&>div]:bg-yellow-500"
  return "[&>div]:bg-green-500"
}

export function UsageMeters({ meters }: UsageMetersProps) {
  return (
    <div className="space-y-4">
      {meters.map((meter) => {
        const percentage =
          meter.limit >= 999999
            ? 0
            : Math.min(100, Math.round((meter.current / meter.limit) * 100))
        const displayLimit =
          meter.limit >= 999999 ? "Unlimited" : meter.limit.toLocaleString()

        return (
          <div key={meter.label} className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{meter.label}</span>
              <span className={cn("tabular-nums", getColor(percentage))}>
                {meter.current.toLocaleString()} / {displayLimit}
                {meter.limit < 999999 && (
                  <span className="text-muted-foreground ml-1">
                    ({percentage}%)
                  </span>
                )}
              </span>
            </div>
            <Progress
              value={meter.current}
              max={meter.limit >= 999999 ? 1 : meter.limit}
              className={cn("h-2", getBarColor(percentage))}
            />
          </div>
        )
      })}
    </div>
  )
}
