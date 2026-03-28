"use client"

import { ArrowUpCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface UpgradePromptProps {
  feature: string
  current: number
  limit: number
  planName: string
}

const upgradeMessages: Record<string, { nextPlan: string; nextLimit: number }> = {
  free: { nextPlan: "Starter", nextLimit: 50 },
  starter: { nextPlan: "Pro", nextLimit: 500 },
  pro: { nextPlan: "Enterprise", nextLimit: 999999 },
}

const FEATURE_DESCRIPTIONS: Record<string, string> = {
  recording: "Record camera streams and play back footage on demand.",
  webrtc: "Ultra-low latency streaming with sub-second delay.",
  embed: "Embed live camera streams on external websites via iframe.",
  api_access: "Access cameras and streams via REST API with API keys.",
  webhooks: "Send real-time events to external services when camera status changes.",
  csv_import: "Bulk import cameras from CSV files.",
  forwarding: "Forward RTSP streams to external services.",
  ai: "Connect AI/analytics services to process camera feeds.",
  sso: "Single sign-on with SAML or OIDC identity providers.",
  custom_profiles: "Create custom stream profiles with advanced settings.",
  map_public: "Display cameras on a public-facing map view.",
  multi_engine: "Distribute cameras across multiple Stream Engine nodes.",
}

/**
 * Shows when a feature is not available on the current plan.
 * Used on pages for features the user hasn't purchased.
 */
export function FeatureLockedPrompt({ featureName, description }: { featureName: string; description?: string }) {
  const label = featureName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  const desc = description ?? FEATURE_DESCRIPTIONS[featureName] ?? ""

  return (
    <div className="flex items-center justify-center min-h-[300px] p-6">
      <Card className="max-w-md w-full border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto size-12 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center mb-2">
            <ArrowUpCircle className="size-6 text-amber-600 dark:text-amber-400" />
          </div>
          <CardTitle className="text-base">{label}</CardTitle>
          {desc && (
            <CardDescription>{desc}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-sm text-muted-foreground">
            This feature is not available on your current plan. Contact your vendor to upgrade.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export function UpgradePrompt({
  feature,
  current,
  limit,
  planName,
}: UpgradePromptProps) {
  const upgrade = upgradeMessages[planName.toLowerCase()] ?? {
    nextPlan: "a higher plan",
    nextLimit: 0 as number,
  }

  const featureLabel = feature.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())

  return (
    <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <ArrowUpCircle className="size-5 text-amber-600 dark:text-amber-400" />
          <CardTitle className="text-base">Limit Reached</CardTitle>
        </div>
        <CardDescription className="text-amber-800 dark:text-amber-300">
          You&apos;ve reached the {featureLabel.toLowerCase()} limit ({current}/{limit}).
          Upgrade to {upgrade.nextPlan} for up to{" "}
          {upgrade.nextLimit >= 999999
            ? "unlimited"
            : upgrade.nextLimit}{" "}
          {featureLabel.toLowerCase()}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild variant="default" size="sm">
          <a href="/billing">Upgrade Plan</a>
        </Button>
      </CardContent>
    </Card>
  )
}
