"use client"

import { useEffect, useState, type ReactNode } from "react"
import { Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { apiClient } from "@/lib/api-client"

interface LicenseStatusResponse {
  data: {
    features?: string[]
    limits?: {
      cameras: number
      projects: number
      users: number
    }
    is_on_prem?: boolean
    status?: string
  }
}

interface UsageResponse {
  data: {
    cameras: { current: number; limit: number }
    projects: { current: number; limit: number }
    users: { current: number; limit: number }
  }
}

interface FeatureGateProps {
  /** Feature flag name (e.g. "recording", "webhooks") or resource name ("cameras", "projects", "users") */
  feature: string
  children: ReactNode
  fallback?: ReactNode
}

const RESOURCE_FEATURES = ["cameras", "projects", "users"]

/**
 * FeatureGate — checks both feature flags (from license) and resource limits (from usage).
 *
 * For feature flags like "recording", "webhooks", "embed":
 *   Checks if the feature is in the active license's feature list.
 *
 * For resource limits like "cameras", "projects", "users":
 *   Checks if current usage is below the limit.
 */
export function FeatureGate({ feature, children, fallback }: FeatureGateProps) {
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function checkFeature() {
      try {
        if (RESOURCE_FEATURES.includes(feature)) {
          // Resource limit check via usage API
          const res = await apiClient.get<UsageResponse>("/billing/usage")
          if (cancelled) return

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
        } else {
          // Feature flag check via license status API
          const res = await apiClient.get<LicenseStatusResponse>("/license/status")
          if (cancelled) return

          const data = res.data
          // Cloud deployments have all features
          if (!data.is_on_prem) {
            setAllowed(true)
            return
          }
          // Check if feature is in the active license's feature list
          const features = data.features ?? []
          setAllowed(features.includes(feature))
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
