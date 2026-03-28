"use client"

import { useEffect, useState } from "react"
import { KeyRound, Shield, AlertTriangle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiClient } from "@/lib/api-client"

interface LicenseStatusData {
  is_on_prem: boolean
  valid: boolean
  status: "active" | "expiring" | "grace_period" | "read_only" | "trial" | "invalid" | "none"
  license_id?: string
  tenant?: string
  plan?: string
  limits?: {
    cameras: number
    projects: number
    users: number
    sites: number
    apiKeys: number
    viewerHours: number
    retentionDays: number
  }
  features?: string[]
  addons?: string[]
  expires_at?: string
  days_remaining?: number
  reason?: string
}

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  expiring: "outline",
  trial: "secondary",
  grace_period: "outline",
  read_only: "destructive",
  invalid: "destructive",
  none: "secondary",
}

const statusLabels: Record<string, string> = {
  active: "Active",
  expiring: "Expiring Soon",
  trial: "Trial (Free Plan)",
  grace_period: "Grace Period",
  read_only: "Expired — Read Only",
  invalid: "Invalid",
  none: "No License",
}

export default function LicensePage() {
  const [licenseKey, setLicenseKey] = useState("")
  const [status, setStatus] = useState<LicenseStatusData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activating, setActivating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    async function loadStatus() {
      try {
        const res = await apiClient.get<{ data: LicenseStatusData }>(
          "/license/status",
        )
        setStatus(res.data)
      } catch (err) {
        console.error("Failed to load license status:", err)
      } finally {
        setLoading(false)
      }
    }
    loadStatus()
  }, [])

  async function handleActivate() {
    if (!licenseKey.trim()) {
      setError("Please enter a license key.")
      return
    }

    setError(null)
    setSuccess(null)
    setActivating(true)

    try {
      const res = await apiClient.post<{ data: LicenseStatusData }>(
        "/license/activate",
        { key: licenseKey.trim() },
      )

      setStatus(res.data)
      if (res.data.valid) {
        setSuccess("License activated successfully.")
        setLicenseKey("")
      } else {
        setError(res.data.reason ?? "License validation failed.")
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to activate license.",
      )
    } finally {
      setActivating(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-40 bg-muted rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">License</h1>
        <p className="text-muted-foreground">
          Manage your on-premises license key.
        </p>
      </div>

      {/* Current License Status */}
      {status && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Shield className="size-5" />
              <CardTitle>License Status</CardTitle>
              <Badge variant={statusColors[status.status] ?? "secondary"}>
                {statusLabels[status.status] ?? status.status}
              </Badge>
            </div>
            {!status.is_on_prem && (
              <CardDescription>
                This is a cloud deployment. License management is not required.
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {status.license_id && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">License ID</span>
                <span className="font-mono text-xs">{status.license_id}</span>
              </div>
            )}
            {status.tenant && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tenant</span>
                <span className="font-medium">{status.tenant}</span>
              </div>
            )}
            {status.plan && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Plan</span>
                <span className="font-medium capitalize">{status.plan}</span>
              </div>
            )}
            {status.limits && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Cameras</span>
                  <span className="font-medium">
                    {status.limits.cameras >= 999999 ? "Unlimited" : status.limits.cameras}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Projects / Sites</span>
                  <span className="font-medium">
                    {status.limits.projects >= 999999 ? "∞" : status.limits.projects}
                    {" / "}
                    {status.limits.sites >= 999999 ? "∞" : status.limits.sites}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Users</span>
                  <span className="font-medium">
                    {status.limits.users >= 999999 ? "Unlimited" : status.limits.users}
                  </span>
                </div>
              </>
            )}
            {status.addons && status.addons.length > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Addons</span>
                <div className="flex flex-wrap gap-1 justify-end">
                  {status.addons.map((a) => (
                    <Badge key={a} className="text-xs bg-green-100 text-green-700">
                      {a.replace(/_/g, " ")}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {status.features && status.features.length > 0 && (
              <div className="space-y-1">
                <span className="text-sm text-muted-foreground">Features</span>
                <div className="flex flex-wrap gap-1">
                  {status.features.map((f) => (
                    <Badge key={f} variant="outline" className="text-xs">
                      {f.replace(/_/g, " ")}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {status.expires_at && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Expires</span>
                <span className="font-medium">
                  {new Date(status.expires_at).toLocaleDateString()}
                  {status.days_remaining != null && (
                    <span className={`ml-2 ${status.days_remaining <= 30 ? "text-destructive" : "text-muted-foreground"}`}>
                      ({status.days_remaining > 0 ? `${status.days_remaining} days left` : `${Math.abs(status.days_remaining)} days ago`})
                    </span>
                  )}
                </span>
              </div>
            )}
            {status.reason && !status.valid && (
              <div className="flex items-center gap-2 text-sm text-destructive mt-2">
                <AlertTriangle className="size-4" />
                <span>{status.reason}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Activate License */}
      {status?.is_on_prem !== false && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <KeyRound className="size-5" />
              <CardTitle>Activate License</CardTitle>
            </div>
            <CardDescription>
              Enter your license key to activate or update your license.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="license-key">License Key</Label>
              <Input
                id="license-key"
                placeholder="Paste your license key here..."
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            {success && (
              <p className="text-sm text-green-600 dark:text-green-400">
                {success}
              </p>
            )}
          </CardContent>
          <CardFooter>
            <Button onClick={handleActivate} disabled={activating}>
              {activating ? "Activating..." : "Activate License"}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  )
}
