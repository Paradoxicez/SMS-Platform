"use client"

import { useEffect } from "react"
import { useSession } from "next-auth/react"
import { apiClient } from "@/lib/api-client"
import { setDatePrefs, type DateFormatPref, type TimeFormatPref } from "@/lib/format-date"

/**
 * DatePrefsProvider — loads the user's date/time preferences from the API
 * and sets them globally for all formatDate/formatDateTime/formatTime calls.
 *
 * Mount this once in the app layout (inside SessionProvider).
 */
export function DatePrefsProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession()

  useEffect(() => {
    if (status !== "authenticated") return

    async function loadPrefs() {
      try {
        const res = await apiClient.get<{
          data: {
            timezone?: string
            date_format?: string
            time_format?: string
          }
        }>("/users/me")
        setDatePrefs({
          timezone: res.data.timezone ?? undefined,
          dateFormat: (res.data.date_format as DateFormatPref) ?? "YYYY-MM-DD",
          timeFormat: (res.data.time_format as TimeFormatPref) ?? "24h",
        })
      } catch {
        // Fall back to defaults
      }
    }

    loadPrefs()
  }, [status])

  return <>{children}</>
}
