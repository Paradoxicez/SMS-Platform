"use client"

import { useEffect, useState, type ReactNode } from "react"
import { Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { apiClient } from "@/lib/api-client"

interface FeatureGateProps {
  feature: string
  children: ReactNode
  fallback?: ReactNode
}

export function FeatureGate({ feature, children, fallback }: FeatureGateProps) {
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function checkFeature() {
      try {
        const res = await apiClient.get<{
          data: {
            plan_name: string
            cameras: { current: number; limit: number }
            projects: { current: number; limit: number }
            users: { current: number; limit: number }
          }
        }>("/billing/usage")

        if (cancelled) return

        // Check if the feature is gated by usage data
        // For resource limits, check the relevant resource
        // For feature flags, we'd need an additional endpoint; for now assume allowed
        // unless the resource is at its limit
        const data = res.data
        if (feature === "cameras" && data.cameras.current >= data.cameras.limit) {
          setAllowed(false)
        } else if (feature === "projects" && data.projects.current >= data.projects.limit) {
          setAllowed(false)
        } else if (feature === "users" && data.users.current >= data.users.limit) {
          setAllowed(false)
        } else {
          setAllowed(true)
        }
      } catch {
        // On error, allow access (fail open for UX)
        if (!cancelled) setAllowed(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    checkFeature()
    return () => {
      cancelled = true
    }
  }, [feature])

  if (loading) {
    return <div className="animate-pulse h-16 bg-muted rounded-md" />
  }

  if (!allowed) {
    if (fallback) return <>{fallback}</>

    return (
      <Card className="border-muted">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-8">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <Lock className="size-6 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">Feature Locked</p>
            <p className="text-xs text-muted-foreground mt-1">
              This feature is not available on your current plan.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <a href="/billing">Upgrade Plan</a>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return <>{children}</>
}
