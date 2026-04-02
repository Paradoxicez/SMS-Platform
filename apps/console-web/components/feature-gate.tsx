"use client"

import { useEffect, useState, type ReactNode } from "react"
import { Lock } from "lucide-react"
import { ArrowUpCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
    features?: Record<string, boolean>
    plan_name?: string
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
 * FeatureGate — checks both feature flags and resource limits.
 *
 * For feature flags like "recording", "webhooks", "embed":
 *   On-Prem: Checks if the feature is in the active license's feature list.
 *   Cloud/SaaS: Checks if the feature is enabled in the tenant's subscription plan.
 *
 * For resource limits like "cameras", "projects", "users":
 *   Checks if current usage is below the limit (both modes).
 */
export function FeatureGate({ feature, children, fallback }: FeatureGateProps) {
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [isOnPrem, setIsOnPrem] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function checkFeature() {
      try {
        if (RESOURCE_FEATURES.includes(feature)) {
          // Resource limit check via usage API (works for both modes)
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
          // Detect deployment mode
          const licenseRes = await apiClient.get<LicenseStatusResponse>("/license/status")
          if (cancelled) return
          const onPrem = licenseRes.data.is_on_prem === true
          setIsOnPrem(onPrem)

          if (onPrem) {
            // On-Prem: check feature from license
            const features = licenseRes.data.features ?? []
            setAllowed(features.includes(feature))
          } else {
            // Cloud/SaaS: check feature from subscription plan via usage API
            const usageRes = await apiClient.get<UsageResponse>("/billing/usage")
            if (cancelled) return
            const features = usageRes.data.features ?? {}
            setAllowed(features[feature] === true)
          }
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

    // Show different fallback based on deployment mode
    if (isOnPrem) {
      return (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto size-12 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center mb-2">
              <Lock className="size-6 text-amber-600 dark:text-amber-400" />
            </div>
            <CardTitle className="text-base">Feature Locked</CardTitle>
            <CardDescription>
              This feature is not available on your current license.
              Contact your vendor to upgrade.
            </CardDescription>
          </CardHeader>
        </Card>
      )
    }

    return (
      <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto size-12 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center mb-2">
            <ArrowUpCircle className="size-6 text-amber-600 dark:text-amber-400" />
          </div>
          <CardTitle className="text-base">Feature Locked</CardTitle>
          <CardDescription>
            This feature is not available on your current plan.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Button asChild variant="default" size="sm">
            <a href="/profile?tab=billing">Upgrade Plan</a>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return <>{children}</>
}
