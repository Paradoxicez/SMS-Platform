"use client"

import { useEffect, useState, useCallback } from "react"
import { Save, HardDrive } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { apiClient } from "@/lib/api-client"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GlobalConfig {
  recording_mode: "continuous" | "scheduled" | "event_based"
  retention_days: number
  auto_purge: boolean
  storage_type: "local" | "s3"
  format: "fmp4" | "mkv"
  resolution: "original" | "720p" | "480p"
  max_segment_size_mb: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_GLOBAL_CONFIG: GlobalConfig = {
  recording_mode: "continuous",
  retention_days: 30,
  auto_purge: true,
  storage_type: "local",
  format: "fmp4",
  resolution: "original",
  max_segment_size_mb: 64,
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RecordingSettingsTab() {
  // Global config state
  const [config, setConfig] = useState<GlobalConfig>(DEFAULT_GLOBAL_CONFIG)
  const [configLoading, setConfigLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchGlobalConfig = useCallback(async () => {
    setConfigLoading(true)
    try {
      const res = await apiClient.get<{ data: GlobalConfig }>(
        "/recording-config/global",
      )
      setConfig(res.data)
    } catch {
      // Use defaults on error
    } finally {
      setConfigLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchGlobalConfig()
  }, [fetchGlobalConfig])

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  async function handleSaveGlobal() {
    setSaving(true)
    setSaveSuccess(false)
    setSaveError(null)
    try {
      await apiClient.put("/recording-config/global", config)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Failed to save configuration.",
      )
    } finally {
      setSaving(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  if (configLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Global Defaults */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="size-5" />
            Global Recording Defaults
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-2">
            {/* Recording Mode */}
            <div className="space-y-2">
              <Label htmlFor="recording-mode">Recording Mode</Label>
              <Select
                value={config.recording_mode}
                onValueChange={(val) =>
                  setConfig((prev) => ({
                    ...prev,
                    recording_mode: val as GlobalConfig["recording_mode"],
                  }))
                }
              >
                <SelectTrigger id="recording-mode">
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="continuous">Continuous</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="event_based">Event Based</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Default Retention */}
            <div className="space-y-2">
              <Label htmlFor="retention-days">Default Retention</Label>
              <Select
                value={String(config.retention_days)}
                onValueChange={(val) =>
                  setConfig((prev) => ({
                    ...prev,
                    retention_days: Number(val),
                  }))
                }
              >
                <SelectTrigger id="retention-days">
                  <SelectValue placeholder="Select retention" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="14">14 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="60">60 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Auto-purge */}
            <div className="flex items-center justify-between rounded-md border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="auto-purge">Auto-purge</Label>
                <p className="text-xs text-muted-foreground">
                  Automatically delete recordings past retention period
                </p>
              </div>
              <Switch
                id="auto-purge"
                checked={config.auto_purge}
                onCheckedChange={(checked) =>
                  setConfig((prev) => ({ ...prev, auto_purge: checked }))
                }
              />
            </div>

            {/* Storage Type */}
            <div className="space-y-2">
              <Label htmlFor="storage-type">Storage Type</Label>
              <Select
                value={config.storage_type}
                onValueChange={(val) =>
                  setConfig((prev) => ({
                    ...prev,
                    storage_type: val as GlobalConfig["storage_type"],
                  }))
                }
              >
                <SelectTrigger id="storage-type">
                  <SelectValue placeholder="Select storage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="local">Local</SelectItem>
                  <SelectItem value="s3">S3</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Format */}
            <div className="space-y-2">
              <Label htmlFor="format">Format</Label>
              <Select
                value={config.format}
                onValueChange={(val) =>
                  setConfig((prev) => ({
                    ...prev,
                    format: val as GlobalConfig["format"],
                  }))
                }
              >
                <SelectTrigger id="format">
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fmp4">fMP4</SelectItem>
                  <SelectItem value="mkv">MKV</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Resolution */}
            <div className="space-y-2">
              <Label htmlFor="resolution">Resolution</Label>
              <Select
                value={config.resolution}
                onValueChange={(val) =>
                  setConfig((prev) => ({
                    ...prev,
                    resolution: val as GlobalConfig["resolution"],
                  }))
                }
              >
                <SelectTrigger id="resolution">
                  <SelectValue placeholder="Select resolution" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="original">Original</SelectItem>
                  <SelectItem value="720p">720p</SelectItem>
                  <SelectItem value="480p">480p</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Max Segment Size */}
            <div className="space-y-2">
              <Label htmlFor="max-segment-size">Max Segment Size (MB)</Label>
              <Input
                id="max-segment-size"
                type="number"
                min={1}
                value={config.max_segment_size_mb}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    max_segment_size_mb: Number(e.target.value) || 1,
                  }))
                }
              />
            </div>
          </div>

          {/* Save feedback + button */}
          <div className="mt-6 flex items-center gap-3">
            <Button onClick={handleSaveGlobal} disabled={saving}>
              <Save className="mr-2 size-4" />
              {saving ? "Saving..." : "Save Defaults"}
            </Button>
            {saveSuccess && (
              <p className="text-sm text-green-600 dark:text-green-400">
                Configuration saved successfully.
              </p>
            )}
            {saveError && (
              <p className="text-sm text-destructive">{saveError}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
